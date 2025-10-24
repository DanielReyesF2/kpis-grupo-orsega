import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  BarChart2, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronRight,
  Info,
  Calendar,
  Filter
} from 'lucide-react';

// Definiendo la interfaz para el tipo de datos de gráficos
interface ChartDataItem {
  period: string;
  date: string;
  value: number;
  originalValue: string;
  status?: string;
  isProjection: boolean;
}

// Función para generar una proyección lineal simple
const generateProjection = (data: any[], periods: number = 3): ChartDataItem[] => {
  if (!data || data.length < 2) return [];
  
  // Calcular la pendiente para la proyección lineal
  const n = data.length;
  const last = data.slice(-n); // Usar todos los datos disponibles para la proyección
  
  // Asegurar que los valores estén como números
  const values = last.map(item => {
    const numericValue = parseFloat(String(item.value || '0').replace(/[^0-9.-]+/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
  });
  
  // Calcular la pendiente promedio
  let sumChange = 0;
  for (let i = 1; i < values.length; i++) {
    sumChange += values[i] - values[i-1];
  }
  const avgChange = sumChange / (values.length - 1 || 1); // Evitar división por cero
  
  // Generar proyección para períodos futuros
  const lastValue = values[values.length - 1] || 0;
  const lastPeriod = last[last.length - 1]?.period || 'Enero 2025';
  
  // Generar períodos futuros
  const projection: ChartDataItem[] = [];
  for (let i = 1; i <= periods; i++) {
    const projectedValue = lastValue + (avgChange * i);
    // Determinar el período proyectado
    const dateParts = lastPeriod.split(' ');
    
    // Asumimos formato "Mes Año"
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    let monthIndex = monthNames.findIndex(m => m === dateParts[0]);
    if (monthIndex === -1) monthIndex = 0; // Si no encontramos el mes, usamos enero
    
    let year = parseInt(dateParts[1] || '2025');
    if (isNaN(year)) year = 2025;
    
    // Avanzar los meses para la proyección
    monthIndex = (monthIndex + i) % 12;
    if ((monthIndex + i) >= 12) {
      year += Math.floor((monthIndex + i) / 12);
    }
    
    const projectedValueFormatted = projectedValue.toFixed(2);
    
    projection.push({
      period: `${monthNames[monthIndex]} ${year}`,
      date: `Proyección ${i}`,
      value: projectedValue,
      originalValue: projectedValueFormatted,
      isProjection: true
    });
  }
  
  return projection;
};

// Interfaz para los resultados de tendencia
interface TrendStats {
  change: string;
  percentChange: string;
  numericPercentChange: number;
  trend: 'up' | 'down' | 'neutral';
}

// Función para calcular estadísticas de tendencia
const calculateTrendStats = (data: any[]): TrendStats => {
  if (!data || data.length < 2) return { 
    change: '0', 
    percentChange: '0', 
    numericPercentChange: 0,
    trend: 'neutral' 
  };
  
  // Obtener valores numéricos
  const values = data.map(item => {
    const numericValue = parseFloat(String(item.value).replace(/[^0-9.-]+/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
  });
  
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  const numericPercentChange = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
  
  // Determinar la tendencia
  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (numericPercentChange > 3) {
    trend = 'up';
  } else if (numericPercentChange < -3) {
    trend = 'down';
  }
  
  return {
    change: change.toFixed(2),
    percentChange: numericPercentChange.toFixed(2),
    numericPercentChange,
    trend
  };
};

export default function TrendsAnalysisPage() {
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedKpi, setSelectedKpi] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all');
  const [showProjections, setShowProjections] = useState<boolean>(true);
  
  // Consultas para obtener datos
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['/api/companies'],
  });
  
  const { data: areas, isLoading: isLoadingAreas } = useQuery({
    queryKey: ['/api/areas', selectedCompany && !isNaN(parseInt(selectedCompany)) ? { companyId: parseInt(selectedCompany) } : null],
    enabled: !!selectedCompany && !isNaN(parseInt(selectedCompany)),
  });
  
  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['/api/kpis', 
      selectedCompany ? { companyId: parseInt(selectedCompany) } : null,
      selectedArea ? { areaId: parseInt(selectedArea) } : null
    ],
    enabled: !!selectedCompany,
  });
  
  const { data: kpiValues, isLoading: isLoadingKpiValues } = useQuery({
    queryKey: ['/api/kpi-values', selectedKpi ? { kpiId: parseInt(selectedKpi) } : null],
    enabled: !!selectedKpi,
  });
  
  // Filtrar valores de KPI por período seleccionado
  const filteredKpiValues = kpiValues && Array.isArray(kpiValues) ? 
    kpiValues.filter((value: any) => {
      if (selectedTimeframe === 'all') return true;
      if (selectedTimeframe === '3months') {
        const valueDate = new Date(value.date);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return valueDate >= threeMonthsAgo;
      }
      if (selectedTimeframe === '6months') {
        const valueDate = new Date(value.date);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return valueDate >= sixMonthsAgo;
      }
      return true;
    }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  
  // Obtener detalles del KPI seleccionado
  const selectedKpiDetails = kpis && Array.isArray(kpis) && selectedKpi ? 
    kpis.find((kpi: any) => kpi.id === parseInt(selectedKpi)) : null;
  
  // Generar datos para el gráfico

  const chartData: ChartDataItem[] = filteredKpiValues.map((value: any) => ({
    period: value.period || 'Sin período',
    date: value.date ? new Date(value.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha',
    value: parseFloat(String(value.value || '0').replace(/[^0-9.-]+/g, '')) || 0,
    originalValue: value.value || '0',
    status: value.status,
    isProjection: false
  }));
  
  // Añadir proyecciones si están habilitadas
  const projectionData = showProjections ? generateProjection(filteredKpiValues) : [];
  const fullChartData = [...chartData, ...projectionData];
  
  // Calcular estadísticas de tendencia
  const trendStats = calculateTrendStats(filteredKpiValues);
  
  // Efecto para actualizar el área y KPI seleccionados cuando cambia la compañía
  useEffect(() => {
    setSelectedArea('');
    setSelectedKpi('');
  }, [selectedCompany]);
  
  // Efecto para actualizar el KPI seleccionado cuando cambia el área
  useEffect(() => {
    setSelectedKpi('');
  }, [selectedArea]);
  
  return (
    <AppLayout title="Análisis de Tendencias">
      <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Análisis de Tendencias</h1>
            <p className="text-secondary-500 dark:text-secondary-400">
              Analiza la evolución histórica de los KPIs y proyecta tendencias futuras
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período de tiempo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el historial</SelectItem>
                <SelectItem value="6months">Últimos 6 meses</SelectItem>
                <SelectItem value="3months">Últimos 3 meses</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant={showProjections ? "default" : "outline"} 
              size="sm"
              onClick={() => setShowProjections(!showProjections)}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              {showProjections ? "Ocultar proyecciones" : "Mostrar proyecciones"}
            </Button>
          </div>
        </div>
        
        {/* Selectores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtros</CardTitle>
            <CardDescription>Selecciona una empresa, área y KPI para analizar sus tendencias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Empresa</label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCompanies ? (
                      <div className="py-2 px-4">
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ) : companies && Array.isArray(companies) ? (
                      companies.map((company: any) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-4 text-center text-secondary-500">
                        No hay empresas disponibles
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Área</label>
                <Select 
                  value={selectedArea} 
                  onValueChange={setSelectedArea}
                  disabled={!selectedCompany || isLoadingAreas}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar área" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingAreas ? (
                      <div className="py-2 px-4">
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ) : areas && Array.isArray(areas) ? (
                      areas
                        .filter((area: any) => area.companyId === parseInt(selectedCompany))
                        .map((area: any) => (
                          <SelectItem key={area.id} value={area.id.toString()}>
                            {area.name}
                          </SelectItem>
                        ))
                    ) : (
                      <div className="py-2 px-4 text-center text-secondary-500">
                        No hay áreas disponibles
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">KPI</label>
                <Select 
                  value={selectedKpi} 
                  onValueChange={setSelectedKpi}
                  disabled={(!selectedCompany && !selectedArea) || isLoadingKpis}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar KPI" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingKpis ? (
                      <div className="py-2 px-4">
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ) : kpis && Array.isArray(kpis) ? (
                      kpis
                        .filter((kpi: any) => {
                          if (selectedArea) {
                            return kpi.areaId === parseInt(selectedArea);
                          }
                          return kpi.companyId === parseInt(selectedCompany);
                        })
                        .map((kpi: any) => (
                          <SelectItem key={kpi.id} value={kpi.id.toString()}>
                            {kpi.name}
                          </SelectItem>
                        ))
                    ) : (
                      <div className="py-2 px-4 text-center text-secondary-500">
                        No hay KPIs disponibles
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Contenido principal - Análisis */}
        {selectedKpi && selectedKpiDetails ? (
          <div className="space-y-6">
            {/* Resumen del KPI */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedKpiDetails.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {selectedKpiDetails.description || 'Sin descripción'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {selectedKpiDetails.unit || 'Sin unidad'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Valor actual */}
                  <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                    <div className="text-sm text-secondary-500 dark:text-secondary-400 mb-1">
                      Valor actual
                    </div>
                    <div className="text-2xl font-bold">
                      {filteredKpiValues.length > 0 ? 
                        filteredKpiValues[filteredKpiValues.length - 1].value :
                        'N/A'
                      }
                    </div>
                    <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      {filteredKpiValues.length > 0 ? 
                        new Date(filteredKpiValues[filteredKpiValues.length - 1].date).toLocaleDateString('es-ES') :
                        'Sin fecha'
                      }
                    </div>
                  </div>
                  
                  {/* Meta */}
                  <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-4">
                    <div className="text-sm text-secondary-500 dark:text-secondary-400 mb-1">
                      Meta
                    </div>
                    <div className="text-2xl font-bold">
                      {selectedKpiDetails.target || 'N/A'}
                    </div>
                    <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                      {selectedKpiDetails.targetDescription || 'Valor objetivo'}
                    </div>
                  </div>
                  
                  {/* Cambio */}
                  <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-4">
                    <div className="text-sm text-secondary-500 dark:text-secondary-400 mb-1">
                      Cambio absoluto
                    </div>
                    <div className="text-2xl font-bold flex items-center">
                      {trendStats.change}
                      {trendStats.trend === 'up' && (
                        <ArrowUpRight className="ml-1 h-5 w-5 text-green-600" />
                      )}
                      {trendStats.trend === 'down' && (
                        <ArrowDownRight className="ml-1 h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                      Desde el primer registro
                    </div>
                  </div>
                  
                  {/* Cambio porcentual */}
                  <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-4">
                    <div className="text-sm text-secondary-500 dark:text-secondary-400 mb-1">
                      Cambio porcentual
                    </div>
                    <div className={`text-2xl font-bold flex items-center ${
                      trendStats.trend === 'up' ? 'text-green-600 dark:text-green-400' :
                      trendStats.trend === 'down' ? 'text-red-600 dark:text-red-400' :
                      'text-secondary-800 dark:text-secondary-200'
                    }`}>
                      {trendStats.percentChange}%
                      {trendStats.trend === 'up' && (
                        <ArrowUpRight className="ml-1 h-5 w-5" />
                      )}
                      {trendStats.trend === 'down' && (
                        <ArrowDownRight className="ml-1 h-5 w-5" />
                      )}
                    </div>
                    <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                      {trendStats.trend === 'up' ? 'Tendencia positiva' :
                       trendStats.trend === 'down' ? 'Tendencia negativa' :
                       'Sin cambios significativos'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Tabs de visualización */}
            <Tabs defaultValue="line" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="line">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Línea de tendencia
                </TabsTrigger>
                <TabsTrigger value="bar">
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Gráfico de barras
                </TabsTrigger>
                <TabsTrigger value="area">
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Gráfico de área
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="line" className="mt-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Evolución histórica y proyección</CardTitle>
                    <CardDescription>
                      Evolución del KPI a lo largo del tiempo con proyección futura
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingKpiValues ? (
                      <Skeleton className="h-[400px] w-full" />
                    ) : fullChartData.length > 0 ? (
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={fullChartData}
                            margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              angle={-45} 
                              textAnchor="end"
                              height={70}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis />
                            <Tooltip 
                              formatter={(value, name) => {
                                const item = fullChartData.find(item => item.value === value);
                                return [item?.originalValue || value, 'Valor'];
                              }}
                              labelFormatter={(label) => {
                                const item = fullChartData.find(item => item.date === label);
                                return `${item?.period || label}`;
                              }}
                            />
                            <Legend />
                            {/* Línea para los datos históricos */}
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Valor Histórico"
                              activeDot={{ r: 6 }}
                              connectNulls
                              isAnimationActive={true}
                              animationDuration={1000}
                            />
                            {/* Línea para las proyecciones */}
                            {showProjections && projectionData.length > 0 && (
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#8884d8" 
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                dot={{ r: 4, fill: '#8884d8' }}
                                name="Proyección"
                                connectNulls
                                isAnimationActive={true}
                                animationDuration={1000}
                                data={projectionData}
                              />
                            )}
                            {/* Línea de referencia para el objetivo */}
                            {selectedKpiDetails.target && (
                              <ReferenceLine 
                                y={parseFloat(String(selectedKpiDetails.target).replace(/[^0-9.-]+/g, ''))}
                                stroke="#16a34a"
                                strokeDasharray="3 3"
                                label={{ 
                                  value: 'Meta', 
                                  position: 'insideBottomRight',
                                  fill: '#16a34a',
                                  fontSize: 12
                                }}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[400px] w-full flex items-center justify-center bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
                        <div className="text-center">
                          <Info className="h-10 w-10 text-secondary-400 mx-auto mb-2" />
                          <p className="text-secondary-500 dark:text-secondary-400">
                            No hay datos suficientes para mostrar la tendencia
                          </p>
                          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                            Añade valores históricos para visualizar la evolución
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="bar" className="mt-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Comparativa por períodos</CardTitle>
                    <CardDescription>
                      Compara los valores del KPI entre diferentes períodos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingKpiValues ? (
                      <Skeleton className="h-[400px] w-full" />
                    ) : chartData.length > 0 ? (
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              angle={-45} 
                              textAnchor="end"
                              height={70}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis />
                            <Tooltip 
                              formatter={(value, name) => {
                                const item = chartData.find(item => item.value === value);
                                return [item?.originalValue || value, 'Valor'];
                              }}
                              labelFormatter={(label) => {
                                const item = chartData.find(item => item.date === label);
                                return `${item?.period || label}`;
                              }}
                            />
                            <Legend />
                            <Bar 
                              dataKey="value" 
                              fill="#3b82f6"
                              name="Valor"
                              isAnimationActive={true}
                              animationDuration={1000}
                            />
                            {/* Línea de referencia para el objetivo */}
                            {selectedKpiDetails.target && (
                              <ReferenceLine 
                                y={parseFloat(String(selectedKpiDetails.target).replace(/[^0-9.-]+/g, ''))}
                                stroke="#16a34a"
                                strokeDasharray="3 3"
                                label={{ 
                                  value: 'Meta', 
                                  position: 'insideBottomRight',
                                  fill: '#16a34a',
                                  fontSize: 12
                                }}
                              />
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[400px] w-full flex items-center justify-center bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
                        <div className="text-center">
                          <Info className="h-10 w-10 text-secondary-400 mx-auto mb-2" />
                          <p className="text-secondary-500 dark:text-secondary-400">
                            No hay datos suficientes para mostrar la comparativa
                          </p>
                          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                            Añade valores históricos para visualizar los períodos
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="area" className="mt-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Gráfico de área</CardTitle>
                    <CardDescription>
                      Visualiza la evolución con un gráfico de área sombreada para mejor percepción
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingKpiValues ? (
                      <Skeleton className="h-[400px] w-full" />
                    ) : chartData.length > 0 ? (
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={fullChartData}
                            margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              angle={-45} 
                              textAnchor="end"
                              height={70}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis />
                            <Tooltip 
                              formatter={(value, name) => {
                                const item = fullChartData.find(item => item.value === value);
                                return [item?.originalValue || value, 'Valor'];
                              }}
                              labelFormatter={(label) => {
                                const item = fullChartData.find(item => item.date === label);
                                return `${item?.period || label}`;
                              }}
                            />
                            <Legend />
                            {/* Área para los datos históricos */}
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#3b82f6" 
                              fill="#3b82f6" 
                              fillOpacity={0.3}
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Valor Histórico"
                              activeDot={{ r: 6 }}
                              connectNulls
                              isAnimationActive={true}
                              animationDuration={1000}
                            />
                            {/* Área para las proyecciones */}
                            {showProjections && projectionData.length > 0 && (
                              <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#8884d8" 
                                fill="#8884d8"
                                fillOpacity={0.3}
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                dot={{ r: 4, fill: '#8884d8' }}
                                name="Proyección"
                                connectNulls
                                isAnimationActive={true}
                                animationDuration={1000}
                                data={projectionData}
                              />
                            )}
                            {/* Línea de referencia para el objetivo */}
                            {selectedKpiDetails.target && (
                              <ReferenceLine 
                                y={parseFloat(String(selectedKpiDetails.target).replace(/[^0-9.-]+/g, ''))}
                                stroke="#16a34a"
                                strokeDasharray="3 3"
                                label={{ 
                                  value: 'Meta', 
                                  position: 'insideBottomRight',
                                  fill: '#16a34a',
                                  fontSize: 12
                                }}
                              />
                            )}
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[400px] w-full flex items-center justify-center bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
                        <div className="text-center">
                          <Info className="h-10 w-10 text-secondary-400 mx-auto mb-2" />
                          <p className="text-secondary-500 dark:text-secondary-400">
                            No hay datos suficientes para mostrar el gráfico de área
                          </p>
                          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                            Añade valores históricos para visualizar la evolución
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            {/* Conclusiones y recomendaciones */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Análisis y recomendaciones</CardTitle>
                <CardDescription>
                  Interpretación automática basada en los datos históricos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
                      <h3 className="font-medium mb-2 flex items-center">
                        <TrendingUp className="mr-2 h-4 w-4 text-primary-600" />
                        Análisis de tendencia
                      </h3>
                      <p className="text-secondary-800 dark:text-secondary-200">
                        {trendStats.trend === 'up' ? (
                          <>
                            El KPI muestra una <span className="font-medium text-green-600 dark:text-green-400">tendencia positiva</span> con un incremento del {trendStats.percentChange}% desde el primer registro. 
                            {trendStats.numericPercentChange > 10 && "El crecimiento es significativo."}
                          </>
                        ) : trendStats.trend === 'down' ? (
                          <>
                            El KPI muestra una <span className="font-medium text-red-600 dark:text-red-400">tendencia negativa</span> con una disminución del {Math.abs(trendStats.numericPercentChange).toFixed(2)}% desde el primer registro.
                            {trendStats.numericPercentChange < -10 && "La disminución es significativa y requiere atención."}
                          </>
                        ) : (
                          <>
                            El KPI se mantiene <span className="font-medium">relativamente estable</span> con una variación del {trendStats.percentChange}% desde el primer registro.
                          </>
                        )}
                      </p>
                    </div>
                    
                    {/* Proyección */}
                    {showProjections && projectionData.length > 0 && (
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <h3 className="font-medium mb-2 flex items-center">
                          <ChevronRight className="mr-2 h-4 w-4 text-purple-600" />
                          Proyección futura
                        </h3>
                        <p className="text-secondary-800 dark:text-secondary-200">
                          Basado en los datos históricos, se proyecta que el KPI 
                          {projectionData.length > 0 && chartData.length > 0 && 
                            projectionData[projectionData.length - 1].value > chartData[chartData.length - 1].value ? (
                            <> seguirá <span className="font-medium text-green-600 dark:text-green-400">aumentando</span> hasta alcanzar aproximadamente <span className="font-medium">{projectionData[projectionData.length - 1].originalValue}</span> en {projectionData[projectionData.length - 1].period}.</>
                          ) : projectionData.length > 0 && chartData.length > 0 && 
                              projectionData[projectionData.length - 1].value < chartData[chartData.length - 1].value ? (
                            <> continuará <span className="font-medium text-red-600 dark:text-red-400">disminuyendo</span> hasta aproximadamente <span className="font-medium">{projectionData[projectionData.length - 1].originalValue}</span> en {projectionData[projectionData.length - 1].period}.</>
                          ) : (
                            <> se mantendrá <span className="font-medium">relativamente estable</span> en los próximos períodos.</>
                          )}
                        </p>
                      </div>
                    )}
                    
                    {/* Recomendaciones */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-medium mb-2 flex items-center">
                        <ChevronRight className="mr-2 h-4 w-4 text-blue-600" />
                        Recomendaciones
                      </h3>
                      <div className="space-y-2">
                        {trendStats.trend === 'up' ? (
                          <>
                            <p className="text-secondary-800 dark:text-secondary-200">
                              • Mantenga las prácticas actuales que están contribuyendo a esta tendencia positiva.
                            </p>
                            <p className="text-secondary-800 dark:text-secondary-200">
                              • Documente los factores que han impulsado esta mejora para aplicarlos en otras áreas.
                            </p>
                            {selectedKpiDetails.target && 
                             parseFloat(String(filteredKpiValues[filteredKpiValues.length - 1].value).replace(/[^0-9.-]+/g, '')) < 
                             parseFloat(String(selectedKpiDetails.target).replace(/[^0-9.-]+/g, '')) && (
                              <p className="text-secondary-800 dark:text-secondary-200">
                                • A pesar de la mejora, el KPI aún no alcanza el objetivo establecido. Continúe enfocándose en estrategias para cerrar esta brecha.
                              </p>
                            )}
                          </>
                        ) : trendStats.trend === 'down' ? (
                          <>
                            <p className="text-secondary-800 dark:text-secondary-200">
                              • Identifique las causas fundamentales de esta tendencia negativa y establezca un plan de acción correctivo.
                            </p>
                            <p className="text-secondary-800 dark:text-secondary-200">
                              • Realice un análisis más detallado de los factores que podrían estar afectando el desempeño de este KPI.
                            </p>
                            <p className="text-secondary-800 dark:text-secondary-200">
                              • Considere establecer objetivos intermedios para revertir gradualmente esta tendencia.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-secondary-800 dark:text-secondary-200">
                              • Evalúe si la estabilidad actual es suficiente o si se requiere un impulso adicional para mejorar el rendimiento.
                            </p>
                            <p className="text-secondary-800 dark:text-secondary-200">
                              • Identifique oportunidades incrementales para optimizar este KPI sin grandes cambios disruptivos.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg text-center">
                    <Info className="h-6 w-6 text-secondary-400 mx-auto mb-2" />
                    <p className="text-secondary-500 dark:text-secondary-400">
                      No hay datos suficientes para realizar un análisis
                    </p>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                      Añade al menos dos valores históricos para generar recomendaciones
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                <TrendingUp className="h-12 w-12 text-secondary-300 dark:text-secondary-700 mb-4" />
                <h3 className="text-xl font-medium mb-2">Selecciona un KPI para analizar</h3>
                <p className="text-secondary-500 dark:text-secondary-400 max-w-md">
                  Usa los filtros superiores para seleccionar una empresa, área y KPI específico para visualizar su análisis de tendencias y proyecciones futuras.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}