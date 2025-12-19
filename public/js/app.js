/**
 * The Last Sentinel - Main Application
 * Post-apocalyptic web monitoring terminal
 */

import { bootSequence } from './boot.js';
import { Terminal } from './terminal.js';
import { Typewriter } from './typewriter.js';
import { checkAuth, initAuthUI, showAuthScreen, getCurrentSentinel } from './auth.js';

// ============================================
// Security Utilities
// ============================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} unsafe - Untrusted string
 * @returns {string} - Safe HTML string
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely parse JSON with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} - Parsed object or fallback
 */
function safeJsonParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse error:', error, 'Raw data:', jsonString?.substring(0, 100));
    return fallback;
  }
}

/**
 * Safe localStorage wrapper
 */
const storage = {
  isAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  },
  getItem(key, fallback = null) {
    if (!this.isAvailable()) return fallback;
    try {
      return localStorage.getItem(key);
    } catch {
      return fallback;
    }
  },
  setItem(key, value) {
    if (!this.isAvailable()) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
};

// SSE reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// State
let eventSource = null;
let isMonitoring = false;
let targets = [];
let signalCount = 0;
let startTime = Date.now();
let currentSentinel = null;

// DOM Elements
const elements = {
  bootScreen: document.getElementById('boot-screen'),
  consoleOutput: document.getElementById('console-output'),
  targetForm: document.getElementById('target-form'),
  targetsList: document.getElementById('targets-list'),
  inputUrl: document.getElementById('input-url'),
  inputKeywords: document.getElementById('input-keywords'),
  inputName: document.getElementById('input-name'),
  btnStart: document.getElementById('btn-start'),
  btnScan: document.getElementById('btn-scan'),
  btnClear: document.getElementById('btn-clear'),
  btnHelp: document.getElementById('btn-help'),
  connectionStatus: document.getElementById('connection-status'),
  signalModal: document.getElementById('signal-modal'),
  signalContent: document.getElementById('signal-content'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  helpModal: document.getElementById('help-modal'),
  btnCloseHelp: document.getElementById('btn-close-help'),
  systemTime: document.getElementById('system-time'),
  signalCount: document.getElementById('signal-count'),
  targetCount: document.getElementById('target-count'),
  uptime: document.getElementById('uptime'),
  memUsage: document.getElementById('mem-usage'),
  radarStatus: document.getElementById('radar-status')
};

// Terminal instance
const terminal = new Terminal(elements.consoleOutput);

/**
 * Initialize the application
 */
async function init() {
  // Initialize auth UI first (but don't show yet)
  initAuthUI(onAuthSuccess);

  // Run boot sequence
  await bootSequence();

  // Hide boot screen
  elements.bootScreen.classList.add('hidden');

  // Check if already authenticated
  const sentinel = await checkAuth();

  if (sentinel) {
    // Already logged in, proceed to main app
    onAuthSuccess(sentinel);
  } else {
    // Show auth screen
    showAuthScreen();
  }
}

/**
 * Called when authentication is successful
 */
function onAuthSuccess(sentinel) {
  currentSentinel = sentinel;

  // Initialize terminal with welcome message
  terminal.print('SENTINEL OS v4.0.1 INITIALIZED', 'system');
  terminal.print(`Welcome, ${sentinel.callsign}. Identity verified.`, 'success');
  terminal.print('Awaiting frequency configuration...', 'info');
  terminal.print('', '');

  // Setup event listeners
  setupEventListeners();

  // Start system updates
  startSystemUpdates();

  // Load existing targets
  loadTargets();

  // Connect to SSE stream
  connectToStream();

  // 首次使用者顯示說明
  if (!storage.getItem('sentinel_tutorial_seen')) {
    setTimeout(() => {
      openHelpModal();
      storage.setItem('sentinel_tutorial_seen', '1');
    }, 1000);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Target form submission
  elements.targetForm.addEventListener('submit', handleAddTarget);

  // Control buttons
  elements.btnStart.addEventListener('click', toggleMonitoring);
  elements.btnScan.addEventListener('click', handleManualScan);
  elements.btnClear.addEventListener('click', () => terminal.clear());

  // Signal Modal
  elements.btnCloseModal.addEventListener('click', closeSignalModal);
  elements.signalModal.addEventListener('click', (e) => {
    if (e.target === elements.signalModal) closeSignalModal();
  });

  // Help Modal
  elements.btnHelp.addEventListener('click', openHelpModal);
  elements.btnCloseHelp.addEventListener('click', closeHelpModal);
  elements.helpModal.addEventListener('click', (e) => {
    if (e.target === elements.helpModal) closeHelpModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSignalModal();
      closeHelpModal();
    }
  });
}

/**
 * Connect to SSE stream
 */
function connectToStream() {
  if (eventSource) {
    eventSource.close();
  }

  terminal.print('[LINK] Establishing connection...', 'info');

  eventSource = new EventSource(`/api/stream/connect`);

  eventSource.addEventListener('connected', (e) => {
    const data = safeJsonParse(e.data);
    if (data) {
      reconnectAttempts = 0; // Reset on successful connection
      terminal.print(`[LINK] ${data.message}`, 'success');
      updateConnectionStatus('connected');
    }
  });

  eventSource.addEventListener('noise', (e) => {
    const data = safeJsonParse(e.data);
    if (data) {
      terminal.print(data.content, 'noise');
    }
  });

  eventSource.addEventListener('scan', (e) => {
    const data = safeJsonParse(e.data);
    if (data) {
      terminal.print(data.content, 'scan');
    }
  });

  eventSource.addEventListener('signal', (e) => {
    const signal = safeJsonParse(e.data);
    if (signal) {
      handleSignalIntercepted(signal);
    }
  });

  eventSource.addEventListener('status', (e) => {
    const data = safeJsonParse(e.data);
    if (data) {
      terminal.print(`[STATUS] ${data.message}`, 'info');
    }
  });

  eventSource.addEventListener('heartbeat', () => {
    // Silent heartbeat
  });

  eventSource.onerror = () => {
    terminal.print('[ERROR] Connection lost.', 'error');
    updateConnectionStatus('disconnected');

    // Exponential backoff for reconnection
    if (eventSource.readyState === EventSource.CLOSED) {
      reconnectAttempts++;

      if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        terminal.print('[ERROR] Max reconnection attempts reached. Please refresh.', 'error');
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
      terminal.print(`[INFO] Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'info');
      setTimeout(connectToStream, delay);
    }
  };
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(status) {
  const indicator = elements.connectionStatus.querySelector('span:first-child');
  const text = elements.connectionStatus.querySelector('span:last-child');

  switch (status) {
    case 'connected':
      indicator.className = 'w-2 h-2 rounded-full bg-threat-low';
      text.textContent = 'LINKED';
      break;
    case 'monitoring':
      indicator.className = 'w-2 h-2 rounded-full bg-threat-low animate-pulse';
      text.textContent = 'WATCHING';
      break;
    case 'disconnected':
      indicator.className = 'w-2 h-2 rounded-full bg-threat-critical';
      text.textContent = 'OFFLINE';
      break;
    default:
      indicator.className = 'w-2 h-2 rounded-full bg-threat-medium animate-pulse';
      text.textContent = 'STANDBY';
  }
}

/**
 * Load existing targets
 */
async function loadTargets() {
  try {
    const response = await fetch(`/api/targets`);
    const result = await response.json();

    if (result.success) {
      targets = result.data;
      renderTargetsList();
      elements.targetCount.textContent = targets.length;
    }
  } catch (error) {
    terminal.print(`[ERROR] Failed to load frequencies: ${error.message}`, 'error');
  }
}

/**
 * Handle adding a new target
 */
async function handleAddTarget(e) {
  e.preventDefault();

  const url = elements.inputUrl.value.trim();
  const keywords = elements.inputKeywords.value.split(',').map(k => k.trim()).filter(k => k);
  const name = elements.inputName.value.trim();

  if (!url || keywords.length === 0) {
    terminal.print('[ERROR] URL and at least one keyword required', 'error');
    return;
  }

  terminal.print(`[TUNING] Adding frequency: ${name || url}`, 'info');

  try {
    const response = await fetch(`/api/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, keywords, name })
    });

    const result = await response.json();

    if (result.success) {
      terminal.print(`[SUCCESS] Frequency locked: ${name || url}`, 'success');
      targets.push(result.data);
      renderTargetsList();
      elements.targetCount.textContent = targets.length;

      // Clear form
      elements.inputUrl.value = '';
      elements.inputKeywords.value = '';
      elements.inputName.value = '';
    } else {
      terminal.print(`[ERROR] ${result.error}`, 'error');
    }
  } catch (error) {
    terminal.print(`[ERROR] ${error.message}`, 'error');
  }
}

