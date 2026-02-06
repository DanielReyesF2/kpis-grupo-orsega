/**
 * Monthly KPI Cards - 4 tarjetas con métricas del mes actual
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SalesKPICard } from "@/components/sales/dashboard/SalesKPICard";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { DollarSign, Package, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MonthlyKPICardsProps {
  companyId: number;
}

export function MonthlyKPICards({ companyId }: MonthlyKPICardsProps) {
  const { data: salesStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/sales-stats", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 30000,
  });

  const { data: monthlyTrends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ["/api/sales-monthly-trends", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-monthly-trends?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoadingStats || isLoadingTrends) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  // Get current month's data from trends
  const sorted = [...(monthlyTrends || [])].sort(
    (a: any, b: any) => (a.year ?? 0) - (b.year ?? 0) || (a.monthNum ?? 0) - (b.monthNum ?? 0)
  );
  const currentMonth = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const previousMonth = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const monthRevenue = currentMonth?.amount || 0;
  const monthVolume = currentMonth?.volume || 0;
  const prevRevenue = previousMonth?.amount || 0;
  const revenueMoM = prevRevenue > 0 ? ((monthRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const unit = salesStats?.unit || (companyId === 1 ? "KG" : "unidades");
  const growthPercent = salesStats?.growth || 0;
  const activeClients = salesStats?.activeClients || 0;

  const monthName = currentMonth?.monthFull || currentMonth?.month || "Mes actual";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SalesKPICard
        title={`Revenue ${monthName}`}
        value={formatCurrency(monthRevenue, companyId)}
        subtitle={`${prevRevenue > 0 ? formatCurrency(prevRevenue, companyId) + " mes anterior" : ""}`}
        icon={DollarSign}
        trend={prevRevenue > 0 ? { value: revenueMoM, label: "vs mes anterior" } : undefined}
        variant="success"
      />
      <SalesKPICard
        title={`Volumen ${monthName}`}
        value={formatNumber(monthVolume)}
        subtitle={`${unit} vendidos`}
        icon={Package}
        variant="default"
      />
      <SalesKPICard
        title="Clientes Activos"
        value={activeClients}
        subtitle={`${salesStats?.activeClientsMetrics?.last3Months || 0} últimos 3 meses`}
        icon={Users}
        variant="default"
      />
      <SalesKPICard
        title="Crecimiento YoY"
        value={`${growthPercent >= 0 ? "+" : ""}${growthPercent.toFixed(1)}%`}
        subtitle="vs mismo período año anterior"
        icon={TrendingUp}
        variant={growthPercent >= 0 ? "success" : "danger"}
      />
    </div>
  );
}
