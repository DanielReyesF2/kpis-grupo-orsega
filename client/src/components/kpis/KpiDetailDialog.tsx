import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, 
  Line, ResponsiveContainer, Legend, PieChart, Pie, Sector, Cell 
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils/dates';
import { calculateKpiStatus, calculateCompliance } from '@/lib/utils/kpi-status';
import { Loader2 } from 'lucide-react';
import KpiHistoryChart from '@/components/dashboard/KpiHistoryChart';
import SalesWeeklyUpdateForm from '@/components/kpis/SalesWeeklyUpdateForm';

interface KpiDetailDialogProps {
  kpiId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const STATUS_COLORS = {
  complies: '#10b981', // Verde - Cumple
  alert: '#f59e0b',    // Amarillo - Alerta
  not_compliant: '#ef4444' // Rojo - No cumple
};

export function KpiDetailDialog({ kpiId, isOpen, onClose }: KpiDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Obtener el período actual (mes actual)
  const getCurrentPeriod = () => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  const [newUpdate, setNewUpdate] = useState({
    value: '',
    period: getCurrentPeriod(),
    comments: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Consulta para obtener los detalles del KPI
  const { data: kpi, isLoading: isLoadingKpi } = useQuery({
    queryKey: ['/api/kpis', kpiId],
    queryFn: async () => {
      if (!kpiId) return null;
      const res = await apiRequest('GET', `/api/kpis/${kpiId}`);
      return await res.json();
    },
    enabled: !!kpiId && isOpen
  });

  // Consulta para obtener valores históricos del KPI
  const { data: kpiValues, isLoading: isLoadingKpiValues } = useQuery({
    queryKey: ['/api/kpi-values', kpiId],
    queryFn: async () => {
      if (!kpiId) return [];
      const res = await apiRequest('GET', `/api/kpi-values?kpiId=${kpiId}`);
      return await res.json();
    },
    enabled: !!kpiId && isOpen
  });

  // Consulta para obtener el área del KPI
  const { data: area } = useQuery({
    queryKey: ['/api/areas', kpi?.areaId],
    queryFn: async () => {
      if (!kpi?.areaId) return null;
      const res = await apiRequest('GET', `/api/areas/${kpi.areaId}`);
      return await res.json();
    },
    enabled: !!kpi?.areaId && isOpen
  });
  
  // Consulta para obtener la compañía del KPI
  const { data: company } = useQuery({
    queryKey: ['/api/companies', kpi?.companyId],
    queryFn: async () => {
      if (!kpi?.companyId) return null;
      const res = await apiRequest('GET', `/api/companies/${kpi.companyId}`);
      return await res.json();
    },
    enabled: !!kpi?.companyId && isOpen
  });

  // Mutación para crear una nueva actualización
  const updateMutation = useMutation({
    mutationFn: async (data: typeof newUpdate & { kpiId: number; status?: string; compliancePercentage?: string }) => {
      const res = await apiRequest('POST', '/api/kpi-values', data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Actualización registrada',
        description: 'La actualización del KPI ha sido registrada exitosamente.',
      });
      
      // Limpiar el formulario
      setNewUpdate({
        value: '',
        period: getCurrentPeriod(), // Siempre usar el período actual
        comments: ''
      });
      
      // Refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kpi-values', kpiId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar la actualización. Intente nuevamente.',
        variant: 'destructive'
      });
    }
  });

