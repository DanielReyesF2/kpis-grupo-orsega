/**
 * Componente principal del Analista de Ventas
 * Container que orquesta todas las secciones de análisis
 */

import { useMemo } from "react";
import { TrendingUp, Download, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { FilterBar } from "@/components/salesforce/layout/FilterBar";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { useFilters } from "@/hooks/useFilters";
import { useQueryClient } from "@tanstack/react-query";

// Sections
import { ExecutiveSummary } from "./sections/ExecutiveSummary";
import { ClientFocusSection } from "./sections/ClientFocusSection";
import { ProductOpportunitiesSection } from "./sections/ProductOpportunitiesSection";
import { StrategicInsightsSection } from "./sections/StrategicInsightsSection";
import { ActionItemsSection } from "./sections/ActionItemsSection";

interface SalesAnalystProps {
  companyId: number;
}

export function SalesAnalyst({ companyId }: SalesAnalystProps) {
  const queryClient = useQueryClient();
  
  // Filters
  const { filters, updateFilters } = useFilters({
    companyId,
    period: 'year',
    priority: undefined,
  }, {
    syncWithURL: true,
    persistInLocalStorage: true,
    storageKey: 'sales_analyst_filters'
  });

  // Data fetching
  const { data: insights, isLoading, error, refetch } = useSalesAnalyst(companyId);

  // Filter options
  const quickFilters = useMemo(() => [
    {
      key: 'period',
      label: 'Período',
      type: 'select' as const,
      options: [
        { value: 'year', label: 'Año actual' },
        { value: 'quarter', label: 'Trimestre actual' },
        { value: 'month', label: 'Mes actual' },
      ],
    },
    {
      key: 'priority',
      label: 'Prioridad',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todas' },
        { value: 'critical', label: 'Crítica' },
        { value: 'high', label: 'Alta' },
        { value: 'medium', label: 'Media' },
        { value: 'low', label: 'Baja' },
      ],
    },
  ], []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/sales-analyst/insights', companyId] });
    refetch();
  };

  const handleExport = () => {
    // TODO: Implementar exportación a PDF/Excel
    console.log('Exportar reporte', insights);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          objectIcon={TrendingUp}
          title="Analista de Ventas"
          subtitle="Análisis estratégico y recomendaciones para el jefe de ventas"
          breadcrumbs={[
            { label: 'Inicio', href: '/' },
            { label: 'Ventas', href: '/sales' },
            { label: 'Analista' }
          ]}
        />
        <LoadingState variant="page" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          objectIcon={TrendingUp}
          title="Analista de Ventas"
          subtitle="Análisis estratégico y recomendaciones para el jefe de ventas"
          breadcrumbs={[
            { label: 'Inicio', href: '/' },
            { label: 'Ventas', href: '/sales' },
            { label: 'Analista' }
          ]}
        />
        <ErrorState
          variant="page"
          message={error instanceof Error ? error.message : 'Error al cargar datos del analista'}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="space-y-6">
        <PageHeader
          objectIcon={TrendingUp}
          title="Analista de Ventas"
          subtitle="Análisis estratégico y recomendaciones para el jefe de ventas"
          breadcrumbs={[
            { label: 'Inicio', href: '/' },
            { label: 'Ventas', href: '/sales' },
            { label: 'Analista' }
          ]}
        />
        <ErrorState
          variant="page"
          message="No se encontraron datos para el análisis"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        objectIcon={TrendingUp}
        title="Analista de Ventas"
        subtitle="Análisis estratégico y recomendaciones para el jefe de ventas"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas', href: '/sales' },
          { label: 'Analista' }
        ]}
        actions={[
          {
            label: 'Exportar Reporte',
            onClick: handleExport,
            icon: Download,
            variant: 'outline'
          },
          {
            label: 'Actualizar',
            onClick: handleRefresh,
            icon: RefreshCw,
            variant: 'default',
            primary: true
          }
        ]}
      />

      {/* Filter Bar */}
      <FilterBar
        quickFilters={quickFilters}
        filters={filters}
        onFiltersChange={updateFilters}
        resultCount={insights.focusClients.critical.length + insights.focusClients.warning.length + insights.focusClients.opportunities.length}
      />

      {/* Executive Summary */}
      <ExecutiveSummary insights={insights} companyId={companyId} />

      {/* Focus Areas - Grid de 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientFocusSection insights={insights} companyId={companyId} />
        <ProductOpportunitiesSection insights={insights} />
      </div>

      {/* Strategic Insights and Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StrategicInsightsSection insights={insights} companyId={companyId} />
        <ActionItemsSection insights={insights} />
      </div>
    </div>
  );
}

