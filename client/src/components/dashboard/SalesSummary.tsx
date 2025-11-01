import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from "recharts";
import { TrendingUp, BarChart2, BarChart as BarChartIcon, Award, ArrowUp, ArrowDown, Package, CalendarClock } from "lucide-react";
import { SalesVolumeCards } from "@/components/kpis/SalesVolumeCards";

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
    staleTime: 5 * 60 * 1000,
  });

  // Encontrar el KPI de Volumen de Ventas por nombre
  const salesKpi = allKpis?.find((kpi: any) => {
    const name = (kpi.kpiName || kpi.name || '').toLowerCase();
    return (name.includes('volumen') && name.includes('ventas')) || 
           name.includes('ventas') || 
           name.includes('sales');
  });

  const kpiId = salesKpi?.id || (currentCompanyId === 1 ? 39 : 10); // Fallback a IDs antiguos
  const unit = currentCompanyId === 1 ? 'KG' : 'unidades';

  // Debug logging
  useEffect(() => {
    if (allKpis && allKpis.length > 0) {
      console.log(`[SalesSummary] Company ${currentCompanyId}: Found ${allKpis.length} KPIs`);
      console.log(`[SalesSummary] Looking for sales KPI. Found:`, salesKpi);
      console.log(`[SalesSummary] Using KPI ID: ${kpiId}`);
    }
  }, [allKpis, salesKpi, kpiId, currentCompanyId]);
  
  // Meta mensual según la empresa
  const monthlyTarget = currentCompanyId === 1 ? 55620 : 858373;

  // Cargar datos históricos desde la API (solo si tenemos un kpiId válido)
  const { data: kpiHistory } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12 }],
    refetchInterval: 30000,
    enabled: !!kpiId && kpiId > 0, // Solo ejecutar si tenemos un ID válido
  });

  // Actualizar el estado local cuando cambia la prop
  useEffect(() => {
    setCurrentCompanyId(companyId);
  }, [companyId]);

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
  }, [kpiHistory, timeView, currentCompanyId]);

  // Metas anuales
  const defaultAnnualTargets = {
    dura: 667449,
    orsega: 10300476
  };
  
  const duraStoredTarget = localStorage.getItem('duraAnnualTarget');
  const orsegaStoredTarget = localStorage.getItem('orsegaAnnualTarget');
  
  const annualTargets = {
    dura: duraStoredTarget ? parseInt(duraStoredTarget, 10) : defaultAnnualTargets.dura,
    orsega: orsegaStoredTarget ? parseInt(orsegaStoredTarget, 10) : defaultAnnualTargets.orsega
  };

  // Calcular totales
  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  const totalTarget = currentCompanyId === 1 ? annualTargets.dura : annualTargets.orsega;
  const compliancePercentage = Math.round((totalSales / totalTarget) * 100);

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

  return (
    <div className="space-y-6">
      {/* Cards de indicadores clave */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
        {/* Volumen Total */}
        <Card className="border-0 shadow-lg h-full">
          <CardHeader className="pb-3 pt-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-medium">Volumen Total</CardTitle>
                <CardDescription>
                  Acumulado anual ({currentCompanyId === 1 ? 'KG' : 'unidades'})
                </CardDescription>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <BarChart2 className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="text-3xl font-bold mb-2">
              {formatNumber(totalSales)}
            </div>
            <div className="flex items-center mb-4">
              <div className="flex items-center text-emerald-600 mr-2">
                <ArrowUp className="h-4 w-4 mr-1" />
                <span className="text-sm font-medium">{growthRate}%</span>
              </div>
              <div className="text-sm text-muted-foreground">vs mes anterior</div>
            </div>
            <div className="mt-auto">
              <div className="text-xs text-blue-500 mb-2 flex justify-between">
                <span>Progreso</span>
                <span className="font-medium">{compliancePercentage}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${compliancePercentage > 100 ? 100 : compliancePercentage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nivel de Cumplimiento */}
        <Card className="border-0 shadow-lg h-full">
          <CardHeader className="pb-3 pt-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-medium">Avance del Objetivo Anual</CardTitle>
                <CardDescription>Progreso hacia meta anual</CardDescription>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Award className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex items-center mb-2">
              <div className="text-3xl font-bold">
                {compliancePercentage}%
              </div>
              <div className="ml-3 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-500">
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
                <div className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 rounded-md">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  <div className="text-center">
                    <div className="text-xs text-amber-500 font-medium">Meta mensual</div>
                    <div className="text-sm font-bold">{formatNumber(monthlyTarget)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-auto">
              <div className="text-xs text-amber-500 mb-2 flex justify-between">
                <span>Progreso</span>
                <span className="font-medium">{compliancePercentage}%</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full flex items-center justify-end pr-2 text-xs font-bold transition-all duration-500 ${
                    compliancePercentage >= 100 ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
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
      <Card className="border-0 shadow-lg mt-8">
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
                  className={`px-3 h-8 text-xs ${timeView === 'monthly' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Mensual
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="quarterly" 
                  aria-label="Trimestral"
                  className={`px-3 h-8 text-xs ${timeView === 'quarterly' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Trimestral
                </ToggleGroupItem>
              </ToggleGroup>
              <BarChartIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#273949" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#273949" stopOpacity={0.4}/>
                  </linearGradient>
                  <linearGradient id="colorSalesBelow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                  </linearGradient>
                  <filter id="shadow" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#273949" floodOpacity="0.3"/>
                  </filter>
                  <filter id="shadowRed" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.3"/>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: "#4b5563" }} 
                  axisLine={{ stroke: "#d1d5db" }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: "#4b5563" }} 
                  axisLine={{ stroke: "#d1d5db" }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "rgba(255, 255, 255, 0.95)", 
                    border: "none",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
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
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  name="Objetivo"
                  stroke="#b5e951" 
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#b5e951" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
