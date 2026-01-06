/**
 * Dashboard de Ventas - Rediseñado completamente con datos reales
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Salesforce components
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";

// New components
import { SalesKPICard } from "./SalesKPICard";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { MonthlyTrendsChart } from "./MonthlyTrendsChart";
import { TopClientsTable } from "./TopClientsTable";
import { TopProductsTable } from "./TopProductsTable";
import { YearlyComparisonChart } from "./YearlyComparisonChart";
import { ClientTrendsTable } from "./ClientTrendsTable";

interface SalesDashboardProps {
  companyId?: number;
}

export function SalesDashboard({ companyId }: SalesDashboardProps) {
  // Usar directamente companyId del prop (viene del contexto/URL)
  const resolvedCompanyId = companyId || 1;

  // Fetch sales stats for KPIs
  const { data: salesStats, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['/api/sales-stats', resolvedCompanyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-stats?companyId=${resolvedCompanyId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch sales stats: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch monthly trends to calculate total revenue
  const { data: monthlyTrends } = useQuery({
    queryKey: ['/api/sales-monthly-trends', resolvedCompanyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-monthly-trends?companyId=${resolvedCompanyId}`);
      if (!res.ok) {
        return [];
      }
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate total revenue from monthly trends
  const totalRevenue = monthlyTrends?.reduce((sum: number, month: any) => sum + (month.amount || 0), 0) || 0;

  // Calculate growth percentage
  const growthPercent = salesStats?.growth || 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        objectIcon={TrendingUp}
        title="Dashboard de Ventas"
        subtitle="Vista general de pipeline, objetivos y distribución de ventas"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas', href: '/sales' },
          { label: 'Dashboard' },
        ]}
      />

      {/* KPIs Principales - Grid 4 columnas */}
      {isLoadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : statsError ? (
        <ErrorState variant="page" message="Error al cargar métricas de ventas" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SalesKPICard
            title="Revenue Total"
            value={formatCurrency(totalRevenue, resolvedCompanyId)}
            subtitle={`${formatNumber(salesStats?.currentVolume || 0)} ${salesStats?.unit || 'KG'} vendidos`}
            icon={DollarSign}
            trend={growthPercent !== undefined ? {
              value: growthPercent,
              label: "vs período anterior"
            } : undefined}
            variant="success"
          />
          <SalesKPICard
            title="Clientes Activos"
            value={salesStats?.activeClients || 0}
            subtitle={`${salesStats?.activeClientsMetrics?.last3Months || 0} últimos 3 meses`}
            icon={Users}
            variant="default"
          />
          <SalesKPICard
            title="Crecimiento"
            value={`${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%`}
            subtitle="vs período anterior"
            icon={TrendingUp}
            variant={growthPercent >= 0 ? "success" : "danger"}
          />
          <SalesKPICard
            title="Retención"
            value={`${(salesStats?.retentionRate?.rate || 0).toFixed(1)}%`}
            subtitle={`${salesStats?.retentionRate?.retainedClients || 0} clientes retenidos`}
            icon={Target}
            variant="default"
          />
        </div>
      )}

      {/* Comparativo Anual */}
      <YearlyComparisonChart companyId={resolvedCompanyId} />

      {/* Top Clientes y Top Productos - Grid 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopClientsTable companyId={resolvedCompanyId} limit={10} period="year" />
        <TopProductsTable companyId={resolvedCompanyId} limit={10} period="year" />
      </div>

      {/* Tendencias Mensuales */}
      <MonthlyTrendsChart companyId={resolvedCompanyId} />

      {/* Tendencias de Clientes */}
      <ClientTrendsTable companyId={resolvedCompanyId} limit={10} />
    </div>
  );
}
