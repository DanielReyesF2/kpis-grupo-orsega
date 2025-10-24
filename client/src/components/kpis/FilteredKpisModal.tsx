import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { KpiDetail } from '@shared/schema';

interface FilteredKpisModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'complies' | 'alert' | 'not_compliant' | 'all' | undefined;
  kpis: KpiDetail[];
  onViewKpiDetails?: (kpiId: number) => void;
}

const statusLabels = {
  'complies': 'En cumplimiento',
  'alert': 'En alerta',
  'not_compliant': 'Fuera de objetivo',
  'all': 'Todos los KPIs'
};

const statusIcons = {
  'complies': <CheckCircle className="h-5 w-5 text-green-500" />,
  'alert': <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  'not_compliant': <XCircle className="h-5 w-5 text-red-500" />,
  'all': <BarChart3 className="h-5 w-5 text-blue-500" />
};

export function FilteredKpisModal({ isOpen, onClose, status, kpis, onViewKpiDetails }: FilteredKpisModalProps) {
  const [filteredKpis, setFilteredKpis] = useState<KpiDetail[]>([]);

  useEffect(() => {
    if (status === 'all' || !status) {
      setFilteredKpis(kpis);
    } else {
      setFilteredKpis(kpis.filter(kpi => kpi.status === status));
    }
  }, [kpis, status]);

  const statusColor = status === 'complies' 
    ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30' 
    : status === 'alert' 
      ? 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30' 
      : status === 'not_compliant' 
        ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30' 
        : 'text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900/30';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center mb-1 sm:mb-2">
            <div className={`h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center mr-2 ${statusColor}`}>
              {status && statusIcons[status]}
            </div>
            <DialogTitle className="text-base sm:text-xl">
              {status ? statusLabels[status] : 'Todos los KPIs'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            {filteredKpis.length} KPIs{status !== 'all' && status ? ` en estado "${statusLabels[status]?.toLowerCase()}"` : ''}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(70vh-80px)] mt-2 sm:mt-4">
          <div className="space-y-2 sm:space-y-3 pr-2 sm:pr-4">
            {filteredKpis.length > 0 ? (
              filteredKpis.map((kpi) => (
                <Card 
                  key={kpi.id} 
                  className={`border ${
                    kpi.status === 'complies' ? 'border-green-100 hover:border-green-300' :
                    kpi.status === 'alert' ? 'border-yellow-100 hover:border-yellow-300' :
                    'border-red-100 hover:border-red-300'
                  } cursor-pointer transition-all hover:shadow-sm`}
                  onClick={() => onViewKpiDetails && onViewKpiDetails(kpi.id)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center mr-2 sm:mr-3 ${
                          kpi.status === 'complies' ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' :
                          kpi.status === 'alert' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400' :
                          'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                        }`}>
                          {kpi.status === 'complies' ? <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" /> :
                          kpi.status === 'alert' ? <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" /> :
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />}
                        </div>
                        <div className="min-w-0 flex-1 mr-2">
                          <h3 className="font-medium text-sm sm:text-base truncate">{kpi.name}</h3>
                        </div>
                      </div>
                      <Badge 
                        className={`text-xs whitespace-nowrap ${
                          kpi.status === 'complies' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' :
                          kpi.status === 'alert' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                          'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                        }`}
                      >
                        {kpi.status === 'complies' ? 'Cumple' : 
                        kpi.status === 'alert' ? 'Alerta' : 'No Cumple'}
                      </Badge>
                    </div>
                    {(kpi.value || kpi.target || kpi.compliancePercentage) && (
                      <div className="mt-2 sm:mt-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-2">
                        <div className="flex space-x-4 sm:space-x-6">
                          {kpi.value && (
                            <div>
                              <p className="text-xs text-gray-500">Valor actual</p>
                              <p className="font-medium text-xs sm:text-sm">{kpi.value}</p>
                            </div>
                          )}
                          {kpi.target && (
                            <div>
                              <p className="text-xs text-gray-500">Objetivo</p>
                              <p className="font-medium text-xs sm:text-sm">{kpi.target}</p>
                            </div>
                          )}
                        </div>
                        {kpi.compliancePercentage && (
                          <div>
                            <p className="text-xs text-gray-500">Cumplimiento</p>
                            <p className={`text-xs sm:text-sm ${
                              kpi.status === 'complies' ? 'font-medium text-green-600 dark:text-green-400' :
                              kpi.status === 'alert' ? 'font-medium text-yellow-600 dark:text-yellow-400' :
                              'font-medium text-red-600 dark:text-red-400'
                            }`}>
                              {kpi.compliancePercentage || '—'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {kpi.comments && (
                      <div className="mt-2 text-xs sm:text-sm text-gray-500 p-2 bg-gray-50 dark:bg-gray-900/20 rounded-md">
                        {kpi.comments}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No se encontraron KPIs con el estado seleccionado.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}