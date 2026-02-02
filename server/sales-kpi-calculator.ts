/**
 * Módulo de cálculo de valores de KPIs de ventas desde sales_data
 * Calcula valores en tiempo real desde la tabla sales_data sin depender de kpi_values
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import type { Period } from '@shared/sales-types';
import {
  getActiveClients,
  getRetentionRate,
  getNewClients,
  getClientChurn,
  getSalesMetrics
} from './sales-metrics';

// ========================================================================
// IMPORTANTE: Configurar WebSocket para Neon
// ========================================================================
neonConfig.webSocketConstructor = WebSocket;

const sql = neon(process.env.DATABASE_URL!);

/**
 * Tipo de KPI de ventas identificado por nombre
 */
export type SalesKpiType = 
  | 'volume'           // Volumen de ventas
  | 'active_clients'   // Clientes activos
  | 'growth'           // Crecimiento YoY
  | 'churn'            // Churn de clientes
  | 'retention'        // Retención de clientes
  | 'new_clients'      // Nuevos clientes
  | 'avg_order_value'  // Valor promedio por orden
  | 'unknown';         // No es un KPI de ventas conocido

/**
 * Identifica el tipo de KPI de ventas basándose en el nombre
 */
export function identifySalesKpiType(kpiName: string): SalesKpiType {
  const name = kpiName.toLowerCase().trim();
  
  // Volumen de ventas
  if (
    (name.includes('volumen') && (name.includes('ventas') || name.includes('venta'))) ||
    (name.includes('sales') && name.includes('volume')) ||
    name.includes('volumen de ventas')
  ) {
    return 'volume';
  }
  
  // Clientes activos
  if (
    (name.includes('clientes') && name.includes('activos')) ||
    (name.includes('active') && name.includes('clients')) ||
    name.includes('clientes activos')
  ) {
    return 'active_clients';
  }
  
  // Crecimiento
  if (
    name.includes('crecimiento') ||
    name.includes('growth') ||
    name.includes('incremento')
  ) {
    return 'growth';
  }
  
  // Churn
  if (name.includes('churn') || name.includes('abandono')) {
    return 'churn';
  }
  
  // Retención
  if (
    name.includes('retención') ||
    name.includes('retention') ||
    name.includes('retencion')
  ) {
    return 'retention';
  }
  
  // Nuevos clientes
  if (
    (name.includes('nuevos') && name.includes('clientes')) ||
    (name.includes('new') && name.includes('clients')) ||
    name.includes('nuevos clientes')
  ) {
    return 'new_clients';
  }
  
  // Valor promedio por orden
  if (
    name.includes('valor promedio') ||
    name.includes('average order') ||
    name.includes('ticket promedio') ||
    name.includes('avg order')
  ) {
    return 'avg_order_value';
  }
  
  return 'unknown';
}

/**
 * Calcula el volumen de ventas para un período específico
 */
async function calculateVolume(
  companyId: number,
  year?: number,
  month?: number
): Promise<number> {
  let query: string;
  let params: any[];
  
  if (year && month) {
    // Período específico (mes/año)
    query = `
      SELECT COALESCE(SUM(quantity), 0) as total_volume
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $2
        AND sale_month = $3
    `;
    params = [companyId, year, month];
  } else if (year) {
    // Año completo
    query = `
      SELECT COALESCE(SUM(quantity), 0) as total_volume
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $2
    `;
    params = [companyId, year];
  } else {
    // Último mes con datos disponibles
    const latestDataQuery = `
      SELECT sale_year, sale_month
      FROM sales_data
      WHERE company_id = $1
      ORDER BY sale_year DESC, sale_month DESC
      LIMIT 1
    `;
    const latestData = await sql(latestDataQuery, [companyId]);
    
    if (latestData.length === 0) {
      return 0;
    }
    
    const latestYear = parseInt(latestData[0].sale_year);
    const latestMonth = parseInt(latestData[0].sale_month);
    
    query = `
      SELECT COALESCE(SUM(quantity), 0) as total_volume
      FROM sales_data
      WHERE company_id = $1
        AND sale_year = $2
        AND sale_month = $3
    `;
    params = [companyId, latestYear, latestMonth];
  }
  
  const result = await sql(query, params);
  return parseFloat(result[0]?.total_volume || '0');
}

/**
 * Calcula el valor de un KPI de ventas desde sales_data
 * 
 * @param kpiName - Nombre del KPI
 * @param companyId - ID de la empresa (1 = Dura, 2 = Orsega)
 * @param period - Período opcional (año, mes)
 * @returns Valor calculado del KPI o null si no es un KPI de ventas
 */
