import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    companyId?: number;
  };
}

/**
 * 🔒 SECURITY MONITOR MIDDLEWARE
 * 
 * Monitorea accesos sospechosos SIN bloquear funcionalidad
 * Solo registra y alerta, NO interfiere con el flujo normal
 */
export function securityMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    
    if (!user) {
      // Usuario no autenticado - no es sospechoso
      return next();
    }

    // Extraer companyId del request
    const requestedCompanyId = req.query.companyId ? 
      parseInt(req.query.companyId as string) : 
      req.body?.companyId;

    // 🚨 ALERTA: Usuario accediendo a datos de otra empresa
    if (requestedCompanyId && user.companyId && requestedCompanyId !== user.companyId) {
      console.log(`🚨 [SECURITY ALERT] Cross-company access attempt:`);
      console.log(`   User: ${user.name} (ID: ${user.id}, Company: ${user.companyId})`);
      console.log(`   Requested Company: ${requestedCompanyId}`);
      console.log(`   Endpoint: ${req.method} ${req.path}`);
      console.log(`   IP: ${req.ip}`);
      console.log(`   User-Agent: ${req.get('User-Agent')}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);
      console.log(`   ---`);
      
      // TODO: En producción, enviar a sistema de monitoreo
      // TODO: Enviar alerta por email a administradores
    }

    // 🟡 WARNING: Usuario admin accediendo a datos específicos
    if (user.role === 'admin' && requestedCompanyId) {
      console.log(`🟡 [ADMIN ACCESS] Admin ${user.name} accessing company ${requestedCompanyId}`);
    }

    // 🟢 INFO: Acceso normal
    if (requestedCompanyId && user.companyId === requestedCompanyId) {
      console.log(`🟢 [NORMAL ACCESS] User ${user.name} accessing own company data`);
    }

    // Siempre continuar - NO bloquear
    next();
    
  } catch (error) {
    // Si hay error en el monitor, no afectar la funcionalidad
    console.error('[SECURITY MONITOR ERROR]:', error);
    next();
  }
}

/**
 * 🔒 RATE LIMITING MONITOR
 * 
 * Monitorea intentos de login sin bloquear
 */
export function loginMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip;
  const email = req.body?.email;
  
  // Log intentos de login
  console.log(`🔐 [LOGIN ATTEMPT] IP: ${ip}, Email: ${email}, Time: ${new Date().toISOString()}`);
  
  next();
}

/**
 * 🔒 FILE UPLOAD MONITOR
 * 
 * Monitorea subida de archivos
 */
export function uploadMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthRequest).user;
  const file = req.file;
  
  if (file) {
    console.log(`📁 [FILE UPLOAD] User: ${user?.name}, File: ${file.originalname}, Size: ${file.size} bytes`);
  }
  
  next();
}

/**
 * 🔒 API ACCESS MONITOR
 * 
 * Monitorea accesos a endpoints sensibles
 */
export function apiAccessMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthRequest).user;
  const endpoint = req.path;
  
  // Endpoints sensibles
  const sensitiveEndpoints = [
    '/api/users',
    '/api/companies',
    '/api/kpis',
    '/api/shipments',
    '/api/clients'
  ];
  
  if (sensitiveEndpoints.some(ep => endpoint.includes(ep))) {
    console.log(`🔍 [API ACCESS] User: ${user?.name}, Endpoint: ${endpoint}, Method: ${req.method}`);
  }
  
  next();
}
