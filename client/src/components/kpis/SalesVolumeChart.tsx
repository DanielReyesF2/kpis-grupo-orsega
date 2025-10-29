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
  BarChart2,
  Award,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react";

// Componente auxiliar para un tooltip personalizado
const CustomTooltip = ({ active, payload, label, formatter, labelFormatter, customWidth = "150px", cursor }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="bg-white p-3 shadow-lg rounded-md border border-gray-100"
        style={{ width: customWidth, fontSize: "12px" }}
      >
        <div className="font-semibold mb-2 text-gray-700">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
        {payload.map((entry: any, index: number) => {
          if (entry.value === undefined || entry.value === null) return null;
          
          const [formattedValue, formattedName] = formatter
            ? formatter(entry.value, entry.name)
            : [entry.value, entry.name];

          return (
            <div
              key={`tooltip-item-${index}`}
              className="flex justify-between items-center mb-1"
            >
              <span
                className="mr-2 font-medium text-gray-600"
                style={{ color: entry.color }}
              >
                {formattedName}:
              </span>
              <span className="font-bold text-gray-800">
                {formattedValue}
              </span>
            </div>
          );
        })}
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
                    customWidth="180px"
                    cursor={{ fill: 'rgba(39, 57, 73, 0.1)' }}
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
                    fill="#273949"
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    maxBarSize={80}
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
                      <stop offset="5%" stopColor="#273949" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#273949" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="weeklyGradientBelow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                    </linearGradient>
                    <filter id="weeklyShadow" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#273949" floodOpacity="0.3"/>
                    </filter>
                    <filter id="weeklyShadowRed" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis 
                    dataKey="semana" 
                    tick={{ fontSize: 12, fill: "#4b5563" }}
                    axisLine={{ stroke: "#d1d5db" }}
                    tickLine={{ stroke: "#d1d5db" }}
                  />
                  <YAxis 
                    // Establecer un rango fijo para que las barras se vean mejor
                    domain={companyId === 1 ? [0, 20000] : [0, 300000]}
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
                      if (name === "valor") return [`${formatNumber(value as number)} ${unit}`, "Volumen"];
                      if (name === "objetivo") return [`${formatNumber(value as number)} ${unit}`, "Objetivo Semanal"];
                      if (name === "diferencia") {
                        const num = value as number;
                        const sign = num >= 0 ? '+' : '';
                        return [`${sign}${formatNumber(num)} ${unit}`, "Diferencia"];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label: any) => `${label}`}
                    customWidth="180px"
                    cursor={{ fill: 'rgba(39, 57, 73, 0.1)' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: 15 }}
                    iconType="circle"
                  />
                  <Bar 
                    dataKey="valor" 
                    name={`Volumen (${getUnit()})`} 
                    radius={[6, 6, 0, 0]}
                    barSize={60} 
                    fill="#273949"
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    maxBarSize={80}
                  />
                  <Line
                    type="monotone"
                    dataKey="objetivo"
                    name="Objetivo Semanal"
                    stroke="#b5e951"
                    strokeWidth={2}
                    dot={{ r: 5, fill: "#b5e951", stroke: 'white', strokeWidth: 2 }}
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
        
        {chartDataWithTarget.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow-md border border-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 dark:border-blue-800/50">
                <div className="text-sm text-blue-600 font-medium dark:text-blue-300 mb-1">Ventas Actuales</div>
                <div className="flex items-center">
                  <BarChart2 className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-300" />
                  <span className="text-xl font-bold text-blue-800 dark:text-blue-100">
                    {formatNumber(chartDataWithTarget[chartDataWithTarget.length - 1].value)} {getUnit()}
                  </span>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg shadow-md border border-green-200 dark:from-green-900/30 dark:to-green-800/30 dark:border-green-800/50">
                <div className="text-sm text-green-600 font-medium dark:text-green-300 mb-1">Objetivo Mensual</div>
                <div className="flex items-center">
                  <Award className="h-4 w-4 mr-2 text-green-600 dark:text-green-300" />
                  <span className="text-xl font-bold text-green-800 dark:text-green-100">
                    {formatNumber(monthlyTarget)} {getUnit()}
                  </span>
                </div>
              </div>
              
              {/* Diferencia */}
              <div className={`bg-gradient-to-br ${
                chartDataWithTarget[chartDataWithTarget.length - 1].value >= monthlyTarget 
                  ? 'from-emerald-50 to-emerald-100 border-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 dark:border-emerald-800/50' 
                  : 'from-red-50 to-red-100 border-red-200 dark:from-red-900/30 dark:to-red-800/30 dark:border-red-800/50'
                } p-4 rounded-lg shadow-md border`}>
                <div className={`text-sm font-medium mb-1 ${
                  chartDataWithTarget[chartDataWithTarget.length - 1].value >= monthlyTarget 
                    ? 'text-emerald-600 dark:text-emerald-300' 
                    : 'text-red-600 dark:text-red-300'
                }`}>Diferencia</div>
                <div className="flex items-center">
                  {chartDataWithTarget[chartDataWithTarget.length - 1].value >= monthlyTarget ? (
                    <ArrowUpIcon className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4 mr-2 text-red-600 dark:text-red-300" />
                  )}
                  <span className={`text-xl font-bold ${
                    chartDataWithTarget[chartDataWithTarget.length - 1].value >= monthlyTarget 
                      ? 'text-emerald-800 dark:text-emerald-100' 
                      : 'text-red-800 dark:text-red-100'
                  }`}>
                    {chartDataWithTarget[chartDataWithTarget.length - 1].value >= monthlyTarget ? '+' : ''}
                    {formatNumber(chartDataWithTarget[chartDataWithTarget.length - 1].value - monthlyTarget)} {getUnit()}
                  </span>
                </div>
              </div>
            </div>

          </>
        )}
      </CardContent>
    </Card>
  );
}