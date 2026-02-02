import { Router } from 'express';
import { storage } from '../storage';
import { sql, getAuthUser, sanitizeUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { emailService } from '../email-service';
import { sendEmail } from '../email';
import { hash as bcryptHash } from 'bcrypt';
import { z } from 'zod';

const router = Router();

// =============================================
// USER ACTIVATION SYSTEM ENDPOINTS
// =============================================

// Generate and send activation emails to all users (Admin only)
router.post("/api/admin/send-activation-emails", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);

    // SEGURO: Solo administradores pueden enviar emails de activación masiva
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Solo administradores pueden enviar emails de activación masiva" });
    }

    // Get all users
    const users = await storage.getUsers();
    let successCount = 0;
    let errorCount = 0;

    for (const targetUser of users) {
      try {
        // Generate activation token
        const activationToken = await storage.createActivationToken(targetUser.email);

        // Create activation URL
        const baseUrl = process.env.NODE_ENV === 'production'
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER || 'user'}.replit.app`
          : 'http://localhost:5000';

        const activationUrl = `${baseUrl}/activate/${activationToken.token}`;

        // Send activation email
        const emailSent = await sendEmail({
          to: targetUser.email,
          from: 'daniel@econova.com.mx',
          subject: '🔐 Activa tu cuenta en ECONOVA KPI Dashboard',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
              <div style="background: linear-gradient(135deg, #273949 0%, #b5e951 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
                <h1 style="margin: 0; font-size: 28px;">¡Bienvenido a ECONOVA!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">KPI Dashboard - Sistema de Gestión</p>
              </div>

              <div style="background: white; padding: 30px; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #273949; margin-top: 0;">Hola ${targetUser.name},</h2>

                <p>Tu cuenta ha sido creada en el Sistema ECONOVA KPI Dashboard. Para completar la configuración y acceder al sistema, necesitas establecer tu contraseña personal.</p>

                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #1976d2;">📧 Tu información de acceso:</h3>
                  <p style="margin: 0;"><strong>Email:</strong> ${targetUser.email}</p>
                  <p style="margin: 5px 0 0 0;"><strong>Rol:</strong> ${targetUser.role}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${activationUrl}" style="background: linear-gradient(135deg, #273949 0%, #b5e951 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                    🔐 Activar mi cuenta
                  </a>
                </div>

                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Información importante:</h4>
                  <ul style="margin: 0; padding-left: 20px; color: #856404;">
                    <li>Este enlace es válido por <strong>24 horas</strong></li>
                    <li>Solo puedes usarlo <strong>una vez</strong></li>
                    <li>Elige una contraseña segura (mínimo 8 caracteres)</li>
                    <li>Nunca compartas tus credenciales de acceso</li>
                  </ul>
                </div>

                <p style="color: #666; font-size: 14px;">Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
                <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-size: 12px; color: #666;">${activationUrl}</p>
              </div>

              <div style="text-align: center; color: #666; font-size: 12px;">
                <p>© 2025 ECONOVA - KPI Dashboard</p>
                <p>Sistema de Gestión de Indicadores de Rendimiento</p>
              </div>
            </div>
          `
        });

        if (emailSent) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error sending activation email to ${targetUser.email}:`, error);
        errorCount++;
      }
    }

    // Clean up expired tokens
    await storage.deleteExpiredTokens();

    res.json({
      message: `Emails de activación enviados`,
      totalUsers: users.length,
      successful: successCount,
      failed: errorCount
    });

  } catch (error) {
    console.error("[POST /api/admin/send-activation-emails] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Validate activation token and show activation page
router.get("/api/activate/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Get token from database
    const activationToken = await storage.getActivationToken(token);

    if (!activationToken) {
      return res.status(404).json({
        error: "Token no válido",
        message: "El enlace de activación no es válido o ha expirado"
      });
    }

    // Check if token is expired
    if (new Date() > activationToken.expiresAt) {
      return res.status(400).json({
        error: "Token expirado",
        message: "El enlace de activación ha expirado. Solicita uno nuevo al administrador"
      });
    }

    // Check if token is already used
    if (activationToken.used) {
      return res.status(400).json({
        error: "Token ya utilizado",
        message: "Este enlace de activación ya fue utilizado"
      });
    }

    // Get user to validate email exists
    const user = await storage.getUserByEmail(activationToken.email);
    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró un usuario asociado a este token"
      });
    }

    // Return success with user info (without password)
    res.json({
      valid: true,
      email: activationToken.email,
      user: sanitizeUser(user),
      expiresAt: activationToken.expiresAt
    });

  } catch (error) {
    console.error("[GET /api/activate/:token] Error:", error);
    res.status(500).json({
      error: "Error interno",
      message: "Error interno del servidor"
    });
  }
});

// Set password with activation token
router.post("/api/activate/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "La contraseña debe tener al menos 8 caracteres"
      });
    }

    // Get token from database para obtener el email
    const activationToken = await storage.getActivationToken(token);

    if (!activationToken) {
      return res.status(404).json({
        message: "Token no válido o expirado"
      });
    }

    // FIX BUG #1: Marcar token como usado ATÓMICAMENTE primero
    // Esto previene race conditions - si dos requests llegan simultáneamente,
    // solo una podrá marcar el token como usado
    const tokenMarked = await storage.markTokenAsUsed(token);

    if (!tokenMarked) {
      // El token ya fue usado, está expirado, o es inválido
      return res.status(400).json({
        message: "Token no válido, expirado o ya utilizado"
      });
    }

    // Get user
    const user = await storage.getUserByEmail(activationToken.email);
    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    // Hash the new password
    const hashedPassword = await bcryptHash(password, 10);

    // Update user password
    await storage.updateUser(user.id, { password: hashedPassword });

    // Clean up expired tokens
    await storage.deleteExpiredTokens();

    res.json({
      message: "¡Contraseña establecida exitosamente! Ya puedes iniciar sesión",
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error("[POST /api/activate/:token] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Database seeding endpoint (Admin only, Development only)
router.post("/api/seed-production", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;

    // Security: Only admins in development mode
    if (user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo administradores pueden acceder a este endpoint.'
      });
    }

    // Additional security: Disable in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Endpoint deshabilitado en producción por seguridad. No se permite seed de datos en producción.'
      });
    }

    const { seedProductionData } = await import("../seed-production");
    const result = await seedProductionData();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Seeding failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Database diagnostics endpoint (Admin only, Development only)
router.get("/api/debug-database", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;

    // Security: Only admins in development mode
    if (user?.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo administradores pueden acceder a este endpoint.'
      });
    }

    // Additional security: Disable in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Endpoint deshabilitado en producción por seguridad.'
      });
    }

    const allCompanies = await storage.getCompanies();
    const allAreas = await storage.getAreas();
    const allKpis = await storage.getKpis();

    res.json({
      companies: allCompanies,
      areas: allAreas,
      kpis: allKpis,
      totalCompanies: allCompanies.length,
      totalAreas: allAreas.length,
      totalKpis: allKpis.length,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
