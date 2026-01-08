import { useMemo } from "react";
import { motion } from "framer-motion";
import { Target, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

// Salesforce components
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { FilterBar } from "@/components/salesforce/layout/FilterBar";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { GaugeChart } from "@/components/salesforce/charts/GaugeChart";
import { FunnelChart } from "@/components/salesforce/charts/FunnelChart";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";

// Hooks
import { useRealKpiData } from "@/hooks/useRealKpiData";
import { useFilters } from "@/hooks/useFilters";
import { useSavedViews } from "@/hooks/useSavedViews";

interface KpiDashboardProps {
  companyId?: number;
  areaId?: number;
}

export function KpiDashboard({ companyId, areaId }: KpiDashboardProps) {
  // Filters
  const { filters, updateFilters } = useFilters({
    companyId,
    areaId,
    status: 'all',
    period: 'all',
  }, {
    syncWithURL: true,
    persistInLocalStorage: true,
    storageKey: 'kpi_filters'
  });

  // Saved views
  const { savedViews, saveView, loadView } = useSavedViews();

  // Real data
  const { kpis, isLoading, error } = useRealKpiData(
    filters.companyId as number | undefined,
    filters.areaId as number | undefined
  );

  // Filter KPIs by status
  const filteredKpis = useMemo(() => {
    if (!kpis) return [];
    
    let filtered = kpis;
    
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(kpi => kpi.currentStatus === filters.status);
    }
    
    return filtered;
  }, [kpis, filters.status]);

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
      defaultValue: String(companyId || 1),
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
    if (!filteredKpis) return [];
    
    return filteredKpis
      .filter(kpi => kpi.currentValue !== undefined && kpi.target)
      .slice(0, 6)
      .map(kpi => {
        const target = typeof kpi.target === 'string' ? parseFloat(kpi.target) : kpi.target;
        const value = typeof kpi.currentValue === 'string' ? parseFloat(kpi.currentValue) : kpi.currentValue;
        const max = Math.max(target * 1.5, value * 1.2);
        
        const zones = [
          { min: 0, max: target * 0.9, color: '#C62828' },
          { min: target * 0.9, max: target, color: '#F57C00' },
          { min: target, max: max, color: '#2E7D32' },
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
  }, [filteredKpis]);

  // Compliance distribution funnel
  const complianceDistribution = useMemo(() => {
    if (!kpis) return [];

    const byStatus = kpis.reduce((acc, kpi) => {
      const status = kpi.currentStatus || kpi.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      {
        stage: 'Cumple',
        value: byStatus.complies || 0,
        color: '#2E7D32',
      },
      {
        stage: 'Alerta',
        value: byStatus.alert || 0,
        color: '#F57C00',
      },
      {
        stage: 'No Cumple',
        value: byStatus.not_compliant || 0,
        color: '#C62828',
      },
    ].filter(item => item.value > 0);
  }, [kpis]);

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
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        objectIcon={Target}
        title="Dashboard de KPIs"
        subtitle="Vista general de indicadores clave de rendimiento"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Control de KPIs', href: '/kpi-control' },
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
        resultCount={filteredKpis.length}
      />

      {/* Compliance Distribution Funnel */}
      {complianceDistribution.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ChartCard
            title="Distribución de Cumplimiento"
            subtitle="KPIs por estado de cumplimiento"
            onViewReport={() => {}}
          >
            {isLoading ? (
              <LoadingState variant="chart" />
            ) : error ? (
              <ErrorState variant="card" message="Error al cargar datos" />
            ) : (
              <FunnelChart
                data={complianceDistribution}
                showPercentages
                formatValue={(value) => value.toLocaleString()}
              />
            )}
          </ChartCard>
        </motion.div>
      )}

      {/* KPI Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <LoadingState key={i} variant="card" />
          ))
        ) : error ? (
          <div className="col-span-full">
            <ErrorState
              variant="card"
              title="Error al cargar KPIs"
              message={(error as Error)?.message || 'No se pudieron cargar los KPIs'}
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
                onViewReport={() => {}}
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
    </div>
  );
}

