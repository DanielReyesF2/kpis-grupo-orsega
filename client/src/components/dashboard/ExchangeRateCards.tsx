import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, DollarSign, Building2, FileText, ChevronRight, Sparkles, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  date: string;
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
    history24h: []
  };
}

interface ExchangeRateCardsProps {
  onUpdateRate?: (source: string) => void; // Callback para abrir formulario desde tarjetas
}

export function ExchangeRateCards({ onUpdateRate }: ExchangeRateCardsProps = {}) {
  const queryClient = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [valueAnimations, setValueAnimations] = useState<Record<string, boolean>>({});
  const previousValuesRef = useRef<Record<string, { buy: number; sell: number }>>({});

  const { data: exchangeRates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/treasury/exchange-rates'],
    staleTime: 0, // No cachear para que siempre obtenga los datos más recientes
    refetchInterval: 30000, // Refrescar cada 30 segundos
    refetchOnWindowFocus: true, // Refrescar cuando la ventana recupera el foco
    gcTime: 0, // No cachear para asegurar datos frescos (gcTime reemplaza a cacheTime en v5)
  });

  // Efecto para logging cuando los datos cambian
  useEffect(() => {
    let isMounted = true;
    
    if (isMounted && exchangeRates && Array.isArray(exchangeRates) && exchangeRates.length > 0) {
      console.log('[ExchangeRateCards] Datos recibidos:', exchangeRates.length, 'registros');
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
  }, [exchangeRates]);

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
  }, [exchangeRates]);

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
    
    // Calcular lastUpdate con logging detallado
    let lastUpdate: Date | null = null;
    if (latest) {
      const dateStr = latest.date;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.error(`[ExchangeRateCards] ${source} - Invalid date:`, dateStr);
        lastUpdate = null;
      } else {
        lastUpdate = date;
        const formatted = format(date, "dd/MM/yyyy HH:mm:ss", { locale: es });
        console.log(`[ExchangeRateCards] ${source} - lastUpdate final:`, {
          input: dateStr,
          parsed: date.toISOString(),
          formatted: formatted,
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
      history24h: history24h.reverse(), // Más antiguo a más reciente
    };
  };

  const santanderData = useMemo(() => processSourceData('Santander'), [exchangeRates]);
  const monexData = useMemo(() => processSourceData('MONEX'), [exchangeRates]);
  const dofData = useMemo(() => processSourceData('DOF'), [exchangeRates]);

  // Configuración de colores con tonos más sutiles y elegantes
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
        bg: 'bg-green-50/40 dark:bg-green-950/10',
        border: 'border-green-500 dark:border-green-600',
        text: 'text-green-700 dark:text-green-300',
        icon: Building2,
        accent: 'text-green-600 dark:text-green-400',
        gradient: 'from-green-500 to-green-600',
      },
      'MONEX': {
        bg: 'bg-blue-50/40 dark:bg-blue-950/10',
        border: 'border-blue-600 dark:border-blue-500',
        text: 'text-blue-700 dark:text-blue-300',
        icon: DollarSign,
        accent: 'text-blue-600 dark:text-blue-400',
        gradient: 'from-blue-600 to-blue-700',
      },
      'DOF': {
        bg: 'bg-orange-50/40 dark:bg-orange-950/10',
        border: 'border-orange-500 dark:border-orange-600',
        text: 'text-orange-700 dark:text-orange-300',
        icon: FileText,
        accent: 'text-orange-600 dark:text-orange-400',
        gradient: 'from-orange-500 to-orange-600',
      },
    };
    return configs[source] || {
      bg: 'bg-gray-50 dark:bg-gray-950/20',
      border: 'border-gray-500',
      text: 'text-gray-700',
      icon: DollarSign,
      accent: 'text-gray-600',
      gradient: 'from-gray-500 to-gray-600',
    };
  };

  const RateValue = ({ 
    value, 
    change, 
    trend, 
    interpretation,
    source,
    type,
    isAnimated 
  }: { 
    value: number; 
    change: number; 
    trend: 'up' | 'down' | 'stable';
    interpretation: string;
    source: string;
    type: 'buy' | 'sell';
    isAnimated: boolean;
  }) => {
    const config = getSourceConfig(source);
    const trendColor = trend === 'up' ? 'text-green-600 dark:text-green-400' : 
                      trend === 'down' ? 'text-red-600 dark:text-red-400' : 
                      'text-gray-500 dark:text-gray-400';
    
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
            {type === 'buy' ? 'Compra' : 'Venta'}
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
    const Icon = config.icon;
    
    const buyAnimated = valueAnimations[`${source}-buy`] || false;
    const sellAnimated = valueAnimations[`${source}-sell`] || false;
    
    return (
      <Card className={`border-2 ${config.border} shadow-xl ${config.bg} overflow-hidden relative`}>
        {/* Gradient accent bar */}
        <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />

        <CardHeader className="pb-4 pt-5">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-lg`}>
                  <Icon className="h-5 w-5" />
                </div>
              <CardTitle className={`text-xl font-bold ${config.text}`}>
                  {source}
                </CardTitle>
              </div>
                </div>
          
          {/* Última actualización con contador */}
          {data.lastUpdate ? (
            <div className="mt-3 space-y-2">
              <div className={`text-sm font-bold text-gray-900 dark:text-gray-100`}>
                Última actualización: <span className={config.accent}>{format(data.lastUpdate, "dd/MM/yyyy HH:mm:ss", { locale: es })}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`${config.border} ${config.text} text-xs font-semibold bg-white dark:bg-gray-800`}>
                  {data.updateCount} actualizaciones hoy
                </Badge>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className={`text-sm font-bold text-gray-900 dark:text-gray-100`}>
                Última actualización: <span className="text-red-500">Sin datos</span>
              </div>
            </div>
          )}
          </CardHeader>

        <CardContent className="space-y-4 pt-0 pb-5">
            {cardLoading ? (
              <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : data.rate ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <RateValue
                  value={data.rate.buy_rate}
                  change={data.buyChange}
                  trend={data.buyTrend}
                  interpretation={data.buyInterpretation}
                  source={source}
                  type="buy"
                  isAnimated={buyAnimated}
                />
                <RateValue
                  value={data.rate.sell_rate}
                  change={data.sellChange}
                  trend={data.sellTrend}
                  interpretation={data.sellInterpretation}
                  source={source}
                  type="sell"
                  isAnimated={sellAnimated}
                />
                </div>
                
                {/* Spread */}
              <div className="flex items-center justify-between text-sm pt-3 mt-3 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-4 py-2.5">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Spread</span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  ${(data.rate.sell_rate - data.rate.buy_rate).toFixed(4)}
                </span>
              </div>
              
              {/* Botones de acción - Actualizar es el principal */}
              <div className="space-y-3 pt-2">
                {/* Botón principal de Actualizar - MUY VISIBLE */}
                <Button
                  size="lg"
                  className={`w-full ${config.bg} ${config.border} ${config.text} hover:opacity-90 transition-all text-base font-bold py-6 shadow-lg hover:shadow-xl transform hover:scale-[1.02] border-2`}
                  onClick={() => {
                    if (onUpdateRate) {
                      onUpdateRate(source);
                    }
                  }}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Actualizar {source}
                </Button>
                {/* Botón secundario de Ver detalle */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full border-2 ${config.border} ${config.text} hover:${config.bg} transition-all text-sm font-medium`}
                  onClick={() => setSelectedSource(source)}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Ver Histórico 24h
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Icon className="h-10 w-10 mx-auto mb-3 opacity-50 text-gray-400 dark:text-gray-500" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sin datos disponibles</p>
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

  const sparklineData = selectedData?.history24h.map(r => ({
    time: format(new Date(r.date), 'HH:mm'),
    buy: r.buy_rate,
    sell: r.sell_rate,
    date: new Date(r.date),
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Compara diferentes fuentes de tipo de cambio
        </h2>
      </div>
      
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
          
          {selectedData && sparklineData.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Compra</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${selectedData.rate?.buy_rate.toFixed(4) || '0.0000'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Venta</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${selectedData.rate?.sell_rate.toFixed(4) || '0.0000'}
                  </p>
                </div>
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
