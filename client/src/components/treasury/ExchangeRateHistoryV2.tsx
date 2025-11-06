import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, subDays, subMonths, subYears, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PeriodSelector, type PeriodOption } from './PeriodSelector';
import { SourceFilter, type SourceOption } from './SourceFilter';
import { Card, CardContent } from '@/components/ui/card';

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
    santander?: { buy: number; sell: number };
    monex?: { buy: number; sell: number };
    dof?: { buy: number; sell: number };
  };
}

export function ExchangeRateHistoryV2() {
  const [period, setPeriod] = useState<PeriodOption>('1m');
  const [selectedSources, setSelectedSources] = useState<SourceOption[]>(['monex', 'santander', 'dof']);
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date } | null>(null);

  // Calcular fechas según periodo seleccionado
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (dateRange) {
      return dateRange;
    }

    switch (period) {
      case '1w':
        return { startDate: subDays(today, 7), endDate: today };
      case '1m':
        return { startDate: subDays(today, 30), endDate: today };
      case '3m':
        return { startDate: subMonths(today, 3), endDate: today };
      case '6m':
        return { startDate: subMonths(today, 6), endDate: today };
      case '1y':
        return { startDate: subYears(today, 1), endDate: today };
      default:
        return { startDate: subDays(today, 30), endDate: today };
    }
  }, [period, dateRange]);

  // Determinar intervalo de agregación según periodo
  const interval = useMemo(() => {
    if (period === '1w') return 'hour';
    if (period === '1m') return 'day';
    return 'day';
  }, [period]);

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
    buyData.forEach(point => {
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
    sellData.forEach(point => {
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

    // Ordenar por fecha (más reciente primero)
    return Array.from(entryMap.values()).sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [buyData, sellData]);

  // Colores y nombres de fuentes
  const sourceConfig = {
    santander: { label: 'Santander', color: '#16a34a', bgColor: 'bg-green-50 dark:bg-green-950/20' },
    monex: { label: 'MONEX', color: '#2563eb', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
    dof: { label: 'DOF', color: '#ea580c', bgColor: 'bg-orange-50 dark:bg-orange-950/20' },
  };

  const isLoading = isLoadingBuy || isLoadingSell;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <PeriodSelector
          value={period}
          onChange={(p) => {
            setPeriod(p);
            if (p !== 'custom') {
              setDateRange(null);
            }
          }}
          onCustomRangeChange={(start, end) => {
            setDateRange({ startDate: start, endDate: end });
          }}
        />
        <SourceFilter
          selectedSources={selectedSources}
          onChange={setSelectedSources}
          className="w-full md:w-auto"
        />
      </div>

      {/* Historial en tarjetas */}
      <div className="space-y-4">
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
                <Card key={entry.timestamp || entry.date} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Fecha y hora */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {interval === 'hour' && entry.hour
                            ? `${format(entryDate, "dd 'de' MMMM, yyyy", { locale: es })} - ${entry.hour}`
                            : format(entryDate, "dd 'de' MMMM, yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>

                    {/* Fuentes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedSources.map(sourceKey => {
                        const source = entry.sources[sourceKey];
                        if (!source || (!source.buy && !source.sell)) return null;

                        const config = sourceConfig[sourceKey];
                        const prevSource = previousEntry?.sources[sourceKey];

                        // Calcular tendencias
                        const buyTrend = prevSource?.buy 
                          ? (source.buy > prevSource.buy ? 'up' : source.buy < prevSource.buy ? 'down' : 'stable')
                          : null;
                        const sellTrend = prevSource?.sell
                          ? (source.sell > prevSource.sell ? 'up' : source.sell < prevSource.sell ? 'down' : 'stable')
                          : null;

                        return (
                          <div
                            key={sourceKey}
                            className={`rounded-lg p-3 border ${config.bgColor}`}
                            style={{ borderColor: config.color + '40' }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: config.color }}
                              />
                              <span className="font-semibold text-sm">{config.label}</span>
                            </div>
                            
                            <div className="space-y-2">
                              {/* Compra */}
                              {source.buy && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Compra</span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold">${source.buy.toFixed(4)}</span>
                                    {buyTrend && (
                                      <>
                                        {buyTrend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                                        {buyTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
                                        {buyTrend === 'stable' && <Minus className="h-3 w-3 text-gray-500" />}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Venta */}
                              {source.sell && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Venta</span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold">${source.sell.toFixed(4)}</span>
                                    {sellTrend && (
                                      <>
                                        {sellTrend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                                        {sellTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
                                        {sellTrend === 'stable' && <Minus className="h-3 w-3 text-gray-500" />}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
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

