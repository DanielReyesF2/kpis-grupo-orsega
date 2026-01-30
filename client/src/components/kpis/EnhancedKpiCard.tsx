import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target,
  ArrowUp,
  ArrowDown,
  Activity,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { apiRequest } from '@/lib/queryClient';

interface KpiValue {
  value: number;
  recordedAt: string;
}

interface EnhancedKpiCardProps {
  kpi: {
    id: number;
    name: string;
    value: number | null;
    target: string;
    unit: string;
    compliancePercentage: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    areaName?: string;
    responsible?: string;
    historicalData?: KpiValue[];
    company?: string; // Nueva propiedad para identificar la empresa
    companyId?: number; // ID de la compañía para cargar historial correctamente
  };
  onClick?: () => void;
  onViewDetails?: () => void;
  delay?: number;
  expandedLayout?: boolean; // Si es true, usa un layout más expandido para el panel
}

const getCompanyAccent = (companyId?: number) => {
  if (companyId === 1) return { borderLeft: 'border-l-emerald-500', avatarBg: 'bg-emerald-600', badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'DURA' };
  if (companyId === 2) return { borderLeft: 'border-l-purple-500', avatarBg: 'bg-purple-600', badgeBg: 'bg-purple-100 text-purple-700 border-purple-300', label: 'ORSEGA' };
  return { borderLeft: '', avatarBg: 'bg-primary', badgeBg: '', label: '' };
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'excellent':
      return { bg: 'bg-green-50/30', border: 'border-green-200/40', text: 'text-green-600/70', fill: 'fill-green-400/60', chartColor: '#6b7280' };
    case 'good':
      return { bg: 'bg-blue-50/30', border: 'border-blue-200/40', text: 'text-blue-600/70', fill: 'fill-blue-400/60', chartColor: '#6b7280' };
    case 'warning':
      return { bg: 'bg-amber-50/30', border: 'border-amber-200/40', text: 'text-amber-600/70', fill: 'fill-amber-400/60', chartColor: '#6b7280' };
    case 'critical':
      return { bg: 'bg-red-50/30', border: 'border-red-200/40', text: 'text-red-600/70', fill: 'fill-red-400/60', chartColor: '#6b7280' };
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', fill: 'fill-gray-400', chartColor: '#6b7280' };
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'excellent':
      return <TrendingUp className="h-4 w-4" />;
    case 'good':
      return <Activity className="h-4 w-4" />;
    case 'warning':
      return <TrendingDown className="h-4 w-4" />;
    case 'critical':
      return <Target className="h-4 w-4" />;
    default:
      return <Minus className="h-4 w-4" />;
  }
};

