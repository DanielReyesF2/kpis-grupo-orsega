/**
 * Nova AI — Express Routes
 *
 * POST /api/nova/chat     — SSE streaming chat with file upload support
 * GET  /api/nova/analysis/:id — Poll auto-analysis results
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { novaAIClient } from './nova-client';
import { jwtAuthMiddleware } from '../auth';

// In-memory store for auto-analysis results (with userId for ownership)
const MAX_ANALYSIS_STORE_SIZE = 1000;
export const analysisStore = new Map<string, { result: any; timestamp: number; userId?: string }>();

// Cleanup stale analysis entries every 30 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of analysisStore) {
    if (now - entry.timestamp > 30 * 60 * 1000) {
      analysisStore.delete(id);
    }
  }
}, 30 * 60 * 1000);
// Prevent the timer from keeping the process alive
if (cleanupTimer.unref) cleanupTimer.unref();

// Max message length (characters)
const MAX_MESSAGE_LENGTH = 10_000;
// Max pageContext length
const MAX_PAGE_CONTEXT_LENGTH = 100;

// ============================================================================
// RATE LIMITER (per-user, in-memory)
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;  // 10 requests per window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup stale rate-limit entries every 5 minutes
const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);
if (rateLimitCleanup.unref) rateLimitCleanup.unref();

// ============================================================================
// MULTER CONFIG
// ============================================================================

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/xml',
  'text/xml',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

const novaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  },
});

/**
 * Validate uploaded file content via magic bytes (defense-in-depth).
 * Returns true if the file buffer matches expected signatures for its MIME type.
 */
async function validateFileContent(file: Express.Multer.File): Promise<boolean> {
  const buf = file.buffer;
  const mime = file.mimetype;

  if (mime === 'application/pdf') {
    // PDF starts with %PDF
    return buf.length >= 4 && buf.slice(0, 4).toString('ascii') === '%PDF';
  }
  if (mime.includes('xml')) {
    // XML starts with < (optionally <?xml)
    const start = buf.slice(0, 100).toString('utf-8').trimStart();
    return start.startsWith('<');
  }
  if (mime === 'image/png') {
    // PNG magic: 89 50 4E 47
    return buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    // JPEG magic: FF D8 FF
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === 'image/webp') {
    // WebP: RIFF....WEBP
    return buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  }
  if (mime.includes('spreadsheet') || mime.includes('excel')) {
    // XLSX (ZIP format): PK (50 4B) or old XLS: D0 CF 11 E0
    return (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) ||
           (buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0);
  }
  return true; // Unknown types pass through (already filtered by MIME)
}

// ============================================================================
// HELPERS
// ============================================================================

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    email: string;
    name: string;
    companyId?: number | null;
  };
}

// ============================================================================
// ROUTER
// ============================================================================

export const novaRouter = Router();

/**
 * POST /api/nova/chat — SSE streaming chat with optional file upload
 *
 * Body (multipart/form-data):
 *   message: string
 *   conversationHistory: JSON string of ConversationMessage[]
 *   pageContext: string (optional)
 *   files[]: File[] (optional, max 5)
 *
 * Response: SSE stream
 *   event: token   — { text: "..." }
 *   event: tool_start — { tool: "smart_query" }
 *   event: tool_result — { tool: "smart_query", success: true }
 *   event: done    — { answer: "...", toolsUsed: [...] }
 *   event: error   — { message: "..." }
 */
