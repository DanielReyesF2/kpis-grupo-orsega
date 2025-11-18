import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp, TrendingDown, Minus, RefreshCw, DollarSign, Send, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExchangeRateHistory } from '@/components/treasury/ExchangeRateHistory';

export function DofChart() {
  console.log('[DofChart] �� COMPONENTE MONTADO - Iniciando DofChart');
  
  const { user } = useAuth();
  const { toast } = useToast();
  // Periodo fijo: 90 días (sin filtro para simplificar)
  const fxPeriodDays = 90;
  
  // Forzar log inmediato
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      console.log('[DofChart] ✅ useEffect ejecutado - Componente está vivo');
    }
    return () => {
      isMounted = false;
    };
  }, []);
  
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [usdAmount, setUsdAmount] = useState('');
  const [mxnAmount, setMxnAmount] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Obtener datos de las 3 fuentes - periodo fijo de 90 días
  const { data: monexSeries, isLoading: monexLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=MONEX&days=90`],
    staleTime: 0, // No cachear para obtener datos frescos
    gcTime: 0, // No mantener en caché
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: santanderSeries, isLoading: santanderLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=Santander&days=90`],
    staleTime: 0, // No cachear para obtener datos frescos
    gcTime: 0, // No mantener en caché
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: dofSeries, isLoading: dofLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=DOF&days=90`],
    staleTime: 0, // No cachear para obtener datos frescos
    gcTime: 0, // No mantener en caché
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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
    
    // El backend ya ordena por fecha descendente (más reciente primero)
    // Tomar el primer elemento que es el más reciente
    const latest = series.series[0];
    const previous = series.series.length > 1 ? series.series[1] : null;
    
    const buyChange = previous ? latest.buy - previous.buy : 0;
    const sellChange = previous ? latest.sell - previous.sell : 0;
    
    // Log para debug
    const dateObj = new Date(latest.date);
    console.log(`[DofChart] ${sourceName}:`, {
      totalSeries: series.series.length,
      rawDate: latest.date,
      dateType: typeof latest.date,
      parsedDate: dateObj.toISOString(),
      parsedDateLocal: dateObj.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
      formatted: format(dateObj, "dd/MM/yyyy HH:mm:ss", { locale: es }),
      buy: latest.buy,
      sell: latest.sell,
      buyChange: buyChange,
      sellChange: sellChange
    });
    
    return {
      source: sourceName,
      buy: latest.buy,
      sell: latest.sell,
      spread: latest.sell - latest.buy,
      buyChange,
      sellChange,
      date: latest.date, // Mantener la fecha completa con hora
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
    if (change > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-600" />;
    return <Minus className="h-3.5 w-3.5 text-gray-400" />;
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#ea580c]" />
            Histórico de Tipos de Cambio
          </CardTitle>
          <CardDescription className="text-sm mt-1 font-medium text-foreground/80">Último mes de tipos de cambio</CardDescription>
        </div>
      </CardHeader>
      {isLoading ? (
        <CardContent className="pt-3">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      ) : (
        <CardContent className="pt-3">
          <ExchangeRateHistory />
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
                    Última actualización: {format(new Date(selectedCard.date), "dd/MM/yyyy HH:mm:ss", { locale: es })}
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
