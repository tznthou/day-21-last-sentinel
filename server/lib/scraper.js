/**
 * Web Scraper Module
 * Fetches and extracts content from target URLs
 */

import { load } from 'cheerio';
import crypto from 'crypto';

// Configuration
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_CONTENT_LENGTH = parseInt(process.env.MAX_CONTENT_LENGTH) || 500000;
const SCRAPE_TIMEOUT = parseInt(process.env.SCRAPE_TIMEOUT) || 15000; // 15 seconds

// Text extraction limits
const MAX_TEXT_LENGTH = 50000;       // Max characters to extract from page
const CONTEXT_RADIUS = 200;          // Characters around keyword in excerpts
const MAX_OCCURRENCES = 3;           // Max keyword occurrences to extract
const MAX_EXCERPT_LENGTH = 3000;     // Max total excerpt length

/**
 * Validate URL to prevent SSRF attacks
 * @param {string} urlString - The URL to validate
 * @returns {string} - The validated URL
 * @throws {Error} - If URL is invalid or points to internal resources
 */
export function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP/HTTPS protocols allowed');
  }

  const hostname = url.hostname.toLowerCase();

  // Block localhost variants
  const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
  if (localhostPatterns.includes(hostname)) {
    throw new Error('Access to localhost is not allowed');
  }

  // Block internal IP ranges
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipRegex);
  if (match) {
    const [, a, b] = match.map(Number);
    // 10.x.x.x (Private)
    if (a === 10) {
      throw new Error('Access to private IP range (10.x.x.x) is not allowed');
    }
    // 172.16-31.x.x (Private)
    if (a === 172 && b >= 16 && b <= 31) {
      throw new Error('Access to private IP range (172.16-31.x.x) is not allowed');
    }
    // 192.168.x.x (Private)
    if (a === 192 && b === 168) {
      throw new Error('Access to private IP range (192.168.x.x) is not allowed');
    }
    // 169.254.x.x (Link-local / Cloud metadata)
    if (a === 169 && b === 254) {
      throw new Error('Access to link-local/metadata IP is not allowed');
    }
    // 127.x.x.x (Loopback)
    if (a === 127) {
      throw new Error('Access to loopback IP is not allowed');
    }
  }

  // Block common cloud metadata endpoints
  const blockedHosts = [
    'metadata.google.internal',
    'metadata.gke.internal',
    'kubernetes.default.svc'
  ];
  if (blockedHosts.includes(hostname)) {
    throw new Error('Access to cloud metadata endpoints is not allowed');
  }

  return url.href;
}

/**
 * Build headers for specific sites (handles anti-scraping)
 * @param {string} url - Target URL
 * @returns {object} - Headers object
 */
function getHeaders(url) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  // PTT 需要 over18 cookie 繞過年齡驗證
  if (url.includes('ptt.cc')) {
    headers['Cookie'] = 'over18=1';
  }

  return headers;
}

/**
 * Fetch and parse a webpage
 * @param {string} url - Target URL
 * @returns {Promise<{text: string, hash: string}>}
 */
export async function scrape(url) {
  // Validate URL to prevent SSRF attacks
  const validatedUrl = validateUrl(url);

  try {
    const response = await fetch(validatedUrl, {
      headers: getHeaders(validatedUrl),
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_LENGTH) {
      throw new Error('Content too large');
    }

    const html = await response.text();

    // Parse HTML and extract text
    const $ = load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar').remove();

    // Extract text from body
    const text = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, MAX_TEXT_LENGTH);

    // Generate hash for change detection using SHA-256 (more secure than MD5)
    const hash = crypto.createHash('sha256').update(text).digest('hex');

    return { text, hash };
  } catch (error) {
    console.error(`Scrape error for ${validatedUrl}:`, error.message);
    throw error;
  }
}

/**
 * Check if content has changed and contains keywords
 * @param {string} url - Target URL
 * @param {string[]} keywords - Keywords to search for
 * @param {string} lastHash - Previous content hash
 * @returns {Promise<{changed: boolean, matches: string[], content: string, hash: string}>}
 */
export async function checkForSignal(url, keywords, lastHash) {
  const { text, hash } = await scrape(url);

  // Check if content changed
  const changed = hash !== lastHash;

  if (!changed) {
    return { changed: false, matches: [], content: '', hash };
  }

  // Search for keywords (case-insensitive)
  const matches = keywords.filter(keyword =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );

  if (matches.length === 0) {
    return { changed: true, matches: [], content: '', hash };
  }

  // Extract relevant content around keywords
  const relevantContent = extractRelevantContent(text, matches);

  return {
    changed: true,
    matches,
    content: relevantContent,
    hash
  };
}

/**
 * Extract content around matched keywords
 * @param {string} text - Full text content
 * @param {string[]} keywords - Matched keywords
 * @returns {string} - Relevant content excerpt
 */
function extractRelevantContent(text, keywords) {
  const excerpts = [];
  const contextRadius = CONTEXT_RADIUS;

  for (const keyword of keywords) {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    let index = 0;

    // Find up to 3 occurrences per keyword
    let occurrences = 0;
    while ((index = lowerText.indexOf(lowerKeyword, index)) !== -1 && occurrences < MAX_OCCURRENCES) {
      const start = Math.max(0, index - contextRadius);
      const end = Math.min(text.length, index + keyword.length + contextRadius);

      let excerpt = text.substring(start, end).trim();

      // Add ellipsis if truncated
      if (start > 0) excerpt = '...' + excerpt;
      if (end < text.length) excerpt = excerpt + '...';

      excerpts.push(excerpt);
      index += keyword.length;
      occurrences++;
    }
  }

  // Join excerpts and limit total length
  return excerpts.join('\n\n---\n\n').substring(0, MAX_EXCERPT_LENGTH);
}

/**
 * Generate fake noise data (hex dump style)
 * @returns {string}
 */
export function generateNoise() {
  const lines = [];
  const lineCount = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < lineCount; i++) {
    const bytes = [];
    for (let j = 0; j < 16; j++) {
      bytes.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
    }
    const address = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    lines.push(`0x${address}: ${bytes.join(' ')}`);
  }

  return lines.join('\n');
}
