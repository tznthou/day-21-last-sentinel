/**
 * The Last Sentinel - Server Entry Point
 * Post-apocalyptic web monitoring terminal
 */

import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Routes
import { router as targetsRouter } from './routes/targets.js';
import { router as streamRouter } from './routes/stream.js';
import { router as authRouter, requireAuth } from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// Environment Variable Validation
// ============================================
const isProduction = process.env.NODE_ENV === 'production';

// Required: INSFORGE_ANON_KEY
if (!process.env.INSFORGE_ANON_KEY) {
  console.error('❌ MISSING ENV: INSFORGE_ANON_KEY is required');
  console.error('   Get your anon key from InsForge dashboard');
  process.exit(1);
}

// Warn in production if SESSION_SECRET is not set
if (isProduction && !process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: SESSION_SECRET not set in production');
  console.warn('   Sessions will reset on server restart');
}

// ============================================
// Asset Check: Verify required CSS files exist
// ============================================
const requiredAssets = [
  '../public/css/output.css',
  '../public/css/crt.css'
];

for (const asset of requiredAssets) {
  const assetPath = join(__dirname, asset);
  if (!fs.existsSync(assetPath)) {
    console.error(`❌ MISSING ASSET: ${asset}`);
    console.error('   Run: npm run build:css');
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Security: CORS Configuration
// ============================================
const allowedOrigins = isProduction
  ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, mobile apps)
    if (!origin) return callback(null, true);

    // In development, allow all origins; in production, check whitelist
    if (!isProduction || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// Security: Helmet (CSP + Security Headers)
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.INSFORGE_BASE_URL || 'https://75ae3yns.us-west.insforge.app'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  xFrameOptions: { action: 'deny' },
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// ============================================
// Security: Rate Limiting
// ============================================
// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' // Skip health checks
});

// Strict rate limit for scraping operations
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 scans per minute
  message: { success: false, error: 'Scan rate limit exceeded' }
});

// Target creation limit
const targetCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 targets per hour
  message: { success: false, error: 'Target creation limit exceeded' }
});

// Auth rate limit (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { success: false, error: 'Too many authentication attempts' }
});

// Middleware
app.use(express.json({ limit: '100kb' })); // Limit request body size

// Apply general rate limit to all API routes
app.use('/api/', apiLimiter);

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sentinel.sid',
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// HTTPS redirect in production
if (isProduction) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

app.use(express.static(join(__dirname, '../public')));

// API Routes with specific rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRouter);

app.post('/api/targets', targetCreateLimiter, requireAuth); // Rate limit target creation
app.use('/api/targets', requireAuth, targetsRouter);

app.post('/api/stream/scan', scanLimiter); // Rate limit manual scans
app.use('/api/stream', streamRouter); // SSE needs custom auth handling

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OPERATIONAL',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '4.0.1',
    codename: 'SENTINEL'
  });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ████████╗██╗  ██╗███████╗    ██╗      █████╗ ███████╗████████╗  ║
║   ╚══██╔══╝██║  ██║██╔════╝    ██║     ██╔══██╗██╔════╝╚══██╔══╝  ║
║      ██║   ███████║█████╗      ██║     ███████║███████╗   ██║     ║
║      ██║   ██╔══██║██╔══╝      ██║     ██╔══██║╚════██║   ██║     ║
║      ██║   ██║  ██║███████╗    ███████╗██║  ██║███████║   ██║     ║
║      ╚═╝   ╚═╝  ╚═╝╚══════╝    ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝     ║
║                                                            ║
║   ███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗     ║
║   ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║     ║
║   ███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║     ║
║   ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║     ║
║   ███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗║
║   ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝║
║                                                            ║
║   SENTINEL OS v4.0.1 INITIALIZED                           ║
║   PORT: ${PORT}                                               ║
║   STATUS: WATCHING                                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
