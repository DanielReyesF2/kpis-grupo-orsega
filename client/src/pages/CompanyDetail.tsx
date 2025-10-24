import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { FiltersBar } from '@/components/dashboard/FiltersBar';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { FilteredKpisModal } from '@/components/kpis/FilteredKpisModal';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateAndTime } from '@/lib/utils/dates';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building, 
  Calendar, 
  Folder, 
  ChevronDown, 
  ChevronUp, 
  BarChart3,
  Clock,
  ShoppingBag,
  Truck,
  DollarSign,
  FileText,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CompanyDetailProps {
  id: number;
}

// Orden de las áreas, mostrando Ventas primero
const AREA_ORDER = {
  "Ventas": 1,
  "Logística": 2,
  "Compras": 3,
  "Contabilidad y Finanzas": 4
};

export default function CompanyDetail({ id }: CompanyDetailProps) {
  // Función para obtener el período actual (mes actual)
  const getCurrentPeriod = () => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  // Inicializar los filtros para mostrar todos los KPIs por defecto
  const [filters, setFilters] = useState({
    status: undefined,
    period: 'all', // 'all' para mostrar todos los KPIs independientemente del período
  });
  
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  
  // Estado para el modal de KPIs filtrados
  const [isFilteredKpisModalOpen, setIsFilteredKpisModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'complies' | 'alert' | 'not_compliant' | 'all' | undefined>(undefined);
  
  // Estado para rastrear qué áreas están expandidas
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});

  // Fetch company with more robust error handling and manual fallback
  const { 
    data: company, 
    isLoading: isLoadingCompany, 
    error: companyError,
    refetch: refetchCompany
  } = useQuery({
    queryKey: [`/api/companies/${id}`],
    retry: 5, // Aumentar reintentos a 5 veces
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 30000, // Los datos son válidos por 30 segundos antes de re-fetching
    refetchOnWindowFocus: true, // Intentar obtener datos cuando la ventana recupere el foco
    refetchOnReconnect: true,   // Intentar obtener datos cuando la conexión se restablezca
  });
  
  // Logs para debug
  useEffect(() => {
    if (company) {
      console.log(`[CompanyDetail] Company data loaded:`, company);
    } else if (companyError) {
      console.error(`[CompanyDetail] Error fetching company ${id}:`, companyError);
    }
  }, [company, companyError, id]);

  // Fetch areas for this company
  const { data: areas, isLoading: isLoadingAreas } = useQuery({
    queryKey: ['/api/areas', { companyId: id }],
    enabled: !!company,
    retry: 3,
  });

  // Fetch all KPIs for this company
  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['/api/kpis', { companyId: id }],
    enabled: !!company,
    retry: 3,
  });

  const { data: kpiValues, isLoading: isLoadingKpiValues } = useQuery({
    queryKey: ['/api/kpi-values'],
    enabled: !!kpis && Array.isArray(kpis),
    retry: 3,
  });

  // Obtener los KPIs organizados por área
  const getKpisByArea = () => {
    if (!kpis || !kpiValues || !areas || 
        !Array.isArray(kpis) || !Array.isArray(kpiValues) || !Array.isArray(areas)) 
      return [];
    
    // Asegurarse de que solo estamos procesando áreas de esta empresa
    const companyAreas = areas.filter(area => area && area.companyId === id);
    
    // Asegurarse de que solo estamos procesando KPIs de esta empresa
    const companyKpis = kpis.filter(kpi => kpi && kpi.companyId === id);
    
    // Log para depuración
    console.log(`Empresa ${id}: Encontradas ${companyAreas.length} áreas y ${companyKpis.length} KPIs`);
    companyAreas.forEach((area: any) => {
      const areaKpis = companyKpis.filter((kpi: any) => kpi && kpi.areaId === area.id);
      console.log(`  - Área ${area.id} (${area.name}): ${areaKpis.length} KPIs`);
    });
    
    // 1. Agrupar KPIs por área
    const kpisByArea: Record<string, any[]> = {};
    const totalKpisByArea: Record<string, number> = {};
    
    // Inicializar solo las áreas de esta empresa
    companyAreas.forEach(area => {
      if (area) {
        kpisByArea[area.id] = [];
        totalKpisByArea[area.id] = 0;
      }
    });
    
    // Calcular el total de KPIs por área (sin filtros)
    // Primero, creamos un set para evitar contar el mismo KPI múltiples veces
    const kpiIdsPerArea: Record<string, Set<number>> = {};
    companyAreas.forEach(area => {
      if (area) {
        kpiIdsPerArea[area.id] = new Set();
      }
    });

    // Ahora agregamos cada KPI a su área correspondiente
    companyKpis.forEach((kpi: any) => {
      if (!kpi || !kpi.areaId) return;
      if (kpiIdsPerArea[kpi.areaId]) {
        kpiIdsPerArea[kpi.areaId].add(kpi.id);
      }
    });

    // Y finalmente contamos
    Object.keys(kpiIdsPerArea).forEach(areaId => {
      totalKpisByArea[areaId] = kpiIdsPerArea[areaId].size;
    });
    
    // Logs más detallados para debug
    console.log('Total de KPIs por área:', totalKpisByArea);
    
    // Imprimir todos los IDs de KPI por área para identificar duplicados
    Object.keys(kpiIdsPerArea).forEach(areaId => {
      console.log(`Área ${areaId} - KPIs:`, [...kpiIdsPerArea[areaId]]);
    });
    
    // Intenta identificar la causa de las diferencias entre lo esperado y lo real
    console.log('Número de KPIs en companyKpis:', companyKpis.length);
    console.log('KPIs para el área 1 (Ventas):', companyKpis.filter(kpi => kpi && kpi.areaId === 1).length);
    
    // Agregar KPIs a sus áreas respectivas (solo KPIs de esta empresa)
    companyKpis.forEach((kpi: any) => {
      if (!kpi) return;
      
      // Encontrar valores para este KPI
      const values = kpiValues.filter((value: any) => value && value.kpiId === kpi.id);
      
      // Filtrar por período si se especifica
      const filteredValues = filters.period && filters.period !== 'all'
        ? values.filter((value: any) => value && value.period === filters.period)
        : values;
      
      if (!filteredValues || filteredValues.length === 0) return;
      
      // Obtener el valor más reciente
      const latestValue = filteredValues.sort(
        (a: any, b: any) => {
          if (!a || !b || !a.date || !b.date) return 0;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
      )[0];
      
      if (!latestValue) return;
      
      // Filtrar por estado si se especifica
      if (filters.status && filters.status !== 'all' && latestValue.status !== filters.status) return;
      
      // Agregar KPI a su área
      if (kpi.areaId && kpisByArea[kpi.areaId]) {
        kpisByArea[kpi.areaId].push({
          id: kpi.id,
          name: kpi.name,
          status: latestValue.status,
          value: latestValue.value,
          target: kpi.target,
          unit: kpi.unit,
          areaId: kpi.areaId,
          companyId: kpi.companyId,
          period: latestValue.period,
          compliancePercentage: latestValue.compliancePercentage,
          comments: latestValue.comments,
          date: latestValue.date
        });
      }
    });
    
    // 2. Ordenar las áreas según el orden predefinido y obtener la información completa del área
    const areasWithKpis = companyAreas
      .filter(area => area && kpisByArea[area.id] && kpisByArea[area.id].length > 0)
      .map(area => ({
        id: area.id,
        name: area.name,
        description: area.description,
        companyId: area.companyId,
        kpis: kpisByArea[area.id],
        totalKpis: totalKpisByArea[area.id], // Total de KPIs sin filtros
        // Por defecto, expandir el área de Ventas
        isExpanded: expandedAreas[area.id] !== undefined ? expandedAreas[area.id] : area.name === "Ventas",
        order: AREA_ORDER[area.name as keyof typeof AREA_ORDER] || 999
      }))
      .sort((a, b) => a.order - b.order);
    
    return areasWithKpis;
  };

  const areaKpis = getKpisByArea();
  
  // Obtener todos los KPIs para las tarjetas de resumen
  const getAllFilteredKpis = () => {
    return areaKpis.flatMap(area => area.kpis);
  };
  
  const allFilteredKpis = getAllFilteredKpis();

  // Manejar cambio de filtros (ahora solo para status, manteniendo período en 'all')
  const handleFilterChange = (newFilters: any) => {
    // Solo cambiar status, manteniendo período en 'all' para mostrar todos los KPIs
    const updatedFilters = {
      ...newFilters,
      period: 'all'
    };
    
    setFilters(prev => ({
      ...prev,
      ...updatedFilters
    }));
  };

  // Manejar visualización de detalles del KPI
  const handleViewKpiDetails = (kpiId: number) => {
    setSelectedKpiId(kpiId);
    setIsKpiModalOpen(true);
  };

  // Manejar expansión/colapso de área
  const toggleAreaExpansion = (areaId: number) => {
    setExpandedAreas(prev => ({
      ...prev,
      [areaId]: !prev[areaId]
    }));
  };

  // Función para obtener el icono específico para cada área
  const getAreaIcon = (areaId: number) => {
    switch (areaId) {
      case 1: // Ventas
        return <ShoppingBag className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 2: // Logística
        return <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 3: // Contabilidad y Finanzas
        return <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      case 4: // Producción
        return <PackageCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 5: // Recursos Humanos
        return <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 6: // Marketing
        return <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />;
      default:
        return <Folder className="h-4 w-4 text-primary-600 dark:text-primary-400" />;
    }
  };

  // Función para obtener el color de fondo del icono según el área
  const getAreaIconColor = (areaId: number) => {
    switch (areaId) {
      case 1: // Ventas
        return 'bg-green-100 dark:bg-green-900/30';
      case 2: // Logística
        return 'bg-blue-100 dark:bg-blue-900/30';
      case 3: // Contabilidad y Finanzas
        return 'bg-purple-100 dark:bg-purple-900/30';
      case 4: // Producción
        return 'bg-amber-100 dark:bg-amber-900/30';
      case 5: // Recursos Humanos
        return 'bg-red-100 dark:bg-red-900/30';
      case 6: // Marketing
        return 'bg-cyan-100 dark:bg-cyan-900/30';
      default:
        return 'bg-primary-100 dark:bg-primary-900/30';
    }
  };

  // Obtener la fecha de última actualización con hora
  const getLastUpdatedDate = () => {
    if (!kpiValues || !Array.isArray(kpiValues) || kpiValues.length === 0) return 'N/A';
    
    const dates = kpiValues
      .filter((value: any) => value && value.date)
      .map((value: any) => new Date(value.date));
    
    if (dates.length === 0) return 'N/A';
    
    const latestDate = new Date(Math.max(...dates.map(date => date.getTime())));
    
    return formatDateAndTime(latestDate);
  };

  if (isLoadingCompany) {
    return (
      <AppLayout title="Cargando...">
        <Skeleton className="h-64 w-full" />
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout title="Error">
        <div className="text-center py-8 flex flex-col items-center gap-4">
          <div className="text-secondary-500">
            No se encontró la empresa solicitada. 
            {companyError && (
              <div className="mt-2 text-sm text-red-500">
                Error: {companyError instanceof Error ? companyError.message : 'Error desconocido'}
              </div>
            )}
          </div>
          <Button 
            onClick={() => refetchCompany()} 
            className="mx-auto"
          >
            Reintentar
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`KPIs - ${company.name}`}>
      {/* Barra de filtros */}
      <FiltersBar onFilterChange={handleFilterChange} />
      
      {/* Cabecera con información de la empresa */}
      <div className="flex items-center justify-between mb-6 bg-white dark:bg-card p-4 rounded-lg border border-primary-100 shadow-sm">
        <div className="flex items-center">
          <div className="h-10 w-10 bg-primary-100 dark:bg-primary-900/30 rounded-md flex items-center justify-center">
            <Building className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="ml-3">
            <h2 className="text-xl font-bold">{company.name}</h2>
            <div className="flex items-center text-secondary-600 dark:text-secondary-400 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <span>Última actualización: {getLastUpdatedDate()}</span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="ml-2">
          {company.sector || 'Empresa'}
        </Badge>
      </div>
      
      {/* Tarjetas de resumen */}
      {isLoadingKpis || isLoadingKpiValues ? (
        <Skeleton className="h-32 w-full mb-6" />
      ) : (
        <div className="mb-6">
          <SummaryCards 
            kpis={allFilteredKpis.map(kpi => ({ 
              id: kpi.id, 
              name: kpi.name, 
              status: kpi.status 
            }))} 
            lastUpdated={getLastUpdatedDate()}
            onStatusFilterClick={(status) => {
              // Establecer el estado seleccionado y abrir el modal
              setSelectedStatus(status);
              setIsFilteredKpisModalOpen(true);
              
              // También actualizar los filtros para que la interfaz refleje la selección
              handleFilterChange({ status });
            }}
          />
        </div>
      )}
      
      {/* Instrucciones simplificadas */}
      <div className="mb-6 p-3 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 rounded-lg">
        <div className="flex items-center text-primary-700 dark:text-primary-400 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <h3 className="font-medium">Instrucciones</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-secondary-700 dark:text-secondary-300">
          <p><strong>1.</strong> Haga clic en cualquier KPI para ver/editar detalles</p>
          <p><strong>2.</strong> Use "Agregar nuevo valor" para actualizar KPIs</p>
          <p><strong>3.</strong> Complete valor, cumplimiento y comentarios</p>
          <p><strong>4.</strong> Los filtros permiten ver KPIs por período o estado</p>
        </div>
      </div>
      
      {/* Secciones de KPIs por área */}
      <div className="space-y-4 mb-6">
        {isLoadingAreas || isLoadingKpis || isLoadingKpiValues ? (
          <>
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : areaKpis.length > 0 ? (
          <div className="space-y-3">
            {areaKpis.map((area) => {
              const isExpanded = expandedAreas[area.id] !== undefined 
                ? expandedAreas[area.id] 
                : area.name === "Ventas";
                
              return (
                <div key={area.id} className="rounded-lg overflow-hidden shadow-sm">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleAreaExpansion(area.id)}>
                    <CollapsibleTrigger asChild>
                      <div className={`p-2.5 cursor-pointer transition-colors ${isExpanded ? 'bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100' : 'bg-white dark:bg-card hover:bg-secondary-50 dark:hover:bg-secondary-900/10'} rounded-t-lg`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`h-8 w-8 rounded-md flex items-center justify-center mr-2.5 ${getAreaIconColor(area.id)}`}>
                              {getAreaIcon(area.id)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">{area.name}</h3>
                              {area.description && (
                                <p className="text-xs text-secondary-500 dark:text-secondary-400 line-clamp-1">{area.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={isExpanded ? "secondary" : "outline"} className="text-xs bg-opacity-50">
                              {area.totalKpis || 0} KPIs
                            </Badge>
                            {area.totalKpis !== area.kpis.length && (
                              <Badge variant="outline" className="text-xs text-primary-600 border-primary-200">
                                {area.kpis.length} mostrados
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm" className="p-0.5 h-6 w-6 ml-1">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3 pt-1 bg-white dark:bg-card border border-t-0 border-secondary-100 rounded-b-lg">
                        <div className="max-h-[600px] overflow-y-auto pr-2">
                          <div className="space-y-2">
                            {area.kpis.map((kpi) => (
                              <div 
                                key={kpi.id} 
                                className="border border-secondary-100 hover:border-primary-200 cursor-pointer transition-colors p-3 rounded-lg bg-white dark:bg-card"
                                onClick={() => handleViewKpiDetails(kpi.id)}
                              >
                                <div className="flex items-start">
                                  <div className="h-7 w-7 bg-secondary-50 rounded-full flex items-center justify-center mr-2.5 mt-0.5">
                                    <BarChart3 className="h-3.5 w-3.5 text-primary-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <h3 className="font-medium text-sm truncate pr-2">{kpi.name}</h3>
                                      <Badge 
                                        className={`text-xs py-0 h-5 ${
                                          kpi.status === 'complies' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' :
                                          kpi.status === 'alert' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                          'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                                        }`}
                                      >
                                        {kpi.status === 'complies' ? 'Cumple' : 
                                        kpi.status === 'alert' ? 'Alerta' : 'No Cumple'}
                                      </Badge>
                                    </div>
                                    
                                    <div className="mt-2 grid grid-cols-3 gap-1">
                                      <div>
                                        <p className="text-xs text-secondary-500 dark:text-secondary-400">Actual</p>
                                        <p className="font-medium text-sm">{kpi.value}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-secondary-500 dark:text-secondary-400">Objetivo</p>
                                        <p className="font-medium text-sm">{kpi.target}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-secondary-500 dark:text-secondary-400">Cumplimiento</p>
                                        <p className={`font-medium text-sm ${
                                          kpi.status === 'complies' ? 'text-green-600 dark:text-green-400' :
                                          kpi.status === 'alert' ? 'text-yellow-600 dark:text-yellow-400' :
                                          'text-red-600 dark:text-red-400'
                                        }`}>
                                          {kpi.compliancePercentage || '—'}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {kpi.date && (
                                      <div className="mt-1.5 flex items-center">
                                        <Clock className="h-3 w-3 text-secondary-500 dark:text-secondary-400 mr-1" />
                                        <p className="text-xs text-secondary-500 dark:text-secondary-400">
                                          {formatDateAndTime(new Date(kpi.date))}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {kpi.comments && (
                                      <div className="mt-1.5 text-xs text-secondary-500 dark:text-secondary-400 p-1.5 bg-secondary-50 dark:bg-secondary-900/20 rounded-md line-clamp-2">
                                        {kpi.comments}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-secondary-500 bg-white dark:bg-background rounded-md border border-secondary-100">
            No se encontraron KPIs para los filtros seleccionados.
          </div>
        )}
      </div>
      
      {/* Ventana de detalles del KPI */}
      <KpiDetailDialog
        kpiId={selectedKpiId}
        isOpen={isKpiModalOpen}
        onClose={() => setIsKpiModalOpen(false)}
      />
      
      {/* Filtered KPIs Modal */}
      <FilteredKpisModal
        isOpen={isFilteredKpisModalOpen}
        onClose={() => setIsFilteredKpisModalOpen(false)}
        status={selectedStatus}
        kpis={allFilteredKpis}
        onViewKpiDetails={handleViewKpiDetails}
      />
    </AppLayout>
  );
}