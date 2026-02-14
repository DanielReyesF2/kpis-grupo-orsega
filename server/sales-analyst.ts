/**
 * Módulo de Analista de Ventas con IA
 * Proporciona análisis estratégico consolidado para el jefe de ventas
 * 
 * Características:
 * - Usa CTEs para calcular múltiples métricas en una sola query
 * - Integración con OpenAI para análisis inteligente
 * - Genera recomendaciones estratégicas basadas en datos históricos
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import OpenAI from 'openai';
import type {
  SalesAnalystInsights,
  ClientFocus,
  ProductOpportunity,
  Recommendation,
  ActionItem,
  RiskFactor
} from '@shared/sales-analyst-types';

neonConfig.webSocketConstructor = WebSocket;
const sql = neon(process.env.DATABASE_URL!);

// Umbrales fijos para categorización de clientes (en días)
const DORMANT_DAYS_THRESHOLD = 120;   // 4+ meses sin compra = cliente dormido (necesita reactivación agresiva)
const CRITICAL_DAYS_THRESHOLD = 90;   // 3 meses sin compra = cliente crítico (llamada urgente)
const AT_RISK_DAYS_THRESHOLD = 60;    // 2 meses sin compra = cliente en riesgo (contacto preventivo)

// Inicializar OpenAI si está configurado
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/**
 * Genera recomendaciones estratégicas usando IA
 */
async function generateAIRecommendations(
  clientData: any[],
  productData: any[],
  inactiveClients: any[],
  companyId: number
): Promise<{ aiInsights: string; aiRecommendations: string[] }> {
  if (!openai) {
    console.log('[AI] OpenAI no configurado, usando recomendaciones estáticas');
    return { aiInsights: '', aiRecommendations: [] };
  }

  try {
    // Preparar resumen de datos para el prompt
    const topClients = clientData
      .filter(c => c.currentYearRevenue > 0)
      .sort((a, b) => (b.currentYearRevenue || 0) - (a.currentYearRevenue || 0))
      .slice(0, 10);
    
    const decliningClients = clientData
      .filter(c => c.yoyChange < -20 && c.previousYearRevenue > 10000)
      .slice(0, 10);
    
    const topProducts = productData
      .filter(p => p.amtCurrentYear > 0)
      .sort((a, b) => (b.amtCurrentYear || 0) - (a.amtCurrentYear || 0))
      .slice(0, 10);
    
    const growingProducts = productData
      .filter(p => p.growthRate > 20)
      .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
      .slice(0, 5);

    const companyName = companyId === 1 ? 'Dura International' : 'Grupo Orsega';
    const currency = companyId === 1 ? 'USD' : 'MXN';

    const prompt = `Analiza los datos de ventas 2024-2025 de ${companyName} y proporciona insights accionables:

## TOP 10 CLIENTES POR REVENUE
${topClients.map(c => `- ${c.name}: ${currency} ${(c.currentYearRevenue || 0).toLocaleString()} (cambio YoY: ${(c.yoyChange || 0).toFixed(1)}%)`).join('\n')}

## CLIENTES CON CAÍDA SIGNIFICATIVA (>20% menos que año anterior)
${decliningClients.length > 0 
  ? decliningClients.map(c => `- ${c.name}: de ${currency} ${(c.previousYearRevenue || 0).toLocaleString()} a ${currency} ${(c.currentYearRevenue || 0).toLocaleString()} (${(c.yoyChange || 0).toFixed(1)}%)`).join('\n')
  : 'No hay clientes con caída significativa'}

## CLIENTES INACTIVOS (compraron antes pero no este año)
${inactiveClients.slice(0, 5).map(c => `- ${c.name}: ${c.daysSincePurchase} días sin compra, revenue anterior: ${currency} ${(c.previousYearRevenue || 0).toLocaleString()}`).join('\n')}
Total clientes inactivos: ${inactiveClients.length}

## TOP PRODUCTOS
${topProducts.map(p => `- ${p.name}: ${currency} ${(p.amtCurrentYear || 0).toLocaleString()} (crecimiento: ${(p.growthRate || 0).toFixed(1)}%)`).join('\n')}

## PRODUCTOS EN CRECIMIENTO
${growingProducts.map(p => `- ${p.name}: +${(p.growthRate || 0).toFixed(1)}%, ${p.uniqueClients} clientes`).join('\n')}

Genera:
1. RESUMEN: 2 oraciones sobre el estado de ventas 2024-2025
2. 4 RECOMENDACIONES concretas (máximo 40 palabras cada una)

Responde SOLO en JSON:
{"resumen": "...", "recomendaciones": ["...", "...", "...", "..."]}`;

    console.log('[AI] Enviando análisis a OpenAI...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres EconovaAI, un analista de ventas B2B experto. Responde siempre en español y en formato JSON válido. Sé conciso y directo.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('[AI] Respuesta recibida:', content.substring(0, 200));

    // Parsear respuesta JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        aiInsights: parsed.resumen || '',
        aiRecommendations: parsed.recomendaciones || []
      };
    }

    return { aiInsights: '', aiRecommendations: [] };
  } catch (error) {
    console.error('[AI] Error generando recomendaciones:', error);
    return { aiInsights: '', aiRecommendations: [] };
  }
}

/**
 * Funciones de estadística para cálculos adaptativos
 */

/**
 * Calcula un percentil histórico de días sin compra para clientes
 */
