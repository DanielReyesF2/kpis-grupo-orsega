/**
 * Tipos TypeScript compartidos para el módulo de Analista de Ventas
 * Estos tipos son compartidos entre backend y frontend
 */

export interface ClientFocus {
  name: string;
  clientId: number | null;
  priority: 'critical' | 'warning' | 'opportunity';
  lastPurchaseDate: string;
  daysSincePurchase: number;
  previousYearRevenue: number;
  currentYearRevenue: number;
  yoyChange: number;
  riskScore: number; // 0-100
  recommendedActions: string[];
}

export interface ProductOpportunity {
  name: string;
  productId: number | null;
  category: 'star' | 'declining' | 'crossSell';
  currentVolume: number;
  growthRate: number;
  profitability: number;
  uniqueClients: number;
  recommendedFocus: string;
  unit: string;
}

export interface Recommendation {
  id: string;
  type: 'client' | 'product' | 'strategy' | 'risk';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  estimatedValue?: number;
  relatedEntities: {
    clients?: string[];
    products?: string[];
  };
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dueDate?: string;
  assignedTo?: string;
  status: 'pending' | 'in-progress' | 'completed';
  relatedRecommendationId?: string;
}

export interface RiskFactor {
  type: 'churn' | 'revenue_decline' | 'client_inactivity' | 'product_decline';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedCount: number;
  estimatedImpact: number;
}

export interface SalesAnalystInsights {
  metadata: {
    companyId: number;
    generatedAt: string;
    period: {
      start: string;
      end: string;
    };
  };
  focusClients: {
    critical: ClientFocus[];      // 6+ meses (180 días) sin compra
    warning: ClientFocus[];       // 3-6 meses (90-180 días) sin compra
    opportunities: ClientFocus[]; // Creciendo >10%
  };
  productOpportunities: {
    stars: ProductOpportunity[];      // Alto crecimiento + alta rentabilidad
    declining: ProductOpportunity[];   // Requieren atención
    crossSell: ProductOpportunity[]; // Oportunidades de cross-selling
  };
  inactiveClients: Array<{
    name: string;
    clientId: number | null;
    lastPurchaseDate: string;
    previousYearRevenue: number;
    daysSincePurchase: number;
  }>;
  strategicRecommendations: Recommendation[];
  actionItems: ActionItem[];
  riskAnalysis: {
    churnRisk: number;           // 0-100
    revenueAtRisk: number;        // Revenue en riesgo
    topRisks: RiskFactor[];
  };
  statisticalContext?: {
    criticalDaysThreshold: number;      // Umbral para clientes críticos (6 meses = 180 días)
    warningDaysThreshold: number;       // Umbral para clientes en riesgo (3 meses = 90 días)
    highValueRevenueThreshold: number;  // Umbral para revenue alto valor
    yoyStats: {
      mean: number;                     // Media de cambios YoY
      stdDev: number;                   // Desviación estándar de cambios YoY
    };
    averageMargin: number;              // Margen promedio histórico
    aiInsights?: string;                // Resumen ejecutivo generado por IA
  };
}

