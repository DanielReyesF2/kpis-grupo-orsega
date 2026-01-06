/**
 * Módulo de Analista de Ventas
 * Proporciona análisis estratégico consolidado para el jefe de ventas
 * 
 * Optimizaciones:
 * - Usa CTEs para calcular múltiples métricas en una sola query
 * - Agrupa cálculos relacionados para mejor performance
 * - Genera recomendaciones estratégicas basadas en datos históricos
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
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

/**
 * Genera insights completos del analista de ventas
 * @param companyId - ID de la empresa (1 = Dura, 2 = Orsega)
 * @returns Insights completos con análisis estratégico
 */
export async function generateSalesAnalystInsights(
  companyId: number
): Promise<SalesAnalystInsights> {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const now = new Date();
  const periodStart = new Date(currentYear, 0, 1).toISOString().split('T')[0];
  const periodEnd = now.toISOString().split('T')[0];

  // Query consolidada usando CTEs para optimizar performance
  const consolidatedQuery = `
    WITH 
    -- Estadísticas de clientes por año
    client_stats AS (
      SELECT
        client_name,
        MAX(client_id) as client_id,
        MAX(sale_date) as last_purchase_date,
        SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) as qty_current_year,
        SUM(CASE WHEN sale_year = $3 THEN quantity ELSE 0 END) as qty_last_year,
        SUM(CASE WHEN sale_year = $2 THEN total_amount ELSE 0 END) as amt_current_year,
        SUM(CASE WHEN sale_year = $3 THEN total_amount ELSE 0 END) as amt_last_year,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = $1
        AND client_name IS NOT NULL AND client_name <> ''
      GROUP BY client_name
    ),
    -- Estadísticas de productos por año
    product_stats AS (
      SELECT
        product_name,
        MAX(product_id) as product_id,
        SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) as qty_current_year,
        SUM(CASE WHEN sale_year = $3 THEN quantity ELSE 0 END) as qty_last_year,
        SUM(CASE WHEN sale_year = $2 THEN total_amount ELSE 0 END) as amt_current_year,
        SUM(CASE WHEN sale_year = $3 THEN total_amount ELSE 0 END) as amt_last_year,
        COUNT(DISTINCT client_name) as unique_clients,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = $1
        AND product_name IS NOT NULL AND product_name <> ''
      GROUP BY product_name
    ),
    -- Clientes inactivos (compraron año anterior pero no este año)
    inactive_clients AS (
      SELECT
        cs.client_name,
        cs.client_id,
        cs.last_purchase_date,
        cs.amt_last_year as previous_year_revenue,
        CURRENT_DATE - cs.last_purchase_date::date as days_since_purchase
      FROM client_stats cs
      WHERE cs.qty_last_year > 0 AND cs.qty_current_year = 0
    )
    SELECT
      'client' as data_type,
      jsonb_build_object(
        'name', cs.client_name,
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
        'unit', cs.unit
      ) as data
    FROM client_stats cs
    WHERE cs.qty_last_year > 0 OR cs.qty_current_year > 0
    
    UNION ALL
    
    SELECT
      'product' as data_type,
      jsonb_build_object(
        'name', ps.product_name,
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
        'name', ic.client_name,
        'clientId', ic.client_id,
        'lastPurchaseDate', ic.last_purchase_date,
        'previousYearRevenue', ic.previous_year_revenue,
        'daysSincePurchase', ic.days_since_purchase
      ) as data
    FROM inactive_clients ic
  `;

  const results = await sql(consolidatedQuery, [companyId, currentYear, lastYear]);

  // Separar resultados por tipo
  const clientData = results.filter((r: any) => r.data_type === 'client').map((r: any) => r.data);
  const productData = results.filter((r: any) => r.data_type === 'product').map((r: any) => r.data);
  const inactiveData = results.filter((r: any) => r.data_type === 'inactive').map((r: any) => r.data);

  // Procesar clientes y categorizar
  const focusClients = categorizeClients(clientData);
  
  // Procesar productos y categorizar
  const productOpportunities = categorizeProducts(productData);
  
  // Generar recomendaciones estratégicas
  const recommendations = generateRecommendations(focusClients, productOpportunities, inactiveData);
  
  // Generar action items
  const actionItems = generateActionItems(focusClients, inactiveData, recommendations);
  
  // Análisis de riesgo
  const riskAnalysis = calculateRiskAnalysis(focusClients, inactiveData);

  return {
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
    riskAnalysis
  };
}

/**
 * Categoriza clientes según su estado y prioridad
 */
