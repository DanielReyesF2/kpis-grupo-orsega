/**
 * Tipos TypeScript para el módulo de ventas en el frontend
 * Re-exporta tipos de shared/sales-types.ts y agrega tipos específicos de UI
 */

// Re-exportar todos los tipos del backend
export type {
  PeriodType,
  Period,
  ActiveClientsMetrics,
  RetentionMetrics,
  NewClient,
  NewClientsMetrics,
  ChurnedClient,
  ChurnMetrics,
  SalesMetrics
} from '@shared/sales-types';

// Importar para uso interno en este archivo
import type { SalesMetrics, Period } from '@shared/sales-types';

/**
 * Props para componentes de métricas de ventas
 */
export interface SalesMetricCardProps {
  /** Título de la métrica */
  title: string;
  /** Valor principal a mostrar */
  value: string | number;
  /** Subtítulo o descripción */
  subtitle?: string;
  /** Indicador de tendencia (opcional) */
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /** Estado de carga */
  isLoading?: boolean;
  /** Color del tema de la card */
  themeColor?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

/**
 * Estado de carga de métricas
 */
export interface SalesMetricsState {
  isLoading: boolean;
  error: string | null;
  data: SalesMetrics | null;
}

/**
 * Opciones para filtrar métricas
 */
export interface SalesMetricsFilters {
  companyId: number;
  period?: Period;
  includeDetails?: boolean;
}

