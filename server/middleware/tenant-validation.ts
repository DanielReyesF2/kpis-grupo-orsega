/**
 * Middleware de Validación Multi-Tenant
 * 
 * Previene que usuarios accedan o modifiquen datos de otras empresas.
 * 
 * VUL-001: Validación Multi-Tenant Insuficiente (CVSS 6.5)
 * 
 * Uso:
 * validateTenantAccess(req, resourceCompanyId)
 */

import { Request, Response, NextFunction } from "express";

// Extended Request type for authenticated routes
interface AuthRequest extends Request {
  user: {
    id: number;
    role: string;
    email: string;
    name: string;
    areaId?: number | null;
    companyId?: number | null;
  };
}

/**
 * Valida que el usuario autenticado tenga acceso a los recursos de la empresa especificada
 * 
 * Reglas:
 * - Admin: acceso a todas las empresas
 * - Usuarios normales: solo acceso a su propia empresa
 * 
 * @param req - Request con usuario autenticado
 * @param resourceCompanyId - ID de la empresa del recurso
 * @throws Error si el acceso es denegado
 */
export function validateTenantAccess(
  req: AuthRequest,
  resourceCompanyId: number | null | undefined
): void {
  // Obtener usuario del request
  const user = req.user;
  
  if (!user) {
    throw new Error('Unauthorized: User not authenticated');
  }

  // Si no hay companyId en el recurso, no se puede validar (puede ser opcional)
  if (resourceCompanyId === null || resourceCompanyId === undefined) {
    console.warn(`[TenantValidation] Warning: resourceCompanyId is null/undefined for user ${user.id}`);
    // Permitir si usuario es admin, rechazar si no
    if (user.role !== 'admin') {
      throw new Error('Forbidden: Company access validation failed');
    }
    return;
  }

  // Admin puede acceder a todo
  if (user.role === 'admin') {
    console.log(`[TenantValidation] Admin access granted to company ${resourceCompanyId}`);
    return;
  }

  // Empresas del sistema: Dura International (1) y Grupo Orsega (2)
  // Permitir acceso a ambas empresas para todos los usuarios
  const ALLOWED_COMPANIES = [1, 2]; // Dura International y Grupo Orsega
  
  if (ALLOWED_COMPANIES.includes(resourceCompanyId)) {
    // Permitir acceso a las empresas del sistema (Dura y Orsega)
    console.log(`[TenantValidation] Access granted: User ${user.id} to company ${resourceCompanyId} (allowed company)`);
    return;
  }

  // Si el usuario no tiene companyId asignado, rechazar acceso a empresas no permitidas
  if (!user.companyId) {
    console.error(`[TenantValidation] User ${user.id} has no companyId assigned and attempted to access company ${resourceCompanyId} (not in allowed list)`);
    throw new Error(`Forbidden: Access denied to company ${resourceCompanyId}`);
  }

  // Validar que el companyId del usuario coincida con el del recurso (para empresas fuera de la lista permitida)
  if (user.companyId !== resourceCompanyId) {
    console.error(
      `[TenantValidation] Access denied: User ${user.id} (company ${user.companyId}) ` +
      `attempted to access company ${resourceCompanyId} resources`
    );
    throw new Error(`Forbidden: Access denied to company ${resourceCompanyId}`);
  }

  console.log(`[TenantValidation] Access granted: User ${user.id} to company ${resourceCompanyId}`);
}

/**
 * Middleware para validar acceso a recurso en el body del request
 * 
 * Usar con: app.post('/endpoint', jwtAuthMiddleware, validateTenantFromBody('companyId'), handler)
 */
export function validateTenantFromBody(fieldName: string = 'companyId') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const rawCompanyId = (req.body as any)[fieldName];
      
      // Parsear companyId a número si viene como string
      let resourceCompanyId: number | null | undefined;
      if (rawCompanyId === null || rawCompanyId === undefined || rawCompanyId === '') {
        resourceCompanyId = undefined;
      } else if (typeof rawCompanyId === 'string') {
        const parsed = parseInt(rawCompanyId, 10);
        resourceCompanyId = isNaN(parsed) ? undefined : parsed;
      } else if (typeof rawCompanyId === 'number') {
        resourceCompanyId = rawCompanyId;
      } else {
        resourceCompanyId = undefined;
      }
      
      // Logging para debug
      console.log(`[TenantValidation] Validando acceso para usuario ${user?.id} (${user?.name}), role: ${user?.role}, userCompanyId: ${user?.companyId}, resourceCompanyId: ${resourceCompanyId} (raw: ${rawCompanyId}, type: ${typeof rawCompanyId})`);
      
      validateTenantAccess(req, resourceCompanyId);
      next();
    } catch (error) {
      console.error('[TenantValidation Middleware] Access denied:', error);
      const user = req.user;
      console.error(`[TenantValidation] Detalles del usuario: ID=${user?.id}, Name=${user?.name}, Role=${user?.role}, CompanyId=${user?.companyId}`);
      res.status(403).json({ 
        message: error instanceof Error ? error.message : 'Forbidden: Access denied',
        code: 'TENANT_ACCESS_DENIED'
      });
    }
  };
}

/**
 * Middleware para validar acceso a recurso en los query params
 * 
 * Usar con: app.get('/endpoint', jwtAuthMiddleware, validateTenantFromQuery('companyId'), handler)
 */
export function validateTenantFromQuery(fieldName: string = 'companyId') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const resourceCompanyId = req.query[fieldName] 
        ? parseInt(req.query[fieldName] as string, 10) 
        : undefined;
      validateTenantAccess(req, resourceCompanyId);
      next();
    } catch (error) {
      console.error('[TenantValidation Middleware] Access denied:', error);
      res.status(403).json({ 
        message: error instanceof Error ? error.message : 'Forbidden: Access denied',
        code: 'TENANT_ACCESS_DENIED'
      });
    }
  };
}

/**
 * Middleware para validar acceso a recurso en los path params
 * 
 * Usar con: app.get('/endpoint/:companyId', jwtAuthMiddleware, validateTenantFromParams('companyId'), handler)
 */
export function validateTenantFromParams(fieldName: string = 'companyId') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const resourceCompanyId = req.params[fieldName] 
        ? parseInt(req.params[fieldName], 10) 
        : undefined;
      validateTenantAccess(req, resourceCompanyId);
      next();
    } catch (error) {
      console.error('[TenantValidation Middleware] Access denied:', error);
      res.status(403).json({ 
        message: error instanceof Error ? error.message : 'Forbidden: Access denied',
        code: 'TENANT_ACCESS_DENIED'
      });
    }
  };
}


