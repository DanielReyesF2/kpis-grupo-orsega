import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle, BarChart3, Clock } from 'lucide-react';
import type { KpiStatus } from '@/lib/utils/kpi-status';

interface KpiData {
  id: number;
  name: string;
  status: KpiStatus;
}

interface SummaryCardsProps {
  kpis: KpiData[];
  lastUpdated?: string;
  onStatusFilterClick?: (status: KpiStatus | 'all') => void;
}

export function SummaryCards({ kpis, lastUpdated = 'N/A', onStatusFilterClick }: SummaryCardsProps) {
  const [summaryData, setSummaryData] = useState({
    compliesCount: 0,
    alertCount: 0,
    notCompliantCount: 0,
    totalCount: 0,
    compliesPercentage: 0,
    alertPercentage: 0,
    notCompliantPercentage: 0,
  });

  useEffect(() => {
    // Asegurarse que kpis es un array válido
    if (!kpis || !Array.isArray(kpis) || kpis.length === 0) {
      setSummaryData({
        compliesCount: 0,
        alertCount: 0,
        notCompliantCount: 0,
        totalCount: 0,
        compliesPercentage: 0,
        alertPercentage: 0,
        notCompliantPercentage: 0,
      });
      return;
    }

    // Filtrar KPIs únicos por ID para evitar duplicados
    const uniqueKpis = Array.from(new Map(kpis.map(kpi => [kpi.id, kpi])).values());
    
    const totalCount = uniqueKpis.length;
    const compliesCount = uniqueKpis.filter(kpi => kpi.status === 'complies').length;
    const alertCount = uniqueKpis.filter(kpi => kpi.status === 'alert').length;
    const notCompliantCount = uniqueKpis.filter(kpi => kpi.status === 'not_compliant').length;

    setSummaryData({
      compliesCount,
      alertCount,
      notCompliantCount,
      totalCount,
      compliesPercentage: totalCount > 0 ? Math.round((compliesCount / totalCount) * 100) : 0,
      alertPercentage: totalCount > 0 ? Math.round((alertCount / totalCount) * 100) : 0,
      notCompliantPercentage: totalCount > 0 ? Math.round((notCompliantCount / totalCount) * 100) : 0,
    });
  }, [kpis]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card 
        className={`border border-green-100 dark:border-green-900/30 dark:bg-primary-900/80 ${onStatusFilterClick ? 'cursor-pointer transition-all hover:shadow-md hover:border-green-300 dark:hover:border-green-700' : ''}`}
        onClick={() => onStatusFilterClick && onStatusFilterClick('complies')}
      >
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 rounded-md bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium font-ruda text-secondary-500 dark:text-secondary-300">KPIs en cumplimiento</h2>
              <p className="text-2xl font-anton text-green-600 dark:text-green-400">{summaryData.compliesPercentage}%</p>
            </div>
          </div>
          <div className="mt-4 w-full bg-secondary-200 dark:bg-primary-800 rounded-full h-2.5">
            <div 
              className="bg-green-500 dark:bg-green-600 h-2.5 rounded-full" 
              style={{ width: `${summaryData.compliesPercentage}%` }}
            ></div>
          </div>
          {onStatusFilterClick && (
            <div className="mt-2 text-xs text-green-600 dark:text-green-400 text-right">
              Click para ver ({summaryData.compliesCount})
            </div>
          )}
        </CardContent>
      </Card>

      <Card 
        className={`border border-yellow-100 dark:border-yellow-900/30 dark:bg-primary-900/80 ${onStatusFilterClick ? 'cursor-pointer transition-all hover:shadow-md hover:border-yellow-300 dark:hover:border-yellow-700' : ''}`}
        onClick={() => onStatusFilterClick && onStatusFilterClick('alert')}
      >
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 rounded-md bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium font-ruda text-secondary-500 dark:text-secondary-300">KPIs en alerta</h2>
              <p className="text-2xl font-anton text-yellow-600 dark:text-yellow-400">{summaryData.alertPercentage}%</p>
            </div>
          </div>
          <div className="mt-4 w-full bg-secondary-200 dark:bg-primary-800 rounded-full h-2.5">
            <div 
              className="bg-yellow-500 dark:bg-yellow-600 h-2.5 rounded-full" 
              style={{ width: `${summaryData.alertPercentage}%` }}
            ></div>
          </div>
          {onStatusFilterClick && (
            <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 text-right">
              Click para ver ({summaryData.alertCount})
            </div>
          )}
        </CardContent>
      </Card>

      <Card 
        className={`border border-red-100 dark:border-red-900/30 dark:bg-primary-900/80 ${onStatusFilterClick ? 'cursor-pointer transition-all hover:shadow-md hover:border-red-300 dark:hover:border-red-700' : ''}`}
        onClick={() => onStatusFilterClick && onStatusFilterClick('not_compliant')}
      >
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 rounded-md bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
              <XCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium font-ruda text-secondary-500 dark:text-secondary-300">KPIs fuera de objetivo</h2>
              <p className="text-2xl font-anton text-red-600 dark:text-red-400">{summaryData.notCompliantPercentage}%</p>
            </div>
          </div>
          <div className="mt-4 w-full bg-secondary-200 dark:bg-primary-800 rounded-full h-2.5">
            <div 
              className="bg-red-500 dark:bg-red-600 h-2.5 rounded-full" 
              style={{ width: `${summaryData.notCompliantPercentage}%` }}
            ></div>
          </div>
          {onStatusFilterClick && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400 text-right">
              Click para ver ({summaryData.notCompliantCount})
            </div>
          )}
        </CardContent>
      </Card>

      <Card 
        className={`border border-accent/20 dark:border-primary-800 dark:bg-primary-900/80 ${onStatusFilterClick ? 'cursor-pointer transition-all hover:shadow-md hover:border-accent/30 dark:hover:border-accent/20' : ''}`}
        onClick={() => onStatusFilterClick && onStatusFilterClick('all')}
      >
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 rounded-md bg-accent/20 text-primary dark:bg-accent/10 dark:text-accent">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium font-ruda text-secondary-500 dark:text-secondary-300">Total KPIs</h2>
              <p className="text-2xl font-anton text-primary-700 dark:text-white">{summaryData.totalCount}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-secondary-500 dark:text-secondary-400 flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1 inline" />
              Última actualización: {lastUpdated}
            </span>
            {onStatusFilterClick ? (
              <span className="text-xs text-accent font-ruda hover:underline cursor-pointer">
                Ver todos
              </span>
            ) : (
              <span className="text-xs text-accent font-ruda hover:underline cursor-pointer">
                Ver detalles
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
