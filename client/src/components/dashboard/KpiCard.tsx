import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle, BarChart, Clock, User, Target, TrendingUp, TrendingDown, RefreshCw, Zap, ShieldAlert, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { KpiStatus } from '@/lib/utils/kpi-status';
import { getStatusColor, getStatusText } from '@/lib/utils/kpi-status';
import { translateStatus, translateFrequency } from '@/lib/utils/dates';
import { formatDateAndTime, timeAgo } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';

interface KpiCardProps {
  id: number;
  name: string;
  target: string;
  currentValue: string;
  status: KpiStatus;
  compliancePercentage?: string;
  frequency?: string;
  responsible?: string;
  unit?: string;
  lastUpdated?: Date | string;
  onViewDetails: (id: number) => void;
}

// Función para determinar si una actualización es reciente (en las últimas 24 horas)
const isRecentUpdate = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  // Diferencia en milisegundos
  const diffMs = now.getTime() - dateObj.getTime();
  
  // Convertir a días
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  // Devolver true si es menor a 1 día
  return diffDays < 1;
};

export function KpiCard({
  id,
  name,
  target,
  currentValue,
  status,
  compliancePercentage,
  frequency,
  responsible,
  unit,
  lastUpdated,
  onViewDetails
}: KpiCardProps) {
  const getProgressBarColor = () => {
    switch (status) {
      case 'complies':
        return 'bg-green-400/60 dark:bg-green-500/60';
      case 'alert':
        return 'bg-amber-400/60 dark:bg-amber-500/60';
      case 'not_compliant':
        return 'bg-red-400/60 dark:bg-red-500/60';
      default:
        return 'bg-gray-500 dark:bg-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'complies':
        return <CheckCircle className="h-6 w-6 text-green-500/70 dark:text-green-400/70" />;
      case 'alert':
        return <ShieldAlert className="h-6 w-6 text-amber-500/70 dark:text-amber-400/70" />;
      case 'not_compliant':
        return <CircleX className="h-6 w-6 text-red-500/70 dark:text-red-400/70" />;
      default:
        return null;
    }
  };

  const getCompliancePercentage = () => {
    if (compliancePercentage) {
      return compliancePercentage;
    }
    
    switch (status) {
      case 'complies':
        return '100%';
      case 'alert':
        return '85%';
      case 'not_compliant':
        return currentValue.includes('%') 
          ? currentValue 
          : '0%';
    }
  };

  const getValueColor = () => {
    switch (status) {
      case 'complies':
        return 'text-green-600/70 dark:text-green-400/70';
      case 'alert':
        return 'text-amber-600/70 dark:text-amber-400/70';
      case 'not_compliant':
        return 'text-red-600/70 dark:text-red-400/70';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getStatusBadgeVariant = () => {
    switch (status) {
      case 'complies':
        return 'outline';
      case 'alert':
        return 'outline';
      case 'not_compliant':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeStyle = () => {
    switch (status) {
      case 'complies':
        return 'border-green-300/50 bg-green-50/30 text-green-600/70 dark:border-green-500/40 dark:bg-green-500/20 dark:text-green-400/70';
      case 'alert':
        return 'border-amber-300/50 bg-amber-50/30 text-amber-600/70 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400/70';
      case 'not_compliant':
        return 'border-red-300/50 bg-red-50/30 text-red-600/70 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-400/70';
      default:
        return 'border-gray-300 bg-gray-100/20 text-gray-500 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-400';
    }
  };

  // Calcular si hay variación positiva o negativa
  const getVariationIcon = () => {
    switch (status) {
      case 'complies':
        return <TrendingUp className="h-3.5 w-3.5 text-green-500/70 dark:text-green-400/70" />;
      case 'alert':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500/70 dark:text-amber-400/70" />;
      case 'not_compliant':
        return <TrendingDown className="h-3.5 w-3.5 text-red-500/70 dark:text-red-400/70" />;
      default:
        return null;
    }
  };

  const getVariationText = () => {
    switch (status) {
      case 'complies':
        return '+12.35%';
      case 'alert':
        return '-3.6%';
      case 'not_compliant':
        return '-7.8%';
      default:
        return '0%';
    }
  };

  const getVariationClass = () => {
    switch (status) {
      case 'complies':
        return 'text-green-500/70 dark:text-green-400/70';
      case 'alert':
        return 'text-amber-500/70 dark:text-amber-400/70';
      case 'not_compliant':
        return 'text-red-500/70 dark:text-red-400/70';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <Card className={`border-0 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${
      status === 'alert' ? 'ring-2 ring-amber-200/30 ring-opacity-20' :
      status === 'not_compliant' ? 'ring-2 ring-red-200/30 ring-opacity-20' :
      status === 'complies' ? 'ring-1 ring-green-200/30 ring-opacity-15' : ''
    }`}>
      <CardHeader className="p-4 border-b border-primary-200/20 dark:border-primary-800/30 flex justify-between items-start">
        <div>
          <h3 className="font-medium text-primary-900 dark:text-white mb-1 font-ruda">{name}</h3>
          {frequency && (
            <div className="flex items-center text-xs text-primary-600 dark:text-primary-400">
              <Clock className="h-3 w-3 mr-1" />
              <span>{translateFrequency(frequency)}</span>
            </div>
          )}
        </div>
        <Badge 
          variant={getStatusBadgeVariant() as any} 
          className={`ml-2 ${getStatusBadgeStyle()}`}
        >
          {translateStatus(status)}
        </Badge>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 flex flex-col">
            <span className="text-xs text-primary-600 dark:text-primary-400 mb-1">Objetivo</span>
            <span className="text-lg font-medium text-primary-900 dark:text-white font-anton">
              {target}
              <span className="text-xs text-primary-500 dark:text-primary-400 ml-1.5">
                {unit && `(${unit})`}
              </span>
            </span>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 flex flex-col">
            <span className="text-xs text-primary-600 dark:text-primary-400 mb-1">Valor actual</span>
            <div className="flex items-end gap-2">
              <span className={`text-lg font-medium font-anton ${getValueColor()}`}>
                {currentValue}
              </span>
              <div className={`flex items-center text-xs ${getVariationClass()}`}>
                {getVariationIcon()}
                <span className="ml-0.5">{getVariationText()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-1.5">
          {lastUpdated && (
            <div className="flex flex-col gap-0.5">
              <span className="text-primary-600 dark:text-primary-400 text-xs flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>Actualizado: {typeof lastUpdated === 'string' ? lastUpdated : formatDateAndTime(lastUpdated)}</span>
              </span>
              <span className="text-xs flex items-center font-medium" 
                style={{ 
                  color: isRecentUpdate(lastUpdated) ? '#10b981' : '#6b7280'
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" 
                  style={{ 
                    color: isRecentUpdate(lastUpdated) ? '#10b981' : '#6b7280'
                  }}
                />
                <span>{timeAgo(lastUpdated)}</span>
              </span>
            </div>
          )}
          
          <div className="flex justify-end items-center mt-1">
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-accent hover:text-accent/80 dark:text-accent dark:hover:text-accent/80 font-medium"
              onClick={() => onViewDetails(id)}
            >
              Ver detalles
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
