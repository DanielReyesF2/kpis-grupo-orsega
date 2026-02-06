/**
 * Hook para obtener el resumen financiero mensual profundo
 * Single Source of Truth — React Query deduplica automáticamente
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MonthlyFinancialSummary } from "@shared/sales-types";

export function useMonthlyFinancial(companyId: number, year: number, month: number) {
  return useQuery<MonthlyFinancialSummary, Error>({
    queryKey: ['/api/monthly-financial-summary', companyId, year, month],
    queryFn: async () => {
      const res = await apiRequest('GET',
        `/api/monthly-financial-summary?companyId=${companyId}&year=${year}&month=${month}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch monthly financial summary: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 60000,             // 1 min
    cacheTime: 5 * 60 * 1000,     // 5 min in cache
    enabled: !!companyId && companyId > 0 && year > 0 && month > 0,
  });
}
