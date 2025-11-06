import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart2, Award, ArrowUp, ArrowDown, Lightbulb } from 'lucide-react';
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

  // Calcular datos mensuales para el resumen (últimos 6 meses)
  const monthlyTarget = salesKpi?.goal 
    ? parseFloat(String(salesKpi.goal).replace(/[^0-9.-]+/g, '')) 
    : (companyId === 1 ? 55620 : 858373);
  
  const monthlySummary = useMemo(() => {
    const last6Months = salesData.slice(-6);
    return last6Months.map(item => {
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

  const avgCompliance = monthlySummary.length > 0
    ? Math.round(monthlySummary.reduce((sum, m) => sum + m.compliance, 0) / monthlySummary.length)
    : 0;
  
  const monthsOnTarget = monthlySummary.filter(m => m.compliance >= 100).length;

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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {/* Volumen Total */}
      <Card className="border border-border/60 bg-card shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1 font-medium">Volumen Total</p>
              <p className="text-lg font-bold mb-2 text-foreground">
                {formatNumber(totalSales)}
              </p>
              <div className="flex items-center text-success">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span className="text-xs font-medium">{growthRate}% vs mes anterior</span>
              </div>
            </div>
            <div className="p-3 bg-primary/15 rounded-full ml-4 text-primary">
              <BarChart2 className="h-6 w-6" />
            </div>
          </div>

          {/* Resumen de los últimos meses */}
          {monthlySummary.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs font-semibold text-foreground mb-3">Últimos 6 meses</p>
              
              {/* Gráfico de barras simplificado */}
              <div className="flex items-end justify-between gap-2 mb-3" style={{ height: '50px' }}>
                {monthlySummary.map((month, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                    <div 
                      className="w-full rounded-t transition-all duration-300 hover:opacity-100"
                      style={{
                        height: `${Math.min((month.compliance / 120) * 100, 100)}%`,
                        backgroundColor: month.compliance >= 100 
                          ? '#22c55e' // verde más vibrante
                          : month.compliance >= 75 
                          ? '#eab308' // amarillo más vibrante
                          : '#ef4444', // rojo más vibrante
                        opacity: month.compliance >= 100 ? 0.9 : 0.8,
                        minHeight: '4px'
                      }}
                    />
                    <div className="text-xs font-medium text-foreground">{month.month}</div>
                    <div className={`text-xs font-bold ${
                      month.compliance >= 100 
                        ? 'text-green-600' 
                        : month.compliance >= 75 
                        ? 'text-amber-600' 
                        : 'text-red-600'
                    }`}>
                      {month.compliance}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumen simple */}
              <div className="flex justify-between items-center pt-2 bg-muted/30 rounded-md px-3 py-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">Promedio: </span>
                  <span className="font-bold text-foreground">{avgCompliance}%</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">En meta: </span>
                  <span className="font-bold text-green-600">{monthsOnTarget}</span>
                  <span className="text-muted-foreground">/{monthlySummary.length}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Avance del Objetivo Anual */}
      <Card className="border border-border/60 bg-card shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1 font-medium">Avance del Objetivo Anual</p>
              <div className="flex items-center mb-2">
                <p className="text-lg font-bold text-foreground">
                  {compliancePercentage}%
                </p>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {compliancePercentage >= 100 ? '¡Meta cumplida!' : 
                   compliancePercentage >= 75 ? 'Buen progreso' :
                   compliancePercentage >= 50 ? 'Progreso medio' : 'Requiere atención'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {formatNumber(totalSales)} de {formatNumber(totalTarget)}
              </div>
              
              {/* Comparación: Este mes vs Mes anterior */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium text-foreground">Este mes</span>
                    <span className="text-xs font-bold text-foreground">{compliancePercentage}%</span>
                  </div>
                  <Progress 
                    value={compliancePercentage > 100 ? 100 : compliancePercentage} 
                    className="h-3"
                  />
                </div>
                
                {salesData.length >= 2 && previousMonthPercentage > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Mes pasado</span>
                      <span className="text-xs font-bold text-muted-foreground">{previousMonthPercentage}%</span>
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          compliancePercentage > previousMonthPercentage 
                            ? 'bg-green-500/60' 
                            : 'bg-red-500/60'
                        }`}
                        style={{ width: `${previousMonthPercentage > 100 ? 100 : previousMonthPercentage}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {compliancePercentage > previousMonthPercentage ? (
                        <>
                          <ArrowUp className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">
                            Mejoró {compliancePercentage - previousMonthPercentage}%
                          </span>
                        </>
                      ) : compliancePercentage < previousMonthPercentage ? (
                        <>
                          <ArrowDown className="h-3 w-3 text-red-600" />
                          <span className="text-xs text-red-600 font-medium">
                            Bajó {previousMonthPercentage - compliancePercentage}%
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              {/* Proyección anual */}
              {monthsElapsed > 0 && monthsElapsed < 12 && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2">
                    <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground mb-0.5">Proyección anual</p>
                      <p className={`text-xs font-bold ${
                        projectedPercentage >= 100 
                          ? 'text-green-600' 
                          : projectedPercentage >= 90 
                          ? 'text-amber-600' 
                          : 'text-red-600'
                      }`}>
                        {projectedPercentage >= 100 
                          ? `✅ ${projectedPercentage}% - Superará la meta`
                          : projectedPercentage >= 90 
                          ? `⚠️ ${projectedPercentage}% - Cerca de la meta`
                          : `❌ ${projectedPercentage}% - Necesita mejorar`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 bg-amber-50/30 rounded-full ml-4 text-amber-600/70">
              <Award className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
