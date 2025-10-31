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
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

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
  };
  onClick?: () => void;
  onViewDetails?: () => void;
  delay?: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'excellent':
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', fill: 'fill-green-500', chartColor: '#10b981' };
    case 'good':
      return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', fill: 'fill-blue-500', chartColor: '#3b82f6' };
    case 'warning':
      return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', fill: 'fill-yellow-500', chartColor: '#f59e0b' };
    case 'critical':
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', fill: 'fill-red-500', chartColor: '#ef4444' };
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', fill: 'fill-gray-500', chartColor: '#6b7280' };
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

export function EnhancedKpiCard({ kpi, onClick, onViewDetails, delay = 0 }: EnhancedKpiCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusColors = getStatusColor(kpi.status);
  
  // Cargar historial completo cuando se expanda
  // Usar endpoint genérico que automáticamente busca en las tablas correctas
  const historyEndpoint = `/api/kpi-history/${kpi.id}`;
  
  const { data: fullHistory, isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [historyEndpoint, { months: 12 }],
    enabled: isExpanded && !!kpi.id,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
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
    return fullHistory
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.period).getTime();
        const dateB = new Date(b.date || b.period).getTime();
        return dateA - dateB;
      })
      .map((item: any, index: number) => ({
        name: item.period || `Periodo ${index + 1}`,
        value: parseFloat(item.value?.toString() || '0'),
        period: item.period || '',
        date: item.date ? new Date(item.date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : ''
      }));
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card 
        className={`h-full transition-all duration-200 border-2 ${statusColors.border} ${statusColors.bg} hover:shadow-lg hover:border-opacity-70`}
        data-onboarding="kpi-card"
      >
        <CardContent className="p-5">
          <div className="space-y-4">
            {/* Header con responsable prominente y nombre del KPI */}
            <div className="space-y-2">
              {/* Responsable destacado */}
              {kpi.responsible && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#0080ff] text-white text-xs font-bold shadow-md">
                    {kpi.responsible.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{kpi.responsible}</p>
                    {kpi.company && (
                      <p className="text-xs text-gray-500">{kpi.company}</p>
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
                  <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
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
                ) : fullHistoryData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={fullHistoryData} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 10 }}
                            interval={0}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: `1px solid ${statusColors.border.replace('border-', '')}`,
                              borderRadius: '6px',
                              fontSize: '12px',
                              padding: '6px 10px'
                            }}
                            formatter={(value: any) => [`${value} ${kpi.unit}`, 'Valor']}
                            labelFormatter={(label) => `Periodo: ${label}`}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={statusColors.chartColor}
                            strokeWidth={3}
                            dot={{ r: 4, fill: statusColors.chartColor }}
                            activeDot={{ r: 6 }}
                            name={`${kpi.name} (${kpi.unit})`}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      Mostrando {fullHistoryData.length} puntos de datos históricos
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No hay datos históricos disponibles
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-3 border-t border-gray-200">
              {onClick && (
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
              )}
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails();
                  }}
                >
                  <Info className="h-3 w-3 mr-1" />
                  Detalles
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

