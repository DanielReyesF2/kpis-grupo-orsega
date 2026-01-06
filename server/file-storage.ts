/**
 * Servicio de almacenamiento de archivos usando Cloudflare R2
 * 
 * R2 es compatible con la API de S3, por lo que usamos el SDK de AWS
 * pero apuntando a los endpoints de Cloudflare.
 * 
 * Configuración requerida en variables de entorno:
 * - R2_ACCOUNT_ID: ID de cuenta de Cloudflare
 * - R2_ACCESS_KEY_ID: Access Key del token de R2
 * - R2_SECRET_ACCESS_KEY: Secret Key del token de R2
 * - R2_BUCKET_NAME: Nombre del bucket (default: kpis-orsega-files)
 */

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

// Configuración del cliente R2
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'kpis-orsega-files';

// URL pública del bucket (si tienes dominio personalizado configurado)
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Verificar si R2 está configurado
export const isR2Configured = (): boolean => {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
};

// Cliente S3 configurado para R2
let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!s3Client) {
    if (!isR2Configured()) {
      throw new Error('Cloudflare R2 no está configurado. Verifica las variables de entorno.');
    }
    
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
    
    console.log('✅ Cliente Cloudflare R2 inicializado');
  }
  
  return s3Client;
};

// Tipos de archivos permitidos
export type FileCategory = 'facturas' | 'comprobantes' | 'receipts' | 'sales' | 'idrall' | 'temp';

interface UploadResult {
  success: boolean;
  key: string;
  url: string;
  publicUrl?: string;
  size: number;
  contentType: string;
}

/**
 * Genera una key única para el archivo en R2
 * Estructura: {categoria}/{año}/{mes}/{timestamp}-{nombre_archivo}
 */
const generateFileKey = (fileName: string, category: FileCategory): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.getTime();
  
  // Limpiar el nombre del archivo
  const cleanName = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Reemplazar caracteres especiales
    .toLowerCase();
  
  return `${category}/${year}/${month}/${timestamp}-${cleanName}`;
};

/**
 * Determina el Content-Type basado en la extensión del archivo
 */
const getContentType = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  const types: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.xml': 'application/xml',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
  };
  
  return types[ext] || 'application/octet-stream';
};

/**
 * Sube un archivo a Cloudflare R2
 */
export const uploadFile = async (
  fileBuffer: Buffer,
  fileName: string,
  category: FileCategory,
  metadata?: Record<string, string>
): Promise<UploadResult> => {
  const client = getS3Client();
  const key = generateFileKey(fileName, category);
  const contentType = getContentType(fileName);
  
  console.log(`📤 [R2] Subiendo archivo: ${fileName} → ${key}`);
  
  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: metadata,
    }));
    
    // Generar URL firmada para acceso (válida por 7 días)
    const signedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }),
      { expiresIn: 7 * 24 * 60 * 60 } // 7 días
    );
    
    // URL pública si está configurada
    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : undefined;
    
    console.log(`✅ [R2] Archivo subido exitosamente: ${key}`);
    
    return {
      success: true,
      key,
      url: signedUrl,
      publicUrl,
      size: fileBuffer.length,
      contentType,
    };
  } catch (error) {
    console.error(`❌ [R2] Error subiendo archivo:`, error);
    throw error;
  }
};

/**
 * Sube un archivo desde el sistema de archivos local
 */
export const uploadFileFromPath = async (
  filePath: string,
  category: FileCategory,
  metadata?: Record<string, string>
): Promise<UploadResult> => {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  
  return uploadFile(fileBuffer, fileName, category, metadata);
};

/**
 * Obtiene una URL firmada para descargar un archivo
 * La URL es válida por el tiempo especificado (default: 1 hora)
 */
