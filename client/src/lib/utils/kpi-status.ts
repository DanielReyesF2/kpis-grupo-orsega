// Re-exportar desde el módulo compartido para mantener compatibilidad
// Las funciones centralizadas están en shared/kpi-utils.ts
import type { KpiStatus } from '@shared/kpi-utils';
import { 
  calculateKpiStatus as calculateKpiStatusShared,
  calculateCompliance as calculateComplianceShared,
  isLowerBetterKPI
} from '@shared/kpi-utils';

export type { KpiStatus };

/**
 * Determina el estado del KPI basado en el valor actual y objetivo
 * 
 * @param currentValue Valor actual del KPI
 * @param target Valor objetivo del KPI
 * @param kpiName Nombre del KPI (para determinar si es "lower is better")
 * @returns Estado del KPI
 * 
 * @deprecated Use calculateKpiStatusShared directamente. Esta función se mantiene para compatibilidad.
 */
export function calculateKpiStatus(
  currentValue: string | number | null,
  target: string | number | null,
  kpiName: string
): KpiStatus {
  return calculateKpiStatusShared(currentValue, target, kpiName);
}

/**
 * Calcula el porcentaje de cumplimiento de un KPI
 * @param currentValue Valor actual
 * @param target Valor objetivo
 * @param kpiName Nombre del KPI (para determinar si es "lower is better")
 * @returns Porcentaje de cumplimiento formateado (Ej: "95.5%")
 * 
 * @deprecated Use calculateComplianceShared directamente. Esta función se mantiene para compatibilidad.
 */
export function calculateCompliance(
  currentValue: string | number | null, 
  target: string | number | null, 
  kpiName: string
): string {
  return calculateComplianceShared(currentValue, target, kpiName);
}

// Re-exportar funciones compartidas
export { isLowerBetterKPI };

/**
 * Devuelve un texto descriptivo para el estado del KPI
 */
export function getStatusText(status: KpiStatus): string {
  switch (status) {
    case 'complies':
      return 'Cumple';
    case 'alert':
      return 'Alerta';
    case 'not_compliant':
      return 'No Cumple';
    default:
      return 'Desconocido';
  }
}

/**
 * Devuelve un color basado en el estado del KPI
 */
export function getStatusColor(status: KpiStatus): string {
  switch (status) {
    case 'complies':
      return '#10b981'; // green-500
    case 'alert':
      return '#f59e0b'; // yellow-500
    case 'not_compliant':
      return '#ef4444'; // red-500
    default:
      return '#9ca3af'; // gray-400
  }
}