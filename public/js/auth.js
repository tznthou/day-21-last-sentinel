/**
 * Authentication Module
 * Handles sentinel identity verification
 */

// Current sentinel info
let currentSentinel = null;

/**
 * Check if user is already authenticated
 * @returns {Promise<object|null>}
 */
export async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      if (data.authenticated) {
        currentSentinel = data.sentinel;
        return data.sentinel;
      }
    }
    return null;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

/**
 * Login with callsign and passcode
 * @param {string} callsign
 * @param {string} passcode
 * @returns {Promise<{success: boolean, error?: string, sentinel?: object}>}
 */
export async function login(callsign, passcode) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callsign, passcode })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      currentSentinel = data.sentinel;
      return { success: true, sentinel: data.sentinel };
    }

    return { success: false, error: data.message || '登入失敗' };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: '連線失敗，請稍後再試' };
  }
}

/**
 * Register a new sentinel
 * @param {string} callsign
 * @param {string} passcode
 * @returns {Promise<{success: boolean, error?: string, sentinel?: object}>}
 */
export async function register(callsign, passcode) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callsign, passcode })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      currentSentinel = data.sentinel;
      return { success: true, sentinel: data.sentinel };
    }

    return { success: false, error: data.message || '註冊失敗' };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, error: '連線失敗，請稍後再試' };
  }
}

/**
 * Logout current sentinel
 * @returns {Promise<boolean>}
 */
export async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST'
    });
    currentSentinel = null;
    return response.ok;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}

/**
 * Get current sentinel info
 * @returns {object|null}
 */
export function getCurrentSentinel() {
  return currentSentinel;
}

/**
 * Initialize auth UI
 * @param {Function} onAuthSuccess - Callback when auth succeeds
 */
export function initAuthUI(onAuthSuccess) {
  const authScreen = document.getElementById('auth-screen');
  const authForm = document.getElementById('auth-form');
  const registerForm = document.getElementById('register-form');
  const authModeLabel = document.getElementById('auth-mode-label');

  // Login form elements
  const authCallsign = document.getElementById('auth-callsign');
  const authPasscode = document.getElementById('auth-passcode');
  const authError = document.getElementById('auth-error');
  const btnLogin = document.getElementById('btn-login');
  const btnRegister = document.getElementById('btn-register');

  // Register form elements
  const regCallsign = document.getElementById('reg-callsign');
  const regPasscode = document.getElementById('reg-passcode');
  const regPasscodeConfirm = document.getElementById('reg-passcode-confirm');
  const regError = document.getElementById('reg-error');
  const btnDoRegister = document.getElementById('btn-do-register');
  const btnBackLogin = document.getElementById('btn-back-login');

  // Show error message
  function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
  }

  function hideError(element) {
    element.classList.add('hidden');
  }

  // Switch to register form
  btnRegister.addEventListener('click', () => {
    authForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authModeLabel.textContent = '▸ 建立新的哨兵身份';
    hideError(authError);
    regCallsign.focus();
  });

  // Switch back to login form
  btnBackLogin.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    authForm.classList.remove('hidden');
    authModeLabel.textContent = '▸ 輸入哨兵代號與通行碼';
    hideError(regError);
    authCallsign.focus();
  });

  // Handle login
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(authError);

    const callsign = authCallsign.value.trim();
    const passcode = authPasscode.value;

    if (!callsign || !passcode) {
      showError(authError, '請輸入代號和通行碼');
      return;
    }

    btnLogin.textContent = '[VERIFYING...]';
    btnLogin.disabled = true;

    const result = await login(callsign, passcode);

    btnLogin.textContent = '[AUTHENTICATE]';
    btnLogin.disabled = false;

    if (result.success) {
      // Hide auth screen and proceed
      authScreen.style.transition = 'opacity 0.5s';
      authScreen.style.opacity = '0';
      setTimeout(() => {
        authScreen.style.display = 'none';
        onAuthSuccess(result.sentinel);
      }, 500);
    } else {
      showError(authError, result.error);
    }
  });

  // Handle register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(regError);

    const callsign = regCallsign.value.trim();
    const passcode = regPasscode.value;
    const passcodeConfirm = regPasscodeConfirm.value;

    // Validation
    if (!callsign || !passcode) {
      showError(regError, '請輸入代號和通行碼');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(callsign)) {
      showError(regError, '代號需為 3-20 字元，僅限英數字和底線');
      return;
    }

    if (passcode.length < 4) {
      showError(regError, '通行碼至少需要 4 個字元');
      return;
    }

    if (passcode !== passcodeConfirm) {
      showError(regError, '兩次輸入的通行碼不一致');
      return;
    }

    btnDoRegister.textContent = '[CREATING...]';
    btnDoRegister.disabled = true;

    const result = await register(callsign, passcode);

    btnDoRegister.textContent = '[CREATE IDENTITY]';
    btnDoRegister.disabled = false;

    if (result.success) {
      // Hide auth screen and proceed
      authScreen.style.transition = 'opacity 0.5s';
      authScreen.style.opacity = '0';
      setTimeout(() => {
        authScreen.style.display = 'none';
        onAuthSuccess(result.sentinel);
      }, 500);
    } else {
      showError(regError, result.error);
    }
  });

  // Auto-uppercase callsign inputs
  authCallsign.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  regCallsign.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

/**
 * Show auth screen
 */
export function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  authScreen.style.display = 'flex';
  authScreen.style.opacity = '1';
  document.getElementById('auth-callsign').focus();
}
