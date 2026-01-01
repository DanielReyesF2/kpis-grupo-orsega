/**
 * Sales Trend Chart - Gráfico simplificado de tendencias de ventas
 * Diseño ejecutivo premium con área con gradiente
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";

interface SalesTrendChartProps {
  companyId: number;
  months?: number;
}

export function SalesTrendChart({ companyId, months = 12 }: SalesTrendChartProps) {
  const { data: monthlyTrends, isLoading } = useQuery({
    queryKey: ["/api/sales-monthly-trends", companyId, months],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/sales-monthly-trends?companyId=${companyId}&months=${months}`
      );
      return await res.json();
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const companyName = companyId === 1 ? "DURA" : "ORSEGA";
  const unit = companyId === 1 ? "KG" : "unidades";
  const companyColor = companyId === 1 ? "#10b981" : "#8b5cf6";

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString("es-MX", { maximumFractionDigits: 0 });
  };

  if (isLoading) {
    return (
      <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b border-border/60">
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent className="pt-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!monthlyTrends || monthlyTrends.length === 0) {
    return (
      <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg">
        <CardContent className="py-16">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-medium">
              No hay datos de tendencias disponibles
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Procesar datos para el gráfico
  // El endpoint devuelve 'volume', no 'totalQty'
  const chartData = monthlyTrends
    .slice(-months)
    .map((item: any) => ({
      month: item.month || `${item.monthNum}/${item.year}`,
      value: item.volume || 0, // Cambiado de totalQty a volume
      period: item.period || `${item.monthNum}/${item.year}`,
    }));

  // Calcular promedio para línea de referencia
  const average =
    chartData.reduce((sum: number, item: any) => sum + item.value, 0) / chartData.length;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl">
        <p className="text-foreground font-bold mb-2">{data.month}</p>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: companyColor }}
          />
          <span className="text-foreground font-semibold">
            {formatNumber(data.value)} {unit}
          </span>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${companyColor}20, ${companyColor}10)`,
                }}
              >
                <TrendingUp className="h-5 w-5" style={{ color: companyColor }} />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Evolución Mensual</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {companyName} · Últimos {months} meses
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={companyColor}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={companyColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={formatNumber}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={average}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  opacity={0.5}
                  label={{ value: "Promedio", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={companyColor}
                  strokeWidth={2}
                  fill="url(#areaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


