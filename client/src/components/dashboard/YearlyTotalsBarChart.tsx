/**
 * Yearly Totals Bar Chart - Panorama Histórico de Ventas
 * Diseño moderno con insights y métricas clave
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
  LabelList
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
  ArrowDownRight
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
}

export function YearlyTotalsBarChart({ companyId }: YearlyTotalsBarChartProps) {
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
  const companyColor = companyId === 2 ? "#8b5cf6" : "#10b981";
  const companyColorLight = companyId === 2 ? "#a78bfa" : "#34d399";
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
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Cargando datos históricos...</span>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (error || !chartDataRaw?.yearTotals?.length) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="py-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay datos históricos disponibles</p>
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
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 shadow-2xl min-w-[180px]">
        <p className="text-white font-bold text-lg mb-2">{label}</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-white font-semibold">{formatFullNumber(data.value)} {unit}</span>
          </div>
          {data.growth !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Crecimiento</span>
              <span className={`font-semibold flex items-center gap-1 ${data.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {data.growth >= 0 ? '+' : ''}{data.growth.toFixed(1)}%
              </span>
            </div>
          )}
          {data.isBestYear && (
            <div className="pt-2 mt-2 border-t border-[#333]">
              <span className="text-amber-400 text-xs flex items-center gap-1">
                <Award className="h-3 w-3" /> Mejor año histórico
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-background to-muted/20">
      {/* Header with stats */}
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: `${companyColor}20` }}
            >
              <BarChart3 className="h-5 w-5" style={{ color: companyColor }} />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Panorama Histórico
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {companyName} · {yearTotals[0].year} - {latestYear.year}
              </p>
            </div>
          </div>

          {/* Quick insight badge */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: latestGrowth >= 0 ? 'rgb(16 185 129 / 0.1)' : 'rgb(239 68 68 / 0.1)',
              color: latestGrowth >= 0 ? 'rgb(16 185 129)' : 'rgb(239 68 68)'
            }}
          >
            {latestGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{latestGrowth >= 0 ? '+' : ''}{latestGrowth.toFixed(1)}% último año</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-background/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">Total Histórico</span>
            </div>
            <p className="text-lg font-bold" style={{ color: companyColor }}>
              {formatNumber(totalHistorico)}
            </p>
            <p className="text-[10px] text-muted-foreground">{unit}</p>
          </div>

          <div className="bg-background/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-3.5 w-3.5" />
              <span className="text-xs">Promedio Anual</span>
            </div>
            <p className="text-lg font-bold">{formatNumber(avgAnual)}</p>
            <p className="text-[10px] text-muted-foreground">{unit}/año</p>
          </div>

          <div className="bg-background/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs">Mejor Año</span>
            </div>
            <p className="text-lg font-bold">{bestYear.year}</p>
            <p className="text-[10px] text-muted-foreground">{formatNumber(bestYear.totalQty)} {unit}</p>
          </div>

          <div className="bg-background/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs">CAGR</span>
            </div>
            <p className={`text-lg font-bold ${cagr >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">crecimiento compuesto</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Chart */}
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
              onMouseMove={(state) => {
                if (state?.activeLabel) setHoveredYear(state.activeLabel);
              }}
              onMouseLeave={() => setHoveredYear(null)}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatNumber}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
              <Bar
                dataKey="value"
                radius={[8, 8, 0, 0]}
                maxBarSize={60}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={formatNumber}
                  style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                />
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isBestYear ? '#f59e0b' : entry.growth !== null && entry.growth < 0 ? '#ef4444' : companyColor}
                    opacity={hoveredYear === null || hoveredYear === entry.year ? 1 : 0.4}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Year-by-year breakdown */}
        <div className="mt-6 pt-5 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-3">Detalle por año</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {chartData.map((item) => (
              <div
                key={item.year}
                className={`p-3 rounded-lg border transition-all cursor-default ${
                  item.isBestYear
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-muted/30 border-border/50 hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{item.year}</span>
                  {item.isBestYear && <Award className="h-3 w-3 text-amber-500" />}
                </div>
                <p className="text-xs text-muted-foreground">{formatFullNumber(item.value)}</p>
                {item.growth !== null && (
                  <div className={`flex items-center gap-0.5 mt-1 text-[10px] font-medium ${
                    item.growth >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {item.growth >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
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