async function calculatePercentileDaysSincePurchase(
  companyId: number,
  percentile: number
): Promise<number> {
  try {
    const query = `
      WITH client_days AS (
        SELECT 
          CURRENT_DATE - MAX(fecha)::date as days_since
        FROM ventas
        WHERE company_id = $1
          AND cliente IS NOT NULL 
          AND cliente <> ''
          AND fecha IS NOT NULL
        GROUP BY cliente
        HAVING MAX(fecha) < CURRENT_DATE
      )
      SELECT PERCENTILE_CONT(${percentile / 100}) WITHIN GROUP (ORDER BY days_since) as percentile_value
      FROM client_days
    `;
    const result = await sql(query, [companyId]);
    return result[0]?.percentile_value || 60; // Fallback a 60 días
  } catch (error) {
    console.error('[calculatePercentileDaysSincePurchase] Error:', error);
    return 60; // Fallback
  }
}

/**
 * Calcula un percentil histórico de revenue para identificar clientes de alto valor
 */
async function calculatePercentileRevenue(
  companyId: number,
  percentile: number
): Promise<number> {
  try {
    const query = `
      WITH client_revenue AS (
        SELECT 
          SUM(importe) as annual_revenue
        FROM ventas
        WHERE company_id = $1
          AND cliente IS NOT NULL 
          AND cliente <> ''
          AND anio = (SELECT MAX(anio) FROM ventas WHERE company_id = $1)
        GROUP BY cliente
      )
      SELECT PERCENTILE_CONT(${percentile / 100}) WITHIN GROUP (ORDER BY annual_revenue) as percentile_value
      FROM client_revenue
    `;
    const result = await sql(query, [companyId]);
    return result[0]?.percentile_value || 10000; // Fallback a $10K
  } catch (error) {
    console.error('[calculatePercentileRevenue] Error:', error);
    return 10000; // Fallback
  }
}

/**
 * Calcula la media y desviación estándar de cambios YoY para validación estadística
 */
async function calculateYoYChangeStats(
  companyId: number
): Promise<{ mean: number; stdDev: number }> {
  try {
    const query = `
      WITH client_yoy AS (
        SELECT
          cliente,
          SUM(CASE WHEN anio = (SELECT MAX(anio) FROM ventas WHERE company_id = $1) THEN cantidad ELSE 0 END) as qty_current,
          SUM(CASE WHEN anio = (SELECT MAX(anio) FROM ventas WHERE company_id = $1) - 1 THEN cantidad ELSE 0 END) as qty_last
        FROM ventas
        WHERE company_id = $1
          AND cliente IS NOT NULL 
          AND cliente <> ''
        GROUP BY cliente
        HAVING SUM(CASE WHEN anio = (SELECT MAX(anio) FROM ventas WHERE company_id = $1) - 1 THEN cantidad ELSE 0 END) > 0
      ),
      yoy_changes AS (
        SELECT
          CASE
            WHEN qty_last > 0 THEN ((qty_current - qty_last) / qty_last * 100)
            ELSE 0
          END as yoy_change
        FROM client_yoy
      )
      SELECT 
        AVG(yoy_change) as mean,
        STDDEV(yoy_change) as std_dev
      FROM yoy_changes
    `;
    const result = await sql(query, [companyId]);
    const mean = parseFloat(result[0]?.mean || '0');
    const stdDev = parseFloat(result[0]?.std_dev || '10'); // Fallback a 10% si no hay datos
    return { mean, stdDev: stdDev > 0 ? stdDev : 10 };
  } catch (error) {
    console.error('[calculateYoYChangeStats] Error:', error);
    return { mean: 0, stdDev: 10 }; // Fallback
  }
}

/**
 * Calcula el Z-score de un valor dado la media y desviación estándar
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Calcula el percentil rank de un valor en una distribución
 */
function calculatePercentileRank(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 50;
  const zScore = calculateZScore(value, mean, stdDev);
  // Aproximación usando distribución normal estándar
  // Percentil = 50 + (zScore * 34.1) para valores entre -1 y 1
  if (Math.abs(zScore) <= 1) {
    return 50 + (zScore * 34.1);
  } else if (zScore > 1) {
    return Math.min(84 + ((zScore - 1) * 13.6), 99);
  } else {
    return Math.max(16 + ((zScore + 1) * 13.6), 1);
  }
}

/**
 * Calcula el margen promedio histórico de la empresa (para profitability)
 */
async function calculateAverageMargin(companyId: number): Promise<number> {
  try {
    // Si no hay datos de costos, usar un margen estimado basado en industria
    // Para manufactura/distribución, margen típico es 15-25%
    // Usaremos 18% como default, pero esto debería venir de datos reales de costos
    const defaultMargin = 18;
    
    // TODO: Si hay tabla de costos, calcular desde ahí:
    // SELECT AVG((unit_price - cost) / unit_price * 100) FROM ventas JOIN costs...
    
    return defaultMargin;
  } catch (error) {
    console.error('[calculateAverageMargin] Error:', error);
    return 18; // Fallback
  }
}

/**
 * Genera insights completos del analista de ventas
 * @param companyId - ID de la empresa (1 = Dura, 2 = Orsega)
 * @returns Insights completos con análisis estratégico
 */
