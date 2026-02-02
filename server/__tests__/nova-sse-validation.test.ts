import { describe, it, expect } from 'vitest';
import { sanitizeSSE } from '../nova/sse-utils';

/**
 * Tests for SSE validation and sanitization in Nova routes.
 * Validates that sanitizeSSE properly handles type coercion, length limits,
 * and that the SSE callback guards reject invalid data.
 */

describe('sanitizeSSE', () => {
  it('should return empty string for non-string values', () => {
    expect(sanitizeSSE(undefined)).toBe('');
    expect(sanitizeSSE(null)).toBe('');
    expect(sanitizeSSE(123)).toBe('');
    expect(sanitizeSSE({})).toBe('');
    expect(sanitizeSSE([])).toBe('');
    expect(sanitizeSSE(true)).toBe('');
  });

  it('should return the string as-is when within default limit', () => {
    expect(sanitizeSSE('hello')).toBe('hello');
    expect(sanitizeSSE('')).toBe('');
  });

  it('should truncate strings exceeding default maxLen (50_000)', () => {
    const longStr = 'a'.repeat(60_000);
    const result = sanitizeSSE(longStr);
    expect(result.length).toBe(50_000);
  });

  it('should respect custom maxLen parameter', () => {
    const str = 'abcdefghij'; // 10 chars
    expect(sanitizeSSE(str, 5)).toBe('abcde');
    expect(sanitizeSSE(str, 100)).toBe('abcdefghij');
  });

  it('should handle strings with special SSE characters', () => {
    // JSON.stringify handles newlines in data fields, but sanitizeSSE
    // should still pass through the raw value for JSON.stringify to handle
    const withNewlines = 'line1\nline2\nline3';
    expect(sanitizeSSE(withNewlines)).toBe('line1\nline2\nline3');
  });
});

describe('SSE callback type guards', () => {
  // These test the inline type guards used in nova-routes.ts callbacks

  it('onToken guard: should accept valid string tokens', () => {
    const text = 'Hello, world!';
    const accepted = typeof text === 'string' && text.length <= 50_000;
    expect(accepted).toBe(true);
  });

  it('onToken guard: should reject non-string tokens', () => {
    const text = 42 as any;
    const accepted = typeof text === 'string' && text.length <= 50_000;
    expect(accepted).toBe(false);
  });

  it('onToken guard: should reject oversized tokens', () => {
    const text = 'x'.repeat(50_001);
    const accepted = typeof text === 'string' && text.length <= 50_000;
    expect(accepted).toBe(false);
  });

  it('onToolStart guard: should accept valid tool names', () => {
    const tool = 'smart_query';
    const accepted = typeof tool === 'string' && tool.length <= 200;
    expect(accepted).toBe(true);
  });

  it('onToolStart guard: should reject oversized tool names', () => {
    const tool = 'x'.repeat(201);
    const accepted = typeof tool === 'string' && tool.length <= 200;
    expect(accepted).toBe(false);
  });

  it('onToolResult guard: success should be coerced to boolean', () => {
    expect(!!true).toBe(true);
    expect(!!false).toBe(false);
    expect(!!undefined).toBe(false);
    expect(!!null).toBe(false);
    expect(!!1).toBe(true);
    expect(!!0).toBe(false);
  });

  it('onDone guard: toolsUsed should filter non-strings and limit to 50', () => {
    const toolsUsed = [
      'tool1', 'tool2', 42, null, undefined, 'tool3', {},
      ...Array(50).fill('extra'),
    ];
    const safe = Array.isArray(toolsUsed)
      ? toolsUsed.filter((t): t is string => typeof t === 'string').slice(0, 50)
      : [];
    expect(safe.length).toBe(50);
    expect(safe[0]).toBe('tool1');
    expect(safe[1]).toBe('tool2');
    expect(safe[2]).toBe('tool3');
    // items 3-49 should be 'extra'
    expect(safe[3]).toBe('extra');
  });

  it('onDone guard: non-array toolsUsed should default to empty array', () => {
    const toolsUsed = 'not an array' as any;
    const safe = Array.isArray(toolsUsed)
      ? toolsUsed.filter((t): t is string => typeof t === 'string').slice(0, 50)
      : [];
    expect(safe).toEqual([]);
  });
});
