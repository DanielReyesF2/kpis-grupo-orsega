import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Building } from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';
import { KpiCard } from './KpiCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { KpiStatus } from '@/lib/utils/kpi-status';
import { KpiDetailDialog } from '../kpis/KpiDetailDialog';
import type { Company, Area } from '@shared/schema';

interface CompanySectionProps {
  companyId: number;
  isOpen?: boolean;
  onViewKpiDetails: (kpiId: number) => void;
  filters: {
    period?: string;
    status?: string;
  };
}

export function CompanySection({ 
  companyId, 
  isOpen = true, 
  onViewKpiDetails,
  filters
}: CompanySectionProps) {
  const [expanded, setExpanded] = useState(isOpen);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

  // Fetch company
  const { data: company, isLoading: isLoadingCompany } = useQuery<Company>({
    queryKey: [`/api/companies/${companyId}`],
  });

  // Fetch areas for this company
  const { data: areas, isLoading: isLoadingAreas } = useQuery<Area[]>({
    queryKey: [`/api/areas`, { companyId }],
    enabled: !!company,
  });

  // Fetch KPIs for this company
  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: [
      '/api/kpis', 
      { 
        companyId
      }
    ],
    enabled: !!company && expanded,
  });

  // Fetch KPI values for the KPIs
  const { data: kpiValues, isLoading: isLoadingKpiValues } = useQuery({
    queryKey: ['/api/kpi-values', { companyId }],
    enabled: !!kpis && expanded,
  });
  
  // Filtrar áreas que tienen KPIs asociados y ordenarlas correctamente: Ventas, Logística, Contabilidad y Finanzas
  const areasWithKpis = useMemo(() => {
    if (!kpis || !areas || !Array.isArray(kpis) || !Array.isArray(areas)) return [];
    
    // Filtrar áreas que tienen KPIs asociados de esta empresa, excluyendo "Satisfacción interdepartamental"
    const filteredKpis = kpis.filter(kpi => kpi.id !== 19 && kpi.id !== 20);
    
    const filteredAreas = areas.filter(area => 
      area.companyId === companyId && // Solo áreas de esta empresa
      filteredKpis.some(kpi => kpi.areaId === area.id)
    );

    // Definir el orden correcto de áreas
    const areaOrder = {
      "Ventas": 1,
      "Logística": 2,
      "Contabilidad y Finanzas": 3
    };

    // Ordenar las áreas según el orden especificado
    return filteredAreas.sort((a: Area, b: Area) => {
      const orderA = areaOrder[a.name as keyof typeof areaOrder] || 999;
      const orderB = areaOrder[b.name as keyof typeof areaOrder] || 999;
      return orderA - orderB;
    });
  }, [kpis, areas, companyId]);
  
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Obtener los KPIs filtrados por área seleccionada y otros filtros
  const filteredKpis = useMemo(() => {
    if (!kpis || !kpiValues || !Array.isArray(kpis) || !Array.isArray(kpiValues)) 
      return [];
    
    // Filtrar por área seleccionada y excluir KPIs de "Satisfacción interdepartamental" (IDs 19 y 20)
    const kpisForCurrentArea = selectedAreaId 
      ? kpis.filter(kpi => kpi.areaId === selectedAreaId && kpi.id !== 19 && kpi.id !== 20)
      : kpis.filter(kpi => kpi.id !== 19 && kpi.id !== 20);
    
    if (kpisForCurrentArea.length === 0) return [];
    
    const processedKpis = kpisForCurrentArea.map(kpi => {
      // Encontrar los valores para este KPI que coincidan con el filtro de período
      const values = kpiValues.filter(
        v => v.kpiId === kpi.id && 
        (!filters.period || filters.period === 'all' || v.period === filters.period)
      );
      
      if (!values || values.length === 0) return null;
      
      // Ordenar todos los valores por fecha, más reciente primero
      const sortedValues = values.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
      
      // Usar el valor más reciente
      const latestValue = sortedValues[0];
      
      // Aplicar filtro de estado si existe
      if (filters.status && filters.status !== 'all' && latestValue.status !== filters.status) 
        return null;
      
      // Obtener el nombre del área para este KPI
      const area = areas && Array.isArray(areas) ? 
        areas.find(a => a.id === kpi.areaId) : null;
      
      return {
        ...kpi,
        value: latestValue.value,
        period: latestValue.period,
        status: latestValue.status as KpiStatus,
        compliancePercentage: latestValue.compliancePercentage || 
                             (latestValue.status === 'complies' ? '100%' : 
                              latestValue.status === 'alert' ? '85%' : '70%'),
        areaName: area ? area.name : 'Área sin especificar',
        comments: latestValue.comments || '',
        unit: kpi.unit || '',
        frequency: kpi.frequency || 'monthly',
        responsible: kpi.responsible || 'Sin asignar',
        date: latestValue.date || new Date()
      };
    }).filter(Boolean);
    
    // Ordenar KPIs por estado (primero los no conformes, luego alerta, luego conformes)
    return processedKpis.sort((a: any, b: any) => {
      const statusPriority: Record<string, number> = {
        'not_compliant': 0,
        'alert': 1,
        'complies': 2
      };
      
      const aPriority = a.status in statusPriority ? statusPriority[a.status] : 3;
      const bPriority = b.status in statusPriority ? statusPriority[b.status] : 3;
      
      return aPriority - bPriority;
    });
  }, [kpis, kpiValues, areas, selectedAreaId, filters.period, filters.status]);

  if (isLoadingCompany) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!company) {
    return <div>Empresa no encontrada</div>;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className={`p-4 ${expanded ? 'bg-primary-50 border-b border-primary-100' : 'bg-secondary-50 border-b border-secondary-200'} flex justify-between items-center`}>
        <div className="flex items-center">
          <div className="h-10 w-10 bg-primary-100 rounded-md flex items-center justify-center">
            <Building className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="ml-3 text-lg font-medium text-secondary-800">{company.name}</h2>
          <Badge variant="outline" className="ml-3 bg-primary-100 text-primary-800 border-0">
            {company.sector}
          </Badge>
        </div>
        <div className="flex items-center text-sm text-secondary-500">
          <span className="mr-2 hidden sm:inline-block">Última actualización:</span>
          <span>{formatDate(new Date())}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-2 text-secondary-500 hover:text-secondary-700"
            onClick={toggleExpanded}
          >
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <>
          {/* Área Tabs - Solo mostrar si hay áreas con KPIs */}
          {areasWithKpis.length > 0 && (
            <div className="border-b border-secondary-200">
              <div className="px-4 flex overflow-x-auto hide-scrollbar">
                {isLoadingAreas || isLoadingKpis ? (
                  Array(3).fill(0).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-32 mx-1" />
                  ))
                ) : (
                  areasWithKpis.map(area => (
                    <Button
                      key={area.id}
                      variant={selectedAreaId === area.id ? "default" : "ghost"}
                      className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium whitespace-nowrap"
                      onClick={() => setSelectedAreaId(area.id === selectedAreaId ? null : area.id)}
                    >
                      {area.name}
                    </Button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <CardContent className="p-4">
            {isLoadingKpis || isLoadingKpiValues ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(6).fill(0).map((_, index) => (
                  <Skeleton key={index} className="h-52 w-full" />
                ))}
              </div>
            ) : filteredKpis.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredKpis.map((kpi: any) => (
                  <KpiCard
                    key={kpi.id}
                    id={kpi.id}
                    name={kpi.name}
                    target={kpi.target}
                    currentValue={kpi.value}
                    status={kpi.status}
                    frequency={kpi.frequency}
                    responsible={kpi.responsible}
                    unit={kpi.unit}
                    compliancePercentage={kpi.compliancePercentage}
                    lastUpdated={kpi.date}
                    onViewDetails={onViewKpiDetails}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-secondary-500">
                {selectedAreaId !== null ? (
                  <p>No hay KPIs para los filtros seleccionados en esta área.</p>
                ) : (
                  <p>No hay KPIs para los filtros seleccionados.</p>
                )}
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