export async function calculateSalesKpiValue(
  kpiName: string,
  companyId: number,
  period?: { year?: number; month?: number }
): Promise<{ value: number | string; unit?: string } | null> {
  const kpiType = identifySalesKpiType(kpiName);
  
  if (kpiType === 'unknown') {
    return null; // No es un KPI de ventas
  }
  
  try {
    switch (kpiType) {
      case 'volume': {
        const volume = await calculateVolume(
          companyId,
          period?.year,
          period?.month
        );
        const unit = companyId === 1 ? 'KG' : 'unidades';
        return {
          value: volume,
          unit
        };
      }
      
      case 'active_clients': {
        const activeClientsResult = await getActiveClients(companyId, 'month');
        return {
          value: activeClientsResult.count,
          unit: 'clientes'
        };
      }
      
      case 'growth': {
        // Usar getSalesMetrics para obtener el crecimiento YoY
        const metrics = await getSalesMetrics(companyId);
        return {
          value: metrics.growth || 0,
          unit: '%'
        };
      }
      
      case 'churn': {
        // Calcular churn comparando mes actual vs mes anterior
        const now = new Date();
        const currentYear = period?.year || now.getFullYear();
        const currentMonth = period?.month || now.getMonth() + 1;
        
        // Mes anterior
        let previousYear = currentYear;
        let previousMonth = currentMonth - 1;
        if (previousMonth < 1) {
          previousMonth = 12;
          previousYear = currentYear - 1;
        }
        
        const currentPeriod: Period = {
          type: 'month',
          year: currentYear,
          month: currentMonth
        };
        const previousPeriod: Period = {
          type: 'month',
          year: previousYear,
          month: previousMonth
        };
        
        const churnMetrics = await getClientChurn(companyId, currentPeriod, previousPeriod);
        return {
          value: churnMetrics.rate,
          unit: '%'
        };
      }
      
      case 'retention': {
        // Calcular retención comparando mes actual vs mes anterior
        const now = new Date();
        const currentYear = period?.year || now.getFullYear();
        const currentMonth = period?.month || now.getMonth() + 1;
        
        // Mes anterior
        let previousYear = currentYear;
        let previousMonth = currentMonth - 1;
        if (previousMonth < 1) {
          previousMonth = 12;
          previousYear = currentYear - 1;
        }
        
        const currentPeriod: Period = {
          type: 'month',
          year: currentYear,
          month: currentMonth
        };
        const previousPeriod: Period = {
          type: 'month',
          year: previousYear,
          month: previousMonth
        };
        
        const retentionMetrics = await getRetentionRate(companyId, currentPeriod, previousPeriod);
        return {
          value: retentionMetrics.rate,
          unit: '%'
        };
      }
      
      case 'new_clients': {
        // Calcular nuevos clientes del mes actual
        const now = new Date();
        const currentYear = period?.year || now.getFullYear();
        const currentMonth = period?.month || now.getMonth() + 1;
        
        const periodObj: Period = {
          type: 'month',
          year: currentYear,
          month: currentMonth
        };
        
        const newClientsMetrics = await getNewClients(companyId, periodObj);
        return {
          value: newClientsMetrics.count,
          unit: 'clientes'
        };
      }
      
      case 'avg_order_value': {
        // Calcular valor promedio por orden del mes actual
        const now = new Date();
        const currentYear = period?.year || now.getFullYear();
        const currentMonth = period?.month || now.getMonth() + 1;
        
        const periodObj: Period = {
          type: 'month',
          year: currentYear,
          month: currentMonth
        };
        
        const query = `
          SELECT AVG(total_amount) as avg_value
          FROM sales_data
          WHERE company_id = $1
            AND sale_year = $2
            AND sale_month = $3
            AND total_amount IS NOT NULL
            AND total_amount > 0
        `;
        
        const result = await sql(query, [companyId, currentYear, currentMonth]);
        const avgValue = parseFloat(result[0]?.avg_value || '0');
        
        return {
          value: avgValue,
          unit: 'MXN'
        };
      }
      
      default:
        return null;
    }
  } catch (error) {
    console.error(`[calculateSalesKpiValue] Error calculando KPI ${kpiName}:`, error);
    return null;
  }
}

/**
 * Calcula el historial de valores de un KPI de ventas por mes
 * Útil para gráficos y análisis de tendencias
 */
export type SalesKpiHistoryResult = {
  data: Array<{ period: string; value: number; date: Date }>;
  supported: boolean;
  message?: string;
};

export async function calculateSalesKpiHistory(
  kpiName: string,
  companyId: number,
  months: number = 12
): Promise<SalesKpiHistoryResult> {
  const kpiType = identifySalesKpiType(kpiName);

  if (kpiType !== 'volume') {
    return {
      data: [],
      supported: false,
      message: `Historial no disponible para tipo "${kpiType}"`,
    };
  }

  try {
    const latestDataQuery = `
      SELECT
        sale_year,
        sale_month,
        COALESCE(SUM(quantity), 0) as total_volume
      FROM sales_data
      WHERE company_id = $1
      GROUP BY sale_year, sale_month
      ORDER BY sale_year DESC, sale_month DESC
      LIMIT $2
    `;
    const periods = await sql(latestDataQuery, [companyId, months]);

    const history = periods.map((row: any) => {
      const year = parseInt(row.sale_year);
      const month = parseInt(row.sale_month);
      const volume = parseFloat(row.total_volume || '0');

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const periodString = `${monthNames[month - 1]} ${year}`;
      const date = new Date(year, month - 1, 1);

      return {
        period: periodString,
        value: volume,
        date
      };
    });

    history.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { data: history, supported: true };
  } catch (error) {
    console.error(`[calculateSalesKpiHistory] Error calculando historial para ${kpiName}:`, error);
    return { data: [], supported: true };
  }
}

