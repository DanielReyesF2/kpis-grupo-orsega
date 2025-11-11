import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, TrendingUp, AlertTriangle, XCircle, Eye, ArrowUp, ArrowDown, Minus, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { CollaboratorKPIsExpanded } from './CollaboratorKPIsExpanded';

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
  onViewDetails?: (collaborator: CollaboratorScore) => void;
  onUpdateKpi?: (kpiId: number) => void;
  delay?: number;
}

const getStatusColors = (status: string) => {
  switch (status) {
    case 'excellent':
      return { 
        bg: 'bg-green-50', 
        border: 'border-green-300', 
        text: 'text-green-700', 
        fill: 'fill-green-500',
        badge: 'bg-green-100 border-green-300 text-green-800'
      };
    case 'good':
      return { 
        bg: 'bg-blue-50', 
        border: 'border-blue-300', 
        text: 'text-blue-700', 
        fill: 'fill-blue-500',
        badge: 'bg-blue-100 border-blue-300 text-blue-800'
      };
    case 'regular':
      return { 
        bg: 'bg-amber-50', 
        border: 'border-amber-300', 
        text: 'text-amber-700', 
        fill: 'fill-amber-500',
        badge: 'bg-amber-100 border-amber-300 text-amber-800'
      };
    case 'critical':
      return { 
        bg: 'bg-red-50', 
        border: 'border-red-300', 
        text: 'text-red-700', 
        fill: 'fill-red-500',
        badge: 'bg-red-100 border-red-300 text-red-800'
      };
    default:
      return { 
        bg: 'bg-gray-50', 
        border: 'border-gray-300', 
        text: 'text-gray-700', 
        fill: 'fill-gray-500',
        badge: 'bg-gray-100 border-gray-300 text-gray-800'
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

export function CollaboratorCard({ collaborator, onViewDetails, onUpdateKpi, delay = 0 }: CollaboratorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusColors = getStatusColors(collaborator.status);

  // Generar iniciales del nombre
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
    // Si hay un callback opcional, llamarlo también
    if (onViewDetails && !isExpanded) {
      onViewDetails(collaborator);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      className="w-full"
    >
      <Card
        className={`w-full transition-all duration-200 border ${statusColors.border} ${statusColors.bg} shadow-md hover:shadow-lg ${isExpanded ? 'mb-0' : 'mb-5'}`}
      >
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
            
            {/* LEFT: Avatar + Name + Status */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${statusColors.bg} ${statusColors.border} border shadow-sm`}>
                <span className="text-lg font-bold text-gray-800">
                  {getInitials(collaborator.name)}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-0.5">
                  {collaborator.name}
                </h3>
                <Badge className={`${statusColors.badge} border flex items-center gap-1 px-2 py-0.5 text-xs`}>
                  {getStatusIcon(collaborator.status)}
                  <span className="font-medium">{getStatusText(collaborator.status)}</span>
                </Badge>
              </div>
            </div>

            {/* CENTER: KPIs Summary */}
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 lg:gap-6 w-full lg:w-auto">

              {/* KPIs Summary - Compacto */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {collaborator.compliantKpis}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">Cumplidos</div>
                </div>
                <div className="h-10 w-px bg-gray-300" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {collaborator.alertKpis}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">En Riesgo</div>
                </div>
                <div className="h-10 w-px bg-gray-300" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {collaborator.notCompliantKpis}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">Críticos</div>
                </div>
              </div>
            </div>

            {/* RIGHT: Button */}
            <div className="flex items-center justify-end w-full lg:w-auto lg:pl-4 lg:border-l lg:border-gray-300">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border border-gray-300 hover:bg-gray-50 flex-shrink-0 px-4 py-2 h-auto font-medium flex items-center gap-2"
                onClick={handleToggleExpanded}
              >
                <Eye className="h-3.5 w-3.5" />
                {isExpanded ? 'Ocultar KPIs' : 'Ver KPIs'}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Panel expandible con KPIs - Similar a Neon table expansion */}
      {isExpanded && onUpdateKpi && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full overflow-hidden"
        >
          <CollaboratorKPIsExpanded
            collaborator={collaborator}
            onUpdateKpi={onUpdateKpi}
          />
        </motion.div>
      )}
    </motion.div>
  );
}