export async function generateSalesAnalystInsights(
  companyId: number
): Promise<SalesAnalystInsights> {
  const now = new Date();
  
  // Usar explícitamente 2025 y 2024 para análisis histórico completo
  const currentYear = 2025;
  const lastYear = 2024;
  
  const periodStart = new Date(currentYear, 0, 1).toISOString().split('T')[0];
  const periodEnd = now.toISOString().split('T')[0];

  console.log(`[generateSalesAnalystInsights] Iniciando para companyId: ${companyId}, años: ${currentYear} vs ${lastYear}`);

  try {
    // Query consolidada usando CTEs para optimizar performance
    const consolidatedQuery = `
    WITH 
    -- Estadísticas de clientes por año
    client_stats AS (
      SELECT
        cliente,
        MAX(client_id) as client_id,
        MAX(fecha) as last_purchase_date,
        SUM(CASE WHEN anio = $2 THEN cantidad ELSE 0 END) as qty_current_year,
        SUM(CASE WHEN anio = $3 THEN cantidad ELSE 0 END) as qty_last_year,
        SUM(CASE WHEN anio = $2 THEN importe ELSE 0 END) as amt_current_year,
        SUM(CASE WHEN anio = $3 THEN importe ELSE 0 END) as amt_last_year,
        MAX(unidad) as unit
      FROM ventas
      WHERE company_id = $1
        AND cliente IS NOT NULL AND cliente <> ''
      GROUP BY cliente
    ),
    -- Estadísticas de productos por año
    product_stats AS (
      SELECT
        producto,
        MAX(product_id) as product_id,
        SUM(CASE WHEN anio = $2 THEN cantidad ELSE 0 END) as qty_current_year,
        SUM(CASE WHEN anio = $3 THEN cantidad ELSE 0 END) as qty_last_year,
        SUM(CASE WHEN anio = $2 THEN importe ELSE 0 END) as amt_current_year,
        SUM(CASE WHEN anio = $3 THEN importe ELSE 0 END) as amt_last_year,
        COUNT(DISTINCT cliente) as unique_clients,
        MAX(unidad) as unit
      FROM ventas
      WHERE company_id = $1
        AND producto IS NOT NULL AND producto <> ''
      GROUP BY producto
    ),
    -- Clientes inactivos (compraron año anterior pero no este año)
    inactive_clients AS (
      SELECT
        cs.cliente,
        cs.client_id,
        cs.last_purchase_date,
        cs.amt_last_year as previous_year_revenue,
        CURRENT_DATE - cs.last_purchase_date::date as days_since_purchase
      FROM client_stats cs
      WHERE cs.qty_last_year > 0 AND cs.qty_current_year = 0
    ),
    -- Top 3 productos por cliente (basado en importe histórico)
    client_top_products AS (
      SELECT
        cliente,
        array_agg(producto ORDER BY total_importe DESC) as top_products
      FROM (
        SELECT
          cliente,
          producto,
          SUM(importe) as total_importe,
          ROW_NUMBER() OVER (PARTITION BY cliente ORDER BY SUM(importe) DESC) as rn
        FROM ventas
        WHERE company_id = $1
          AND cliente IS NOT NULL AND cliente <> ''
          AND producto IS NOT NULL AND producto <> ''
        GROUP BY cliente, producto
      ) ranked
      WHERE rn <= 3
      GROUP BY cliente
    )
    SELECT
      'client' as data_type,
      jsonb_build_object(
        'name', cs.cliente,
        'clientId', cs.client_id,
        'lastPurchaseDate', cs.last_purchase_date,
        'daysSincePurchase', CURRENT_DATE - cs.last_purchase_date::date,
        'previousYearRevenue', cs.amt_last_year,
        'currentYearRevenue', cs.amt_current_year,
        'qtyCurrentYear', cs.qty_current_year,
        'qtyLastYear', cs.qty_last_year,
        'yoyChange', CASE
          WHEN cs.qty_last_year > 0 THEN ((cs.qty_current_year - cs.qty_last_year) / cs.qty_last_year * 100)
          ELSE CASE WHEN cs.qty_current_year > 0 THEN 100 ELSE 0 END
        END,
        'unit', cs.unit,
        'topProducts', COALESCE(ctp.top_products, ARRAY[]::text[])
      ) as data
    FROM client_stats cs
    LEFT JOIN client_top_products ctp ON cs.cliente = ctp.cliente
    WHERE cs.qty_last_year > 0 OR cs.qty_current_year > 0
    
    UNION ALL
    
    SELECT
      'product' as data_type,
      jsonb_build_object(
        'name', ps.producto,
        'productId', ps.product_id,
        'qtyCurrentYear', ps.qty_current_year,
        'qtyLastYear', ps.qty_last_year,
        'amtCurrentYear', ps.amt_current_year,
        'amtLastYear', ps.amt_last_year,
        'growthRate', CASE
          WHEN ps.qty_last_year > 0 THEN ((ps.qty_current_year - ps.qty_last_year) / ps.qty_last_year * 100)
          ELSE CASE WHEN ps.qty_current_year > 0 THEN 100 ELSE 0 END
        END,
        'uniqueClients', ps.unique_clients,
        'unit', ps.unit
      ) as data
    FROM product_stats ps
    
    UNION ALL
    
    SELECT
      'inactive' as data_type,
      jsonb_build_object(
        'name', ic.cliente,
        'clientId', ic.client_id,
        'lastPurchaseDate', ic.last_purchase_date,
        'previousYearRevenue', ic.previous_year_revenue,
        'daysSincePurchase', ic.days_since_purchase
      ) as data
    FROM inactive_clients ic
  `;

    console.log(`[generateSalesAnalystInsights] Ejecutando query consolidada...`);
    const results = await sql(consolidatedQuery, [companyId, currentYear, lastYear]);
    console.log(`[generateSalesAnalystInsights] Query ejecutada exitosamente, ${results.length} registros obtenidos`);

    // Separar resultados por tipo
    const clientData = results.filter((r: any) => r.data_type === 'client').map((r: any) => r.data);
    const productData = results.filter((r: any) => r.data_type === 'product').map((r: any) => r.data);
    const inactiveData = results.filter((r: any) => r.data_type === 'inactive').map((r: any) => r.data);
    
    console.log(`[generateSalesAnalystInsights] Datos separados: ${clientData.length} clientes, ${productData.length} productos, ${inactiveData.length} inactivos`);

    // Usar umbrales fijos para categorización de clientes (4 niveles)
    console.log(`[generateSalesAnalystInsights] Usando umbrales fijos: dormidos=${DORMANT_DAYS_THRESHOLD} días, críticos=${CRITICAL_DAYS_THRESHOLD} días, riesgo=${AT_RISK_DAYS_THRESHOLD} días`);
    const dormantDaysThreshold = DORMANT_DAYS_THRESHOLD;   // 4+ meses
    const criticalDaysThreshold = CRITICAL_DAYS_THRESHOLD; // 3 meses
    const atRiskDaysThreshold = AT_RISK_DAYS_THRESHOLD;    // 2 meses
    const highValueRevenueThreshold = await calculatePercentileRevenue(companyId, 75);
    const yoyStats = await calculateYoYChangeStats(companyId);
    console.log(`[generateSalesAnalystInsights] Umbrales: dormidos=${dormantDaysThreshold} días, críticos=${criticalDaysThreshold} días, riesgo=${atRiskDaysThreshold} días, highValueRevenue=${highValueRevenueThreshold}`);

  // Procesar clientes y categorizar con umbrales fijos (4 niveles)
  const focusClients = categorizeClients(
    clientData,
    dormantDaysThreshold,
    criticalDaysThreshold,
    atRiskDaysThreshold,
    highValueRevenueThreshold,
    yoyStats
  );
  
  // Calcular margen promedio para profitability
  const averageMargin = await calculateAverageMargin(companyId);

  // Procesar productos y categorizar
  const productOpportunities = categorizeProducts(productData, averageMargin);
  
  // Generar recomendaciones estratégicas básicas
  const recommendations = generateRecommendations(focusClients, productOpportunities, inactiveData);
  
  // Generar action items
  const actionItems = generateActionItems(focusClients, inactiveData, recommendations);
  
  // Análisis de riesgo
  const riskAnalysis = calculateRiskAnalysis(focusClients, inactiveData);

  // 🤖 Generar análisis con IA (si OpenAI está disponible)
  console.log(`[generateSalesAnalystInsights] Generando análisis con IA...`);
  const aiAnalysis = await generateAIRecommendations(clientData, productData, inactiveData, companyId);
  
  // Agregar recomendaciones de IA a las existentes
  if (aiAnalysis.aiRecommendations.length > 0) {
    aiAnalysis.aiRecommendations.forEach((rec, idx) => {
      recommendations.push({
        id: `ai-rec-${idx + 1}`,
        type: 'strategy',
        title: `🤖 ${rec.substring(0, 50)}${rec.length > 50 ? '...' : ''}`,
        description: rec,
        priority: idx < 2 ? 'high' : 'medium',
        impact: idx < 2 ? 'high' : 'medium',
        effort: 'medium',
        relatedEntities: {}
      });
    });
  }

  // Calcular contexto estadístico para insights mejorados
  const statisticalContext = {
    dormantDaysThreshold,
    criticalDaysThreshold,
    atRiskDaysThreshold,
    highValueRevenueThreshold,
    yoyStats: {
      mean: yoyStats.mean,
      stdDev: yoyStats.stdDev
    },
    averageMargin,
    aiInsights: aiAnalysis.aiInsights || undefined
  };

    console.log(`[generateSalesAnalystInsights] Generando insights finales...`);
    const insights = {
      metadata: {
        companyId,
        generatedAt: now.toISOString(),
      period: {
        start: periodStart,
        end: periodEnd
      }
    },
    focusClients,
    productOpportunities,
    inactiveClients: inactiveData.map((ic: any) => ({
      name: ic.name,
      clientId: ic.clientId,
      lastPurchaseDate: ic.lastPurchaseDate,
      previousYearRevenue: ic.previousYearRevenue || 0,
      daysSincePurchase: ic.daysSincePurchase || 0
    })),
    strategicRecommendations: recommendations,
    actionItems,
    riskAnalysis,
    statisticalContext
  };
    
    console.log(`[generateSalesAnalystInsights] Insights generados exitosamente`);
    return insights;
  } catch (error) {
    console.error('[generateSalesAnalystInsights] Error crítico:', error);
    if (error instanceof Error) {
      console.error('[generateSalesAnalystInsights] Error message:', error.message);
      console.error('[generateSalesAnalystInsights] Error stack:', error.stack);
    }
    throw error; // Re-lanzar para que el endpoint maneje el error
  }
}

