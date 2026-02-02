import { Router } from 'express';
import { z } from 'zod';
import { hash as bcryptHash } from 'bcrypt';
import { storage } from '../storage';
import { sanitizeUser, sanitizeUsers, redactSensitiveData, sql } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { insertUserSchema } from '@shared/schema';

const router = Router();

router.get("/api/user", jwtAuthMiddleware, async (req, res) => {
  try {
    const tokenUser = (req as any).user;

    // Obtener datos actualizados del usuario desde la base de datos
    const user = await storage.getUser(tokenUser.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove sensitive data from response
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/api/users", jwtAuthMiddleware, async (req, res) => {
  try {
    const users = await storage.getUsers();
    res.json(sanitizeUsers(users));
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/users", jwtAuthMiddleware, async (req, res) => {
  try {
    console.log("[POST /api/users] Datos recibidos:", JSON.stringify(redactSensitiveData(req.body), null, 2));

    // Validar datos con Zod
    const validatedData = insertUserSchema.parse(req.body);
    console.log("[POST /api/users] Datos validados:", JSON.stringify(redactSensitiveData(validatedData), null, 2));

    // Hash password if provided
    if (validatedData.password) {
      validatedData.password = await bcryptHash(validatedData.password, 10);
    }

    console.log("[POST /api/users] Datos después del hash:", JSON.stringify({ ...validatedData, password: '[HASHED]' }, null, 2));

    const user = await storage.createUser(validatedData);
    console.log("[POST /api/users] Usuario creado:", user);

    res.status(201).json(sanitizeUser(user));
  } catch (error) {
    console.error("[POST /api/users] Error completo:", error);
    if (error instanceof Error) {
      console.error("[POST /api/users] Stack trace:", error.stack);
    }

    if (error instanceof z.ZodError) {
      console.error("[POST /api/users] Errores de validación:", error.errors);
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors
      });
    }

    res.status(500).json({ message: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put("/api/users/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log("[PUT /api/users/:id] Datos recibidos:", redactSensitiveData(req.body));

    // Validar datos con Zod (usando partial para permitir actualizaciones parciales)
    const validatedData = insertUserSchema.partial().parse(req.body);

    // Hash password if provided
    if (validatedData.password) {
      validatedData.password = await bcryptHash(validatedData.password, 10);
    }

    console.log("[PUT /api/users/:id] Datos validados:", redactSensitiveData(validatedData));

    const user = await storage.updateUser(id, validatedData);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("[PUT /api/users/:id] Usuario actualizado:", user);
    res.json(sanitizeUser(user));
  } catch (error) {
    console.error("[PUT /api/users/:id] Error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors
      });
    }

    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/api/users/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteUser(id);

    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
