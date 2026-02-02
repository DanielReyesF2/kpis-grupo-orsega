import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { uploadFile, uploadMulterFile, isUsingR2, getFile } from '../storage/file-storage';
import * as fileStorage from '../file-storage';

const router = Router();

// ============================================
// CLOUDFLARE R2 FILE STORAGE ENDPOINTS
// ============================================

// GET /api/files/info - Obtener información del almacenamiento
router.get('/api/files/info', jwtAuthMiddleware, (req, res) => {
  res.json(fileStorage.getStorageInfo());
});

// GET /api/files/url/:key(*) - Obtener URL firmada para ver/descargar archivo
// El (*) permite que el key contenga "/"
router.get('/api/files/url/*', jwtAuthMiddleware, async (req, res) => {
  try {
    const key = req.params[0]; // Captura todo después de /api/files/url/

    if (!key) {
      return res.status(400).json({ error: 'File key is required' });
    }

    // Si R2 está configurado, obtener URL firmada
    if (fileStorage.isR2Configured()) {
      const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // Default 1 hora
      const inline = req.query.inline === 'true';

      const url = inline
        ? await fileStorage.getViewUrl(key, expiresIn)
        : await fileStorage.getDownloadUrl(key, expiresIn);

      res.json({ url, provider: 'r2', key, expiresIn });
    } else {
      // Fallback: devolver URL local
      const localUrl = key.startsWith('/') ? key : `/${key}`;
      res.json({ url: localUrl, provider: 'local', key });
    }
  } catch (error) {
    console.error('[Files] Error getting URL:', error);
    res.status(500).json({
      error: 'Error getting file URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/files/upload - Subir archivo a R2 (con fallback a local)
const fileUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

router.post('/api/files/upload', jwtAuthMiddleware, fileUploadMiddleware.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const category = (req.body.category || 'temp') as fileStorage.FileCategory;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : undefined;

    const result = await fileStorage.uploadFileWithFallback(
      req.file.buffer,
      req.file.originalname,
      category
    );

    res.json({
      success: true,
      ...result,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('[Files] Error uploading:', error);
    res.status(500).json({
      error: 'Error uploading file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/files/:key(*) - Eliminar archivo de R2
router.delete('/api/files/*', jwtAuthMiddleware, async (req, res) => {
  try {
    const key = req.params[0];

    if (!key) {
      return res.status(400).json({ error: 'File key is required' });
    }

    // Path traversal protection: reject keys with ".." or absolute paths
    if (key.includes('..') || path.isAbsolute(key)) {
      return res.status(400).json({ error: 'Invalid file key' });
    }

    if (fileStorage.isR2Configured()) {
      const success = await fileStorage.deleteFile(key);
      res.json({ success, key });
    } else {
      // Para archivos locales, eliminar del disco
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const localPath = path.resolve(process.cwd(), key);
      // Ensure resolved path stays within uploads directory
      if (!localPath.startsWith(uploadsDir)) {
        return res.status(400).json({ error: 'Invalid file key' });
      }
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        res.json({ success: true, key });
      } else {
        res.status(404).json({ error: 'File not found', key });
      }
    }
  } catch (error) {
    console.error('[Files] Error deleting:', error);
    res.status(500).json({
      error: 'Error deleting file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