/**
 * Categoriza clientes según su estado y prioridad usando umbrales fijos (4 niveles)
 * - Dormidos: 120+ días (4+ meses) sin compra - necesitan reactivación agresiva
 * - Críticos: 90-119 días (3 meses) sin compra - llamada urgente
 * - En riesgo: 60-89 días (2 meses) sin compra - contacto preventivo
 * - Oportunidades: clientes con crecimiento >10%
 */
function categorizeClients(
  clients: any[],
  dormantDaysThreshold: number,
  criticalDaysThreshold: number,
  atRiskDaysThreshold: number,
  highValueRevenueThreshold: number,
  yoyStats: { mean: number; stdDev: number }
): {
  dormant: ClientFocus[];
  critical: ClientFocus[];
  atRisk: ClientFocus[];
  opportunities: ClientFocus[];
} {
  const dormant: ClientFocus[] = [];
  const critical: ClientFocus[] = [];
  const atRisk: ClientFocus[] = [];
  const opportunities: ClientFocus[] = [];

  clients.forEach((client: any) => {
    const daysSince = client.daysSincePurchase || 0;
    const yoyChange = client.yoyChange || 0;
    const previousRevenue = client.previousYearRevenue || 0;
    const currentRevenue = client.currentYearRevenue || 0;
    const qtyLastYear = client.qtyLastYear || 0;
    const qtyCurrentYear = client.qtyCurrentYear || 0;

    // Calcular Z-score para análisis adicional (no para categorización principal)
    const zScore = calculateZScore(yoyChange, yoyStats.mean, yoyStats.stdDev);
    const isAnomaly = Math.abs(zScore) > 2.0; // 95% confianza

    // Calcular risk score normalizado (0-100) con ponderación
    const daysScore = Math.min(daysSince / dormantDaysThreshold, 1.0);
    const revenueScore = Math.min(previousRevenue / 500000, 1.0);
    const yoyScore = Math.min(Math.abs(yoyChange) / 100, 1.0);

    const riskScore = (
      daysScore * 0.4 +      // 40% peso en recency
      revenueScore * 0.3 +   // 30% peso en valor
      yoyScore * 0.3         // 30% peso en tendencia
    ) * 100;

    // Generar acciones recomendadas con contexto específico y urgencia
    const recommendedActions: string[] = [];

    // Determinar categoría basada en días sin compra (4 niveles)
    const isDormant = daysSince >= dormantDaysThreshold; // 4+ meses (120+ días)
    const isCritical = daysSince >= criticalDaysThreshold && daysSince < dormantDaysThreshold; // 3 meses (90-119 días)
    const isAtRisk = daysSince >= atRiskDaysThreshold && daysSince < criticalDaysThreshold; // 2 meses (60-89 días)

    if (isDormant) {
      const monthsWithoutPurchase = Math.floor(daysSince / 30);
      const discountNeeded = Math.min(Math.floor(monthsWithoutPurchase) * 5, 30);

      recommendedActions.push(
        `REACTIVACIÓN: Cliente dormido ${client.name} - ` +
        `${daysSince} días sin compra (${monthsWithoutPurchase} meses), ` +
        `$${previousRevenue.toLocaleString('es-MX')} en riesgo. ` +
        `Última compra: ${new Date(client.lastPurchaseDate || '').toLocaleDateString('es-MX')}. ` +
        `Acción: Campaña de reactivación agresiva con ${discountNeeded}% de descuento`
      );
    } else if (isCritical) {
      const monthsWithoutPurchase = Math.floor(daysSince / 30);
      const discountNeeded = Math.min(Math.floor(monthsWithoutPurchase) * 5, 20);

      recommendedActions.push(
        `URGENTE: Contactar ${client.name} - ` +
        `${daysSince} días sin compra (${monthsWithoutPurchase} meses), ` +
        `$${previousRevenue.toLocaleString('es-MX')} en riesgo. ` +
        `Última compra: ${new Date(client.lastPurchaseDate || '').toLocaleDateString('es-MX')}. ` +
        `Acción: Llamada inmediata + oferta del ${discountNeeded}%`
      );
    } else if (isAtRisk) {
      const monthsWithoutPurchase = Math.floor(daysSince / 30);

      recommendedActions.push(
        `PREVENTIVO: Dar seguimiento a ${client.name} - ` +
        `${daysSince} días sin compra (${monthsWithoutPurchase} meses). ` +
        `Prevenir que se convierta en cliente crítico. ` +
        `Acción: Contacto proactivo para entender situación.`
      );
    }

    if (isAnomaly && yoyChange < 0) {
      recommendedActions.push(
        `Investigar caída del ${Math.abs(yoyChange).toFixed(1)}% vs año anterior. ` +
        `Requiere análisis de causa raíz.`
      );
    }

    if (previousRevenue > highValueRevenueThreshold * 0.5 && qtyCurrentYear === 0) {
      recommendedActions.push(
        `Ofrecer promoción especial para reactivación ` +
        `(cliente de alto valor: $${previousRevenue.toLocaleString('es-MX')} histórico)`
      );
    }

    if (yoyChange > 10 && qtyCurrentYear > 0) {
      recommendedActions.push(
        `Cliente en crecimiento (+${yoyChange.toFixed(1)}%). ` +
        `Explorar oportunidades de upselling y cross-selling.`
      );
    }

    // Determinar prioridad basada en días sin compra (4 niveles)
    let priority: 'dormant' | 'critical' | 'at-risk' | 'opportunity';
    if (isDormant) {
      priority = 'dormant';
    } else if (isCritical) {
      priority = 'critical';
    } else if (isAtRisk) {
      priority = 'at-risk';
    } else {
      priority = 'opportunity';
    }

    // Calculate contact priority (1-10, where 1 is most urgent)
    // Based on: days since purchase (50%), revenue at risk (30%), yoy decline (20%)
    const daysWeight = Math.min(daysSince / dormantDaysThreshold, 1.0) * 5; // 0-5 points
    const revenueWeight = Math.min(previousRevenue / 100000, 1.0) * 3; // 0-3 points (scales to $100k)
    const declineWeight = yoyChange < 0 ? Math.min(Math.abs(yoyChange) / 50, 1.0) * 2 : 0; // 0-2 points
    const contactPriorityRaw = 10 - Math.min(daysWeight + revenueWeight + declineWeight, 9);
    const contactPriority = Math.max(1, Math.round(contactPriorityRaw));

    // Format last order date in readable Spanish format
    const lastOrderDate = client.lastPurchaseDate ? new Date(client.lastPurchaseDate) : null;
    const lastOrderDateFormatted = lastOrderDate
      ? lastOrderDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';

    // Generate specific suggested action based on priority and context (4 niveles)
    let suggestedAction = '';
    if (isDormant) {
      const discountNeeded = Math.min(Math.floor(daysSince / 30) * 5, 30);
      suggestedAction = `Campaña reactivación: ${discountNeeded}% desc. + envío gratis`;
    } else if (isCritical) {
      const discountNeeded = Math.min(Math.floor(daysSince / 30) * 5, 20);
      suggestedAction = `Llamada urgente: ofrecer ${discountNeeded}% desc.`;
    } else if (isAtRisk) {
      suggestedAction = 'Contacto preventivo: entender necesidades actuales';
    } else if (yoyChange > 10) {
      suggestedAction = 'Upselling: ofrecer mayor volumen o productos complementarios';
    } else {
      suggestedAction = 'Seguimiento de satisfacción';
    }

    // Get top products (already from query, or empty array)
    const topProducts: string[] = client.topProducts || [];

    const clientFocus: ClientFocus = {
      name: client.name,
      clientId: client.clientId,
      priority,
      lastPurchaseDate: client.lastPurchaseDate || '',
      daysSincePurchase: daysSince,
      previousYearRevenue: previousRevenue,
      currentYearRevenue: currentRevenue,
      yoyChange: yoyChange,
      riskScore: Math.min(riskScore, 100),
      recommendedActions,
      // New fields for Sales Plan
      topProducts,
      lastOrderDateFormatted,
      suggestedAction,
      contactPriority
    };

    // Categorizar basado en días sin compra (4 niveles)
    if (isDormant) {
      // Dormidos: 4+ meses sin compra (120+ días) - reactivación agresiva
      dormant.push(clientFocus);
    } else if (isCritical) {
      // Críticos: 3 meses sin compra (90-119 días) - llamada urgente
      critical.push(clientFocus);
    } else if (isAtRisk) {
      // En riesgo: 2 meses sin compra (60-89 días) - contacto preventivo
      atRisk.push(clientFocus);
    } else if (yoyChange > 10 && qtyCurrentYear > 0) {
      // Oportunidades: clientes con crecimiento >10%
      opportunities.push(clientFocus);
    }
  });

  // Ordenar por impacto (revenue perdido o potencial)
  dormant.sort((a, b) => b.previousYearRevenue - a.previousYearRevenue);
  critical.sort((a, b) => b.previousYearRevenue - a.previousYearRevenue);
  atRisk.sort((a, b) => b.previousYearRevenue - a.previousYearRevenue);
  opportunities.sort((a, b) => b.currentYearRevenue - a.currentYearRevenue);

  return { dormant, critical, atRisk, opportunities };
}

