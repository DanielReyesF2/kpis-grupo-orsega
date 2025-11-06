import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Clock, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ExchangeRateHistoryV2 } from './ExchangeRateHistoryV2';

interface DailyDataPoint {
  hour: string; // HH:mm
  timestamp: string;
  santander?: number;
  monex?: number;
  dof?: number;
}

interface MonthlyDataPoint {
  day: number; // día del mes (1-31)
  date: string; // fecha completa ISO
  santander?: number;
  monex?: number;
  dof?: number;
}

export function ExchangeRateHistory() {
  const useNewHistory = useFeatureFlag('new-exchange-rate-history');

  // Si el feature flag está activado, usar la nueva versión
  if (useNewHistory) {
    return <ExchangeRateHistoryV2 />;
  }

  // Versión original (V1) - hooks después del early return condicional
  return <ExchangeRateHistoryV1 />;
}

// Versión original del componente (V1)
function ExchangeRateHistoryV1() {
  const [rateType, setRateType] = useState<'buy' | 'sell'>('buy');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  // Query para datos diarios (últimas 24 horas)
  const { data: dailyData, isLoading: isLoadingDaily, error: dailyError } = useQuery<DailyDataPoint[]>({
    queryKey: ['/api/treasury/exchange-rates/daily', { rateType }],
    staleTime: 30000, // 30 segundos
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    onSuccess: (data) => {
      console.log('[ExchangeRateHistory] Datos diarios recibidos:', data?.length || 0, 'puntos');
    },
    onError: (error) => {
      console.error('[ExchangeRateHistory] Error cargando datos diarios:', error);
    },
  });

  // Query para datos mensuales
  const { data: monthlyData, isLoading: isLoadingMonthly, error: monthlyError } = useQuery<MonthlyDataPoint[]>({
    queryKey: ['/api/treasury/exchange-rates/monthly', {
      year: selectedMonth.getFullYear(),
      month: selectedMonth.getMonth() + 1,
      rateType,
    }],
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: !!selectedMonth,
    onSuccess: (data) => {
      console.log('[ExchangeRateHistory] Datos mensuales recibidos:', data?.length || 0, 'días');
      console.log('[ExchangeRateHistory] Mes consultado:', selectedMonth.getFullYear(), selectedMonth.getMonth() + 1);
    },
    onError: (error) => {
      console.error('[ExchangeRateHistory] Error cargando datos mensuales:', error);
    },
  });

  // Generar opciones de mes/año para el selector
  const monthOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    const today = new Date();
    
    // Últimos 12 meses
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = format(date, 'MMMM yyyy', { locale: es });
      options.push({ label, value });
    }
    
    return options;
  }, []);

  // Colores por fuente
  const sourceColors = {
    santander: '#16a34a', // verde
    monex: '#2563eb', // azul
    dof: '#ea580c', // naranja
  };

  // Preparar datos para gráfica diaria
  const dailyChartData = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    
    // Ordenar por timestamp
    const sorted = [...dailyData].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    return sorted;
  }, [dailyData]);

  // Preparar datos para gráfica mensual
  const monthlyChartData = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return [];
    
    // Ordenar por día
    const sorted = [...monthlyData].sort((a, b) => a.day - b.day);
    
    return sorted;
  }, [monthlyData]);

  // Custom tooltip para vista diaria
  const DailyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const data = payload[0].payload;
    const dataArray = dailyChartData;
    const currentIndex = dataArray.findIndex((d: DailyDataPoint) => d.hour === label);
    
    let variationText = '';
    if (currentIndex > 0) {
      const previous = dataArray[currentIndex - 1];
      const current = data;
      
      // Calcular variación para cada fuente presente
      const variations: string[] = [];
      if (current.santander && previous.santander) {
        const varPercent = ((current.santander - previous.santander) / previous.santander) * 100;
        variations.push(`Santander: ${varPercent >= 0 ? '+' : ''}${varPercent.toFixed(2)}%`);
      }
      if (current.monex && previous.monex) {
        const varPercent = ((current.monex - previous.monex) / previous.monex) * 100;
        variations.push(`MONEX: ${varPercent >= 0 ? '+' : ''}${varPercent.toFixed(2)}%`);
      }
      if (current.dof && previous.dof) {
        const varPercent = ((current.dof - previous.dof) / previous.dof) * 100;
        variations.push(`DOF: ${varPercent >= 0 ? '+' : ''}${varPercent.toFixed(2)}%`);
      }
      
      variationText = variations.join(', ');
    }
    
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: ${entry.value?.toFixed(4) || '0.0000'}
          </p>
        ))}
        {variationText && (
          <p className="text-xs text-muted-foreground mt-2">Variación: {variationText}</p>
        )}
      </div>
    );
  };

  // Custom tooltip para vista mensual
  const MonthlyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const data = payload[0].payload;
    
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold mb-2">
          {format(parseISO(data.date), "dd 'de' MMMM, yyyy", { locale: es })}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: ${entry.value?.toFixed(4) || '0.0000'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={rateType} onValueChange={(value) => setRateType(value as 'buy' | 'sell')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buy">Compra</SelectItem>
            <SelectItem value="sell">Venta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Diario
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Mensual
          </TabsTrigger>
        </TabsList>

          <TabsContent value="daily" className="space-y-4">
            {dailyError && (
              <div className="text-center py-4 text-red-500 text-sm">
                Error al cargar datos: {dailyError instanceof Error ? dailyError.message : 'Error desconocido'}
              </div>
            )}
            {isLoadingDaily ? (
              <Skeleton className="h-[400px] w-full" />
            ) : dailyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dailyChartData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" opacity={0.3} />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip content={<DailyTooltip />} />
                  <Legend />
                  {dailyChartData.some(d => d.santander) && (
                    <Line 
                      type="monotone" 
                      dataKey="santander" 
                      stroke={sourceColors.santander}
                      strokeWidth={2}
                      name="Santander"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {dailyChartData.some(d => d.monex) && (
                    <Line 
                      type="monotone" 
                      dataKey="monex" 
                      stroke={sourceColors.monex}
                      strokeWidth={2}
                      name="MONEX"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {dailyChartData.some(d => d.dof) && (
                    <Line 
                      type="monotone" 
                      dataKey="dof" 
                      stroke={sourceColors.dof}
                      strokeWidth={2}
                      name="DOF"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No hay datos disponibles para las últimas 24 horas</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select 
                value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
                onValueChange={(value) => {
                  const [year, month] = value.split('-').map(Number);
                  setSelectedMonth(new Date(year, month - 1, 1));
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {monthlyError && (
              <div className="text-center py-4 text-red-500 text-sm">
                Error al cargar datos: {monthlyError instanceof Error ? monthlyError.message : 'Error desconocido'}
              </div>
            )}
            {isLoadingMonthly ? (
              <Skeleton className="h-[400px] w-full" />
            ) : monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyChartData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" opacity={0.3} />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Día del mes', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Legend />
                  {monthlyChartData.some(d => d.santander) && (
                    <Line 
                      type="monotone" 
                      dataKey="santander" 
                      stroke={sourceColors.santander}
                      strokeWidth={2}
                      name="Santander"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {monthlyChartData.some(d => d.monex) && (
                    <Line 
                      type="monotone" 
                      dataKey="monex" 
                      stroke={sourceColors.monex}
                      strokeWidth={2}
                      name="MONEX"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {monthlyChartData.some(d => d.dof) && (
                    <Line 
                      type="monotone" 
                      dataKey="dof" 
                      stroke={sourceColors.dof}
                      strokeWidth={2}
                      name="DOF"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">
                  No hay datos disponibles para {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
