import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart2, Award, ArrowUp } from 'lucide-react';

interface SalesMetricsCardsProps {
  companyId: number;
}

export function SalesMetricsCards({ companyId }: SalesMetricsCardsProps) {
  // Estado para los objetivos anuales desde localStorage
  const [annualTargets, setAnnualTargets] = useState({
    dura: 667449,
    orsega: 10300476
  });

  // Cargar objetivos desde localStorage de forma segura (solo en cliente)
  useEffect(() => {
    try {
      const duraStoredTarget = localStorage.getItem('duraAnnualTarget');
      const orsegaStoredTarget = localStorage.getItem('orsegaAnnualTarget');
      
      setAnnualTargets({
        dura: duraStoredTarget ? parseInt(duraStoredTarget, 10) : 667449,
        orsega: orsegaStoredTarget ? parseInt(orsegaStoredTarget, 10) : 10300476
      });
    } catch (error) {
      // localStorage no está disponible (durante SSR o build)
      console.warn('No se pudo acceder a localStorage:', error);
    }
  }, []);

  // Buscar el KPI de Volumen de Ventas por nombre
  const { data: allKpis } = useQuery<any[]>({
    queryKey: ['/api/kpis', { companyId }],
    staleTime: 5 * 60 * 1000,
  });

  const salesKpi = allKpis?.find((kpi: any) => {
    const name = (kpi.kpiName || kpi.name || '').toLowerCase();
    return (name.includes('volumen') && name.includes('ventas')) || 
           name.includes('ventas') || 
           name.includes('sales');
  });

  const kpiId = salesKpi?.id || (companyId === 1 ? 39 : 10);

  // Cargar datos históricos
  const { data: kpiHistory } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12 }],
    refetchInterval: 30000,
    enabled: !!kpiId && kpiId > 0,
  });

  // Procesar datos
  const salesData = useMemo(() => {
    if (!kpiHistory || kpiHistory.length === 0) return [];
    
    const monthOrder: { [key: string]: number } = {
      'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
      'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
      'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
    };
    
    const sortedHistory = [...kpiHistory].sort((a: any, b: any) => {
      const monthA = (a.period || '').split(' ')[0];
      const monthB = (b.period || '').split(' ')[0];
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });
    
    return sortedHistory.map((item: any) => ({
      sales: parseFloat(item.value) || 0,
      period: item.period
    }));
  }, [kpiHistory]);

  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  const totalTarget = companyId === 1 ? annualTargets.dura : annualTargets.orsega;
  const compliancePercentage = totalTarget > 0 ? Math.round((totalSales / totalTarget) * 100) : 0;

  const getGrowthRate = () => {
    if (salesData.length < 2) return '0.0';
    const lastMonth = salesData[salesData.length - 1].sales;
    const previousMonth = salesData[salesData.length - 2].sales;
    if (previousMonth === 0) return '0.0';
    const growthRate = ((lastMonth - previousMonth) / previousMonth) * 100;
    return growthRate.toFixed(1);
  };

  const growthRate = getGrowthRate();

  const formatNumber = (value: number) => {
    if (companyId === 1) {
      return new Intl.NumberFormat('es-MX').format(value) + " KG";
    } else {
      return new Intl.NumberFormat('es-MX').format(value) + " unidades";
    }
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {/* Volumen Total */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-0 text-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-100 mb-1 font-medium">Volumen Total</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-100 mb-2">
                {formatNumber(totalSales)}
              </p>
              <div className="flex items-center text-emerald-600 dark:text-emerald-400 mb-3">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span className="text-xs font-medium">{growthRate}% vs mes anterior</span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-300 mb-2 flex justify-between">
                <span>Progreso</span>
                <span className="font-medium">{compliancePercentage}%</span>
              </div>
              <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${compliancePercentage > 100 ? 100 : compliancePercentage}%` }}
                ></div>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-full dark:bg-blue-800/50 ml-4">
              <BarChart2 className="h-6 w-6 text-blue-600 dark:text-blue-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avance del Objetivo Anual */}
      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-0 text-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-amber-900 dark:text-amber-100 mb-1 font-medium">Avance del Objetivo Anual</p>
              <div className="flex items-center mb-2">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-100">
                  {compliancePercentage}%
                </p>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                  {compliancePercentage >= 100 ? '¡Meta cumplida!' : 
                   compliancePercentage >= 75 ? 'Buen progreso' :
                   compliancePercentage >= 50 ? 'Progreso medio' : 'Requiere atención'}
                </span>
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-300 mb-2">
                <span className="font-medium">Ventas: {formatNumber(totalSales)}</span> / <span>{formatNumber(totalTarget)}</span>
              </div>
              <div className="w-full h-2 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    compliancePercentage >= 100 ? 'bg-green-600' : 'bg-amber-600 dark:bg-amber-400'
                  }`}
                  style={{ width: `${compliancePercentage > 100 ? 100 : compliancePercentage}%` }}
                ></div>
              </div>
            </div>
            <div className="p-3 bg-amber-100 rounded-full dark:bg-amber-800/50 ml-4">
              <Award className="h-6 w-6 text-amber-600 dark:text-amber-300" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

