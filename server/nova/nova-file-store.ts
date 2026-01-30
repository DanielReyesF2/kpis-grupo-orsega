/**
 * Temporary in-memory file store for Nova chat uploads.
 *
 * When a user drags an Excel (or other file) into the Nova chat,
 * the raw buffer is stored here keyed by a unique ID. The Nova agent
 * can then reference this ID when calling MCP tools like
 * `process_sales_excel` to actually process the file.
 *
 * Entries auto-expire after 15 minutes.
 */

import crypto from 'crypto';

interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
  size: number;
  userId: string;
  timestamp: number;
}

const fileStore = new Map<string, StoredFile>();
const TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FILES = 200;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Store a file buffer and return a unique ID.
 */
export function storeFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  userId: string
): string {
  // Reject files exceeding size limit
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Archivo excede el limite de ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Evict expired entries first
  evictExpired();

  // Cap total entries
  if (fileStore.size >= MAX_FILES) {
    const oldest = [...fileStore.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 10 && i < oldest.length; i++) {
      fileStore.delete(oldest[i][0]);
    }
  }

  const id = crypto.randomUUID();
  fileStore.set(id, {
    buffer,
    originalName,
    mimetype,
    size: buffer.length,
    userId,
    timestamp: Date.now(),
  });

  return id;
}

/**
 * Retrieve a stored file by ID. Returns null if not found or expired.
 * Validates userId ownership.
 */
export function getFile(id: string, userId: string): StoredFile | null {
  const entry = fileStore.get(id);
  if (!entry) return null;

  // Check expiry
  if (Date.now() - entry.timestamp > TTL_MS) {
    fileStore.delete(id);
    return null;
  }

  // Validate ownership
  if (entry.userId !== userId) return null;

  return entry;
}

/**
 * Remove a file after processing.
 */
export function removeFile(id: string): void {
  fileStore.delete(id);
}

function evictExpired(): void {
  const now = Date.now();
  for (const [id, entry] of fileStore) {
    if (now - entry.timestamp > TTL_MS) {
      fileStore.delete(id);
    }
  }
}

// Cleanup timer (every 5 minutes)
const cleanupTimer = setInterval(evictExpired, 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();
