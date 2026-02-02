/**
 * Tipos compartidos para el sistema de tarjetas KPI (dashboard).
 * Una sola fuente de verdad: frontend y backend usan estos tipos.
 */

// =============================================================================
// Tipo de tarjeta a mostrar (selector por kpiType en API)
// =============================================================================

export type KpiCardType = 'retention' | 'volume' | 'new_clients' | 'default';

/**
 * Mapea el tipo de KPI de ventas (backend) al tipo de tarjeta a renderizar.
 * Usar solo esta función para decidir qué tarjeta mostrar; no inferir por nombre.
 */
export function salesKpiTypeToCardType(salesKpiType: string): KpiCardType {
  switch (salesKpiType) {
    case 'retention':
      return 'retention';
    case 'volume':
      return 'volume';
    case 'new_clients':
      return 'new_clients';
    default:
      return 'default';
  }
}

// =============================================================================
// Umbrales de churn (una sola definición para todo el producto)
// =============================================================================

/** Días sin compra mínimos para considerar cliente "en riesgo" (3 meses). */
export const CHURN_AT_RISK_DAYS_MIN = 90;

/** Días sin compra mínimos para considerar cliente "crítico" (6 meses). */
export const CHURN_CRITICAL_DAYS_MIN = 180;

// =============================================================================
// Respuesta API: churn risk (GET /api/sales-churn-risk)
// =============================================================================

export interface ChurnRiskSummary {
  totalClients: number;
  /** Clientes con 90–179 días sin compra (en riesgo). */
  atRiskCount: number;
  /** Clientes con 180+ días sin compra (críticos). */
  criticalCount: number;
  warningCount?: number;
  lostCount?: number;
  newCount?: number;
  growingCount?: number;
  lostVolume?: number;
  atRiskVolume?: number;
}

export interface ChurnRiskResponse {
  companyId: number;
  currentYear: number;
  lastYear: number;
  summary: ChurnRiskSummary;
  clients: Record<string, unknown[]>;
  unit: string;
}

// =============================================================================
// Cumplimiento mensual (monthly achievement) — reutilizable para volumen y otros
// =============================================================================

export interface MonthlyAchievementMonth {
  period: string;
  achieved: boolean;
  value?: number;
  target?: number;
}

export interface MonthlyAchievement {
  achieved: number;
  total: number;
  byMonth?: MonthlyAchievementMonth[];
}
