/**
 * Multi-Year Trend Chart - Gráfica de tendencias multi-año
 * Muestra líneas superpuestas de cada año para comparar patrones estacionales
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { TrendingUp, TrendingDown, Calendar, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MultiYearTrendChartProps {
  companyId: number;
}

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

// Colores para cada año (hasta 6 años)
const YEAR_COLORS: Record<number, string> = {
  2022: "#94a3b8", // slate
  2023: "#f59e0b", // amber
  2024: "#3b82f6", // blue
  2025: "#10b981", // emerald
  2026: "#8b5cf6", // violet
  2027: "#ec4899", // pink
};

export function MultiYearTrendChart({ companyId }: MultiYearTrendChartProps) {
  const { data, isLoading, error } = useQuery<MultiYearData>({
    queryKey: ['/api/sales-multi-year-trend', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-multi-year-trend?companyId=${companyId}`);
      return await res.json();
    },
    enabled: !!companyId,
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle>Cargando tendencias...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <p className="text-red-600">Error al cargar tendencias multi-año</p>
        </CardContent>
      </Card>
    );
  }

  const { years, data: chartData, yearTotals, unit } = data;
  const companyName = companyId === 1 ? "DURA" : "ORSEGA";

  // Calcular crecimiento año vs año
  const getYoYGrowth = (currentYear: number) => {
    const current = yearTotals.find(y => y.year === currentYear);
    const previous = yearTotals.find(y => y.year === currentYear - 1);
    if (!current || !previous || previous.totalQty === 0) return null;
    return ((current.totalQty - previous.totalQty) / previous.totalQty) * 100;
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${companyId === 1 ? 'bg-blue-100' : 'bg-purple-100'}`}>
              <Calendar className={`h-5 w-5 ${companyId === 1 ? 'text-blue-600' : 'text-purple-600'}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Tendencia Multi-Año - {companyName}</CardTitle>
              <CardDescription>Comparativo mensual {years[0]} - {years[years.length - 1]}</CardDescription>
            </div>
          </div>
        </div>

        {/* Year badges with totals */}
        <div className="flex flex-wrap gap-2 mt-3">
          {yearTotals.map((yt) => {
            const growth = getYoYGrowth(yt.year);
            return (
              <Badge
                key={yt.year}
                variant="outline"
                className="flex items-center gap-1 px-3 py-1"
                style={{ borderColor: YEAR_COLORS[yt.year], color: YEAR_COLORS[yt.year] }}
              >
                <span className="font-bold">{yt.year}:</span>
                <span>{formatNumber(yt.totalQty)} {unit}</span>
                {growth !== null && (
                  <span className={`text-xs ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {growth >= 0 ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                    {Math.abs(growth).toFixed(1)}%
                  </span>
                )}
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatNumber}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatNumber(value) + ' ' + unit, '']}
                labelFormatter={(label) => `Mes: ${label}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}
              />
              <Legend />
              {years.map((year) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`qty_${year}`}
                  name={year.toString()}
                  stroke={YEAR_COLORS[year] || '#666'}
                  strokeWidth={year === years[years.length - 1] ? 3 : 2}
                  dot={{ r: year === years[years.length - 1] ? 4 : 2 }}
                  activeDot={{ r: 6 }}
                  opacity={year === years[years.length - 1] ? 1 : 0.7}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {yearTotals.slice(-2).map((yt, idx) => (
            <div key={yt.year} className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Promedio mensual {yt.year}</p>
              <p className="text-lg font-bold" style={{ color: YEAR_COLORS[yt.year] }}>
                {formatNumber(yt.avgMonthly)} {unit}
              </p>
            </div>
          ))}
          {yearTotals.length >= 2 && (
            <>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Crecimiento total</p>
                <p className={`text-lg font-bold ${
                  yearTotals[yearTotals.length - 1].totalQty >= yearTotals[0].totalQty
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {((yearTotals[yearTotals.length - 1].totalQty - yearTotals[0].totalQty) / yearTotals[0].totalQty * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Años de datos</p>
                <p className="text-lg font-bold">{years.length} años</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
