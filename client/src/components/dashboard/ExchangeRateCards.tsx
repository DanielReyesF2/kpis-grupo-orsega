import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, DollarSign, Building2, FileText, ChevronRight, Sparkles, Plus, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { normalizeExchangeRate, getRateDisplayConfig } from '@/lib/utils/exchange-rates';

// Función auxiliar para formatear fecha en hora de México (CDMX)
function formatDateInMexicoTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Obtener los componentes de fecha/hora en zona horaria de México
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  const formatter = new Intl.DateTimeFormat('es-MX', options);
  const parts = formatter.formatToParts(dateObj);
  
  // Extraer las partes
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const second = parts.find(p => p.type === 'second')?.value || '';
  
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  date: string;
}

interface TodayHistoryEntry {
  time: string;        // HH:mm
  date: Date;
  buy_rate: number;
  sell_rate: number;
  buyChange?: number;  // Cambio respecto a la anterior
  sellChange?: number;
}

interface RateCardData {
  rate: ExchangeRate | null;
  buyChange: number;
  sellChange: number;
  buyTrend: 'up' | 'down' | 'stable';
  sellTrend: 'up' | 'down' | 'stable';
  buyInterpretation: string;
  sellInterpretation: string;
  updateCount: number;
  lastUpdate: Date | null;
  history24h: ExchangeRate[];
  historyToday: TodayHistoryEntry[];
}

function getEmptyRateCardData(): RateCardData {
  return {
    rate: null,
    buyChange: 0,
    sellChange: 0,
    buyTrend: 'stable',
    sellTrend: 'stable',
    buyInterpretation: 'Sin datos disponibles',
    sellInterpretation: 'Sin datos disponibles',
    updateCount: 0,
    lastUpdate: null,
    history24h: [],
    historyToday: []
  };
}

