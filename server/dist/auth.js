"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.jwtAuthMiddleware = jwtAuthMiddleware;
exports.jwtAdminMiddleware = jwtAdminMiddleware;
exports.loginUser = loginUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const storage_1 = require("./storage");
const bcrypt_1 = __importDefault(require("bcrypt"));
// Secreto para firmar los tokens JWT (en producción debería estar en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || "econova-kpi-jwt-secret-key";
// Tiempo de expiración del token: 7 días
const JWT_EXPIRES_IN = "7d";
// Crear un token JWT para un usuario
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
// Verificar un token JWT y obtener el payload
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        console.error("[JWT] Error al verificar token:", error);
        return null;
    }
}
// Middleware para verificar autenticación mediante JWT
function jwtAuthMiddleware(req, res, next) {
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
    req.user = payload;
    console.log(`[JWT Auth] Authenticated user: ID=${payload.id}, Role=${payload.role}`);
    next();
}
// Middleware para verificar si el usuario es administrador
function jwtAdminMiddleware(req, res, next) {
    const user = req.user;
    if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
}
// Función de login que valida credenciales y genera un token JWT
// Función para verificar contraseñas de manera segura
async function comparePasswords(supplied, stored) {
    try {
        // Si la contraseña está hasheada con bcrypt, usar bcrypt.compare
        if (stored.startsWith('$2b$')) {
            return await bcrypt_1.default.compare(supplied, stored);
        }
        // Para contraseñas sin hashear (fallback)
        return supplied === stored;
    }
    catch (error) {
        console.error("[Auth] Error comparando contraseñas:", error);
        return false;
    }
}
async function loginUser(username, password) {
    try {
        const user = await storage_1.storage.getUserByUsername(username);
        if (!user) {
            console.log(`[Auth] Usuario no encontrado: ${username}`);
            return null;
        }
        const passwordMatches = await comparePasswords(password, user.password);
        if (!passwordMatches) {
            console.log(`[Auth] Contraseña incorrecta para usuario: ${username}`);
            return null;
        }
        // Actualizar el tiempo de último login
        await storage_1.storage.updateUser(user.id, { lastLogin: new Date() });
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
    }
    catch (error) {
        console.error("[Auth] Error en login:", error);
        return null;
    }
}
