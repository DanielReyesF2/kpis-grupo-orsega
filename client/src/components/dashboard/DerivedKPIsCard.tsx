/**
 * Derived KPIs Card - Indicadores de salud con status y metas
 * Replica la sección "KPIs Derivados - Recomendaciones" del análisis Nova
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface DerivedKPIsCardProps {
  companyId: number;
  year: number;
  month: number;
}

interface KPIRow {
  label: string;
  value: string;
  status: 'healthy' | 'alert' | 'critical';
  target: string;
}

const statusConfig = {
  healthy: { label: 'Saludable', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  alert: { label: 'Alerta', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  critical: { label: 'Crítico', className: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' },
};

export function DerivedKPIsCard({ companyId, year, month }: DerivedKPIsCardProps) {
  const { data: financial, isLoading: isLoadingFinancial } = useMonthlyFinancial(companyId, year, month);
  const { data: insights, isLoading: isLoadingInsights } = useSalesAnalyst(companyId);

  const { data: salesStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/sales-stats", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 30000,
  });

  const { data: topClients } = useQuery({
    queryKey: ["/api/sales-top-clients", companyId, "month", 10],
    queryFn: async () => {
      const res = await apiRequest("GET",
        `/api/sales-top-clients?companyId=${companyId}&period=month&limit=10&sortBy=revenue`);
      return await res.json();
    },
    staleTime: 60000,
  });

  const isLoading = isLoadingFinancial || isLoadingInsights || isLoadingStats;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const fm: { totalRevenueMXN: number; totalRevenueUSD: number; totalCostMXN: number; grossProfitMXN: number; grossMarginPercent: number; avgTransactionValue: number; totalTransactions: number; totalItems: number; totalQuantity: number; unit: string } | undefined = financial?.financialMetrics;
  const churnRisk = insights?.riskAnalysis?.churnRisk ?? 0;
  const growth = salesStats?.growth ?? 0;
  const activeClients = salesStats?.activeClients ?? 0;
  const retentionRate = salesStats?.retentionRate?.rate ?? 0;

  // Concentration (top 1 client %)
  const clients = (topClients || []).slice(0, 10);
  const totalRevenue = clients.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
  const top1Pct = totalRevenue > 0 && clients[0] ? (clients[0].revenue / totalRevenue) * 100 : 0;

  // Build KPI rows
  const kpis: KPIRow[] = [
    {
      label: 'Margen Bruto',
      value: fm ? `${fm.grossMarginPercent.toFixed(1)}%` : 'N/A',
      status: fm && fm.grossMarginPercent >= 15 ? 'healthy' : fm && fm.grossMarginPercent >= 8 ? 'alert' : 'critical',
      target: '>10%',
    },
    {
      label: 'Concentración (Top 1)',
      value: `${top1Pct.toFixed(1)}%`,
      status: top1Pct < 30 ? 'healthy' : top1Pct < 45 ? 'alert' : 'critical',
      target: '<30%',
    },
    {
      label: 'Diversificación',
      value: `${activeClients} clientes`,
      status: activeClients >= 15 ? 'healthy' : activeClients >= 10 ? 'alert' : 'critical',
      target: '>10',
    },
    {
      label: 'Riesgo de Churn',
      value: `${churnRisk}/100`,
      status: churnRisk < 40 ? 'healthy' : churnRisk < 70 ? 'alert' : 'critical',
      target: '<40',
    },
    {
      label: 'Tasa de Retención',
      value: retentionRate > 0 ? `${retentionRate.toFixed(1)}%` : 'N/A',
      status: retentionRate >= 85 ? 'healthy' : retentionRate >= 70 ? 'alert' : 'critical',
      target: '>85%',
    },
    {
      label: 'Crecimiento YoY',
      value: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`,
      status: growth >= 5 ? 'healthy' : growth >= 0 ? 'alert' : 'critical',
      target: '>5%',
    },
    {
      label: 'Ticket Promedio',
      value: fm ? formatCurrency(fm.avgTransactionValue, companyId) : 'N/A',
      status: 'healthy', // Always healthy since target is dynamic
      target: 'Dinámico',
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Indicadores de Salud
          </CardTitle>
          <Badge variant="outline" className="text-xs">{kpis.length} KPIs</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 pr-2">Indicador</th>
                <th className="text-right py-2 pr-2">Valor</th>
                <th className="text-center py-2 pr-2">Status</th>
                <th className="text-right py-2">Meta</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi, idx) => {
                const sc = statusConfig[kpi.status];
                return (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2.5 pr-2 font-medium">{kpi.label}</td>
                    <td className="py-2.5 pr-2 text-right font-semibold">{kpi.value}</td>
                    <td className="py-2.5 pr-2 text-center">
                      <Badge variant="outline" className={cn("text-xs", sc.className)}>
                        {sc.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted-foreground">{kpi.target}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
