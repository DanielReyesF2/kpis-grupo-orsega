/**
 * Helper para desencriptar archivos Excel protegidos con contraseña
 * Usa officecrypto-tool (JavaScript puro) para manejar encriptación
 */

import fs from 'fs';
import path from 'path';

// Contraseña estándar para todos los archivos de ventas
const EXCEL_PASSWORD = 'GODINTAL';

/**
 * Verifica si un archivo Excel está encriptado
 * Los archivos XLSX encriptados tienen una firma CDFV2 en lugar de ZIP
 */
export async function isEncryptedExcel(filePath: string): Promise<boolean> {
  try {
    const buffer = fs.readFileSync(filePath);
    // Los archivos XLSX normales empiezan con PK (ZIP signature)
    // Los archivos encriptados empiezan con D0 CF 11 E0 (OLE2/CDFV2 signature)
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;
    const isCDFV2 = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;

    if (isCDFV2) {
      console.log(`🔒 [Decryptor] Archivo detectado como encriptado (CDFV2)`);
      return true;
    }

    if (isZip) {
      console.log(`📦 [Decryptor] Archivo es ZIP/XLSX normal`);
      return false;
    }

    console.log(`❓ [Decryptor] Formato desconocido, asumiendo no encriptado`);
    return false;
  } catch (error: any) {
    console.error(`❌ [Decryptor] Error verificando encriptación: ${error.message}`);
    return false;
  }
}

/**
 * Desencripta un archivo Excel protegido con contraseña GODINTAL
 * @param inputPath - Ruta al archivo encriptado
 * @returns Ruta al archivo desencriptado (temporal)
 */
export async function decryptExcel(inputPath: string): Promise<string> {
  // Verificar si el archivo existe
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Archivo no encontrado: ${inputPath}`);
  }

  // Crear ruta para archivo desencriptado
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const decryptedPath = path.join(dir, `${base}-decrypted${ext}`);

  // Verificar si ya existe un archivo desencriptado
  if (fs.existsSync(decryptedPath)) {
    fs.unlinkSync(decryptedPath);
  }

  try {
    console.log(`🔐 [Decryptor] Desencriptando archivo con contraseña...`);

    // Importar dinámicamente officecrypto-tool
    const { decrypt } = await import('officecrypto-tool');

    // Leer archivo encriptado
    const encryptedBuffer = fs.readFileSync(inputPath);

    // Desencriptar
    const decryptedBuffer = await decrypt(encryptedBuffer, {
      password: EXCEL_PASSWORD
    });

    // Guardar archivo desencriptado
    fs.writeFileSync(decryptedPath, decryptedBuffer);

    // Verificar que se creó el archivo
    if (!fs.existsSync(decryptedPath)) {
      throw new Error('No se pudo crear el archivo desencriptado');
    }

    console.log(`✅ [Decryptor] Archivo desencriptado exitosamente: ${decryptedPath}`);
    return decryptedPath;

  } catch (error: any) {
    // Si falla porque no está encriptado, devolver el original
    if (error.message?.includes('not encrypted') ||
        error.message?.includes('CFB') ||
        error.message?.includes('password')) {
      console.log(`ℹ️ [Decryptor] Archivo no está encriptado o contraseña incorrecta, usando original`);
      return inputPath;
    }

    console.error(`❌ [Decryptor] Error desencriptando: ${error.message}`);
    throw new Error(`Error al desencriptar archivo: ${error.message}`);
  }
}

/**
 * Intenta desencriptar si es necesario, si no, devuelve el original
 * Esta función es segura para usar con cualquier archivo Excel
 */
export async function ensureDecrypted(filePath: string): Promise<{ path: string; wasDecrypted: boolean }> {
  try {
    const encrypted = await isEncryptedExcel(filePath);

    if (!encrypted) {
      console.log(`ℹ️ [Decryptor] Archivo no requiere desencriptación`);
      return { path: filePath, wasDecrypted: false };
    }

    const decryptedPath = await decryptExcel(filePath);
    return { path: decryptedPath, wasDecrypted: decryptedPath !== filePath };
  } catch (error: any) {
    console.error(`❌ [Decryptor] Error en ensureDecrypted: ${error.message}`);
    // En caso de error, intentar usar el archivo original
    return { path: filePath, wasDecrypted: false };
  }
}

/**
 * Limpia archivo desencriptado temporal
 */
export function cleanupDecrypted(decryptedPath: string, originalPath: string): void {
  if (decryptedPath !== originalPath && fs.existsSync(decryptedPath)) {
    try {
      fs.unlinkSync(decryptedPath);
      console.log(`🧹 [Decryptor] Archivo temporal eliminado: ${decryptedPath}`);
    } catch {
      // Ignorar errores de limpieza
    }
  }
}
