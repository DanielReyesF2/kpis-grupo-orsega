/**
 * Componente principal del Analista de Ventas
 * Container que orquesta todas las secciones de análisis
 */

import { useMemo } from "react";
import { Brain, Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Header component reutilizable - Diseño completamente distintivo
  const AnalystHeader = () => (
    <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-xl shadow-xl p-6 text-white">
      {/* Patrón de fondo decorativo */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
      </div>
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Icono grande con efecto glow */}
          <div className="flex-shrink-0 p-4 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg border border-white/30">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold text-white" id="page-title">
                Analista de Ventas
              </h1>
              <span className="px-3 py-1.5 text-xs font-bold bg-white/20 backdrop-blur-sm text-white rounded-full border border-white/30 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Análisis con IA
              </span>
            </div>
            <p className="text-purple-100 text-base leading-relaxed">
              Análisis estratégico inteligente y recomendaciones accionables para optimizar las ventas
            </p>
            {/* Breadcrumbs minimalistas */}
            <div className="flex items-center gap-2 mt-3 text-sm text-purple-100">
              <span>Inicio</span>
              <span>/</span>
              <span>Ventas</span>
              <span>/</span>
              <span className="text-white font-medium">Analista</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 border-white/30 text-white backdrop-blur-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            onClick={handleRefresh}
            size="sm"
            className="bg-white text-purple-600 hover:bg-purple-50 font-semibold shadow-lg"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50/30 to-blue-50 dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <AnalystHeader />
          <LoadingState variant="page" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50/30 to-blue-50 dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <AnalystHeader />
          <ErrorState
            variant="page"
            message={error instanceof Error ? error.message : 'Error al cargar datos del analista'}
            onRetry={handleRefresh}
          />
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50/30 to-blue-50 dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <AnalystHeader />
          <ErrorState
            variant="page"
            message="No se encontraron datos para el análisis"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50/30 to-blue-50 dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-blue-950/20">
      {/* Wrapper con padding y fondo distintivo */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Page Header - Diseño distintivo para Analista */}
        <AnalystHeader />

        {/* Filtros simplificados - No usar FilterBar de Salesforce */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg border border-purple-200/50 dark:border-purple-800/30 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</label>
              <select
                value={filters.period as string || 'year'}
                onChange={(e) => updateFilters({ ...filters, period: e.target.value })}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="year">Año actual</option>
                <option value="quarter">Trimestre actual</option>
                <option value="month">Mes actual</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Prioridad:</label>
              <select
                value={filters.priority as string || 'all'}
                onChange={(e) => updateFilters({ ...filters, priority: e.target.value })}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Todas</option>
                <option value="critical">Crítica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
              {insights.focusClients.critical.length + insights.focusClients.warning.length + insights.focusClients.opportunities.length} clientes analizados
            </div>
          </div>
        </div>

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
    </div>
  );
}

