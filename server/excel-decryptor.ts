/**
 * Helper para desencriptar archivos Excel protegidos con contraseña
 * Usa msoffcrypto-tool de Python para manejar encriptación CDFV2
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Contraseña estándar para todos los archivos de ventas
const EXCEL_PASSWORD = 'GODINTAL';

/**
 * Verifica si un archivo está encriptado
 */
export async function isEncryptedExcel(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`file "${filePath}"`);
    return stdout.includes('CDFV2 Encrypted') || stdout.includes('Encrypted');
  } catch {
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
    // Usar msoffcrypto-tool para desencriptar
    const command = `msoffcrypto-tool -p ${EXCEL_PASSWORD} "${inputPath}" "${decryptedPath}"`;
    console.log(`🔐 [Decryptor] Desencriptando archivo con contraseña...`);

    await execAsync(command, { timeout: 30000 });

    // Verificar que se creó el archivo
    if (!fs.existsSync(decryptedPath)) {
      throw new Error('No se pudo crear el archivo desencriptado');
    }

    console.log(`✅ [Decryptor] Archivo desencriptado exitosamente: ${decryptedPath}`);
    return decryptedPath;

  } catch (error: any) {
    // Si falla, puede que no esté encriptado - devolver el original
    if (error.message?.includes('not encrypted') || error.stderr?.includes('not encrypted')) {
      console.log(`ℹ️ [Decryptor] Archivo no está encriptado, usando original`);
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
  const encrypted = await isEncryptedExcel(filePath);

  if (!encrypted) {
    console.log(`ℹ️ [Decryptor] Archivo no requiere desencriptación`);
    return { path: filePath, wasDecrypted: false };
  }

  const decryptedPath = await decryptExcel(filePath);
  return { path: decryptedPath, wasDecrypted: decryptedPath !== filePath };
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