/**
 * Categoriza productos según oportunidades
 */
function categorizeProducts(
  products: any[],
  averageMargin: number
): {
  stars: ProductOpportunity[];
  declining: ProductOpportunity[];
  crossSell: ProductOpportunity[];
} {
  const stars: ProductOpportunity[] = [];
  const declining: ProductOpportunity[] = [];
  const crossSell: ProductOpportunity[] = [];

  products.forEach((product: any) => {
    const growthRate = product.growthRate || 0;
    const qtyCurrent = product.qtyCurrentYear || 0;
    const qtyLast = product.qtyLastYear || 0;
    const uniqueClients = product.uniqueClients || 0;
    
    // Usar margen promedio histórico de la empresa (calculado desde datos reales o default)
    // TODO: Si hay datos de costos por producto, calcular profitability real:
    // const profitability = (product.avgUnitPrice - product.avgCost) / product.avgUnitPrice * 100;
    const profitability = averageMargin;

    const productOpp: ProductOpportunity = {
      name: product.name,
      productId: product.productId,
      category: growthRate > 20 && profitability > 15 ? 'star' : growthRate < -20 ? 'declining' : 'crossSell',
      currentVolume: qtyCurrent,
      growthRate: growthRate,
      profitability: profitability,
      uniqueClients: uniqueClients,
      recommendedFocus: growthRate > 20 
        ? 'Producto estrella - aumentar inventario y promoción'
        : growthRate < -20
        ? 'Producto en declive - revisar estrategia o descontinuar'
        : 'Oportunidad de cross-selling con clientes existentes',
      unit: product.unit || 'unidades'
    };

    if (growthRate > 20 && profitability > 15) {
      stars.push(productOpp);
    } else if (growthRate < -20 && qtyLast > 0) {
      declining.push(productOpp);
    } else if (uniqueClients > 5 && qtyCurrent > 0) {
      crossSell.push(productOpp);
    }
  });

  // Ordenar
  stars.sort((a, b) => b.currentVolume - a.currentVolume);
  declining.sort((a, b) => Math.abs(b.growthRate) - Math.abs(a.growthRate));
  crossSell.sort((a, b) => b.uniqueClients - a.uniqueClients);

  return { stars, declining, crossSell };
}

