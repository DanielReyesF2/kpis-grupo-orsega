import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TrendIndicator } from './TrendIndicator';

export interface ExchangeRateStat {
  source: string;
  average: number;
  max: number;
  min: number;
  volatility: number;
  trend: 'up' | 'down' | 'stable';
  count?: number;
}

interface ExchangeRateStatsProps {
  stats: ExchangeRateStat[];
  className?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  'Monex': '#2563eb',
  'Santander': '#16a34a',
  'Dof': '#ea580c',
  'MONEX': '#2563eb',
  'SANTANDER': '#16a34a',
  'DOF': '#ea580c',
};

export function ExchangeRateStats({ stats, className }: ExchangeRateStatsProps) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className || ''}`}>
      {stats.map((stat) => {
        const sourceColor = SOURCE_COLORS[stat.source] || '#6b7280';
        const spread = stat.max - stat.min;

        return (
          <Card key={stat.source} className="relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ backgroundColor: sourceColor }}
            />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{stat.source}</CardTitle>
                <TrendIndicator trend={stat.trend} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Promedio</p>
                  <p className="text-lg font-semibold">${stat.average.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Spread</p>
                  <p className="text-lg font-semibold">${spread.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Máximo</p>
                  <p className="text-sm font-medium">${stat.max.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mínimo</p>
                  <p className="text-sm font-medium">${stat.min.toFixed(4)}</p>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Volatilidad</p>
                  <p className="text-xs font-medium">{stat.volatility.toFixed(4)}</p>
                </div>
                {stat.count && (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">Registros</p>
                    <p className="text-xs font-medium">{stat.count}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

