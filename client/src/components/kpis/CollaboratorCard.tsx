import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, CheckCircle, TrendingUp, AlertTriangle, XCircle, Eye, ArrowUp, ArrowDown, Minus, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

export interface CollaboratorScore {
  name: string;
  score: number;
  status: 'excellent' | 'good' | 'regular' | 'critical';
  averageCompliance: number;
  compliantKpis: number;
  alertKpis: number;
  notCompliantKpis: number;
  totalKpis: number;
  lastUpdate: string | null;
  scoreChange?: number | null;
  scoreChangePeriod?: string | null;
  trendDirection?: 'up' | 'down' | 'stable' | null;
  historicalCompliance?: Array<{ month: string; compliance: number | null }>;
  advancedTrend?: {
    direction: 'up' | 'down' | 'stable' | null;
    strength: number;
    slope: number;
    r2: number;
  };
  kpis: Array<{
    id: number;
    name: string;
    compliance: number;
    complianceChange?: number | null;
    trendDirection?: 'up' | 'down' | 'stable' | null;
    status: string;
    [key: string]: any;
  }>;
}

interface CollaboratorCardProps {
  collaborator: CollaboratorScore;
  onViewDetails: (collaborator: CollaboratorScore) => void;
  delay?: number;
}

const getStatusColors = (status: string) => {
  switch (status) {
    case 'excellent':
      return { 
        bg: 'bg-green-50/30', 
        border: 'border-green-200/40', 
        text: 'text-green-600/70', 
        fill: 'fill-green-400/60',
        badge: 'bg-green-50/50 border-green-200/60 text-green-700/80'
      };
    case 'good':
      return { 
        bg: 'bg-blue-50/30', 
        border: 'border-blue-200/40', 
        text: 'text-blue-600/70', 
        fill: 'fill-blue-400/60',
        badge: 'bg-blue-50/50 border-blue-200/60 text-blue-700/80'
      };
    case 'regular':
      return { 
        bg: 'bg-amber-50/30', 
        border: 'border-amber-200/40', 
        text: 'text-amber-600/70', 
        fill: 'fill-amber-400/60',
        badge: 'bg-amber-50/50 border-amber-200/60 text-amber-700/80'
      };
    case 'critical':
      return { 
        bg: 'bg-red-50/30', 
        border: 'border-red-200/40', 
        text: 'text-red-600/70', 
        fill: 'fill-red-400/60',
        badge: 'bg-red-50/50 border-red-200/60 text-red-700/80'
      };
    default:
      return { 
        bg: 'bg-gray-50/30', 
        border: 'border-gray-200/40', 
        text: 'text-gray-600/70', 
        fill: 'fill-gray-400/60',
        badge: 'bg-gray-50/50 border-gray-200/60 text-gray-700/80'
      };
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'excellent':
      return <CheckCircle className="h-4 w-4" />;
    case 'good':
      return <TrendingUp className="h-4 w-4" />;
    case 'regular':
      return <AlertTriangle className="h-4 w-4" />;
    case 'critical':
      return <XCircle className="h-4 w-4" />;
    default:
      return null;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'excellent':
      return 'Excelente';
    case 'good':
      return 'Bueno';
    case 'regular':
      return 'Regular';
    case 'critical':
      return 'Crítico';
    default:
      return 'Sin estado';
  }
};

const getStatusMessage = (status: string) => {
  switch (status) {
    case 'excellent':
      return 'Muy buen progreso';
    case 'good':
      return 'Buen desempeño';
    case 'regular':
      return 'Necesita atención';
    case 'critical':
      return 'Requiere acción inmediata';
    default:
      return 'Sin estado';
  }
};