export function EnhancedKpiCard({ kpi, onClick, onViewDetails, delay = 0, expandedLayout = false }: EnhancedKpiCardProps) {
  const [isExpanded, setIsExpanded] = useState(expandedLayout); // Si está en expandedLayout, empezar expandido
  const statusColors = getStatusColor(kpi.status);
  const companyAccent = getCompanyAccent(kpi.companyId);

  // Detectar si es un KPI de porcentaje estático (0-100%) que no requiere gráfica de tendencia
  const isStaticPercentageKPI = useMemo(() => {
    const isPercentage = kpi.unit === '%' || kpi.unit === 'porcentaje' || kpi.unit.toLowerCase().includes('%');
    const isRetention = kpi.name.toLowerCase().includes('retención') || kpi.name.toLowerCase().includes('retention');
    // Solo ocultar gráfica para KPIs de retención/porcentajes estáticos
    return isPercentage && isRetention;
  }, [kpi.unit, kpi.name]);
  
  // Cargar historial completo cuando se expanda
  // Usar endpoint genérico que automáticamente busca en las tablas correctas
  // Incluir companyId si está disponible para asegurar que se carguen los datos correctos
  const { data: fullHistory, isLoading: isLoadingHistory, error: historyError } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpi.id}`, { months: 12, companyId: kpi.companyId }],
    queryFn: async () => {
      const url = kpi.companyId 
        ? `/api/kpi-history/${kpi.id}?months=12&companyId=${kpi.companyId}`
        : `/api/kpi-history/${kpi.id}?months=12`;
      console.log(`[EnhancedKpiCard] Cargando historial para KPI ${kpi.id}, companyId: ${kpi.companyId}, url: ${url}`);
      const response = await apiRequest('GET', url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al cargar historial: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      console.log(`[EnhancedKpiCard] Historial cargado: ${data.length} registros`);
      return data;
    },
    enabled: (isExpanded || expandedLayout) && !!kpi.id, // Cargar siempre si está en expandedLayout
    staleTime: 0, // No cachear para asegurar datos frescos
    refetchOnWindowFocus: true,
    retry: 2,
  });
  
  // Preparar datos para el gráfico de tendencia (últimos 6 puntos)
  const chartData = useMemo(() => {
    if (!kpi.historicalData || kpi.historicalData.length === 0) return [];
    
    const recentData = kpi.historicalData.slice(-6);
    return recentData.map((item, index) => ({
      name: `P${index + 1}`,
      value: item.value,
      date: new Date(item.recordedAt).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
    }));
  }, [kpi.historicalData]);

  // Preparar datos históricos completos para gráfica expandida
  const fullHistoryData = useMemo(() => {
    if (!fullHistory || fullHistory.length === 0) return [];
    
    // Ordenar por fecha ascendente para visualización correcta
    const sortedData = fullHistory
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.period || a.created_at).getTime();
        const dateB = new Date(b.date || b.period || b.created_at).getTime();
        return dateA - dateB;
      })
      .map((item: any, index: number) => {
        // Intentar formatear el período de manera más legible
        let periodName = item.period || '';
        
        // Si el período contiene información de fecha, formatearlo mejor
        if (item.date) {
          const date = new Date(item.date);
          periodName = date.toLocaleDateString('es-MX', { 
            month: 'short', 
            year: 'numeric',
            day: item.date.includes('T') ? undefined : 'numeric'
          });
        } else if (item.period) {
          // Si el período es algo como "ENERO 2025", formatearlo mejor
          periodName = item.period
            .split(' ')
            .map((word: string) => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(' ');
        } else {
          periodName = `Periodo ${index + 1}`;
        }
        
        return {
          name: periodName,
          value: parseFloat(item.value?.toString() || '0'),
          period: item.period || '',
          date: item.date || item.created_at || '',
          formattedValue: parseFloat(item.value?.toString() || '0')
        };
      });
    
    return sortedData;
  }, [fullHistory]);
  
  // Calcular tendencia (último vs penúltimo)
  const trend = useMemo(() => {
    if (!kpi.historicalData || kpi.historicalData.length < 2) return null;
    const values = kpi.historicalData.map(d => d.value);
    const last = values[values.length - 1];
    const previous = values[values.length - 2];
    const change = ((last - previous) / previous) * 100;
    return { change, isPositive: change >= 0 };
  }, [kpi.historicalData]);

  const hasData = kpi.value !== null && kpi.value !== undefined;
  const displayValue = hasData ? `${kpi.value} ${kpi.unit}` : 'Sin datos';
  const complianceDisplay = kpi.compliancePercentage > 0 ? `${kpi.compliancePercentage}%` : 'N/A';

  // Si está en expandedLayout y hay datos históricos, mostrar solo la gráfica
  if (expandedLayout && fullHistoryData.length > 0) {
    // ✅ FIX CRÍTICO: Filtrar valores válidos antes de calcular estadísticas
    const values = fullHistoryData.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

    // Validar que hay valores después del filtro
    if (values.length === 0) {
      return (
        <div className="w-full py-12 text-center">
          <Info className="h-6 w-6 text-gray-400 mx-auto mb-2" />
          <span className="text-sm text-gray-500">No hay datos numéricos válidos disponibles</span>
        </div>
      );
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
    const range = maxValue - minValue;
    const padding = range * 0.1 || Math.abs(maxValue) * 0.1 || 10;
    const yAxisMin = Math.max(0, minValue - padding);
    const yAxisMax = maxValue + padding;
    
    return (
      <div className="w-full">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-gray-900">Tendencia Histórica - {kpi.name}</h4>
              <p className="text-sm text-gray-500 mt-0.5">
                Últimos {fullHistoryData.length} períodos registrados
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {fullHistoryData.length} puntos de datos
            </div>
          </div>
          
          <div className="h-[500px] w-full bg-white rounded-lg p-6 border-2 border-gray-200 shadow-md">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={fullHistoryData} 
                margin={{ top: 20, right: 40, bottom: 100, left: 30 }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#e5e7eb" 
                  opacity={0.5}
                  vertical={false}
                />
                <XAxis 
                  dataKey="name" 
                  angle={-60}
                  textAnchor="end"
                  height={110}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  interval={0}
                  stroke="#9ca3af"
                  tickMargin={15}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  stroke="#9ca3af"
                  width={70}
                  tickMargin={10}
                  domain={[yAxisMin, yAxisMax]}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    return value.toLocaleString('es-MX', { maximumFractionDigits: 0 });
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    padding: '10px 14px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any) => [
                    `${Number(value).toLocaleString('es-MX', { 
                      minimumFractionDigits: 0, 
                      maximumFractionDigits: 2 
                    })} ${kpi.unit}`, 
                    'Valor'
                  ]}
                  labelFormatter={(label) => `📅 ${label}`}
                  cursor={{ stroke: statusColors.chartColor, strokeWidth: 2, strokeDasharray: '5 5' }}
                />
                {kpi.target && !isNaN(parseFloat(kpi.target)) && (
                  <ReferenceLine 
                    y={parseFloat(kpi.target)} 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{ 
                      value: `Meta: ${kpi.target} ${kpi.unit}`, 
                      position: "right",
                      fill: "#ef4444",
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  />
                )}
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={statusColors.chartColor}
                  strokeWidth={4}
                  dot={{ 
                    r: 6, 
                    fill: statusColors.chartColor,
                    strokeWidth: 2,
                    stroke: '#fff'
                  }}
                  activeDot={{ 
                    r: 8, 
                    fill: statusColors.chartColor,
                    strokeWidth: 2,
                    stroke: '#fff',
                    strokeDasharray: '0'
                  }}
                  name={`${kpi.name}`}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1 font-medium">Valor Mínimo</div>
              <div className="text-base font-bold text-gray-700">
                {minValue.toLocaleString('es-MX', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                })} {kpi.unit}
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1 font-medium">Promedio</div>
              <div className="text-base font-bold text-gray-700">
                {avgValue.toLocaleString('es-MX', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                })} {kpi.unit}
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1 font-medium">Valor Máximo</div>
              <div className="text-base font-bold text-gray-700">
                {maxValue.toLocaleString('es-MX', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                })} {kpi.unit}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si está en expandedLayout pero no hay datos, mostrar estado de carga/error
  if (expandedLayout) {
    if (isLoadingHistory) {
      return (
        <div className="w-full py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <span className="text-sm text-gray-500">Cargando historial...</span>
        </div>
      );
    }
    if (historyError) {
      return (
        <div className="w-full py-12 text-center">
          <Info className="h-6 w-6 text-gray-400 mx-auto mb-2" />
          <span className="text-sm text-gray-500">Error al cargar historial</span>
        </div>
      );
    }
    if (!fullHistoryData || fullHistoryData.length === 0) {
      return (
        <div className="w-full py-12 text-center">
          <Info className="h-6 w-6 text-gray-400 mx-auto mb-2" />
          <span className="text-sm text-gray-500">No hay datos históricos disponibles</span>
        </div>
      );
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card
        className={`h-full transition-all duration-200 border-2 ${statusColors.border} ${statusColors.bg} hover:shadow-lg hover:border-opacity-70 ${companyAccent.borderLeft ? `border-l-4 ${companyAccent.borderLeft}` : ''}`}
        data-onboarding="kpi-card"
      >
        <CardContent className="p-5">
          <div className="space-y-4">
            {/* Header con responsable prominente y nombre del KPI */}
            <div className="space-y-2">
              {/* Responsable destacado */}
              {kpi.responsible && (
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${companyAccent.avatarBg} text-white text-xs font-bold shadow-md`}>
                    {kpi.responsible.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{kpi.responsible}</p>
                    {companyAccent.label && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${companyAccent.badgeBg}`}>
                        {companyAccent.label}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {/* Nombre del KPI */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight text-gray-900 mb-1">
                    {kpi.name}
                  </h3>
                  {kpi.areaName && (
                    <p className="text-xs text-gray-500 truncate">{kpi.areaName}</p>
                  )}
                </div>
                <Badge className={`${statusColors.text} ${statusColors.bg} border ${statusColors.border} flex items-center gap-1 px-2 py-1`}>
                  {getStatusIcon(kpi.status)}
                </Badge>
              </div>
            </div>

            {/* Valor actual destacado */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">Valor Actual</span>
                {trend && (
                  <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? 'text-green-500/70' : 'text-red-500/70'}`}>
                    {trend.isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    <span>{Math.abs(trend.change).toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {displayValue}
              </div>
            </div>

            {/* Barra de progreso circular */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Cumplimiento</span>
                <span className={`font-semibold ${statusColors.text}`}>
                  {complianceDisplay}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  className={`h-full ${statusColors.fill.replace('fill-', 'bg-')}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(kpi.compliancePercentage, 100)}%` }}
                  transition={{ duration: 0.8, delay: delay + 0.2, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Meta: {kpi.target} {kpi.unit}</span>
              </div>
            </div>


            {/* Componente expandible para historial completo */}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs justify-between"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-3 w-3" />
                    <span>Ver Historial Completo</span>
                  </div>
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 border-t border-gray-200">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Activity className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Cargando historial...</span>
                  </div>
                ) : historyError ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Info className="h-6 w-6 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500 mb-1">Error al cargar historial</span>
                    <span className="text-xs text-gray-400">
                      {historyError instanceof Error ? historyError.message : 'Error desconocido'}
                    </span>
                  </div>
                ) : fullHistoryData.length > 0 ? (
                  (() => {
                    // ✅ Si es un KPI de porcentaje estático (retención), no mostrar gráfica de tendencia
                    if (isStaticPercentageKPI) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 text-center bg-blue-50/30 rounded-lg border border-blue-200/40">
                          <div className="mb-4">
                            <div className="text-5xl font-bold text-blue-600 mb-2">
                              {kpi.value?.toFixed(1) || '0'}%
                            </div>
                            <div className="text-sm text-gray-600 font-medium">Valor Actual</div>
                          </div>
                          {kpi.target && (
                            <div className="text-xs text-gray-500 mt-2">
                              Meta: {kpi.target}
                            </div>
                          )}
                          <div className="mt-4 px-4 py-2 bg-white rounded-md border border-gray-200">
                            <p className="text-xs text-gray-600">
                              Los KPIs de porcentaje estático se visualizan mejor como un valor único.<br/>
                              Para análisis de tendencias, usa el modal de detalles.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // ✅ FIX CRÍTICO: Filtrar valores válidos antes de calcular estadísticas
                    const values = fullHistoryData.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

                    // Si no hay valores válidos después del filtro, mostrar mensaje
                    if (values.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Info className="h-6 w-6 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-500">No hay datos numéricos válidos</span>
                        </div>
                      );
                    }

                    const minValue = Math.min(...values);
                    const maxValue = Math.max(...values);
                    const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
                    const range = maxValue - minValue;
                    const padding = range * 0.1 || Math.abs(maxValue) * 0.1 || 10;
                    const yAxisMin = Math.max(0, minValue - padding);
                    const yAxisMax = maxValue + padding;
                    
                    return (
                      <div className="space-y-4">
                        {/* Encabezado del gráfico */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700">Tendencia Histórica</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Últimos {fullHistoryData.length} períodos
                            </p>
                          </div>
                          <div className="text-xs text-gray-500">
                            {fullHistoryData.length} puntos de datos
                          </div>
                        </div>
                        
                        {/* Gráfico mejorado con más espacio */}
                        <div className="h-80 w-full bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                              data={fullHistoryData} 
                              margin={{ top: 20, right: 30, bottom: 80, left: 20 }}
                            >
                              <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke="#e5e7eb" 
                                opacity={0.5}
                                vertical={false}
                              />
                              <XAxis 
                                dataKey="name" 
                                angle={-45}
                                textAnchor="end"
                                height={90}
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                interval={0}
                                stroke="#9ca3af"
                                tickMargin={10}
                              />
                              <YAxis 
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                stroke="#9ca3af"
                                width={60}
                                tickMargin={8}
                                domain={[yAxisMin, yAxisMax]}
                                tickFormatter={(value) => {
                                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                                  return value.toLocaleString('es-MX', { maximumFractionDigits: 0 });
                                }}
                              />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '13px',
                              padding: '10px 14px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value: any) => [
                              `${Number(value).toLocaleString('es-MX', { 
                                minimumFractionDigits: 0, 
                                maximumFractionDigits: 2 
                              })} ${kpi.unit}`, 
                              'Valor'
                            ]}
                            labelFormatter={(label) => `📅 ${label}`}
                            cursor={{ stroke: statusColors.chartColor, strokeWidth: 2, strokeDasharray: '5 5' }}
                          />
                          {/* Línea de referencia para la meta si está disponible */}
                          {kpi.target && !isNaN(parseFloat(kpi.target)) && (
                            <ReferenceLine 
                              y={parseFloat(kpi.target)} 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={{ 
                                value: `Meta: ${kpi.target} ${kpi.unit}`, 
                                position: "right",
                                fill: "#ef4444",
                                fontSize: 11,
                                fontWeight: 500
                              }}
                            />
                          )}
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={statusColors.chartColor}
                            strokeWidth={3}
                            dot={{ 
                              r: 5, 
                              fill: statusColors.chartColor,
                              strokeWidth: 2,
                              stroke: '#fff'
                            }}
                            activeDot={{ 
                              r: 7, 
                              fill: statusColors.chartColor,
                              strokeWidth: 2,
                              stroke: '#fff',
                              strokeDasharray: '0'
                            }}
                            name={`${kpi.name}`}
                            animationDuration={800}
                            animationEasing="ease-out"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                        {/* Estadísticas resumidas */}
                        <div className="grid grid-cols-3 gap-3 pt-2">
                          <div className="text-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-500 mb-1">Valor Mínimo</div>
                            <div className="text-sm font-semibold text-gray-700">
                              {minValue.toLocaleString('es-MX', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-500 mb-1">Promedio</div>
                            <div className="text-sm font-semibold text-gray-700">
                              {avgValue.toLocaleString('es-MX', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-500 mb-1">Valor Máximo</div>
                            <div className="text-sm font-semibold text-gray-700">
                              {maxValue.toLocaleString('es-MX', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Info className="h-6 w-6 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">No hay datos históricos disponibles</span>
                    <span className="text-xs text-gray-400 mt-1">
                      Los datos históricos aparecerán aquí cuando se registren valores para este KPI
                    </span>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Botones de acción */}
            {onClick && (
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                >
                  <Activity className="h-3 w-3 mr-1" />
                  Actualizar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

