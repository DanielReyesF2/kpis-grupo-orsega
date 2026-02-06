/**
 * Monthly Trend Card - Tendencia de ingresos + Distribución semanal + Tipo de cambio
 * Expande la sección "Tendencias y Patrones" del análisis Nova
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { BarChart3, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface MonthlyTrendCardProps {
  companyId: number;
  year: number;
  month: number;
}

export function MonthlyTrendCard({ companyId, year, month }: MonthlyTrendCardProps) {
  const { data: monthlyTrends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ["/api/sales-monthly-trends", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-monthly-trends?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 60000,
  });

  const { data: financial, isLoading: isLoadingFinancial } = useMonthlyFinancial(companyId, year, month);

  if (isLoadingTrends || isLoadingFinancial) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-72 w-full" /></CardContent>
      </Card>
    );
  }

  // 6-month trend chart
  const sorted = [...(monthlyTrends || [])].sort(
    (a: any, b: any) => (a.year ?? 0) - (b.year ?? 0) || (a.monthNum ?? 0) - (b.monthNum ?? 0)
  );
  const last6 = sorted.slice(-6);
  const currentMonth = last6.length > 0 ? last6[last6.length - 1] : null;
  const prevMonth = last6.length > 1 ? last6[last6.length - 2] : null;
  const currentRevenue = currentMonth?.amount || 0;
  const prevRevenue = prevMonth?.amount || 0;
  const momChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const chartData = last6.map((m: any, idx: number) => ({
    month: m.month || m.monthFull?.slice(0, 3) || `M${idx + 1}`,
    revenue: m.amount || 0,
    isCurrentMonth: idx === last6.length - 1,
  }));

  // Weekly distribution
  const weekly: Array<{ weekLabel: string; transactions: number; revenue: number; volume: number; percentOfTotal: number }> = financial?.weeklyDistribution || [];

  // Exchange rate (only company 1)
  const fx: { avgRate: number; minRate: number; maxRate: number } | undefined = financial?.exchangeRate;
  const showFX = companyId === 1 && fx && fx.avgRate > 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendencias y Patrones
          </CardTitle>
          <Badge variant="outline" className="text-xs">Últimos 6 meses</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current month highlight */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{formatCurrency(currentRevenue, companyId)}</p>
            <p className="text-xs text-muted-foreground">
              {currentMonth?.monthFull || "Mes actual"}
            </p>
          </div>
          {prevRevenue > 0 && (
            <div className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold",
              momChange >= 0
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
            )}>
              {momChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {momChange >= 0 ? "+" : ""}{momChange.toFixed(1)}%
            </div>
          )}
        </div>

        {/* 6-month Bar Chart */}
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [formatCurrency(value, companyId), "Ingresos"]}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isCurrentMonth ? "hsl(var(--primary))" : "hsl(var(--chart-1))"}
                    opacity={entry.isCurrentMonth ? 1 : 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Distribution */}
        {weekly.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Distribución Semanal</p>
            <div className="space-y-1.5">
              {weekly.map((w, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{w.weekLabel}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${Math.min(w.percentOfTotal, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-14 text-right">
                    {w.percentOfTotal.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {w.transactions} tx
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exchange Rate (company 1 only) */}
        {showFX && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">Tipo de Cambio MXN/USD</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm">
                  Prom: <span className="font-semibold">{fx!.avgRate.toFixed(2)}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Min: {fx!.minRate.toFixed(2)} — Máx: {fx!.maxRate.toFixed(2)}
                </span>
                <Badge variant="outline" className="text-xs">
                  Rango: {(fx!.maxRate - fx!.minRate).toFixed(2)}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
