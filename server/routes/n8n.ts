import { Router } from 'express';
import { z } from 'zod';
import { sql } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { getSalesMetrics } from '../sales-metrics';
import path from 'path';
import fs from 'fs';

const router = Router();

// ========================================================================
// N8N INTEGRATION ENDPOINTS
// ========================================================================

// POST /api/n8n/webhook - Endpoint para recibir respuestas de n8n
router.post("/api/n8n/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;

    // Verificar token de autenticación de n8n (REQUERIDO)
    const n8nToken = req.headers['x-n8n-token'];
    const expectedToken = process.env.N8N_WEBHOOK_TOKEN;

    if (!expectedToken || n8nToken !== expectedToken) {
      return res.status(401).json({ error: 'Token inválido o no configurado' });
    }

    console.log(`[N8N Webhook] Recibido tipo: ${type}`);

    switch (type) {
      case 'alert':
        // Procesar alerta de anomalía
        console.log('[N8N Webhook] Alerta recibida:', data);
        // Aquí podrías emitir un WebSocket event o guardar en DB
        break;
      case 'report':
        // Procesar reporte semanal
        console.log('[N8N Webhook] Reporte recibido');
        break;
      default:
        console.log('[N8N Webhook] Tipo desconocido:', type);
    }

    res.json({ success: true, received: type });
  } catch (error) {
    console.error('[N8N Webhook] Error:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

// GET /api/n8n/context - Proporcionar contexto de datos para n8n
router.get("/api/n8n/context", async (req, res) => {
  try {
    // Token de autenticación (REQUERIDO)
    const n8nToken = req.headers['x-n8n-token'];
    const expectedToken = process.env.N8N_WEBHOOK_TOKEN;

    if (!expectedToken || n8nToken !== expectedToken) {
      return res.status(401).json({ error: 'Token inválido o no configurado' });
    }

    // Obtener contexto general del sistema
    const duraStats = await getSalesMetrics(1);
    const orsegaStats = await getSalesMetrics(2);
    const exchangeRates = await sql`SELECT * FROM exchange_rates ORDER BY date DESC LIMIT 100`;

    res.json({
      timestamp: new Date().toISOString(),
      companies: {
        dura: duraStats,
        orsega: orsegaStats
      },
      exchangeRates,
      systemInfo: {
        version: '2.0',
        aiEnabled: !!process.env.OPENAI_API_KEY
      }
    });
  } catch (error) {
    console.error('[N8N Context] Error:', error);
    res.status(500).json({ error: 'Error obteniendo contexto' });
  }
});

// POST /api/n8n/query - DISABLED: Raw SQL execution is a security risk
// N8N should use specific API endpoints instead of raw queries
router.post("/api/n8n/query", async (_req, res) => {
  res.status(410).json({
    error: 'Este endpoint ha sido deshabilitado por seguridad. Usa los endpoints API específicos en su lugar.',
  });
});

// Endpoint de diagnóstico para archivos estáticos (solo en desarrollo/staging)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG === 'true') {
  router.get('/api/debug/static-files', jwtAuthMiddleware, async (req, res) => {
    try {
      const publicDir = path.join(process.cwd(), 'public');
      const distPublicDir = path.join(process.cwd(), 'dist', 'public');
      const serverPublicDir = path.resolve(import.meta.dirname, 'public');

      const result: any = {
        cwd: process.cwd(),
        publicExists: fs.existsSync(publicDir),
        distPublicExists: fs.existsSync(distPublicDir),
        serverPublicExists: fs.existsSync(serverPublicDir),
        filesInPublic: [],
        filesInDistPublic: [],
        filesInServerPublic: [],
      };

      if (result.publicExists) {
        result.filesInPublic = fs.readdirSync(publicDir);
      }
      if (result.distPublicExists) {
        result.filesInDistPublic = fs.readdirSync(distPublicDir);
      }
      if (result.serverPublicExists) {
        result.filesInServerPublic = fs.readdirSync(serverPublicDir);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error checking static files', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
}

export default router;
