/**
 * Gráfico comparativo anual con toggle USD / KG / Utilidad Bruta
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";

type MetricView = "usd" | "kg" | "gp";

const METRIC_CONFIG: Record<MetricView, { label: string; prefix: string; dataKey: string; totalsKey: string }> = {
  usd: { label: "USD", prefix: "amt", dataKey: "amt", totalsKey: "amt" },
  kg: { label: "KG", prefix: "qty", dataKey: "qty", totalsKey: "qty" },
  gp: { label: "Ut. Bruta", prefix: "gp", dataKey: "gp", totalsKey: "gp" },
};

interface YearlyComparisonChartProps {
  companyId: number;
  year1?: number;
  year2?: number;
}

export function YearlyComparisonChart({ companyId, year1, year2 }: YearlyComparisonChartProps) {
  const [metricView, setMetricView] = useState<MetricView>("usd");

  const defaultYear1 = year1 || 2024;
  const defaultYear2 = year2 || 2025;

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sales-yearly-comparison', companyId, defaultYear1, defaultYear2],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: String(companyId),
        year1: String(defaultYear1),
        year2: String(defaultYear2)
      });
      const res = await apiRequest('GET', `/api/sales-yearly-comparison?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch yearly comparison: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <ChartCard title="Comparativo Anual" subtitle="Cargando...">
        <LoadingState variant="chart" />
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard title="Comparativo Anual" subtitle="Error">
        <ErrorState variant="card" message="Error al cargar comparativo anual" />
      </ChartCard>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <ChartCard title="Comparativo Anual" subtitle="">
        <EmptyState
          icon={BarChart3}
          title="Sin datos comparativos"
          description="No hay datos disponibles para comparar"
          size="sm"
        />
      </ChartCard>
    );
  }

  const availableYears = data.availableYears || [];
  const has2026 = availableYears.includes(2026);
  const yearsToShow = has2026 ? [2024, 2025, 2026] : [2024, 2025];
  const metric = METRIC_CONFIG[metricView];

  // Build chart data based on selected metric
  const chartData = data.data.map((item: any) => {
    const dataPoint: any = {
      mes: item.mes.substring(0, 3),
    };

    yearsToShow.forEach((year) => {
      dataPoint[String(year)] = item[`${metric.prefix}_${year}`] || 0;
    });

    // Calcular porcentaje de diferencia vs año anterior (usando metric.prefix para toggle)
    yearsToShow.forEach((year, idx) => {
      if (idx > 0) {
        const prevYear = yearsToShow[idx - 1];
        const baseValue = item[`${metric.prefix}_${prevYear}`] || 0;
        const currentValue = item[`${metric.prefix}_${year}`] || 0;
        if (baseValue > 0 && currentValue > 0) {
          dataPoint[`percent_${year}`] = ((currentValue - baseValue) / baseValue) * 100;
          dataPoint[`prevYear_${year}`] = prevYear;
        } else {
          dataPoint[`percent_${year}`] = 0;
        }
      } else {
        dataPoint[`percent_${year}`] = 0;
      }
    });

    return dataPoint;
  });

  const barColors = ['#1B5E9E', '#2E7D32', '#F57C00'];

  const formatValue = (value: number): string => {
    if (metricView === "kg") {
      return `${formatNumber(Math.round(value))} KG`;
    }
    return formatCurrency(value, companyId);
  };

  const formatYAxis = (value: number): string => {
    if (metricView === "kg") {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return String(value);
    }
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const metricLabel = metricView === "usd" ? "Revenue" : metricView === "kg" ? "Volumen" : "Utilidad Bruta";
  const subtitle = has2026
    ? `${yearsToShow.join(' vs ')} - ${metricLabel} por mes`
    : `2024 vs 2025 - ${metricLabel} por mes`;

  return (
    <ChartCard
      title="Comparativo Anual"
      subtitle={subtitle}
    >
      {/* Metric Toggle */}
      <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
        {(Object.entries(METRIC_CONFIG) as [MetricView, typeof METRIC_CONFIG[MetricView]][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setMetricView(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              metricView === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      <div className="h-96 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={80}
              tickFormatter={formatYAxis}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                padding: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold mb-2">{label}</p>
                      {payload.map((entry: any, index: number) => {
                        const year = parseInt(entry.dataKey);
                        const value = entry.value as number;
                        const percentChange = entry.payload[`percent_${year}`];

                        return (
                          <div key={index} className="mb-1">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="font-medium">{entry.name}:</span>
                              <span>{formatValue(value)}</span>
                            </div>
                            {percentChange !== undefined && percentChange !== 0 && entry.payload[`prevYear_${year}`] && (
                              <div className={`text-xs ml-5 mt-0.5 ${percentChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}% vs {entry.payload[`prevYear_${year}`]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="square"
            />
            {yearsToShow.map((year, index) => {
              const hasData = data.totals && (data.totals[`${metric.totalsKey}_${year}`] || 0) > 0;
              return (
                <Bar
                  key={`${year}-${metricView}`}
                  dataKey={String(year)}
                  fill={barColors[index]}
                  radius={[6, 6, 0, 0]}
                  opacity={hasData ? 1 : 0.3}
                  name={`${year}${!hasData ? ' (sin datos)' : ''}`}
                >
                  {index > 0 && hasData && (
                    <LabelList
                      dataKey={`percent_${year}`}
                      position="top"
                      formatter={(value: number) => {
                        if (value === 0 || value === undefined) return '';
                        return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`;
                      }}
                      style={{
                        fontSize: '10px',
                        fill: year === 2025 ? '#2E7D32' : '#F57C00',
                        fontWeight: 600,
                      }}
                    />
                  )}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen de totales */}
      {data.totals && (
        <div className={`mt-4 pt-4 border-t grid gap-4 text-sm ${has2026 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {yearsToShow.map((year) => {
            const total = data.totals[`${metric.totalsKey}_${year}`] || 0;
            const isLastYear = year === yearsToShow[yearsToShow.length - 1];
            const prevYear = yearsToShow[yearsToShow.indexOf(year) - 1];
            const prevTotal = prevYear ? (data.totals[`${metric.totalsKey}_${prevYear}`] || 0) : 0;
            const percent = prevYear && prevTotal > 0
              ? ((total - prevTotal) / prevTotal) * 100
              : undefined;

            return (
              <div key={year}>
                <p className="text-muted-foreground mb-1">Total {year}</p>
                <p className="text-lg font-semibold">
                  {formatValue(total)}
                </p>
                {percent !== undefined && isLastYear && (
                  <p className={`text-xs mt-1 ${percent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {percent >= 0 ? '+' : ''}{percent.toFixed(1)}% vs {prevYear}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
