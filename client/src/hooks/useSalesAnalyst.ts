/**
 * Hook para obtener insights del analista de ventas
 * Single Source of Truth para todos los datos del analista
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

export function useSalesAnalyst(companyId: number) {
  console.log('[useSalesAnalyst] Hook llamado con companyId:', companyId);
  
  return useQuery<SalesAnalystInsights, Error>({
    queryKey: ['/api/sales-analyst/insights', companyId],
    queryFn: async () => {
      console.log('[useSalesAnalyst] Iniciando fetch para companyId:', companyId);
      const res = await apiRequest('GET', `/api/sales-analyst/insights?companyId=${companyId}`);
      console.log('[useSalesAnalyst] Respuesta recibida, status:', res.status, res.ok);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[useSalesAnalyst] Error en respuesta:', errorText);
        throw new Error(`Failed to fetch sales analyst insights: ${res.statusText}`);
      }
      const data = await res.json();
      console.log('[useSalesAnalyst] Datos recibidos:', {
        hasData: !!data,
        focusClients: data?.focusClients ? Object.keys(data.focusClients).length : 0,
        productOpportunities: data?.productOpportunities ? Object.keys(data.productOpportunities).length : 0
      });
      return data;
    },
    staleTime: 15 * 60 * 1000, // 15 min (datos periódicos)
    cacheTime: 30 * 60 * 1000,     // 30 min en cache
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 60 * 1000, // 30 min auto-refresh
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!companyId && companyId > 0,
  });
}