  // Manejar cambios en el formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUpdate(prev => ({ ...prev, [name]: value }));
  };

  // Calcular porcentaje de cumplimiento y estado según el valor ingresado y la meta
  const calculateComplianceAndStatus = (value: string, target: string): { compliancePercentage: string, status: string } => {
    // Determinar si este KPI se trata de un indicador donde un valor menor es mejor
    // como el caso de "Rotación de cuentas por cobrar" que se mide en días
    const isLowerBetter = kpi?.name.includes("Rotación de cuentas por cobrar") || 
                         kpi?.name.includes("Velocidad de rotación") || 
                         (kpi?.name.includes("Tiempo") && !kpi?.name.includes("entrega"));
    
    // Para debugging
    console.log(`KPI ${kpi?.name} - ¿Métrica invertida?: ${isLowerBetter}`);
    console.log(`Valor actual: ${value}, Objetivo: ${target}`);
    
    // Calcular el porcentaje usando nuestra función centralizada
    const compliancePercentage = calculateCompliance(value, target, isLowerBetter);
    
    // Obtener el estado usando nuestra función centralizada
    const status = calculateKpiStatus(value, target, isLowerBetter);
    
    console.log(`Porcentaje calculado: ${compliancePercentage}, Estado: ${status}`);
    
    return {
      compliancePercentage,
      status
    };
  };

  // Manejar el envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!kpiId || !kpi?.target) return;
    
    // Calcular automáticamente el porcentaje de cumplimiento y el estado
    const { compliancePercentage, status } = calculateComplianceAndStatus(newUpdate.value, kpi.target);
    
    console.log(`Enviando actualización de KPI ${kpiId}: valor=${newUpdate.value}, porcentaje=${compliancePercentage}, estado=${status}`);
    
    // Actualizar con los valores calculados
    updateMutation.mutate({
      ...newUpdate,
      compliancePercentage,
      status,
      kpiId
    }, {
      onSuccess: () => {
        // Invalidar explícitamente todas las consultas relacionadas con KPIs para forzar su recarga en todos los componentes
        console.log("Actualizando todas las consultas de KPIs para refrescar datos en tiempo real");
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] });
        queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
        queryClient.invalidateQueries(); // Invalidar todas las consultas por seguridad
      }
    });
  };

  // Preparar datos para gráficos
  const chartData = kpiValues && Array.isArray(kpiValues) 
    ? kpiValues
        .filter((value: any) => value.kpiId === kpiId)
        .sort((a: any, b: any) => {
          // Ordenamos considerando primero el valor del período (Enero 2025, Febrero 2025, etc)
          // y como respaldo usamos la fecha del registro
          
          // Intentamos primero extraer el período (e.g., "Enero 2025", "Febrero 2025")
          const getPeriodValue = (period: string): number => {
            const months: Record<string, number> = {
              'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6,
              'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
            };
            
            // Extraer mes y año
            const parts = period.split(' ');
            if (parts.length >= 2) {
              const month = parts[0];
              const year = parseInt(parts[1], 10);
              
              if (months[month] && !isNaN(year)) {
                return year * 100 + months[month]; // Ejemplo: 202501 para Enero 2025
              }
            }
            
            // Si no podemos extraer el período, fallback a la fecha
            return new Date(period).getTime();
          };
          
          const valueA = getPeriodValue(a.period);
          const valueB = getPeriodValue(b.period);
          
          if (valueA && valueB) {
            return valueA - valueB;
          }
          
          // Fallback a ordenar por fecha
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        })
        .map((value: any) => {
          // Extraer el valor numérico para KPIs que contengan KG
          let numericValue = value.value;
          if (typeof value.value === 'string' && value.value.includes('KG')) {
            numericValue = parseInt(value.value.replace(/[^0-9,.]/g, '').replace(',', ''), 10);
          }
          
          return {
            // Usamos el período directamente como etiqueta (e.g., "Enero 2025")
            date: value.period,
            originalDate: formatDate(new Date(value.date)),
            value: value.value,
            numericValue: numericValue, // Valor numérico para gráficos
            status: value.status,
            compliancePercentage: value.compliancePercentage ? 
              parseFloat(value.compliancePercentage.replace('%', '')) : 0
          };
        })
    : [];

  // Datos para gráfico de pastel (distribución por estado)
  const pieData = chartData.reduce((acc: any, curr) => {
    const statusIndex = acc.findIndex((item: any) => item.name === curr.status);
    if (statusIndex >= 0) {
      acc[statusIndex].value += 1;
    } else {
      acc.push({
        name: curr.status,
        value: 1
      });
    }
    return acc;
  }, []);

  // Detectar si este es el KPI de Volumen de Ventas - LÓGICA ESTRICTA
  // Solo mostrar formulario de ventas para KPIs específicos de ventas
  const isSalesKpi = kpi && (
    kpi.id === 39 || // Dura Volumen de ventas
    kpi.id === 10 || // Orsega Volumen de ventas
    (kpi.name && 
     kpi.name.toLowerCase().includes('volumen') && 
     kpi.name.toLowerCase().includes('ventas') &&
     !kpi.name.toLowerCase().includes('clientes') && // Excluir KPIs de clientes
     !kpi.name.toLowerCase().includes('retention') && // Excluir retención
     !kpi.name.toLowerCase().includes('retención')
    )
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        {isLoadingKpi ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !kpi ? (
          <DialogHeader>
            <DialogTitle>KPI no encontrado</DialogTitle>
            <DialogDescription>
              No se pudo cargar la información del KPI.
            </DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <DialogTitle className="text-lg sm:text-xl font-bold">
                  {kpi.name}
                </DialogTitle>
                <Badge className={`text-xs whitespace-nowrap ${
                  kpi.status === 'complies' ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400' :
                  kpi.status === 'alert' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400' :
                  'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400'
                }`}>
                  {kpi.status === 'complies' ? 'Cumple' : 
                   kpi.status === 'alert' ? 'Alerta' : 'No cumple'}
                </Badge>
              </div>
              <DialogDescription>
                <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1 text-xs sm:text-sm">
                  <p><span className="font-medium">Objetivo:</span> {kpi.target}</p>
                  <p><span className="font-medium">Área:</span> {area?.name || 'Cargando...'}</p>
                  <p><span className="font-medium">Responsable:</span> {kpi.responsible || 'No asignado'}</p>
                  <p><span className="font-medium">Frecuencia:</span> {kpi.frequency === 'weekly' ? 'Semanal' : 
                    kpi.frequency === 'monthly' ? 'Mensual' : 
                    kpi.frequency === 'quarterly' ? 'Trimestral' : 
                    kpi.frequency === 'yearly' ? 'Anual' : kpi.frequency}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-3 sm:mt-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger className="text-xs sm:text-sm py-1.5" value="overview">Visión General</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm py-1.5" value="history">Historial</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm py-1.5" value="update">Actualizar</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="text-sm sm:text-base">Tendencia del Volumen de Ventas</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Evolución del KPI en el tiempo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{fontSize: 10}} />
                          <YAxis 
                            label={{ 
                              value: 'Kilogramos (KG)', 
                              angle: -90, 
                              position: 'insideLeft',
                              style: { fontSize: '10px' } 
                            }} 
                            tick={{fontSize: 10}}
                          />
                          <Tooltip 
                            formatter={(value, name) => {
                              // Extraer solo el valor numérico para valores que contienen "KG"
                              if (typeof value === 'string' && value.includes('KG')) {
                                const numericValue = value.replace(/[^0-9,.]/g, '').replace(',', '');
                                return [`${numericValue} KG`, "Volumen"];
                              }
                              return [value, name];
                            }}
                            contentStyle={{ fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Line 
                            type="monotone" 
                            dataKey="numericValue" 
                            name="Volumen (KG)" 
                            stroke="#4f46e5" 
                            activeDot={{ r: 6 }} 
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex justify-center items-center h-32 text-secondary-500 text-xs sm:text-sm">
                        No hay datos suficientes para mostrar la tendencia
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="text-sm sm:text-base">Último Reporte</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Detalles del último reporte registrado</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                          <div className="space-y-0.5 sm:space-y-1">
                            <p className="text-xs sm:text-sm font-medium text-secondary-500">Fecha</p>
                            <p className="text-xs sm:text-sm">{chartData[chartData.length - 1].date}</p>
                          </div>
                          <div className="space-y-0.5 sm:space-y-1">
                            <p className="text-xs sm:text-sm font-medium text-secondary-500">Valor</p>
                            <p className="text-xs sm:text-sm">{chartData[chartData.length - 1].value}</p>
                          </div>
                          <div className="space-y-0.5 sm:space-y-1">
                            <p className="text-xs sm:text-sm font-medium text-secondary-500">Estado</p>
                            <Badge className={`text-xs ${
                              chartData[chartData.length - 1].status === 'complies' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' :
                              chartData[chartData.length - 1].status === 'alert' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                              'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                            }`}>
                              {chartData[chartData.length - 1].status === 'complies' ? 'Cumple' : 
                               chartData[chartData.length - 1].status === 'alert' ? 'Alerta' : 'No cumple'}
                            </Badge>
                          </div>
                          <div className="space-y-0.5 sm:space-y-1">
                            <p className="text-xs sm:text-sm font-medium text-secondary-500">% Cumplimiento</p>
                            <p className="text-xs sm:text-sm">{chartData[chartData.length - 1].compliancePercentage}%</p>
                          </div>
                        </div>
                        
                        {kpiValues && kpiValues.length > 0 && kpiValues[kpiValues.length - 1].comments && (
                          <div className="mt-3 sm:mt-4">
                            <p className="text-xs sm:text-sm font-medium text-secondary-500">Comentarios</p>
                            <p className="text-xs sm:text-sm mt-1">{kpiValues[kpiValues.length - 1].comments}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-secondary-500 text-xs sm:text-sm py-4">
                        No hay reportes registrados aún
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="history" className="pt-2 sm:pt-4">
                {/* Gráfico de tendencia histórica */}
                <div className="mb-4">
                  {isLoadingKpiValues ? (
                    <div className="flex justify-center items-center h-32">
                      <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                    </div>
                  ) : kpiValues && Array.isArray(kpiValues) && kpiValues.length > 1 ? (
                    <KpiHistoryChart 
                      kpiValues={kpiValues}
                      title={`Tendencia histórica de ${kpi?.name || 'KPI'}`}
                      isInverted={
                        kpi?.name?.includes("Rotación de cuentas por cobrar") || 
                        kpi?.name?.includes("Velocidad de rotación") || 
                        (kpi?.name?.includes("Tiempo") && !kpi?.name?.includes("entrega"))
                      }
                      unit={kpi?.unit}
                      target={kpi?.target}
                    />
                  ) : (
                    <Card className="shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex justify-center items-center h-32 text-secondary-500 text-sm">
                          {kpiValues && Array.isArray(kpiValues) && kpiValues.length === 1 
                            ? "Se necesitan al menos dos puntos de datos para mostrar la tendencia histórica"
                            : "No hay datos históricos disponibles para este KPI"
                          }
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                {/* Registro detallado de actualizaciones */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="text-sm sm:text-base">Historial de Actualizaciones</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Registro cronológico de las actualizaciones del KPI</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingKpiValues ? (
                      <div className="flex justify-center items-center h-32">
                        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                      </div>
                    ) : kpiValues && kpiValues.length > 0 ? (
                      <div className="space-y-3 sm:space-y-4">
                        {kpiValues
                          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((value: any, index: number) => (
                            <div key={index} className="border rounded-lg p-2 sm:p-4 space-y-2 sm:space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                                <div className="space-y-0.5 sm:space-y-1">
                                  <p className="text-xs sm:text-sm font-medium text-secondary-500">Fecha</p>
                                  <p className="text-xs sm:text-sm">{value.period || formatDate(new Date(value.date))}</p>
                                </div>
                                <div className="space-y-0.5 sm:space-y-1">
                                  <p className="text-xs sm:text-sm font-medium text-secondary-500">Valor</p>
                                  <p className="text-xs sm:text-sm">{value.value}</p>
                                </div>
                                <div className="space-y-0.5 sm:space-y-1">
                                  <p className="text-xs sm:text-sm font-medium text-secondary-500">Estado</p>
                                  <Badge className={`text-xs ${
                                    value.status === 'complies' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' :
                                    value.status === 'alert' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                                  }`}>
                                    {value.status === 'complies' ? 'Cumple' : 
                                     value.status === 'alert' ? 'Alerta' : 'No cumple'}
                                  </Badge>
                                </div>
                                <div className="space-y-0.5 sm:space-y-1">
                                  <p className="text-xs sm:text-sm font-medium text-secondary-500">% Cumplimiento</p>
                                  <p className="text-xs sm:text-sm">{value.compliancePercentage || '-'}</p>
                                </div>
                              </div>
                              
                              {value.comments && (
                                <div>
                                  <p className="text-xs sm:text-sm font-medium text-secondary-500">Comentarios</p>
                                  <p className="text-xs sm:text-sm mt-0.5 sm:mt-1">{value.comments}</p>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center text-secondary-500 text-xs sm:text-sm py-6 sm:py-10">
                        No hay actualizaciones registradas para este KPI
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="update" className="pt-2 sm:pt-4">
                {isSalesKpi ? (
                  // Formulario especializado para actualización de ventas
                  <Card className="shadow-sm border-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/30">
                    <CardHeader className="pb-2 sm:pb-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 rounded-t-lg">
                      <CardTitle className="text-sm sm:text-base text-white flex items-center gap-2">
                        <span>✨ Actualizar Ventas Mensuales</span>
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-blue-100">
                        Selecciona el período y registra las ventas. Los datos se actualizarán automáticamente en el dashboard.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 sm:pt-6">
                      <SalesWeeklyUpdateForm showHeader={false} />
                    </CardContent>
                  </Card>
                ) : (
                  // Formulario genérico para otros KPIs
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2 sm:pb-4">
                      <CardTitle className="text-sm sm:text-base">Registrar Nueva Actualización</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Complete el formulario para registrar una nueva actualización del KPI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                        <div className="space-y-1 sm:space-y-2">
                          <Label htmlFor="value" className="text-xs sm:text-sm">Valor Actual</Label>
                          <Input
                            id="value"
                            name="value"
                            className="text-xs sm:text-sm h-8 sm:h-10"
                            placeholder={
                              kpi?.name?.includes("Volumen de ventas") && company?.name === "Dura International" ? 
                              "Ej: 52,450 KG" : 
                              kpi?.name?.includes("Volumen de ventas") && company?.name === "Grupo Orsega" ?
                              "Ej: 760,000 unidades" :
                              "Ej: 98.5%"
                            }
                            value={newUpdate.value}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                        
                        <div className="space-y-1 sm:space-y-2">
                          <Label htmlFor="period" className="text-xs sm:text-sm">Período</Label>
                          <div className="flex items-center border rounded-md h-8 sm:h-10 px-3 bg-secondary-50 dark:bg-secondary-900/20">
                            <div className="text-xs sm:text-sm text-secondary-700 dark:text-secondary-300 flex-1">
                              {newUpdate.period} <span className="text-xs text-secondary-500">(período actual)</span>
                            </div>
                          </div>
                          <p className="text-xs text-secondary-500 mt-1">
                            El período se establece automáticamente al mes actual.
                          </p>
                        </div>
                        
                        <div className="space-y-1 sm:space-y-2 md:col-span-2">
                          <Label className="text-xs sm:text-sm">Estado y Cumplimiento</Label>
                          <div className="px-3 sm:px-4 py-2 sm:py-3 rounded-md bg-secondary/10 text-xs sm:text-sm">
                            El estado y porcentaje de cumplimiento se calcularán automáticamente 
                            al enviar el formulario, basándose en el valor ingresado y la meta establecida.
                            {kpi?.name.includes("Velocidad de rotación") || 
                             (kpi?.name.includes("Tiempo") && !kpi?.name.includes("entrega")) ? (
                              <p className="mt-1 font-medium text-primary-700 dark:text-primary-500">
                                Nota: Para este KPI, valores menores al objetivo representan un mejor desempeño.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1 sm:space-y-2">
                        <Label htmlFor="comments" className="text-xs sm:text-sm">Comentarios</Label>
                        <Textarea
                          id="comments"
                          name="comments"
                          className="text-xs sm:text-sm min-h-[80px] sm:min-h-[100px]"
                          placeholder="Ingrese detalles, causas, acciones tomadas, etc."
                          value={newUpdate.comments}
                          onChange={handleInputChange}
                          rows={3}
                        />
                      </div>
                      
                      <DialogFooter className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={onClose}
                          disabled={updateMutation.isPending}
                          className="w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2 h-8 sm:h-10"
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="submit"
                          disabled={updateMutation.isPending}
                          className="w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2 h-8 sm:h-10"
                        >
                          {updateMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                              Guardando...
                            </>
                          ) : (
                            'Guardar Actualización'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </CardContent>
                </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}