novaRouter.post(
  '/api/nova/chat',
  jwtAuthMiddleware,
  novaUpload.array('files', 5),
  async (req: AuthRequest, res: Response) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Abort controller for client disconnect
    const abortController = new AbortController();
    let ended = false;

    const safeWrite = (data: string) => {
      if (!ended && !res.writableEnded) {
        res.write(data);
      }
    };

    const safeEnd = () => {
      if (!ended && !res.writableEnded) {
        ended = true;
        res.end();
      }
    };

    // Listen for client disconnect — use socket close, not request close
    // req.on('close') fires when request body finishes reading, which is not what we want
    // res.on('close') fires when the connection is actually closed by the client
    res.on('close', () => {
      if (!ended) {
        console.log('[Nova Route] Client disconnected, aborting stream');
        abortController.abort();
        ended = true;
      }
    });

    try {
      // --- Rate limiting ---
      const rateLimitUserId = req.user?.id?.toString() || 'anonymous';
      if (!checkRateLimit(rateLimitUserId)) {
        safeWrite(`event: error\ndata: ${JSON.stringify({ message: 'Demasiadas solicitudes. Espera un momento antes de enviar otro mensaje.' })}\n\n`);
        safeEnd();
        return;
      }

      // --- Input validation ---
      const message = req.body.message;
      if (!message || typeof message !== 'string') {
        safeWrite(`event: error\ndata: ${JSON.stringify({ message: 'Mensaje requerido' })}\n\n`);
        safeEnd();
        return;
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        safeWrite(`event: error\ndata: ${JSON.stringify({ message: `Mensaje muy largo (max ${MAX_MESSAGE_LENGTH} caracteres)` })}\n\n`);
        safeEnd();
        return;
      }

      // Parse and validate conversation history
      let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (req.body.conversationHistory) {
        try {
          const parsed = JSON.parse(req.body.conversationHistory);
          if (Array.isArray(parsed)) {
            // Validate each entry: role must be 'user' | 'assistant', content must be string
            conversationHistory = parsed
              .filter((entry: any) =>
                entry &&
                typeof entry === 'object' &&
                (entry.role === 'user' || entry.role === 'assistant') &&
                typeof entry.content === 'string' &&
                entry.content.length <= MAX_MESSAGE_LENGTH
              )
              .map((entry: any) => ({
                role: entry.role as 'user' | 'assistant',
                content: entry.content as string,
              }));
          }
        } catch {
          console.warn('[Nova Route] Failed to parse conversationHistory');
        }
      }

      const pageContext = typeof req.body.pageContext === 'string'
        ? req.body.pageContext.slice(0, MAX_PAGE_CONTEXT_LENGTH)
        : '';

      const files = (req.files as Express.Multer.File[]) || [];

      // Diagnostic logging for file upload debugging
      console.log(`[Nova Route] Raw multer files: ${files.length}, content-type: ${req.headers['content-type']?.substring(0, 60)}, body keys: ${Object.keys(req.body || {}).join(',')}`);
      if (files.length > 0) {
        files.forEach((f, i) => console.log(`[Nova Route] File[${i}]: ${f.originalname} (${f.mimetype}, ${f.size} bytes)`));
      }

      // Validate file content via magic bytes
      const validFiles: Express.Multer.File[] = [];
      for (const file of files) {
        if (await validateFileContent(file)) {
          validFiles.push(file);
        } else {
          console.warn(`[Nova Route] File ${file.originalname} failed magic-byte validation (claimed ${file.mimetype})`);
        }
      }

      const user = req.user;
      const userId = user?.id?.toString() || '';

      console.log(`[Nova Route] Chat request from user ${user?.id}, page: ${pageContext}, files: ${validFiles.length}, novaAI: ${novaAIClient.isConfigured()}`);

      // ================================================================
      // PROXY to Nova AI 2.0 external service
      // All files (including PDFs) are sent directly to Nova 2.0
      // ================================================================
      if (!novaAIClient.isConfigured()) {
        safeWrite(`event: error\ndata: ${JSON.stringify({ message: 'Nova AI no esta configurado' })}\n\n`);
        safeEnd();
        return;
      }

      const filesToForward = validFiles.map(f => ({
        buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype
      }));

      await novaAIClient.streamChat(
        message,
        filesToForward,
        {
          conversationHistory: conversationHistory.slice(-10),
          pageContext,
          userId,
          companyId: user?.companyId || undefined,
        },
        {
          onToken(text) {
            safeWrite(`event: token\ndata: ${JSON.stringify({ text })}\n\n`);
          },
          onToolStart(tool) {
            safeWrite(`event: tool_start\ndata: ${JSON.stringify({ tool })}\n\n`);
          },
          onToolResult(tool, success) {
            safeWrite(`event: tool_result\ndata: ${JSON.stringify({ tool, success })}\n\n`);
          },
          onDone(response) {
            safeWrite(`event: done\ndata: ${JSON.stringify(response)}\n\n`);
            safeEnd();
          },
          onError(error) {
            safeWrite(`event: error\ndata: ${JSON.stringify({ message: error.message || 'Error procesando solicitud' })}\n\n`);
            safeEnd();
          },
        },
        abortController.signal
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error interno';
      console.error('[Nova Route] Error:', msg);
      safeWrite(`event: error\ndata: ${JSON.stringify({ message: 'Error interno del servidor' })}\n\n`);
      safeEnd();
    }
  }
);

/**
 * GET /api/nova/analysis/:id — Poll auto-analysis results
 */
novaRouter.get(
  '/api/nova/analysis/:id',
  jwtAuthMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const entry = analysisStore.get(id);

    if (!entry) {
      return res.status(404).json({ error: 'Analisis no encontrado o aun en proceso' });
    }

    // Verify ownership: only the user who triggered the analysis can poll it
    const requestUserId = req.user?.id?.toString();
    if (entry.userId && requestUserId && entry.userId !== requestUserId) {
      return res.status(403).json({ error: 'No autorizado para acceder a este analisis' });
    }

    res.json(entry.result);
  }
);
