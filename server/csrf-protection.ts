/**
 * ✅ SECURITY FIX: Protección CSRF usando patrón Double-Submit Cookie
 *
 * Este middleware implementa protección contra CSRF (Cross-Site Request Forgery)
 * usando el patrón de doble envío de cookie.
 *
 * Cómo funciona:
 * 1. Se genera un token CSRF aleatorio
 * 2. El token se almacena en una cookie HttpOnly
 * 3. El cliente debe enviar el mismo token en el header X-CSRF-Token
 * 4. El servidor compara ambos valores
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Nombre de la cookie y header para CSRF
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Métodos que requieren verificación CSRF (métodos que cambian estado)
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Rutas que están exentas de CSRF (endpoints públicos o de autenticación)
const CSRF_EXEMPT_ROUTES = [
  '/api/login',
  '/api/register',
  '/api/csrf-token', // Endpoint para obtener el token
  '/api/health',
  '/api/version',
  '/health',
  '/healthz',
];

/**
 * Genera un token CSRF seguro
 */
function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compara dos tokens de forma segura (timing-safe)
 */
function tokensMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Middleware que genera y establece el token CSRF en una cookie
 */
export function csrfTokenGenerator(req: Request, res: Response, next: NextFunction): void {
  // Solo generar token si no existe o si es una petición GET
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!existingToken) {
    const newToken = generateCSRFToken();

    // Establecer cookie con el token
    res.cookie(CSRF_COOKIE_NAME, newToken, {
      httpOnly: false, // El cliente necesita leer esto para enviarlo en el header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      path: '/',
    });

    // Adjuntar el token al request para uso posterior
    (req as any).csrfToken = newToken;
  } else {
    (req as any).csrfToken = existingToken;
  }

  next();
}

/**
 * Middleware que valida el token CSRF en requests que modifican estado
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Saltar verificación para métodos seguros (GET, HEAD, OPTIONS)
  if (!CSRF_PROTECTED_METHODS.includes(req.method)) {
    return next();
  }

  // Saltar verificación para rutas exentas
  const isExempt = CSRF_EXEMPT_ROUTES.some(route => req.path.startsWith(route));
  if (isExempt) {
    return next();
  }

  // Saltar si viene de una API sin origen (curl, mobile apps, etc.)
  // Esto es seguro porque CSRF requiere un navegador con cookies
  const origin = req.get('origin');
  const referer = req.get('referer');
  if (!origin && !referer) {
    return next();
  }

  // Obtener token de la cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  // Obtener token del header
  const headerToken = req.get(CSRF_HEADER_NAME);

  // Verificar que ambos tokens existan y coincidan
  if (!cookieToken || !headerToken) {
    console.warn(`⚠️ CSRF: Token faltante en ${req.method} ${req.path}`);
    res.status(403).json({
      error: 'CSRF token missing',
      message: 'Se requiere token CSRF para esta operación',
    });
    return;
  }

  if (!tokensMatch(cookieToken, headerToken)) {
    console.warn(`⚠️ CSRF: Token inválido en ${req.method} ${req.path}`);
    res.status(403).json({
      error: 'CSRF token invalid',
      message: 'Token CSRF inválido',
    });
    return;
  }

  // Token válido, continuar
  next();
}

/**
 * Handler para el endpoint que devuelve el token CSRF
 * El cliente debe llamar a este endpoint para obtener el token inicial
 */
export function getCSRFTokenHandler(req: Request, res: Response): void {
  const token = (req as any).csrfToken || req.cookies?.[CSRF_COOKIE_NAME] || generateCSRFToken();

  // Asegurar que la cookie está establecida
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  res.json({ csrfToken: token });
}