export const getDownloadUrl = async (
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> => {
  const client = getS3Client();
  
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
  
  return signedUrl;
};

/**
 * Obtiene una URL firmada para visualizar un archivo (inline)
 */
export const getViewUrl = async (
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> => {
  const client = getS3Client();
  
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: 'inline',
    }),
    { expiresIn: expiresInSeconds }
  );
  
  return signedUrl;
};

/**
 * Elimina un archivo de R2
 */
export const deleteFile = async (key: string): Promise<boolean> => {
  const client = getS3Client();
  
  console.log(`🗑️ [R2] Eliminando archivo: ${key}`);
  
  try {
    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    
    console.log(`✅ [R2] Archivo eliminado: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ [R2] Error eliminando archivo:`, error);
    return false;
  }
};

/**
 * Verifica si un archivo existe en R2
 */
export const fileExists = async (key: string): Promise<boolean> => {
  const client = getS3Client();
  
  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
};

/**
 * Lista archivos en una carpeta específica
 */
export const listFiles = async (
  prefix: string,
  maxKeys: number = 100
): Promise<Array<{ key: string; size: number; lastModified: Date }>> => {
  const client = getS3Client();
  
  try {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys,
    }));
    
    return (response.Contents || []).map(obj => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
  } catch (error) {
    console.error(`❌ [R2] Error listando archivos:`, error);
    return [];
  }
};

/**
 * Descarga un archivo de R2 como Buffer
 */
export const downloadFile = async (key: string): Promise<Buffer | null> => {
  const client = getS3Client();
  
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    
    if (response.Body) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [R2] Error descargando archivo:`, error);
    return null;
  }
};

// ============================================
// MIGRACIÓN: Funciones para migrar archivos existentes
// ============================================

/**
 * Migra un archivo local a R2
 * Útil para migrar archivos existentes de /uploads
 */
export const migrateLocalFile = async (
  localPath: string,
  category: FileCategory
): Promise<UploadResult | null> => {
  const fullPath = path.join(process.cwd(), localPath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ [Migración] Archivo no existe: ${fullPath}`);
    return null;
  }
  
  try {
    const result = await uploadFileFromPath(fullPath, category);
    console.log(`✅ [Migración] Archivo migrado: ${localPath} → ${result.key}`);
    return result;
  } catch (error) {
    console.error(`❌ [Migración] Error migrando archivo:`, error);
    return null;
  }
};

/**
 * Función de fallback: Si R2 no está configurado, usa almacenamiento local
 * Esto permite que la app funcione sin R2 configurado (desarrollo)
 */
export const uploadFileWithFallback = async (
  fileBuffer: Buffer,
  fileName: string,
  category: FileCategory,
  localDir?: string
): Promise<{ url: string; key: string; isLocal: boolean }> => {
  // Si R2 está configurado, usarlo
  if (isR2Configured()) {
    const result = await uploadFile(fileBuffer, fileName, category);
    return {
      url: result.url,
      key: result.key,
      isLocal: false,
    };
  }
  
  // Fallback a almacenamiento local
  console.log(`⚠️ [Storage] R2 no configurado, usando almacenamiento local`);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uploadDir = localDir || path.join(process.cwd(), 'uploads', category, String(year), month);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const timestamp = now.getTime();
  const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const finalFileName = `${timestamp}-${cleanName}`;
  const filePath = path.join(uploadDir, finalFileName);
  
  fs.writeFileSync(filePath, fileBuffer);
  
  const localUrl = `/uploads/${category}/${year}/${month}/${finalFileName}`;
  
  return {
    url: localUrl,
    key: localUrl,
    isLocal: true,
  };
};

// Exportar información de configuración
export const getStorageInfo = () => ({
  provider: isR2Configured() ? 'cloudflare-r2' : 'local',
  bucket: isR2Configured() ? R2_BUCKET_NAME : 'local-uploads',
  configured: isR2Configured(),
});

console.log(`📦 Storage service loaded - Provider: ${isR2Configured() ? 'Cloudflare R2' : 'Local (fallback)'}`);
