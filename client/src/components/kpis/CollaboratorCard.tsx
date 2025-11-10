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
      className="w-full"
    >
      <Card
        className={`w-full transition-all duration-200 border ${statusColors.border} ${statusColors.bg} shadow-sm hover:shadow-md hover:border-opacity-70`}
      >
        <CardContent className="px-4 py-4 md:px-6 md:py-4">
          {/* HORIZONTAL LAYOUT: Compacto y optimizado */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">

            {/* LEFT SECTION: Avatar + Name + Status */}
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0 md:min-w-[180px]">
              <div className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-full bg-primary text-white text-xs md:text-sm font-bold shadow-sm flex-shrink-0">
                {getInitials(collaborator.name)}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm md:text-base font-semibold text-gray-900 leading-tight truncate">
                  {collaborator.name}
                </CardTitle>
                <Badge className={`${statusColors.badge} border flex items-center gap-1 px-2 py-0.5 mt-1 w-fit text-xs`}>
                  {getStatusIcon(collaborator.status)}
                  <span className="text-xs">{getStatusText(collaborator.status)}</span>
                </Badge>
              </div>
            </div>

            {/* CENTER SECTION: Score + KPIs Summary */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 flex-1 min-w-0 border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
              {/* Score */}
              <div className="flex items-center gap-3 md:gap-4">
                <div className="text-center md:text-left">
                  <div className="text-2xl md:text-3xl font-bold text-gray-900 leading-none">
                    {collaborator.averageCompliance}%
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Score: {collaborator.score}</div>
                </div>

                {/* Divider */}
                <div className="hidden md:block h-12 w-px bg-gray-200" />

                {/* KPIs Summary - Compacto */}
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-center">
                    <div className="text-lg md:text-xl font-bold text-green-600 leading-none">
                      {collaborator.compliantKpis}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Cumplidos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-xl font-bold text-amber-600 leading-none">
                      {collaborator.alertKpis}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">En Riesgo</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-xl font-bold text-red-600 leading-none">
                      {collaborator.notCompliantKpis}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Críticos</div>
                  </div>
                </div>
              </div>

              {/* Trend Indicator - Compacto */}
              {collaborator.advancedTrend && collaborator.advancedTrend.direction && (
                <>
                  <div className="hidden md:block w-px h-12 bg-gray-200" />
                  <div className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-1 ${
                      collaborator.advancedTrend.direction === 'up'
                        ? 'text-green-600'
                        : collaborator.advancedTrend.direction === 'down'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      {collaborator.advancedTrend.direction === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
                      {collaborator.advancedTrend.direction === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
                      {collaborator.advancedTrend.direction === 'stable' && <Minus className="h-3.5 w-3.5" />}
                      <span className="text-xs font-medium">
                        {collaborator.advancedTrend.direction === 'up' ? 'Mejorando' :
                         collaborator.advancedTrend.direction === 'down' ? 'Declinando' : 'Estable'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT SECTION: Sparkline + Button */}
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-3 w-full md:w-auto border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4 flex-shrink-0">
              {sparklineData.length > 0 ? (
                <div className="w-full md:w-[200px] h-16 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={getTrendColor()}
                        strokeWidth={2}
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
                  <div className="text-xs text-center text-gray-400 mt-0.5">12 meses</div>
                </div>
              ) : (
                <div className="w-full md:w-[200px] h-16 flex items-center justify-center bg-gray-50 rounded flex-shrink-0">
                  <span className="text-xs text-gray-400">Sin historial</span>
                </div>
              )}

              {/* Action Button - Asegurar que quepa */}
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-gray-200 hover:bg-gray-50 flex-shrink-0 px-3 py-1.5 h-auto w-full md:w-auto whitespace-nowrap"
                onClick={() => onViewDetails(collaborator)}
              >
                <Eye className="h-3 w-3 mr-1.5" />
                Ver KPIs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


