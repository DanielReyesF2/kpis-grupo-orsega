import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, RefreshCw, DollarSign, Building2, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  date: string;
}

export function ExchangeRateCards() {
  const { data: exchangeRates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/treasury/exchange-rates'],
    staleTime: 1 * 60 * 1000, // Cache por 1 minuto
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Obtener los tipos de cambio más recientes de cada fuente
  const getLatestRate = (source: string) => {
    const rates = exchangeRates.filter(rate => rate.source === source);
    return rates.length > 0 ? rates[0] : null;
  };

  const santanderRate = getLatestRate('Santander');
  const monexRate = getLatestRate('MONEX');
  const dofRate = getLatestRate('DOF');

  // Calcular tendencia comparando con el segundo más reciente
  const getTrend = (source: string) => {
    const rates = exchangeRates.filter(rate => rate.source === source);
    if (rates.length < 2) return 'stable';
    const latest = rates[0];
    const previous = rates[1];
    if (latest.buy_rate > previous.buy_rate) return 'up';
    if (latest.buy_rate < previous.buy_rate) return 'down';
    return 'stable';
  };

  const getSourceConfig = (source: string) => {
    const configs: Record<string, { gradient: string; icon: any; color: string }> = {
      'Santander': {
        gradient: 'from-red-500 to-red-600',
        icon: Building2,
        color: 'text-red-600'
      },
      'MONEX': {
        gradient: 'from-blue-500 to-blue-600',
        icon: DollarSign,
        color: 'text-blue-600'
      },
      'DOF': {
        gradient: 'from-emerald-500 to-emerald-600',
        icon: FileText,
        color: 'text-emerald-600'
      }
    };
    return configs[source] || { gradient: 'from-gray-500 to-gray-600', icon: DollarSign, color: 'text-gray-600' };
  };

  const RateCard = ({ 
    source, 
    rate, 
    isLoading: cardLoading
  }: { 
    source: string; 
    rate: ExchangeRate | null; 
    isLoading: boolean;
  }) => {
    const trend = rate ? getTrend(source) : 'stable';
    const config = getSourceConfig(source);
    const Icon = config.icon;
    
    return (
        <Card className="border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden relative bg-white dark:bg-gray-800">
          {/* Gradient accent bar */}
          <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />
          
          <CardHeader className="pb-4 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-lg`}>
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                  {source}
                </CardTitle>
              </div>
              {cardLoading ? (
                <Skeleton className="h-7 w-7 rounded-full" />
              ) : trend === 'up' ? (
                <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800">
                  <TrendingUp className="h-4 w-4 text-green-700 dark:text-green-400" />
                  <span className="text-xs font-bold text-green-700 dark:text-green-400">↑</span>
                </div>
              ) : trend === 'down' ? (
                <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800">
                  <TrendingDown className="h-4 w-4 text-red-700 dark:text-red-400" />
                  <span className="text-xs font-bold text-red-700 dark:text-red-400">↓</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                  <Minus className="h-4 w-4 text-gray-500" />
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="pt-0 pb-5">
            {cardLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : rate ? (
              <div className="space-y-4">
                {/* Compra y Venta en grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Compra */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-2 uppercase tracking-wider">
                      Compra
                    </div>
                    <div className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
                      ${rate.buy_rate.toFixed(2)}
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">USD → MXN</div>
                  </div>
                  
                  {/* Venta */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-2 uppercase tracking-wider">
                      Venta
                    </div>
                    <div className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
                      ${rate.sell_rate.toFixed(2)}
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">MXN → USD</div>
                  </div>
                </div>
                
                {/* Spread */}
                <div className="flex items-center justify-between text-sm pt-3 mt-3 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-4 py-2.5">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Spread</span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    ${(rate.sell_rate - rate.buy_rate).toFixed(2)}
                  </span>
                </div>
                
                {/* Fecha */}
                {rate.date && (
                  <div className="text-xs text-gray-700 dark:text-gray-300 text-center font-semibold mt-2">
                    Actualizado: {new Date(rate.date).toLocaleString('es-MX', { 
                      day: '2-digit', 
                      month: 'short', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <Icon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">Sin datos disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-xs">Actualizando...</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RateCard source="Santander" rate={santanderRate} isLoading={isLoading} />
        <RateCard source="MONEX" rate={monexRate} isLoading={isLoading} />
        <RateCard source="DOF" rate={dofRate} isLoading={isLoading} />
      </div>
    </div>
  );
}
