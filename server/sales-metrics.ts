/**
 * Módulo de métricas de ventas
 * Calcula todas las métricas de ventas basándose en datos históricos de sales_data
 * 
 * Patrón: Similar a fx-analytics.ts - funciones async exportadas con documentación JSDoc
 */

import { neon } from '@neondatabase/serverless';
import type {
  SalesMetrics,
  ActiveClientsMetrics,
  RetentionMetrics,
  NewClientsMetrics,
  ChurnMetrics,
  Period,
  NewClient,
  ChurnedClient
} from '@shared/sales-types';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Calcula las fechas de inicio y fin para un período dado
 * @param period - Período a calcular
 * @returns Objeto con fechas de inicio y fin
 */
function calculatePeriodDates(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period.type) {
    case 'month':
      if (period.year && period.month) {
        start.setFullYear(period.year, period.month - 1, 1);
        end.setFullYear(period.year, period.month, 0, 23, 59, 59, 999);
      } else {
        // Mes actual
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
      }
      break;

    case '3months':
      // Últimos 90 días
      start.setTime(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end.setTime(now.getTime());
      end.setHours(23, 59, 59, 999);
      break;

    case 'year':
      if (period.year) {
        start.setFullYear(period.year, 0, 1);
        end.setFullYear(period.year, 11, 31, 23, 59, 59, 999);
      } else {
        // Año actual
        start.setFullYear(now.getFullYear(), 0, 1);
        end.setFullYear(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      }
      break;

    case 'custom':
      if (period.startDate && period.endDate) {
        start.setTime(period.startDate.getTime());
        end.setTime(period.endDate.getTime());
        end.setHours(23, 59, 59, 999);
      } else {
        throw new Error('Custom period requires startDate and endDate');
      }
      break;

    default:
      throw new Error(`Unknown period type: ${period.type}`);
  }

  return { start, end };
}

/**
 * Calcula clientes activos para un período específico
 * 
 * @param companyId - ID de la empresa (1 = Dura, 2 = Orsega)
 * @param period - Período a analizar ('month' para mes actual, '3months' para últimos 90 días)
 * @returns Número de clientes activos únicos
 * 
 * @example
 * const active = await getActiveClients(1, 'month');
 * const active3Months = await getActiveClients(1, '3months');
 */
export async function getActiveClients(
  companyId: number,
  period: 'month' | '3months'
): Promise<number> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let query: string;
  let params: any[];

  if (period === 'month') {
    // Buscar en el mes actual, pero si no hay datos, buscar en el último mes con datos
    query = `
      SELECT COUNT(DISTINCT client_id) as count
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $2
        AND sale_month = $3
        AND client_id IS NOT NULL
    `;
    params = [companyId, currentYear, currentMonth];
    
    const result = await sql(query, params);
    const count = parseInt(result[0]?.count || '0', 10);
    
    // Si no hay datos en el mes actual, buscar en el último mes con datos
    if (count === 0) {
      const lastMonthQuery = `
        SELECT COUNT(DISTINCT client_id) as count
        FROM sales_data
        WHERE company_id = $1
          AND client_id IS NOT NULL
          AND sale_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY sale_date DESC
        LIMIT 1
      `;
      const lastMonthResult = await sql(lastMonthQuery, [companyId]);
      return parseInt(lastMonthResult[0]?.count || '0', 10);
    }
    
    return count;
  } else {
    // Últimos 3 meses (90 días) - usar sale_date para datos históricos
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
    
    query = `
      SELECT COUNT(DISTINCT client_id) as count
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $2
        AND sale_date <= $3
        AND client_id IS NOT NULL
    `;
    params = [companyId, threeMonthsAgo.toISOString().split('T')[0], now.toISOString().split('T')[0]];
    
    const result = await sql(query, params);
    return parseInt(result[0]?.count || '0', 10);
  }
}

/**
 * Calcula métricas de clientes activos (este mes y últimos 3 meses)
 * 
 * @param companyId - ID de la empresa
 * @returns Métricas de clientes activos
 */
export async function getActiveClientsMetrics(
  companyId: number
): Promise<ActiveClientsMetrics> {
  const thisMonth = await getActiveClients(companyId, 'month');
  const last3Months = await getActiveClients(companyId, '3months');

  return {
    thisMonth,
    last3Months
  };
}

