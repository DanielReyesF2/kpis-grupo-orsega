/**
 * Dashboard de Ventas - Rediseñado completamente con datos reales
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Users, Package, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Salesforce components
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { FilterBar } from "@/components/salesforce/layout/FilterBar";
import { GaugeChart } from "@/components/salesforce/charts/GaugeChart";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";

// Hooks
import { useFilters } from "@/hooks/useFilters";
import { useSavedViews } from "@/hooks/useSavedViews";

// New components
import { SalesKPICard, formatCurrency, formatNumber } from "./SalesKPICard";
import { MonthlyTrendsChart } from "./MonthlyTrendsChart";
import { TopClientsTable } from "./TopClientsTable";
import { TopProductsTable } from "./TopProductsTable";
import { YearlyComparisonChart } from "./YearlyComparisonChart";
import { ClientTrendsTable } from "./ClientTrendsTable";

interface SalesDashboardProps {
  companyId?: number;
}

export function SalesDashboard({ companyId }: SalesDashboardProps) {
  // Filters
  const { filters, updateFilters } = useFilters({
    companyId,
    period: 'year',
  }, {
    syncWithURL: true,
    persistInLocalStorage: true,
    storageKey: 'sales_filters'
  });

  // Saved views
  const { savedViews, saveView, loadView } = useSavedViews();

  const resolvedCompanyId = (filters.companyId as number) || companyId || 1;

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

  // Filter options
  const quickFilters = [
    {
      key: 'companyId',
      label: 'Empresa',
      type: 'select' as const,
      options: [
        { value: '1', label: 'DURA' },
        { value: '2', label: 'Orsega' },
      ],
      defaultValue: String(resolvedCompanyId),
    },
    {
      key: 'period',
      label: 'Período',
      type: 'select' as const,
      options: [
        { value: 'year', label: 'Este año' },
        { value: 'quarter', label: 'Este trimestre' },
        { value: 'month', label: 'Este mes' },
        { value: 'all', label: 'Todos' },
      ],
      defaultValue: 'year',
    },
  ];

  // Calculate sales target (use totalRevenue, default 50M target)
  // For Dura (USD): 50M USD, For Orsega (MXN): 50M MXN
  const defaultTarget = 50000000;
  const salesTargetValue = totalRevenue || 0;
  const salesTarget = {
    value: salesTargetValue,
    target: defaultTarget,
    max: defaultTarget * 1.5, // 75M max
    zones: [
      { min: 0, max: defaultTarget * 0.8, color: '#C62828' }, // Red
      { min: defaultTarget * 0.8, max: defaultTarget, color: '#F57C00' }, // Orange
      { min: defaultTarget, max: defaultTarget * 1.5, color: '#2E7D32' }, // Green
    ],
  };

  const handleSaveView = (name: string) => {
    saveView(name, filters);
  };

  const handleLoadView = (viewId: string) => {
    const viewFilters = loadView(viewId);
    if (viewFilters) {
      updateFilters(viewFilters);
    }
  };

  // Calculate growth percentage
  const growthPercent = salesStats?.growth || 0;

  return (
    <div className="space-y-6">
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
        actions={[
          {
            label: 'Nueva Venta',
            onClick: () => {},
            variant: 'default',
            primary: true,
          },
        ]}
      />

      {/* Filter Bar */}
      <FilterBar
        quickFilters={quickFilters}
        filters={filters}
        onFiltersChange={updateFilters}
        onSaveView={handleSaveView}
        savedViews={savedViews}
        onLoadView={handleLoadView}
        resultCount={0}
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

      {/* Objetivo de Ventas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {isLoadingStats ? (
          <LoadingState variant="chart" />
        ) : salesTargetValue > 0 ? (
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Objetivo de Ventas</h3>
                <p className="text-sm text-muted-foreground">
                  Actual: {formatCurrency(salesTarget.value, resolvedCompanyId)} | 
                  Objetivo: {formatCurrency(salesTarget.target, resolvedCompanyId)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Progreso: {((salesTarget.value / salesTarget.target) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <GaugeChart
              value={salesTarget.value}
              min={0}
              max={salesTarget.max}
              zones={salesTarget.zones}
              label="Revenue vs Objetivo"
              unit={resolvedCompanyId === 1 ? " USD" : " MXN"}
              formatValue={(value) => formatCurrency(value, resolvedCompanyId)}
              size="lg"
              animated
            />
          </div>
        ) : (
          <div className="bg-card border rounded-lg p-6">
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay datos suficientes para mostrar el objetivo de ventas</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Tendencias Mensuales */}
      <MonthlyTrendsChart companyId={resolvedCompanyId} />

      {/* Comparativo Anual */}
      <YearlyComparisonChart companyId={resolvedCompanyId} />

      {/* Top Clientes y Top Productos - Grid 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopClientsTable companyId={resolvedCompanyId} limit={10} period="year" />
        <TopProductsTable companyId={resolvedCompanyId} limit={10} period="year" />
      </div>

      {/* Tendencias de Clientes */}
      <ClientTrendsTable companyId={resolvedCompanyId} limit={10} />
    </div>
  );
}
