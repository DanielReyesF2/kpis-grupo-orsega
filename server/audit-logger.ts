/**
 * ✅ AUDIT LOGGING: Sistema de registro de auditoría
 *
 * Registra acciones importantes para cumplimiento y seguridad:
 * - Autenticación (login, logout, fallos)
 * - Cambios de datos (CRUD)
 * - Acciones administrativas
 * - Accesos a recursos sensibles
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

// Tipos de eventos de auditoría
export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'KPI_CREATE'
  | 'KPI_UPDATE'
  | 'KPI_DELETE'
  | 'KPI_VALUE_UPDATE'
  | 'PAYMENT_VOUCHER_CREATE'
  | 'PAYMENT_VOUCHER_UPDATE'
  | 'PAYMENT_VOUCHER_DELETE'
  | 'SHIPMENT_CREATE'
  | 'SHIPMENT_UPDATE'
  | 'CLIENT_CREATE'
  | 'CLIENT_UPDATE'
  | 'CLIENT_DELETE'
  | 'SALE_IMPORT'
  | 'ADMIN_ACTION'
  | 'ACCESS_DENIED'
  | 'RATE_LIMIT_EXCEEDED';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: number;
  userEmail?: string;
  resourceType?: string;
  resourceId?: number | string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

// Cola de logs para batch insert (mejora rendimiento)
const logQueue: AuditLogEntry[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5 segundos
const MAX_QUEUE_SIZE = 100;

/**
 * Inicializa la tabla de audit logs si no existe
 */
export async function initAuditLogTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        user_id INTEGER,
        user_email VARCHAR(320),
        resource_type VARCHAR(100),
        resource_id VARCHAR(100),
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Índices para consultas comunes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id)
    `);

    console.log('✅ Audit log table initialized');
  } catch (error) {
    console.error('⚠️ Error initializing audit log table:', error);
  }
}

/**
 * Registra un evento de auditoría
 */
export function auditLog(entry: AuditLogEntry): void {
  // Agregar timestamp
  const logEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Agregar a la cola
  logQueue.push(logEntry);

  // Flush si la cola está llena
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    flushLogs();
  }

  // Iniciar timer de flush si no existe
  if (!flushTimer) {
    flushTimer = setTimeout(flushLogs, FLUSH_INTERVAL);
  }
}

/**
 * Escribe los logs pendientes a la base de datos
 */
async function flushLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (logQueue.length === 0) return;

  // Copiar y limpiar la cola
  const logsToWrite = [...logQueue];
  logQueue.length = 0;

  try {
    // Batch insert
    for (const log of logsToWrite) {
      await db.execute(sql`
        INSERT INTO audit_logs (
          action, user_id, user_email, resource_type, resource_id,
          details, ip_address, user_agent, success, error_message
        ) VALUES (
          ${log.action},
          ${log.userId || null},
          ${log.userEmail || null},
          ${log.resourceType || null},
          ${log.resourceId?.toString() || null},
          ${JSON.stringify(log.details || {})},
          ${log.ipAddress || null},
          ${log.userAgent || null},
          ${log.success},
          ${log.errorMessage || null}
        )
      `);
    }
  } catch (error) {
    console.error('⚠️ Error writing audit logs:', error);
    // En caso de error, mantener los logs en memoria (se perderían al reiniciar)
    // En producción, considerar escribir a archivo como fallback
  }
}

/**
 * Fuerza el flush de logs pendientes (útil antes de shutdown)
 */
export async function flushAuditLogs(): Promise<void> {
  await flushLogs();
}

/**
 * Helper para obtener IP del request
 */
export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

/**
 * Helper para crear entrada de audit desde request
 */
export function createAuditEntry(
  req: { ip?: string; headers: Record<string, string | string[] | undefined>; user?: { id: number; email: string } },
  action: AuditAction,
  options: Partial<AuditLogEntry> = {}
): AuditLogEntry {
  return {
    action,
    userId: req.user?.id,
    userEmail: req.user?.email,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] as string | undefined,
    success: true,
    ...options,
  };
}

// ========================================
// AUDIT LOG HELPERS POR CATEGORÍA
// ========================================

/**
 * Registra evento de autenticación
 */
export function auditAuth(
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT',
  email: string,
  ipAddress: string,
  userAgent?: string,
  userId?: number,
  errorMessage?: string
): void {
  auditLog({
    action,
    userId,
    userEmail: email,
    ipAddress,
    userAgent,
    success: action === 'LOGIN_SUCCESS' || action === 'LOGOUT',
    errorMessage,
  });
}

/**
 * Registra cambio de contraseña
 */
export function auditPasswordChange(
  userId: number,
  userEmail: string,
  ipAddress: string,
  isReset: boolean = false
): void {
  auditLog({
    action: isReset ? 'PASSWORD_RESET' : 'PASSWORD_CHANGE',
    userId,
    userEmail,
    ipAddress,
    success: true,
  });
}

/**
 * Registra operación CRUD
 */
export function auditCrud(
  action: AuditAction,
  userId: number,
  userEmail: string,
  resourceType: string,
  resourceId: number | string,
  details?: Record<string, unknown>
): void {
  auditLog({
    action,
    userId,
    userEmail,
    resourceType,
    resourceId,
    details,
    success: true,
  });
}

/**
 * Registra acceso denegado
 */
export function auditAccessDenied(
  userId: number | undefined,
  userEmail: string | undefined,
  ipAddress: string,
  resource: string,
  reason: string
): void {
  auditLog({
    action: 'ACCESS_DENIED',
    userId,
    userEmail,
    resourceType: resource,
    ipAddress,
    success: false,
    errorMessage: reason,
  });
}

// Exportar flush para shutdown graceful
process.on('beforeExit', async () => {
  await flushAuditLogs();
});

process.on('SIGINT', async () => {
  await flushAuditLogs();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await flushAuditLogs();
  process.exit(0);
});
