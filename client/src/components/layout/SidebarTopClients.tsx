/**
 * Sidebar Top Clients - Componente compacto de top clientes para el sidebar
 */

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Users } from "lucide-react";

interface SidebarTopClientsProps {
  companyId: number;
}

interface TopClient {
  name: string;
  volume: number;
  transactions: number;
  unit: string;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('es-MX', { maximumFractionDigits: 0 });
}

export function SidebarTopClients({ companyId }: SidebarTopClientsProps) {
  const { data: topClients, isLoading } = useQuery<TopClient[]>({
    queryKey: ['/api/sales-top-clients', companyId, 5, 'year'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-top-clients?companyId=${companyId}&limit=5&period=year`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!topClients || topClients.length === 0) {
    return (
      <div className="text-center py-4">
        <Users className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-2">
        Top Clientes
      </p>
      {topClients.slice(0, 5).map((client, index) => (
        <div
          key={index}
          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
        >
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">
              {index + 1}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{client.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatNumber(client.volume)} {client.unit}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

