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
import { formatNumber, formatCurrency } from "@/lib/sales-utils";

interface TopProductsTableProps {
  companyId: number;
  limit?: number;
  period?: 'month' | 'year' | '3months';
}

const COLORS = ['#1B5E9E', '#0288D1', '#00ACC1', '#009688', '#2E7D32', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800'];

export function TopProductsTable({ companyId, limit = 10, period = 'year' }: TopProductsTableProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sales-top-products', companyId, limit, period],
    queryFn: async () => {
      const queryString = `?companyId=${companyId}&limit=${limit}&period=${period}`;
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

  // Calcular total para porcentajes
  const totalVolume = data.reduce((sum: number, product: any) => sum + product.volume, 0);

  // Preparar datos para gráfico
  const chartData = data.map((product: any, index: number) => ({
    name: product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name,
    fullName: product.name,
    volume: product.volume,
    uniqueClients: product.uniqueClients,
    transactions: product.transactions,
    percentage: totalVolume > 0 ? (product.volume / totalVolume) * 100 : 0,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <ChartCard
      title="Top Productos"
      subtitle={`Top ${limit} productos por volumen (${period === 'year' ? 'año actual' : period === 'month' ? 'mes actual' : 'últimos 3 meses'})`}
    >
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
                tickFormatter={(value) => formatNumber(value)}
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
                formatter={(value: number, name: string, props: any) => [
                  `${formatNumber(value)} ${data[chartData.indexOf(props.payload)]?.unit || ''}`,
                  'Volumen'
                ]}
                labelFormatter={(label) => `Producto: ${label}`}
              />
              <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
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
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Producto</th>
                <th className="text-right p-3 font-semibold">Volumen</th>
                <th className="text-right p-3 font-semibold">Revenue</th>
                <th className="text-right p-3 font-semibold">Clientes</th>
                <th className="text-right p-3 font-semibold">Transacciones</th>
                <th className="text-right p-3 font-semibold">% del Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((product: any, index: number) => {
                const percentage = totalVolume > 0 ? (product.volume / totalVolume) * 100 : 0;
                return (
                  <tr key={product.name} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{product.name}</td>
                    <td className="p-3 text-right">
                      {formatNumber(product.volume)} {product.unit || ''}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {product.revenue ? formatCurrency(product.revenue, companyId) : '-'}
                    </td>
                    <td className="p-3 text-right">{product.uniqueClients}</td>
                    <td className="p-3 text-right">{product.transactions}</td>
                    <td className="p-3 text-right font-semibold">
                      {percentage.toFixed(1)}%
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

