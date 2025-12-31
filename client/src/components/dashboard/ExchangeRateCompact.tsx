/**
 * Exchange Rate Compact - Versión minimalista para el dashboard
 * Muestra los 3 tipos de cambio en una barra horizontal elegante
 */

import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';

interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  date: string;
}

const sourceConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  'Santander': { label: 'Santander', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
  'MONEX': { label: 'MONEX', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  'DOF': { label: 'DOF', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
};

export function ExchangeRateCompact() {
  const [, navigate] = useLocation();

  const { data: exchangeRates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/treasury/exchange-rates'],
    staleTime: 0,
    refetchInterval: 60000,
  });

  // Obtener la última tasa de cada fuente
  const getLatestBySource = (source: string): ExchangeRate | null => {
    const rates = exchangeRates.filter(r => r.source === source);
    if (rates.length === 0) return null;
    return rates.reduce((latest, current) =>
      new Date(current.date) > new Date(latest.date) ? current : latest
    );
  };

  const sources = ['Santander', 'MONEX', 'DOF'];
  const latestRates = sources.map(source => ({
    source,
    rate: getLatestBySource(source),
    config: sourceConfig[source]
  }));

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/60">
        <DollarSign className="h-5 w-5 text-primary" />
        <div className="flex gap-6 flex-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate('/treasury')}
      className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
    >
      {/* Icono */}
      <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
        <DollarSign className="h-5 w-5" />
      </div>

      {/* Título */}
      <div className="hidden sm:block">
        <p className="text-sm font-semibold text-foreground">Tipo de Cambio</p>
        <p className="text-xs text-muted-foreground">USD/MXN</p>
      </div>

      {/* Separador */}
      <div className="hidden sm:block w-px h-10 bg-border/60" />

      {/* Tasas */}
      <div className="flex items-center gap-3 sm:gap-6 flex-1 overflow-x-auto">
        {latestRates.map(({ source, rate, config }) => (
          <div
            key={source}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} min-w-fit`}
          >
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-base font-bold text-foreground">
              ${rate?.sell_rate?.toFixed(2) || '--'}
            </span>
          </div>
        ))}
      </div>

      {/* Indicador de ver más */}
      <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        <span>Ver más</span>
        <RefreshCw className="h-3 w-3" />
      </div>
    </div>
  );
}
