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
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

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
  const statusColors = getStatusColor(kpi.status);
  
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
        className={`h-full cursor-pointer transition-all duration-200 border-2 ${statusColors.border} ${statusColors.bg} hover:shadow-lg hover:border-opacity-70`}
        onClick={onClick}
        data-onboarding="kpi-card"
      >
        <CardContent className="p-5">
          <div className="space-y-4">
            {/* Header con nombre y badge */}
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
                {kpi.responsible && (
                  <span className="truncate ml-2" title={kpi.responsible}>
                    👤 {kpi.responsible}
                  </span>
                )}
              </div>
            </div>

            {/* Mini gráfico de tendencia */}
            {chartData.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={statusColors.chartColor}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: `1px solid ${statusColors.border.replace('border-', '')}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          padding: '4px 8px'
                        }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0] && payload[0].payload) {
                            return payload[0].payload.date || label;
                          }
                          return label;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Botón de Detalles Extendidos */}
            {onViewDetails && (
              <div className="pt-3 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails();
                  }}
                >
                  <Info className="h-3 w-3 mr-1" />
                  Ver Detalles Extendidos
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

