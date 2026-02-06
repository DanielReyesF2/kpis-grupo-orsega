/**
 * Monthly Trend Card - Bar chart de últimos 6 meses con mes actual resaltado
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/sales-utils";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
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
}

export function MonthlyTrendCard({ companyId }: MonthlyTrendCardProps) {
  const { data: monthlyTrends, isLoading } = useQuery({
    queryKey: ["/api/sales-monthly-trends", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-monthly-trends?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-56 w-full" /></CardContent>
      </Card>
    );
  }

  const sorted = [...(monthlyTrends || [])].sort(
    (a: any, b: any) => (a.year ?? 0) - (b.year ?? 0) || (a.monthNum ?? 0) - (b.monthNum ?? 0)
  );

  // Last 6 months
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

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendencia de Ingresos
          </CardTitle>
          <Badge variant="outline" className="text-xs">Últimos 6 meses</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Bar Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
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
      </CardContent>
    </Card>
  );
}