/**
 * Genera recomendaciones estratégicas basadas en el análisis
 */
function generateRecommendations(
  focusClients: { dormant: ClientFocus[]; critical: ClientFocus[]; atRisk: ClientFocus[]; opportunities: ClientFocus[] },
  productOpportunities: { stars: ProductOpportunity[]; declining: ProductOpportunity[]; crossSell: ProductOpportunity[] },
  inactiveClients: any[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Recomendación 1: Clientes dormidos (4+ meses)
  if (focusClients.dormant.length > 0) {
    const totalRevenueAtRisk = focusClients.dormant.reduce((sum, c) => sum + c.previousYearRevenue, 0);
    recommendations.push({
      id: 'rec-1',
      type: 'client',
      priority: 'high',
      title: `Reactivar ${focusClients.dormant.length} clientes dormidos`,
      description: `${focusClients.dormant.length} clientes no han comprado en 4+ meses. Revenue en riesgo: $${totalRevenueAtRisk.toLocaleString('es-MX')}. Requieren campaña de reactivación agresiva.`,
      impact: 'high',
      effort: 'high',
      estimatedValue: totalRevenueAtRisk * 0.2, // 20% de recuperación para dormidos
      relatedEntities: {
        clients: focusClients.dormant.slice(0, 5).map(c => c.name)
      }
    });
  }

  // Recomendación 2: Clientes críticos (3 meses)
  if (focusClients.critical.length > 0) {
    const totalRevenueAtRisk = focusClients.critical.reduce((sum, c) => sum + c.previousYearRevenue, 0);
    recommendations.push({
      id: 'rec-2',
      type: 'client',
      priority: 'high',
      title: `Contactar ${focusClients.critical.length} clientes críticos`,
      description: `${focusClients.critical.length} clientes tienen 3 meses sin comprar. Revenue en riesgo: $${totalRevenueAtRisk.toLocaleString('es-MX')}. Llamada urgente requerida.`,
      impact: 'high',
      effort: 'medium',
      estimatedValue: totalRevenueAtRisk * 0.4, // 40% de recuperación para críticos
      relatedEntities: {
        clients: focusClients.critical.slice(0, 5).map(c => c.name)
      }
    });
  }

  // Recomendación 3: Clientes en riesgo (2 meses)
  if (focusClients.atRisk.length > 0) {
    recommendations.push({
      id: 'rec-3',
      type: 'client',
      priority: 'high',
      title: `Atender ${focusClients.atRisk.length} clientes en riesgo`,
      description: `${focusClients.atRisk.length} clientes tienen 2 meses sin comprar. Contacto preventivo para evitar que se conviertan en críticos.`,
      impact: 'high',
      effort: 'low',
      relatedEntities: {
        clients: focusClients.atRisk.slice(0, 5).map(c => c.name)
      }
    });
  }

  // Recomendación 4: Productos estrella
  if (productOpportunities.stars.length > 0) {
    recommendations.push({
      id: 'rec-4',
      type: 'product',
      priority: 'medium',
      title: `Potenciar ${productOpportunities.stars.length} productos estrella`,
      description: `${productOpportunities.stars.length} productos muestran crecimiento >20% y alta rentabilidad. Aumentar inventario y promoción.`,
      impact: 'high',
      effort: 'low',
      relatedEntities: {
        products: productOpportunities.stars.slice(0, 5).map(p => p.name)
      }
    });
  }

  // Recomendación 5: Productos en declive
  if (productOpportunities.declining.length > 0) {
    recommendations.push({
      id: 'rec-5',
      type: 'product',
      priority: 'medium',
      title: `Revisar ${productOpportunities.declining.length} productos en declive`,
      description: `${productOpportunities.declining.length} productos muestran caída >20%. Evaluar estrategia de precios, promoción o descontinuación.`,
      impact: 'medium',
      effort: 'medium',
      relatedEntities: {
        products: productOpportunities.declining.slice(0, 5).map(p => p.name)
      }
    });
  }

  // Recomendación 6: Oportunidades de crecimiento
  if (focusClients.opportunities.length > 0) {
    const totalPotential = focusClients.opportunities.reduce((sum, c) => sum + c.currentYearRevenue, 0);
    recommendations.push({
      id: 'rec-6',
      type: 'strategy',
      priority: 'medium',
      title: `Capitalizar ${focusClients.opportunities.length} clientes en crecimiento`,
      description: `${focusClients.opportunities.length} clientes muestran crecimiento >10%. Oportunidad de aumentar volumen y frecuencia.`,
      impact: 'medium',
      effort: 'low',
      estimatedValue: totalPotential * 0.2, // 20% de crecimiento adicional
      relatedEntities: {
        clients: focusClients.opportunities.slice(0, 5).map(c => c.name)
      }
    });
  }

  return recommendations;
}

/**
 * Genera action items prioritarios con contexto específico y urgencia
 */
function generateActionItems(
  focusClients: { dormant: ClientFocus[]; critical: ClientFocus[]; atRisk: ClientFocus[] },
  inactiveClients: any[],
  recommendations: Recommendation[]
): ActionItem[] {
  const actionItems: ActionItem[] = [];

  // Action items para clientes dormidos (top 3)
  focusClients.dormant.slice(0, 3).forEach((client, index) => {
    const monthsWithoutPurchase = Math.floor(client.daysSincePurchase / 30);
    const discountNeeded = Math.min(Math.floor(client.daysSincePurchase / 30) * 5, 30);

    actionItems.push({
      id: `action-dormant-${index + 1}`,
      title: `REACTIVAR: ${client.name}`,
      description: `Cliente dormido: ${client.daysSincePurchase} días sin compra (${monthsWithoutPurchase} meses). ` +
                   `Revenue histórico: $${client.previousYearRevenue.toLocaleString('es-MX')}. ` +
                   `Risk score: ${client.riskScore.toFixed(0)}/100. ` +
                   `Acción recomendada: Campaña de reactivación agresiva con ${discountNeeded}% de descuento. ` +
                   `Última compra: ${new Date(client.lastPurchaseDate).toLocaleDateString('es-MX')}.`,
      priority: 'critical',
      status: 'pending',
      relatedRecommendationId: 'rec-1'
    });
  });

  // Action items para clientes críticos (top 3)
  focusClients.critical.slice(0, 3).forEach((client, index) => {
    const monthsWithoutPurchase = Math.floor(client.daysSincePurchase / 30);
    const discountNeeded = Math.min(Math.floor(client.daysSincePurchase / 30) * 5, 20);

    actionItems.push({
      id: `action-critical-${index + 1}`,
      title: `URGENTE: Contactar ${client.name}`,
      description: `Cliente crítico: ${client.daysSincePurchase} días sin compra (${monthsWithoutPurchase} meses). ` +
                   `Revenue histórico: $${client.previousYearRevenue.toLocaleString('es-MX')}. ` +
                   `Risk score: ${client.riskScore.toFixed(0)}/100. ` +
                   `Acción recomendada: Llamada inmediata + oferta del ${discountNeeded}%. ` +
                   `Última compra: ${new Date(client.lastPurchaseDate).toLocaleDateString('es-MX')}.`,
      priority: 'critical',
      status: 'pending',
      relatedRecommendationId: 'rec-2'
    });
  });

  // Action items para clientes en riesgo (top 3)
  focusClients.atRisk.slice(0, 3).forEach((client, index) => {
    const monthsWithoutPurchase = Math.floor(client.daysSincePurchase / 30);

    actionItems.push({
      id: `action-atrisk-${index + 1}`,
      title: `PREVENTIVO: Seguimiento a ${client.name}`,
      description: `Cliente en riesgo: ${client.daysSincePurchase} días sin compra (${monthsWithoutPurchase} meses). ` +
                   `Revenue histórico: $${client.previousYearRevenue.toLocaleString('es-MX')}. ` +
                   `Risk score: ${client.riskScore.toFixed(0)}/100. ` +
                   `Acción recomendada: Contacto preventivo para entender necesidades.`,
      priority: 'high',
      status: 'pending',
      relatedRecommendationId: 'rec-3'
    });
  });

  return actionItems;
}

/**
 * Calcula análisis de riesgo con normalización estadística
 */
function calculateRiskAnalysis(
  focusClients: { dormant: ClientFocus[]; critical: ClientFocus[]; atRisk: ClientFocus[] },
  inactiveClients: any[]
): {
  churnRisk: number;
  revenueAtRisk: number;
  topRisks: RiskFactor[];
} {
  const dormantCount = focusClients.dormant.length;
  const criticalCount = focusClients.critical.length;
  const atRiskCount = focusClients.atRisk.length;
  const inactiveCount = inactiveClients.length;

  // Calcular revenue en riesgo (ponderado por urgencia)
  const revenueAtRisk =
    focusClients.dormant.reduce((sum, c) => sum + c.previousYearRevenue, 0) +      // 100% en riesgo
    focusClients.critical.reduce((sum, c) => sum + c.previousYearRevenue * 0.8, 0) + // 80% en riesgo
    focusClients.atRisk.reduce((sum, c) => sum + c.previousYearRevenue * 0.5, 0) +   // 50% en riesgo
    inactiveClients.reduce((sum, ic) => sum + (ic.previousYearRevenue || 0), 0);

  // Calcular churn risk score normalizado (0-100) con ponderación estadística
  const maxExpectedDormant = 10;  // Máximo esperado de clientes dormidos
  const maxExpectedCritical = 15; // Máximo esperado de clientes críticos
  const maxExpectedAtRisk = 20;   // Máximo esperado de clientes en riesgo
  const maxExpectedInactive = 30; // Máximo esperado de inactivos
  const maxExpectedRevenue = 2000000; // $2M máximo esperado en riesgo

  const dormantScore = Math.min(dormantCount / maxExpectedDormant, 1.0);
  const criticalScore = Math.min(criticalCount / maxExpectedCritical, 1.0);
  const atRiskScore = Math.min(atRiskCount / maxExpectedAtRisk, 1.0);
  const inactiveScore = Math.min(inactiveCount / maxExpectedInactive, 1.0);
  const revenueScore = Math.min(revenueAtRisk / maxExpectedRevenue, 1.0);

  // Ponderación basada en importancia estadística
  const churnRisk = (
    dormantScore * 0.30 +     // 30% peso en clientes dormidos
    criticalScore * 0.25 +    // 25% peso en clientes críticos
    atRiskScore * 0.15 +      // 15% peso en clientes en riesgo
    inactiveScore * 0.10 +    // 10% peso en inactivos
    revenueScore * 0.20       // 20% peso en revenue en riesgo
  ) * 100;

  const normalizedChurnRisk = Math.min(Math.max(churnRisk, 0), 100);

  // Top riesgos
  const topRisks: RiskFactor[] = [];

  if (dormantCount > 0) {
    topRisks.push({
      type: 'client_inactivity',
      severity: 'high',
      description: `${dormantCount} clientes dormidos (4+ meses sin compra)`,
      affectedCount: dormantCount,
      estimatedImpact: focusClients.dormant.reduce((sum, c) => sum + c.previousYearRevenue, 0)
    });
  }

  if (criticalCount > 0) {
    topRisks.push({
      type: 'client_inactivity',
      severity: 'high',
      description: `${criticalCount} clientes críticos (3 meses sin compra)`,
      affectedCount: criticalCount,
      estimatedImpact: focusClients.critical.reduce((sum, c) => sum + c.previousYearRevenue, 0)
    });
  }

  if (atRiskCount > 0) {
    topRisks.push({
      type: 'revenue_decline',
      severity: 'medium',
      description: `${atRiskCount} clientes en riesgo (2 meses sin compra)`,
      affectedCount: atRiskCount,
      estimatedImpact: focusClients.atRisk.reduce((sum, c) => sum + c.previousYearRevenue * 0.5, 0)
    });
  }

  if (inactiveCount > 0) {
    topRisks.push({
      type: 'churn',
      severity: inactiveCount > 10 ? 'high' : 'medium',
      description: `${inactiveCount} clientes inactivos (compraron año anterior, no este año)`,
      affectedCount: inactiveCount,
      estimatedImpact: inactiveClients.reduce((sum, ic) => sum + (ic.previousYearRevenue || 0), 0)
    });
  }

  topRisks.sort((a, b) => b.estimatedImpact - a.estimatedImpact);

  return {
    churnRisk: normalizedChurnRisk,
    revenueAtRisk,
    topRisks: topRisks.slice(0, 5)
  };
}

