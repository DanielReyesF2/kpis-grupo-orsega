import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";

// Secreto para firmar los tokens JWT - OBLIGATORIO en variables de entorno
if (!process.env.JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable must be set. " +
    "This is a critical security requirement. Application cannot start without it."
  );
}

const JWT_SECRET: string = process.env.JWT_SECRET;

// Tiempo de expiración del token: 7 días
const JWT_EXPIRES_IN = "7d";

// Interfaz para el payload del token JWT
interface JwtPayload {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number | null;
}

// Crear un token JWT para un usuario
export function generateToken(user: JwtPayload): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verificar un token JWT y obtener el payload
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    console.error("[JWT] Error al verificar token:", error);
    return null;
  }
}

// Middleware para verificar autenticación mediante JWT
export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Obtener el token del encabezado Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Format: "Bearer TOKEN"
  
  console.log('[JWT Auth] Checking token:', !!token);
  
  if (!token) {
    return res.status(401).json({ 
      message: "Unauthorized", 
      details: "No authentication token provided" 
    });
  }
  
  // Verificar el token
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ 
      message: "Unauthorized", 
      details: "Invalid or expired token" 
    });
  }
  
  // Adjuntar la información del usuario a la solicitud
  (req as any).user = payload;
  console.log(`[JWT Auth] Authenticated user: ID=${payload.id}, Role=${payload.role}`);
  
  next();
}

// Middleware para verificar si el usuario es administrador
export function jwtAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  
  next();
}

// Función de login que valida credenciales y genera un token JWT
// Función para verificar contraseñas de manera segura
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    if (!stored || !supplied) {
      console.error("[Auth] Password o stored password vacío");
      return false;
    }

    // Si la contraseña está hasheada con bcrypt (diferentes variantes)
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      console.log("[Auth] Comparando con bcrypt (hash detectado)");
      const result = await bcrypt.compare(supplied, stored);
      console.log(`[Auth] Resultado bcrypt.compare: ${result}`);
      return result;
    }
    
    // Para contraseñas sin hashear (fallback - desarrollo/migración)
    console.log("[Auth] Comparando texto plano (fallback)");
    const result = supplied === stored;
    console.log(`[Auth] Resultado comparación texto plano: ${result} (supplied="${supplied}", stored="${stored}")`);
    return result;
  } catch (error) {
    console.error("[Auth] Error comparando contraseñas:", error);
    return false;
  }
}

export async function loginUser(username: string, password: string): Promise<{ token: string, user: any } | null> {
  try {
    console.log(`[Auth] Intento de login para: ${username}`);
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      console.log(`[Auth] Usuario no encontrado: ${username}`);
      return null;
    }
    
    console.log(`[Auth] Usuario encontrado: ID=${user.id}, Email=${user.email}, Password hash starts with: ${user.password?.substring(0, 10)}`);
    
    const passwordMatches = await comparePasswords(password, user.password);
    console.log(`[Auth] Comparación de contraseña: ${passwordMatches ? '✅ MATCH' : '❌ NO MATCH'}`);
    
    if (!passwordMatches) {
      console.log(`[Auth] Contraseña incorrecta para usuario: ${username}`);
      console.log(`[Auth] Detalles: Password proporcionada length=${password.length}, Stored password starts with=${user.password?.substring(0, 10)}`);
      return null;
    }
    
    // Actualizar el tiempo de último login
    await storage.updateUser(user.id, { lastLogin: new Date() });
    
    // Generar token JWT
    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    });
    
    console.log(`[Auth] Login exitoso para usuario: ${username}`);
    
    // Retornar token y datos del usuario (sin la contraseña)
    const { password: _, ...userWithoutPassword } = user;
    
    return { 
      token, 
      user: userWithoutPassword 
    };
  } catch (error) {
    console.error("[Auth] Error en login:", error);
    return null;
  }
}