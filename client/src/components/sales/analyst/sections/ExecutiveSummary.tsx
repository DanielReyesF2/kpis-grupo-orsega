/**
 * Sección de Resumen Ejecutivo
 * Muestra KPIs clave y métricas de riesgo
 */

import { useMemo } from "react";
import { AlertTriangle, TrendingUp, DollarSign, Users, Info } from "lucide-react";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { formatCurrency } from "@/lib/sales-utils";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExecutiveSummaryProps {
  insights: SalesAnalystInsights;
  companyId: number;
}

export function ExecutiveSummary({ insights, companyId }: ExecutiveSummaryProps) {
  const criticalCount = insights.focusClients.critical.length;
  const warningCount = insights.focusClients.warning.length;
  const opportunitiesCount = insights.focusClients.opportunities.length;
  const inactiveCount = insights.inactiveClients.length;
  const revenueAtRisk = insights.riskAnalysis.revenueAtRisk;
  const churnRisk = insights.riskAnalysis.churnRisk;

  const riskLevel = useMemo(() => {
    if (churnRisk >= 70) return { label: 'Alto', color: 'text-red-600', bg: 'bg-red-50' };
    if (churnRisk >= 40) return { label: 'Medio', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Bajo', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  }, [churnRisk]);

  const statisticalContext = insights.statisticalContext;

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clientes Críticos */}
        <ChartCard
          title="Clientes Críticos"
          subtitle={`${criticalCount} requieren atención inmediata`}
        >
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <span className="text-3xl font-bold text-red-600">{criticalCount}</span>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold">Umbral adaptativo:</p>
                    <p className="text-sm">
                      {statisticalContext?.criticalDaysThreshold 
                        ? `${Math.round(statisticalContext.criticalDaysThreshold)} días (percentil 90 histórico)`
                        : '60 días (default)'}
                    </p>
                    <p className="font-semibold mt-2">Criterio:</p>
                    <p className="text-sm">
                      Clientes con {statisticalContext?.criticalDaysThreshold 
                        ? `más de ${Math.round(statisticalContext.criticalDaysThreshold)} días`
                        : 'más de 60 días'} sin compra y revenue histórico superior a {statisticalContext?.highValueRevenueThreshold 
                        ? formatCurrency(statisticalContext.highValueRevenueThreshold, companyId)
                        : formatCurrency(10000, companyId)}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
              <span className="text-sm text-muted-foreground">clientes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {statisticalContext?.criticalDaysThreshold 
                ? `${Math.round(statisticalContext.criticalDaysThreshold)}+ días sin compra`
                : '60+ días sin compra'}
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <span className="text-3xl font-bold text-amber-600">{warningCount}</span>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">Validación estadística:</p>
                  <p className="text-sm">
                    Clientes con caída anómala detectada usando Z-score (Z {'>'} 2.0 = 95% confianza)
                  </p>
                  {statisticalContext?.yoyStats && (
                    <>
                      <p className="font-semibold mt-2">Baseline histórico:</p>
                      <p className="text-sm">
                        Media: {statisticalContext.yoyStats.mean.toFixed(1)}%
                      </p>
                      <p className="text-sm">
                        Desv. Est.: {statisticalContext.yoyStats.stdDev.toFixed(1)}%
                      </p>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
            <span className="text-sm text-muted-foreground">clientes</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Caída anómala detectada (Z-score {'>'} 2.0)
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
              {formatCurrency(revenueAtRisk, companyId)}
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <span className={cn("text-3xl font-bold", riskLevel.color)}>
                    {Math.round(churnRisk)}
                  </span>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">Cálculo normalizado:</p>
                  <p className="text-sm">
                    Score calculado con ponderación estadística:
                  </p>
                  <ul className="text-sm list-disc list-inside space-y-0.5 ml-2">
                    <li>35% clientes críticos</li>
                    <li>25% clientes en riesgo</li>
                    <li>20% clientes inactivos</li>
                    <li>20% revenue en riesgo</li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
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
    </TooltipProvider>
  );
}

