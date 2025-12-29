import { devLog } from "@/lib/logger";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart2, Award, ArrowUp, ArrowDown } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SalesMetricsCardsProps {
  companyId: number;
}

export function SalesMetricsCards({ companyId }: SalesMetricsCardsProps) {
  const queryClient = useQueryClient();
  
  // Valores por defecto para fallback (solo si no hay datos del KPI)
  const defaultAnnualTargets = {
    dura: 667449,    // ~55,620 * 12
    orsega: 10300476 // ~858,373 * 12
  };

  // Buscar el KPI de Volumen de Ventas por nombre
  const { data: allKpis } = useQuery<any[]>({
    queryKey: ['/api/kpis', { companyId }],
    staleTime: 0, // No cachear para asegurar datos frescos
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Forzar refresco cuando se monta el componente
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/kpis', { companyId }] });
  }, [companyId, queryClient]);

  const salesKpi = allKpis?.find((kpi: any) => {
    const name = (kpi.kpiName || kpi.name || '').toLowerCase();
    return (name.includes('volumen') && name.includes('ventas')) || 
           name.includes('ventas') || 
           name.includes('sales');
  });

  const kpiId = salesKpi?.id || (companyId === 1 ? 39 : 1);

  // Cargar datos históricos
  const { data: kpiHistory } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12, companyId }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/kpi-history/${kpiId}?months=12&companyId=${companyId}`);
      return await response.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: !!kpiId && kpiId > 0,
  });

  // Procesar datos (YTD: solo meses del año en curso)
  const salesData = useMemo(() => {
    if (!kpiHistory || kpiHistory.length === 0) {
      devLog.log(`[SalesMetricsCards] KPI History vacío para Company ${companyId}`);
      return [];
    }
    
    devLog.log(`[SalesMetricsCards] Procesando ${kpiHistory.length} registros de historial para Company ${companyId}`);
    
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
    
    devLog.log(`[SalesMetricsCards] Filtrados por año ${currentYear}: ${filtered.length} registros`);

    const sortedHistory = [...filtered].sort((a: any, b: any) => {
      const monthA = (a.period || '').split(' ')[0];
      const monthB = (b.period || '').split(' ')[0];
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });
    
    const processed = sortedHistory.map((item: any) => {
      const rawValue = String(item.value);
      const parsed = parseFloat(rawValue.replace(/[^0-9.-]+/g, '')) || 0;
      
      if (parsed > 1000000) {
        devLog.warn(`[SalesMetricsCards] ⚠️ Valor alto detectado:`, {
          raw: rawValue,
          parsed,
          period: item.period
        });
      }
      
      return { sales: parsed, period: item.period };
    });
    
    return processed;
  }, [kpiHistory, companyId]);

  // Volumen total del año (YTD)
  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  
  devLog.log(`[SalesMetricsCards] Company ${companyId}: Total YTD = ${totalSales.toLocaleString()}, Registros = ${salesData.length}`);

  // ============================================================================
  // CÁLCULO DEL OBJETIVO ANUAL - UNA SOLA FUENTE DE VERDAD
  // ============================================================================
  // Prioridad: 1) annualGoal del KPI, 2) goal mensual * 12, 3) localStorage, 4) default
  // ============================================================================
  
  let calculatedFromKpi: number | null = null;
  
  // Prioridad 1: Usar annualGoal del KPI si existe
  if (salesKpi?.annualGoal) {
    const annualGoal = parseFloat(String(salesKpi.annualGoal).toString().replace(/[^0-9.-]+/g, ''));
    if (!isNaN(annualGoal) && annualGoal > 0) {
      calculatedFromKpi = Math.round(annualGoal);
      devLog.log(`[SalesMetricsCards] ✅ Usando annualGoal del KPI: ${calculatedFromKpi}`);
    }
  }
  
  // Prioridad 2: Calcular desde goal mensual * 12 (solo si no hay annualGoal)
  if (!calculatedFromKpi && salesKpi?.goal) {
    const monthlyGoalFromDb = parseFloat(String(salesKpi.goal).toString().replace(/[^0-9.-]+/g, ''));
    if (!isNaN(monthlyGoalFromDb) && monthlyGoalFromDb > 0) {
      calculatedFromKpi = Math.round(monthlyGoalFromDb * 12);
      devLog.log(`[SalesMetricsCards] ⚠️  Calculando desde goal mensual * 12: ${calculatedFromKpi}`);
    }
  }

  // Validar que el valor calculado desde el KPI sea razonable
  const minReasonableTargetForKpi = companyId === 1 ? 500000 : 8000000;
  const isValidKpiTarget = calculatedFromKpi && calculatedFromKpi >= minReasonableTargetForKpi;
  const kpiTargetToUse = isValidKpiTarget ? calculatedFromKpi : null;

  // Prioridad 3: localStorage (solo si no hay annualGoal del KPI válido)
  let storedTargetNumeric: number | null = null;
  
  if (!salesKpi?.annualGoal) {
    const salesTargetsStored = localStorage.getItem('salesTargets');
    if (salesTargetsStored) {
      try {
        const targets = JSON.parse(salesTargetsStored);
        if (targets[companyId]?.annualTarget) {
          storedTargetNumeric = parseInt(String(targets[companyId].annualTarget), 10);
        }
      } catch (e) {
        devLog.warn('[SalesMetricsCards] Error parsing salesTargets:', e);
      }
    }
    
    // Si no está en salesTargets, intentar con duraAnnualTarget/orsegaAnnualTarget
    if (!storedTargetNumeric || isNaN(storedTargetNumeric) || storedTargetNumeric <= 0) {
      const legacyTarget = companyId === 1 
        ? localStorage.getItem('duraAnnualTarget')
        : localStorage.getItem('orsegaAnnualTarget');
      
      if (legacyTarget) {
        storedTargetNumeric = parseInt(legacyTarget, 10);
      }
    }
  }

  // Determinar el objetivo final
  const rawTarget = kpiTargetToUse && kpiTargetToUse > 0
    ? kpiTargetToUse
    : (storedTargetNumeric && !isNaN(storedTargetNumeric) && storedTargetNumeric > 0
      ? storedTargetNumeric
      : (companyId === 1 ? defaultAnnualTargets.dura : defaultAnnualTargets.orsega));
  
  // Validación: si el objetivo es sospechosamente bajo Y no tenemos annualGoal del KPI, usar default
  const minReasonableTarget = companyId === 1 ? 500000 : 8000000;
  const defaultTarget = companyId === 1 ? defaultAnnualTargets.dura : defaultAnnualTargets.orsega;
  const hasAnnualGoalFromKpi = salesKpi?.annualGoal && isValidKpiTarget;
  const isTargetSuspiciouslyLow = !hasAnnualGoalFromKpi && (
    rawTarget < minReasonableTarget || 
    (totalSales > 0 && totalSales > rawTarget * 2)
  );
  
  // Usar el valor por defecto solo si el objetivo es sospechosamente bajo Y no tenemos annualGoal del KPI
  const totalTarget = (isTargetSuspiciouslyLow && !hasAnnualGoalFromKpi) ? defaultTarget : rawTarget;
  
  // Limpiar localStorage si detectamos un objetivo incorrecto
  if (isTargetSuspiciouslyLow && !hasAnnualGoalFromKpi) {
    devLog.warn(`[SalesMetricsCards] ⚠️ Objetivo bajo (${rawTarget}), usando default (${totalTarget})`);
    
    if (companyId === 1) {
      localStorage.removeItem('duraAnnualTarget');
    } else {
      localStorage.removeItem('orsegaAnnualTarget');
    }
    
    try {
      const salesTargetsStored = localStorage.getItem('salesTargets');
      if (salesTargetsStored) {
        const targets = JSON.parse(salesTargetsStored);
        delete targets[companyId];
        localStorage.setItem('salesTargets', JSON.stringify(targets));
      }
    } catch (e) {
      devLog.warn('[SalesMetricsCards] Error al limpiar salesTargets:', e);
    }
  }

  // Calcular métricas
  const compliancePercentage = totalTarget > 0 ? Math.round((totalSales / totalTarget) * 100) : 0;
  const monthlyTarget = totalTarget > 0 ? Math.round(totalTarget / 12) : 0;
  
  // Log para debugging
  devLog.log(`[SalesMetricsCards] Objetivo anual - Company ${companyId}:`, {
    'annualGoal del KPI': salesKpi?.annualGoal || 'No hay',
    calculatedFromKpi: calculatedFromKpi || 'No hay',
    isValidKpiTarget,
    storedTargetNumeric: storedTargetNumeric || 'No hay',
    rawTarget,
    isTargetSuspiciouslyLow,
    hasAnnualGoalFromKpi,
    finalTarget: totalTarget,
    monthlyTarget,
    totalSales: totalSales.toLocaleString(),
    compliancePercentage: `${compliancePercentage}%`
  });

  // Alerta si el porcentaje es sospechosamente alto
  if (companyId === 2 && totalTarget > 0 && compliancePercentage > 300) {
    devLog.error(`🚨 [SalesMetricsCards] PROBLEMA DETECTADO - Orsega:`, {
      'Porcentaje anormal': `${compliancePercentage}%`,
      'Total ventas YTD': totalSales.toLocaleString(),
      'Objetivo anual': totalTarget.toLocaleString(),
      'annualGoal del KPI': salesKpi?.annualGoal || 'No hay',
      'Meses con datos': salesData.length
    });
  }

  // Resumen de TODOS los meses del año
  const allYearlyData = useMemo(() => {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthShortNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const currentMonthIndex = new Date().getMonth(); // 0-11
    
    const dataByMonth = new Map<string, { sales: number; period: string }>();
    salesData.forEach(item => {
      const monthName = (item.period || '').split(' ')[0] || '';
      if (monthName) {
        dataByMonth.set(monthName.toLowerCase(), {
          sales: item.sales,
          period: item.period
        });
      }
    });
    
    return monthNames.map((monthName, index) => {
      const monthData = dataByMonth.get(monthName.toLowerCase());
      const sales = monthData?.sales || 0;
      const hasData = !!monthData;
      const isFutureMonth = index > currentMonthIndex;
      
      let compliance = 0;
      if (hasData && monthlyTarget > 0) {
        compliance = Math.round((sales / monthlyTarget) * 100);
      } else if (isFutureMonth) {
        compliance = -1; // Meses futuros
      }
      
      if (compliance > 500) {
        devLog.warn(`[SalesMetricsCards] ⚠️ Compliance alto para ${monthShortNames[index]}:`, {
          sales,
          monthlyTarget,
          compliance
        });
      }
      
      return {
        month: monthShortNames[index],
        fullMonth: monthName,
        sales,
        compliance,
        hasData,
        isFutureMonth,
      };
    });
  }, [salesData, monthlyTarget]);

  const monthlySummary = useMemo(() => allYearlyData, [allYearlyData]);

  // Calcular métricas de meses
  const monthsWithData = allYearlyData.filter(m => m.hasData && !m.isFutureMonth);
  const avgCompliance = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((sum, m) => sum + (m.compliance >= 0 ? m.compliance : 0), 0) / monthsWithData.length)
    : 0;
  
  const monthsOnTarget = allYearlyData.filter(m => m.hasData && m.compliance >= 100 && !m.isFutureMonth).length;
  const totalMonthsWithData = monthsWithData.length;
  const totalPastMonths = allYearlyData.filter(m => !m.isFutureMonth).length;

  // Calcular crecimiento vs mes anterior
  const growthRateData = useMemo(() => {
    const currentMonthIndex = new Date().getMonth();
    
    let lastMonthWithData = null;
    let lastMonthIndex = -1;
    
    for (let i = currentMonthIndex; i >= 0; i--) {
      if (allYearlyData[i]?.hasData) {
        lastMonthWithData = allYearlyData[i];
        lastMonthIndex = i;
        break;
      }
    }
    
    if (!lastMonthWithData || lastMonthIndex === -1 || lastMonthIndex === 0) {
      return { growthRate: '0.0', lastMonthSales: 0, previousMonthSales: 0 };
    }
    
    const previousMonthData = allYearlyData[lastMonthIndex - 1];
    
    if (!previousMonthData.hasData || previousMonthData.sales === 0) {
      return { growthRate: '0.0', lastMonthSales: lastMonthWithData.sales, previousMonthSales: 0 };
    }
    
    const growthRate = ((lastMonthWithData.sales - previousMonthData.sales) / previousMonthData.sales) * 100;
    
    return {
      growthRate: growthRate.toFixed(1),
      lastMonthSales: lastMonthWithData.sales,
      previousMonthSales: previousMonthData.sales
    };
  }, [allYearlyData]);

  const growthRate = growthRateData.growthRate;
  const previousMonthSales = growthRateData.previousMonthSales;
  const previousMonthPercentage = totalTarget > 0 && previousMonthSales > 0
    ? Math.round((previousMonthSales / totalTarget) * 100) 
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
            <div className={`flex items-center ${parseFloat(growthRate) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {parseFloat(growthRate) >= 0 ? (
                <ArrowUp className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDown className="h-4 w-4 mr-1" />
              )}
              <span className="text-sm font-medium">
                {parseFloat(growthRate) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(growthRate))}% vs mes anterior
              </span>
            </div>
          </div>
        </div>

        {/* Barra de progreso del objetivo anual */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">Avance del Objetivo Anual</span>
            <span className="text-[10px] font-semibold text-muted-foreground bg-card/95 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border/50 whitespace-nowrap">
              {formatNumber(totalTarget).replace(' unidades', '').replace(' KG', '')}
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

        {/* Resumen del año */}
        {monthlySummary.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs font-semibold text-foreground mb-3">Resumen del año</p>
          
            {/* Gráfico de barras */}
            <div className="flex items-end justify-between gap-1.5 mb-4" style={{ height: '60px' }}>
              {monthlySummary.map((month, idx) => {
                let backgroundColor = '#e5e7eb';
                let opacity = 0.5;
                let heightPercent = 0;
                
                if (month.isFutureMonth) {
                  backgroundColor = '#f3f4f6';
                  opacity = 0.3;
                  heightPercent = 10;
                } else if (!month.hasData) {
                  backgroundColor = '#ef4444';
                  opacity = 0.4;
                  heightPercent = 15;
                } else if (month.compliance >= 100) {
                  backgroundColor = '#22c55e';
                  opacity = 0.9;
                  heightPercent = Math.min((month.compliance / 150) * 100, 100);
                } else if (month.compliance >= 75) {
                  backgroundColor = '#eab308';
                  opacity = 0.8;
                  heightPercent = Math.min((month.compliance / 150) * 100, 100);
                } else {
                  backgroundColor = '#ef4444';
                  opacity = 0.8;
                  heightPercent = Math.min((month.compliance / 150) * 100, 100);
                }
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <div 
                      className="w-full rounded-t transition-all duration-300"
                      style={{
                        height: `${Math.max(heightPercent, 4)}%`,
                        backgroundColor,
                        opacity,
                        minHeight: '4px'
                      }}
                      title={`${month.fullMonth}: ${month.hasData ? `${month.sales.toLocaleString()} (${month.compliance}%)` : 'Sin datos'}`}
                    />
                    <div className={`text-xs font-medium ${month.isFutureMonth ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {month.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Métricas clave */}
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
                  <div className="text-base font-bold text-green-600">{monthsOnTarget}/{totalMonthsWithData > 0 ? totalMonthsWithData : totalPastMonths}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
