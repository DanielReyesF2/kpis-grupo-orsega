/**
 * Yearly Totals Bar Chart - Panorama Histórico de Ventas
 * Diseño moderno premium con gradientes y animaciones suaves
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceLine
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  Calendar,
  Target,
  Zap,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface YearTotal {
  year: number;
  totalQty: number;
  totalAmt: number;
  avgMonthly: number;
}

interface MultiYearData {
  companyId: number;
  years: number[];
  data: any[];
  yearTotals: YearTotal[];
  unit: string;
}

interface YearlyTotalsBarChartProps {
  companyId?: number;
  variant?: 'default' | 'compact';
}

export function YearlyTotalsBarChart({ companyId, variant = 'default' }: YearlyTotalsBarChartProps) {
  const [hoveredYear, setHoveredYear] = useState<string | null>(null);

  // Fetch data based on companyId
  const { data: chartDataRaw, isLoading, error } = useQuery<MultiYearData>({
    queryKey: ['/api/sales-multi-year-trend', companyId || 'all'],
    queryFn: async () => {
      const id = companyId || 1;
      const res = await apiRequest('GET', `/api/sales-multi-year-trend?companyId=${id}`);
      return await res.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const companyName = companyId === 1 ? "DURA" : companyId === 2 ? "ORSEGA" : "DURA";

  // Colores más vibrantes y modernos
  const companyConfig = companyId === 2
    ? {
        primary: "#8b5cf6",
        secondary: "#a78bfa",
        gradient: ["#8b5cf6", "#6366f1"],
        light: "rgba(139, 92, 246, 0.1)",
        glow: "rgba(139, 92, 246, 0.3)"
      }
    : {
        primary: "#10b981",
        secondary: "#34d399",
        gradient: ["#10b981", "#059669"],
        light: "rgba(16, 185, 129, 0.1)",
        glow: "rgba(16, 185, 129, 0.3)"
      };

  const unit = companyId === 2 ? "unidades" : "KG";

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  const formatFullNumber = (num: number) => {
    return num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden bg-gradient-to-br from-card to-muted/30 border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (error || !chartDataRaw?.yearTotals?.length) {
    return (
      <Card className="overflow-hidden border-dashed border-2">
        <CardContent className="py-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">No hay datos históricos disponibles</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sube datos de ventas para ver el panorama histórico</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const yearTotals = chartDataRaw.yearTotals;

  // Prepare chart data with growth calculations
  const chartData = yearTotals.map((yt, index) => {
    const prevYear = index > 0 ? yearTotals[index - 1] : null;
    const growth = prevYear && prevYear.totalQty > 0
      ? ((yt.totalQty - prevYear.totalQty) / prevYear.totalQty) * 100
      : null;

    return {
      year: yt.year.toString(),
      value: yt.totalQty,
      growth,
      isLatest: index === yearTotals.length - 1,
      isBestYear: yt.totalQty === Math.max(...yearTotals.map(y => y.totalQty))
    };
  });

  // Calculate insights
  const totalHistorico = yearTotals.reduce((sum, yt) => sum + yt.totalQty, 0);
  const avgAnual = totalHistorico / yearTotals.length;
  const bestYear = yearTotals.reduce((best, yt) => yt.totalQty > best.totalQty ? yt : best, yearTotals[0]);
  const latestYear = yearTotals[yearTotals.length - 1];
  const previousYear = yearTotals.length > 1 ? yearTotals[yearTotals.length - 2] : null;

  const latestGrowth = previousYear && previousYear.totalQty > 0
    ? ((latestYear.totalQty - previousYear.totalQty) / previousYear.totalQty) * 100
    : 0;

  // CAGR calculation
  const firstYear = yearTotals[0];
  const yearsCount = yearTotals.length - 1;
  const cagr = yearsCount > 0 && firstYear.totalQty > 0
    ? (Math.pow(latestYear.totalQty / firstYear.totalQty, 1 / yearsCount) - 1) * 100
    : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl min-w-[200px]">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.isBestYear ? '#f59e0b' : companyConfig.primary }}
          />
          <p className="text-foreground font-bold text-lg">{label}</p>
          {data.isBestYear && <Award className="h-4 w-4 text-amber-500" />}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground text-sm">Total vendido</span>
            <span className="text-foreground font-bold">{formatFullNumber(data.value)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground text-sm">Unidad</span>
            <span className="text-foreground font-medium">{unit}</span>
          </div>
          {data.growth !== null && (
            <div className="flex justify-between items-center gap-4 pt-2 border-t border-border/50">
              <span className="text-muted-foreground text-sm">vs. año anterior</span>
              <span className={`font-bold flex items-center gap-1 ${data.growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {data.growth >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {data.growth >= 0 ? '+' : ''}{data.growth.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Variante compacta para grid
  if (variant === 'compact') {
    return (
      <Card className="rounded-xl border border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Ventas Histórico Anual</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={formatNumber}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isBestYear ? '#f59e0b' : companyConfig.primary}
                      opacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Mejor año: {bestYear.year}</span>
            <span className={latestGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {latestGrowth >= 0 ? '+' : ''}{latestGrowth.toFixed(1)}% vs anterior
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-muted/20 border-border/50 shadow-lg">
      {/* Header mejorado */}
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-2xl shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${companyConfig.primary}20, ${companyConfig.primary}10)`,
                boxShadow: `0 4px 20px ${companyConfig.glow}`
              }}
            >
              <BarChart3 className="h-6 w-6" style={{ color: companyConfig.primary }} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Panorama Histórico
                <Sparkles className="h-4 w-4 text-amber-500" />
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {companyName} · Ventas acumuladas {yearTotals[0].year} - {latestYear.year}
              </p>
            </div>
          </div>

          {/* Badge de crecimiento mejorado */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-md"
            style={{
              background: latestGrowth >= 0
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
              color: latestGrowth >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)',
              border: `1px solid ${latestGrowth >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}
          >
            {latestGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{latestGrowth >= 0 ? '+' : ''}{latestGrowth.toFixed(1)}% último año</span>
          </div>
        </div>

        {/* Stats cards mejoradas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-background to-muted/30 rounded-2xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-10"
              style={{ background: `radial-gradient(circle, ${companyConfig.primary}, transparent)` }}
            />
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium">Total Histórico</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: companyConfig.primary }}>
              {formatNumber(totalHistorico)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{unit}</p>
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-background to-muted/30 rounded-2xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-10"
              style={{ background: `radial-gradient(circle, ${companyConfig.secondary}, transparent)` }}
            />
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">Promedio Anual</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(avgAnual)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{unit}/año</p>
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10 rounded-2xl p-4 border border-amber-200/50 dark:border-amber-800/30 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-20"
              style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }}
            />
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <Award className="h-4 w-4" />
              <span className="text-xs font-medium">Mejor Año</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{bestYear.year}</p>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-300/70 mt-1">{formatNumber(bestYear.totalQty)} {unit}</p>
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/30 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-20"
              style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
            />
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">CAGR</span>
            </div>
            <p className={`text-2xl font-bold ${cagr >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%
            </p>
            <p className="text-[11px] text-blue-700/70 dark:text-blue-300/70 mt-1">crecimiento compuesto</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8">
        {/* Chart con diseño mejorado */}
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 30, right: 20, left: 0, bottom: 10 }}
              onMouseMove={(state) => {
                if (state?.activeLabel) setHoveredYear(state.activeLabel);
              }}
              onMouseLeave={() => setHoveredYear(null)}
            >
              <defs>
                <linearGradient id={`barGradient-${companyId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={companyConfig.primary} stopOpacity={1} />
                  <stop offset="100%" stopColor={companyConfig.secondary} stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="bestYearGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
                opacity={0.4}
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 13, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatNumber}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2, radius: 8 }} />
              <ReferenceLine
                y={avgAnual}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                opacity={0.5}
                label={{ value: 'Promedio', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <Bar
                dataKey="value"
                radius={[12, 12, 4, 4]}
                maxBarSize={70}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={formatNumber}
                  style={{ fontSize: 12, fontWeight: 700, fill: 'hsl(var(--foreground))' }}
                />
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isBestYear
                        ? 'url(#bestYearGradient)'
                        : entry.growth !== null && entry.growth < 0
                          ? 'url(#negativeGradient)'
                          : `url(#barGradient-${companyId})`
                    }
                    opacity={hoveredYear === null || hoveredYear === entry.year ? 1 : 0.35}
                    style={{
                      transition: 'all 0.3s ease',
                      filter: hoveredYear === entry.year ? `drop-shadow(0 4px 8px ${companyConfig.glow})` : 'none'
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Year-by-year breakdown mejorado */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Detalle por Año</p>
            <p className="text-xs text-muted-foreground">{yearTotals.length} años de datos</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {chartData.map((item) => (
              <div
                key={item.year}
                className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 cursor-default group hover:shadow-lg ${
                  item.isBestYear
                    ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-300/50 dark:border-amber-700/50'
                    : 'bg-gradient-to-br from-background to-muted/20 border-border/50 hover:border-border'
                }`}
              >
                {item.isBestYear && (
                  <div className="absolute top-2 right-2">
                    <Award className="h-4 w-4 text-amber-500" />
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-foreground">{item.year}</span>
                </div>
                <p className="text-sm text-muted-foreground font-medium">{formatFullNumber(item.value)}</p>
                {item.growth !== null && (
                  <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
                    item.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {item.growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {item.growth >= 0 ? '+' : ''}{item.growth.toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
