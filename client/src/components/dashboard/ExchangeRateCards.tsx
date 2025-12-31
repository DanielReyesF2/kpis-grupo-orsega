/**
 * Exchange Rate Cards - Versión compacta y moderna
 * Muestra tipos de cambio de Santander, MONEX y DOF
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, DollarSign, RefreshCw, Plus } from 'lucide-react';
import { useLocation } from 'wouter';

interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  date: string;
}

interface ExchangeRateCardsProps {
  onUpdateRate?: (source: string) => void;
}

const sourceConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  isSingleRate: boolean;
}> = {
  'Santander': {
    label: 'Santander',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-900/50',
    isSingleRate: false
  },
  'MONEX': {
    label: 'MONEX',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-900/50',
    isSingleRate: false
  },
  'DOF': {
    label: 'DOF',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-900/50',
    isSingleRate: true
  },
};

export function ExchangeRateCards({ onUpdateRate }: ExchangeRateCardsProps) {
  const [, navigate] = useLocation();

  const { data: exchangeRates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/treasury/exchange-rates'],
    staleTime: 0,
    refetchInterval: 60000,
  });

  // Get latest rate per source
  const getLatestBySource = (source: string): ExchangeRate | null => {
    const rates = exchangeRates.filter(r => r.source === source);
    if (rates.length === 0) return null;
    return rates.reduce((latest, current) =>
      new Date(current.date) > new Date(latest.date) ? current : latest
    );
  };

  // Calculate change from previous
  const getChange = (source: string): { buy: number; sell: number } | null => {
    const rates = exchangeRates
      .filter(r => r.source === source)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (rates.length < 2) return null;

    return {
      buy: rates[0].buy_rate - rates[1].buy_rate,
      sell: rates[0].sell_rate - rates[1].sell_rate
    };
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City'
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Mexico_City'
    });
  };

  const TrendIcon = ({ change }: { change: number }) => {
    if (Math.abs(change) < 0.001) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (change > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    return <TrendingDown className="h-3 w-3 text-red-500" />;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4">
            <Skeleton className="h-6 w-24 mb-3" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-4 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  const sources = ['Santander', 'MONEX', 'DOF'];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Tipo de Cambio USD/MXN</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8"
          onClick={() => navigate('/treasury')}
        >
          Ver histórico
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sources.map(source => {
          const config = sourceConfig[source];
          const rate = getLatestBySource(source);
          const change = getChange(source);

          return (
            <Card
              key={source}
              className={`overflow-hidden border ${config.borderColor} hover:shadow-md transition-shadow`}
            >
              <CardContent className="p-4">
                {/* Source Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-semibold text-sm ${config.color}`}>
                    {config.label}
                  </span>
                  {rate && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(rate.date)} {formatTime(rate.date)}
                    </span>
                  )}
                </div>

                {rate ? (
                  <>
                    {/* Rate Display */}
                    {config.isSingleRate ? (
                      /* DOF - Single Rate */
                      <div className={`p-3 rounded-lg ${config.bgColor} mb-3`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Tipo de cambio</span>
                          <div className="flex items-center gap-1">
                            {change && <TrendIcon change={change.sell} />}
                            {change && Math.abs(change.sell) >= 0.001 && (
                              <span className={`text-[10px] ${change.sell > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {change.sell > 0 ? '+' : ''}{change.sell.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                          ${rate.sell_rate.toFixed(4)}
                        </p>
                      </div>
                    ) : (
                      /* Santander/MONEX - Buy/Sell */
                      <div className={`grid grid-cols-2 gap-2 p-3 rounded-lg ${config.bgColor} mb-3`}>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-muted-foreground uppercase">Compra</span>
                            {change && <TrendIcon change={change.buy} />}
                          </div>
                          <p className="text-lg font-bold">${rate.buy_rate.toFixed(4)}</p>
                          {change && Math.abs(change.buy) >= 0.001 && (
                            <span className={`text-[10px] ${change.buy > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {change.buy > 0 ? '+' : ''}{change.buy.toFixed(4)}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-muted-foreground uppercase">Venta</span>
                            {change && <TrendIcon change={change.sell} />}
                          </div>
                          <p className="text-lg font-bold">${rate.sell_rate.toFixed(4)}</p>
                          {change && Math.abs(change.sell) >= 0.001 && (
                            <span className={`text-[10px] ${change.sell > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {change.sell > 0 ? '+' : ''}{change.sell.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Spread (only for non-DOF) */}
                    {!config.isSingleRate && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span>Spread</span>
                        <span className="font-medium">
                          ${(rate.sell_rate - rate.buy_rate).toFixed(4)}
                        </span>
                      </div>
                    )}

                    {/* Update Button */}
                    {onUpdateRate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => onUpdateRate(source)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Actualizar {config.label}
                      </Button>
                    )}
                  </>
                ) : (
                  /* No Data */
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm mb-2">Sin datos</p>
                    {onUpdateRate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => onUpdateRate(source)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