/**
 * Calcula la tasa de retención de clientes entre dos períodos
 * 
 * @param companyId - ID de la empresa (1 = Dura, 2 = Orsega)
 * @param currentPeriod - Período actual a analizar
 * @param previousPeriod - Período anterior para comparar
 * @returns Métricas de retención incluyendo tasa, conteos y clientes retenidos
 * 
 * @example
 * const retention = await getRetentionRate(1, 
 *   { type: 'month', year: 2025, month: 11 },
 *   { type: 'month', year: 2025, month: 10 }
 * );
 */
export async function getRetentionRate(
  companyId: number,
  currentPeriod: Period,
  previousPeriod: Period
): Promise<RetentionMetrics> {
  const currentDates = calculatePeriodDates(currentPeriod);
  const previousDates = calculatePeriodDates(previousPeriod);

  // Query optimizada para calcular retención
  const query = `
    WITH current_period_clients AS (
      SELECT DISTINCT client_id
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $2
        AND sale_date <= $3
        AND client_id IS NOT NULL
    ),
    previous_period_clients AS (
      SELECT DISTINCT client_id
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $4
        AND sale_date <= $5
        AND client_id IS NOT NULL
    ),
    retained_clients AS (
      SELECT DISTINCT c.client_id
      FROM current_period_clients c
      INNER JOIN previous_period_clients p ON c.client_id = p.client_id
    )
    SELECT 
      (SELECT COUNT(*) FROM current_period_clients) as current_count,
      (SELECT COUNT(*) FROM previous_period_clients) as previous_count,
      (SELECT COUNT(*) FROM retained_clients) as retained_count
  `;

  const result = await sql(query, [
    companyId,
    currentDates.start.toISOString().split('T')[0],
    currentDates.end.toISOString().split('T')[0],
    previousDates.start.toISOString().split('T')[0],
    previousDates.end.toISOString().split('T')[0]
  ]);

  const currentCount = parseInt(result[0]?.current_count || '0', 10);
  const previousCount = parseInt(result[0]?.previous_count || '0', 10);
  const retainedCount = parseInt(result[0]?.retained_count || '0', 10);

  // Calcular tasa de retención (evitar división por cero)
  const rate = previousCount > 0
    ? (retainedCount / previousCount) * 100
    : 0;

  return {
    rate: parseFloat(rate.toFixed(2)),
    currentPeriodClients: currentCount,
    previousPeriodClients: previousCount,
    retainedClients: retainedCount
  };
}

/**
 * Calcula nuevos clientes en un período (clientes cuya primera compra fue en ese período)
 * 
 * @param companyId - ID de la empresa
 * @param period - Período a analizar
 * @returns Métricas de nuevos clientes con lista de clientes
 */
export async function getNewClients(
  companyId: number,
  period: Period
): Promise<NewClientsMetrics> {
  const dates = calculatePeriodDates(period);

  const query = `
    WITH first_purchases AS (
      SELECT 
        client_id,
        client_name,
        MIN(sale_date) as first_purchase_date
      FROM sales_data
      WHERE company_id = $1
        AND client_id IS NOT NULL
      GROUP BY client_id, client_name
    ),
    new_clients AS (
      SELECT 
        fp.client_id,
        fp.client_name,
        fp.first_purchase_date
      FROM first_purchases fp
      WHERE fp.first_purchase_date >= $2
        AND fp.first_purchase_date <= $3
    )
    SELECT 
      client_id as id,
      client_name as name,
      first_purchase_date as "firstPurchaseDate"
    FROM new_clients
    ORDER BY first_purchase_date DESC
  `;

  const result = await sql(query, [
    companyId,
    dates.start.toISOString().split('T')[0],
    dates.end.toISOString().split('T')[0]
  ]);

  const clients: NewClient[] = result.map((row: any) => ({
    id: parseInt(row.id, 10),
    name: row.name,
    firstPurchaseDate: new Date(row.firstPurchaseDate)
  }));

  return {
    count: clients.length,
    clients
  };
}

/**
 * Calcula el valor promedio por orden/transacción
 * 
 * @param companyId - ID de la empresa
 * @param period - Período a analizar
 * @returns Valor promedio por orden (en la moneda de total_amount)
 */
export async function getAvgOrderValue(
  companyId: number,
  period: Period
): Promise<number> {
  const dates = calculatePeriodDates(period);

  const query = `
    SELECT AVG(total_amount) as avg_value
    FROM sales_data
    WHERE company_id = $1
      AND sale_date >= $2
      AND sale_date <= $3
      AND total_amount IS NOT NULL
      AND total_amount > 0
  `;

  const result = await sql(query, [
    companyId,
    dates.start.toISOString().split('T')[0],
    dates.end.toISOString().split('T')[0]
  ]);

  const avgValue = parseFloat(result[0]?.avg_value || '0');
  return parseFloat(avgValue.toFixed(2));
}

