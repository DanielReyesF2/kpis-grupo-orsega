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
    // Buscar en el mes actual, pero si no hay datos, buscar en el último mes con datos disponibles
    // Usar client_name en lugar de client_id porque client_id puede ser NULL en los datos migrados
    query = `
      SELECT COUNT(DISTINCT client_name) as count
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $2
        AND sale_month = $3
        AND client_name IS NOT NULL AND client_name <> ''
    `;
    params = [companyId, currentYear, currentMonth];
    
    const result = await sql(query, params);
    const count = parseInt(result[0]?.count || '0', 10);
    
    // Si no hay datos en el mes actual, buscar en los últimos 30 días históricos
    if (count === 0) {
      const last30DaysQuery = `
        SELECT COUNT(DISTINCT client_name) as count
        FROM sales_data
        WHERE company_id = $1
          AND client_name IS NOT NULL AND client_name <> ''
          AND sale_date >= CURRENT_DATE - INTERVAL '30 days'
          AND sale_date <= CURRENT_DATE
      `;
      const last30DaysResult = await sql(last30DaysQuery, [companyId]);
      const last30DaysCount = parseInt(last30DaysResult[0]?.count || '0', 10);
      
      // Si aún no hay datos, buscar el último mes con datos disponibles
      if (last30DaysCount === 0) {
        const lastMonthWithDataQuery = `
          SELECT COUNT(DISTINCT client_name) as count
          FROM sales_data
          WHERE company_id = $1
            AND client_name IS NOT NULL AND client_name <> ''
          ORDER BY sale_date DESC
          LIMIT 1
        `;
        const lastMonthResult = await sql(lastMonthWithDataQuery, [companyId]);
        return parseInt(lastMonthResult[0]?.count || '0', 10);
      }
      
      return last30DaysCount;
    }
    
    return count;
  } else {
    // Últimos 3 meses (90 días) - usar sale_date para datos históricos
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    query = `
      SELECT COUNT(DISTINCT client_name) as count
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $2
        AND sale_date <= $3
        AND client_name IS NOT NULL AND client_name <> ''
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
  // Usamos client_name porque client_id puede ser NULL en datos migrados
  const query = `
    WITH current_period_clients AS (
      SELECT DISTINCT client_name
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $2
        AND sale_date <= $3
        AND client_name IS NOT NULL AND client_name <> ''
    ),
    previous_period_clients AS (
      SELECT DISTINCT client_name
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $4
        AND sale_date <= $5
        AND client_name IS NOT NULL AND client_name <> ''
    ),
    retained_clients AS (
      SELECT DISTINCT c.client_name
      FROM current_period_clients c
      INNER JOIN previous_period_clients p ON c.client_name = p.client_name
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
        AND client_name IS NOT NULL AND client_name <> ''
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

  // Usamos client_name porque client_id puede ser NULL en datos migrados
  const query = `
    WITH current_period_clients AS (
      SELECT DISTINCT client_name
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $2
        AND sale_date <= $3
        AND client_name IS NOT NULL AND client_name <> ''
    ),
    previous_period_clients AS (
      SELECT DISTINCT client_name
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= $4
        AND sale_date <= $5
        AND client_name IS NOT NULL AND client_name <> ''
    ),
    churned_clients AS (
      SELECT DISTINCT p.client_name
      FROM previous_period_clients p
      LEFT JOIN current_period_clients c ON p.client_name = c.client_name
      WHERE c.client_name IS NULL
    ),
    churned_with_details AS (
      SELECT
        cc.client_name,
        MAX(sd.sale_date) as last_purchase_date
      FROM churned_clients cc
      INNER JOIN sales_data sd ON cc.client_name = sd.client_name
      WHERE sd.company_id = $1
      GROUP BY cc.client_name
    )
    SELECT
      0 as id,
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
    SELECT COUNT(DISTINCT client_name) as count
    FROM sales_data
    WHERE company_id = $1
      AND sale_date >= $2
      AND sale_date <= $3
      AND client_name IS NOT NULL AND client_name <> ''
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
  
  console.log(`[getSalesMetrics] Iniciando cálculo de métricas para companyId: ${companyId}`);
  
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

  // Queries separadas para evitar problemas con CTEs vacíos en CROSS JOIN
  const defaultUnit = companyId === 1 ? 'KG' : 'unidades';
  
  // Clientes activos este mes (con fallback a últimos 30 días si no hay datos)
  // Usamos client_name porque client_id puede ser NULL en datos migrados
  const currentMonthClientsQuery = `
    SELECT COUNT(DISTINCT client_name) as count
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND sale_month = $3
      AND client_name IS NOT NULL AND client_name <> ''
  `;
  const currentMonthClients = await sql(currentMonthClientsQuery, [companyId, currentYear, currentMonth]);
  let currentMonthClientsCount = parseInt(currentMonthClients[0]?.count || '0', 10);
  console.log(`[getSalesMetrics] Clientes mes actual (${currentYear}-${currentMonth}): ${currentMonthClientsCount}`);
  
  // Volumen este mes (con fallback a últimos 30 días si no hay datos)
  const currentMonthVolumeQuery = `
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND sale_month = $3
  `;
  const currentMonthVolume = await sql(currentMonthVolumeQuery, [companyId, currentYear, currentMonth]);
  let currentVolume = parseFloat(currentMonthVolume[0]?.total || '0');
  console.log(`[getSalesMetrics] Volumen mes actual (${currentYear}-${currentMonth}): ${currentVolume}`);
  
  // Si no hay datos en el mes actual, buscar en últimos 30 días históricos
  if (currentVolume === 0 || currentMonthClientsCount === 0) {
    console.log(`[getSalesMetrics] No hay datos en mes actual, buscando en últimos 30 días...`);
    const last30DaysQuery = `
      SELECT
        COALESCE(SUM(quantity), 0) as total,
        COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients
      FROM sales_data
      WHERE company_id = $1
        AND sale_date >= CURRENT_DATE - INTERVAL '30 days'
        AND sale_date <= CURRENT_DATE
    `;
    const last30Days = await sql(last30DaysQuery, [companyId]);
    const last30DaysVolume = parseFloat(last30Days[0]?.total || '0');
    const last30DaysClients = parseInt(last30Days[0]?.clients || '0', 10);
    console.log(`[getSalesMetrics] Últimos 30 días - Volumen: ${last30DaysVolume}, Clientes: ${last30DaysClients}`);
    
    if (currentVolume === 0 && last30DaysVolume > 0) {
      currentVolume = last30DaysVolume;
      console.log(`[getSalesMetrics] Usando volumen de últimos 30 días: ${currentVolume}`);
    }
    if (currentMonthClientsCount === 0 && last30DaysClients > 0) {
      currentMonthClientsCount = last30DaysClients;
      console.log(`[getSalesMetrics] Usando clientes de últimos 30 días: ${currentMonthClientsCount}`);
    }
  }
  
  // Si aún no hay datos, buscar el último mes con datos disponibles (de cualquier año)
  if (currentVolume === 0) {
    console.log(`[getSalesMetrics] No hay datos en últimos 30 días, buscando último mes con datos...`);
    const lastMonthWithDataQuery = `
      SELECT
        sale_year,
        sale_month,
        COALESCE(SUM(quantity), 0) as total,
        COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients
      FROM sales_data
      WHERE company_id = $1
      GROUP BY sale_year, sale_month
      ORDER BY sale_year DESC, sale_month DESC
      LIMIT 1
    `;
    const lastMonthData = await sql(lastMonthWithDataQuery, [companyId]);
    if (lastMonthData.length > 0) {
      const lastMonthVolume = parseFloat(lastMonthData[0]?.total || '0');
      const lastMonthClients = parseInt(lastMonthData[0]?.clients || '0', 10);
      console.log(`[getSalesMetrics] Último mes con datos: ${lastMonthData[0]?.sale_year}-${lastMonthData[0]?.sale_month}, Volumen: ${lastMonthVolume}, Clientes: ${lastMonthClients}`);
      
      if (lastMonthVolume > 0) {
        currentVolume = lastMonthVolume;
        console.log(`[getSalesMetrics] Usando volumen del último mes disponible: ${currentVolume}`);
      }
      if (currentMonthClientsCount === 0 && lastMonthClients > 0) {
        currentMonthClientsCount = lastMonthClients;
        console.log(`[getSalesMetrics] Usando clientes del último mes disponible: ${currentMonthClientsCount}`);
      }
    } else {
      console.warn(`[getSalesMetrics] ⚠️ No se encontró ningún mes con datos para companyId ${companyId}`);
    }
  }
  
  // Clientes activos últimos 3 meses
  const last3MonthsClientsQuery = `
    SELECT COUNT(DISTINCT client_name) as count
    FROM sales_data
    WHERE company_id = $1
      AND sale_date >= CURRENT_DATE - INTERVAL '90 days'
      AND sale_date <= CURRENT_DATE
      AND client_name IS NOT NULL AND client_name <> ''
  `;
  const last3MonthsClients = await sql(last3MonthsClientsQuery, [companyId]);
  const last3MonthsClientsCount = parseInt(last3MonthsClients[0]?.count || '0', 10);
  console.log(`[getSalesMetrics] Clientes últimos 3 meses: ${last3MonthsClientsCount}`);
  
  // Verificar si hay datos en sales_data para este company_id
  const totalRecordsQuery = `
    SELECT COUNT(*) as total
    FROM sales_data
    WHERE company_id = $1
  `;
  const totalRecords = await sql(totalRecordsQuery, [companyId]);
  const totalRecordsCount = parseInt(totalRecords[0]?.total || '0', 10);
  console.log(`[getSalesMetrics] Total de registros en sales_data para companyId ${companyId}: ${totalRecordsCount}`);
  
  if (totalRecordsCount === 0) {
    console.error(`[getSalesMetrics] ⚠️ ADVERTENCIA: No hay registros en sales_data para companyId ${companyId}`);
  } else {
    // Verificar rango de fechas
    const dateRangeQuery = `
      SELECT 
        MIN(sale_date) as min_date,
        MAX(sale_date) as max_date,
        MIN(sale_year) as min_year,
        MAX(sale_year) as max_year
      FROM sales_data
      WHERE company_id = $1
    `;
    const dateRange = await sql(dateRangeQuery, [companyId]);
    console.log(`[getSalesMetrics] Rango de fechas: ${dateRange[0]?.min_date} a ${dateRange[0]?.max_date} (años: ${dateRange[0]?.min_year} a ${dateRange[0]?.max_year})`);
  }
  
  // Volumen año anterior mismo mes
  const lastYearVolumeQuery = `
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $4
      AND sale_month = $3
  `;
  const lastYearVolume = await sql(lastYearVolumeQuery, [companyId, currentYear - 1, currentMonth]);
  const lastYearVolumeTotal = parseFloat(lastYearVolume[0]?.total || '0');
  
  // Unidad (de últimos 12 meses)
  const unitQuery = `
    SELECT COALESCE(MAX(unit), $5) as unit
    FROM sales_data
    WHERE company_id = $1
      AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
      AND sale_date <= CURRENT_DATE
  `;
  const unitResult = await sql(unitQuery, [companyId, defaultUnit]);
  const unit = unitResult[0]?.unit || defaultUnit;
  
  // Alertas activas
  const alertsQuery = `
    SELECT COUNT(*) as count
    FROM sales_alerts
    WHERE company_id = $1
      AND is_active = true
      AND is_read = false
  `;
  const alerts = await sql(alertsQuery, [companyId]);
  const activeAlertsCount = parseInt(alerts[0]?.count || '0', 10);
  
  // Calcular crecimiento
  const growth = lastYearVolumeTotal > 0
    ? parseFloat(((currentVolume - lastYearVolumeTotal) / lastYearVolumeTotal * 100).toFixed(1))
    : 0;
  
  // Usar clientes activos del mes actual, o de últimos 30 días si no hay
  const activeClientsCount = currentMonthClientsCount > 0 
    ? currentMonthClientsCount 
    : last3MonthsClientsCount;

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
    activeClients: activeClientsCount,
    currentVolume,
    unit: unit,
    growth,
    activeAlerts: activeAlertsCount,
    
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

