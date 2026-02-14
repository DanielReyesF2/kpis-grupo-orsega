/**
 * Tipos TypeScript compartidos para el módulo de Analista de Ventas
 * Estos tipos son compartidos entre backend y frontend
 */

export interface ClientFocus {
  name: string;
  clientId: number | null;
  priority: 'dormant' | 'critical' | 'at-risk' | 'opportunity';  // 4 niveles de prioridad
  lastPurchaseDate: string;
  daysSincePurchase: number;
  previousYearRevenue: number;
  currentYearRevenue: number;
  yoyChange: number;
  riskScore: number; // 0-100
  recommendedActions: string[];
  // Fields for Sales Plan
  topProducts: string[];        // Top 3 productos que compraba
  lastOrderDateFormatted: string;  // Fecha legible del último pedido (ej: "15-May-2024")
  suggestedAction: string;      // Acción específica sugerida
  contactPriority: number;      // 1-10 para ordenar (1 = más urgente)
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
    dormant: ClientFocus[];       // 4+ meses (120+ días) sin compra - reactivación agresiva
    critical: ClientFocus[];      // 3 meses (90-119 días) sin compra - llamada urgente
    atRisk: ClientFocus[];        // 2 meses (60-89 días) sin compra - contacto preventivo
    opportunities: ClientFocus[]; // Creciendo >10% - upselling/cross-selling
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
    dormantDaysThreshold: number;       // Umbral para clientes dormidos (4 meses = 120 días)
    criticalDaysThreshold: number;      // Umbral para clientes críticos (3 meses = 90 días)
    atRiskDaysThreshold: number;        // Umbral para clientes en riesgo (2 meses = 60 días)
    highValueRevenueThreshold: number;  // Umbral para revenue alto valor
    yoyStats: {
      mean: number;                     // Media de cambios YoY
      stdDev: number;                   // Desviación estándar de cambios YoY
    };
    averageMargin: number;              // Margen promedio histórico
    aiInsights?: string;                // Resumen ejecutivo generado por IA
  };
}

