/**
 * Módulo de resumen anual ejecutivo
 * Calcula todas las métricas anuales para un año específico
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import type {
  AnnualSummary,
  MonthlySales,
  ProductSummary,
  ClientSummary,
  InactiveClient,
  Period,
} from '@shared/sales-types';
import { getNewClients, getClientChurn, getRetentionRate, getAvgOrderValue } from './sales-metrics';
import { calculateRealProfitability } from './profitability-metrics';

neonConfig.webSocketConstructor = WebSocket;
const sql = neon(process.env.DATABASE_URL!);

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Obtiene los años disponibles con datos para una empresa
 */
export async function getAvailableYears(companyId: number): Promise<number[]> {
  const query = `
    SELECT DISTINCT sale_year
    FROM sales_data
    WHERE company_id = $1
    ORDER BY sale_year DESC
  `;
  
  const result = await sql(query, [companyId]);
  return result.map((row: any) => parseInt(row.sale_year));
}

/**
 * Calcula el resumen anual completo para una empresa
 */
export async function getAnnualSummary(
  companyId: number,
  year: number
): Promise<AnnualSummary> {
  console.log(`[getAnnualSummary] Calculando resumen anual para companyId: ${companyId}, year: ${year}`);

  const defaultUnit = companyId === 1 ? 'KG' : 'unidades';

  // 1. Ventas totales del año
  const totalSalesQuery = `
    SELECT 
      COALESCE(SUM(quantity), 0) as total_volume,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(DISTINCT invoice_number) as total_transactions,
      COUNT(DISTINCT client_name) as total_clients,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND client_name IS NOT NULL AND client_name <> ''
  `;
  
  const totalSalesData = await sql(totalSalesQuery, [companyId, year]);
  const totalSales = parseFloat(totalSalesData[0]?.total_volume || '0');
  const totalRevenue = parseFloat(totalSalesData[0]?.total_revenue || '0');
  const totalTransactions = parseInt(totalSalesData[0]?.total_transactions || '0');
  const totalClients = parseInt(totalSalesData[0]?.total_clients || '0');
  const unit = totalSalesData[0]?.unit || defaultUnit;

  // 2. Ventas mensuales (desglose)
  const monthlySalesQuery = `
    SELECT 
      sale_month,
      COALESCE(SUM(quantity), 0) as monthly_volume,
      COALESCE(SUM(total_amount), 0) as monthly_revenue,
      COUNT(DISTINCT invoice_number) as monthly_transactions,
      COUNT(DISTINCT client_name) as monthly_clients
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND client_name IS NOT NULL AND client_name <> ''
    GROUP BY sale_month
    ORDER BY sale_month ASC
  `;
  
  const monthlyData = await sql(monthlySalesQuery, [companyId, year]);
  const monthlySales: MonthlySales[] = monthlyData.map((row: any) => ({
    month: parseInt(row.sale_month),
    monthName: monthNames[parseInt(row.sale_month) - 1],
    volume: parseFloat(row.monthly_volume || '0'),
    revenue: parseFloat(row.monthly_revenue || '0'),
    transactions: parseInt(row.monthly_transactions || '0'),
    clients: parseInt(row.monthly_clients || '0'),
  }));

  // 3. Calcular promedio mensual y meses bajo promedio
  const averageMonthlyVolume = monthlySales.length > 0
    ? monthlySales.reduce((sum, m) => sum + m.volume, 0) / monthlySales.length
    : 0;
  const monthsBelowAverage = monthlySales.filter(m => m.volume < averageMonthlyVolume).length;

  // 4. Rentabilidad
  const profitabilityData = await calculateRealProfitability(companyId, year);
  const profitability = profitabilityData.overallProfitability;
  const totalProfit = totalRevenue * (profitability / 100);

  // 5. Top producto del año (por volumen y revenue)
  const topProductQuery = `
    SELECT 
      product_name,
      COALESCE(SUM(quantity), 0) as total_volume,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND product_name IS NOT NULL AND product_name <> ''
    GROUP BY product_name
    ORDER BY total_volume DESC
    LIMIT 1
  `;
  
  const topProductData = await sql(topProductQuery, [companyId, year]);
  const topProduct = topProductData[0] ? {
    name: topProductData[0].product_name,
    volume: parseFloat(topProductData[0].total_volume || '0'),
    revenue: parseFloat(topProductData[0].total_revenue || '0'),
    unit: topProductData[0].unit || unit,
  } : {
    name: 'N/A',
    volume: 0,
    revenue: 0,
    unit: unit,
  };

  // 6. Top 10 productos
  const topProductsQuery = `
    SELECT 
      product_name,
      product_id,
      COALESCE(SUM(quantity), 0) as total_volume,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(DISTINCT invoice_number) as transactions,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND product_name IS NOT NULL AND product_name <> ''
    GROUP BY product_name, product_id
    ORDER BY total_revenue DESC
    LIMIT 10
  `;
  
  const topProductsData = await sql(topProductsQuery, [companyId, year]);
  const topProducts: ProductSummary[] = topProductsData.map((row: any) => ({
    name: row.product_name,
    productId: row.product_id ? parseInt(row.product_id) : null,
    volume: parseFloat(row.total_volume || '0'),
    revenue: parseFloat(row.total_revenue || '0'),
    transactions: parseInt(row.transactions || '0'),
    unit: row.unit || unit,
  }));

  // 7. Top 10 clientes por revenue
  const topClientsQuery = `
    SELECT 
      client_name,
      client_id,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(DISTINCT invoice_number) as transactions,
      AVG(total_amount) as avg_ticket,
      MAX(sale_date) as last_purchase_date
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND client_name IS NOT NULL AND client_name <> ''
      AND total_amount IS NOT NULL AND total_amount > 0
    GROUP BY client_name, client_id
    ORDER BY total_revenue DESC
    LIMIT 10
  `;
  
  const topClientsData = await sql(topClientsQuery, [companyId, year]);
  const topClients: ClientSummary[] = topClientsData.map((row: any) => ({
    name: row.client_name,
    clientId: row.client_id ? parseInt(row.client_id) : null,
    revenue: parseFloat(row.total_revenue || '0'),
    transactions: parseInt(row.transactions || '0'),
    avgTicket: parseFloat(row.avg_ticket || '0'),
    lastPurchaseDate: row.last_purchase_date ? new Date(row.last_purchase_date).toISOString().split('T')[0] : '',
  }));

  // 8. Nuevos clientes del año
  const currentYearPeriod: Period = { type: 'year', year };
  const newClientsData = await getNewClients(companyId, currentYearPeriod);

  // 9. Clientes perdidos (churn)
  const previousYearPeriod: Period = { type: 'year', year: year - 1 };
  const churnData = await getClientChurn(companyId, currentYearPeriod, previousYearPeriod);

  // 10. Clientes inactivos (compraron año anterior pero no este año)
  const inactiveClientsQuery = `
    WITH previous_year_clients AS (
      SELECT DISTINCT client_name
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $2
        AND client_name IS NOT NULL AND client_name <> ''
    ),
    current_year_clients AS (
      SELECT DISTINCT client_name
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $3
        AND client_name IS NOT NULL AND client_name <> ''
    ),
    inactive AS (
      SELECT p.client_name
      FROM previous_year_clients p
      LEFT JOIN current_year_clients c ON p.client_name = c.client_name
      WHERE c.client_name IS NULL
    )
    SELECT 
      i.client_name,
      MAX(sd.client_id) as client_id,
      MAX(sd.sale_date) as last_purchase_date,
      COALESCE(SUM(sd.total_amount), 0) as previous_year_revenue
    FROM inactive i
    INNER JOIN sales_data sd ON i.client_name = sd.client_name
    WHERE sd.company_id = $1
      AND sd.sale_year = $2
    GROUP BY i.client_name
    ORDER BY previous_year_revenue DESC
  `;
  
  const inactiveClientsData = await sql(inactiveClientsQuery, [companyId, year - 1, year]);
  const inactiveClientsList: InactiveClient[] = inactiveClientsData.map((row: any) => ({
    name: row.client_name,
    clientId: row.client_id ? parseInt(row.client_id) : null,
    lastPurchaseDate: row.last_purchase_date ? new Date(row.last_purchase_date).toISOString().split('T')[0] : '',
    previousYearRevenue: parseFloat(row.previous_year_revenue || '0'),
  }));

  // 11. Tasa de retención
  const retentionData = await getRetentionRate(companyId, currentYearPeriod, previousYearPeriod);

  // 12. Ticket promedio
  const avgTicket = await getAvgOrderValue(companyId, currentYearPeriod);

  // 13. Comparación con año anterior
  const previousYearQuery = `
    SELECT 
      COALESCE(SUM(quantity), 0) as total_volume,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(DISTINCT client_name) as total_clients
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND client_name IS NOT NULL AND client_name <> ''
  `;
  
  const previousYearData = await sql(previousYearQuery, [companyId, year - 1]);
  const previousYear = previousYearData[0] ? {
    totalSales: parseFloat(previousYearData[0].total_volume || '0'),
    totalRevenue: parseFloat(previousYearData[0].total_revenue || '0'),
    totalClients: parseInt(previousYearData[0].total_clients || '0'),
  } : undefined;

  const growthVsPreviousYear = previousYear && previousYear.totalSales > 0
    ? ((totalSales - previousYear.totalSales) / previousYear.totalSales) * 100
    : 0;

  console.log(`[getAnnualSummary] Resumen calculado:`, {
    year,
    totalSales,
    totalRevenue,
    profitability,
    totalClients,
    newClients: newClientsData.count,
    lostClients: churnData.count,
  });

  return {
    year,
    companyId,
    totalSales,
    totalRevenue,
    monthlySales,
    growthVsPreviousYear,
    profitability,
    totalProfit,
    topProduct,
    topProducts,
    totalClients,
    newClients: newClientsData.count,
    lostClients: churnData.count,
    inactiveClients: inactiveClientsList.length,
    inactiveClientsList,
    retentionRate: retentionData.rate,
    topClients,
    totalTransactions,
    avgTicket,
    monthsBelowAverage,
    unit,
    previousYear,
  };
}

