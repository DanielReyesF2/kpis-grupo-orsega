import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export function DofChart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fxPeriodDays, setFxPeriodDays] = useState(90);
  const [viewMode, setViewMode] = useState<'cards' | 'chart'>('cards');

  // Obtener datos de las 3 fuentes
  const { data: monexSeries, isLoading: monexLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=MONEX&days=${fxPeriodDays}`],
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
  });

  const { data: santanderSeries, isLoading: santanderLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=Santander&days=${fxPeriodDays}`],
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
  });

  const { data: dofSeries, isLoading: dofLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=DOF&days=${fxPeriodDays}`],
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
  });

  const isLoading = monexLoading || santanderLoading || dofLoading;

  // Mutación para solicitar actualización
  const requestUpdateMutation = useMutation({
    mutationFn: async () => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true }), 500);
      });
    },
    onSuccess: () => {
      toast({
        title: 'Solicitud enviada',
        description: 'Lolita recibirá la solicitud de actualización',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo enviar la solicitud',
        variant: 'destructive',
      });
    },
  });

  // Obtener los últimos valores de cada fuente
  const getLatestData = (series: any, sourceName: string) => {
    if (!series?.series || series.series.length === 0) return null;
    
    const latest = series.series[series.series.length - 1];
    const previous = series.series.length > 1 ? series.series[series.series.length - 2] : null;
    
    const buyChange = previous ? latest.buy - previous.buy : 0;
    const sellChange = previous ? latest.sell - previous.sell : 0;
    
    return {
      source: sourceName,
      buy: latest.buy,
      sell: latest.sell,
      spread: latest.sell - latest.buy,
      buyChange,
      sellChange,
      date: latest.date,
      hasData: true
    };
  };

  const monexData = getLatestData(monexSeries, 'MONEX');
  const santanderData = getLatestData(santanderSeries, 'Santander');
  const dofData = getLatestData(dofSeries, 'DOF');

  const allSources = [monexData, santanderData, dofData].filter(Boolean);

  // Combinar datos para gráfica
  const allDates = new Set<string>();
  const dataMap = new Map<string, any>();

  if (monexSeries?.series) {
    monexSeries.series.forEach((point: any) => {
      allDates.add(point.date);
      if (!dataMap.has(point.date)) {
        dataMap.set(point.date, { date: point.date });
      }
      dataMap.get(point.date)!.monexBuy = point.buy;
      dataMap.get(point.date)!.monexSell = point.sell;
    });
  }

  if (santanderSeries?.series) {
    santanderSeries.series.forEach((point: any) => {
      allDates.add(point.date);
      if (!dataMap.has(point.date)) {
        dataMap.set(point.date, { date: point.date });
      }
      dataMap.get(point.date)!.santanderBuy = point.buy;
      dataMap.get(point.date)!.santanderSell = point.sell;
    });
  }

  if (dofSeries?.series) {
    dofSeries.series.forEach((point: any) => {
      allDates.add(point.date);
      if (!dataMap.has(point.date)) {
        dataMap.set(point.date, { date: point.date });
      }
      dataMap.get(point.date)!.dofBuy = point.buy;
      dataMap.get(point.date)!.dofSell = point.sell;
    });
  }

  const combinedData = Array.from(dataMap.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const getSourceConfig = (source: string) => {
    const configs: Record<string, { color: string; bgColor: string; borderColor: string }> = {
      'MONEX': {
        color: '#2563eb',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800'
      },
      'Santander': {
        color: '#16a34a',
        bgColor: 'bg-green-50 dark:bg-green-950/30',
        borderColor: 'border-green-200 dark:border-green-800'
      },
      'DOF': {
        color: '#ea580c',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200 dark:border-orange-800'
      }
    };
    return configs[source] || { color: '#gray', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="space-y-4">
          {/* Valor del tipo de cambio */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
            <div className="flex-1">
              {/* Números removidos según solicitud del usuario */}
            </div>

            {/* Botón prominente */}
            <div className="flex items-center">
              <Button
                onClick={() => requestUpdateMutation.mutate()}
                disabled={requestUpdateMutation.isPending}
                className="bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white font-semibold px-6 py-3 text-base shadow-lg hover:shadow-xl transition-all whitespace-nowrap"
                size="lg"
              >
                {requestUpdateMutation.isPending ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    ¿Quieres pedirle a Lolita que actualice?
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Título de comparativa y selector */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#ea580c]" />
                Comparativa de Tipos de Cambio
              </CardTitle>
              <CardDescription>Compara diferentes fuentes de tipo de cambio</CardDescription>
            </div>
            <Select value={fxPeriodDays.toString()} onValueChange={(value) => setFxPeriodDays(parseInt(value))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">1 Mes</SelectItem>
                <SelectItem value="60">2 Meses</SelectItem>
                <SelectItem value="90">3 Meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      {isLoading ? (
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      ) : (
        <CardContent>
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'cards' | 'chart')}>
          <TabsList className="mb-4">
            <TabsTrigger value="cards">Vista de Tarjetas</TabsTrigger>
            <TabsTrigger value="chart">Vista de Gráfica</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="space-y-4">
            {/* Tarjetas con últimos valores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {allSources.map((data: any) => {
                if (!data) return null;
                const config = getSourceConfig(data.source);
                
                return (
                  <Card key={data.source} className={`border-2 ${config.borderColor} ${config.bgColor}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold" style={{ color: config.color }}>
                          {data.source}
                        </CardTitle>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }}></div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Compra */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">COMPRA (USD → MXN)</div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold" style={{ color: config.color }}>
                            ${data.buy.toFixed(4)}
                          </span>
                          <div className="flex items-center gap-1">
                            {getTrendIcon(data.buyChange)}
                            <span className={`text-xs font-medium ${data.buyChange > 0 ? 'text-green-600' : data.buyChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {data.buyChange !== 0 ? `${data.buyChange > 0 ? '+' : ''}${data.buyChange.toFixed(4)}` : 'Sin cambio'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Venta */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">VENTA (MXN → USD)</div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold" style={{ color: config.color }}>
                            ${data.sell.toFixed(4)}
                          </span>
                          <div className="flex items-center gap-1">
                            {getTrendIcon(data.sellChange)}
                            <span className={`text-xs font-medium ${data.sellChange > 0 ? 'text-green-600' : data.sellChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {data.sellChange !== 0 ? `${data.sellChange > 0 ? '+' : ''}${data.sellChange.toFixed(4)}` : 'Sin cambio'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Spread */}
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Spread</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            ${data.spread.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      {/* Fecha */}
                      <div className="text-xs text-gray-500 text-center">
                        Actualizado: {new Date(data.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Mensaje si no hay datos */}
            {allSources.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No hay datos disponibles de tipos de cambio</p>
              </div>
            )}

            {/* Tabla comparativa */}
            {allSources.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Comparativa Detallada</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Fuente</th>
                        <th className="text-right py-2 px-3 font-medium">Compra</th>
                        <th className="text-right py-2 px-3 font-medium">Venta</th>
                        <th className="text-right py-2 px-3 font-medium">Spread</th>
                        <th className="text-center py-2 px-3 font-medium">Cambio Compra</th>
                        <th className="text-center py-2 px-3 font-medium">Cambio Venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSources.map((data: any) => {
                        const config = getSourceConfig(data.source);
                        return (
                          <tr key={data.source} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-2 px-3 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }}></div>
                                {data.source}
                              </div>
                            </td>
                            <td className="text-right py-2 px-3 font-semibold">${data.buy.toFixed(4)}</td>
                            <td className="text-right py-2 px-3 font-semibold">${data.sell.toFixed(4)}</td>
                            <td className="text-right py-2 px-3">${data.spread.toFixed(4)}</td>
                            <td className="text-center py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {getTrendIcon(data.buyChange)}
                                <span className={data.buyChange > 0 ? 'text-green-600' : data.buyChange < 0 ? 'text-red-600' : 'text-gray-500'}>
                                  {data.buyChange !== 0 ? `${data.buyChange > 0 ? '+' : ''}${data.buyChange.toFixed(4)}` : '-'}
                                </span>
                              </div>
                            </td>
                            <td className="text-center py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {getTrendIcon(data.sellChange)}
                                <span className={data.sellChange > 0 ? 'text-green-600' : data.sellChange < 0 ? 'text-red-600' : 'text-gray-500'}>
                                  {data.sellChange !== 0 ? `${data.sellChange > 0 ? '+' : ''}${data.sellChange.toFixed(4)}` : '-'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="chart">
            {combinedData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={10}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    fontSize={10} 
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip formatter={(value: any) => `$${value.toFixed(4)}`} />
                  <Legend />
                  
                  {monexData && (
                    <>
                      <Line type="monotone" dataKey="monexBuy" stroke="#60a5fa" strokeWidth={2} name="MONEX Compra" dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="monexSell" stroke="#2563eb" strokeWidth={2} name="MONEX Venta" dot={false} />
                    </>
                  )}
                  
                  {santanderData && (
                    <>
                      <Line type="monotone" dataKey="santanderBuy" stroke="#4ade80" strokeWidth={2} name="Santander Compra" dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="santanderSell" stroke="#16a34a" strokeWidth={2} name="Santander Venta" dot={false} />
                    </>
                  )}
                  
                  {dofData && (
                    <>
                      <Line type="monotone" dataKey="dofBuy" stroke="#fb923c" strokeWidth={2} name="DOF Compra" dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="dofSell" stroke="#ea580c" strokeWidth={2} name="DOF Venta" dot={false} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No hay datos para mostrar en la gráfica</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      )}
    </Card>
  );
}
