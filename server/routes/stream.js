/**
 * SSE Stream Routes
 * Server-Sent Events for real-time signal updates
 */

import { Router } from 'express';
import { startMonitoring, stopMonitoring, getStatus, forceScan } from '../lib/signal.js';
import { generateNoise } from '../lib/scraper.js';

export const router = Router();

// Fallback user ID for unauthenticated requests (demo mode)
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

// Store active SSE connections
const connections = new Map();

/**
 * GET /api/stream/connect
 * Establish SSE connection
 */
router.get('/connect', (req, res) => {
  // Use session-based userId if available, fallback to header/query
  const userId = req.session?.sentinelId || req.headers['x-user-id'] || req.query.userId || DEMO_USER_ID;

  // Close existing connection for this user to prevent duplicates
  const existingConnection = connections.get(userId);
  if (existingConnection) {
    try {
      existingConnection.cleanup();
    } catch (e) {
      console.error('[SENTINEL] Error cleaning up existing connection:', e);
    }
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For nginx
  res.flushHeaders();

  // Helper to send SSE events (with error handling)
  const sendEvent = (type, data) => {
    try {
      if (!res.writableEnded) {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    } catch (error) {
      console.error('[SENTINEL] Error sending event:', error);
    }
  };

  // Centralized cleanup object to track all resources
  const cleanup = {
    noiseInterval: null,
    heartbeatInterval: null,
    connectionTimeout: null,
    isCleanedUp: false
  };

  // Unified cleanup function (called only once)
  const performCleanup = () => {
    if (cleanup.isCleanedUp) return;
    cleanup.isCleanedUp = true;

    console.log(`[SENTINEL] Cleaning up connection: ${userId}`);

    // Clear all intervals
    if (cleanup.noiseInterval) {
      clearInterval(cleanup.noiseInterval);
      cleanup.noiseInterval = null;
    }
    if (cleanup.heartbeatInterval) {
      clearInterval(cleanup.heartbeatInterval);
      cleanup.heartbeatInterval = null;
    }
    if (cleanup.connectionTimeout) {
      clearTimeout(cleanup.connectionTimeout);
      cleanup.connectionTimeout = null;
    }

    // Stop monitoring
    stopMonitoring(userId);

    // Remove connection
    connections.delete(userId);
  };

  // Send initial connection message
  sendEvent('connected', {
    message: 'SENTINEL LINK ESTABLISHED',
    timestamp: new Date().toISOString(),
    userId
  });

  // Store connection with cleanup function
  connections.set(userId, { res, sendEvent, cleanup: performCleanup });

  // Start sending periodic noise
  cleanup.noiseInterval = setInterval(() => {
    sendEvent('noise', {
      content: generateNoise(),
      timestamp: new Date().toISOString()
    });
  }, 5000);

  // Send heartbeat every 30 seconds
  cleanup.heartbeatInterval = setInterval(() => {
    sendEvent('heartbeat', { timestamp: new Date().toISOString() });
  }, 30000);

  // Connection timeout: Auto-disconnect after 2 hours to prevent zombie connections
  cleanup.connectionTimeout = setTimeout(() => {
    console.log(`[SENTINEL] Connection timeout: ${userId}`);
    sendEvent('status', { message: 'SESSION TIMEOUT - PLEASE RECONNECT' });
    res.end();
  }, 2 * 60 * 60 * 1000); // 2 hours

  // Handle client disconnect (single registration)
  req.on('close', performCleanup);
});

/**
 * POST /api/stream/start
 * Start monitoring session
 */
router.post('/start', async (req, res) => {
  const userId = req.session?.sentinelId || req.headers['x-user-id'] || DEMO_USER_ID;
  const connection = connections.get(userId);

  if (!connection) {
    return res.status(400).json({
      success: false,
      error: 'No active SSE connection. Connect first.'
    });
  }

  try {
    const sessionId = await startMonitoring(
      userId,
      // Signal callback
      (signal) => {
        connection.sendEvent('signal', signal);
      },
      // Noise callback
      (noise) => {
        connection.sendEvent('scan', {
          content: noise,
          timestamp: new Date().toISOString()
        });
      }
    );

    res.json({
      success: true,
      message: 'MONITORING INITIATED',
      sessionId
    });
  } catch (error) {
    console.error('[STREAM] Error starting monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start monitoring'
    });
  }
});

/**
 * POST /api/stream/stop
 * Stop monitoring session
 */
router.post('/stop', async (req, res) => {
  const userId = req.session?.sentinelId || req.headers['x-user-id'] || DEMO_USER_ID;

  await stopMonitoring(userId);

  const connection = connections.get(userId);
  if (connection) {
    connection.sendEvent('status', {
      message: 'MONITORING SUSPENDED',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    message: 'MONITORING SUSPENDED'
  });
});

/**
 * GET /api/stream/status
 * Get monitoring status
 */
router.get('/status', (req, res) => {
  const userId = req.session?.sentinelId || req.headers['x-user-id'] || DEMO_USER_ID;
  const status = getStatus(userId);
  const hasConnection = connections.has(userId);

  res.json({
    success: true,
    data: {
      ...status,
      connected: hasConnection
    }
  });
});

/**
 * POST /api/stream/scan
 * Force immediate scan
 */
router.post('/scan', async (req, res) => {
  const userId = req.session?.sentinelId || req.headers['x-user-id'] || DEMO_USER_ID;
  const connection = connections.get(userId);

  if (!connection) {
    return res.status(400).json({
      success: false,
      error: 'No active SSE connection'
    });
  }

  res.json({
    success: true,
    message: 'MANUAL SCAN INITIATED'
  });

  // Run scan asynchronously
  forceScan(
    userId,
    (signal) => connection.sendEvent('signal', signal),
    (noise) => connection.sendEvent('scan', { content: noise, timestamp: new Date().toISOString() })
  );
});