/**
 * Calcula métricas de clientes perdidos (churn)
 * Clientes que estaban activos en el período anterior pero no en el actual
 * 
 * @param companyId - ID de la empresa
 * @param currentPeriod - Período actual
 * @param previousPeriod - Período anterior
 * @returns Métricas de churn con lista de clientes perdidos
 */
export async function getClientChurn(
  companyId: number,
  currentPeriod: Period,
  previousPeriod: Period
): Promise<ChurnMetrics> {
  const currentDates = calculatePeriodDates(currentPeriod);
  const previousDates = calculatePeriodDates(previousPeriod);

  const query = `
    WITH current_period_clients AS (
      SELECT DISTINCT client_id
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $2
        AND sale_date <= $3
        AND client_id IS NOT NULL
    ),
    previous_period_clients AS (
      SELECT DISTINCT client_id
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $4
        AND sale_date <= $5
        AND client_id IS NOT NULL
    ),
    churned_clients AS (
      SELECT DISTINCT p.client_id
      FROM previous_period_clients p
      LEFT JOIN current_period_clients c ON p.client_id = c.client_id
      WHERE c.client_id IS NULL
    ),
    churned_with_details AS (
      SELECT 
        cc.client_id,
        sd.client_name,
        MAX(sd.sale_date) as last_purchase_date
      FROM churned_clients cc
      INNER JOIN sales_data sd ON cc.client_id = sd.client_id
      WHERE sd.company_id = $1
      GROUP BY cc.client_id, sd.client_name
    )
    SELECT 
      client_id as id,
      client_name as name,
      last_purchase_date as "lastPurchaseDate"
    FROM churned_with_details
    ORDER BY last_purchase_date DESC
  `;

  const result = await sql(query, [
    companyId,
    currentDates.start.toISOString().split('T')[0],
    currentDates.end.toISOString().split('T')[0],
    previousDates.start.toISOString().split('T')[0],
    previousDates.end.toISOString().split('T')[0]
  ]);

  const clients: ChurnedClient[] = result.map((row: any) => ({
    id: parseInt(row.id, 10),
    name: row.name,
    lastPurchaseDate: new Date(row.lastPurchaseDate)
  }));

  // Calcular tasa de churn
  // Necesitamos el total de clientes del período anterior
  const previousCountQuery = `
    SELECT COUNT(DISTINCT client_id) as count
    FROM sales_data
    WHERE company_id = $1
      AND sale_date >= $2
      AND sale_date <= $3
      AND client_id IS NOT NULL
  `;

  const previousCountResult = await sql(previousCountQuery, [
    companyId,
    previousDates.start.toISOString().split('T')[0],
    previousDates.end.toISOString().split('T')[0]
  ]);

  const previousCount = parseInt(previousCountResult[0]?.count || '0', 10);
  const churnRate = previousCount > 0
    ? (clients.length / previousCount) * 100
    : 0;

  return {
    count: clients.length,
    rate: parseFloat(churnRate.toFixed(2)),
    clients
  };
}

/**
 * Calcula todas las métricas de ventas para una empresa
 * Esta es la función principal que combina todas las métricas en una query optimizada
 * 
 * @param companyId - ID de la empresa (1 = Dura, 2 = Orsega)
 * @returns Métricas completas de ventas
 * 
 * @example
 * const metrics = await getSalesMetrics(1); // Dura International
 */
