import { Router } from 'express';
import type { Request, Response } from 'express';
import { hash as bcryptHash } from 'bcrypt';
import path from 'path';
import fs from 'fs';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { getAuthUser, type AuthRequest } from './_helpers';
import { storage } from '../storage';

const router = Router();

// ========================================
// PRODUCTION DEBUGGING ENDPOINTS (ADMIN ONLY)
// ========================================

// Environment check endpoint (más detallado) - Solo administradores
router.get('/env-check', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => {
  const nodeEnv = process.env.NODE_ENV || 'undefined';
  const expressEnv = req.app.get('env');

  // Paths críticos
  const paths = {
    cwd: process.cwd(),
    script_dir: import.meta.dirname,
    dist_index: path.resolve(import.meta.dirname, "index.js"),
    dist_public: path.resolve(import.meta.dirname, "public"),
    dist_public_index: path.resolve(import.meta.dirname, "public", "index.html")
  };

  // Verificar existencia de archivos
  const fileChecks = {
    dist_index_exists: false,
    dist_public_exists: false,
    dist_public_index_exists: false
  };

  try {
    fileChecks.dist_index_exists = fs.existsSync(paths.dist_index);
    fileChecks.dist_public_exists = fs.existsSync(paths.dist_public);
    fileChecks.dist_public_index_exists = fs.existsSync(paths.dist_public_index);
  } catch (error) {
    // Handle potential permission errors
  }

  // Environment variables status (sin exponer valores)
  const envVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SENDGRID_API_KEY',
    'REPL_ID',
    'REPL_SLUG'
  ];

  const envStatus: Record<string, {exists: boolean; length: number; status: string}> = {};
  envVars.forEach(envVar => {
    const exists = !!process.env[envVar];
    const length = process.env[envVar]?.length || 0;
    envStatus[envVar] = {
      exists,
      length: exists ? length : 0,
      status: exists ? 'SET' : 'MISSING'
    };
  });

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: nodeEnv,
      express_env: expressEnv,
      is_production: expressEnv === 'production'
    },
    paths,
    file_checks: fileChecks,
    env_variables: envStatus,
    critical_issues: [] as string[]
  };

  // Detectar problemas críticos
  if (!envStatus['JWT_SECRET']?.exists) {
    diagnostics.critical_issues.push('JWT_SECRET missing - auth will fail');
  }

  if (expressEnv === 'production' && !fileChecks.dist_public_index_exists) {
    diagnostics.critical_issues.push('dist/public/index.html missing in production');
  }

  res.json(diagnostics);
});

// API Health check endpoint - Solo administradores
router.get('/api/healthz', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// ====================
// ADMIN ENDPOINTS
// ====================

// POST /api/admin/seed-clients - Crear clientes de prueba
router.post("/api/admin/seed-clients", jwtAuthMiddleware, jwtAdminMiddleware, async (req, res) => {
  try {
    const { seedClients } = await import('../seed-clients');
    const result = await seedClients();

    res.json(result);
  } catch (error) {
    console.error('[Admin] Error seeding clients:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding clients',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// ====================
// TREASURY AUTOMATION ENDPOINTS
// ====================

// POST /api/treasury/send-reminder - Enviar recordatorio manual
router.post("/api/treasury/send-reminder", jwtAuthMiddleware, async (req, res) => {
  try {
    const { voucherId, clientId } = req.body;

    if (!voucherId || !clientId) {
      return res.status(400).json({ error: 'voucherId y clientId son requeridos' });
    }

    const { TreasuryAutomation } = await import('../treasury-automation');
    const result = await TreasuryAutomation.sendComplementReminder(voucherId, clientId);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('[Treasury] Error sending reminder:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/treasury/resend-receipt - Reenviar comprobante
router.post("/api/treasury/resend-receipt", jwtAuthMiddleware, async (req, res) => {
  try {
    const { voucherId, clientId, companyId } = req.body;

    if (!voucherId || !clientId || !companyId) {
      return res.status(400).json({ error: 'voucherId, clientId y companyId son requeridos' });
    }

    const { TreasuryAutomation } = await import('../treasury-automation');
    const result = await TreasuryAutomation.sendPaymentReceiptToSupplier(voucherId, clientId, companyId);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('[Treasury] Error resending receipt:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: Resetear contraseña de un usuario específico
router.post("/api/admin/reset-user-password", jwtAuthMiddleware, jwtAdminMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email y password son requeridos" });
    }
    // Buscar usuario por email (case-insensitive)
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const hash = await bcryptHash(password, 10);
    const updated = await storage.updateUser(user.id, { password: hash });
    if (!updated) {
      return res.status(500).json({ message: "No fue posible actualizar la contraseña" });
    }
    res.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("[POST /api/admin/reset-user-password] Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
