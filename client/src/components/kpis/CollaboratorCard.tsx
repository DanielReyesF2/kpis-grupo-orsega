import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, CheckCircle, TrendingUp, AlertTriangle, XCircle, Eye, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
      >
        <CardContent className="p-5">
          <div className="space-y-4">
            {/* Header con nombre y badge */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white text-sm font-bold shadow-md flex-shrink-0">
                  {getInitials(collaborator.name)}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold text-gray-900 leading-tight truncate">
                    {collaborator.name}
                  </CardTitle>
                </div>
              </div>
              <Badge className={`${statusColors.badge} border flex items-center gap-1 px-2 py-1 flex-shrink-0`}>
                {getStatusIcon(collaborator.status)}
                <span className="text-xs">{getStatusText(collaborator.status)}</span>
              </Badge>
            </div>

            {/* Score destacado - Mostrar averageCompliance como porcentaje grande */}
            <div className="text-center py-3 border-t border-gray-200/50 pt-4">
              <div className="text-4xl font-bold text-gray-900 mb-1">
                {collaborator.averageCompliance}%
              </div>
              <div className="text-xs text-gray-600/70">{getStatusMessage(collaborator.status)}</div>
              <div className="text-xs text-gray-500/60 mt-1">Score: {collaborator.score}</div>
            </div>

            {/* Bloque de tendencia */}
            {collaborator.scoreChange !== null && collaborator.scoreChange !== undefined ? (
              <div className={`flex items-center justify-center gap-2 py-2 rounded-lg ${
                collaborator.trendDirection === 'up' 
                  ? 'bg-green-50/30 border border-green-200/40' 
                  : collaborator.trendDirection === 'down'
                  ? 'bg-red-50/30 border border-red-200/40'
                  : 'bg-gray-50/30 border border-gray-200/40'
              }`}>
                {collaborator.trendDirection === 'up' && (
                  <ArrowUp className="h-4 w-4 text-green-600/70" />
                )}
                {collaborator.trendDirection === 'down' && (
                  <ArrowDown className="h-4 w-4 text-red-600/70" />
                )}
                {collaborator.trendDirection === 'stable' && (
                  <Minus className="h-4 w-4 text-gray-500/70" />
                )}
                <span className={`text-sm font-semibold ${
                  collaborator.trendDirection === 'up' 
                    ? 'text-green-600/70' 
                    : collaborator.trendDirection === 'down'
                    ? 'text-red-600/70'
                    : 'text-gray-600/70'
                }`}>
                  {collaborator.scoreChange > 0 ? '+' : ''}{collaborator.scoreChange} pts {collaborator.scoreChangePeriod || ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center py-2 rounded-lg bg-gray-50/20 border border-gray-200/30">
                <span className="text-xs text-gray-500/70">Sin comparación aún</span>
              </div>
            )}

            {/* Resumen de KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className={`text-center p-3 rounded-lg border ${statusColors.border} ${collaborator.compliantKpis > 0 ? 'bg-green-50/30' : 'bg-gray-50/20'}`}>
                <div className={`text-2xl font-bold ${collaborator.compliantKpis > 0 ? 'text-green-600/70' : 'text-gray-400/50'}`}>
                  {collaborator.compliantKpis}
                </div>
                <div className="text-xs text-gray-600/70 mt-1">Cumplidos</div>
              </div>
              <div className={`text-center p-3 rounded-lg border ${statusColors.border} ${collaborator.alertKpis > 0 ? 'bg-amber-50/30' : 'bg-gray-50/20'}`}>
                <div className={`text-2xl font-bold ${collaborator.alertKpis > 0 ? 'text-amber-600/70' : 'text-gray-400/50'}`}>
                  {collaborator.alertKpis}
                </div>
                <div className="text-xs text-gray-600/70 mt-1">En Riesgo</div>
              </div>
              <div className={`text-center p-3 rounded-lg border ${statusColors.border} ${collaborator.notCompliantKpis > 0 ? 'bg-red-50/30' : 'bg-gray-50/20'}`}>
                <div className={`text-2xl font-bold ${collaborator.notCompliantKpis > 0 ? 'text-red-600/70' : 'text-gray-400/50'}`}>
                  {collaborator.notCompliantKpis}
                </div>
                <div className="text-xs text-gray-600/70 mt-1">No Cumplidos</div>
              </div>
            </div>

            {/* Métricas adicionales */}
            <div className="space-y-2 pt-2 border-t border-gray-200/50">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600/70">Cumplimiento promedio</span>
                <span className={`font-semibold ${statusColors.text}`}>
                  {collaborator.averageCompliance.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600/70">Total KPIs</span>
                <span className="font-semibold text-gray-900">{collaborator.totalKpis}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600/70">Último avance</span>
                <span className="text-xs font-medium text-gray-700/70">{formatLastUpdate()}</span>
              </div>
            </div>

            {/* Botón de acción */}
            <Button 
              variant="outline"
              size="sm"
              className="w-full text-xs border-gray-200/50 hover:bg-gray-50/50"
              onClick={() => onViewDetails(collaborator)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver Detalles de KPIs
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