/**
 * Render targets list (XSS-safe)
 */
function renderTargetsList() {
  elements.targetsList.innerHTML = targets.map(target => {
    // Escape all user-controlled data to prevent XSS
    const safeName = escapeHtml(target.name || target.url);
    const safeId = escapeHtml(target.id);

    return `
    <div class="flex items-center justify-between py-1 border-b border-terminal-green-dim/30">
      <div class="truncate flex-1 mr-2">
        <span class="text-terminal-green">${target.is_active ? '●' : '○'}</span>
        ${safeName}
      </div>
      <button onclick="removeTarget('${safeId}')" class="text-threat-high hover:text-threat-critical">[X]</button>
    </div>
  `;
  }).join('');
}

/**
 * Remove a target (with confirmation)
 */
window.removeTarget = async function(id) {
  // Find target to show name in confirmation
  const target = targets.find(t => t.id === id);
  if (!target) return;

  // Confirmation dialog
  const targetName = target.name || target.url;
  if (!confirm(`確定要移除頻率「${targetName}」嗎？`)) {
    return;
  }

  try {
    const response = await fetch(`/api/targets/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      targets = targets.filter(t => t.id !== id);
      renderTargetsList();
      elements.targetCount.textContent = targets.length;
      terminal.print('[INFO] Frequency removed', 'info');
    }
  } catch (error) {
    terminal.print(`[ERROR] ${error.message}`, 'error');
  }
};

/**
 * Toggle monitoring mode
 */
async function toggleMonitoring() {
  if (isMonitoring) {
    // Stop monitoring
    await fetch(`/api/stream/stop`, { method: 'POST' });
    isMonitoring = false;
    elements.btnStart.textContent = '[INITIATE WATCH]';
    elements.radarStatus.textContent = 'STANDBY';
    elements.radarStatus.className = 'text-threat-medium';
    updateConnectionStatus('connected');
    terminal.print('[SYSTEM] Watch mode suspended', 'warning');
  } else {
    // Start monitoring
    if (targets.length === 0) {
      terminal.print('[ERROR] No frequencies configured', 'error');
      return;
    }

    await fetch(`/api/stream/start`, { method: 'POST' });
    isMonitoring = true;
    elements.btnStart.textContent = '[SUSPEND WATCH]';
    elements.radarStatus.textContent = 'ACTIVE';
    elements.radarStatus.className = 'text-threat-low';
    updateConnectionStatus('monitoring');
    terminal.print('[SYSTEM] Watch mode initiated - scanning frequencies...', 'success');
  }
}

/**
 * Handle manual scan
 */
async function handleManualScan() {
  if (targets.length === 0) {
    terminal.print('[ERROR] No frequencies to scan', 'error');
    return;
  }

  terminal.print('[MANUAL] Initiating immediate scan...', 'warning');

  try {
    await fetch(`/api/stream/scan`, { method: 'POST' });
  } catch (error) {
    terminal.print(`[ERROR] ${error.message}`, 'error');
  }
}

/**
 * Handle intercepted signal
 */
function handleSignalIntercepted(signal) {
  signalCount++;
  elements.signalCount.textContent = signalCount;

  // 柔和的邊框發光效果（取代刺眼的全螢幕閃爍）
  document.body.classList.add('intercept-flash');
  setTimeout(() => document.body.classList.remove('intercept-flash'), 800);

  // Terminal output
  terminal.print('', '');
  terminal.print('╔════════════════════════════════════════╗', 'alert');
  terminal.print('║     !!! SIGNAL INTERCEPTED !!!         ║', 'alert');
  terminal.print('╚════════════════════════════════════════╝', 'alert');
  terminal.print(`SOURCE: ${signal.data.targetName}`, 'alert');
  terminal.print(`KEYWORDS: ${signal.data.keywords.join(', ')}`, 'alert');

  if (signal.data.ai) {
    terminal.print(`THREAT LEVEL: ${signal.data.ai.threat_level}`, 'alert');
    terminal.print(`CATEGORY: ${signal.data.ai.category}`, 'alert');
    terminal.print(`SUMMARY: ${signal.data.ai.summary}`, 'alert');
  }

  terminal.print('', '');

  // Show modal
  showSignalModal(signal.data);

  // Play alert sound (if implemented)
  // playAlertSound();
}

/**
 * Show signal modal (XSS-safe)
 */
function showSignalModal(data) {
  // Validate and sanitize threat level for CSS class
  const validThreatLevels = ['low', 'medium', 'high', 'critical'];
  const threatLevel = (data.ai?.threat_level || 'medium').toLowerCase();
  const safeThreatLevel = validThreatLevels.includes(threatLevel) ? threatLevel : 'medium';
  const threatClass = `threat-${safeThreatLevel}`;

  // Escape all user-controlled data to prevent XSS
  const safeName = escapeHtml(data.targetName || '');
  const safeUrl = escapeHtml(data.url || '');
  const safeThreatLevelDisplay = escapeHtml(data.ai?.threat_level || 'UNKNOWN');
  const safeCategory = escapeHtml(data.ai?.category || 'UNKNOWN');
  const safeSummary = escapeHtml(data.ai?.summary || '');
  const safeContent = escapeHtml(data.content || '');
  const safeKeywords = (data.keywords || []).map(k => escapeHtml(k));

  elements.signalContent.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-terminal-green-dim text-xs mb-1">SOURCE:</div>
        <div class="text-lg">${safeName}</div>
        <div class="text-xs text-terminal-green-dim">${safeUrl}</div>
      </div>

      <div class="flex gap-4">
        <div>
          <div class="text-terminal-green-dim text-xs mb-1">THREAT LEVEL:</div>
          <div class="${threatClass} text-lg font-bold">${safeThreatLevelDisplay}</div>
        </div>
        <div>
          <div class="text-terminal-green-dim text-xs mb-1">CATEGORY:</div>
          <div>${safeCategory}</div>
        </div>
      </div>

      <div>
        <div class="text-terminal-green-dim text-xs mb-1">MATCHED KEYWORDS:</div>
        <div class="flex gap-2 flex-wrap">
          ${safeKeywords.map(k => `<span class="border border-terminal-green px-2 py-1">${k}</span>`).join('')}
        </div>
      </div>

      ${safeSummary ? `
        <div>
          <div class="text-terminal-green-dim text-xs mb-1">AI ANALYSIS:</div>
          <div class="border border-terminal-green-dim p-2 bg-crt-dark">${safeSummary}</div>
        </div>
      ` : ''}

      <div>
        <div class="text-terminal-green-dim text-xs mb-1">INTERCEPTED CONTENT:</div>
        <div class="border border-terminal-green-dim p-2 bg-crt-dark max-h-48 overflow-y-auto text-xs whitespace-pre-wrap">${safeContent}</div>
      </div>

      <div class="text-xs text-terminal-green-dim">
        TIMESTAMP: ${new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  `;

  elements.signalModal.classList.remove('hidden');
  elements.signalModal.classList.add('flex');
}

/**
 * Close signal modal
 */
function closeSignalModal() {
  elements.signalModal.classList.add('hidden');
  elements.signalModal.classList.remove('flex');
}

/**
 * Open help modal
 */
function openHelpModal() {
  elements.helpModal.classList.remove('hidden');
  elements.helpModal.classList.add('flex');
}

/**
 * Close help modal
 */
function closeHelpModal() {
  elements.helpModal.classList.add('hidden');
  elements.helpModal.classList.remove('flex');
}

/**
 * Start system updates (time, uptime, etc.)
 */
function startSystemUpdates() {
  setInterval(() => {
    // Update time
    elements.systemTime.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });

    // Update uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((uptime % 3600) / 60).toString().padStart(2, '0');
    const seconds = (uptime % 60).toString().padStart(2, '0');
    elements.uptime.textContent = `${hours}:${minutes}:${seconds}`;

    // Fake memory usage
    const mem = (Math.random() * 20 + 30).toFixed(1);
    elements.memUsage.textContent = `${mem}%`;
  }, 1000);
}

// Start the application
init();
