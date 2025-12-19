/**
 * Terminal Module
 * Handles console-like output with styling
 */

export class Terminal {
  constructor(container) {
    this.container = container;
    this.maxLines = 500;
    this.lineCount = 0;
  }

  /**
   * Print a line to the terminal
   * @param {string} text - Text to print
   * @param {string} type - Message type for styling
   */
  print(text, type = 'default') {
    const line = document.createElement('div');
    line.className = this.getLineClass(type);

    // Add timestamp for certain types
    if (['info', 'error', 'success', 'warning', 'alert'].includes(type)) {
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      line.innerHTML = `<span class="text-terminal-green-dim">[${timestamp}]</span> ${this.escapeHtml(text)}`;
    } else {
      line.textContent = text;
    }

    this.container.appendChild(line);
    this.lineCount++;

    // Auto-scroll
    this.container.scrollTop = this.container.scrollHeight;

    // Limit lines
    this.trimLines();

    return line;
  }

  /**
   * Print with typewriter effect
   * @param {string} text - Text to print
   * @param {string} type - Message type
   * @param {number} speed - Characters per second
   */
  async printTypewriter(text, type = 'default', speed = 50) {
    const line = document.createElement('div');
    line.className = this.getLineClass(type);
    this.container.appendChild(line);

    for (let i = 0; i < text.length; i++) {
      line.textContent += text[i];
      this.container.scrollTop = this.container.scrollHeight;
      await this.delay(1000 / speed);
    }

    this.lineCount++;
    this.trimLines();

    return line;
  }

  /**
   * Clear the terminal
   */
  clear() {
    this.container.innerHTML = '';
    this.lineCount = 0;
    this.print('[SYSTEM] Console cleared', 'info');
  }

  /**
   * Get CSS class for line type
   */
  getLineClass(type) {
    const baseClass = 'terminal-line py-0.5';

    switch (type) {
      case 'system':
        return `${baseClass} text-terminal-green font-bold`;
      case 'info':
        return `${baseClass} text-terminal-green-dim`;
      case 'success':
        return `${baseClass} text-threat-low`;
      case 'warning':
        return `${baseClass} text-threat-medium`;
      case 'error':
        return `${baseClass} text-threat-high`;
      case 'alert':
        return `${baseClass} text-threat-critical font-bold animate-pulse`;
      case 'noise':
        return `${baseClass} text-terminal-green-dim opacity-50 font-mono`;
      case 'scan':
        return `${baseClass} text-terminal-green-dim`;
      default:
        return `${baseClass} text-terminal-green`;
    }
  }

  /**
   * Trim old lines if exceeding max
   */
  trimLines() {
    while (this.lineCount > this.maxLines) {
      const firstChild = this.container.firstChild;
      if (firstChild) {
        this.container.removeChild(firstChild);
        this.lineCount--;
      } else {
        break;
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print ASCII art
   */
  printAscii(art, type = 'default') {
    const lines = art.split('\n');
    lines.forEach(line => this.print(line, type));
  }

  /**
   * Print a separator line
   */
  printSeparator(char = '-', length = 50) {
    this.print(char.repeat(length), 'info');
  }

  /**
   * Print a box around text
   */
  printBox(text, type = 'default') {
    const width = text.length + 4;
    const border = '+' + '-'.repeat(width - 2) + '+';

    this.print(border, type);
    this.print(`| ${text} |`, type);
    this.print(border, type);
  }
}
