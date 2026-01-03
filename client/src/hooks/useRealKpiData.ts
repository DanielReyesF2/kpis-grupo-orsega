import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface KpiData {
  id: number;
  name: string;
  target: string | number;
  value?: string | number;
  status: 'complies' | 'alert' | 'not_compliant';
  compliancePercentage?: string;
  unit?: string;
  frequency?: string;
  areaId?: number;
  companyId?: number;
}

export interface KpiValue {
  id: number;
  kpiId: number;
  value: string;
  period: string;
  status: string;
  date: string;
  compliancePercentage?: number;
  comments?: string;
}

export function useRealKpiData(companyId?: number, areaId?: number) {
  // Fetch KPIs
  const { data: kpis, isLoading: isLoadingKpis, error: kpisError } = useQuery<KpiData[]>({
    queryKey: ['/api/kpis', { companyId, areaId }],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Fetch KPI values
  const { data: kpiValues, isLoading: isLoadingValues, error: valuesError } = useQuery<KpiValue[]>({
    queryKey: ['/api/kpi-values', { companyId, areaId }],
    enabled: !!kpis && kpis.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Get latest value for each KPI
  const kpisWithValues = useMemo(() => {
    if (!kpis || !kpiValues) return [];

    return kpis.map(kpi => {
      const values = kpiValues.filter(v => v.kpiId === kpi.id);
      const latestValue = values.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      return {
        ...kpi,
        currentValue: latestValue?.value,
        currentStatus: latestValue?.status || kpi.status,
        lastUpdated: latestValue?.date,
        compliancePercentage: latestValue?.compliancePercentage?.toString() || kpi.compliancePercentage,
        comments: latestValue?.comments,
        history: values
      };
    });
  }, [kpis, kpiValues]);

  return {
    kpis: kpisWithValues,
    isLoading: isLoadingKpis || isLoadingValues,
    error: kpisError || valuesError,
    rawKpis: kpis,
    rawKpiValues: kpiValues
  };
}