function categorizeClients(clients: any[]): {
  critical: ClientFocus[];
  warning: ClientFocus[];
  opportunities: ClientFocus[];
} {
  const critical: ClientFocus[] = [];
  const warning: ClientFocus[] = [];
  const opportunities: ClientFocus[] = [];

  clients.forEach((client: any) => {
    const daysSince = client.daysSincePurchase || 0;
    const yoyChange = client.yoyChange || 0;
    const previousRevenue = client.previousYearRevenue || 0;
    const currentRevenue = client.currentYearRevenue || 0;
    const qtyLastYear = client.qtyLastYear || 0;
    const qtyCurrentYear = client.qtyCurrentYear || 0;

    // Calcular risk score (0-100)
    let riskScore = 0;
    if (daysSince > 60) riskScore += 40;
    if (daysSince > 90) riskScore += 20;
    if (yoyChange < -30) riskScore += 30;
    if (yoyChange < -50) riskScore += 10;
    if (previousRevenue > 100000 && qtyCurrentYear === 0) riskScore += 20;

    // Generar acciones recomendadas
    const recommendedActions: string[] = [];
    if (daysSince > 60) {
      recommendedActions.push(`Contactar cliente (${Math.floor(daysSince / 30)} meses sin compra)`);
    }
    if (yoyChange < -30) {
      recommendedActions.push(`Investigar causa de caída del ${Math.abs(yoyChange).toFixed(1)}%`);
    }
    if (previousRevenue > 50000 && qtyCurrentYear === 0) {
      recommendedActions.push('Ofrecer promoción especial para reactivación');
    }
    if (yoyChange > 10) {
      recommendedActions.push('Aumentar frecuencia de contacto');
      recommendedActions.push('Explorar oportunidades de upselling');
    }

    const clientFocus: ClientFocus = {
      name: client.name,
      clientId: client.clientId,
      priority: daysSince > 60 ? 'critical' : yoyChange < -30 ? 'warning' : 'opportunity',
      lastPurchaseDate: client.lastPurchaseDate || '',
      daysSincePurchase: daysSince,
      previousYearRevenue: previousRevenue,
      currentYearRevenue: currentRevenue,
      yoyChange: yoyChange,
      riskScore: Math.min(riskScore, 100),
      recommendedActions
    };

    if (daysSince > 60 && previousRevenue > 10000) {
      critical.push(clientFocus);
    } else if (yoyChange < -30 && qtyLastYear > 0) {
      warning.push(clientFocus);
    } else if (yoyChange > 10 && qtyCurrentYear > 0) {
      opportunities.push(clientFocus);
    }
  });

  // Ordenar por impacto (revenue perdido o potencial)
  critical.sort((a, b) => b.previousYearRevenue - a.previousYearRevenue);
  warning.sort((a, b) => Math.abs(b.yoyChange) - Math.abs(a.yoyChange));
  opportunities.sort((a, b) => b.currentYearRevenue - a.currentYearRevenue);

  return { critical, warning, opportunities };
}

/**
 * Categoriza productos según oportunidades
 */
