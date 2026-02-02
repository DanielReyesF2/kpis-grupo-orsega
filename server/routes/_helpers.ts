import type { Request } from 'express';
import { neon } from '@neondatabase/serverless';
import NodeCache from 'node-cache';
import { storage, type IStorage } from '../storage';
import { calculateKpiStatus } from '@shared/kpi-utils';
import { logger } from '../logger';
import type { Kpi } from '@shared/schema';

// Extended Request type for authenticated routes
export interface AuthRequest extends Request {
  user: {
    id: number;
    role: string;
    email: string;
    name: string;
    areaId?: number | null;
    companyId?: number | null;
  };
}

// Helper to get authenticated user with proper type narrowing
export function getAuthUser(req: AuthRequest): NonNullable<AuthRequest['user']> {
  if (!req.user) {
    throw new Error('Unauthorized');
  }
  return req.user;
}

// Security helpers: Remove sensitive data from user objects
interface UserWithPassword {
  password?: string;
  [key: string]: unknown;
}

export function sanitizeUser<T extends UserWithPassword>(user: T): Omit<T, 'password'> {
  if (!user) return user;
  const { password, ...safeUser } = user;
  return safeUser;
}

export function sanitizeUsers<T extends UserWithPassword>(users: T[]): Array<Omit<T, 'password'>> {
  return users.map(sanitizeUser);
}

