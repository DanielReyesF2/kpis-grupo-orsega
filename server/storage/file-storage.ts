/**
 * File Storage Module - Abstraction for file storage
 * Uses Cloudflare R2 if configured, otherwise falls back to local storage
 */

import * as fs from 'fs';
import * as path from 'path';
import { isR2Configured, uploadToR2 } from './r2';

export interface UploadResult {
  url: string;        // Public URL for the file
  key: string;        // Storage key/path
  storage: 'r2' | 'local';
}

/**
 * Upload a file to storage (R2 or local fallback)
 * @param fileBuffer - The file content as Buffer
 * @param folder - Target folder (e.g., "facturas", "comprobantes")
 * @param originalName - Original filename
 * @param mimeType - MIME type of the file
 * @returns Upload result with URL and storage type
 */
export async function uploadFile(
  fileBuffer: Buffer,
  folder: string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const timestamp = Date.now();
  const safeFilename = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${folder}/${year}/${month}/${timestamp}-${safeFilename}`;

  // Try R2 first if configured
  if (isR2Configured()) {
    try {
      console.log(`📤 [Storage] Uploading to R2: ${key}`);
      const url = await uploadToR2(key, fileBuffer, mimeType);
      console.log(`✅ [Storage] Uploaded to R2: ${url}`);
      return { url, key, storage: 'r2' };
    } catch (error) {
      console.error(`❌ [Storage] R2 upload failed, falling back to local:`, error);
      // Fall through to local storage
    }
  }

  // Local storage fallback
  console.log(`📁 [Storage] Using local storage: ${key}`);
  const localDir = path.join(process.cwd(), 'uploads', folder, year, month);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const localFileName = `${timestamp}-${safeFilename}`;
  const localPath = path.join(localDir, localFileName);
  fs.writeFileSync(localPath, fileBuffer);

  const localUrl = `/uploads/${folder}/${year}/${month}/${localFileName}`;
  console.log(`✅ [Storage] Saved locally: ${localUrl}`);

  return { url: localUrl, key, storage: 'local' };
}

/**
 * Upload a file from multer (supports both disk and memory storage)
 * @param file - Multer file object
 * @param folder - Target folder
 * @returns Upload result
 */
export async function uploadMulterFile(
  file: Express.Multer.File,
  folder: string
): Promise<UploadResult> {
  // Get buffer - either from memory storage or read from disk
  let buffer: Buffer;

  if (file.buffer) {
    // Memory storage - buffer is directly available
    buffer = file.buffer;
  } else if (file.path) {
    // Disk storage - read from temp file
    buffer = fs.readFileSync(file.path);
    // Clean up temp file after reading
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      console.warn(`⚠️ [Storage] Could not delete temp file: ${file.path}`);
    }
  } else {
    throw new Error('No file buffer or path available');
  }

  return uploadFile(buffer, folder, file.originalname, file.mimetype);
}

/**
 * Upload a file from a local path (for temp files)
 * @param localPath - Path to the local file
 * @param folder - Target folder in storage
 * @param originalName - Original filename
 * @param mimeType - MIME type
 * @returns Upload result
 */
export async function uploadFromPath(
  localPath: string,
  folder: string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const buffer = fs.readFileSync(localPath);
  return uploadFile(buffer, folder, originalName, mimeType);
}

/**
 * Save file temporarily (for invoice verification flow)
 * Uses local storage always (temp files are short-lived)
 * @param fileBuffer - The file content
 * @param folder - Base folder (will be under temp/)
 * @param originalName - Original filename
 * @returns Local file path
 */
export function saveTempFile(
  fileBuffer: Buffer,
  folder: string,
  originalName: string
): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const timestamp = Date.now();
  const safeFilename = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

  const tempDir = path.join(process.cwd(), 'uploads', folder, 'temp', year, month);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fileName = `${timestamp}-${safeFilename}`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, fileBuffer);

  console.log(`📁 [Storage] Temp file saved: ${filePath}`);
  return filePath;
}

/**
 * Move temp file to permanent storage
 * @param tempPath - Path to temp file
 * @param folder - Target folder
 * @param originalName - Original filename
 * @param mimeType - MIME type
 * @returns Upload result
 */
export async function moveTempToStorage(
  tempPath: string,
  folder: string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const result = await uploadFromPath(tempPath, folder, originalName, mimeType);

  // Clean up temp file
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log(`🗑️ [Storage] Temp file deleted: ${tempPath}`);
    }
  } catch (e) {
    console.warn(`⚠️ [Storage] Could not delete temp file: ${tempPath}`);
  }

  return result;
}

/**
 * Check if storage is using R2
 */
export function isUsingR2(): boolean {
  return isR2Configured();
}
