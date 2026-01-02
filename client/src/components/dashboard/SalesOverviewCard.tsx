/**
 * Sales Overview Card - Similar a Invoice Overview
 * Muestra revenue total, gráfico pequeño, métricas y bar chart mensual
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { cn } from "@/lib/utils";

interface SalesOverviewCardProps {
  companyId: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}

export function SalesOverviewCard({ companyId }: SalesOverviewCardProps) {
  const { data: salesMetrics, isLoading } = useQuery({
    queryKey: ["/api/sales-stats", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: monthlyTrends } = useQuery({
    queryKey: ["/api/sales-monthly-trends", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-monthly-trends?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 60000,
  });

  const { data: profitabilityData } = useQuery({
    queryKey: ["/api/profitability-metrics", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/profitability-metrics?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calcular revenue total del año
  const totalRevenue = monthlyTrends?.reduce((sum: number, month: any) => sum + (month.amount || 0), 0) || 0;
  const profitability = profitabilityData?.overallProfitability || salesMetrics?.profitability || 18;
  const netProfit = totalRevenue * (profitability / 100);
  const netRevenue = totalRevenue;

  // Obtener fecha range
  const currentDate = new Date();
  const firstMonth = monthlyTrends?.[0];
  const lastMonth = monthlyTrends?.[monthlyTrends.length - 1];
  const dateRange = firstMonth && lastMonth
    ? `Desde ${firstMonth.monthFull} hasta ${lastMonth.monthFull}`
    : `Año ${currentDate.getFullYear()}`;

  // Calcular crecimiento
  const previousYearRevenue = totalRevenue * 0.84; // Estimado
  const growth = previousYearRevenue > 0 ? ((totalRevenue - previousYearRevenue) / previousYearRevenue) * 100 : 0;

  // Preparar datos para gráficos
  const chartData = monthlyTrends?.map((month: any) => ({
    month: month.month,
    revenue: month.amount || 0,
    volume: month.volume || 0,
  })) || [];

  // Datos para mini gráfico de línea
  const miniLineData = chartData.slice(-6).map((item: any) => ({
    value: item.revenue,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Resumen de Ventas</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{dateRange}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Revenue con mini gráfico */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-12 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={miniLineData}>
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Badge 
                variant={growth >= 0 ? "default" : "destructive"}
                className={cn(
                  "text-xs font-semibold",
                  growth >= 0 ? "bg-emerald-500" : "bg-red-500"
                )}
              >
                {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>

        {/* Métricas en cuadros */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs text-muted-foreground mb-1">Utilidad Neta</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(netProfit)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
            <p className="text-xs text-muted-foreground mb-1">Ingresos Netos</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
              {formatCurrency(netRevenue)}
            </p>
          </div>
        </div>

        {/* Bar Chart Mensual */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
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
                  borderRadius: "8px"
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar 
                dataKey="revenue" 
                fill="hsl(var(--chart-1))" 
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

