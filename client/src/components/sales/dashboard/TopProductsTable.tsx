/**
 * Tabla de top productos con gráfico de barras
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { Package } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useState } from "react";
import { formatNumber, formatCurrency } from "@/lib/sales-utils";

interface TopProductsTableProps {
  companyId: number;
  limit?: number;
  period?: 'month' | 'year' | '3months';
}

type SortBy = 'volume' | 'revenue';

const COLORS = ['#1B5E9E', '#0288D1', '#00ACC1', '#009688', '#2E7D32', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800'];

export function TopProductsTable({ companyId, limit = 10, period = 'year' }: TopProductsTableProps) {
  const [sortBy, setSortBy] = useState<SortBy>('revenue'); // Por defecto ordenar por revenue

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sales-top-products', companyId, limit, period, sortBy],
    queryFn: async () => {
      const queryString = `?companyId=${companyId}&limit=${limit}&period=${period}&sortBy=${sortBy}`;
      const res = await apiRequest('GET', `/api/sales-top-products${queryString}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch top products: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <ChartCard
        title="Top Productos"
        subtitle={`Top ${limit} productos por volumen`}
      >
        <LoadingState variant="chart" />
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard
        title="Top Productos"
        subtitle={`Top ${limit} productos por volumen`}
      >
        <ErrorState variant="card" message="Error al cargar top productos" />
      </ChartCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <ChartCard
        title="Top Productos"
        subtitle={`Top ${limit} productos por volumen`}
      >
        <EmptyState
          icon={Package}
          title="Sin datos de productos"
          description="No hay datos de productos disponibles"
          size="sm"
        />
      </ChartCard>
    );
  }

  // Calcular totales para porcentajes
  const totalVolume = data.reduce((sum: number, product: any) => sum + product.volume, 0);
  const totalRevenue = data.reduce((sum: number, product: any) => sum + product.revenue, 0);

  // Preparar datos para gráfico (mostrar la métrica seleccionada)
  const chartData = data.map((product: any, index: number) => ({
    name: product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name,
    fullName: product.name,
    volume: product.volume,
    revenue: product.revenue,
    profitability: product.profitability || 0,
    uniqueClients: product.uniqueClients,
    transactions: product.transactions,
    value: sortBy === 'revenue' ? product.revenue : product.volume,
    percentage: sortBy === 'revenue' 
      ? (totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0)
      : (totalVolume > 0 ? (product.volume / totalVolume) * 100 : 0),
    color: COLORS[index % COLORS.length],
  }));

  return (
    <ChartCard
      title="Top Productos"
      subtitle={`Top ${limit} productos por ${sortBy === 'revenue' ? 'revenue' : 'volumen'} (${period === 'year' ? 'año actual' : period === 'month' ? 'mes actual' : 'últimos 3 meses'})`}
    >
      {/* Selector de ordenamiento */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Ordenar por:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('revenue')}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-all ${
              sortBy === 'revenue'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border-2 border-border text-foreground hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-all ${
              sortBy === 'volume'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border-2 border-border text-foreground hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            Volumen
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {/* Gráfico de barras horizontal */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => {
                  if (sortBy === 'revenue') {
                    return formatCurrency(value, companyId);
                  }
                  return formatNumber(value);
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string, props: any) => {
                  if (sortBy === 'revenue') {
                    return [formatCurrency(value, companyId), 'Revenue'];
                  }
                  return [`${formatNumber(value)} ${data[chartData.indexOf(props.payload)]?.unit || ''}`, 'Volumen'];
                }}
                labelFormatter={(label) => `Producto: ${label}`}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla de detalles */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="text-left p-3 font-semibold">Producto</th>
                <th className="text-right p-3 font-semibold">Volumen</th>
                <th className="text-right p-3 font-semibold">Revenue</th>
                <th className="text-right p-3 font-semibold">Rentabilidad</th>
                <th className="text-right p-3 font-semibold">Clientes</th>
                <th className="text-right p-3 font-semibold">Transacciones</th>
                <th className="text-right p-3 font-semibold">% del Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((product: any, index: number) => {
                const percentage = totalVolume > 0 ? (product.volume / totalVolume) * 100 : 0;
                return (
                  <tr key={product.name} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-medium">{product.name}</td>
                    <td className="p-3 text-right">
                      {formatNumber(product.volume)} {product.unit || ''}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {product.revenue ? formatCurrency(product.revenue, companyId) : '-'}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {product.profitability ? formatCurrency(product.profitability, companyId) : '-'}
                      <span className="text-xs text-muted-foreground ml-1">/ {product.unit || 'unidad'}</span>
                    </td>
                    <td className="p-3 text-right">{product.uniqueClients}</td>
                    <td className="p-3 text-right">{product.transactions}</td>
                    <td className="p-3 text-right font-semibold">
                      {sortBy === 'revenue' 
                        ? (totalRevenue > 0 ? ((product.revenue / totalRevenue) * 100).toFixed(1) : '0.0')
                        : percentage.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  );
}

