/**
 * Signal Engine
 * Manages the monitoring loop and signal detection
 */

import { checkForSignal, generateNoise } from './scraper.js';
import { targets, signals, ai } from './insforge.js';

// Active monitoring sessions
const activeSessions = new Map();

// Concurrency control
const MAX_CONCURRENT_SCRAPES = 3;
let activeScrapes = 0;

/**
 * Start monitoring for a user
 * @param {string} userId - User ID
 * @param {function} onSignal - Callback for new signals
 * @param {function} onNoise - Callback for noise updates
 * @returns {Promise<string>} - Session ID
 */
export async function startMonitoring(userId, onSignal, onNoise) {
  // Stop any existing session and wait for cleanup
  await stopMonitoring(userId);

  // Prevent race condition: double-check after await
  if (activeSessions.has(userId)) {
    console.warn(`[SIGNAL] Session already exists for user: ${userId}`);
    return activeSessions.get(userId).id;
  }

  const sessionId = `session_${Date.now()}`;

  const session = {
    id: sessionId,
    userId,
    interval: null,
    isRunning: true
  };

  // Start the monitoring loop
  session.interval = setInterval(async () => {
    if (!session.isRunning) return;

    try {
      // Get active targets for user
      const userTargets = await targets.getActiveByUser(userId);

      if (userTargets.length === 0) {
        // No targets, just send noise
        onNoise(generateNoise());
        return;
      }

      // Check each target
      for (const target of userTargets) {
        try {
          const result = await checkForSignal(
            target.url,
            target.keywords,
            target.last_hash
          );

          // Update last check
          await targets.updateLastCheck(target.id, result.hash);

          if (result.matches.length > 0) {
            // Signal detected!
            let aiAnalysis = null;

            // Run AI analysis if content is available
            if (result.content) {
              aiAnalysis = await ai.analyzeSignal(result.content, result.matches);
            }

            // Save signal to database
            const signal = await signals.create({
              target_id: target.id,
              user_id: userId,
              content: result.content,
              matched_keywords: result.matches,
              ai_summary: aiAnalysis?.summary || null,
              ai_threat_level: aiAnalysis?.threat_level || 'UNKNOWN',
              ai_category: aiAnalysis?.category || 'UNKNOWN',
              source_url: target.url
            });

            // Notify client
            onSignal({
              type: 'SIGNAL_INTERCEPTED',
              data: {
                id: signal.id,
                targetName: target.name || target.url,
                url: target.url,
                keywords: result.matches,
                content: result.content,
                ai: aiAnalysis,
                timestamp: new Date().toISOString()
              }
            });
          } else if (result.changed) {
            // Content changed but no keyword match
            onNoise(`[SCAN] ${target.name || target.url} - Content updated, no signal`);
          } else {
            // No change
            onNoise(`[SCAN] ${target.name || target.url} - No change detected`);
          }
        } catch (error) {
          onNoise(`[ERROR] ${target.name || target.url} - ${error.message}`);
        }

        // Small delay between targets
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Send periodic noise
      onNoise(generateNoise());

    } catch (error) {
      console.error('Monitoring error:', error);
      onNoise(`[SYSTEM ERROR] ${error.message}`);
    }
  }, parseInt(process.env.SCRAPE_INTERVAL) || 60000);

  activeSessions.set(userId, session);

  return sessionId;
}

/**
 * Stop monitoring for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function stopMonitoring(userId) {
  const session = activeSessions.get(userId);
  if (session) {
    session.isRunning = false;

    // Clear the interval safely
    if (session.interval) {
      try {
        clearInterval(session.interval);
        session.interval = null;
      } catch (error) {
        console.error('[SIGNAL] Error clearing interval:', error);
      }
    }

    activeSessions.delete(userId);

    // Give time for any running iteration to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`[SIGNAL] Stopped monitoring for user: ${userId}`);
  }
}

/**
 * Get monitoring status
 * @param {string} userId - User ID
 * @returns {object} - Status info
 */
export function getStatus(userId) {
  const session = activeSessions.get(userId);
  return {
    isActive: !!session,
    sessionId: session?.id || null
  };
}

/**
 * Force scan all targets immediately
 * @param {string} userId - User ID
 * @param {function} onSignal - Callback for signals
 * @param {function} onNoise - Callback for noise
 */
export async function forceScan(userId, onSignal, onNoise) {
  onNoise('[MANUAL SCAN INITIATED]');

  try {
    const userTargets = await targets.getActiveByUser(userId);

    for (const target of userTargets) {
      onNoise(`[SCANNING] ${target.name || target.url}`);

      try {
        const result = await checkForSignal(
          target.url,
          target.keywords,
          null // Ignore previous hash for force scan
        );

        await targets.updateLastCheck(target.id, result.hash);

        if (result.matches.length > 0) {
          const aiAnalysis = await ai.analyzeSignal(result.content, result.matches);

          const signal = await signals.create({
            target_id: target.id,
            user_id: userId,
            content: result.content,
            matched_keywords: result.matches,
            ai_summary: aiAnalysis?.summary || null,
            ai_threat_level: aiAnalysis?.threat_level || 'UNKNOWN',
            ai_category: aiAnalysis?.category || 'UNKNOWN',
            source_url: target.url
          });

          onSignal({
            type: 'SIGNAL_INTERCEPTED',
            data: {
              id: signal.id,
              targetName: target.name || target.url,
              url: target.url,
              keywords: result.matches,
              content: result.content,
              ai: aiAnalysis,
              timestamp: new Date().toISOString()
            }
          });
        } else {
          onNoise(`[COMPLETE] ${target.name || target.url} - No signal`);
        }
      } catch (error) {
        onNoise(`[ERROR] ${target.name || target.url} - ${error.message}`);
      }
    }

    onNoise('[MANUAL SCAN COMPLETE]');
  } catch (error) {
    onNoise(`[SCAN FAILED] ${error.message}`);
  }
}
