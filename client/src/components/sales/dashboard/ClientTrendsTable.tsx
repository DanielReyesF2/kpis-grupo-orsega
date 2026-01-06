/**
 * Tabla de tendencias de clientes (crecimiento/caída YoY)
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { TrendingUp, TrendingDown, Users } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { cn } from "@/lib/utils";

interface ClientTrendsTableProps {
  companyId: number;
  limit?: number;
}

export function ClientTrendsTable({ companyId, limit = 10 }: ClientTrendsTableProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/sales-client-trends', companyId, limit],
    queryFn: async () => {
      const queryString = `?companyId=${companyId}&limit=${limit}`;
      const res = await apiRequest('GET', `/api/sales-client-trends${queryString}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch client trends: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <ChartCard
        title="Tendencias de Clientes"
        subtitle="Crecimiento vs año anterior"
      >
        <LoadingState variant="chart" />
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard
        title="Tendencias de Clientes"
        subtitle="Crecimiento vs año anterior"
      >
        <ErrorState variant="card" message="Error al cargar tendencias de clientes" />
      </ChartCard>
    );
  }

  if (!data || !data.clients || data.clients.length === 0) {
    return (
      <ChartCard
        title="Tendencias de Clientes"
        subtitle="Crecimiento vs año anterior"
      >
        <EmptyState
          icon={Users}
          title="Sin datos de tendencias"
          description="No hay datos de tendencias de clientes disponibles"
          size="sm"
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Tendencias de Clientes"
      subtitle={`${data.currentYear} vs ${data.previousYear} - Cambio YoY`}
    >
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 text-white">
            <tr>
              <th className="text-left p-3 font-semibold">Cliente</th>
              <th className="text-right p-3 font-semibold">{data.previousYear}</th>
              <th className="text-right p-3 font-semibold">{data.currentYear}</th>
              <th className="text-right p-3 font-semibold">Cambio</th>
              <th className="text-right p-3 font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {data.clients.map((client: any) => {
              const isPositive = client.changePercent >= 0;
              return (
                <tr key={client.name} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-medium">{client.name}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {formatNumber(client.qtyPrevious)} {client.unit || data.unit}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {formatNumber(client.qtyCurrent)} {client.unit || data.unit}
                  </td>
                  <td className={cn(
                    "p-3 text-right font-semibold",
                    isPositive ? "text-emerald-600" : "text-red-600"
                  )}>
                    <div className="flex items-center justify-end gap-1">
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {isPositive ? '+' : ''}{formatNumber(client.change)} {client.unit || data.unit}
                    </div>
                  </td>
                  <td className={cn(
                    "p-3 text-right font-bold",
                    isPositive ? "text-emerald-600" : "text-red-600"
                  )}>
                    {isPositive ? '+' : ''}{client.changePercent.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

