/**
 * Hook para obtener insights del analista de ventas
 * Single Source of Truth para todos los datos del analista
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

export function useSalesAnalyst(companyId: number) {
  return useQuery<SalesAnalystInsights>({
    queryKey: ['/api/sales-analyst/insights', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-analyst/insights?companyId=${companyId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch sales analyst insights: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 15 * 60 * 1000, // 15 min (datos periódicos)
    gcTime: 30 * 60 * 1000,     // 30 min en cache
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 60 * 1000, // 30 min auto-refresh
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!companyId && companyId > 0,
  });
}

