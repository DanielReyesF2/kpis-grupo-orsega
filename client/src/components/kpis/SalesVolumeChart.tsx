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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
        className="bg-card border border-border p-4 shadow-lg rounded-lg"
        style={{ width: customWidth, fontSize: "12px", zIndex: 1000 }}
      >
        {/* Período */}
        <div className="font-semibold mb-3 text-sm border-b border-border pb-2">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
        
        {/* Volumen Total - Destacado */}
        <div className="mb-3">
          <div className="text-xs text-muted-foreground mb-1">Volumen Total del Mes</div>
          <div className="text-lg font-bold">
            {formatNumber(volumeValue)} {unit}
          </div>
        </div>
        
        {/* Información adicional */}
        <div className="space-y-2">
          {targetValue > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Objetivo:</span>
                <span className="text-xs font-semibold">
                  {formatNumber(targetValue)} {unit}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Diferencia:</span>
                <span className={`text-xs font-semibold ${diferencia >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {diferencia >= 0 ? '+' : ''}{formatNumber(diferencia)} {unit}
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Cumplimiento:</span>
                <span className={`text-xs font-bold ${parseFloat(cumplimiento) >= 100 ? 'text-[#22C55E]' : parseFloat(cumplimiento) >= 85 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
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
  const kpiId = providedKpiId || salesKpi?.id || (companyId === 1 ? 39 : 1);
  
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

  // Calcular valores min/max para el tamaño de los puntos y líneas de referencia
  const valueRange = useMemo(() => {
    if (!chartDataWithTarget || chartDataWithTarget.length === 0) {
      return { minValue: 0, maxValue: 0, range: 0 };
    }
    const values = chartDataWithTarget.map((d: any) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;
    return { minValue, maxValue, range };
  }, [chartDataWithTarget]);

  // Mostrar skeleton mientras carga
  if (isLoadingHistory) {
    return (
      <Card className="shadow-md">
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <p className="text-gray-500">Cargando datos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#181818] border-0 shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold text-[#9ca3af]">Histórico de Ventas</CardTitle>
        {chartDataWithTarget.length > 0 && trendData.difference !== 0 && (
          <div className="flex items-center mt-2">
            <span className="text-sm text-[#9ca3af] mr-2 opacity-70">
              vs mes anterior:
            </span>
            <span className={`text-sm flex items-center font-medium ${
              trendData.isPositive ? 'text-[#9ca3af]' : 'text-[#9ca3af] opacity-60'
            }`}>
              {trendData.isPositive ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {trendData.isPositive ? '+' : ''} {formatNumber(trendData.difference)} {getUnit()}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0 pb-4 bg-[#181818]">
        {chartDataWithTarget.length > 0 ? (
          <Tabs defaultValue="monthly" className="w-full">
            {showControls && (
              <TabsList className="grid w-full max-w-xs grid-cols-2 mb-4">
                <TabsTrigger value="monthly">Mensual</TabsTrigger>
                <TabsTrigger value="weekly">Seguimiento Semanal</TabsTrigger>
              </TabsList>
            )}
            
            <TabsContent value="monthly" className="h-[350px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartDataWithTarget}
                  margin={{ top: 20, right: 20, left: 20, bottom: 10 }}
                >
                  <CartesianGrid 
                    stroke="#2a2a2a"
                    vertical={false}
                    strokeDasharray="0"
                  />
                  <XAxis 
                    dataKey="period" 
                    stroke="#9ca3af"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a2a" }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a2a" }}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: "#181818",
                      border: "1px solid #2a2a2a",
                      color: "#9ca3af",
                      fontSize: "12px",
                      borderRadius: "4px",
                    }}
                    formatter={(value: any) => {
                      const unit = getUnit();
                      return `${formatNumber(value as number)} ${unit}`;
                    }}
                    labelFormatter={(label: any) => `${label}`}
                  />
                  {/* Líneas de referencia (superior e inferior) basadas en los datos */}
                  {valueRange.range > 0 && (
                    <>
                      <ReferenceLine
                        y={valueRange.maxValue - valueRange.range * 0.2}
                        stroke="#ffffff"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                      <ReferenceLine
                        y={valueRange.minValue + valueRange.range * 0.2}
                        stroke="#ffffff"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                    </>
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#ffffff"
                    strokeWidth={0.5}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      if (!cx || !cy) return null;
                      
                      // Calcular tamaño del punto basado en el volumen de ventas
                      const normalizedValue = valueRange.range > 0 
                        ? (payload.value - valueRange.minValue) / valueRange.range 
                        : 0.5;
                      
                      // Tamaño base pequeño, más grande para valores altos
                      const baseSize = 3;
                      const maxSize = 8;
                      const pointSize = baseSize + (normalizedValue * (maxSize - baseSize));
                      
                      // Primer punto gris, el resto blanco
                      const isFirstPoint = index === 0;
                      const fillColor = isFirstPoint ? "#9ca3af" : "#ffffff";
                      
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={pointSize}
                          fill={fillColor}
                          stroke={fillColor}
                          strokeWidth={0.5}
                        />
                      );
                    }}
                    activeDot={{ r: 6, fill: "#ffffff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="weekly" className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={generateWeeklyData()}
                  margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <defs>
                    {/* Gradiente premium tipo Oura Ring: negro → gris claro (fade ascendente) */}
                    <linearGradient id="weeklyBarGray" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#000000" />
                      <stop offset="100%" stopColor="#9ca3af" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    stroke="#2a2a2a"
                    vertical={false}
                    strokeDasharray="0"
                  />
                  <XAxis 
                    dataKey="semana" 
                    stroke="#9ca3af"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a2a" }}
                  />
                  <YAxis 
                    domain={companyId === 1 ? [0, 20000] : [0, 300000]}
                    padding={{ top: 20 }}
                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                    stroke="#9ca3af"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a2a" }}
                  />
                  <Tooltip 
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                    contentStyle={{ 
                      backgroundColor: "#181818",
                      border: "1px solid #2a2a2a",
                      color: "#9ca3af",
                      fontSize: "12px",
                      borderRadius: "4px",
                    }}
                    formatter={(value: any) => {
                      const unit = getUnit();
                      return `${formatNumber(value as number)} ${unit}`;
                    }}
                  />
                  <Bar 
                    dataKey="valor" 
                    name={`Volumen (${getUnit()})`} 
                    fill="url(#weeklyBarGray)"
                    radius={[4, 4, 0, 0]}
                    barSize={60} 
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    maxBarSize={80}
                    shape={(props: any) => {
                      const { x, y, width, height } = props;
                      return (
                        <g>
                          {/* Barra con degradado negro → gris claro (ascendente) */}
                          <rect 
                            x={x} 
                            y={y} 
                            width={width} 
                            height={height} 
                            fill="url(#weeklyBarGray)" 
                            rx={4} 
                            ry={4}
                            className="transition-all duration-200 hover:opacity-90"
                          />
                          {/* Línea blanca delgada en la parte superior */}
                          {height > 5 && (
                            <line
                              x1={x}
                              y1={y}
                              x2={x + width}
                              y2={y}
                              stroke="#ffffff"
                              strokeWidth={0.5}
                              opacity={0.4}
                            />
                          )}
                        </g>
                      );
                    }}
                  />
                  {monthlyTarget > 0 && (
                    <ReferenceLine
                      y={monthlyTarget / 4}
                      stroke="#9ca3af"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                    />
                  )}
                </BarChart>
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