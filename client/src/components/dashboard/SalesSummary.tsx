import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend, ReferenceLine, Label } from "recharts";
import { TrendingUp, BarChart2, BarChart as BarChartIcon, Award, ArrowUp, ArrowDown, Package, CalendarClock } from "lucide-react";
import { SalesVolumeCards } from "@/components/kpis/SalesVolumeCards";
import { apiRequest } from "@/lib/queryClient";

// Componente personalizado para el label del objetivo
const TargetLabel = (props: any) => {
  const { viewBox, value } = props;
  if (!viewBox || !value) return null;
  
  // viewBox puede venir como objeto { x, y, width, height } o como string
  const x = typeof viewBox === 'object' ? viewBox.x : 0;
  const y = typeof viewBox === 'object' ? viewBox.y : 0;
  
  // Calcular el ancho del texto aproximado (7px por caracter)
  const textWidth = value.length * 7;
  const labelWidth = Math.max(textWidth + 16, 120);
  
  return (
    <g>
      <rect
        x={x + 10}
        y={y - 12}
        width={labelWidth}
        height={24}
        fill="rgba(255, 255, 255, 0.98)"
        stroke="hsl(var(--chart-2))"
        strokeWidth={1.5}
        rx={4}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
      />
      <text
        x={x + 18}
        y={y + 5}
        fill="hsl(var(--chart-2))"
        fontSize={12}
        fontWeight={700}
        style={{ textAnchor: 'start', fontFamily: 'system-ui, sans-serif' }}
      >
        {value}
      </text>
    </g>
  );
};

// Interface para las props del componente
interface SalesSummaryProps {
  companyId: number;
}

// Tipos para los datos procesados
interface ProcessedData {
  month: string;
  sales: number;
  target: number;
  profit: number;
  period?: string;
}

