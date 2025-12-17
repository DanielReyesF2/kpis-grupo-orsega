/**
 * ✅ SECURITY FIX: Validación de MIME type real
 *
 * Este módulo valida el tipo MIME real de archivos subidos
 * usando magic bytes en lugar de confiar en el Content-Type del cliente.
 *
 * Esto previene ataques donde el atacante envía un archivo malicioso
 * (ej. ejecutable) con un Content-Type falso (ej. image/png).
 */

import FileType from 'file-type';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

// Tipos MIME permitidos por categoría
export const ALLOWED_MIME_TYPES = {
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
  ],
  spreadsheets: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
  all: [] as string[], // Se llena dinámicamente
};

// Llenar 'all' con todos los tipos permitidos
ALLOWED_MIME_TYPES.all = [
  ...new Set([
    ...ALLOWED_MIME_TYPES.images,
    ...ALLOWED_MIME_TYPES.documents,
  ])
];

// Extensiones peligrosas que NUNCA deben permitirse
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.js', '.vbs', '.wsf', '.wsh', '.ps1', '.psm1',
  '.sh', '.bash', '.zsh', '.csh',
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.asp', '.aspx', '.jsp', '.jspx',
  '.dll', '.so', '.dylib',
  '.app', '.deb', '.rpm',
];

export interface MimeValidationResult {
  isValid: boolean;
  detectedMime?: string;
  declaredMime?: string;
  error?: string;
}

/**
 * Valida el MIME type real de un archivo usando magic bytes
 *
 * @param buffer - Buffer del archivo
 * @param declaredMime - MIME type declarado por el cliente
 * @param filename - Nombre del archivo
 * @param allowedTypes - Tipos MIME permitidos (default: todos)
 */
export async function validateMimeType(
  buffer: Buffer,
  declaredMime: string,
  filename: string,
  allowedTypes: string[] = ALLOWED_MIME_TYPES.all
): Promise<MimeValidationResult> {
  // 1. Verificar extensión peligrosa
  const ext = path.extname(filename).toLowerCase();
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      declaredMime,
      error: `Extensión de archivo no permitida: ${ext}`,
    };
  }

  // 2. Detectar MIME real usando magic bytes
  let detectedType;
  try {
    detectedType = await FileType.fromBuffer(buffer);
  } catch (error) {
    console.warn('⚠️ Error detectando MIME type:', error);
  }

  // 3. Casos especiales: archivos de texto (CSV, TXT) no tienen magic bytes
  const textExtensions = ['.csv', '.txt'];
  if (!detectedType && textExtensions.includes(ext)) {
    // Verificar que el contenido parece ser texto válido
    const isValidText = isTextContent(buffer);
    if (isValidText) {
      return {
        isValid: allowedTypes.includes(declaredMime) ||
                 allowedTypes.includes('text/csv') ||
                 allowedTypes.includes('text/plain'),
        detectedMime: ext === '.csv' ? 'text/csv' : 'text/plain',
        declaredMime,
      };
    }
  }

  // 4. Si no se detectó tipo y no es texto, usar el declarado con precaución
  if (!detectedType) {
    // Para archivos sin magic bytes reconocibles, verificar extensión
    const safeExtensions = ['.csv', '.txt', '.json', '.xml'];
    if (safeExtensions.includes(ext)) {
      return {
        isValid: allowedTypes.includes(declaredMime),
        declaredMime,
        detectedMime: declaredMime,
      };
    }

    return {
      isValid: false,
      declaredMime,
      error: 'No se pudo verificar el tipo de archivo',
    };
  }

  // 5. Verificar que el tipo detectado está permitido
  const detectedMime = detectedType.mime;
  const isAllowed = allowedTypes.includes(detectedMime);

  // 6. Verificar discrepancia entre tipo declarado y detectado
  if (declaredMime && detectedMime !== declaredMime) {
    // Algunas discrepancias son aceptables (ej. jpeg vs image/jpeg)
    const normalizedDeclared = normalizeMime(declaredMime);
    const normalizedDetected = normalizeMime(detectedMime);

    if (normalizedDeclared !== normalizedDetected) {
      console.warn(
        `⚠️ Discrepancia MIME: declarado=${declaredMime}, detectado=${detectedMime}`
      );
    }
  }

  return {
    isValid: isAllowed,
    detectedMime,
    declaredMime,
    error: isAllowed ? undefined : `Tipo de archivo no permitido: ${detectedMime}`,
  };
}

/**
 * Verifica si el contenido parece ser texto válido (no binario)
 */
function isTextContent(buffer: Buffer): boolean {
  // Verificar los primeros 8KB
  const sample = buffer.slice(0, 8192);

  // Contar bytes no imprimibles (excluyendo newlines y tabs)
  let nonPrintable = 0;
  for (const byte of sample) {
    if (byte === 0) return false; // Null bytes = binario
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      nonPrintable++;
    }
  }

  // Si más del 10% son no imprimibles, probablemente es binario
  return nonPrintable / sample.length < 0.1;
}

/**
 * Normaliza un MIME type para comparación
 */
function normalizeMime(mime: string): string {
  // Remover parámetros (ej. charset)
  const base = mime.split(';')[0].trim().toLowerCase();

  // Mapear variantes comunes
  const mappings: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'application/x-pdf': 'application/pdf',
  };

  return mappings[base] || base;
}

/**
 * Middleware Express para validar MIME en uploads
 *
 * Uso: Después de multer, aplicar este middleware
 */
interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

interface MulterRequest extends Request {
  file?: MulterFile;
  files?: MulterFile[] | Record<string, MulterFile[]>;
}

export function createMimeValidationMiddleware(
  allowedTypes: string[] = ALLOWED_MIME_TYPES.all
) {
  return async (
    req: MulterRequest,
    res: Response,
    next: NextFunction
  ) => {
    const files: MulterFile[] = [];

    if (req.file) {
      files.push(req.file);
    }

    if (req.files) {
      if (Array.isArray(req.files)) {
        files.push(...req.files);
      } else {
        // files es un objeto con campos
        for (const fieldFiles of Object.values(req.files)) {
          files.push(...fieldFiles);
        }
      }
    }

    // Validar cada archivo
    for (const file of files) {
      const result = await validateMimeType(
        file.buffer,
        file.mimetype,
        file.originalname,
        allowedTypes
      );

      if (!result.isValid) {
        res.status(400).json({
          error: 'Archivo inválido',
          message: result.error,
          filename: file.originalname,
        });
        return;
      }

      // Adjuntar MIME real al archivo para uso posterior
      (file as any).detectedMime = result.detectedMime;
    }

    next();
  };
}
