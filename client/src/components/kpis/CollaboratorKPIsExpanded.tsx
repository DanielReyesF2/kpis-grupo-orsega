import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EnhancedKpiCard } from './EnhancedKpiCard';
import type { CollaboratorScore } from './CollaboratorCard';

interface CollaboratorKPIsExpandedProps {
  collaborator: CollaboratorScore;
  onUpdateKpi: (kpiId: number) => void;
}

export function CollaboratorKPIsExpanded({
  collaborator,
  onUpdateKpi
}: CollaboratorKPIsExpandedProps) {
  const [sortBy, setSortBy] = useState<'compliance' | 'name' | 'status' | 'trend'>('compliance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedKpiId, setExpandedKpiId] = useState<number | null>(null);

  // Ordenar KPIs
  const sortedKpis = useMemo(() => {
    if (!collaborator || !collaborator.kpis) return [];
    
    const kpis = [...collaborator.kpis];
    return kpis.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'compliance':
          comparison = a.compliance - b.compliance;
          break;
        case 'name':
          comparison = (a.name || a.kpiName || '').localeCompare(b.name || b.kpiName || '');
          break;
        case 'status':
          const statusOrder: Record<string, number> = { 'complies': 3, 'alert': 2, 'not_compliant': 1 };
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
        case 'trend':
          const aChange = a.complianceChange ?? 0;
          const bChange = b.complianceChange ?? 0;
          comparison = aChange - bChange;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [collaborator, sortBy, sortOrder]);

  // Mapear los KPIs del colaborador al formato que espera EnhancedKpiCard
  const mappedKpis = useMemo(() => {
    if (!collaborator || !collaborator.kpis) return [];
    
    return sortedKpis.map((kpi) => {
      // Convertir status del colaborador al formato de EnhancedKpiCard
      let visualStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'warning';
      if (kpi.status === 'complies') {
        visualStatus = kpi.compliance >= 100 ? 'excellent' : 'good';
      } else if (kpi.status === 'alert') {
        visualStatus = 'warning';
      } else if (kpi.status === 'not_compliant') {
        visualStatus = 'critical';
      }

      // Convertir value a número
      const value = kpi.latestValue?.value 
        ? parseFloat(String(kpi.latestValue.value).replace(/[^0-9.-]+/g, '')) 
        : null;

      // Extraer companyId del KPI si está disponible
      const companyId = kpi.companyId || (kpi as any).companyId;

      return {
        id: kpi.id,
        name: kpi.name || kpi.kpiName || 'KPI sin nombre',
        value: value,
        target: kpi.target || '0',
        unit: kpi.unit || '',
        compliancePercentage: kpi.compliance || 0,
        status: visualStatus,
        areaName: kpi.area || undefined,
        responsible: kpi.responsible || collaborator.name,
        companyId: companyId,
        company: companyId === 1 ? 'Dura' : companyId === 2 ? 'Orsega' : undefined,
      };
    });
  }, [sortedKpis, collaborator]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complies':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            ✅ Cumplido
          </Badge>
        );
      case 'alert':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            ⚠️ En Riesgo
          </Badge>
        );
      case 'not_compliant':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            ❌ No Cumplido
          </Badge>
        );
      default:
        return <Badge variant="outline">Sin Estado</Badge>;
    }
  };

  return (
    <div className="w-full border-t-2 border-gray-300 bg-white">
      <div className="p-5 space-y-4">
        {/* Header del panel expandido */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">KPIs de {collaborator.name}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {mappedKpis.length} KPI{mappedKpis.length !== 1 ? 's' : ''} asignado{mappedKpis.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Controles de ordenamiento */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Ordenar por:</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compliance">Cumplimiento</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="status">Estado</SelectItem>
                <SelectItem value="trend">Tendencia</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="h-9 w-9 p-0"
              title={sortOrder === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
            >
              {sortOrder === 'asc' ? <ArrowUpDown className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Lista de KPIs en formato horizontal/tabla */}
        <div className="space-y-2">
          {mappedKpis.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay KPIs asignados a este colaborador</p>
            </div>
          ) : (
            mappedKpis.map((kpi) => (
              <div key={kpi.id} className="border border-gray-200 rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
                <Collapsible 
                  open={expandedKpiId === kpi.id}
                  onOpenChange={(open) => setExpandedKpiId(open ? kpi.id : null)}
                >
                  {/* Fila principal del KPI - Formato horizontal tipo tabla */}
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-5 hover:bg-gray-50/50 transition-colors text-left border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center justify-between gap-6">
                        {/* Información principal del KPI - Diseño horizontal */}
                        <div className="flex-1 grid grid-cols-5 gap-6 items-center">
                          {/* Nombre del KPI */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-bold text-gray-900 truncate">
                                {kpi.name}
                              </h3>
                              {getStatusBadge(
                                kpi.status === 'excellent' || kpi.status === 'good' ? 'complies' :
                                kpi.status === 'warning' ? 'alert' : 'not_compliant'
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {kpi.areaName || 'Sin área'}
                            </div>
                          </div>
                          
                          {/* Valor Actual */}
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Valor Actual</div>
                            <div className="text-lg font-bold text-gray-900">
                              {kpi.value !== null 
                                ? `${kpi.value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
                                : 'N/A'
                              }
                              {kpi.value !== null && kpi.unit && (
                                <span className="text-sm font-normal text-gray-500 ml-1">{kpi.unit}</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Meta */}
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Meta</div>
                            <div className="text-lg font-semibold text-gray-800">
                              {kpi.target}
                              {kpi.unit && <span className="text-sm font-normal text-gray-500 ml-1">{kpi.unit}</span>}
                            </div>
                          </div>
                          
                          {/* Cumplimiento */}
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cumplimiento</div>
                            <div className={`text-xl font-bold ${
                              kpi.compliancePercentage >= 100 ? 'text-green-600' :
                              kpi.compliancePercentage >= 75 ? 'text-amber-600' :
                              'text-red-600'
                            }`}>
                              {kpi.compliancePercentage.toFixed(1)}%
                            </div>
                          </div>
                          
                          {/* Barra de progreso visual */}
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Progreso</div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  kpi.compliancePercentage >= 100 ? 'bg-green-500' :
                                  kpi.compliancePercentage >= 75 ? 'bg-amber-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(kpi.compliancePercentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Botones de acción */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateKpi(kpi.id);
                            }}
                            className="h-9"
                          >
                            Actualizar
                          </Button>
                          <div className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors">
                            {expandedKpiId === kpi.id ? (
                              <ChevronUp className="h-5 w-5 text-gray-500" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  
                  {/* Contenido expandible con gráfica histórica - Ancho completo */}
                  <CollapsibleContent>
                    <div className="border-t-2 border-gray-200 bg-gray-50/30 p-6">
                      <EnhancedKpiCard
                        kpi={kpi}
                        onClick={() => onUpdateKpi(kpi.id)}
                        delay={0}
                        expandedLayout={true}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

