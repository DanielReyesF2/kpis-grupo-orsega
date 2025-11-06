import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart2, Award, ArrowUp, ArrowDown } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SalesMetricsCardsProps {
  companyId: number;
}

export function SalesMetricsCards({ companyId }: SalesMetricsCardsProps) {
  // Estado para los objetivos anuales (derivados del objetivo mensual del KPI)
  const [annualTargets, setAnnualTargets] = useState({
    dura: 667449, // fallback: 55,620 * 12 (mensual)
    orsega: 10300476 // fallback: 858,373 * 12 (mensual)
  });

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
  
  // Cuando llegue la metadata del KPI, derivar el objetivo anual desde "goal" (objetivo mensual)
  useEffect(() => {
    // Si hay KPI y trae goal numérico, usamos goal * 12; fallback a valores por defecto
    const monthlyGoal = salesKpi?.goal != null
      ? parseFloat(String(salesKpi.goal).toString().replace(/[^0-9.-]+/g, ''))
      : undefined;

    if (!isNaN(monthlyGoal as number) && monthlyGoal! > 0) {
      setAnnualTargets(prev => ({
        ...prev,
        [companyId === 1 ? 'dura' : 'orsega']: Math.round((monthlyGoal as number) * 12)
      }));
    }
  }, [salesKpi, companyId]);

  const kpiId = salesKpi?.id || (companyId === 1 ? 39 : 1);

  // Cargar datos históricos - IMPORTANTE: incluir companyId en la query para obtener los datos correctos
  const { data: kpiHistory } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12, companyId }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/kpi-history/${kpiId}?months=12&companyId=${companyId}`);
      return await response.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true, // Refrescar cuando la ventana vuelve a estar en foco
    staleTime: 0, // No cachear para asegurar datos frescos después de actualizaciones
    enabled: !!kpiId && kpiId > 0,
  });

  // Procesar datos (YTD: solo meses del año en curso)
  const salesData = useMemo(() => {
    if (!kpiHistory || kpiHistory.length === 0) {
      console.log(`[SalesMetricsCards] KPI History vacío para Company ${companyId}`);
      return [];
    }
    
    console.log(`[SalesMetricsCards] Procesando ${kpiHistory.length} registros de historial para Company ${companyId}`);
    
    // Aceptar mayúsculas y minúsculas en nombres de meses (igual que en la gráfica)
    const monthOrder: { [key: string]: number } = {
      'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
      'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
      'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12,
      'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
      'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
      'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
    };
    
    const currentYear = new Date().getFullYear();

    const filtered = kpiHistory.filter((item: any) => {
      // Intentar obtener el año de distintas formas
      const period = String(item.period || '');
      const parts = period.split(' ');
      let year = parseInt(parts[1], 10);

      if (isNaN(year)) {
        const match = period.match(/(20\d{2})/);
        if (match) year = parseInt(match[1], 10);
      }
      if (isNaN(year) && item.year) {
        year = parseInt(String(item.year), 10);
      }
      if (isNaN(year) && item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) year = d.getFullYear();
      }

      return !isNaN(year) && year === currentYear;
    });
    
    console.log(`[SalesMetricsCards] Filtrados por año ${currentYear}: ${filtered.length} registros`);

    const sortedHistory = [...filtered].sort((a: any, b: any) => {
      const monthA = (a.period || '').split(' ')[0];
      const monthB = (b.period || '').split(' ')[0];
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });
    
    const processed = sortedHistory.map((item: any) => {
      const rawValue = String(item.value);
      const parsed = parseFloat(rawValue.replace(/[^0-9.-]+/g, '')) || 0;
      
      // Log para debugging de valores sospechosos
      if (parsed > 1000000) {
        console.warn(`[SalesMetricsCards] ⚠️ Valor sospechosamente alto detectado:`, {
          raw: rawValue,
          parsed,
          period: item.period,
          kpiId: item.kpiId
        });
      }
      
      return { sales: parsed, period: item.period };
    });
    
    return processed;
  }, [kpiHistory]);

  // Volumen total del año (YTD)
  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  
  // Log del total calculado para debugging
  console.log(`[SalesMetricsCards] Company ${companyId}: Total YTD = ${totalSales.toLocaleString()}, Registros procesados = ${salesData.length}`);

  // Objetivo anual derivado desde DB (goal mensual * 12) con fallback
  const monthlyGoalFromDb = salesKpi?.goal != null
    ? parseFloat(String(salesKpi.goal).toString().replace(/[^0-9.-]+/g, ''))
    : undefined;

  const derivedAnnualTarget = !isNaN(monthlyGoalFromDb as number) && monthlyGoalFromDb! > 0
    ? Math.round((monthlyGoalFromDb as number) * 12)
    : (companyId === 1 ? annualTargets.dura : annualTargets.orsega);

  const totalTarget = derivedAnnualTarget;
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

  // Calcular valores del mes anterior para comparación
  const previousMonthSales = salesData.length >= 2 
    ? salesData[salesData.length - 2].sales 
    : 0;
  const previousMonthPercentage = totalTarget > 0 
    ? Math.round((previousMonthSales / totalTarget) * 100) 
    : 0;

  // Calcular datos mensuales para el resumen
  const monthlyTarget = salesKpi?.goal 
    ? parseFloat(String(salesKpi.goal).replace(/[^0-9.-]+/g, '')) 
    : (companyId === 1 ? 55620 : 858373);
  
  // Resumen de TODOS los meses del año (para cálculo de "En meta")
  const allYearlyData = useMemo(() => {
    return salesData.map(item => {
      const monthName = (item.period || '').split(' ')[0] || '';
      const monthShort = monthName.substring(0, 3);
      const compliance = monthlyTarget > 0 ? Math.round((item.sales / monthlyTarget) * 100) : 0;
      return {
        month: monthShort,
        fullMonth: monthName,
        sales: item.sales,
        compliance,
      };
    });
  }, [salesData, monthlyTarget]);

  // Todos los meses del año para mostrar en el gráfico visual
  const monthlySummary = useMemo(() => {
    return allYearlyData;
  }, [allYearlyData]);

  // Calcular promedio y meses en meta usando TODOS los meses del año
  const avgCompliance = allYearlyData.length > 0
    ? Math.round(allYearlyData.reduce((sum, m) => sum + m.compliance, 0) / allYearlyData.length)
    : 0;
  
  const monthsOnTarget = allYearlyData.filter(m => m.compliance >= 100).length;

  // Calcular proyección anual para insight
  const currentMonth = new Date().getMonth() + 1;
  const monthsElapsed = salesData.length;
  const projectedAnnual = monthsElapsed > 0 
    ? (totalSales / monthsElapsed) * 12 
    : 0;
  const projectedPercentage = totalTarget > 0 
    ? Math.round((projectedAnnual / totalTarget) * 100) 
    : 0;

  const formatNumber = (value: number) => {
    if (companyId === 1) {
      return new Intl.NumberFormat('es-MX').format(value) + " KG";
    } else {
      return new Intl.NumberFormat('es-MX').format(value) + " unidades";
    }
  };

  return (
    <Card className="border border-border/60 bg-card shadow-soft">
      <CardContent className="p-6">
        {/* Header con información principal */}
        <div className="mb-6">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2 font-medium">Ventas del Año</p>
            <p className="text-2xl font-bold mb-2 text-foreground">
              {formatNumber(totalSales)}
            </p>
            <div className="flex items-center text-success">
              <ArrowUp className="h-4 w-4 mr-1" />
              <span className="text-sm font-medium">{growthRate}% vs mes anterior</span>
            </div>
          </div>
        </div>

        {/* Barra de progreso del objetivo anual */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">Avance del Objetivo Anual</span>
            <span className="text-[10px] font-semibold text-muted-foreground bg-card/95 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border/50 whitespace-nowrap">
              {formatNumber(totalTarget).replace(' unidades', '')}
            </span>
          </div>
          <div className="relative w-full" style={{ overflow: 'visible', paddingTop: '8px', paddingBottom: '8px' }}>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary mb-2">
              <div
                className="h-full w-full flex-1 bg-primary transition-all"
                style={{ transform: `translateX(-${100 - (compliancePercentage > 100 ? 100 : compliancePercentage)}%)` }}
              />
            </div>
            <div 
              className="absolute w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-md transition-all duration-500 z-10 pointer-events-none"
              style={{ 
                left: `${Math.min(Math.max(compliancePercentage > 100 ? 100 : compliancePercentage, 4), 96)}%`,
                top: '4px',
                transform: 'translateX(-50%)'
              }}
            >
              <span className="text-[11px] font-bold leading-none">{compliancePercentage}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${
              compliancePercentage >= 100 
                ? 'text-green-600' 
                : compliancePercentage >= 75 
                ? 'text-amber-600' 
                : 'text-red-600'
            }`}>
              {compliancePercentage >= 100 ? '¡Meta cumplida!' : 
               compliancePercentage >= 75 ? 'Buen progreso' :
               compliancePercentage >= 50 ? 'Progreso medio' : 'Requiere atención'}
            </span>
            {salesData.length >= 2 && previousMonthPercentage > 0 && (
              <div className="flex items-center gap-1">
                {compliancePercentage > previousMonthPercentage ? (
                  <>
                    <ArrowUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">
                      +{compliancePercentage - previousMonthPercentage}%
                    </span>
                  </>
                ) : compliancePercentage < previousMonthPercentage ? (
                  <>
                    <ArrowDown className="h-3 w-3 text-red-600" />
                    <span className="text-xs text-red-600 font-medium">
                      {compliancePercentage - previousMonthPercentage}%
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>

          {/* Resumen del año - Simplificado */}
          {monthlySummary.length > 0 && (
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs font-semibold text-foreground mb-3">Resumen del año</p>
            
            {/* Gráfico de barras simplificado */}
            <div className="flex items-end justify-between gap-2 mb-4" style={{ height: '60px' }}>
              {monthlySummary.map((month, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                  <div 
                    className="w-full rounded-t transition-all duration-300"
                    style={{
                      height: `${Math.min((month.compliance / 120) * 100, 100)}%`,
                      backgroundColor: month.compliance >= 100 
                        ? '#22c55e'
                        : month.compliance >= 75 
                        ? '#eab308'
                        : '#ef4444',
                      opacity: month.compliance >= 100 ? 0.9 : 0.8,
                      minHeight: '4px'
                    }}
                  />
                  <div className="text-xs font-medium text-foreground">{month.month}</div>
                </div>
              ))}
            </div>

            {/* Métricas clave - Simplificadas */}
            <div className="flex justify-between items-center pt-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <BarChart2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Promedio anual</div>
                  <div className="text-base font-bold text-foreground">{avgCompliance}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Meses en meta</div>
                  <div className="text-base font-bold text-green-600">{monthsOnTarget}/{allYearlyData.length}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
