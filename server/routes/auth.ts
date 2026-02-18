import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { hash as bcryptHash } from 'bcrypt';
import { z } from 'zod';
import { jwtAuthMiddleware, jwtAdminMiddleware, loginUser } from '../auth';
import { sanitizeUser, redactSensitiveData, type AuthRequest } from './_helpers';
import { insertUserSchema } from '@shared/schema';
import { storage } from '../storage';
import { logger } from '../logger';

const router = Router();

// ========================================
// RATE LIMITERS - Protección contra abuso
// ========================================

// Rate limiter para login - Previene fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: 'Demasiados intentos de login. Por favor, intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para registro - Previene spam
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por hora por IP
  message: 'Demasiados intentos de registro. Por favor, intenta más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// LOGIN
// ========================================

// Login route - Con rate limiting pero SIN autenticación JWT
router.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const result = await loginUser(username, password);

    if (!result) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    res.json(result);
  } catch (error) {
    logger.error("[POST /api/login] Error en login", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ========================================
// REGISTER
// ========================================

// Registro público de usuarios - Con rate limiting
router.post("/api/register", registerLimiter, async (req, res) => {
  try {
    console.log("[POST /api/register] Datos recibidos:", JSON.stringify(redactSensitiveData(req.body), null, 2));

    // Normalizar y coercionar datos antes de validación
    const { area, ...userData } = req.body;

    // Coercionar companyId de string a number
    const companyId = userData.companyId != null ? Number(userData.companyId) : undefined;

    // Mapear el área string a areaId integer
    let areaId = null;
    if (area && companyId) {
      const areaMapping: Record<string, Record<number, number>> = {
        'Sales': { 1: 1, 2: 4 },      // Ventas: Dura=1, Orsega=4
        'Logistics': { 1: 2, 2: 5 },  // Logística: Dura=2, Orsega=5
        'Purchasing': { 1: 7, 2: 10 }, // Compras: Dura=7, Orsega=10
        'Accounting': { 1: 3, 2: 6 }   // Contabilidad: Dura=3, Orsega=6
      };

      areaId = areaMapping[area]?.[companyId] || null;
      console.log(`[POST /api/register] Área mapeada: ${area} + Company ${companyId} = areaId ${areaId}`);
    }

    // Usar safeParse en lugar de parse para manejar errores apropiadamente
    const validationResult = insertUserSchema.safeParse({
      ...userData,
      companyId,
      areaId,
      email: userData.email?.toLowerCase(), // Normalizar email
    });

    if (!validationResult.success) {
      console.log("[POST /api/register] Error de validación:", validationResult.error.issues);
      return res.status(400).json({
        message: "Error de validación",
        code: 'VALIDATION_ERROR',
        errors: validationResult.error.issues
      });
    }

    const validatedData = validationResult.data;
    console.log("[POST /api/register] Datos validados:", JSON.stringify(redactSensitiveData(validatedData), null, 2));

    // FIX BUG #2: Removida la verificación previa de email
    // Confiar en el constraint UNIQUE de la base de datos previene race conditions
    // Si el email ya existe, el error será capturado en el catch de más abajo

    // Hash password (obligatorio para registro público)
    if (!validatedData.password) {
      return res.status(400).json({
        message: "La contraseña es obligatoria"
      });
    }

    validatedData.password = await bcryptHash(validatedData.password, 10);

    // Asignar role por defecto para usuarios que se registran públicamente
    if (!validatedData.role) {
      validatedData.role = 'collaborator'; // Role por defecto
    }

    console.log("[POST /api/register] Datos después del hash:", JSON.stringify({ ...validatedData, password: '[HASHED]' }, null, 2));

    const user = await storage.createUser(validatedData);
    console.log("[POST /api/register] Usuario registrado exitosamente:", sanitizeUser(user));

    // Solo retornar 201 en caso de éxito real
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error("[POST /api/register] Error completo:", error);

    // Manejo específico de errores de base de datos
    if (error instanceof Error) {
      console.error("[POST /api/register] Stack trace:", error.stack);

      // Error de email duplicado (unique constraint)
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        return res.status(409).json({
          message: "El email ya está registrado",
          code: 'EMAIL_EXISTS'
        });
      }
    }

    // Error de validación Zod (aunque ya se maneja arriba)
    if (error instanceof z.ZodError) {
      console.error("[POST /api/register] Errores de validación:", error.errors);
      return res.status(400).json({
        message: "Error de validación",
        code: 'VALIDATION_ERROR',
        errors: error.errors
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      message: "Error interno del servidor",
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ========================================
// ONE-TIME PASSWORD RESET (for double-hashed accounts)
// Protected by a one-time secret — remove after use
// ========================================

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/emergency-reset-password", resetLimiter, async (req, res) => {
  try {
    const { email, newPassword, secret } = req.body;

    // Require a one-time secret to prevent abuse
    if (secret !== "fix-mario-2026") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!email || !newPassword) {
      return res.status(400).json({ message: "email and newPassword are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await storage.getUserByUsername(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcryptHash(newPassword, 10);
    await storage.updateUser(user.id, { password: hashedPassword });

    logger.info(`[EMERGENCY RESET] Password reset for user ${user.email} (id: ${user.id})`);
    res.json({ success: true, message: `Password reset for ${user.email}` });
  } catch (error) {
    logger.error("[POST /api/emergency-reset-password] Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