// Security helper: Redact sensitive data from logs
export function redactSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitive = ['password', 'token', 'authorization', 'apiKey', 'secret', 'jwt'];
  const result: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      (result as Record<string, unknown>)[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      (result as Record<string, unknown>)[key] = redactSensitiveData(value);
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

// Database connection for raw SQL queries
export const sql = neon(process.env.DATABASE_URL!);

// Cache for collaborator performance data (5 minute TTL)
export const collaboratorPerformanceCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Función para crear notificaciones automáticas en cambios de estado críticos
export async function createKPIStatusChangeNotification(
  kpi: Pick<Kpi, 'id' | 'name' | 'companyId' | 'areaId'>,
  user: { id: number; name: string; email: string },
  previousStatus: string,
  newStatus: string,
  storageInstance: IStorage
) {
  try {
    // Solo notificar en cambios críticos
    const criticalChanges = [
      { from: 'complies', to: 'not_compliant' },
      { from: 'alert', to: 'not_compliant' },
      { from: 'not_compliant', to: 'complies' }
    ];

    const isCriticalChange = criticalChanges.some(change =>
      change.from === previousStatus && change.to === newStatus
    );

    if (isCriticalChange) {
      const statusMap: Record<'complies' | 'alert' | 'not_compliant', string> = {
        'complies': 'En cumplimiento',
        'alert': 'En alerta',
        'not_compliant': 'No cumple'
      };

      const notification = {
        fromUserId: user.id,
        toUserId: user.id,
        title: `Cambio de estado en KPI: ${kpi.name}`,
        message: `El KPI "${kpi.name}" ha cambiado de "${statusMap[previousStatus as keyof typeof statusMap]}" a "${statusMap[newStatus as keyof typeof statusMap]}"`,
        type: newStatus === 'complies' ? 'success' : 'warning',
        companyId: kpi.companyId ?? null,
        areaId: kpi.areaId ?? null,
      };

      await storageInstance.createNotification(notification);
      logger.info(`[KPI Notification] Notificación creada para cambio de estado: ${kpi.name}`, { kpiId: kpi.id, userId: user.id });
    }
  } catch (error) {
      logger.error('Error creating KPI status change notification', error);
  }
}

/**
 * KPIs de Logística: Actualizar automáticamente los KPIs de logística basados en shipments
 */
export async function updateLogisticsKPIs(companyId: number) {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log(`[KPI Logística] Actualizando KPIs para company ${companyId}, período: ${firstDayOfMonth.toISOString()} - ${lastDayOfMonth.toISOString()}`);

    const monthlyShipments = await sql`
      SELECT * FROM shipments
      WHERE company_id = ${companyId}
      AND status = 'delivered'
      AND delivered_at >= ${firstDayOfMonth.toISOString()}
      AND delivered_at <= ${lastDayOfMonth.toISOString()}
    `;

    console.log(`[KPI Logística] Envíos entregados este mes: ${monthlyShipments.length}`);

    if (monthlyShipments.length === 0) {
      console.log(`[KPI Logística] No hay envíos entregados este mes, usando valores en 0`);
    }

    const transportCosts = monthlyShipments
      .filter((s: any) => s.transportCost && parseFloat(s.transportCost.toString()) > 0)
      .map((s: any) => parseFloat(s.transportCost!.toString()));

    const avgTransportCost = transportCosts.length > 0
      ? transportCosts.reduce((a: number, b: number) => a + b, 0) / transportCosts.length
      : 0;

    const preparationTimes = monthlyShipments
      .filter((s: any) => s.createdAt && s.inRouteAt)
      .map((s: any) => {
        const created = new Date(s.createdAt!);
        const inRoute = new Date(s.inRouteAt!);
        return (inRoute.getTime() - created.getTime()) / (1000 * 60 * 60);
      });

    const avgPreparationTime = preparationTimes.length > 0
      ? preparationTimes.reduce((a: number, b: number) => a + b, 0) / preparationTimes.length
      : 0;

    const deliveryTimes = monthlyShipments
      .filter((s: any) => s.inRouteAt && s.deliveredAt)
      .map((s: any) => {
        const inRoute = new Date(s.inRouteAt!);
        const delivered = new Date(s.deliveredAt!);
        return (delivered.getTime() - inRoute.getTime()) / (1000 * 60 * 60);
      });

    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((a: number, b: number) => a + b, 0) / deliveryTimes.length
      : 0;

    const kpiUpdates = [
      { name: 'Costo de Transporte', value: avgTransportCost.toFixed(2), goal: 5000 },
      { name: 'Tiempo de Preparación', value: avgPreparationTime.toFixed(2), goal: 24 },
      { name: 'Tiempo de Entrega', value: avgDeliveryTime.toFixed(2), goal: 48 }
    ];

    const allCompanyKpis = await storage.getKpis(companyId);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    for (const kpiUpdate of kpiUpdates) {
      const kpi = allCompanyKpis.find((k: any) => k.name === kpiUpdate.name);

      if (!kpi) {
        console.log(`[KPI Logística] ⚠️  KPI "${kpiUpdate.name}" no encontrado para company ${companyId}, omitiendo...`);
        continue;
      }

      const kpiGoal = parseFloat(kpi.goal?.toString() || kpiUpdate.goal.toString());
      const actualValue = parseFloat(kpiUpdate.value);

      let compliancePercentage: number;
      if (actualValue === 0) {
        compliancePercentage = 100;
      } else {
        compliancePercentage = Math.min((kpiGoal / actualValue) * 100, 100);
      }

      await storage.createKpiValue({
        kpiId: kpi.id,
        companyId: companyId as 1 | 2,
        value: kpiUpdate.value,
        compliancePercentage: compliancePercentage.toFixed(2),
        status: calculateKpiStatus(parseFloat(kpiUpdate.value), kpiGoal, kpiUpdate.name),
        period: `${monthNames[now.getMonth()]} ${now.getFullYear()}`
      });

      console.log(`[KPI Logística] ✅ KPI "${kpiUpdate.name}" actualizado: ${kpiUpdate.value} (compliance: ${compliancePercentage.toFixed(2)}%)`);
    }

    collaboratorPerformanceCache.flushAll();
    console.log(`[KPI Logística] ✅ Actualización completa para company ${companyId}`);
  } catch (error) {
    console.error('[KPI Logística] ❌ Error actualizando KPIs:', error);
    throw error;
  }
}