export async function getSalesMetrics(companyId: number): Promise<SalesMetrics> {
  const startTime = Date.now();
  
  // Validar companyId
  if (!companyId || (companyId !== 1 && companyId !== 2)) {
    throw new Error(`Invalid companyId: ${companyId}. Must be 1 (Dura) or 2 (Orsega)`);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentPeriod: Period = { type: 'month', year: currentYear, month: currentMonth };
  
  // Período anterior (mes anterior)
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const previousPeriod: Period = { type: 'month', year: previousYear, month: previousMonth };

  // Query optimizada con CTEs para obtener todas las métricas básicas en una sola query
  // Usa los últimos 12 meses para mostrar datos históricos reales
  const baseMetricsQuery = `
    WITH last_12_months_data AS (
      SELECT 
        COUNT(DISTINCT client_id) as active_clients,
        SUM(quantity) as total_volume,
        MAX(unit) as unit,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_revenue
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
        AND sale_date <= CURRENT_DATE
        AND client_id IS NOT NULL
    ),
    current_month_data AS (
      SELECT 
        COUNT(DISTINCT client_id) as active_clients,
        SUM(quantity) as total_volume
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $2
        AND sale_month = $3
        AND client_id IS NOT NULL
    ),
    last_month_with_data AS (
      SELECT 
        COUNT(DISTINCT client_id) as active_clients,
        SUM(quantity) as total_volume
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= CURRENT_DATE - INTERVAL '30 days'
        AND client_id IS NOT NULL
      ORDER BY sale_date DESC
      LIMIT 1
    ),
    last_year_same_period_data AS (
      SELECT SUM(quantity) as total_volume
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $4
        AND sale_month = $3
    ),
    last_3_months_data AS (
      SELECT COUNT(DISTINCT client_id) as active_clients
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= CURRENT_DATE - INTERVAL '90 days'
        AND sale_date <= CURRENT_DATE
        AND client_id IS NOT NULL
    ),
    active_alerts_count AS (
      SELECT COUNT(*) as count
      FROM sales_alerts
      WHERE company_id = $1
        AND is_active = true
        AND is_read = false
    )
    SELECT 
      COALESCE(NULLIF(cm.active_clients, 0), lmd.active_clients, 0) as active_clients,
      COALESCE(NULLIF(cm.total_volume, 0), lmd.total_volume, 0) as total_volume,
      COALESCE(l12m.unit, $5) as unit,
      COALESCE(l12m.transaction_count, 0) as transaction_count,
      COALESCE(l12m.total_revenue, 0) as total_revenue,
      COALESCE(ly.total_volume, 0) as last_year_volume,
      COALESCE(l3m.active_clients, 0) as active_clients_3months,
      COALESCE(aa.count, 0) as active_alerts
    FROM last_12_months_data l12m
    CROSS JOIN current_month_data cm
    CROSS JOIN last_month_with_data lmd
    CROSS JOIN last_year_same_period_data ly
    CROSS JOIN last_3_months_data l3m
    CROSS JOIN active_alerts_count aa
  `;

  const defaultUnit = companyId === 1 ? 'KG' : 'unidades';
  const baseMetrics = await sql(baseMetricsQuery, [
    companyId,
    currentYear,
    currentMonth,
    currentYear - 1,
    defaultUnit
  ]);

  const base = baseMetrics[0];
  
  // Si no hay volumen en el mes actual, usar el último mes con datos disponibles
  let currentVolume = parseFloat(base?.total_volume || '0');
  if (currentVolume === 0) {
    const lastMonthVolumeQuery = `
      SELECT SUM(quantity) as total_volume
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY sale_date DESC
      LIMIT 1
    `;
    const lastMonthResult = await sql(lastMonthVolumeQuery, [companyId]);
    currentVolume = parseFloat(lastMonthResult[0]?.total_volume || '0');
  }
  
  const lastYearVolume = parseFloat(base?.last_year_volume || '0');
  const growth = lastYearVolume > 0
    ? parseFloat(((currentVolume - lastYearVolume) / lastYearVolume * 100).toFixed(1))
    : 0;

  // Calcular métricas adicionales en paralelo
  const [
    activeClientsMetrics,
    retentionRate,
    newClients,
    avgOrderValue,
    clientChurn
  ] = await Promise.all([
    getActiveClientsMetrics(companyId),
    getRetentionRate(companyId, currentPeriod, previousPeriod),
    getNewClients(companyId, currentPeriod),
    getAvgOrderValue(companyId, currentPeriod),
    getClientChurn(companyId, currentPeriod, previousPeriod)
  ]);

  const executionTime = Date.now() - startTime;
  console.log(`[getSalesMetrics] Calculadas métricas para companyId ${companyId} en ${executionTime}ms`);

  return {
    // Métricas existentes (backward compatibility)
    activeClients: parseInt(base?.active_clients || '0', 10),
    currentVolume,
    unit: base?.unit || (companyId === 1 ? 'KG' : 'unidades'),
    growth,
    activeAlerts: parseInt(base?.active_alerts || '0', 10),
    
    // Nuevas métricas
    activeClientsMetrics,
    retentionRate,
    newClients,
    avgOrderValue,
    clientChurn,
    
    // Metadata
    period: {
      current: currentPeriod,
      previous: previousPeriod
    },
    calculatedAt: new Date()
  };
}