function categorizeProducts(products: any[]): {
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
    
    // Calcular rentabilidad aproximada (asumiendo margen estándar)
    // En producción, esto debería venir de datos reales de costos
    const profitability = 18; // Placeholder - debería calcularse desde datos reales

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
  focusClients: { critical: ClientFocus[]; warning: ClientFocus[]; opportunities: ClientFocus[] },
  productOpportunities: { stars: ProductOpportunity[]; declining: ProductOpportunity[]; crossSell: ProductOpportunity[] },
  inactiveClients: any[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Recomendación 1: Clientes críticos
  if (focusClients.critical.length > 0) {
    const totalRevenueAtRisk = focusClients.critical.reduce((sum, c) => sum + c.previousYearRevenue, 0);
    recommendations.push({
      id: 'rec-1',
      type: 'client',
      priority: 'high',
      title: `Reactivar ${focusClients.critical.length} clientes críticos`,
      description: `${focusClients.critical.length} clientes de alto valor no han comprado en más de 60 días. Revenue en riesgo: $${totalRevenueAtRisk.toLocaleString('es-MX')}`,
      impact: 'high',
      effort: 'medium',
      estimatedValue: totalRevenueAtRisk * 0.3, // Asumiendo 30% de recuperación
      relatedEntities: {
        clients: focusClients.critical.slice(0, 5).map(c => c.name)
      }
    });
  }

  // Recomendación 2: Clientes en riesgo
  if (focusClients.warning.length > 0) {
    recommendations.push({
      id: 'rec-2',
      type: 'client',
      priority: 'high',
      title: `Atender ${focusClients.warning.length} clientes con caída significativa`,
      description: `${focusClients.warning.length} clientes muestran caída >30% vs año anterior. Requieren atención inmediata para evitar pérdida total.`,
      impact: 'high',
      effort: 'medium',
      relatedEntities: {
        clients: focusClients.warning.slice(0, 5).map(c => c.name)
      }
    });
  }

  // Recomendación 3: Productos estrella
  if (productOpportunities.stars.length > 0) {
    recommendations.push({
      id: 'rec-3',
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

  // Recomendación 4: Productos en declive
  if (productOpportunities.declining.length > 0) {
    recommendations.push({
      id: 'rec-4',
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

  // Recomendación 5: Oportunidades de crecimiento
  if (focusClients.opportunities.length > 0) {
    const totalPotential = focusClients.opportunities.reduce((sum, c) => sum + c.currentYearRevenue, 0);
    recommendations.push({
      id: 'rec-5',
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
 * Genera action items prioritarios
 */
function generateActionItems(
  focusClients: { critical: ClientFocus[]; warning: ClientFocus[] },
  inactiveClients: any[],
  recommendations: Recommendation[]
): ActionItem[] {
  const actionItems: ActionItem[] = [];

  // Action items para clientes críticos (top 5)
  focusClients.critical.slice(0, 5).forEach((client, index) => {
    actionItems.push({
      id: `action-critical-${index + 1}`,
      title: `Contactar ${client.name}`,
      description: `Cliente crítico: ${client.daysSincePurchase} días sin compra. Revenue histórico: $${client.previousYearRevenue.toLocaleString('es-MX')}`,
      priority: 'critical',
      status: 'pending',
      relatedRecommendationId: 'rec-1'
    });
  });

  // Action items para clientes en riesgo (top 3)
  focusClients.warning.slice(0, 3).forEach((client, index) => {
    actionItems.push({
      id: `action-warning-${index + 1}`,
      title: `Investigar caída en ${client.name}`,
      description: `Caída del ${Math.abs(client.yoyChange).toFixed(1)}% vs año anterior`,
      priority: 'high',
      status: 'pending',
      relatedRecommendationId: 'rec-2'
    });
  });

  return actionItems;
}

/**
 * Calcula análisis de riesgo
 */
function calculateRiskAnalysis(
  focusClients: { critical: ClientFocus[]; warning: ClientFocus[] },
  inactiveClients: any[]
): {
  churnRisk: number;
  revenueAtRisk: number;
  topRisks: RiskFactor[];
} {
  const criticalCount = focusClients.critical.length;
  const warningCount = focusClients.warning.length;
  const inactiveCount = inactiveClients.length;
  
  // Calcular revenue en riesgo
  const revenueAtRisk = 
    focusClients.critical.reduce((sum, c) => sum + c.previousYearRevenue, 0) +
    focusClients.warning.reduce((sum, c) => sum + c.previousYearRevenue * 0.5, 0) +
    inactiveClients.reduce((sum, ic) => sum + (ic.previousYearRevenue || 0), 0);

  // Calcular churn risk score (0-100)
  let churnRisk = 0;
  if (criticalCount > 10) churnRisk += 30;
  else if (criticalCount > 5) churnRisk += 20;
  else if (criticalCount > 0) churnRisk += 10;

  if (warningCount > 10) churnRisk += 25;
  else if (warningCount > 5) churnRisk += 15;
  else if (warningCount > 0) churnRisk += 10;

  if (inactiveCount > 20) churnRisk += 25;
  else if (inactiveCount > 10) churnRisk += 15;
  else if (inactiveCount > 0) churnRisk += 10;

  if (revenueAtRisk > 1000000) churnRisk += 20;
  else if (revenueAtRisk > 500000) churnRisk += 15;
  else if (revenueAtRisk > 100000) churnRisk += 10;

  churnRisk = Math.min(churnRisk, 100);

  // Top riesgos
  const topRisks: RiskFactor[] = [];

  if (criticalCount > 0) {
    topRisks.push({
      type: 'client_inactivity',
      severity: 'high',
      description: `${criticalCount} clientes críticos sin compra en 60+ días`,
      affectedCount: criticalCount,
      estimatedImpact: focusClients.critical.reduce((sum, c) => sum + c.previousYearRevenue, 0)
    });
  }

  if (warningCount > 0) {
    topRisks.push({
      type: 'revenue_decline',
      severity: 'high',
      description: `${warningCount} clientes con caída >30%`,
      affectedCount: warningCount,
      estimatedImpact: focusClients.warning.reduce((sum, c) => sum + c.previousYearRevenue * 0.3, 0)
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
    churnRisk,
    revenueAtRisk,
    topRisks: topRisks.slice(0, 5)
  };
}

