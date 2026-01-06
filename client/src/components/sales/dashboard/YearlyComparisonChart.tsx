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
import { formatCurrency } from "@/lib/sales-utils";

interface YearlyComparisonChartProps {
  companyId: number;
  year1?: number;
  year2?: number;
}

export function YearlyComparisonChart({ companyId, year1, year2 }: YearlyComparisonChartProps) {
  // Por defecto: comparar 2024 vs 2025 (año anterior vs año actual)
  // Cuando haya datos de 2026, se mostrarán automáticamente los 3 años
  const currentYear = new Date().getFullYear();
  const defaultYear1 = year1 || (currentYear - 1); // 2024
  const defaultYear2 = year2 || currentYear; // 2025

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

  // Detectar si hay datos de 2026 para mostrar 3 años
  // Siempre usar 2024 y 2025 por defecto, agregar 2026 solo si hay datos
  const availableYears = data.availableYears || [];
  const has2026 = availableYears.includes(2026);
  const yearsToShow = has2026 ? [2024, 2025, 2026] : [2024, 2025];

  // Preparar datos para el gráfico (soporta 2 o 3 años)
  const chartData = data.data.map((item: any) => {
    const dataPoint: any = {
      mes: item.mes.substring(0, 3), // Primeras 3 letras del mes
    };
    
    // Agregar datos de todos los años disponibles
    yearsToShow.forEach((year) => {
      dataPoint[String(year)] = item[`amt_${year}`] || 0;
    });
    
    return dataPoint;
  });

  // Colores para las barras (soporta hasta 3 años)
  const barColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))'
  ];

  return (
    <ChartCard
      title="Comparativo Anual"
      subtitle={has2026 
        ? `${yearsToShow.join(' vs ')} - Revenue por mes`
        : `2024 vs 2025 - Revenue por mes`}
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
            {yearsToShow.map((year, index) => (
              <Bar
                key={year}
                dataKey={String(year)}
                fill={barColors[index]}
                radius={[4, 4, 0, 0]}
                opacity={0.8}
                name={`${year}`}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Resumen de totales */}
      {data.totals && (
        <div className={`mt-4 pt-4 border-t grid gap-4 text-sm ${has2026 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {yearsToShow.map((year) => {
            const total = data.totals[`amt_${year}`] || 0;
            const isLastYear = year === yearsToShow[yearsToShow.length - 1];
            const prevYear = yearsToShow[yearsToShow.indexOf(year) - 1];
            const percent = prevYear && data.totals[`amt_${prevYear}`] > 0
              ? ((total - data.totals[`amt_${prevYear}`]) / data.totals[`amt_${prevYear}`]) * 100
              : undefined;

            return (
              <div key={year}>
                <p className="text-muted-foreground mb-1">Total {year}</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(total, companyId)}
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

