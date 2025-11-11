import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, ArrowUpDown, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CollaboratorScore } from './CollaboratorCard';

interface CollaboratorKPIsModalProps {
  collaborator: CollaboratorScore | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateKpi: (kpiId: number) => void;
  onViewDetails: (kpiId: number) => void;
}

export function CollaboratorKPIsModal({
  collaborator,
  isOpen,
  onClose,
  onUpdateKpi,
  onViewDetails
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

  // Return condicional DESPUÉS de todos los hooks
  if (!collaborator) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complies':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700">
            ✅ Cumplido
          </Badge>
        );
      case 'alert':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700">
            ⚠️ En Riesgo
          </Badge>
        );
      case 'not_compliant':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700">
            ❌ No Cumplido
          </Badge>
        );
      default:
        return <Badge variant="outline">Sin Estado</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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

        {/* Lista de KPIs */}
        <div className="space-y-3">
          {sortedKpis.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay KPIs asignados a este colaborador</p>
            </div>
          ) : (
            sortedKpis.map((kpi) => (
              <Card key={kpi.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {kpi.name || kpi.kpiName}
                        </h3>
                        {getStatusBadge(kpi.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Valor Actual:</span>{' '}
                          {kpi.latestValue?.value || 'N/A'} {kpi.unit || ''}
                        </div>
                        <div>
                          <span className="font-medium">Meta:</span> {kpi.target || 'N/A'}{' '}
                          {kpi.unit || ''}
                        </div>
                        <div>
                          <span className="font-medium">Compliance:</span>{' '}
                          {kpi.compliance.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Tendencia:</span>
                          {kpi.complianceChange !== null && kpi.complianceChange !== undefined ? (
                            <div className="flex items-center gap-1">
                              {kpi.trendDirection === 'up' && <ArrowUp className="h-3 w-3 text-green-600" />}
                              {kpi.trendDirection === 'down' && <ArrowDown className="h-3 w-3 text-red-600" />}
                              {kpi.trendDirection === 'stable' && <Minus className="h-3 w-3 text-gray-500" />}
                              <span className={`text-xs font-semibold ${
                                kpi.trendDirection === 'up' ? 'text-green-600' :
                                kpi.trendDirection === 'down' ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {kpi.complianceChange > 0 ? '+' : ''}{kpi.complianceChange.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Sin datos</span>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Última Actualización:</span>{' '}
                          {formatDate(kpi.lastUpdate)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onUpdateKpi(kpi.id);
                          onClose();
                        }}
                      >
                        Actualizar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onViewDetails(kpi.id);
                          onClose();
                        }}
                      >
                        Detalles
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

