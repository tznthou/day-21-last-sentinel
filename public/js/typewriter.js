/**
 * Typewriter Effect Module
 * Creates typing animation for text
 */

export class Typewriter {
  constructor(element, options = {}) {
    this.element = element;
    this.speed = options.speed || 50;  // chars per second
    this.cursor = options.cursor || true;
    this.cursorChar = options.cursorChar || '█';
    this.queue = [];
    this.isTyping = false;
  }

  /**
   * Type text with animation
   * @param {string} text - Text to type
   * @returns {Promise}
   */
  async type(text) {
    return new Promise((resolve) => {
      this.queue.push({ text, resolve });
      if (!this.isTyping) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.isTyping = false;
      return;
    }

    this.isTyping = true;
    const { text, resolve } = this.queue.shift();

    for (let i = 0; i < text.length; i++) {
      this.element.textContent = text.substring(0, i + 1);
      if (this.cursor) {
        this.element.textContent += this.cursorChar;
      }
      await this.delay(1000 / this.speed);
    }

    // Remove cursor after typing
    if (this.cursor) {
      this.element.textContent = text;
    }

    resolve();
    this.processQueue();
  }

  /**
   * Delete text with animation
   * @param {number} count - Number of characters to delete
   * @returns {Promise}
   */
  async delete(count) {
    return new Promise(async (resolve) => {
      const currentText = this.element.textContent.replace(this.cursorChar, '');

      for (let i = 0; i < count && currentText.length - i > 0; i++) {
        const newText = currentText.substring(0, currentText.length - 1 - i);
        this.element.textContent = newText + (this.cursor ? this.cursorChar : '');
        await this.delay(1000 / (this.speed * 2)); // Delete faster
      }

      resolve();
    });
  }

  /**
   * Clear all text
   */
  clear() {
    this.element.textContent = this.cursor ? this.cursorChar : '';
  }

  /**
   * Pause for duration
   * @param {number} ms - Milliseconds to pause
   * @returns {Promise}
   */
  async pause(ms) {
    return this.delay(ms);
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Standalone typewriter function
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to type
 * @param {number} speed - Characters per second
 * @returns {Promise}
 */
export async function typeText(element, text, speed = 50) {
  element.textContent = '';

  for (let i = 0; i < text.length; i++) {
    element.textContent += text[i];
    await new Promise(resolve => setTimeout(resolve, 1000 / speed));
  }
}

/**
 * Type multiple lines
 * @param {HTMLElement} container - Container element
 * @param {string[]} lines - Array of lines to type
 * @param {Object} options - Options
 * @returns {Promise}
 */
export async function typeLines(container, lines, options = {}) {
  const {
    speed = 50,
    lineDelay = 100,
    className = ''
  } = options;

  for (const line of lines) {
    const lineElement = document.createElement('div');
    lineElement.className = className;
    container.appendChild(lineElement);

    await typeText(lineElement, line, speed);
    await new Promise(resolve => setTimeout(resolve, lineDelay));
  }
}
