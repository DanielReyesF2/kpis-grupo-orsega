/**
 * Gráfico de tendencias mensuales de ventas
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from "recharts";
import { formatCurrency } from "@/lib/sales-utils";

interface MonthlyTrendsChartProps {
  companyId: number;
  year?: number;
}

export function MonthlyTrendsChart({ companyId, year }: MonthlyTrendsChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sales-monthly-trends', companyId, year],
    queryFn: async () => {
      const queryString = year ? `?companyId=${companyId}&year=${year}` : `?companyId=${companyId}`;
      const res = await apiRequest('GET', `/api/sales-monthly-trends${queryString}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch monthly trends: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <ChartCard
        title="Tendencias Mensuales"
        subtitle="Ventas por mes"
      >
        <LoadingState variant="chart" />
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard
        title="Tendencias Mensuales"
        subtitle="Ventas por mes"
      >
        <ErrorState variant="card" message="Error al cargar tendencias mensuales" />
      </ChartCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <ChartCard
        title="Tendencias Mensuales"
        subtitle="Ventas por mes"
      >
        <EmptyState
          icon={TrendingUp}
          title="Sin datos mensuales"
          description="No hay datos de ventas mensuales disponibles"
          size="sm"
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Tendencias Mensuales"
      subtitle={`Ventas por mes ${year ? `- ${year}` : ''}`}
    >
      <div className="h-96 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
            <XAxis
              dataKey="month"
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
                padding: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              formatter={(value: number) => formatCurrency(value, companyId)}
            />
            <Legend 
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="square"
            />
            <Bar
              dataKey="amount"
              fill="hsl(var(--chart-1))"
              radius={[6, 6, 0, 0]}
              opacity={0.85}
              name="Ventas"
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="hsl(var(--chart-2))"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Tendencia"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

