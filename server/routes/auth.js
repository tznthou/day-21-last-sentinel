/**
 * Authentication Routes
 * Sentinel identity management
 */

import { Router } from 'express';
import crypto from 'crypto';
import { sentinels } from '../lib/insforge.js';

export const router = Router();

/**
 * Hash password using SHA-256 (same format as CryptoJS for compatibility)
 * @param {string} password
 * @returns {string} hex hash
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * POST /api/auth/register
 * Register a new sentinel
 */
router.post('/register', async (req, res) => {
  try {
    const { callsign, passcode } = req.body;

    // Validate input
    if (!callsign || !passcode) {
      return res.status(400).json({
        error: 'MISSING_CREDENTIALS',
        message: '需要提供代號和通行碼'
      });
    }

    // Validate callsign format (3-20 chars, alphanumeric + underscore)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(callsign)) {
      return res.status(400).json({
        error: 'INVALID_CALLSIGN',
        message: '代號需為 3-20 字元，僅限英數字和底線'
      });
    }

    // Validate passcode length (min 4 chars)
    if (passcode.length < 4) {
      return res.status(400).json({
        error: 'WEAK_PASSCODE',
        message: '通行碼至少需要 4 個字元'
      });
    }

    // Check if callsign already exists
    const existing = await sentinels.getByCallsign(callsign);
    if (existing) {
      return res.status(409).json({
        error: 'CALLSIGN_TAKEN',
        message: '此代號已被其他哨兵使用'
      });
    }

    // Hash passcode
    const passcodeHash = hashPassword(passcode);

    // Create sentinel
    const sentinel = await sentinels.create({
      callsign: callsign.toUpperCase(),
      passcode_hash: passcodeHash
    });

    // Set session
    req.session.sentinelId = sentinel.id;
    req.session.callsign = sentinel.callsign;

    res.status(201).json({
      success: true,
      message: '哨兵身份已建立',
      sentinel: {
        id: sentinel.id,
        callsign: sentinel.callsign
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: '身份建立失敗，請稍後再試'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate a sentinel
 */
router.post('/login', async (req, res) => {
  try {
    const { callsign, passcode } = req.body;

    // Validate input
    if (!callsign || !passcode) {
      return res.status(400).json({
        error: 'MISSING_CREDENTIALS',
        message: '需要提供代號和通行碼'
      });
    }

    // Find sentinel
    const sentinel = await sentinels.getByCallsign(callsign.toUpperCase());
    if (!sentinel) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: '代號或通行碼錯誤'
      });
    }

    // Verify passcode
    const passcodeHash = hashPassword(passcode);
    if (sentinel.passcode_hash !== passcodeHash) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: '代號或通行碼錯誤'
      });
    }

    // Update last login
    await sentinels.updateLastLogin(sentinel.id);

    // Set session
    req.session.sentinelId = sentinel.id;
    req.session.callsign = sentinel.callsign;

    res.json({
      success: true,
      message: '身份驗證成功',
      sentinel: {
        id: sentinel.id,
        callsign: sentinel.callsign
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'LOGIN_FAILED',
      message: '身份驗證失敗，請稍後再試'
    });
  }
});

/**
 * POST /api/auth/logout
 * End sentinel session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        error: 'LOGOUT_FAILED',
        message: '登出失敗'
      });
    }
    res.json({
      success: true,
      message: '已離開崗位'
    });
  });
});

/**
 * GET /api/auth/me
 * Get current sentinel info
 */
router.get('/me', (req, res) => {
  if (!req.session.sentinelId) {
    return res.status(401).json({
      error: 'NOT_AUTHENTICATED',
      message: '尚未驗證身份'
    });
  }

  res.json({
    authenticated: true,
    sentinel: {
      id: req.session.sentinelId,
      callsign: req.session.callsign
    }
  });
});

/**
 * Middleware: Require authentication
 */
export function requireAuth(req, res, next) {
  if (!req.session.sentinelId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: '需要先驗證哨兵身份'
    });
  }
  next();
}
