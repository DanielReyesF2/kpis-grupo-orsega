/**
 * Componente principal del Analista de Ventas
 * Container que orquesta todas las secciones de análisis
 */

import { useMemo } from "react";
import { Brain, Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Header component reutilizable
  const AnalystHeader = () => (
    <div className="space-y-4 pb-4 border-b border-primary/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0 p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold text-foreground" id="page-title">
                Analista de Ventas
              </h1>
              <span className="px-2 py-1 text-xs font-semibold bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 dark:from-purple-900/50 dark:to-indigo-900/50 dark:text-purple-300 rounded-md border border-purple-200 dark:border-purple-800">
                <Sparkles className="h-3 w-3 inline mr-1" />
                IA
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Análisis estratégico inteligente y recomendaciones accionables para el jefe de ventas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            onClick={handleRefresh}
            variant="default"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AnalystHeader />
        <LoadingState variant="page" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AnalystHeader />
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
        <AnalystHeader />
        <ErrorState
          variant="page"
          message="No se encontraron datos para el análisis"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header - Diseño distintivo para Analista */}
      <AnalystHeader />

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

