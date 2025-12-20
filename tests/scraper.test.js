/**
 * Unit Tests for Scraper Module
 * Tests critical security and core functionality
 *
 * Run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateUrl, generateNoise } from '../server/lib/scraper.js';

// ============================================
// validateUrl - SSRF Protection Tests
// ============================================

describe('validateUrl - SSRF Protection', () => {
  // Valid URLs should pass
  describe('Valid URLs', () => {
    it('should accept valid HTTPS URL', () => {
      const result = validateUrl('https://example.com');
      assert.strictEqual(result, 'https://example.com/');
    });

    it('should accept valid HTTP URL', () => {
      const result = validateUrl('http://example.com/page');
      assert.strictEqual(result, 'http://example.com/page');
    });

    it('should accept URL with port', () => {
      const result = validateUrl('https://example.com:8080/api');
      assert.strictEqual(result, 'https://example.com:8080/api');
    });

    it('should accept URL with query params', () => {
      const result = validateUrl('https://example.com/search?q=test');
      assert.strictEqual(result, 'https://example.com/search?q=test');
    });
  });

  // Invalid URL formats
  describe('Invalid URL Formats', () => {
    it('should reject malformed URL', () => {
      assert.throws(() => validateUrl('not-a-url'), {
        message: 'Invalid URL format'
      });
    });

    it('should reject empty string', () => {
      assert.throws(() => validateUrl(''), {
        message: 'Invalid URL format'
      });
    });

    it('should reject FTP protocol', () => {
      assert.throws(() => validateUrl('ftp://files.example.com'), {
        message: 'Only HTTP/HTTPS protocols allowed'
      });
    });

    it('should reject file protocol', () => {
      assert.throws(() => validateUrl('file:///etc/passwd'), {
        message: 'Only HTTP/HTTPS protocols allowed'
      });
    });

    it('should reject javascript protocol', () => {
      assert.throws(() => validateUrl('javascript:alert(1)'), {
        message: 'Only HTTP/HTTPS protocols allowed'
      });
    });
  });

  // Localhost blocking
  describe('Localhost Blocking', () => {
    it('should block localhost', () => {
      assert.throws(() => validateUrl('http://localhost'), {
        message: 'Access to localhost is not allowed'
      });
    });

    it('should block localhost with port', () => {
      assert.throws(() => validateUrl('http://localhost:3000'), {
        message: 'Access to localhost is not allowed'
      });
    });

    it('should block 127.0.0.1', () => {
      assert.throws(() => validateUrl('http://127.0.0.1'), {
        message: 'Access to localhost is not allowed'
      });
    });

    it('should block 0.0.0.0', () => {
      assert.throws(() => validateUrl('http://0.0.0.0'), {
        message: 'Access to localhost is not allowed'
      });
    });

    it('should block IPv6 localhost', () => {
      assert.throws(() => validateUrl('http://[::1]'), {
        message: 'Access to localhost is not allowed'
      });
    });
  });

  // Private IP range blocking
  describe('Private IP Range Blocking', () => {
    it('should block 10.x.x.x range', () => {
      assert.throws(() => validateUrl('http://10.0.0.1'), {
        message: 'Access to private IP range (10.x.x.x) is not allowed'
      });
    });

    it('should block 10.255.255.255', () => {
      assert.throws(() => validateUrl('http://10.255.255.255'), {
        message: 'Access to private IP range (10.x.x.x) is not allowed'
      });
    });

    it('should block 172.16.x.x range', () => {
      assert.throws(() => validateUrl('http://172.16.0.1'), {
        message: 'Access to private IP range (172.16-31.x.x) is not allowed'
      });
    });

    it('should block 172.31.x.x range', () => {
      assert.throws(() => validateUrl('http://172.31.255.255'), {
        message: 'Access to private IP range (172.16-31.x.x) is not allowed'
      });
    });

    it('should block 192.168.x.x range', () => {
      assert.throws(() => validateUrl('http://192.168.1.1'), {
        message: 'Access to private IP range (192.168.x.x) is not allowed'
      });
    });

    it('should block 127.x.x.x loopback range', () => {
      assert.throws(() => validateUrl('http://127.0.0.2'), {
        message: 'Access to loopback IP is not allowed'
      });
    });
  });

  // Cloud metadata endpoint blocking
  describe('Cloud Metadata Blocking', () => {
    it('should block AWS metadata endpoint (169.254.169.254)', () => {
      assert.throws(() => validateUrl('http://169.254.169.254/latest/meta-data/'), {
        message: 'Access to link-local/metadata IP is not allowed'
      });
    });

    it('should block Google Cloud metadata', () => {
      assert.throws(() => validateUrl('http://metadata.google.internal'), {
        message: 'Access to cloud metadata endpoints is not allowed'
      });
    });

    it('should block GKE metadata', () => {
      assert.throws(() => validateUrl('http://metadata.gke.internal'), {
        message: 'Access to cloud metadata endpoints is not allowed'
      });
    });

    it('should block Kubernetes service', () => {
      assert.throws(() => validateUrl('http://kubernetes.default.svc'), {
        message: 'Access to cloud metadata endpoints is not allowed'
      });
    });
  });
});

// ============================================
// generateNoise - Output Format Tests
// ============================================

describe('generateNoise - Output Format', () => {
  it('should return a string', () => {
    const result = generateNoise();
    assert.strictEqual(typeof result, 'string');
  });

  it('should contain hex dump format (0x prefix)', () => {
    const result = generateNoise();
    assert.ok(result.includes('0x'), 'Should contain hex address prefix');
  });

  it('should have valid hex address format', () => {
    const result = generateNoise();
    // Match pattern like "0x1a2b3c:"
    const addressPattern = /0x[0-9a-f]{6}:/i;
    assert.ok(addressPattern.test(result), 'Should have valid hex address format');
  });

  it('should have hex byte values', () => {
    const result = generateNoise();
    // Match pattern like "0x123456: aa bb cc" (hex bytes)
    const bytePattern = /[0-9a-f]{2}\s[0-9a-f]{2}/i;
    assert.ok(bytePattern.test(result), 'Should contain hex byte values');
  });

  it('should produce different output on each call (randomness)', () => {
    const results = new Set();
    for (let i = 0; i < 10; i++) {
      results.add(generateNoise());
    }
    // Should have at least 5 unique outputs in 10 calls
    assert.ok(results.size >= 5, 'Should produce varied output');
  });

  it('should have 1-3 lines of output', () => {
    // Run multiple times to check line count range
    for (let i = 0; i < 20; i++) {
      const result = generateNoise();
      const lineCount = result.split('\n').length;
      assert.ok(lineCount >= 1 && lineCount <= 3, `Line count should be 1-3, got ${lineCount}`);
    }
  });
});

// ============================================
// Keyword Matching Logic Tests
// ============================================

describe('Keyword Matching Logic', () => {
  // Helper function to simulate keyword matching (same logic as in scraper)
  function matchKeywords(text, keywords) {
    return keywords.filter(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  it('should match exact keyword', () => {
    const text = 'This is a test message about AI technology';
    const matches = matchKeywords(text, ['AI']);
    assert.deepStrictEqual(matches, ['AI']);
  });

  it('should be case-insensitive', () => {
    const text = 'This is a test message about ai technology';
    const matches = matchKeywords(text, ['AI']);
    assert.deepStrictEqual(matches, ['AI']);
  });

  it('should match multiple keywords', () => {
    const text = 'Breaking news: AI and GPT are revolutionizing technology';
    const matches = matchKeywords(text, ['AI', 'GPT', 'robot']);
    assert.deepStrictEqual(matches, ['AI', 'GPT']);
  });

  it('should return empty array when no matches', () => {
    const text = 'This is a regular message';
    const matches = matchKeywords(text, ['AI', 'GPT']);
    assert.deepStrictEqual(matches, []);
  });

  it('should match partial words', () => {
    const text = 'The artificial intelligence is impressive';
    const matches = matchKeywords(text, ['artificial']);
    assert.deepStrictEqual(matches, ['artificial']);
  });

  it('should handle special characters in text', () => {
    const text = 'Breaking: AI-powered robot! Amazing!!!';
    const matches = matchKeywords(text, ['AI', 'robot']);
    assert.deepStrictEqual(matches, ['AI', 'robot']);
  });

  it('should handle empty keyword array', () => {
    const text = 'Some content here';
    const matches = matchKeywords(text, []);
    assert.deepStrictEqual(matches, []);
  });

  it('should handle empty text', () => {
    const text = '';
    const matches = matchKeywords(text, ['AI']);
    assert.deepStrictEqual(matches, []);
  });

  it('should handle Chinese keywords', () => {
    const text = '這是一則關於人工智慧的新聞';
    const matches = matchKeywords(text, ['人工智慧', '機器人']);
    assert.deepStrictEqual(matches, ['人工智慧']);
  });
});
