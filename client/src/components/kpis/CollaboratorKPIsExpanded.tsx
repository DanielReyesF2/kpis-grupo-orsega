import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowUpDown, ArrowDown, ArrowUp, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Target, Calendar } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Building } from 'lucide-react';
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

        {/* Lista de KPIs agrupados por empresa */}
        <div className="space-y-4">
          {mappedKpis.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay KPIs asignados a este colaborador</p>
            </div>
          ) : (() => {
            // Agrupar KPIs por empresa
            const duraKpis = mappedKpis.filter(k => k.companyId === 1);
            const orsegaKpis = mappedKpis.filter(k => k.companyId === 2);
            const otherKpis = mappedKpis.filter(k => k.companyId !== 1 && k.companyId !== 2);
            const groups = [
              ...(duraKpis.length > 0 ? [{ label: 'DURA', color: 'emerald', kpis: duraKpis }] : []),
              ...(orsegaKpis.length > 0 ? [{ label: 'ORSEGA', color: 'purple', kpis: orsegaKpis }] : []),
              ...(otherKpis.length > 0 ? [{ label: 'Otros', color: 'gray', kpis: otherKpis }] : []),
            ];
            const showHeaders = groups.length > 1;

            return groups.map((group) => (
              <div key={group.label} className="space-y-2">
                {showHeaders && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                    group.color === 'emerald' ? 'bg-emerald-50 border border-emerald-200' :
                    group.color === 'purple' ? 'bg-purple-50 border border-purple-200' :
                    'bg-gray-50 border border-gray-200'
                  }`}>
                    <Building className={`h-4 w-4 ${
                      group.color === 'emerald' ? 'text-emerald-600' :
                      group.color === 'purple' ? 'text-purple-600' :
                      'text-gray-600'
                    }`} />
                    <span className={`text-sm font-bold ${
                      group.color === 'emerald' ? 'text-emerald-700' :
                      group.color === 'purple' ? 'text-purple-700' :
                      'text-gray-700'
                    }`}>{group.label}</span>
                    <span className="text-xs text-gray-500">({group.kpis.length} KPIs)</span>
                  </div>
                )}
                {group.kpis.map((kpi) => (
                  <div key={kpi.id} className={`border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden ${
                    kpi.companyId === 1 ? 'border-l-4 border-l-emerald-500 border-gray-200' :
                    kpi.companyId === 2 ? 'border-l-4 border-l-purple-500 border-gray-200' :
                    'border-gray-200'
                  }`}>
                    <Collapsible
                      open={expandedKpiId === kpi.id}
                      onOpenChange={(open) => setExpandedKpiId(open ? kpi.id : null)}
                    >
                      {/* Fila principal del KPI */}
                      <CollapsibleTrigger asChild>
                        <button className="w-full p-5 hover:bg-gray-50/50 transition-colors text-left border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                              {/* Nombre del KPI y Estado */}
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

                              {/* Barra de Progreso y Cumplimiento */}
                              <div className="min-w-[120px]">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-500 uppercase tracking-wide">Cumplimiento</span>
                                  <span className={`text-xs font-bold ${
                                    kpi.compliancePercentage >= 100 ? 'text-green-600' :
                                    kpi.compliancePercentage >= 90 ? 'text-amber-600' : 'text-red-600'
                                  }`}>
                                    {kpi.compliancePercentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      kpi.compliancePercentage >= 100 ? 'bg-green-500' :
                                      kpi.compliancePercentage >= 90 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(kpi.compliancePercentage, 100)}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-end mt-1">
                                  {kpi.compliancePercentage >= 100 ? (
                                    <span className="flex items-center text-xs text-green-600">
                                      <TrendingUp className="h-3 w-3 mr-0.5" />
                                      En meta
                                    </span>
                                  ) : kpi.compliancePercentage >= 90 ? (
                                    <span className="flex items-center text-xs text-amber-600">
                                      <Minus className="h-3 w-3 mr-0.5" />
                                      Cerca
                                    </span>
                                  ) : (
                                    <span className="flex items-center text-xs text-red-600">
                                      <TrendingDown className="h-3 w-3 mr-0.5" />
                                      Bajo meta
                                    </span>
                                  )}
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

                      {/* Contenido expandible con gráfica histórica */}
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
                ))}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

