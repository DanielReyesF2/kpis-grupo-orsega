/**
 * SSE utility functions for Nova routes.
 * Extracted to a standalone module to avoid transitive DB imports in tests.
 */

/** Sanitize a string field for SSE output — limit length */
export function sanitizeSSE(value: unknown, maxLen = 50_000): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLen);
}
