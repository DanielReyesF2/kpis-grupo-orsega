import { useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, FileText, Clock } from "lucide-react";

// Salesforce components
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { FilterBar } from "@/components/salesforce/layout/FilterBar";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { GaugeChart } from "@/components/salesforce/charts/GaugeChart";
import { FunnelChart } from "@/components/salesforce/charts/FunnelChart";
import { EnhancedDonutChart } from "@/components/salesforce/charts/EnhancedDonutChart";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";

// Hooks
import { useRealTreasuryData } from "@/hooks/useRealTreasuryData";
import { useFilters } from "@/hooks/useFilters";
import { useSavedViews } from "@/hooks/useSavedViews";

interface TreasuryDashboardProps {
  companyId?: number;
}

export function TreasuryDashboard({ companyId }: TreasuryDashboardProps) {
  // Filters
  const { filters, updateFilters } = useFilters({
    companyId,
    status: 'all',
    currency: 'all',
    dateFrom: '',
    dateTo: '',
  }, {
    syncWithURL: true,
    persistInLocalStorage: true,
    storageKey: 'treasury_filters'
  });

  // Saved views
  const { savedViews, saveView, loadView } = useSavedViews();

  // Real data
  const { vouchers, exchangeRates, payments, stats, isLoading, error } = useRealTreasuryData(
    filters.companyId as number | undefined
  );

  // Filter options
  const quickFilters = [
    {
      key: 'status',
      label: 'Estado',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'factura_pagada', label: 'Factura Pagada' },
        { value: 'pendiente_complemento', label: 'Pendiente Complemento' },
        { value: 'complemento_recibido', label: 'Complemento Recibido' },
        { value: 'cierre_contable', label: 'Cierre Contable' },
      ],
    },
    {
      key: 'currency',
      label: 'Moneda',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todas' },
        { value: 'MXN', label: 'MXN' },
        { value: 'USD', label: 'USD' },
      ],
    },
    {
      key: 'dateFrom',
      label: 'Desde',
      type: 'date' as const,
    },
    {
      key: 'dateTo',
      label: 'Hasta',
      type: 'date' as const,
    },
  ];

  // Filter vouchers
  const filteredVouchers = useMemo(() => {
    if (!vouchers) return [];
    
    return vouchers.filter(v => {
      if (filters.status && filters.status !== 'all' && v.status !== filters.status) return false;
      if (filters.currency && filters.currency !== 'all' && v.extractedCurrency !== filters.currency) return false;
      if (filters.dateFrom && v.extractedDate && new Date(v.extractedDate) < new Date(filters.dateFrom as string)) return false;
      if (filters.dateTo && v.extractedDate && new Date(v.extractedDate) > new Date(filters.dateTo as string)) return false;
      return true;
    });
  }, [vouchers, filters]);

  // Calculate next month flow (gauge data)
  const nextMonthFlow = useMemo(() => {
    if (!payments || payments.length === 0) return null;

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStart = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    const nextMonthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

    const nextMonthPayments = payments.filter(p => {
      if (!p.dueDate) return false;
      const dueDate = new Date(p.dueDate);
      return dueDate >= nextMonthStart && dueDate <= nextMonthEnd;
    });

    const totalAmount = nextMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const target = 40000000; // 40M target
    const max = 50000000; // 50M max

    return {
      value: totalAmount,
      min: 0,
      max,
      target,
      zones: [
        { min: 0, max: target * 0.2, color: '#C62828' }, // Red: 0-8M
        { min: target * 0.2, max: target * 0.6, color: '#F57C00' }, // Orange: 8M-24M
        { min: target * 0.6, max: max, color: '#2E7D32' }, // Green: 24M-40M
      ],
    };
  }, [payments]);

  // Pipeline by stage (funnel data)
  const pipelineByStage = useMemo(() => {
    if (!stats?.byStatus) return [];

    const statusLabels: Record<string, string> = {
      factura_pagada: 'Factura Pagada',
      pendiente_complemento: 'Pendiente Complemento',
      complemento_recibido: 'Complemento Recibido',
      cierre_contable: 'Cierre Contable',
    };

    const statusColors: Record<string, string> = {
      factura_pagada: '#1B5E9E',
      pendiente_complemento: '#F57C00',
      complemento_recibido: '#0288D1',
      cierre_contable: '#2E7D32',
    };

    return Object.entries(stats.byStatus)
      .map(([status, count]) => ({
        stage: statusLabels[status] || status,
        value: count as number,
        color: statusColors[status] || '#666666',
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  // Distribution by source (donut data)
  const distributionBySource = useMemo(() => {
    if (!vouchers || vouchers.length === 0) return [];

    // Group by extracted bank or source
    const bySource = vouchers.reduce((acc, v) => {
      const source = v.extractedBank || 'Otros';
      if (!acc[source]) {
        acc[source] = { count: 0, amount: 0 };
      }
      acc[source].count += 1;
      acc[source].amount += v.extractedAmount || 0;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    return Object.entries(bySource)
      .map(([source, data], index) => ({
        name: source,
        value: data.amount,
        color: `hsl(${(index * 360) / Object.keys(bySource).length}, 70%, 50%)`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [vouchers]);

  // Forecast by category (would need additional data)
  const forecastByCategory = useMemo(() => {
    // Placeholder data - would come from actual forecast data
    return [
      { category: 'Omitted', value: 584000 },
      { category: 'Pipeline', value: 8900000 },
      { category: 'Best Case', value: 16000000 },
      { category: 'Commit', value: 8300000 },
    ];
  }, []);

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
        objectIcon={DollarSign}
        title="Dashboard de Tesorería"
        subtitle="Vista general de comprobantes, pagos y flujo de caja"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Tesorería', href: '/treasury' },
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
        resultCount={filteredVouchers.length}
      />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Month Flow Gauge */}
        {nextMonthFlow && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ChartCard
              title="Flujo Próximo Mes"
              subtitle="Pagos programados para el próximo mes"
              onViewReport={() => {}}
            >
              {isLoading ? (
                <LoadingState variant="chart" />
              ) : error ? (
                <ErrorState variant="card" message="Error al cargar datos" />
              ) : (
                <GaugeChart
                  value={nextMonthFlow.value}
                  min={nextMonthFlow.min}
                  max={nextMonthFlow.max}
                  zones={nextMonthFlow.zones}
                  label="Flujo Próximo Mes"
                  unit=" USD"
                  formatValue={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  size="lg"
                  animated
                />
              )}
            </ChartCard>
          </motion.div>
        )}

        {/* Pipeline by Stage Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ChartCard
            title="Pipeline por Estado"
            subtitle="Comprobantes por etapa del proceso"
            onViewReport={() => {}}
          >
            {isLoading ? (
              <LoadingState variant="chart" />
            ) : error ? (
              <ErrorState variant="card" message="Error al cargar datos" />
            ) : pipelineByStage.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Sin comprobantes"
                description="No hay comprobantes para mostrar"
                size="sm"
              />
            ) : (
              <FunnelChart
                data={pipelineByStage}
                showPercentages
                formatValue={(value) => value.toLocaleString()}
              />
            )}
          </ChartCard>
        </motion.div>

        {/* Distribution by Source Donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ChartCard
            title="Distribución por Fuente"
            subtitle="Comprobantes por banco o fuente de pago"
            onViewReport={() => {}}
          >
            {isLoading ? (
              <LoadingState variant="chart" />
            ) : error ? (
              <ErrorState variant="card" message="Error al cargar datos" />
            ) : distributionBySource.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Sin datos"
                description="No hay datos de distribución disponibles"
                size="sm"
              />
            ) : (
              <EnhancedDonutChart
                data={distributionBySource}
                centerLabel="Total"
                centerValue={stats?.totalAmount || 0}
                showLegend
                legendPosition="right"
              />
            )}
          </ChartCard>
        </motion.div>

        {/* Forecast by Category Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ChartCard
            title="Forecast por Categoría"
            subtitle="Pronóstico de pagos por categoría"
            onViewReport={() => {}}
          >
            {isLoading ? (
              <LoadingState variant="chart" />
            ) : (
              <div className="space-y-3">
                {forecastByCategory.map((item, index) => (
                  <div key={item.category} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium text-foreground">
                      {item.category}
                    </div>
                    <div className="flex-1">
                      <div className="h-8 bg-primary/20 rounded-md flex items-center justify-end pr-3">
                        <span className="text-sm font-semibold text-foreground">
                          ${(item.value / 1000000).toFixed(1)}M
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </motion.div>
      </div>
    </div>
  );
}