export function SalesSummary({ companyId }: SalesSummaryProps) {
  const [currentCompanyId, setCurrentCompanyId] = useState<number>(companyId);
  const [timeView, setTimeView] = useState<'monthly' | 'quarterly'>('monthly');
  const [salesData, setSalesData] = useState<ProcessedData[]>([]);
  
  // Buscar el KPI de Volumen de Ventas por nombre en lugar de ID fijo
  // Esto es más robusto ya que los IDs pueden cambiar entre tablas
  const { data: allKpis } = useQuery<any[]>({
    queryKey: ['/api/kpis', { companyId: currentCompanyId }],
    staleTime: 30 * 1000, // 30 segundos para refrescar más rápido
    refetchOnWindowFocus: true,
  });

  // Encontrar el KPI de Volumen de Ventas por nombre
  const salesKpi = allKpis?.find((kpi: any) => {
    const name = (kpi.kpiName || kpi.name || '').toLowerCase();
    return (name.includes('volumen') && name.includes('ventas')) || 
           name.includes('ventas') || 
           name.includes('sales');
  });

  const kpiId = salesKpi?.id || (currentCompanyId === 1 ? 39 : 1); // Fallback a IDs actualizados
  const unit = currentCompanyId === 1 ? 'KG' : 'unidades';

  // Debug logging
  useEffect(() => {
    if (allKpis && allKpis.length > 0) {
      console.log(`[SalesSummary] Company ${currentCompanyId}: Found ${allKpis.length} KPIs`);
      console.log(`[SalesSummary] Looking for sales KPI. Found:`, salesKpi);
      console.log(`[SalesSummary] Using KPI ID: ${kpiId}`);
    }
  }, [allKpis, salesKpi, kpiId, currentCompanyId]);
  
  // Meta mensual: calcular desde annualGoal del KPI o usar fallback
  // NO usar valores hardcodeados - siempre calcular desde el objetivo anual

  // Cargar datos históricos desde la API (solo si tenemos un kpiId válido)
  // IMPORTANTE: incluir companyId en la query para obtener los datos correctos
  // Usar companyId directamente (prop) en lugar de currentCompanyId (estado) para la query key
  // React Query maneja los cambios de dependencias automáticamente
  const { data: kpiHistory } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12, companyId }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/kpi-history/${kpiId}?months=12&companyId=${companyId}`);
      return await response.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true, // Refrescar cuando la ventana vuelve a estar en foco
    staleTime: 0, // No cachear para asegurar datos frescos después de actualizaciones
    enabled: !!kpiId && kpiId > 0, // Solo ejecutar si tenemos un ID válido
  });

  // Actualizar el estado local cuando cambia la prop
  useEffect(() => {
    setCurrentCompanyId(companyId);
  }, [companyId]);

  // Calcular totalTarget primero (necesario para monthlyTarget)
  const defaultAnnualTargets = {
    dura: 667449,
    orsega: 10300476
  };
  
  // Prioridad 1: Usar annualGoal del KPI si existe
  let totalTarget: number;
  if (salesKpi?.annualGoal) {
    const annualGoal = parseFloat(String(salesKpi.annualGoal).toString().replace(/[^0-9.-]+/g, ''));
    if (!isNaN(annualGoal) && annualGoal > 0) {
      totalTarget = Math.round(annualGoal);
      console.log(`[SalesSummary] ✅ Usando annualGoal del KPI: ${totalTarget}`);
    } else {
      // Fallback a localStorage o default
      const storedTarget = currentCompanyId === 1 
        ? localStorage.getItem('duraAnnualTarget')
        : localStorage.getItem('orsegaAnnualTarget');
      totalTarget = storedTarget 
        ? parseInt(storedTarget, 10) 
        : (currentCompanyId === 1 ? defaultAnnualTargets.dura : defaultAnnualTargets.orsega);
    }
  } else {
    // Prioridad 2: localStorage
    const storedTarget = currentCompanyId === 1 
      ? localStorage.getItem('duraAnnualTarget')
      : localStorage.getItem('orsegaAnnualTarget');
    totalTarget = storedTarget 
      ? parseInt(storedTarget, 10) 
      : (currentCompanyId === 1 ? defaultAnnualTargets.dura : defaultAnnualTargets.orsega);
  }
  
  // Calcular meta mensual desde el objetivo anual (NO hardcodeado)
  // Esto es crítico: el monthlyTarget debe calcularse desde totalTarget, no ser hardcodeado
  const monthlyTarget = totalTarget > 0 ? Math.round(totalTarget / 12) : (currentCompanyId === 1 ? 55620 : 858373);

  // Procesar datos cuando llegan de la API
  useEffect(() => {
    console.log(`[SalesSummary] KPI History for ID ${kpiId}:`, kpiHistory?.length || 0, 'records');
    if (kpiHistory && kpiHistory.length > 0) {
      // Definir orden de meses
      const monthOrder: { [key: string]: number } = {
        'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
        'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
        'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
      };
      
      // Ordenar por nombre del mes extraído del período
      const sortedHistory = [...kpiHistory].sort((a: any, b: any) => {
        const monthA = (a.period || '').split(' ')[0];
        const monthB = (b.period || '').split(' ')[0];
        return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
      });
      
      const processedData: ProcessedData[] = sortedHistory.map((item: any) => {
        const value = parseFloat(item.value) || 0;
        
        // Convertir "Enero 2025" a "Ene 25"
        const periodParts = item.period?.split(' ') || ['', ''];
        const monthMap: { [key: string]: string } = {
          'Enero': 'Ene', 'Febrero': 'Feb', 'Marzo': 'Mar', 'Abril': 'Abr',
          'Mayo': 'May', 'Junio': 'Jun', 'Julio': 'Jul', 'Agosto': 'Ago',
          'Septiembre': 'Sep', 'Octubre': 'Oct', 'Noviembre': 'Nov', 'Diciembre': 'Dic'
        };
        const shortMonth = monthMap[periodParts[0]] || periodParts[0];
        const shortYear = periodParts[1]?.slice(-2) || '';
        const shortPeriod = `${shortMonth} ${shortYear}`;

        return {
          month: shortPeriod,
          sales: value,
          target: monthlyTarget,
          profit: Math.round(value * 0.12), // 12% profit margin
          period: item.period
        };
      });

      // Agrupar por trimestres si es necesario
      if (timeView === 'quarterly') {
        const quarters: Record<string, ProcessedData> = {};
        
        processedData.forEach(item => {
          const year = item.month.slice(-2);
          const monthName = item.month.slice(0, 3);
          
          let quarter = '';
          if (['Ene', 'Feb', 'Mar'].includes(monthName)) quarter = 'Q1';
          else if (['Abr', 'May', 'Jun'].includes(monthName)) quarter = 'Q2';
          else if (['Jul', 'Ago', 'Sep'].includes(monthName)) quarter = 'Q3';
          else quarter = 'Q4';
          
          const quarterKey = `${quarter} ${year}`;
          
          if (!quarters[quarterKey]) {
            quarters[quarterKey] = {
              month: quarterKey,
              sales: 0,
              target: 0,
              profit: 0,
              period: quarterKey
            };
          }
          
          quarters[quarterKey].sales += item.sales;
          quarters[quarterKey].target += item.target;
          quarters[quarterKey].profit += item.profit;
        });
        
        setSalesData(Object.values(quarters));
      } else {
        setSalesData(processedData);
      }
    }
  }, [kpiHistory, timeView, currentCompanyId, monthlyTarget]);

  // Calcular totales
  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  const compliancePercentage = Math.round((totalSales / totalTarget) * 100);
  
  console.log(`[SalesSummary] Objetivos calculados - Company ${currentCompanyId}:`, {
    'annualGoal del KPI': salesKpi?.annualGoal || 'No hay',
    totalTarget: totalTarget.toLocaleString(),
    monthlyTarget: monthlyTarget.toLocaleString(),
    totalSales: totalSales.toLocaleString(),
    compliancePercentage: `${compliancePercentage}%`
  });

  // Crecimiento del último mes
  const getGrowthRate = () => {
    if (salesData.length < 2) return '0.0';
    const lastMonth = salesData[salesData.length - 1].sales;
    const previousMonth = salesData[salesData.length - 2].sales;
    if (previousMonth === 0) return '0.0';
    const growthRate = ((lastMonth - previousMonth) / previousMonth) * 100;
    return growthRate.toFixed(1);
  };

  const growthRate = getGrowthRate();

  // Formatear número con separadores de miles
  const formatNumber = (value: number) => {
    if (currentCompanyId === 1) {
      return new Intl.NumberFormat('es-MX').format(value) + " KG";
    } else {
      return new Intl.NumberFormat('es-MX').format(value) + " unidades";
    }
  };

  // Determinar el logo de la empresa según companyId
  const getCompanyLogo = () => {
    if (currentCompanyId === 1) {
      return '/logodura.jpg';
    } else if (currentCompanyId === 2) {
      return '/logo orsega.jpg';
    }
    return null;
  };

  const companyLogo = getCompanyLogo();

  return (
    <div className="space-y-6">
      {/* Cards de indicadores clave */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
        {/* Volumen Total */}
        <Card className="h-full">
          <CardHeader className="pb-3 pt-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-medium">Volumen Total</CardTitle>
                <CardDescription>
                  Acumulado anual ({currentCompanyId === 1 ? 'KG' : 'unidades'})
                </CardDescription>
              </div>
              <div className="p-2 bg-primary/15 rounded-lg">
                <BarChart2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="text-3xl font-bold mb-2">
              {formatNumber(totalSales)}
            </div>
            <div className="flex items-center mb-4">
              <div className="flex items-center text-success mr-2">
                <ArrowUp className="h-4 w-4 mr-1" />
                <span className="text-sm font-medium">{growthRate}%</span>
              </div>
              <div className="text-sm text-muted-foreground">vs mes anterior</div>
            </div>
            <div className="mt-auto">
              <div className="text-xs text-primary mb-2 flex justify-between">
                <span>Progreso</span>
                <span className="font-medium">{compliancePercentage}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${compliancePercentage > 100 ? 100 : compliancePercentage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nivel de Cumplimiento */}
        <Card className="h-full">
          <CardHeader className="pb-3 pt-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-medium">Avance del Objetivo Anual</CardTitle>
                <CardDescription>Progreso hacia meta anual</CardDescription>
              </div>
              <div className="p-2 bg-warning/15 rounded-lg">
                <Award className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex items-center mb-2">
              <div className="text-3xl font-bold">
                {compliancePercentage}%
              </div>
              <div className="ml-3 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/20 text-warning">
                {compliancePercentage >= 100 ? '¡Meta cumplida!' : 
                 compliancePercentage >= 75 ? 'Buen progreso' :
                 compliancePercentage >= 50 ? 'Progreso medio' : 'Requiere atención'}
              </div>
            </div>
            
            <div className="space-y-3 mt-2 mb-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Ventas actuales:</span><br />
                  <span className="text-xs">{formatNumber(totalSales)}</span>
                </div>
                <div className="text-sm text-muted-foreground text-right">
                  <span className="font-medium">Meta anual:</span><br />
                  <span className="text-xs">{formatNumber(totalTarget)}</span>
                </div>
              </div>
              
              <div className="border-t border-border pt-2">
                <div className="flex items-center justify-center gap-2 px-3 py-2 bg-warning/15 rounded-md">
                  <CalendarClock className="h-4 w-4 text-warning" />
                  <div className="text-center">
                    <div className="text-xs text-warning font-medium">Meta mensual</div>
                    <div className="text-sm font-bold">{formatNumber(monthlyTarget)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-auto">
              <div className="text-xs text-warning mb-2 flex justify-between">
                <span>Progreso</span>
                <span className="font-medium">{compliancePercentage}%</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full flex items-center justify-end pr-2 text-xs font-bold transition-all duration-500 ${
                    compliancePercentage >= 100 ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'
                  }`}
                  style={{ width: `${compliancePercentage > 100 ? 100 : compliancePercentage}%` }}
                >
                  {compliancePercentage >= 20 ? `${compliancePercentage}%` : ''}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarjetas mensuales */}
      <div className="mt-6 mb-8">
        <SalesVolumeCards 
          companyId={currentCompanyId} 
          title="Volumen de Ventas"
          subtitle="Visualización histórica y tendencias de ventas"
        />
      </div>
      
      {/* Gráfica histórica */}
      <Card className="mt-8 relative">
        {/* Logo de la empresa en la esquina superior derecha */}
        {companyLogo && (
          <div className="absolute top-4 right-4 z-10 opacity-60 hover:opacity-80 transition-opacity">
            <img 
              src={companyLogo} 
              alt={currentCompanyId === 1 ? 'Dura International Logo' : 'Grupo Orsega Logo'}
              className="h-16 w-auto object-contain"
              style={{ maxWidth: '150px' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">
                Volumen de Ventas Histórico - Vista Completa
              </CardTitle>
              <CardDescription>
                Evolución histórica del volumen de ventas ({currentCompanyId === 1 ? 'KG' : 'Unidades'})
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <ToggleGroup type="single" value={timeView} onValueChange={(value) => value && setTimeView(value as 'monthly' | 'quarterly')}>
                <ToggleGroupItem 
                  value="monthly" 
                  aria-label="Mensual"
                  className={`px-3 h-8 text-xs ${timeView === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  Mensual
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="quarterly" 
                  aria-label="Trimestral"
                  className={`px-3 h-8 text-xs ${timeView === 'quarterly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  Trimestral
                </ToggleGroupItem>
              </ToggleGroup>
              <BarChartIcon className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesData} margin={{ top: 20, right: 120, left: 20, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                  </linearGradient>
                  <linearGradient id="colorSalesBelow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4}/>
                  </linearGradient>
                  <filter id="shadow" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="hsl(var(--chart-1))" floodOpacity="0.3"/>
                  </filter>
                  <filter id="shadowRed" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="hsl(var(--chart-4))" floodOpacity="0.3"/>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  axisLine={{ stroke: "hsl(var(--chart-axis))", opacity: 0.5 }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  axisLine={{ stroke: "hsl(var(--chart-axis))", opacity: 0.5 }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                    color: "hsl(var(--foreground))"
                  }}
                  formatter={(value: any) => new Intl.NumberFormat('es-MX').format(value)}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar 
                  dataKey="sales" 
                  name="Volumen"
                  radius={[8, 8, 0, 0]}
                  shape={(props: any) => {
                    const { fill, x, y, width, height, payload } = props;
                    const isBelowTarget = payload.sales < payload.target;
                    const fillColor = isBelowTarget ? "url(#colorSalesBelow)" : "url(#colorSales)";
                    const filterStyle = isBelowTarget ? "url(#shadowRed)" : "url(#shadow)";
                    
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={fillColor}
                        filter={filterStyle}
                        rx={8}
                        ry={8}
                      />
                    );
                  }}
                />
                <ReferenceLine
                  y={monthlyTarget}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.9}
                  label={{
                    value: `${new Intl.NumberFormat('es-MX').format(monthlyTarget)} ${unit}`,
                    position: 'right',
                    fill: 'hsl(var(--chart-2))',
                    fontSize: 12,
                    fontWeight: 700,
                    offset: 5,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
