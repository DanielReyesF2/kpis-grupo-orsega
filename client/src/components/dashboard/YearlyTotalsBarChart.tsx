/**
 * Yearly Totals Bar Chart - Panorama completo de ventas anuales
 * Muestra gráfica de barras con el total de ventas por año para ambas empresas
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, BarChart3, Loader2, Building2 } from "lucide-react";
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
  companyId?: number; // Optional - if not provided, shows both companies
}

const COMPANY_COLORS = {
  dura: {
    primary: "#16a34a", // green-600
    light: "#22c55e",   // green-500
    bg: "bg-green-50 dark:bg-green-950/20",
    text: "text-green-700 dark:text-green-400"
  },
  orsega: {
    primary: "#7c3aed", // violet-600
    light: "#8b5cf6",   // violet-500
    bg: "bg-violet-50 dark:bg-violet-950/20",
    text: "text-violet-700 dark:text-violet-400"
  }
};

export function YearlyTotalsBarChart({ companyId }: YearlyTotalsBarChartProps) {
  // Fetch data for DURA (company 1)
  const { data: duraData, isLoading: isLoadingDura } = useQuery<MultiYearData>({
    queryKey: ['/api/sales-multi-year-trend', 1],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-multi-year-trend?companyId=1`);
      return await res.json();
    },
    enabled: !companyId || companyId === 1,
  });

  // Fetch data for ORSEGA (company 2)
  const { data: orsegaData, isLoading: isLoadingOrsega } = useQuery<MultiYearData>({
    queryKey: ['/api/sales-multi-year-trend', 2],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-multi-year-trend?companyId=2`);
      return await res.json();
    },
    enabled: !companyId || companyId === 2,
  });

  const isLoading = isLoadingDura || isLoadingOrsega;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  const formatFullNumber = (num: number) => {
    return num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  };

  // Calculate YoY growth
  const getYoYGrowth = (yearTotals: YearTotal[], currentYear: number) => {
    const current = yearTotals.find(y => y.year === currentYear);
    const previous = yearTotals.find(y => y.year === currentYear - 1);
    if (!current || !previous || previous.totalQty === 0) return null;
    return ((current.totalQty - previous.totalQty) / previous.totalQty) * 100;
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg border-2 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle>Cargando panorama de ventas...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Prepare combined chart data
  const allYears = new Set<number>();
  duraData?.yearTotals.forEach(yt => allYears.add(yt.year));
  orsegaData?.yearTotals.forEach(yt => allYears.add(yt.year));

  const sortedYears = Array.from(allYears).sort();

  const chartData = sortedYears.map(year => {
    const duraYear = duraData?.yearTotals.find(yt => yt.year === year);
    const orsegaYear = orsegaData?.yearTotals.find(yt => yt.year === year);

    return {
      year: year.toString(),
      yearNum: year,
      dura: duraYear?.totalQty || 0,
      orsega: orsegaYear?.totalQty || 0,
      duraGrowth: duraData ? getYoYGrowth(duraData.yearTotals, year) : null,
      orsegaGrowth: orsegaData ? getYoYGrowth(orsegaData.yearTotals, year) : null
    };
  });

  // Calculate totals and growth for summary cards
  const duraTotals = duraData?.yearTotals || [];
  const orsegaTotals = orsegaData?.yearTotals || [];

  const duraGrandTotal = duraTotals.reduce((sum, yt) => sum + yt.totalQty, 0);
  const orsegaGrandTotal = orsegaTotals.reduce((sum, yt) => sum + yt.totalQty, 0);

  const latestDuraGrowth = duraTotals.length >= 2
    ? getYoYGrowth(duraTotals, duraTotals[duraTotals.length - 1].year)
    : null;
  const latestOrsegaGrowth = orsegaTotals.length >= 2
    ? getYoYGrowth(orsegaTotals, orsegaTotals[orsegaTotals.length - 1].year)
    : null;

  // Calculate CAGR (Compound Annual Growth Rate)
  const calculateCAGR = (totals: YearTotal[]) => {
    if (totals.length < 2) return null;
    const first = totals[0].totalQty;
    const last = totals[totals.length - 1].totalQty;
    const years = totals.length - 1;
    if (first <= 0 || years <= 0) return null;
    return (Math.pow(last / first, 1 / years) - 1) * 100;
  };

  const duraCAGR = calculateCAGR(duraTotals);
  const orsegaCAGR = calculateCAGR(orsegaTotals);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-4 min-w-[200px]">
        <p className="font-bold text-lg mb-3 pb-2 border-b border-border">{label}</p>
        {payload.map((entry: any, index: number) => {
          const isDura = entry.dataKey === 'dura';
          const growth = isDura ? entry.payload.duraGrowth : entry.payload.orsegaGrowth;
          const unit = isDura ? 'KG' : 'unidades';

          return (
            <div key={index} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="font-medium">{isDura ? 'DURA' : 'ORSEGA'}</span>
                </div>
                <span className="font-bold tabular-nums">
                  {formatFullNumber(entry.value)} {unit}
                </span>
              </div>
              {growth !== null && (
                <div className="flex items-center justify-end gap-1 mt-1">
                  {growth >= 0
                    ? <TrendingUp className="h-3 w-3 text-green-600" />
                    : <TrendingDown className="h-3 w-3 text-red-600" />
                  }
                  <span className={`text-xs ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {growth >= 0 ? '+' : ''}{growth.toFixed(1)}% vs año anterior
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Single company or combined view
  const showBoth = !companyId;
  const singleCompanyData = companyId === 1 ? duraData : orsegaData;

  return (
    <Card className="shadow-lg border-2 border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                Panorama Histórico de Ventas
              </CardTitle>
              <CardDescription className="text-sm mt-0.5">
                {showBoth
                  ? `Comparativo anual DURA y ORSEGA (${sortedYears[0]} - ${sortedYears[sortedYears.length - 1]})`
                  : `Total anual ${companyId === 1 ? 'DURA' : 'ORSEGA'} (${sortedYears[0]} - ${sortedYears[sortedYears.length - 1]})`
                }
              </CardDescription>
            </div>
          </div>

          {/* Year summary badges */}
          <div className="flex flex-wrap gap-2">
            {sortedYears.map(year => (
              <Badge
                key={year}
                variant="outline"
                className="text-xs px-2 py-1"
              >
                {year}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className={`grid gap-4 ${showBoth ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
          {(showBoth || companyId === 1) && duraData && (
            <div className={`p-4 rounded-xl ${COMPANY_COLORS.dura.bg} border border-green-200 dark:border-green-800/50`}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-700 dark:text-green-400">DURA</span>
              </div>
              <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                {formatNumber(duraGrandTotal)} KG
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                Total histórico ({duraTotals.length} años)
              </p>
              {latestDuraGrowth !== null && (
                <div className="flex items-center gap-1 mt-2">
                  {latestDuraGrowth >= 0
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  }
                  <span className={`text-sm font-medium ${latestDuraGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {latestDuraGrowth >= 0 ? '+' : ''}{latestDuraGrowth.toFixed(1)}% último año
                  </span>
                </div>
              )}
              {duraCAGR !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  CAGR: {duraCAGR >= 0 ? '+' : ''}{duraCAGR.toFixed(1)}%
                </p>
              )}
            </div>
          )}

          {(showBoth || companyId === 2) && orsegaData && (
            <div className={`p-4 rounded-xl ${COMPANY_COLORS.orsega.bg} border border-violet-200 dark:border-violet-800/50`}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-violet-600" />
                <span className="font-semibold text-violet-700 dark:text-violet-400">ORSEGA</span>
              </div>
              <p className="text-2xl font-bold text-violet-800 dark:text-violet-300">
                {formatNumber(orsegaGrandTotal)} unidades
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-500 mt-1">
                Total histórico ({orsegaTotals.length} años)
              </p>
              {latestOrsegaGrowth !== null && (
                <div className="flex items-center gap-1 mt-2">
                  {latestOrsegaGrowth >= 0
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  }
                  <span className={`text-sm font-medium ${latestOrsegaGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {latestOrsegaGrowth >= 0 ? '+' : ''}{latestOrsegaGrowth.toFixed(1)}% último año
                  </span>
                </div>
              )}
              {orsegaCAGR !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  CAGR: {orsegaCAGR >= 0 ? '+' : ''}{orsegaCAGR.toFixed(1)}%
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 14, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={formatNumber}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: 'DURA (KG)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: COMPANY_COLORS.dura.primary }
                }}
              />
              {showBoth && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={formatNumber}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: 'ORSEGA (unidades)',
                    angle: 90,
                    position: 'insideRight',
                    style: { fontSize: 11, fill: COMPANY_COLORS.orsega.primary }
                  }}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => (
                  <span className="font-medium">{value === 'dura' ? 'DURA (KG)' : 'ORSEGA (unidades)'}</span>
                )}
              />

              {(showBoth || companyId === 1) && (
                <Bar
                  yAxisId="left"
                  dataKey="dura"
                  name="dura"
                  fill={COMPANY_COLORS.dura.primary}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={80}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`dura-${index}`}
                      fill={entry.duraGrowth !== null && entry.duraGrowth < 0
                        ? '#ef4444' // red for negative growth
                        : COMPANY_COLORS.dura.primary
                      }
                      opacity={entry.yearNum === sortedYears[sortedYears.length - 1] ? 1 : 0.8}
                    />
                  ))}
                </Bar>
              )}

              {(showBoth || companyId === 2) && (
                <Bar
                  yAxisId={showBoth ? "right" : "left"}
                  dataKey="orsega"
                  name="orsega"
                  fill={COMPANY_COLORS.orsega.primary}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={80}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`orsega-${index}`}
                      fill={entry.orsegaGrowth !== null && entry.orsegaGrowth < 0
                        ? '#ef4444' // red for negative growth
                        : COMPANY_COLORS.orsega.primary
                      }
                      opacity={entry.yearNum === sortedYears[sortedYears.length - 1] ? 1 : 0.8}
                    />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Year-by-Year Detail Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground">Año</th>
                {(showBoth || companyId === 1) && (
                  <>
                    <th className="text-right py-3 px-2 font-semibold text-green-600">DURA (KG)</th>
                    <th className="text-right py-3 px-2 font-semibold text-green-600">Variación</th>
                  </>
                )}
                {(showBoth || companyId === 2) && (
                  <>
                    <th className="text-right py-3 px-2 font-semibold text-violet-600">ORSEGA (un.)</th>
                    <th className="text-right py-3 px-2 font-semibold text-violet-600">Variación</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, idx) => (
                <tr key={row.year} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-2 font-bold">{row.year}</td>
                  {(showBoth || companyId === 1) && (
                    <>
                      <td className="text-right py-3 px-2 font-medium tabular-nums">
                        {formatFullNumber(row.dura)}
                      </td>
                      <td className="text-right py-3 px-2">
                        {row.duraGrowth !== null ? (
                          <span className={`inline-flex items-center gap-1 ${row.duraGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {row.duraGrowth >= 0
                              ? <TrendingUp className="h-3 w-3" />
                              : <TrendingDown className="h-3 w-3" />
                            }
                            {row.duraGrowth >= 0 ? '+' : ''}{row.duraGrowth.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </>
                  )}
                  {(showBoth || companyId === 2) && (
                    <>
                      <td className="text-right py-3 px-2 font-medium tabular-nums">
                        {formatFullNumber(row.orsega)}
                      </td>
                      <td className="text-right py-3 px-2">
                        {row.orsegaGrowth !== null ? (
                          <span className={`inline-flex items-center gap-1 ${row.orsegaGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {row.orsegaGrowth >= 0
                              ? <TrendingUp className="h-3 w-3" />
                              : <TrendingDown className="h-3 w-3" />
                            }
                            {row.orsegaGrowth >= 0 ? '+' : ''}{row.orsegaGrowth.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
