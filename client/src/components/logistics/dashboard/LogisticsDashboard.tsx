import { useMemo } from "react";
import { motion } from "framer-motion";
import { Truck, Package, Clock, MapPin } from "lucide-react";

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
import { useFilters } from "@/hooks/useFilters";
import { useSavedViews } from "@/hooks/useSavedViews";
import { useQuery } from "@tanstack/react-query";

interface LogisticsDashboardProps {
  companyId?: number;
}

export function LogisticsDashboard({ companyId }: LogisticsDashboardProps) {
  // Filters
  const { filters, updateFilters } = useFilters({
    companyId,
    status: 'all',
    providerId: undefined,
  }, {
    syncWithURL: true,
    persistInLocalStorage: true,
    storageKey: 'logistics_filters'
  });

  // Saved views
  const { savedViews, saveView, loadView } = useSavedViews();

  // Fetch shipments
  const { data: shipments = [], isLoading: isLoadingShipments, error: shipmentsError } = useQuery<any[]>({
    queryKey: ['/api/shipments', { companyId: filters.companyId }],
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Fetch providers
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery<any[]>({
    queryKey: ['/api/logistics/providers'],
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = isLoadingShipments || isLoadingProviders;
  const error = shipmentsError;

  // Filter options
  const quickFilters = [
    {
      key: 'status',
      label: 'Estado',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'pending', label: 'Pendiente' },
        { value: 'in_transit', label: 'En Tránsito' },
        { value: 'delivered', label: 'Entregado' },
        { value: 'cancelled', label: 'Cancelado' },
      ],
    },
    {
      key: 'providerId',
      label: 'Proveedor',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        ...(providers.map(p => ({ value: String(p.id), label: p.name }))),
      ],
    },
  ];

  // Calculate statistics
  const stats = useMemo(() => {
    if (!shipments || shipments.length === 0) return null;

    const byStatus = shipments.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byProvider = shipments.reduce((acc, s) => {
      const providerId = s.providerId || 'unknown';
      acc[providerId] = (acc[providerId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate on-time delivery rate
    const delivered = shipments.filter(s => s.status === 'delivered');
    const onTime = delivered.filter(s => {
      if (!s.deliveredAt || !s.estimatedDelivery) return false;
      return new Date(s.deliveredAt) <= new Date(s.estimatedDelivery);
    });
    const onTimeRate = delivered.length > 0 ? (onTime.length / delivered.length) * 100 : 0;

    return {
      total: shipments.length,
      byStatus,
      byProvider,
      onTimeRate,
      delivered: delivered.length,
      inTransit: shipments.filter(s => s.status === 'in_transit').length,
      pending: shipments.filter(s => s.status === 'pending').length,
    };
  }, [shipments]);

  // On-time delivery gauge
  const onTimeGauge = useMemo(() => {
    if (!stats) return null;

    return {
      value: stats.onTimeRate,
      min: 0,
      max: 100,
      zones: [
        { min: 0, max: 80, color: '#C62828' }, // Red: < 80%
        { min: 80, max: 95, color: '#F57C00' }, // Orange: 80-95%
        { min: 95, max: 100, color: '#2E7D32' }, // Green: > 95%
      ],
    };
  }, [stats]);

  // Shipments by status funnel
  const shipmentsByStatus = useMemo(() => {
    if (!stats?.byStatus) return [];

    const statusLabels: Record<string, string> = {
      pending: 'Pendiente',
      in_transit: 'En Tránsito',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
    };

    const statusColors: Record<string, string> = {
      pending: '#F57C00',
      in_transit: '#0288D1',
      delivered: '#2E7D32',
      cancelled: '#C62828',
    };

    return Object.entries(stats.byStatus)
      .map(([status, count]) => ({
        stage: statusLabels[status] || status,
        value: count as number,
        color: statusColors[status] || '#666666',
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  // Distribution by provider
  const distributionByProvider = useMemo(() => {
    if (!stats?.byProvider || !providers) return [];

    return Object.entries(stats.byProvider)
      .slice(0, 6)
      .map(([providerId, count], index) => {
        const provider = providers.find(p => String(p.id) === providerId);
        return {
          name: provider?.name || `Proveedor ${providerId}`,
          value: count as number,
          color: `hsl(${(index * 360) / 6}, 70%, 50%)`,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [stats, providers]);

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
        objectIcon={Truck}
        title="Dashboard de Logística"
        subtitle="Vista general de envíos, proveedores y métricas de entrega"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Logística', href: '/logistics' },
          { label: 'Dashboard' },
        ]}
        actions={[
          {
            label: 'Nuevo Envío',
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
        resultCount={shipments.length}
      />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* On-Time Delivery Gauge */}
        {onTimeGauge && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ChartCard
              title="Tasa de Entrega a Tiempo"
              subtitle={`${stats?.delivered || 0} entregas completadas`}
              onViewReport={() => {}}
            >
              {isLoading ? (
                <LoadingState variant="chart" />
              ) : error ? (
                <ErrorState variant="card" message="Error al cargar datos" />
              ) : (
                <GaugeChart
                  value={onTimeGauge.value}
                  min={onTimeGauge.min}
                  max={onTimeGauge.max}
                  zones={onTimeGauge.zones}
                  label="Tasa de Entrega a Tiempo"
                  unit="%"
                  formatValue={(value) => `${value.toFixed(1)}%`}
                  size="lg"
                  animated
                />
              )}
            </ChartCard>
          </motion.div>
        )}

        {/* Shipments by Status Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ChartCard
            title="Envíos por Estado"
            subtitle="Distribución de envíos por estado"
            onViewReport={() => {}}
          >
            {isLoading ? (
              <LoadingState variant="chart" />
            ) : error ? (
              <ErrorState variant="card" message="Error al cargar datos" />
            ) : shipmentsByStatus.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Sin envíos"
                description="No hay envíos para mostrar"
                size="sm"
              />
            ) : (
              <FunnelChart
                data={shipmentsByStatus}
                showPercentages
                formatValue={(value) => value.toLocaleString()}
              />
            )}
          </ChartCard>
        </motion.div>

        {/* Distribution by Provider Donut */}
        {distributionByProvider.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ChartCard
              title="Distribución por Proveedor"
              subtitle="Envíos por proveedor de logística"
              onViewReport={() => {}}
            >
              <EnhancedDonutChart
                data={distributionByProvider}
                centerLabel="Total Envíos"
                centerValue={stats?.total || 0}
                showLegend
                legendPosition="right"
              />
            </ChartCard>
          </motion.div>
        )}

        {/* Capacity Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ChartCard
            title="Capacidad de Envíos"
            subtitle={`${stats?.inTransit || 0} en tránsito de ${stats?.total || 0} total`}
            onViewReport={() => {}}
          >
            {isLoading ? (
              <LoadingState variant="chart" />
            ) : stats ? (
              <GaugeChart
                value={(stats.inTransit / Math.max(stats.total, 1)) * 100}
                min={0}
                max={100}
                zones={[
                  { min: 0, max: 50, color: '#2E7D32' }, // Green: < 50%
                  { min: 50, max: 80, color: '#F57C00' }, // Orange: 50-80%
                  { min: 80, max: 100, color: '#C62828' }, // Red: > 80%
                ]}
                label="Capacidad Utilizada"
                unit="%"
                formatValue={(value) => `${value.toFixed(1)}%`}
                size="md"
                animated
              />
            ) : (
              <EmptyState
                icon={Truck}
                title="Sin datos"
                description="No hay datos de capacidad disponibles"
                size="sm"
              />
            )}
          </ChartCard>
        </motion.div>
      </div>
    </div>
  );
}

