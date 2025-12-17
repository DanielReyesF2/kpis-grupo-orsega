/**
 * ✅ API UTILITIES: Utilidades estandarizadas para la API
 *
 * Incluye:
 * - Paginación consistente
 * - Respuestas de error estandarizadas
 * - Helpers de validación
 */

import { Request, Response } from 'express';
import { z, ZodError } from 'zod';

// ========================================
// PAGINACIÓN
// ========================================

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Extrae parámetros de paginación del request
 */
export function getPaginationParams(
  req: Request,
  defaultLimit: number = 20,
  maxLimit: number = 100
): PaginationParams {
  let page = parseInt(req.query.page as string) || 1;
  let limit = parseInt(req.query.limit as string) || defaultLimit;

  // Validar bounds
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), maxLimit);

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Crea respuesta paginada con headers estándar
 */
export function paginatedResponse<T>(
  res: Response,
  data: T[],
  total: number,
  params: PaginationParams
): Response {
  const totalPages = Math.ceil(total / params.limit);
  const hasNext = params.page < totalPages;
  const hasPrev = params.page > 1;

  // Headers de paginación
  res.set({
    'X-Total-Count': total.toString(),
    'X-Page': params.page.toString(),
    'X-Per-Page': params.limit.toString(),
    'X-Total-Pages': totalPages.toString(),
  });

  return res.json({
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  });
}

// ========================================
// ERROR RESPONSES ESTANDARIZADOS
// ========================================

export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  statusCode: number;
}

export const ErrorCodes = {
  // 400 Bad Request
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  CSRF_ERROR: 'CSRF_ERROR',

  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // 409 Conflict
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  EMAIL_EXISTS: 'EMAIL_EXISTS',

  // 429 Too Many Requests
  RATE_LIMITED: 'RATE_LIMITED',

  // 500 Internal Server Error
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

/**
 * Envía respuesta de error estandarizada
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code?: string,
  details?: unknown
): Response {
  const error: ApiError = {
    error: getStatusText(statusCode),
    message,
    code,
    details,
    statusCode,
  };

  return res.status(statusCode).json(error);
}

/**
 * Helpers específicos por tipo de error
 */
export const ApiErrors = {
  badRequest: (res: Response, message: string, code?: string, details?: unknown) =>
    sendError(res, 400, message, code || ErrorCodes.INVALID_INPUT, details),

  unauthorized: (res: Response, message: string = 'No autorizado') =>
    sendError(res, 401, message, ErrorCodes.UNAUTHORIZED),

  forbidden: (res: Response, message: string = 'Acceso denegado') =>
    sendError(res, 403, message, ErrorCodes.FORBIDDEN),

  notFound: (res: Response, resource: string = 'Recurso') =>
    sendError(res, 404, `${resource} no encontrado`, ErrorCodes.NOT_FOUND),

  conflict: (res: Response, message: string, code?: string) =>
    sendError(res, 409, message, code || ErrorCodes.CONFLICT),

  rateLimited: (res: Response, retryAfter?: number) => {
    if (retryAfter) {
      res.set('Retry-After', retryAfter.toString());
    }
    return sendError(res, 429, 'Demasiadas solicitudes. Intenta más tarde.', ErrorCodes.RATE_LIMITED);
  },

  internal: (res: Response, message: string = 'Error interno del servidor') =>
    sendError(res, 500, message, ErrorCodes.INTERNAL_ERROR),

  validation: (res: Response, errors: z.ZodError | string[]) => {
    const details = errors instanceof ZodError
      ? errors.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      : errors;
    return sendError(res, 400, 'Error de validación', ErrorCodes.VALIDATION_ERROR, details);
  },
};

/**
 * Obtiene texto de status HTTP
 */
function getStatusText(statusCode: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[statusCode] || 'Error';
}

// ========================================
// WRAPPER PARA ASYNC HANDLERS
// ========================================

type AsyncHandler = (req: Request, res: Response) => Promise<void | Response>;

/**
 * Wrapper para manejar errores en handlers async
 */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      console.error('Unhandled error in route handler:', error);

      // Error de Zod
      if (error instanceof ZodError) {
        return ApiErrors.validation(res, error);
      }

      // Error genérico
      const message = process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : error.message || 'Error desconocido';

      return ApiErrors.internal(res, message);
    });
  };
}

// ========================================
// VALIDACIÓN DE PARÁMETROS
// ========================================

/**
 * Valida y parsea ID numérico de params
 */
export function parseId(id: string | undefined): number | null {
  if (!id) return null;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) || parsed < 1 ? null : parsed;
}

/**
 * Schema común para query params de lista
 */
export const listQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => parseInt(v || '20')),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});

/**
 * Respuesta de éxito estandarizada
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}
