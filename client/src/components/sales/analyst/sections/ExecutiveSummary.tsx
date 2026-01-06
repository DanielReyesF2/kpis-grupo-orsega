/**
 * Sección de Resumen Ejecutivo
 * Muestra KPIs clave y métricas de riesgo
 */

import { useMemo } from "react";
import { AlertTriangle, TrendingUp, DollarSign, Users } from "lucide-react";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";
import { cn } from "@/lib/utils";

interface ExecutiveSummaryProps {
  insights: SalesAnalystInsights;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ExecutiveSummary({ insights }: ExecutiveSummaryProps) {
  const criticalCount = insights.focusClients.critical.length;
  const warningCount = insights.focusClients.warning.length;
  const opportunitiesCount = insights.focusClients.opportunities.length;
  const inactiveCount = insights.inactiveClients.length;
  const revenueAtRisk = insights.riskAnalysis.revenueAtRisk;
  const churnRisk = insights.riskAnalysis.churnRisk;

  const riskLevel = useMemo(() => {
    if (churnRisk >= 70) return { label: 'Alto', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' };
    if (churnRisk >= 40) return { label: 'Medio', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' };
    return { label: 'Bajo', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' };
  }, [churnRisk]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Clientes Críticos */}
      <ChartCard
        title="Clientes Críticos"
        subtitle={`${criticalCount} requieren atención inmediata`}
      >
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-red-600">{criticalCount}</span>
            <span className="text-sm text-muted-foreground">clientes</span>
          </div>
          <p className="text-xs text-muted-foreground">
            60+ días sin compra
          </p>
        </div>
      </ChartCard>

      {/* Clientes en Riesgo */}
      <ChartCard
        title="Clientes en Riesgo"
        subtitle={`${warningCount} con caída significativa`}
      >
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-600">{warningCount}</span>
            <span className="text-sm text-muted-foreground">clientes</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Caída >30% vs año anterior
          </p>
        </div>
      </ChartCard>

      {/* Revenue en Riesgo */}
      <ChartCard
        title="Revenue en Riesgo"
        subtitle="Pérdida potencial estimada"
      >
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">
              {formatCurrency(revenueAtRisk)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            De clientes críticos y en riesgo
          </p>
        </div>
      </ChartCard>

      {/* Churn Risk Score */}
      <ChartCard
        title="Riesgo de Churn"
        subtitle={`Nivel: ${riskLevel.label}`}
      >
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold", riskLevel.color)}>
              {churnRisk}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn("h-2 rounded-full transition-all", riskLevel.bg, riskLevel.color.replace('text-', 'bg-'))}
              style={{ width: `${churnRisk}%` }}
            />
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