export function CollaboratorCard({ collaborator, onViewDetails, delay = 0 }: CollaboratorCardProps) {
  const statusColors = getStatusColors(collaborator.status);

  const formatLastUpdate = () => {
    if (!collaborator.lastUpdate) return 'Sin actualizaciones';
    try {
      const date = new Date(collaborator.lastUpdate);
      const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Hoy';
      if (days === 1) return 'Ayer';
      if (days < 7) return `Hace ${days} días`;
      return format(date, 'dd/MM/yyyy', { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  // Generar iniciales del nombre
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Preparar datos para el sparkline
  const sparklineData = collaborator.historicalCompliance?.map(item => ({
    month: item.month,
    value: item.compliance ?? 0
  })) || [];

  // Color de la línea basado en la tendencia
  const getTrendColor = () => {
    if (!collaborator.advancedTrend) return '#6B7280';
    switch (collaborator.advancedTrend.direction) {
      case 'up': return '#10B981';
      case 'down': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
      className="w-full"
    >
      <Card
        className={`w-full transition-all duration-200 border-2 ${statusColors.border} ${statusColors.bg} shadow-lg hover:shadow-xl hover:border-opacity-70`}
      >
        <CardContent className="px-4 py-5 md:px-8 md:py-6 min-h-[160px]">
          {/* HORIZONTAL LAYOUT: Flex row */}
          <div className="flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-10">

            {/* LEFT SECTION: Avatar + Name + Status */}
            <div className="flex items-center gap-4 min-w-[240px] w-full md:w-auto justify-center md:justify-start">
              <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary text-white text-sm md:text-base font-bold shadow-md flex-shrink-0">
                {getInitials(collaborator.name)}
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-semibold text-gray-900 leading-tight truncate text-center md:text-left">
                  {collaborator.name}
                </CardTitle>
                <Badge className={`${statusColors.badge} border flex items-center gap-1 px-3 py-1.5 mt-2 w-fit mx-auto md:mx-0`}>
                  {getStatusIcon(collaborator.status)}
                  <span className="text-xs">{getStatusText(collaborator.status)}</span>
                </Badge>
              </div>
            </div>

            {/* CENTER SECTION: Score + Trend + KPIs Summary */}
            <div className="flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-8 flex-1 w-full md:w-auto border-t-2 border-t-gray-200 md:border-t-0 md:border-l-2 md:border-l-gray-300 pt-4 md:pt-0 md:pl-8">

              {/* Score */}
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900">
                  {collaborator.averageCompliance}%
                </div>
                <div className="text-sm text-gray-500 mt-1">Score: {collaborator.score}</div>
              </div>

              {/* Divider */}
              <div className="hidden md:block h-20 w-px bg-gray-300" />

              {/* Trend Indicator */}
              <div className="min-w-[160px] text-center md:text-left">
                {collaborator.advancedTrend && collaborator.advancedTrend.direction ? (
                  <div className="space-y-2">
                    <div className={`flex items-center justify-center md:justify-start gap-2 ${
                      collaborator.advancedTrend.direction === 'up'
                        ? 'text-green-600'
                        : collaborator.advancedTrend.direction === 'down'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      {collaborator.advancedTrend.direction === 'up' && <TrendingUp className="h-5 w-5" />}
                      {collaborator.advancedTrend.direction === 'down' && <TrendingDown className="h-5 w-5" />}
                      {collaborator.advancedTrend.direction === 'stable' && <Minus className="h-5 w-5" />}
                      <span className="text-sm font-semibold">
                        {collaborator.advancedTrend.direction === 'up' ? 'Mejorando' :
                         collaborator.advancedTrend.direction === 'down' ? 'Declinando' : 'Estable'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Fuerza: {collaborator.advancedTrend.strength}% | R²: {collaborator.advancedTrend.r2}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Sin datos históricos</div>
                )}
              </div>

              {/* Divider */}
              <div className="hidden md:block h-20 w-px bg-gray-300" />

              {/* KPIs Summary */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {collaborator.compliantKpis}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Cumplidos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {collaborator.alertKpis}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">En Riesgo</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {collaborator.notCompliantKpis}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Críticos</div>
                </div>
              </div>
            </div>

            {/* RIGHT SECTION: Sparkline Chart */}
            <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto border-t-2 border-t-gray-200 md:border-t-0 md:border-l-2 md:border-l-gray-300 pt-4 md:pt-0 md:pl-8">
              {sparklineData.length > 0 ? (
                <div className="w-full md:w-[280px] h-20 md:h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={getTrendColor()}
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const value = typeof payload[0].value === 'number' 
                              ? payload[0].value.toFixed(1) 
                              : payload[0].value?.toString() || '0';
                            return (
                              <div className="bg-white p-2 rounded shadow-lg border text-xs">
                                <p className="font-semibold">{payload[0].payload.month}</p>
                                <p className="text-gray-600">{value}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="text-xs text-center text-gray-500 mt-1">Últimos 12 meses</div>
                </div>
              ) : (
                <div className="w-full md:w-[280px] h-20 md:h-24 flex items-center justify-center bg-gray-50 rounded">
                  <span className="text-sm text-gray-400">Sin historial</span>
                </div>
              )}

              {/* Action Button */}
              <Button
                variant="outline"
                size="default"
                className="text-sm border-gray-300 hover:bg-gray-100 flex-shrink-0 px-4 py-2 w-full md:w-auto"
                onClick={() => onViewDetails(collaborator)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver KPIs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


