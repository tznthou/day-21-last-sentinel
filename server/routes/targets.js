/**
 * Watch Targets API Routes
 * CRUD operations for monitoring targets
 */

import { Router } from 'express';
import { targets, signals } from '../lib/insforge.js';
import { validateUrl } from '../lib/scraper.js';

// Input validation constants
const MAX_URL_LENGTH = 2048;
const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LENGTH = 100;
const MAX_NAME_LENGTH = 200;
const MIN_CHECK_INTERVAL = 60; // seconds
const MAX_TARGETS_PER_USER = 20;

export const router = Router();

/**
 * Get user ID from session
 * Auth middleware ensures session exists
 */
function getUserId(req) {
  return req.session.sentinelId;
}

/**
 * GET /api/targets
 * Get all targets for current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const data = await targets.getByUser(userId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/targets
 * Create a new target
 */
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { url, keywords, name, check_interval } = req.body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ success: false, error: `URL must be less than ${MAX_URL_LENGTH} characters` });
    }

    // SSRF protection: Validate URL
    try {
      validateUrl(url);
    } catch (error) {
      return res.status(400).json({ success: false, error: `Invalid URL: ${error.message}` });
    }

    // Validate keywords
    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ success: false, error: 'Keywords must be an array' });
    }
    if (keywords.length === 0 || keywords.length > MAX_KEYWORDS) {
      return res.status(400).json({ success: false, error: `Keywords count must be between 1 and ${MAX_KEYWORDS}` });
    }

    // Filter and validate keywords
    const validKeywords = keywords
      .filter(k => typeof k === 'string')
      .map(k => k.trim())
      .filter(k => k.length > 0 && k.length <= MAX_KEYWORD_LENGTH);

    if (validKeywords.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one valid keyword required' });
    }

    // Validate name
    if (name && (typeof name !== 'string' || name.length > MAX_NAME_LENGTH)) {
      return res.status(400).json({ success: false, error: `Name must be less than ${MAX_NAME_LENGTH} characters` });
    }

    // Check user's target count limit
    const existingTargets = await targets.getByUser(userId);
    if (existingTargets.length >= MAX_TARGETS_PER_USER) {
      return res.status(400).json({ success: false, error: `Maximum ${MAX_TARGETS_PER_USER} targets allowed` });
    }

    // Enforce minimum check interval
    const sanitizedInterval = Math.max(
      MIN_CHECK_INTERVAL,
      parseInt(check_interval) || 60
    );

    const target = await targets.create({
      user_id: userId,
      url: url.trim(),
      keywords: validKeywords,
      name: name?.trim() || null,
      check_interval: sanitizedInterval,
      is_active: true
    });

    res.status(201).json({ success: true, data: target });
  } catch (error) {
    console.error('Create target error:', error);
    // Don't expose internal error details
    res.status(500).json({ success: false, error: 'Failed to create target' });
  }
});

/**
 * PUT /api/targets/:id
 * Update a target
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { url, keywords, name, check_interval, is_active } = req.body;

    const updates = {};
    if (url !== undefined) {
      try {
        new URL(url);
        updates.url = url.trim();
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL format' });
      }
    }
    if (keywords !== undefined) {
      updates.keywords = keywords.map(k => k.trim()).filter(k => k);
    }
    if (name !== undefined) {
      updates.name = name?.trim() || null;
    }
    if (check_interval !== undefined) {
      updates.check_interval = check_interval;
    }
    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    const target = await targets.update(id, userId, updates);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Target not found' });
    }

    res.json({ success: true, data: target });
  } catch (error) {
    console.error('Update target error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/targets/:id
 * Delete a target
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    await targets.delete(id, userId);
    res.json({ success: true, message: 'Target deleted' });
  } catch (error) {
    console.error('Delete target error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/targets/:id/signals
 * Get signals for a specific target
 */
router.get('/:id/signals', async (req, res) => {
  try {
    const userId = getUserId(req);
    const data = await signals.getByUser(userId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
