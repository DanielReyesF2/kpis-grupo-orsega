/**
 * Gráfico comparativo anual (año actual vs año anterior)
 */

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
} from "recharts";
import { formatCurrency } from "./SalesKPICard";

interface YearlyComparisonChartProps {
  companyId: number;
  year1?: number;
  year2?: number;
}

export function YearlyComparisonChart({ companyId, year1, year2 }: YearlyComparisonChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sales-yearly-comparison', companyId, year1, year2],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (year1) params.append('year1', String(year1));
      if (year2) params.append('year2', String(year2));
      const res = await apiRequest('GET', `/api/sales-yearly-comparison?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch yearly comparison: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <ChartCard
        title="Comparativo Anual"
        subtitle="Año actual vs año anterior"
      >
        <LoadingState variant="chart" />
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard
        title="Comparativo Anual"
        subtitle="Año actual vs año anterior"
      >
        <ErrorState variant="card" message="Error al cargar comparativo anual" />
      </ChartCard>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <ChartCard
        title="Comparativo Anual"
        subtitle="Año actual vs año anterior"
      >
        <EmptyState
          icon={BarChart3}
          title="Sin datos comparativos"
          description="No hay datos disponibles para comparar"
          size="sm"
        />
      </ChartCard>
    );
  }

  // Preparar datos para el gráfico
  const chartData = data.data.map((item: any) => ({
    mes: item.mes.substring(0, 3), // Primeras 3 letras del mes
    [`${data.year1}`]: item[`amt_${data.year1}`],
    [`${data.year2}`]: item[`amt_${data.year2}`],
  }));

  return (
    <ChartCard
      title="Comparativo Anual"
      subtitle={`${data.year1} vs ${data.year2} - Revenue por mes`}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                return `$${value}`;
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number) => formatCurrency(value, companyId)}
            />
            <Legend />
            <Bar
              dataKey={String(data.year1)}
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
              name={`${data.year1}`}
            />
            <Bar
              dataKey={String(data.year2)}
              fill="hsl(var(--chart-2))"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
              name={`${data.year2}`}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Resumen de totales */}
      {data.totals && (
        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Total {data.year1}</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data.totals[`amt_${data.year1}`], companyId)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Total {data.year2}</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data.totals[`amt_${data.year2}`], companyId)}
            </p>
            {data.totals.amt_percent !== undefined && (
              <p className={`text-xs mt-1 ${data.totals.amt_percent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {data.totals.amt_percent >= 0 ? '+' : ''}{data.totals.amt_percent.toFixed(1)}% vs {data.year1}
              </p>
            )}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

