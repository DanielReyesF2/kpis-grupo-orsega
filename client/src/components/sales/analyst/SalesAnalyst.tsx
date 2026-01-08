/**
 * Componente principal del Analista de Ventas
 * Container que orquesta todas las secciones de análisis
 */

import { Brain, Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { useFilters } from "@/hooks/useFilters";
import { useQueryClient } from "@tanstack/react-query";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

// Sections
import { ExecutiveSummary } from "./sections/ExecutiveSummary";
import { ClientFocusSection } from "./sections/ClientFocusSection";
import { ProductOpportunitiesSection } from "./sections/ProductOpportunitiesSection";
import { StrategicInsightsSection } from "./sections/StrategicInsightsSection";
import { ActionItemsSection } from "./sections/ActionItemsSection";

interface SalesAnalystProps {
  companyId: number;
  embedded?: boolean; // Si es true, no muestra el header grande (para uso en modal)
}

export function SalesAnalyst({ companyId, embedded = false }: SalesAnalystProps) {
  const queryClient = useQueryClient();
  
  console.log('[SalesAnalyst] Componente renderizado con companyId:', companyId);
  
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
  
  console.log('[SalesAnalyst] Estado del query:', { isLoading, hasError: !!error, hasData: !!insights });

  // Filter options
  const quickFilters = [
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
  ];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/sales-analyst/insights', companyId] });
    refetch();
  };

  const handleExport = () => {
    // TODO: Implementar exportación a PDF/Excel
    // Por ahora, solo muestra un mensaje al usuario
    alert('Funcionalidad de exportación próximamente disponible');
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

  // Modo embedded (para modal) - diseño minimalista
  const wrapperClass = embedded 
    ? "space-y-5" 
    : "min-h-screen bg-slate-50 dark:bg-slate-900";
  
  const containerClass = embedded
    ? "space-y-5"
    : "container mx-auto px-4 py-6 space-y-5";

  if (isLoading) {
    return (
      <div className={wrapperClass}>
        <div className={containerClass}>
          {!embedded && <AnalystHeader />}
          <LoadingState variant="page" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={wrapperClass}>
        <div className={containerClass}>
          {!embedded && <AnalystHeader />}
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
      <div className={wrapperClass}>
        <div className={containerClass}>
          {!embedded && <AnalystHeader />}
          <ErrorState
            variant="page"
            message="No se encontraron datos para el análisis"
          />
        </div>
      </div>
    );
  }

  // Type assertion to help TypeScript after null checks
  const typedInsights = insights as unknown as SalesAnalystInsights;

  return (
    <div className={wrapperClass}>
      {/* Wrapper con padding y fondo distintivo */}
      <div className={containerClass}>
        {/* Page Header - Diseño distintivo para Analista (solo si no está embedded) */}
        {!embedded && <AnalystHeader />}

        {/* Filtros minimalistas */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <select
              value={typeof filters.period === 'string' ? filters.period : 'year'}
              onChange={(e) => updateFilters({ ...filters, period: e.target.value })}
              className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="year">2024-2025</option>
              <option value="quarter">Último trimestre</option>
              <option value="month">Último mes</option>
            </select>
            <select
              value={typeof filters.priority === 'string' ? filters.priority : 'all'}
              onChange={(e) => updateFilters({ ...filters, priority: e.target.value === 'all' ? undefined : e.target.value as any })}
              className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="all">Todas las prioridades</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
            </select>
          </div>
          <span className="text-sm text-slate-500">
            {typedInsights.focusClients.critical.length + typedInsights.focusClients.warning.length + typedInsights.focusClients.opportunities.length} clientes · {typedInsights.inactiveClients.length} inactivos
          </span>
        </div>

        {/* AI Insights Banner - Minimalista */}
        {typedInsights.statisticalContext?.aiInsights && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded">
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Resumen Ejecutivo</h3>
                  <span className="text-xs px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">EconovaAI</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {typedInsights.statisticalContext.aiInsights}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Executive Summary */}
        <ExecutiveSummary insights={typedInsights} companyId={companyId} />

        {/* Focus Areas - Grid de 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClientFocusSection insights={typedInsights} companyId={companyId} />
          <ProductOpportunitiesSection insights={typedInsights} />
        </div>

        {/* Strategic Insights and Action Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StrategicInsightsSection insights={typedInsights} companyId={companyId} />
          <ActionItemsSection insights={typedInsights} />
        </div>
      </div>
    </div>
  );
}

