/**
 * Middleware de Validación Multi-Tenant
 *
 * CONTEXTO DE NEGOCIO:
 * Este sistema es para un GRUPO EMPRESARIAL INTERNO (Dura International + Grupo Orsega).
 * El mismo equipo de 9 personas opera AMBAS empresas con acceso cruzado completo.
 *
 * NO es un SaaS multi-tenant con clientes externos aislados.
 * El acceso cruzado entre empresas 1 y 2 es INTENCIONAL y REQUERIDO.
 *
 * Reglas de Acceso:
 * - Admin: acceso a todas las empresas
 * - Usuarios del grupo: acceso a Dura (1) y Orsega (2) - ACCESO CRUZADO PERMITIDO
 * - Usuarios externos (si existen): solo su propia empresa
 *
 * @see ALLOWED_COMPANIES para empresas del grupo con acceso cruzado
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
 * Reglas para Grupo Empresarial:
 * - Admin: acceso a todas las empresas
 * - Usuarios del grupo (empresas 1 y 2): acceso cruzado completo entre Dura y Orsega
 * - Usuarios externos: solo acceso a su propia empresa
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

  // ✅ ACCESO CRUZADO INTENCIONAL - Grupo Empresarial Interno
  // Dura International (ID:1) y Grupo Orsega (ID:2) son el mismo equipo operativo
  // El equipo de 9 personas trabaja en AMBAS empresas con total flexibilidad
  // Este NO es un bug de seguridad - es un requerimiento del negocio
  const ALLOWED_COMPANIES = [1, 2]; // Dura International y Grupo Orsega

  if (ALLOWED_COMPANIES.includes(resourceCompanyId)) {
    // INTENCIONAL: Permitir acceso cruzado entre empresas del grupo
    console.log(`[TenantValidation] ✅ Cross-company access granted: User ${user.id} to company ${resourceCompanyId} (internal group)`);
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
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
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

      validateTenantAccess(authReq, resourceCompanyId);
      next();
    } catch (error) {
      console.error('[TenantValidation Middleware] Access denied:', error);
      const authReq = req as AuthRequest;
      const user = authReq.user;
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
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const resourceCompanyId = req.query[fieldName]
        ? parseInt(req.query[fieldName] as string, 10)
        : undefined;
      validateTenantAccess(authReq, resourceCompanyId);
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
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const resourceCompanyId = req.params[fieldName]
        ? parseInt(req.params[fieldName], 10)
        : undefined;
      validateTenantAccess(authReq, resourceCompanyId);
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


