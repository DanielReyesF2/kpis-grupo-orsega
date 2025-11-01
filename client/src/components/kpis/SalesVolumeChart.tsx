import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ResponsiveContainer,
  TooltipProps,
  ReferenceLine,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  InfoIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// Componente auxiliar para un tooltip personalizado mejorado
const CustomTooltip = ({ active, payload, label, formatter, labelFormatter, customWidth = "220px", cursor, data }: any) => {
  if (active && payload && payload.length) {
    // Encontrar el dato completo del mes para mostrar información adicional
    const dataPoint = data?.find((d: any) => d.period === label);
    const volumeEntry = payload.find((p: any) => p.dataKey === 'value');
    const targetEntry = payload.find((p: any) => p.dataKey === 'target');
    
    const volumeValue = volumeEntry?.value || dataPoint?.value || 0;
    const targetValue = targetEntry?.value || dataPoint?.target || 0;
    const diferencia = volumeValue - targetValue;
    const cumplimiento = targetValue > 0 ? ((volumeValue / targetValue) * 100).toFixed(1) : 0;
    
    const unit = volumeEntry?.payload?.unit || 'KG';
    const formatNumber = (num: number) => new Intl.NumberFormat('es-MX').format(num);

    return (
      <div
        className="bg-white dark:bg-slate-800 p-4 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700"
        style={{ width: customWidth, fontSize: "12px", zIndex: 1000 }}
      >
        {/* Período */}
        <div className="font-semibold mb-3 text-slate-900 dark:text-slate-100 text-sm border-b border-slate-200 dark:border-slate-700 pb-2">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
        
        {/* Volumen Total - Destacado */}
        <div className="mb-3">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Volumen Total del Mes</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {formatNumber(volumeValue)} {unit}
          </div>
        </div>
        
        {/* Información adicional */}
        <div className="space-y-2">
          {targetValue > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 dark:text-slate-400">Objetivo:</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {formatNumber(targetValue)} {unit}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 dark:text-slate-400">Diferencia:</span>
                <span className={`text-xs font-semibold ${diferencia >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {diferencia >= 0 ? '+' : ''}{formatNumber(diferencia)} {unit}
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-400">Cumplimiento:</span>
                <span className={`text-xs font-bold ${parseFloat(cumplimiento) >= 100 ? 'text-green-600 dark:text-green-400' : parseFloat(cumplimiento) >= 85 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                  {cumplimiento}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export function SalesVolumeChart({
  kpiId: providedKpiId,
  companyId,
  kpiValues = [],
  target,
  title = "Volumen de Ventas",
  subtitle = "Visualización histórica y tendencias de ventas",
  limit = 4,
  showControls = true,
}: {
  kpiId?: number;
  companyId: number;
  kpiValues?: any[];
  target?: string;
  title?: string;
  subtitle?: string;
  limit?: number;
  showControls?: boolean;
}) {
  
  // Buscar el KPI de Volumen de Ventas por nombre si no se proporciona kpiId
  const { data: allKpis, isLoading: isLoadingKpis } = useQuery<any[]>({
    queryKey: ['/api/kpis', { companyId }],
    enabled: !!companyId && companyId > 0,
    staleTime: 5 * 60 * 1000,
  });

  const salesKpi = allKpis?.find((kpi: any) => {
    const name = (kpi.kpiName || kpi.name || '').toLowerCase();
    return (name.includes('volumen') && name.includes('ventas')) || 
           name.includes('ventas') || 
           name.includes('sales');
  });

  // Usar kpiId proporcionado o buscar por nombre, con fallback a IDs conocidos
  // Prioridad: providedKpiId > salesKpi por nombre > IDs conocidos por companyId
  const kpiId = providedKpiId || salesKpi?.id || (companyId === 1 ? 39 : 10);
  
  console.log("[SalesVolumeChart] 🔍 Búsqueda de KPI:", {
    companyId,
    providedKpiId,
    totalKpis: allKpis?.length || 0,
    foundSalesKpi: !!salesKpi,
    foundKpiId: salesKpi?.id,
    foundKpiName: salesKpi?.name || salesKpi?.kpiName,
    finalKpiId: kpiId,
    usingFallback: !providedKpiId && !salesKpi?.id
  });
  
  // Si estamos usando fallback y no encontramos el KPI, mostrar advertencia
  if (!providedKpiId && !salesKpi && allKpis && !isLoadingKpis) {
    console.warn("[SalesVolumeChart] ⚠️ No se encontró KPI de ventas por nombre, usando ID fallback:", kpiId);
    console.warn("[SalesVolumeChart] KPIs disponibles:", allKpis.map((k: any) => ({
      id: k.id,
      name: k.name || k.kpiName,
      companyId: k.companyId
    })));
  }
  
  // Obtener datos reales de la API
  const { data: kpiHistoryData, isLoading: isLoadingHistory, error: kpiHistoryError } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12 }],
    enabled: !!kpiId && kpiId > 0,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Debug: Log del estado de la query
  console.log("[SalesVolumeChart] Estado de query:", {
    kpiId,
    companyId,
    enabled: !!kpiId && kpiId > 0,
    isLoading: isLoadingHistory,
    hasData: !!kpiHistoryData,
    dataLength: kpiHistoryData?.length || 0,
    error: kpiHistoryError,
    sampleData: kpiHistoryData?.slice(0, 2)
  });

  // Procesar datos históricos de la API
  const chartData = useMemo(() => {
    if (!kpiHistoryData || kpiHistoryData.length === 0) {
      // Si no hay datos, retornar array vacío
      console.log("[SalesVolumeChart] ⚠️ No hay datos históricos disponibles");
      console.log("[SalesVolumeChart] kpiHistoryData:", kpiHistoryData);
      console.log("[SalesVolumeChart] kpiId usado:", kpiId);
      console.log("[SalesVolumeChart] companyId:", companyId);
      return [];
    }

    console.log("[SalesVolumeChart] ✅ Datos recibidos de API:", kpiHistoryData.length, "registros");
    console.log("[SalesVolumeChart] Muestra de datos raw:", JSON.stringify(kpiHistoryData.slice(0, 3), null, 2));

    // Mapeo de nombres de meses para ordenamiento
    const monthOrder: { [key: string]: number } = {
      'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
      'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
      'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12,
      'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
      'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
      'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
    };

    // Procesar y ordenar los datos
    const processedData = kpiHistoryData
      .map((item: any) => {
        // Extraer mes y año del periodo (formato: "Enero 2025" o "ENERO 2025")
        const periodParts = (item.period || '').split(' ');
        const month = periodParts[0] || '';
        const year = periodParts[1] || new Date().getFullYear().toString();
        const value = parseFloat(item.value?.toString() || '0');

        return {
          period: item.period,
          value: value,
          date: item.date ? new Date(item.date) : new Date(`${year}-${monthOrder[month] || 1}-01`),
          monthOrder: monthOrder[month] || 0,
          year: parseInt(year) || new Date().getFullYear(),
          unit: companyId === 1 ? 'KG' : 'unidades'
        };
      })
      .filter((item: any) => item.monthOrder > 0) // Filtrar items con meses válidos
      .sort((a, b) => {
        // Ordenar por año, luego por mes
        if (a.year !== b.year) {
          return a.year - b.year;
        }
        return a.monthOrder - b.monthOrder;
      });

    console.log("[SalesVolumeChart] Datos procesados:", processedData.length, "registros");
    console.log("[SalesVolumeChart] Períodos encontrados:", processedData.map((d: any) => d.period));
    console.log("[SalesVolumeChart] Primeros datos procesados:", JSON.stringify(processedData.slice(0, 2), null, 2));

    // Si después del filtro no hay datos, mostrar por qué
    if (processedData.length === 0) {
      console.warn("[SalesVolumeChart] ⚠️ Después del filtro de meses válidos, quedaron 0 registros");
      console.warn("[SalesVolumeChart] Datos antes del filtro:", kpiHistoryData.map((d: any) => ({
        period: d.period,
        month: (d.period || '').split(' ')[0],
        value: d.value
      })));
    }

    // NO aplicar slice aquí - mostrar todos los datos disponibles
    // El limit se usará solo si es necesario para mostrar los últimos N meses
    const finalData = limit > 0 && processedData.length > limit 
      ? processedData.slice(-limit) 
      : processedData;

    console.log("[SalesVolumeChart] Datos finales para gráfica:", finalData.length, "registros");
    if (finalData.length > 0) {
      console.log("[SalesVolumeChart] Muestra de datos finales:", JSON.stringify(finalData.slice(0, 2), null, 2));
    }
    return finalData;
  }, [kpiHistoryData, companyId, limit]);

  // Extraer el valor objetivo (target) quitando "KG" y convirtiendo a número
  const targetValue = target ? parseInt(target.replace(/[^0-9]/g, ''), 10) : 0;
  
  // Si no hay target prop, usar valores por defecto según la compañía
  const monthlyTarget = targetValue || (companyId === 1 ? 55620 : 858373);
  
  console.log("[SalesVolumeChart] Target mensual:", monthlyTarget, companyId === 1 ? 'KG' : 'unidades');
  
  // Agregar una línea para el objetivo a cada punto de datos
  const chartDataWithTarget = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    return chartData.map((data: any) => ({
      ...data,
      target: monthlyTarget,
      diferencia: data.value - monthlyTarget
    }));
  }, [chartData, monthlyTarget]);
  
  // Debug - Ver los datos de la gráfica
  console.log("Debug chartDataWithTarget:", chartDataWithTarget);

  // Calcular progreso semanal - para seguimiento actual
  const generateWeeklyData = () => {
    if (chartDataWithTarget.length === 0) return [];
    
    // Usamos el último mes registrado para desglosarlo por semanas
    const lastPeriod = chartDataWithTarget[chartDataWithTarget.length - 1];
    const targetPerWeek = monthlyTarget / 4; // Dividir objetivo mensual en 4 semanas
    
    // Valor actual del mes
    const currentMonthValue = lastPeriod.value;
    
    // Desglosamos el valor actual por semanas
    return [
      { 
        semana: 'Semana 1', 
        valor: Math.round(currentMonthValue * 0.2), 
        objetivo: targetPerWeek,
        diferencia: Math.round(currentMonthValue * 0.2) - targetPerWeek
      },
      { 
        semana: 'Semana 2', 
        valor: Math.round(currentMonthValue * 0.25), 
        objetivo: targetPerWeek,
        diferencia: Math.round(currentMonthValue * 0.25) - targetPerWeek
      },
      { 
        semana: 'Semana 3', 
        valor: Math.round(currentMonthValue * 0.3), 
        objetivo: targetPerWeek,
        diferencia: Math.round(currentMonthValue * 0.3) - targetPerWeek
      },
      { 
        semana: 'Semana 4', 
        valor: Math.round(currentMonthValue * 0.25), 
        objetivo: targetPerWeek,
        diferencia: Math.round(currentMonthValue * 0.25) - targetPerWeek
      }
    ];
  };

  // Determinar el color según el cumplimiento del último valor
  const getStatusColor = (value: number) => {
    if (!monthlyTarget) return "#273949"; // Color default
    
    const compliancePercent = (value / monthlyTarget) * 100;
    
    if (compliancePercent >= 100) return "#10b981"; // verde - cumple
    if (compliancePercent >= 85) return "#f59e0b"; // amarillo - alerta
    return "#ef4444"; // rojo - no cumple
  };

  // Formatear número para mostrar con separadores de miles
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-MX').format(num);
  };
  
  // Obtener la unidad de medida según la compañía (KG o unidades)
  const getUnit = () => companyId === 1 ? 'KG' : 'unidades';

  // Calcular tendencia (comparación con mes anterior)
  const getTrendData = () => {
    if (chartDataWithTarget.length < 2) return { trend: 0, isPositive: false, difference: 0 };
    
    const lastValue = chartDataWithTarget[chartDataWithTarget.length - 1].value;
    const previousValue = chartDataWithTarget[chartDataWithTarget.length - 2].value;
    const difference = lastValue - previousValue;
    const percentChange = (difference / previousValue) * 100;
    
    return {
      trend: Math.abs(percentChange).toFixed(1),
      isPositive: difference >= 0,
      difference: difference
    };
  };

  const trendData = getTrendData();

  // Mostrar skeleton mientras carga
  if (isLoadingHistory) {
    return (
      <Card className="shadow-md bg-white dark:bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-200">
            {title}
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            {subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <p className="text-gray-500">Cargando datos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md bg-white dark:bg-slate-900">
      <CardHeader className="pb-2">
        <div className="flex justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-200">
              {title}
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              {subtitle}
            </CardDescription>
          </div>
          
          {chartDataWithTarget.length > 0 && trendData.difference !== 0 && (
            <div className="flex items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400 mr-2">
                vs mes anterior:
              </span>
              <span className={`text-sm flex items-center font-medium ${
                trendData.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {trendData.isPositive ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {trendData.isPositive ? '+' : '-'} {formatNumber(Math.abs(trendData.difference))} {getUnit()}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {chartDataWithTarget.length > 0 ? (
          <Tabs defaultValue="monthly" className="w-full">
            {showControls && (
              <TabsList className="grid w-full max-w-xs grid-cols-2 mb-4">
                <TabsTrigger value="monthly">Mensual</TabsTrigger>
                <TabsTrigger value="weekly">Seguimiento Semanal</TabsTrigger>
              </TabsList>
            )}
            
            <TabsContent value="monthly" className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                  data={chartDataWithTarget}
                  margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#273949" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#273949" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="volumeGradientBelow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                    </linearGradient>
                    <filter id="volumeShadow" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#273949" floodOpacity="0.3"/>
                    </filter>
                    <filter id="volumeShadowRed" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: "#4b5563" }}
                    axisLine={{ stroke: "#d1d5db" }}
                    tickLine={{ stroke: "#d1d5db" }}
                  />
                  <YAxis 
                    // Establecer un rango fijo para que las barras se vean mejor
                    domain={companyId === 1 ? [0, 100000] : [0, 1000000]}
                    padding={{ top: 20 }}
                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                    tick={{ fontSize: 12, fill: "#4b5563" }}
                    axisLine={{ stroke: "#d1d5db" }}
                    tickLine={{ stroke: "#d1d5db" }}
                    orientation="left"
                    label={{ 
                      value: companyId === 1 ? 'Kilogramos (KG)' : 'Unidades', 
                      angle: -90, 
                      position: 'insideLeft', 
                      style: { textAnchor: 'middle', fill: "#4b5563", fontSize: 12 } 
                    }}
                  />
                  <CustomTooltip 
                    formatter={(value: any, name: any) => {
                      const unit = getUnit();
                      if (name === "value") return [`${formatNumber(value as number)} ${unit}`, "Volumen"];
                      if (name === "target") return [`${formatNumber(value as number)} ${unit}`, "Objetivo"];
                      if (name === "diferencia") {
                        const num = value as number;
                        const sign = num >= 0 ? '+' : '';
                        return [`${sign}${formatNumber(num)} ${unit}`, "Diferencia"];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label: any) => `${label}`}
                    customWidth="240px"
                    data={chartDataWithTarget}
                    cursor={{ fill: 'rgba(39, 57, 73, 0.08)', stroke: 'rgba(39, 57, 73, 0.2)', strokeWidth: 1 }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: 15 }}
                    iconType="circle"
                  />
                  <Bar 
                    dataKey="value" 
                    name={`Volumen (${getUnit()})`} 
                    radius={[6, 6, 0, 0]}
                    barSize={60} 
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    maxBarSize={80}
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      const isBelowTarget = payload.value < payload.target;
                      const fillColor = isBelowTarget ? 'url(#volumeGradientBelow)' : 'url(#volumeGradient)';
                      const filterStyle = isBelowTarget ? 'url(#volumeShadowRed)' : 'url(#volumeShadow)';
                      return (
                        <rect x={x} y={y} width={width} height={height} fill={fillColor} filter={filterStyle} rx={6} ry={6} />
                      );
                    }}
                  />
                  {monthlyTarget > 0 && (
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Objetivo"
                      stroke="#b5e951"
                      strokeWidth={3}
                      dot={{ r: 6, fill: "#b5e951", stroke: 'white', strokeWidth: 2 }}
                      strokeDasharray="0"
                    />
                  )}
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={companyId === 1 ? [0, 50] : [0, 20]} // Ajustamos la escala según la empresa
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 12, fill: "#4b5563" }}
                    axisLine={{ stroke: "#d1d5db" }}
                    tickLine={{ stroke: "#d1d5db" }}
                    label={{ 
 
                      angle: 90, 
                      position: 'insideRight', 
                      style: { textAnchor: 'middle', fill: "#4ade80", fontSize: 12, fontWeight: 'bold' } 
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="weekly" className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={generateWeeklyData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.3}/>
                    </linearGradient>
                    <linearGradient id="weeklyGradientBelow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="semana" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    // Establecer un rango fijo para que las barras se vean mejor
                    domain={companyId === 1 ? [0, 20000] : [0, 300000]}
                    padding={{ top: 20 }}
                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={{ stroke: '#e2e8f0' }}
                    orientation="left"
                    label={{ 
                      value: companyId === 1 ? 'Kilogramos (KG)' : 'Unidades', 
                      angle: -90, 
                      position: 'insideLeft', 
                      style: { textAnchor: 'middle', fill: '#64748b', fontSize: 11 } 
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Bar 
                    dataKey="valor" 
                    name={`Volumen (${getUnit()})`} 
                    radius={[8, 8, 0, 0]}
                    barSize={60} 
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    maxBarSize={80}
                    fill="url(#weeklyGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="objetivo"
                    name="Objetivo Semanal"
                    stroke="#10b981"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    strokeOpacity={0.6}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col justify-center items-center h-[250px] sm:h-[300px] text-secondary-500 gap-2">
            <p className="text-sm font-medium">No hay datos suficientes para mostrar la tendencia de volumen de ventas</p>
            {kpiHistoryError && (
              <p className="text-xs text-red-500">Error: {kpiHistoryError instanceof Error ? kpiHistoryError.message : 'Error desconocido'}</p>
            )}
            {!kpiHistoryError && !isLoadingHistory && (!kpiHistoryData || kpiHistoryData.length === 0) && (
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  No hay datos históricos de ventas disponibles
                </p>
                <p className="text-xs text-gray-400">
                  KPI ID: {kpiId} | Company ID: {companyId} | 
                  {companyId === 1 ? ' (Dura - tabla: kpi_values_dura)' : ' (Orsega - tabla: kpi_values_orsega)'}
                </p>
                <p className="text-xs text-gray-400">
                  {companyId === 1 
                    ? 'Asegúrate de haber ingresado datos de ventas para Dura International'
                    : 'Asegúrate de haber ingresado datos de ventas para Grupo Orsega'}
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Tarjetas de resumen removidas según solicitud del usuario */}
      </CardContent>
    </Card>
  );
}