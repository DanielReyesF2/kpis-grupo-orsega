import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Target, Users, Package } from "lucide-react";

// Salesforce components
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { FilterBar } from "@/components/salesforce/layout/FilterBar";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { GaugeChart } from "@/components/salesforce/charts/GaugeChart";
import { FunnelChart } from "@/components/salesforce/charts/FunnelChart";
import { EnhancedDonutChart } from "@/components/salesforce/charts/EnhancedDonutChart";
import { Path } from "@/components/salesforce/navigation/Path";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";

// Hooks
import { useRealSalesData } from "@/hooks/useRealSalesData";
import { useFilters } from "@/hooks/useFilters";
import { useSavedViews } from "@/hooks/useSavedViews";

interface SalesDashboardProps {
  companyId?: number;
}

export function SalesDashboard({ companyId }: SalesDashboardProps) {
  // Filters
  const { filters, updateFilters } = useFilters({
    companyId,
    period: 'all',
    productId: undefined,
    clientId: undefined,
  }, {
    syncWithURL: true,
    persistInLocalStorage: true,
    storageKey: 'sales_filters'
  });

  // Saved views
  const { savedViews, saveView, loadView } = useSavedViews();

  // Real data
  const { salesData, clients, products, stats, isLoading, error } = useRealSalesData(
    filters.companyId as number | undefined,
    {
      startDate: filters.startDate as string | undefined,
      endDate: filters.endDate as string | undefined,
      productId: filters.productId as number | undefined,
      clientId: filters.clientId as number | undefined,
    }
  );

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
  ];

  // Sales pipeline funnel - Calculate from actual sales data
  const salesPipeline = useMemo(() => {
    if (!salesData || salesData.length === 0) return [];

    // Group sales by month to simulate pipeline stages
    // This is a simplified version - in production, you'd have actual pipeline stages
    const byMonth = salesData.reduce((acc, sale) => {
      const month = new Date(sale.date).getMonth();
      if (!acc[month]) acc[month] = 0;
      acc[month] += sale.amount;
      return acc;
    }, {} as Record<number, number>);

    const months = Object.entries(byMonth)
      .sort(([a], [b]) => Number(a) - Number(b))
      .slice(0, 5)
      .map(([month, amount], index) => {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const colors = ['#1B5E9E', '#0288D1', '#00ACC1', '#009688', '#2E7D32'];
        return {
          stage: monthNames[Number(month)],
          value: amount,
          color: colors[index % colors.length],
        };
      });

    return months.length > 0 ? months : [];
  }, [salesData]);

  // Sales target gauge
  const salesTarget = useMemo(() => {
    if (!stats) return null;

    const target = 50000000; // 50M target
    const current = stats.totalAmount;
    const max = target * 1.5;

    return {
      value: current,
      min: 0,
      max,
      target,
      zones: [
        { min: 0, max: target * 0.8, color: '#C62828' }, // Red
        { min: target * 0.8, max: target, color: '#F57C00' }, // Orange
        { min: target, max: max, color: '#2E7D32' }, // Green
      ],
    };
  }, [stats]);

  // Distribution by product
  const distributionByProduct = useMemo(() => {
    if (!stats?.byProduct) return [];

    return Object.entries(stats.byProduct)
      .slice(0, 6)
      .map(([productId, data], index) => {
        const product = products?.find(p => p.id === Number(productId));
        return {
          name: product?.name || `Producto ${productId}`,
          value: data.amount,
          color: `hsl(${(index * 360) / 6}, 70%, 50%)`,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [stats, products]);

  // Distribution by client
  const distributionByClient = useMemo(() => {
    if (!stats?.byClient) return [];

    return Object.entries(stats.byClient)
      .slice(0, 6)
      .map(([clientId, data], index) => {
        const client = clients?.find(c => c.id === Number(clientId));
        return {
          name: client?.name || `Cliente ${clientId}`,
          value: data.amount,
          color: `hsl(${(index * 360) / 6}, 70%, 50%)`,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [stats, clients]);

  // Sales process path stages
  const salesProcessStages = useMemo(() => {
    return [
      { id: 'lead', label: 'Lead', status: 'completed' as const },
      { id: 'qualification', label: 'Calificación', status: 'completed' as const },
      { id: 'proposal', label: 'Propuesta', status: 'current' as const },
      { id: 'negotiation', label: 'Negociación', status: 'upcoming' as const },
      { id: 'closed', label: 'Cerrado', status: 'upcoming' as const },
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
        resultCount={salesData.length}
      />

      {/* Sales Process Path */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <ChartCard
          title="Proceso de Venta"
          subtitle="Estado actual del proceso"
        >
          <Path
            stages={salesProcessStages}
            currentStage="proposal"
            variant="default"
          />
        </ChartCard>
      </motion.div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Target Gauge */}
        {salesTarget && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ChartCard
              title="Objetivo de Ventas"
              subtitle={`Actual: $${(salesTarget.value / 1000000).toFixed(1)}M | Objetivo: $${(salesTarget.target / 1000000).toFixed(1)}M`}
              onViewReport={() => {}}
            >
              {isLoading ? (
                <LoadingState variant="chart" />
              ) : error ? (
                <ErrorState variant="card" message="Error al cargar datos" />
              ) : (
                <GaugeChart
                  value={salesTarget.value}
                  min={salesTarget.min}
                  max={salesTarget.max}
                  zones={salesTarget.zones}
                  label="Ventas vs Objetivo"
                  unit=" USD"
                  formatValue={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  size="lg"
                  animated
                />
              )}
            </ChartCard>
          </motion.div>
        )}

        {/* Sales Pipeline Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ChartCard
            title="Pipeline de Ventas"
            subtitle="Ventas por etapa del proceso"
            onViewReport={() => {}}
          >
            {isLoading ? (
              <LoadingState variant="chart" />
            ) : error ? (
              <ErrorState variant="card" message="Error al cargar datos" />
            ) : salesPipeline.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Sin pipeline"
                description="No hay datos de pipeline disponibles"
                size="sm"
              />
            ) : (
              <FunnelChart
                data={salesPipeline}
                showPercentages
                formatValue={(value) => value.toLocaleString()}
              />
            )}
          </ChartCard>
        </motion.div>

        {/* Distribution by Product */}
        {distributionByProduct.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ChartCard
              title="Distribución por Producto"
              subtitle="Ventas por producto"
              onViewReport={() => {}}
            >
              <EnhancedDonutChart
                data={distributionByProduct}
                centerLabel="Total Ventas"
                centerValue={stats?.totalAmount || 0}
                showLegend
                legendPosition="right"
              />
            </ChartCard>
          </motion.div>
        )}

        {/* Distribution by Client */}
        {distributionByClient.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ChartCard
              title="Distribución por Cliente"
              subtitle="Ventas por cliente"
              onViewReport={() => {}}
            >
              <EnhancedDonutChart
                data={distributionByClient}
                centerLabel="Total Ventas"
                centerValue={stats?.totalAmount || 0}
                showLegend
                legendPosition="right"
              />
            </ChartCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}