// Función para filtrar actualizaciones del día actual
function getTodayHistory(history24h: ExchangeRate[]): TodayHistoryEntry[] {
  if (!history24h || history24h.length === 0) return [];
  
  // Obtener fecha actual en zona horaria de México
  const now = new Date();
  const mexicoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const mexicoTodayStr = mexicoNow.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  
  const todayEntries = history24h
    .filter(r => {
      const rateDate = new Date(r.date);
      // Convertir la fecha del rate a zona horaria de México para comparar
      const rateDateMexico = new Date(rateDate.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
      const rateDateStr = rateDateMexico.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      return rateDateStr === mexicoTodayStr;
    })
    .map((r, index, array) => {
      const rateDate = new Date(r.date);
      const previous = index < array.length - 1 ? array[index + 1] : null;
      
      return {
        time: format(rateDate, 'HH:mm', { locale: es }),
        date: rateDate,
        buy_rate: r.buy_rate,
        sell_rate: r.sell_rate,
        buyChange: previous ? r.buy_rate - previous.buy_rate : undefined,
        sellChange: previous ? r.sell_rate - previous.sell_rate : undefined,
      };
    })
    .reverse(); // Más reciente primero
  
  return todayEntries;
}

interface ExchangeRateCardsProps {
  onUpdateRate?: (source: string) => void; // Callback para abrir formulario desde tarjetas
}

export function ExchangeRateCards({ onUpdateRate }: ExchangeRateCardsProps = {}) {
  const queryClient = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [valueAnimations, setValueAnimations] = useState<Record<string, boolean>>({});
  const previousValuesRef = useRef<Record<string, { buy: number; sell: number }>>({});
  
  const toggleCardExpansion = (source: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(source)) {
        newSet.delete(source);
      } else {
        newSet.add(source);
      }
      return newSet;
    });
  };

  const { data: exchangeRates = [], isLoading, dataUpdatedAt } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/treasury/exchange-rates'],
    staleTime: 0, // No cachear para que siempre obtenga los datos más recientes
    refetchInterval: 30000, // Refrescar cada 30 segundos
    refetchOnWindowFocus: true, // Refrescar cuando la ventana recupera el foco
    gcTime: 0, // No cachear para asegurar datos frescos
    structuralSharing: false, // Desactivar structural sharing para forzar nueva referencia
  });

  // Efecto para logging cuando los datos cambian
  useEffect(() => {
    let isMounted = true;

    if (isMounted && exchangeRates && Array.isArray(exchangeRates) && exchangeRates.length > 0) {
      console.log('[ExchangeRateCards] 🔄 Datos actualizados:', {
        totalRegistros: exchangeRates.length,
        dataUpdatedAt: dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : 'N/A'
      });
      const santander = exchangeRates.filter((r: ExchangeRate) => r.source === 'Santander').sort((a: ExchangeRate, b: ExchangeRate) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (santander && isMounted) {
        console.log('[ExchangeRateCards] Último Santander:', {
          id: santander.id,
          date: santander.date,
          parsed: new Date(santander.date).toISOString(),
          formatted: format(new Date(santander.date), "dd/MM/yyyy HH:mm:ss", { locale: es })
        });
      }
    }
    
    return () => {
      isMounted = false;
    };
  }, [exchangeRates, dataUpdatedAt]);

  // Detectar cambios y activar animaciones
  useEffect(() => {
    let isMounted = true;
    const timeouts: NodeJS.Timeout[] = [];
    
    if (isMounted && Array.isArray(exchangeRates) && exchangeRates.length > 0) {
      const newAnimations: Record<string, boolean> = {};
      
      ['Santander', 'MONEX', 'DOF'].forEach(source => {
        const latest = exchangeRates.find((r: ExchangeRate) => r.source === source);
        if (!latest || !isMounted) return;
        
        const key = `${source}-buy`;
        const prevBuy = previousValuesRef.current[key]?.buy;
        
        if (prevBuy !== undefined && prevBuy !== latest.buy_rate) {
          newAnimations[key] = true;
          const timeout = setTimeout(() => {
            if (isMounted) {
              setValueAnimations(prev => ({ ...prev, [key]: false }));
            }
          }, 500);
          timeouts.push(timeout);
        }
        
        previousValuesRef.current[key] = { buy: latest.buy_rate, sell: latest.sell_rate };
        
        const sellKey = `${source}-sell`;
        const prevSell = previousValuesRef.current[sellKey]?.sell;
        
        if (prevSell !== undefined && prevSell !== latest.sell_rate) {
          newAnimations[sellKey] = true;
          const timeout = setTimeout(() => {
            if (isMounted) {
              setValueAnimations(prev => ({ ...prev, [sellKey]: false }));
            }
          }, 500);
          timeouts.push(timeout);
        }
        
        previousValuesRef.current[sellKey] = { buy: latest.buy_rate, sell: latest.sell_rate };
      });
      
      if (isMounted && Object.keys(newAnimations).length > 0) {
        setValueAnimations(newAnimations);
      }
    }
    
    return () => {
      isMounted = false;
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [exchangeRates, dataUpdatedAt]);

  // Procesar datos para cada fuente
  const processSourceData = (source: string): RateCardData => {
    if (!Array.isArray(exchangeRates)) {
      return getEmptyRateCardData();
    }
    const rates = exchangeRates
      .filter((r: ExchangeRate) => r.source === source)
      .sort((a: ExchangeRate, b: ExchangeRate) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const latest = rates[0] || null;
    const previous = rates[1] || null;
    
    // Debug: Log detallado para todas las fuentes
    if (latest) {
      const dateStr = latest.date;
      const parsedDate = new Date(dateStr);
      const isValidDate = !isNaN(parsedDate.getTime());
      
      console.log(`[ExchangeRateCards] ${source}:`, {
        totalRates: rates.length,
        latestId: latest.id,
        latestBuyRate: latest.buy_rate,
        latestSellRate: latest.sell_rate,
        rawDate: dateStr,
        parsedDate: isValidDate ? parsedDate.toISOString() : 'INVALID DATE',
        localString: isValidDate ? parsedDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'INVALID',
        formatted: isValidDate ? format(parsedDate, "dd/MM/yyyy HH:mm:ss", { locale: es }) : 'INVALID',
        lastUpdate: isValidDate ? parsedDate : null
      });
    } else {
      console.log(`[ExchangeRateCards] ${source}: NO HAY DATOS`);
    }
    
    // Calcular cambios
    const buyChange = latest && previous ? latest.buy_rate - previous.buy_rate : 0;
    const sellChange = latest && previous ? latest.sell_rate - previous.sell_rate : 0;
    
    // Determinar tendencias
    const buyTrend = buyChange > 0.001 ? 'up' : buyChange < -0.001 ? 'down' : 'stable';
    const sellTrend = sellChange > 0.001 ? 'up' : sellChange < -0.001 ? 'down' : 'stable';
    
    // Generar interpretaciones
    const generateInterpretation = (change: number, trend: string) => {
      const absChange = Math.abs(change);
      if (absChange < 0.01) return 'Sin cambios significativos';
      
      const magnitude = absChange < 0.05 ? 'Ligera' : absChange < 0.15 ? 'Moderada' : 'Pronunciada';
      const direction = trend === 'up' ? 'alza' : trend === 'down' ? 'baja' : 'estable';
      const timeOfDay = new Date().getHours() < 12 ? 'mañana' : new Date().getHours() < 18 ? 'tarde' : 'noche';
      
      return `${magnitude} ${direction} durante la ${timeOfDay} (${change > 0 ? '+' : ''}${change.toFixed(4)})`;
    };
    
    const buyInterpretation = generateInterpretation(buyChange, buyTrend);
    const sellInterpretation = generateInterpretation(sellChange, sellTrend);
    
    // Contar actualizaciones del día
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updateCount = rates.filter((r: ExchangeRate) => {
      const rateDate = new Date(r.date);
      rateDate.setHours(0, 0, 0, 0);
      return rateDate.getTime() === today.getTime();
    }).length;
    
    // Historial 24h para sparkline
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const history24h = rates.filter((r: ExchangeRate) => new Date(r.date) >= yesterday);
    
    // Historial del día actual
    const history24hReversed = history24h.reverse(); // Más antiguo a más reciente
    const historyToday = getTodayHistory(history24hReversed);
    
    // Debug: Log para verificar datos del día
    console.log(`[${source}] Histórico del día:`, {
      total24h: history24hReversed.length,
      todayCount: historyToday.length,
      todayEntries: historyToday
    });
    
    // Calcular lastUpdate con logging detallado (en hora de México)
    let lastUpdate: Date | null = null;
    if (latest) {
      const dateStr = latest.date;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.error(`[ExchangeRateCards] ${source} - Invalid date:`, dateStr);
        lastUpdate = null;
      } else {
        lastUpdate = date;
        const formatted = formatDateInMexicoTime(date);
        console.log(`[ExchangeRateCards] ${source} - lastUpdate final:`, {
          input: dateStr,
          parsed: date.toISOString(),
          formattedMexico: formatted,
          willDisplay: formatted
        });
      }
    }
    
    return {
      rate: latest,
      buyChange,
      sellChange,
      buyTrend,
      sellTrend,
      buyInterpretation,
      sellInterpretation,
      updateCount,
      lastUpdate,
      history24h: history24hReversed,
      historyToday,
    };
  };

  // Usar dataUpdatedAt como dependencia adicional para forzar recálculo cuando hay nuevos datos
  const santanderData = useMemo(() => processSourceData('Santander'), [exchangeRates, dataUpdatedAt]);
  const monexData = useMemo(() => processSourceData('MONEX'), [exchangeRates, dataUpdatedAt]);
  const dofData = useMemo(() => processSourceData('DOF'), [exchangeRates, dataUpdatedAt]);

  // Configuración de colores más limpia y profesional
  const getSourceConfig = (source: string) => {
    const configs: Record<string, { 
      bg: string; 
      border: string; 
      text: string; 
      icon: any; 
      accent: string;
      gradient: string;
    }> = {
      'Santander': {
        bg: 'bg-green-50 dark:bg-green-800/5',
        border: 'border-green-300 dark:border-green-700',
        text: 'text-green-700 dark:text-green-400',
        icon: Building2,
        accent: 'text-green-600 dark:text-green-400',
        gradient: 'from-green-600 to-green-700',
      },
      'MONEX': {
        bg: 'bg-blue-50 dark:bg-blue-800/5',
        border: 'border-blue-300 dark:border-blue-700',
        text: 'text-blue-700 dark:text-blue-400',
        icon: DollarSign,
        accent: 'text-blue-600 dark:text-blue-400',
        gradient: 'from-blue-600 to-blue-700',
      },
      'DOF': {
        bg: 'bg-orange-50 dark:bg-orange-800/5',
        border: 'border-orange-300 dark:border-orange-700',
        text: 'text-orange-700 dark:text-orange-400',
        icon: FileText,
        accent: 'text-orange-600 dark:text-orange-400',
        gradient: 'from-orange-600 to-orange-700',
      },
    };
    return configs[source] || {
      bg: 'bg-gray-100 dark:bg-gray-800',
      border: 'border-gray-300 dark:border-gray-700',
      text: 'text-gray-700 dark:text-gray-300',
      icon: DollarSign,
      accent: 'text-gray-600 dark:text-gray-400',
      gradient: 'from-gray-600 to-gray-700',
    };
  };

  // Componente para mostrar el histórico del día
  const TodayHistorySection = ({
    historyToday,
    source,
    displayConfig
  }: {
    historyToday: TodayHistoryEntry[];
    source: string;
    displayConfig: {
      isSingle: boolean;
      buyLabel: string;
      sellLabel?: string;
      showSpread: boolean;
    };
  }) => {
    if (historyToday.length === 0) {
      return (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>No hay actualizaciones del día actual</p>
        </div>
      );
    }

    return (
      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {historyToday.map((entry, index) => {
          const buyTrend = entry.buyChange !== undefined
            ? (entry.buyChange > 0.001 ? 'up' : entry.buyChange < -0.001 ? 'down' : 'stable')
            : null;
          const sellTrend = entry.sellChange !== undefined
            ? (entry.sellChange > 0.001 ? 'up' : entry.sellChange < -0.001 ? 'down' : 'stable')
            : null;

          const BuyTrendIcon = buyTrend === 'up' ? TrendingUp : buyTrend === 'down' ? TrendingDown : Minus;
          const SellTrendIcon = sellTrend === 'up' ? TrendingUp : sellTrend === 'down' ? TrendingDown : Minus;
          
          const buyTrendColor = buyTrend === 'up' ? 'text-green-600 dark:text-green-400' : 
                               buyTrend === 'down' ? 'text-red-600 dark:text-red-400' : 
                               'text-gray-500 dark:text-gray-400';
          const sellTrendColor = sellTrend === 'up' ? 'text-green-600 dark:text-green-400' : 
                                sellTrend === 'down' ? 'text-red-600 dark:text-red-400' : 
                                'text-gray-500 dark:text-gray-400';

          const normalizedEntry = normalizeExchangeRate({
            ...entry,
            source: source,
            date: entry.date.toISOString(),
          } as ExchangeRate);

          return (
            <div
              key={`${entry.time}-${index}`}
              className="bg-muted/30 dark:bg-muted/20 rounded-lg p-3 border border-border/50 hover:border-border transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">{entry.time}</span>
                {entry.buyChange !== undefined && Math.abs(entry.buyChange) > 0.001 && (
                  <Badge variant="outline" className="text-xs">
                    {entry.buyChange > 0 ? '+' : ''}{entry.buyChange.toFixed(4)}
                  </Badge>
                )}
              </div>
              
              <div className={displayConfig.isSingle ? "space-y-1" : "grid grid-cols-2 gap-2"}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{displayConfig.buyLabel}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">${normalizedEntry.displayValue.toFixed(4)}</span>
                    {buyTrend && (
                      <BuyTrendIcon className={`h-3.5 w-3.5 ${buyTrendColor}`} />
                    )}
                  </div>
                </div>
                
                {!displayConfig.isSingle && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{displayConfig.sellLabel || 'Venta'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">${entry.sell_rate.toFixed(4)}</span>
                      {sellTrend && (
                        <SellTrendIcon className={`h-3.5 w-3.5 ${sellTrendColor}`} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const RateValue = ({ 
    value, 
    change, 
    trend, 
    interpretation,
    source,
    type,
    isAnimated,
    label
  }: { 
    value: number; 
    change: number; 
    trend: 'up' | 'down' | 'stable';
    interpretation: string;
    source: string;
    type: 'buy' | 'sell';
    isAnimated: boolean;
    label: string;
  }) => {
    const config = getSourceConfig(source);
    const trendColor = trend === 'up' ? 'text-green-600 dark:text-green-400' : 
                      trend === 'down' ? 'text-red-600 dark:text-red-400' : 
                      'text-gray-500 dark:text-gray-400';
    
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    
    return (
      <div className="bg-white dark:bg-gray-800/30 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
            {label}
          </span>
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            <span className="text-xs font-bold">
              {change > 0 ? '+' : ''}{change.toFixed(4)}
            </span>
          </div>
        </div>

        <div
          className={`text-3xl font-extrabold text-gray-900 dark:text-white leading-tight transition-all duration-500 ${
            isAnimated ? 'animate-pulse scale-110 brightness-125' : ''
          }`}
        >
          ${value.toFixed(4)}
        </div>

        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
          {interpretation}
        </p>
      </div>
    );
  };

  const RateCard = ({ 
    source, 
    data, 
    isLoading: cardLoading
  }: { 
    source: string; 
    data: RateCardData; 
    isLoading: boolean;
  }) => {
    const config = getSourceConfig(source);
    const displayConfig = getRateDisplayConfig(source);
    const Icon = config.icon;
    const isExpanded = expandedCards.has(source);
    
    // DEBUG: Verificar qué está pasando
    if (source === 'DOF' && data.rate) {
      console.log('[RateCard DOF DEBUG]', {
        sourceProp: source,
        rateSource: data.rate.source,
        displayConfigIsSingle: displayConfig.isSingle,
        displayConfigBuyLabel: displayConfig.buyLabel,
        displayConfigShowSpread: displayConfig.showSpread,
        rateBuy: data.rate.buy_rate,
        rateSell: data.rate.sell_rate,
      });
    }
    
    const buyAnimated = valueAnimations[`${source}-buy`] || false;
    const sellAnimated = valueAnimations[`${source}-sell`] || false;
    
    // Normalizar el rate para obtener información de presentación
    // IMPORTANTE: Usar el source del prop, no del rate, para asegurar consistencia
    const normalizedRate = data.rate ? normalizeExchangeRate({
      ...data.rate,
      source: source // Forzar el source del prop en lugar del que viene de la BD
    }) : null;
    
    // DEBUG: Verificar normalización
    if (source === 'DOF' && normalizedRate) {
      console.log('[RateCard DOF DEBUG Normalized]', {
        isSingleValue: normalizedRate.isSingleValue,
        displayValue: normalizedRate.displayValue,
        spread: normalizedRate.spread,
        displayLabel: normalizedRate.displayLabel,
      });
    }
    
    return (
      <Card className={`border ${config.border} shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-gray-800/50 overflow-hidden`}>
        <CardHeader className="pb-3 pt-4 px-4">
          {/* Header con icono y título */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-lg ${config.bg} border ${config.border}`}>
              <Icon className={`h-5 w-5 ${config.text}`} />
            </div>
            <CardTitle className={`text-lg font-bold ${config.text}`}>
              {source}
            </CardTitle>
          </div>
          
          {/* Última actualización con contador */}
          {data.lastUpdate ? (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">
                Última actualización: <span className={`font-semibold ${config.accent}`}>{formatDateInMexicoTime(data.lastUpdate)}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {data.updateCount} actualizaciones hoy
              </Badge>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Última actualización: <span className="text-red-500 font-semibold">Sin datos</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-4">
            {cardLoading ? (
              <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              {!displayConfig.isSingle && <Skeleton className="h-20 w-full" />}
            </div>
          ) : data.rate && normalizedRate ? (
            <>
              {/* Valores - mostrar 1 o 2 según la fuente */}
              {(() => {
                // DEBUG: Verificar qué se va a renderizar
                if (source === 'DOF') {
                  console.log('[RateCard DOF RENDER]', {
                    displayConfigIsSingle: displayConfig.isSingle,
                    willRenderSecondValue: !displayConfig.isSingle,
                    gridClass: displayConfig.isSingle ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3",
                    buyLabel: displayConfig.buyLabel,
                    sellLabel: displayConfig.sellLabel,
                  });
                }
                return null;
              })()}
              <div className={displayConfig.isSingle ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
                <RateValue
                  value={normalizedRate.displayValue}
                  change={data.buyChange}
                  trend={data.buyTrend}
                  interpretation={data.buyInterpretation}
                  source={source}
                  type="buy"
                  isAnimated={buyAnimated}
                  label={displayConfig.buyLabel}
                />
                {(() => {
                  // DEBUG: Verificar condición de renderizado
                  const shouldRenderSell = !displayConfig.isSingle;
                  if (source === 'DOF') {
                    console.log('[RateCard DOF RENDER CHECK]', {
                      displayConfigIsSingle: displayConfig.isSingle,
                      shouldRenderSell,
                      willRender: shouldRenderSell,
                    });
                  }
                  return shouldRenderSell ? (
                    <RateValue
                      value={data.rate.sell_rate}
                      change={data.sellChange}
                      trend={data.sellTrend}
                      interpretation={data.sellInterpretation}
                      source={source}
                      type="sell"
                      isAnimated={sellAnimated}
                      label={displayConfig.sellLabel || 'Venta'}
                    />
                  ) : null;
                })()}
              </div>
                
              {/* Spread - solo para fuentes con dos valores */}
              {displayConfig.showSpread && normalizedRate.spread !== undefined && (
                <div className="flex items-center justify-between pt-3 border-t border-border rounded-md px-3 py-2 bg-muted/30">
                  <span className="text-sm font-medium text-muted-foreground">Spread</span>
                  <span className="text-base font-bold text-foreground">
                    ${normalizedRate.spread.toFixed(4)}
                  </span>
                </div>
              )}
              
              {/* Botón para expandir/colapsar histórico del día - solo se muestra si hay actualizaciones */}
              {data.historyToday.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-xs"
                  onClick={() => toggleCardExpansion(source)}
                  aria-label={isExpanded ? `Ocultar histórico del día para ${source}` : `Mostrar histórico del día para ${source}`}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Histórico del día ({data.historyToday.length} actualizaciones)
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
              
              {/* Sección expandible con histórico del día */}
              {isExpanded && data.historyToday.length > 0 && (
                <div className="border-t border-border pt-4 space-y-3 transition-all duration-300 ease-in-out">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold text-foreground">Actualizaciones del día</h4>
                  </div>
                  <TodayHistorySection
                    historyToday={data.historyToday}
                    source={source}
                    displayConfig={displayConfig}
                  />
                </div>
              )}
              
              {/* Botones de acción */}
              <div className="space-y-2 pt-1">
                <Button
                  size="lg"
                  className={`w-full bg-gradient-to-r ${config.gradient} text-white hover:opacity-90 transition-all font-semibold shadow-md hover:shadow-lg`}
                  onClick={() => {
                    if (onUpdateRate) {
                      onUpdateRate(source);
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Actualizar {source}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedSource(source)}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Ver Histórico 24h
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Icon className="h-10 w-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Sin datos disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
    );
  };

  // Modal con sparkline 24h
  const selectedData = selectedSource === 'Santander' ? santanderData :
                      selectedSource === 'MONEX' ? monexData :
                      selectedSource === 'DOF' ? dofData : null;

  const selectedDisplayConfig = selectedSource ? getRateDisplayConfig(selectedSource) : null;
  const selectedNormalized = selectedData?.rate ? normalizeExchangeRate(selectedData.rate) : null;

  const sparklineData = selectedData?.history24h.map(r => {
    const normalized = normalizeExchangeRate(r);
    return {
      time: format(new Date(r.date), 'HH:mm'),
      buy: r.buy_rate,
      sell: r.sell_rate,
      value: normalized.displayValue,
      date: new Date(r.date),
    };
  }) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <RateCard source="Santander" data={santanderData} isLoading={isLoading} />
        <RateCard source="MONEX" data={monexData} isLoading={isLoading} />
        <RateCard source="DOF" data={dofData} isLoading={isLoading} />
      </div>

      {/* Modal de detalle con sparkline */}
      <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Histórico 24h - {selectedSource}
            </DialogTitle>
          </DialogHeader>
          
          {selectedData && sparklineData.length > 0 && selectedNormalized && selectedDisplayConfig ? (
            <div className="space-y-4">
              <div className={selectedDisplayConfig.isSingle ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {selectedDisplayConfig.buyLabel}
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${selectedNormalized.displayValue.toFixed(4)}
                  </p>
                </div>
                {!selectedDisplayConfig.isSingle && (
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {selectedDisplayConfig.sellLabel}
                    </p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      ${selectedData.rate?.sell_rate.toFixed(4) || '0.0000'}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      formatter={(value: number) => `$${value.toFixed(4)}`}
                      labelFormatter={(label) => `Hora: ${label}`}
                    />
                    {selectedDisplayConfig.isSingle ? (
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name={selectedDisplayConfig.buyLabel}
                      />
                    ) : (
                      <>
                        <Line 
                          type="monotone" 
                          dataKey="buy" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Compra"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="sell" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Venta"
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                <p>Total de puntos: {sparklineData.length}</p>
                <p>Rango: {sparklineData[0]?.time} - {sparklineData[sparklineData.length - 1]?.time}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-700 dark:text-gray-300 font-semibold">No hay datos históricos disponibles</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
