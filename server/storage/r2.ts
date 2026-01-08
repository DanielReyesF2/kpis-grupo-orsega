import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "kpis-orsega-files";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Optional: Custom domain or R2.dev URL

// S3 Client configured for Cloudflare R2
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.");
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Check if R2 is configured and available
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

/**
 * Upload a file to R2
 * @param key - The file path/key in R2 (e.g., "facturas/2025/01/invoice.pdf")
 * @param body - The file content (Buffer or Readable stream)
 * @param contentType - MIME type of the file
 * @returns The public URL of the uploaded file
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Readable,
  contentType: string
): Promise<string> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);

  // Return public URL
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }

  // Default R2.dev URL format
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
}

/**
 * Upload a file from multer to R2
 * @param file - Multer file object
 * @param folder - Target folder in R2 (e.g., "facturas" or "comprobantes")
 * @returns Object with key and public URL
 */
export async function uploadMulterFileToR2(
  file: Express.Multer.File,
  folder: string
): Promise<{ key: string; url: string }> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  // Generate unique filename
  const timestamp = Date.now();
  const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${folder}/${year}/${month}/${timestamp}-${safeFilename}`;

  const url = await uploadToR2(key, file.buffer, file.mimetype);

  console.log(`📤 [R2] Uploaded: ${key} -> ${url}`);

  return { key, url };
}

/**
 * Get a file from R2
 * @param key - The file path/key in R2
 * @returns The file content as a Buffer
 */
export async function getFromR2(key: string): Promise<Buffer> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`File not found: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as Readable) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * Check if a file exists in R2
 * @param key - The file path/key in R2
 * @returns true if file exists, false otherwise
 */
export async function existsInR2(key: string): Promise<boolean> {
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a file from R2
 * @param key - The file path/key in R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
  console.log(`🗑️ [R2] Deleted: ${key}`);
}

/**
 * Extract the key from an R2 URL
 * @param url - The full R2 URL
 * @returns The key (path) portion of the URL
 */
export function extractKeyFromR2Url(url: string): string | null {
  if (!url) return null;

  // Handle custom domain URLs
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
    return url.replace(`${R2_PUBLIC_URL}/`, "");
  }

  // Handle R2.dev URLs
  const r2DevPattern = /https:\/\/[^/]+\.r2\.dev\/(.+)/;
  const match = url.match(r2DevPattern);
  if (match) {
    return match[1];
  }

  // Handle direct R2 storage URLs
  const storagePattern = /https:\/\/[^/]+\.r2\.cloudflarestorage\.com\/[^/]+\/(.+)/;
  const storageMatch = url.match(storagePattern);
  if (storageMatch) {
    return storageMatch[1];
  }

  return null;
}

export { R2_BUCKET_NAME };
