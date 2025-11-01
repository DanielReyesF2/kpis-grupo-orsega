import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp, TrendingDown, Minus, RefreshCw, DollarSign, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export function DofChart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fxPeriodDays, setFxPeriodDays] = useState(90);
  const [viewMode, setViewMode] = useState<'cards' | 'chart'>('cards');
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [usdAmount, setUsdAmount] = useState('');
  const [mxnAmount, setMxnAmount] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

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

  // Función para abrir el diálogo de compra
  const handleOpenPurchaseDialog = (data: any) => {
    setSelectedCard(data);
    setIsPurchaseDialogOpen(true);
    setUsdAmount('');
    setMxnAmount('');
    setAdditionalNotes('');
  };

  // Calcular MXN cuando cambia USD
  const handleUsdChange = (value: string) => {
    setUsdAmount(value);
    if (value && selectedCard) {
      const calculated = parseFloat(value) * selectedCard.buy;
      setMxnAmount(calculated.toFixed(2));
    } else {
      setMxnAmount('');
    }
  };

  // Mutación para enviar solicitud de compra a Lolita
  const sendPurchaseRequestMutation = useMutation({
    mutationFn: async (data: { source: string; amountUsd: number; amountMxn: number; rate: number; notes: string }) => {
      const res = await apiRequest('POST', '/api/treasury/request-purchase', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Solicitud enviada',
        description: 'Lolita recibirá la solicitud de compra por correo electrónico',
      });
      setIsPurchaseDialogOpen(false);
      setSelectedCard(null);
      setUsdAmount('');
      setMxnAmount('');
      setAdditionalNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo enviar la solicitud',
        variant: 'destructive',
      });
    },
  });

  const handleSendPurchaseRequest = () => {
    if (!usdAmount || !selectedCard) return;

    const purchaseData = {
      source: selectedCard.source,
      amountUsd: parseFloat(usdAmount),
      amountMxn: parseFloat(mxnAmount),
      rate: selectedCard.buy,
      notes: additionalNotes,
    };

    sendPurchaseRequestMutation.mutate(purchaseData);
  };

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
          {/* Valor del tipo de cambio - Espacio limpio */}
          <div className="pb-4 border-b">
            {/* Números removidos según solicitud del usuario */}
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

                      {/* Fecha y hora */}
                      <div className="text-xs text-gray-500 text-center mb-3">
                        Actualizado: {new Date(data.date).toLocaleString('es-MX', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </div>

                      {/* Botón de compra */}
                      <Button
                        onClick={() => handleOpenPurchaseDialog(data)}
                        className="w-full font-semibold shadow-md hover:shadow-lg transition-all"
                        style={{ backgroundColor: config.color, color: 'white' }}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Comprar a este precio
                      </Button>
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
                <LineChart data={combinedData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                  <defs>
                    <linearGradient id="monexSellGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="santanderSellGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="dofSellGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={{ stroke: '#e2e8f0' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={{ stroke: '#e2e8f0' }}
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: any) => `$${value.toFixed(4)}`} 
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  
                  {monexData && (
                    <>
                      <Line 
                        type="monotone" 
                        dataKey="monexBuy" 
                        stroke="#60a5fa" 
                        strokeWidth={3} 
                        name="MONEX Compra" 
                        dot={false} 
                        strokeDasharray="5 5"
                        strokeOpacity={0.7}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="monexSell" 
                        stroke="#2563eb" 
                        strokeWidth={3} 
                        name="MONEX Venta" 
                        dot={false}
                      />
                    </>
                  )}
                  
                  {santanderData && (
                    <>
                      <Line 
                        type="monotone" 
                        dataKey="santanderBuy" 
                        stroke="#4ade80" 
                        strokeWidth={3} 
                        name="Santander Compra" 
                        dot={false} 
                        strokeDasharray="5 5"
                        strokeOpacity={0.7}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="santanderSell" 
                        stroke="#16a34a" 
                        strokeWidth={3} 
                        name="Santander Venta" 
                        dot={false}
                      />
                    </>
                  )}
                  
                  {dofData && (
                    <>
                      <Line 
                        type="monotone" 
                        dataKey="dofBuy" 
                        stroke="#fb923c" 
                        strokeWidth={3} 
                        name="DOF Compra" 
                        dot={false} 
                        strokeDasharray="5 5"
                        strokeOpacity={0.7}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="dofSell" 
                        stroke="#ea580c" 
                        strokeWidth={3} 
                        name="DOF Venta" 
                        dot={false}
                      />
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

      {/* Dialog para solicitud de compra */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" style={{ color: selectedCard ? getSourceConfig(selectedCard.source).color : undefined }} />
              Solicitar Compra de Dólares
            </DialogTitle>
            <DialogDescription>
              Envíale a Lolita tu solicitud de compra de dólares
            </DialogDescription>
          </DialogHeader>

          {selectedCard && (
            <div className="space-y-4 py-4">
              {/* Información de la fuente */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border-2" style={{ borderColor: getSourceConfig(selectedCard.source).color }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getSourceConfig(selectedCard.source).color }}></div>
                  <span className="font-bold" style={{ color: getSourceConfig(selectedCard.source).color }}>
                    {selectedCard.source}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Precio de Compra:</span>
                    <span className="font-bold">${selectedCard.buy.toFixed(4)} MXN</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Última actualización: {new Date(selectedCard.date).toLocaleString('es-MX', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                </div>
              </div>

              {/* Campo de cantidad en USD */}
              <div className="space-y-2">
                <Label htmlFor="usd-amount">Cantidad en USD</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="usd-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={usdAmount}
                    onChange={(e) => handleUsdChange(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Cantidad calculada en MXN */}
              {mxnAmount && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Cantidad a pagar:</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ${parseFloat(mxnAmount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                    </span>
                  </div>
                </div>
              )}

              {/* Notas adicionales */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas adicionales (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Ej: Urgente para pago a proveedor..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Vista previa del mensaje */}
              {usdAmount && mxnAmount && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border text-xs space-y-2">
                  <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Mensaje que se enviará:</div>
                  <div className="space-y-1 text-gray-600 dark:text-gray-400">
                    <p><strong>Hola Lolita,</strong></p>
                    <p>Por favor compra <strong>${parseFloat(usdAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} USD</strong> a precio de <strong>${selectedCard.buy.toFixed(4)} MXN</strong> ({selectedCard.source}).</p>
                    <p>Total a pagar: <strong>${parseFloat(mxnAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</strong></p>
                    {additionalNotes && <p>Nota: {additionalNotes}</p>}
                    <p>Gracias,<br/>Emilio</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPurchaseDialogOpen(false)}
              disabled={sendPurchaseRequestMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendPurchaseRequest}
              disabled={!usdAmount || sendPurchaseRequestMutation.isPending}
              className="flex items-center gap-2"
              style={{ backgroundColor: selectedCard ? getSourceConfig(selectedCard.source).color : undefined }}
            >
              {sendPurchaseRequestMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar a Lolita
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
