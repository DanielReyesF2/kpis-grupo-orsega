import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnhancedKpiCard } from './EnhancedKpiCard';
import type { CollaboratorScore } from './CollaboratorCard';

interface CollaboratorKPIsModalProps {
  collaborator: CollaboratorScore | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateKpi: (kpiId: number) => void;
}

export function CollaboratorKPIsModal({
  collaborator,
  isOpen,
  onClose,
  onUpdateKpi
}: CollaboratorKPIsModalProps) {
  const [sortBy, setSortBy] = useState<'compliance' | 'name' | 'status' | 'trend'>('compliance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Ordenar KPIs - validación dentro del useMemo
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
        companyId: companyId, // Pasar companyId para cargar historial correctamente
        company: companyId === 1 ? 'Dura' : companyId === 2 ? 'Orsega' : undefined,
      };
    });
  }, [sortedKpis, collaborator]);

  // Return condicional DESPUÉS de todos los hooks
  if (!collaborator) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            KPIs de {collaborator.name}
          </DialogTitle>
        </DialogHeader>

        {/* Controles de ordenamiento */}
        <div className="flex items-center gap-4 pb-4 border-b">
          <Label>Ordenar por:</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[180px]">
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
          >
            {sortOrder === 'asc' ? <ArrowUpDown className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Lista de KPIs con gráficas históricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mappedKpis.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              <p>No hay KPIs asignados a este colaborador</p>
            </div>
          ) : (
            mappedKpis.map((kpi, index) => (
              <EnhancedKpiCard
                key={kpi.id}
                kpi={kpi}
                onClick={() => {
                  onUpdateKpi(kpi.id);
                  onClose();
                }}
                delay={index * 0.05}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

