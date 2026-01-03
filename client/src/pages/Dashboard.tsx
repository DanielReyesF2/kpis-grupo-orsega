import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, DollarSign, Target } from 'lucide-react';

// Salesforce components
import { PageHeader } from '@/components/salesforce/layout/PageHeader';
import { FilterBar } from '@/components/salesforce/layout/FilterBar';
import { ChartCard } from '@/components/salesforce/layout/ChartCard';
import { GaugeChart } from '@/components/salesforce/charts/GaugeChart';
import { FunnelChart } from '@/components/salesforce/charts/FunnelChart';
import { EnhancedDonutChart } from '@/components/salesforce/charts/EnhancedDonutChart';
import { LoadingState } from '@/components/salesforce/feedback/LoadingState';
import { EmptyState } from '@/components/salesforce/feedback/EmptyState';
import { ErrorState } from '@/components/salesforce/feedback/ErrorState';

// Hooks
import { useRealKpiData } from '@/hooks/useRealKpiData';
import { useRealSalesData } from '@/hooks/useRealSalesData';
import { useFilters } from '@/hooks/useFilters';
import { useSavedViews } from '@/hooks/useSavedViews';

// Existing components (to be gradually replaced)
import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { SalesOverviewCard } from '@/components/dashboard/SalesOverviewCard';
import { OrderStatsCard } from '@/components/dashboard/OrderStatsCard';
import { AnnualSummary } from '@/components/dashboard/AnnualSummary';
import { ProfitabilityByProductsCard } from '@/components/dashboard/ProfitabilityByProductsCard';
import { ProfitabilityMetrics } from '@/components/dashboard/ProfitabilityMetrics';

