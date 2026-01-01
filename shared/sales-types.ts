/**
 * Tipos TypeScript para el módulo de métricas de ventas
 * Estos tipos son compartidos entre backend y frontend
 */

/**
 * Tipo de período de tiempo para análisis de métricas
 */
export type PeriodType = 'month' | '3months' | 'year' | 'custom';

/**
 * Interfaz para definir un período de tiempo
 */
export interface Period {
  type: PeriodType;
  startDate?: Date;
  endDate?: Date;
  year?: number;
  month?: number; // 1-12
}

/**
 * Métricas de clientes activos
 */
export interface ActiveClientsMetrics {
  /** Clientes activos en el mes actual */
  thisMonth: number;
  /** Clientes activos en los últimos 3 meses (90 días) */
  last3Months: number;
}

/**
 * Métricas de retención de clientes
 */
export interface RetentionMetrics {
  /** Tasa de retención en porcentaje (0-100) */
  rate: number;
  /** Número de clientes en el período actual */
  currentPeriodClients: number;
  /** Número de clientes en el período anterior */
  previousPeriodClients: number;
  /** Número de clientes que se mantuvieron activos en ambos períodos */
  retainedClients: number;
}

/**
 * Información de un nuevo cliente
 */
export interface NewClient {
  id: number;
  name: string;
  firstPurchaseDate: Date;
}

/**
 * Métricas de nuevos clientes
 */
export interface NewClientsMetrics {
  /** Cantidad de nuevos clientes en el período */
  count: number;
  /** Lista de nuevos clientes con información básica */
  clients: NewClient[];
}

/**
 * Información de un cliente que abandonó (churn)
 */
export interface ChurnedClient {
  id: number;
  name: string;
  lastPurchaseDate: Date;
}

/**
 * Métricas de clientes perdidos (churn)
 */
export interface ChurnMetrics {
  /** Cantidad de clientes perdidos */
  count: number;
  /** Tasa de churn en porcentaje (0-100) */
  rate: number;
  /** Lista de clientes que abandonaron */
  clients: ChurnedClient[];
}

/**
 * Métricas completas de ventas
 * Esta es la interfaz principal que retorna el endpoint /api/sales-stats
 */
export interface SalesMetrics {
  // Métricas existentes (mantener para backward compatibility)
  /** Clientes activos este mes (legacy - usar activeClientsMetrics.thisMonth) */
  activeClients: number;
  /** Volumen total del mes actual */
  currentVolume: number;
  /** Unidad de medida (KG, unidades, etc.) */
  unit: string;
  /** Crecimiento porcentual vs mismo período año anterior */
  growth: number;
  /** Cantidad de alertas activas */
  activeAlerts: number;
  
  // Nuevas métricas
  /** Métricas detalladas de clientes activos */
  activeClientsMetrics: ActiveClientsMetrics;
  /** Métricas de retención de clientes */
  retentionRate: RetentionMetrics;
  /** Métricas de nuevos clientes */
  newClients: NewClientsMetrics;
  /** Valor promedio por orden/transacción */
  avgOrderValue: number;
  /** Métricas de clientes perdidos (churn) */
  clientChurn: ChurnMetrics;
  
  /** Número de meses que están bajo el promedio mensual del año actual */
  monthsBelowAverage: number;
  /** Porcentaje de rentabilidad/margen bruto */
  profitability: number;
  
  // Metadata
  /** Información del período analizado */
  period: {
    current: Period;
    previous?: Period;
  };
  /** Fecha y hora en que se calcularon las métricas */
  calculatedAt: Date;
}

/**
 * Opciones para calcular métricas
 */
export interface SalesMetricsOptions {
  /** ID de la empresa (1 = Dura, 2 = Orsega) */
  companyId: number;
  /** Período actual a analizar (opcional, por defecto mes actual) */
  currentPeriod?: Period;
  /** Período anterior para comparación (opcional, por defecto mes anterior) */
  previousPeriod?: Period;
  /** Incluir listas detalladas de clientes (nuevos, churn) */
  includeClientDetails?: boolean;
}

