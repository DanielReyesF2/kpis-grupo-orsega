import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { getRateDisplayConfig } from '@/lib/utils/exchange-rates';

interface RangeDataPoint {
  date: string;
  hour?: string;
  timestamp?: string;
  santander?: number;
  monex?: number;
  dof?: number;
}

interface RateHistoryEntry {
  date: string;
  hour?: string;
  timestamp?: string;
  sources: {
    santander?: { buy?: number; sell?: number };
    monex?: { buy?: number; sell?: number };
    dof?: { buy?: number; sell?: number };
  };
}

export function ExchangeRateHistoryV2() {
  // Configuración simplificada: último mes, todas las fuentes
  const selectedSources = ['monex', 'santander', 'dof'];
  
  // Calcular fechas: último mes
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return { startDate: subDays(today, 30), endDate: today };
  }, []);

  // Intervalo de agregación: día
  const interval = 'day';

  // Query para datos de compra
  const { data: buyData, isLoading: isLoadingBuy } = useQuery<RangeDataPoint[]>({
    queryKey: ['/api/treasury/exchange-rates/range', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      rateType: 'buy',
      sources: selectedSources,
      interval,
    }],
    staleTime: 5 * 60 * 1000,
    enabled: !!startDate && !!endDate && selectedSources.length > 0,
  });

  // Query para datos de venta
  const { data: sellData, isLoading: isLoadingSell } = useQuery<RangeDataPoint[]>({
    queryKey: ['/api/treasury/exchange-rates/range', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      rateType: 'sell',
      sources: selectedSources,
      interval,
    }],
    staleTime: 5 * 60 * 1000,
    enabled: !!startDate && !!endDate && selectedSources.length > 0,
  });

  // Combinar datos de compra y venta en tarjetas de historial
  const historyEntries = useMemo(() => {
    if (!buyData || !sellData) return [];

    // Crear un mapa por fecha/hora
    const entryMap = new Map<string, RateHistoryEntry>();

    // Procesar datos de compra
    buyData.forEach((point: RangeDataPoint) => {
      const key = point.timestamp || point.date;
      if (!entryMap.has(key)) {
        entryMap.set(key, {
          date: point.date,
          hour: point.hour,
          timestamp: point.timestamp,
          sources: {},
        });
      }
      const entry = entryMap.get(key)!;
      if (point.santander !== undefined) {
        entry.sources.santander = { ...entry.sources.santander, buy: point.santander };
      }
      if (point.monex !== undefined) {
        entry.sources.monex = { ...entry.sources.monex, buy: point.monex };
      }
      if (point.dof !== undefined) {
        entry.sources.dof = { ...entry.sources.dof, buy: point.dof };
      }
    });

    // Procesar datos de venta
    sellData.forEach((point: RangeDataPoint) => {
      const key = point.timestamp || point.date;
      if (!entryMap.has(key)) {
        entryMap.set(key, {
          date: point.date,
          hour: point.hour,
          timestamp: point.timestamp,
          sources: {},
        });
      }
      const entry = entryMap.get(key)!;
      if (point.santander !== undefined) {
        entry.sources.santander = { ...entry.sources.santander, sell: point.santander };
      }
      if (point.monex !== undefined) {
        entry.sources.monex = { ...entry.sources.monex, sell: point.monex };
      }
      if (point.dof !== undefined) {
        entry.sources.dof = { ...entry.sources.dof, sell: point.dof };
      }
    });

    // Ordenar por fecha (más reciente primero) y limitar a 15 entradas
    return Array.from(entryMap.values())
      .sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
        const dateB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 15); // Limitar a las últimas 15 entradas para reducir scroll
  }, [buyData, sellData]);

  // Colores y nombres de fuentes
  const sourceConfig = {
    santander: { label: 'Santander', color: '#16a34a', bgColor: 'bg-green-50 dark:bg-green-800/5' },
    monex: { label: 'MONEX', color: '#2563eb', bgColor: 'bg-blue-50 dark:bg-blue-800/5' },
    dof: { label: 'DOF', color: '#ea580c', bgColor: 'bg-orange-50 dark:bg-orange-800/5' },
  };

  const isLoading = isLoadingBuy || isLoadingSell;

  return (
    <div className="space-y-4">
      {/* Historial en tarjetas - sin filtros */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : historyEntries.length > 0 ? (
          <div className="space-y-3">
            {historyEntries.map((entry, index) => {
              const entryDate = entry.timestamp ? parseISO(entry.timestamp) : parseISO(entry.date);
              const previousEntry = historyEntries[index + 1];
              
              return (
                <Card key={entry.timestamp || entry.date} className="overflow-hidden border">
                  <CardContent className="p-3">
                    {/* Fecha y hora - más compacto */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {format(entryDate, "dd MMM yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>

                    {/* Fuentes - diseño más compacto */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {selectedSources.map(sourceKey => {
                        const typedSourceKey = sourceKey as keyof typeof entry.sources;
                        const source = entry.sources[typedSourceKey];
                        if (!source || (!source.buy && !source.sell)) return null;

                        const config = sourceConfig[sourceKey as keyof typeof sourceConfig];
                        const prevSource = previousEntry?.sources[typedSourceKey];

                        // Calcular tendencias
                        const buyTrend = prevSource?.buy && source.buy
                          ? (source.buy > prevSource.buy ? 'up' : source.buy < prevSource.buy ? 'down' : 'stable')
                          : null;
                        const sellTrend = prevSource?.sell && source.sell
                          ? (source.sell > prevSource.sell ? 'up' : source.sell < prevSource.sell ? 'down' : 'stable')
                          : null;

                        return (
                          <div
                            key={sourceKey}
                            className={`rounded-md p-2.5 border ${config.bgColor}`}
                            style={{ borderColor: config.color + '30' }}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: config.color }}
                              />
                              <span className="font-medium text-xs">{config.label}</span>
                            </div>
                            
                            <div className="space-y-1">
                              {/* Valor único o Compra */}
                              {source.buy && (() => {
                                const displayConfig = getRateDisplayConfig(sourceKey);
                                return (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{displayConfig.buyLabel}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold text-xs">${source.buy.toFixed(4)}</span>
                                      {buyTrend && (
                                        <>
                                          {buyTrend === 'up' && <TrendingUp className="h-2.5 w-2.5 text-green-600" />}
                                          {buyTrend === 'down' && <TrendingDown className="h-2.5 w-2.5 text-red-600" />}
                                          {buyTrend === 'stable' && <Minus className="h-2.5 w-2.5 text-gray-500" />}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                              
                              {/* Venta - solo para fuentes con dos valores */}
                              {source.sell && (() => {
                                const displayConfig = getRateDisplayConfig(sourceKey);
                                if (displayConfig.isSingle) return null;
                                return (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{displayConfig.sellLabel}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold text-xs">${source.sell.toFixed(4)}</span>
                                      {sellTrend && (
                                        <>
                                          {sellTrend === 'up' && <TrendingUp className="h-2.5 w-2.5 text-green-600" />}
                                          {sellTrend === 'down' && <TrendingDown className="h-2.5 w-2.5 text-red-600" />}
                                          {sellTrend === 'stable' && <Minus className="h-2.5 w-2.5 text-gray-500" />}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">
              No hay datos disponibles para el periodo seleccionado
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

