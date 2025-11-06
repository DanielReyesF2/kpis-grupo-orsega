import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'stable';
  percentage?: number;
}

export function TrendIndicator({ trend, percentage }: TrendIndicatorProps) {
  const config = {
    up: {
      icon: TrendingUp,
      label: 'Alza',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    down: {
      icon: TrendingDown,
      label: 'Baja',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    stable: {
      icon: Minus,
      label: 'Estable',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
  };

  const { icon: Icon, label, className } = config[trend];

  return (
    <Badge variant="outline" className={`${className} gap-1`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {percentage !== undefined && (
        <span className="ml-1">({percentage >= 0 ? '+' : ''}{percentage.toFixed(2)}%)</span>
      )}
    </Badge>
  );
}