export default function Dashboard() {
  const { user } = useAuth();
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  
  // Company selection
  const [selectedCompany, setSelectedCompany] = useState<number>(() => {
    const storedCompany = localStorage.getItem('selectedCompanyId');
    return storedCompany ? Number(storedCompany) : 1;
  });

  // Filters
  const { filters, updateFilters, clearFilters } = useFilters({
    companyId: selectedCompany,
    period: 'all',
    status: 'all',
  }, {
    syncWithURL: true,
    persistInLocalStorage: true,
    storageKey: 'dashboard_filters'
  });

  // Saved views
  const { savedViews, saveView, loadView } = useSavedViews();

  // Real data hooks
  const { kpis, isLoading: isLoadingKpis, error: kpisError } = useRealKpiData(
    filters.companyId as number,
    filters.areaId as number | undefined
  );

  const { salesData, stats: salesStats, isLoading: isLoadingSales, error: salesError } = useRealSalesData(
    filters.companyId as number,
    {
      startDate: filters.startDate as string | undefined,
      endDate: filters.endDate as string | undefined,
    }
  );

  // Update company when filter changes
  React.useEffect(() => {
    if (filters.companyId && filters.companyId !== selectedCompany) {
      setSelectedCompany(filters.companyId as number);
      localStorage.setItem('selectedCompanyId', String(filters.companyId));
    }
  }, [filters.companyId, selectedCompany]);

  // Listen to company changes from sidebar
  React.useEffect(() => {
    const handleCompanyChange = (event: CustomEvent) => {
      const { companyId } = event.detail;
      updateFilters({ companyId });
    };

    window.addEventListener('companyChanged', handleCompanyChange as EventListener);
    return () => {
      window.removeEventListener('companyChanged', handleCompanyChange as EventListener);
    };
  }, [updateFilters]);

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
      defaultValue: String(selectedCompany),
    },
    {
      key: 'period',
      label: 'Período',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'month', label: 'Este mes' },
        { value: 'quarter', label: 'Este trimestre' },
        { value: 'year', label: 'Este año' },
      ],
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'complies', label: 'Cumple' },
        { value: 'alert', label: 'Alerta' },
        { value: 'not_compliant', label: 'No cumple' },
      ],
    },
  ];

  // Process KPIs for gauges
  const kpiGauges = useMemo(() => {
    if (!kpis) return [];
    
    return kpis
      .filter(kpi => kpi.currentValue !== undefined && kpi.target)
      .slice(0, 6) // Top 6 KPIs
      .map(kpi => {
        const target = typeof kpi.target === 'string' ? parseFloat(kpi.target) : kpi.target;
        const value = typeof kpi.currentValue === 'string' ? parseFloat(kpi.currentValue) : kpi.currentValue;
        const max = Math.max(target * 1.5, value * 1.2);
        
        const zones = [
          { min: 0, max: target * 0.9, color: '#C62828' }, // Red
          { min: target * 0.9, max: target, color: '#F57C00' }, // Orange
          { min: target, max: max, color: '#2E7D32' }, // Green
        ];

        return {
          kpi,
          value: value || 0,
          min: 0,
          max,
          zones,
          label: kpi.name,
          unit: kpi.unit || '',
        };
      });
  }, [kpis]);

  // Process sales data for funnel
  const salesFunnel = useMemo(() => {
    if (!salesStats) return [];

    // This would come from actual sales pipeline data
    // For now, using placeholder structure
    return [
      { stage: 'Leads', value: 1000, color: '#1B5E9E' },
      { stage: 'Oportunidades', value: 500, color: '#0288D1' },
      { stage: 'Propuestas', value: 250, color: '#00ACC1' },
      { stage: 'Negociación', value: 125, color: '#009688' },
      { stage: 'Cerrado', value: 50, color: '#2E7D32' },
    ];
  }, [salesStats]);

  // Process sales distribution for donut
  const salesDistribution = useMemo(() => {
    if (!salesStats?.byProduct) return [];

    const topProducts = Object.entries(salesStats.byProduct)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .slice(0, 6)
      .map(([productId, data], index) => ({
        name: `Producto ${productId}`,
        value: data.amount,
        color: `hsl(${(index * 360) / 6}, 70%, 50%)`,
      }));

    return topProducts;
  }, [salesStats]);

  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);

  const handleViewKpiDetails = (kpiId: number) => {
    setSelectedKpiId(kpiId);
    setIsKpiModalOpen(true);
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

  return (
    <AppLayout title="Dashboard Ejecutivo">
      <div id="dashboard-container" ref={dashboardRef} className="min-h-screen space-y-6">
        {/* Page Header */}
        <PageHeader
          objectIcon={BarChart3}
          title="Dashboard Ejecutivo"
          subtitle={`Vista general de KPIs y métricas de ventas${user ? ` - ${user.name}` : ''}`}
          breadcrumbs={[
            { label: 'Inicio', href: '/' },
            { label: 'Dashboard' },
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
          resultCount={kpis?.length || 0}
        />

        {/* KPI Gauges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingKpis ? (
            Array.from({ length: 6 }).map((_, i) => (
              <LoadingState key={i} variant="card" />
            ))
          ) : kpisError ? (
            <div className="col-span-full">
              <ErrorState
                variant="card"
                title="Error al cargar KPIs"
                message={kpisError.message || 'No se pudieron cargar los KPIs'}
                onRetry={() => window.location.reload()}
              />
            </div>
          ) : kpiGauges.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={Target}
                title="No hay KPIs disponibles"
                description="No se encontraron KPIs para los filtros seleccionados"
                size="md"
              />
            </div>
          ) : (
            kpiGauges.map((gauge, index) => (
              <motion.div
                key={gauge.kpi.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ChartCard
                  title={gauge.label}
                  subtitle={`Objetivo: ${gauge.kpi.target}${gauge.unit}`}
                  onViewReport={() => handleViewKpiDetails(gauge.kpi.id)}
                >
                  <GaugeChart
                    value={gauge.value}
                    min={gauge.min}
                    max={gauge.max}
                    zones={gauge.zones}
                    label={gauge.label}
                    unit={gauge.unit}
                    size="md"
                    animated
                  />
                </ChartCard>
              </motion.div>
            ))
          )}
        </div>

        {/* Sales Pipeline Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ChartCard
            title="Pipeline de Ventas"
            subtitle="Proceso de ventas por etapa"
            onViewReport={() => {}}
          >
            {isLoadingSales ? (
              <LoadingState variant="chart" />
            ) : salesError ? (
              <ErrorState
                variant="card"
                message="Error al cargar datos de ventas"
              />
            ) : salesFunnel.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Sin datos de pipeline"
                description="No hay datos de pipeline de ventas disponibles"
                size="sm"
              />
            ) : (
              <FunnelChart
                data={salesFunnel}
                showPercentages
                formatValue={(value) => `$${value.toLocaleString()}`}
              />
            )}
          </ChartCard>
        </motion.div>

        {/* Sales Distribution Donut */}
        {salesDistribution.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <ChartCard
              title="Distribución por Producto"
              subtitle="Ventas por producto"
            >
              <EnhancedDonutChart
                data={salesDistribution}
                centerLabel="Total Ventas"
                centerValue={salesStats?.totalAmount || 0}
                showLegend
                legendPosition="right"
                formatValue={(value) => `$${value.toLocaleString()}`}
              />
            </ChartCard>
          </motion.div>
        )}

        {/* Existing components (to be gradually replaced) */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7">
            <SalesOverviewCard companyId={selectedCompany} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <OrderStatsCard companyId={selectedCompany} />
          </div>
          <div className="col-span-12">
            <AnnualSummary companyId={selectedCompany} />
          </div>
          <div className="col-span-12">
            <ProfitabilityByProductsCard companyId={selectedCompany} />
          </div>
        </div>

        <section className="mt-6">
          <ProfitabilityMetrics companyId={selectedCompany} />
        </section>

        {/* KPI Details Dialog */}
        <KpiDetailDialog
          kpiId={selectedKpiId}
          isOpen={isKpiModalOpen}
          onClose={() => setIsKpiModalOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
