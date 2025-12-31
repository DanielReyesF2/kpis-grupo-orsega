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
  Label,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  InfoIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// Componente personalizado para el label del objetivo
const TargetLabel = (props: any) => {
  const { viewBox, value } = props;
  
  // Debug: log para ver qué props recibimos
  if (process.env.NODE_ENV === 'development') {
    console.log('[TargetLabel] Props recibidos:', { viewBox, value, allProps: props });
  }
  
  if (!value) return null;
  
  // viewBox puede venir como objeto { x, y, width, height } o como string
  // En Recharts, viewBox viene como { x, y, width, height }
  let x = 0;
  let y = 0;
  
  if (viewBox) {
    if (typeof viewBox === 'object' && 'x' in viewBox && 'y' in viewBox) {
      x = viewBox.x;
      y = viewBox.y;
    } else if (typeof viewBox === 'string') {
      // Parsear string de viewBox si es necesario
      const match = viewBox.match(/x="([^"]*)" y="([^"]*)"/);
      if (match) {
        x = parseFloat(match[1]) || 0;
        y = parseFloat(match[2]) || 0;
      }
    }
  }
  
  // Si no tenemos coordenadas válidas, no renderizar
  if (x === 0 && y === 0 && !viewBox) {
    return null;
  }
  
  // Calcular el ancho del texto aproximado (7px por caracter)
  const textWidth = value.length * 7;
  const labelWidth = Math.max(textWidth + 16, 140);
  
  return (
    <g className="target-label">
      <rect
        x={x + 10}
        y={y - 12}
        width={labelWidth}
        height={24}
        fill="rgba(255, 255, 255, 0.98)"
        stroke="#6b7280"
        strokeWidth={1.5}
        rx={4}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
      />
      <text
        x={x + 18}
        y={y + 5}
        fill="#6b7280"
        fontSize={12}
        fontWeight={700}
        style={{ textAnchor: 'start', fontFamily: 'system-ui, sans-serif' }}
      >
        {value}
      </text>
    </g>
  );
};

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
        className="bg-card border border-border p-3 sm:p-4 shadow-lg rounded-lg max-w-[90vw] sm:max-w-none"
        style={{ width: customWidth, fontSize: "12px", zIndex: 50, pointerEvents: "none" }}
      >
        {/* Período */}
        <div className="font-semibold mb-2 sm:mb-3 text-xs sm:text-sm border-b border-border pb-2">
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
  
  // Usar datos reales de sales_data en lugar de kpi_values
  // El endpoint /api/sales-monthly-trends devuelve datos agregados de la tabla sales_data
  const { data: salesTrendsData, isLoading: isLoadingTrends, error: salesTrendsError } = useQuery<any[]>({
    queryKey: ['/api/sales-monthly-trends', { companyId, months: 12 }],
    enabled: !!companyId && companyId > 0,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Procesar datos de sales_data - Optimizado con useMemo
  const chartData = useMemo(() => {
    if (!salesTrendsData || salesTrendsData.length === 0) {
      return [];
    }

    // Los datos ya vienen ordenados cronológicamente del endpoint
    return salesTrendsData.map((item: any) => ({
      period: item.month || `${item.monthNum}/${item.year}`,
      value: item.volume || 0,
      clients: item.clients || 0,
      year: item.year,
      monthNum: item.monthNum,
      unit: companyId === 1 ? 'KG' : 'unidades'
    }));
  }, [salesTrendsData, companyId]);

  // Mantener compatibilidad con el código existente
  const isLoadingHistory = isLoadingTrends;
  const kpiHistoryError = salesTrendsError;

  // Extraer el valor objetivo (target) quitando "KG" y convirtiendo a número
  const targetValue = target ? parseInt(target.replace(/[^0-9]/g, ''), 10) : 0;
  
  // Si no hay target prop, usar valores por defecto según la compañía
  const monthlyTarget = targetValue || (companyId === 1 ? 55620 : 858373);
  
  // Agregar una línea para el objetivo a cada punto de datos
  const chartDataWithTarget = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    return chartData.map((data: any) => ({
      ...data,
      target: monthlyTarget,
      diferencia: data.value - monthlyTarget
    }));
  }, [chartData, monthlyTarget]);
  
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

  // Determinar el logo de la empresa según companyId
  const getCompanyLogo = () => {
    if (companyId === 1) {
      return '/logodura.jpg';
    } else if (companyId === 2) {
      return '/logo orsega.jpg';
    }
    return null;
  };

  const companyLogo = getCompanyLogo();
  const companyName = companyId === 1 ? 'Dura International' : 'Grupo Orsega';

  return (
    <Card className="bg-card border border-border shadow-md relative">
      {/* Logo de la empresa en la esquina superior derecha */}
      {companyLogo && (
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
          <div className="bg-card/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-border/50">
            <img 
              src={companyLogo} 
              alt={`${companyName} Logo`}
              className="h-12 sm:h-16 w-auto object-contain"
              style={{ maxWidth: '120px', display: 'block' }}
              onError={(e) => {
                console.error('[SalesVolumeChart] Error cargando logo:', companyLogo);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
              onLoad={() => {
                console.log('[SalesVolumeChart] ✅ Logo cargado:', companyLogo);
              }}
            />
          </div>
        </div>
      )}
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold text-foreground">Histórico de Ventas</CardTitle>
        {chartDataWithTarget.length > 0 && trendData.difference !== 0 && (
          <div className="flex items-center mt-2">
            <span className="text-sm text-muted-foreground mr-2">
              vs mes anterior:
            </span>
            <span className={`text-sm flex items-center font-medium ${
              trendData.isPositive ? 'text-foreground' : 'text-muted-foreground'
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
      <CardContent className="pt-0 pb-4 bg-card">
        {chartDataWithTarget.length > 0 ? (
          <Tabs defaultValue="monthly" className="w-full">
            {showControls && (
              <TabsList className="grid w-full max-w-xs grid-cols-2 mb-4 bg-muted border border-border">
                <TabsTrigger 
                  value="monthly"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-foreground data-[state=inactive]:opacity-70"
                >
                  Mensual
                </TabsTrigger>
                <TabsTrigger 
                  value="weekly"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-foreground data-[state=inactive]:opacity-70"
                >
                  Seguimiento Semanal
                </TabsTrigger>
              </TabsList>
            )}
            
            <TabsContent value="monthly" className="h-[350px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartDataWithTarget}
                  margin={{ top: 20, right: 120, left: 20, bottom: 10 }}
                >
                  <CartesianGrid 
                    stroke="#e5e7eb"
                    vertical={false}
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#d1d5db" }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#d1d5db" }}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(25, 88, 145, 0.1)", strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(value: any) => {
                      const unit = getUnit();
                      return `${formatNumber(value as number)} ${unit}`;
                    }}
                    labelFormatter={(label: any) => `${label}`}
                  />
                  {/* Línea de objetivo mensual */}
                  {monthlyTarget > 0 && (
                    <ReferenceLine
                      y={monthlyTarget}
                      stroke="#6b7280"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      strokeOpacity={0.6}
                      label={{
                        value: `${formatNumber(monthlyTarget)} ${getUnit()}`,
                        position: 'right',
                        fill: '#6b7280',
                        fontSize: 12,
                        fontWeight: 700,
                        offset: 5,
                      }}
                    />
                  )}
                  {/* Líneas de referencia (superior e inferior) basadas en los datos */}
                  {valueRange.range > 0 && (
                    <>
                      <ReferenceLine
                        y={valueRange.maxValue - valueRange.range * 0.2}
                        stroke="#9ca3af"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.4}
                      />
                      <ReferenceLine
                        y={valueRange.minValue + valueRange.range * 0.2}
                        stroke="#9ca3af"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.4}
                      />
                    </>
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#195891"
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
                      
                      // Primer punto gris, el resto azul celeste
                      const isFirstPoint = index === 0;
                      const fillColor = isFirstPoint ? "#9ca3af" : "#195891";
                      
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
                    activeDot={{ r: 6, fill: "#195891" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="weekly" className="h-[350px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={generateWeeklyData().map((item: any) => ({ ...item, value: item.valor, period: item.semana }))}
                  margin={{ top: 20, right: 120, left: 20, bottom: 10 }}
                >
                  <CartesianGrid 
                    stroke="#e5e7eb"
                    vertical={false}
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#d1d5db" }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#d1d5db" }}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(25, 88, 145, 0.1)", strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(value: any) => {
                      const unit = getUnit();
                      return `${formatNumber(value as number)} ${unit}`;
                    }}
                    labelFormatter={(label: any) => `${label}`}
                  />
                  {/* Líneas de referencia (superior e inferior) basadas en los datos semanales */}
                  {(() => {
                    const weeklyData = generateWeeklyData();
                    if (weeklyData.length === 0) return null;
                    const values = weeklyData.map((d: any) => d.valor);
                    const minValue = Math.min(...values);
                    const maxValue = Math.max(...values);
                    const range = maxValue - minValue;
                    if (range > 0) {
                      return (
                        <>
                          <ReferenceLine
                            y={maxValue - range * 0.2}
                            stroke="#9ca3af"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            strokeOpacity={0.4}
                          />
                          <ReferenceLine
                            y={minValue + range * 0.2}
                            stroke="#9ca3af"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            strokeOpacity={0.4}
                          />
                        </>
                      );
                    }
                    return null;
                  })()}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#195891"
                    strokeWidth={0.5}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      if (!cx || !cy) return null;
                      
                      const weeklyData = generateWeeklyData();
                      const values = weeklyData.map((d: any) => d.valor);
                      const minValue = Math.min(...values);
                      const maxValue = Math.max(...values);
                      const range = maxValue - minValue;
                      
                      // Calcular tamaño del punto basado en el volumen de ventas
                      const normalizedValue = range > 0 
                        ? (payload.value - minValue) / range 
                        : 0.5;
                      
                      // Tamaño base pequeño, más grande para valores altos
                      const baseSize = 3;
                      const maxSize = 8;
                      const pointSize = baseSize + (normalizedValue * (maxSize - baseSize));
                      
                      // Primer punto gris, el resto azul celeste
                      const isFirstPoint = index === 0;
                      const fillColor = isFirstPoint ? "#9ca3af" : "#195891";
                      
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
                    activeDot={{ r: 6, fill: "#195891" }}
                  />
                  {monthlyTarget > 0 && (
                    <ReferenceLine
                      y={monthlyTarget / 4}
                      stroke="#6b7280"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      strokeOpacity={0.6}
                      label={{
                        value: `${formatNumber(Math.round(monthlyTarget / 4))} ${getUnit()}`,
                        position: 'right',
                        fill: '#6b7280',
                        fontSize: 12,
                        fontWeight: 700,
                        offset: 5,
                      }}
                    />
                  )}
                </LineChart>
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
                <p className="text-sm font-medium text-muted-foreground">
                  No hay datos históricos de ventas disponibles
                </p>
                <p className="text-xs text-muted-foreground">
                  KPI ID: {kpiId} | Company ID: {companyId} | 
                  {companyId === 1 ? ' (Dura - tabla: kpi_values_dura)' : ' (Orsega - tabla: kpi_values_orsega)'}
                </p>
                <p className="text-xs text-muted-foreground">
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