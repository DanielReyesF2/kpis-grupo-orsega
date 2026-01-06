/**
 * Tabla de top clientes con gráfico de barras
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { Users } from "lucide-react";
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

interface TopClientsTableProps {
  companyId: number;
  limit?: number;
  period?: 'month' | 'year' | '3months';
}

const COLORS = ['#1B5E9E', '#0288D1', '#00ACC1', '#009688', '#2E7D32', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800'];

export function TopClientsTable({ companyId, limit = 10, period = 'year' }: TopClientsTableProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sales-top-clients', companyId, limit, period],
    queryFn: async () => {
      const queryString = `?companyId=${companyId}&limit=${limit}&period=${period}`;
      const res = await apiRequest('GET', `/api/sales-top-clients${queryString}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch top clients: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <ChartCard
        title="Top Clientes"
        subtitle={`Top ${limit} clientes por volumen`}
      >
        <LoadingState variant="chart" />
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard
        title="Top Clientes"
        subtitle={`Top ${limit} clientes por volumen`}
      >
        <ErrorState variant="card" message="Error al cargar top clientes" />
      </ChartCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <ChartCard
        title="Top Clientes"
        subtitle={`Top ${limit} clientes por volumen`}
      >
        <EmptyState
          icon={Users}
          title="Sin datos de clientes"
          description="No hay datos de clientes disponibles"
          size="sm"
        />
      </ChartCard>
    );
  }

  // Calcular total para porcentajes
  const totalVolume = data.reduce((sum: number, client: any) => sum + client.volume, 0);

  // Preparar datos para gráfico
  const chartData = data.map((client: any, index: number) => ({
    name: client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name,
    fullName: client.name,
    volume: client.volume,
    transactions: client.transactions,
    percentage: totalVolume > 0 ? (client.volume / totalVolume) * 100 : 0,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <ChartCard
      title="Top Clientes"
      subtitle={`Top ${limit} clientes por volumen (${period === 'year' ? 'año actual' : period === 'month' ? 'mes actual' : 'últimos 3 meses'})`}
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
                  `${formatNumber(value)} ${props.payload.unit || ''}`,
                  'Volumen'
                ]}
                labelFormatter={(label) => `Cliente: ${label}`}
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
                <th className="text-left p-3 font-semibold">Cliente</th>
                <th className="text-right p-3 font-semibold">Volumen</th>
                <th className="text-right p-3 font-semibold">Revenue</th>
                <th className="text-right p-3 font-semibold">Transacciones</th>
                <th className="text-right p-3 font-semibold">% del Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((client: any, index: number) => {
                const percentage = totalVolume > 0 ? (client.volume / totalVolume) * 100 : 0;
                return (
                  <tr key={client.name} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{client.name}</td>
                    <td className="p-3 text-right">
                      {formatNumber(client.volume)} {client.unit || ''}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {client.revenue ? formatCurrency(client.revenue, companyId) : '-'}
                    </td>
                    <td className="p-3 text-right">{client.transactions}</td>
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

