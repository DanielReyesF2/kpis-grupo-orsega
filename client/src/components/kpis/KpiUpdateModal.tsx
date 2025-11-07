import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Save,
  Info,
  Edit
} from 'lucide-react';
import SalesWeeklyUpdateForm from '@/components/kpis/SalesWeeklyUpdateForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KpiHistoryBulkEditModal } from '@/components/kpis/KpiHistoryBulkEditModal';

const updateKpiSchema = z.object({
  value: z.string().min(1, "El valor es requerido"),
  comments: z.string().optional(),
  period: z.string().optional(),
});

type FormValues = z.infer<typeof updateKpiSchema>;

interface KpiUpdateModalProps {
  kpiId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function KpiUpdateModal({ kpiId, isOpen, onClose }: KpiUpdateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  // Obtener datos del KPI
  const { data: kpi, isLoading: kpiLoading } = useQuery({
    queryKey: [`/api/kpis/${kpiId}`],
    enabled: isOpen && !!kpiId,
  });

  // Obtener valores del KPI específico usando el parámetro correcto
  const { data: kpiValues, isLoading: kpiValuesLoading } = useQuery({
    queryKey: ['/api/kpi-values', { kpiId: kpiId }],
    queryFn: async () => {
      if (!kpiId) return [];
      console.log(`[KpiUpdateModal] Obteniendo valores para KPI ${kpiId}`);
      const response = await apiRequest('GET', `/api/kpi-values?kpiId=${kpiId}`);
      if (!response.ok) {
        throw new Error('Error al obtener valores del KPI');
      }
      const values = await response.json();
      console.log(`[KpiUpdateModal] Valores obtenidos para KPI ${kpiId}:`, values.length);
      return values;
    },
    enabled: isOpen && !!kpiId,
  });

  // Obtener el valor más reciente - asegurar que sea del KPI correcto
  const latestValue = useMemo(() => {
    if (!kpiValues || !Array.isArray(kpiValues)) return undefined;
    
    // Filtrar estrictamente por kpiId y convertir a número si es necesario
    const filtered = kpiValues.filter((v: any) => {
      const vKpiId = typeof v.kpiId === 'number' ? v.kpiId : parseInt(v.kpiId);
      const targetKpiId = typeof kpiId === 'number' ? kpiId : parseInt(String(kpiId));
      return vKpiId === targetKpiId;
    });
    
    if (filtered.length === 0) {
      console.log(`[KpiUpdateModal] No se encontraron valores para KPI ${kpiId}`);
      return undefined;
    }
    
    const sorted = filtered.sort((a: any, b: any) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Más reciente primero
    });
    
    console.log(`[KpiUpdateModal] Valor más reciente para KPI ${kpiId}:`, sorted[0]);
    return sorted[0];
  }, [kpiValues, kpiId]);

  // FORZAR: Todos los KPIs usan el formulario genérico, NO el de ventas
  // El formulario de ventas solo se muestra desde el formulario prominente en la página
  const isSalesKpi = false; // SIEMPRE false para que todos usen el mismo modal genérico

  // Log para debugging
  useEffect(() => {
    if (kpi && isOpen && typeof kpi === 'object' && kpi !== null && 'id' in kpi && 'name' in kpi) {
      console.log('[KpiUpdateModal] KPI detectado:', {
        id: (kpi as any).id,
        name: (kpi as any).name,
        isSalesKpi: isSalesKpi,
        willShowSalesForm: isSalesKpi
      });
    }
  }, [kpi, isOpen, isSalesKpi]);

  const form = useForm<FormValues>({
    resolver: zodResolver(updateKpiSchema),
    defaultValues: {
      value: '',
      comments: '',
      period: getCurrentPeriod(),
    },
  });

  function getCurrentPeriod() {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const now = new Date();
    
    // Calcular la semana del año
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    
    return `Semana ${weekNumber} - ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  // Mutación para actualizar KPI
  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      console.log('[KPI Update] Enviando datos:', {
        kpiId: kpiId,
        kpiName: (kpi && typeof kpi === 'object' && kpi !== null && 'name' in kpi) ? (kpi as any).name : 'N/A',
        value: data.value,
        period: data.period || getCurrentPeriod(),
        comments: data.comments || '',
        isSalesKpi: isSalesKpi
      });
      
      try {
        const response = await apiRequest(
          'POST',
          `/api/kpi-values`,
          {
            kpiId: kpiId,
            value: data.value,
            period: data.period || getCurrentPeriod(),
            comments: data.comments || '',
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || 'Error al actualizar KPI');
        }
        
        const result = await response.json();
        console.log('[KPI Update] Respuesta exitosa:', result);
        return result;
      } catch (error) {
        console.error('[KPI Update] Error en la petición:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('[KPI Update] Actualización exitosa, invalidando cachés y actualizando historial');
      
      toast({
        title: "✅ KPI actualizado exitosamente",
        description: "El valor del KPI ha sido registrado correctamente y se ha guardado en el historial.",
        variant: "default",
      });
      
      // Invalidar cachés relevantes para actualizar la UI
      queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kpi-values', kpiId] });
      queryClient.invalidateQueries({ queryKey: [`/api/kpis/${kpiId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/kpi-history/${kpiId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      
      // Invalidar la query de colaboradores para actualizar las tarjetas
      queryClient.invalidateQueries({ queryKey: ['/api/collaborators-performance'] });
      
      // Forzar refetch del historial para ver la actualización inmediatamente
      queryClient.refetchQueries({ queryKey: [`/api/kpi-history/${kpiId}`] });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar KPI",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resetear formulario cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      form.reset({
        value: '',
        comments: '',
        period: getCurrentPeriod(),
      });
    }
  }, [isOpen, form]);

  // Función para obtener color del estado
  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
    switch (status) {
      case 'complies': return 'bg-green-100 text-green-800 border-green-200';
      case 'alert': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'not_compliant': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Función para obtener texto del estado
  const getStatusText = (status: string | null | undefined) => {
    if (!status) return 'Sin Estado';
    switch (status) {
      case 'complies': return 'Cumple';
      case 'alert': return 'Alerta';
      case 'not_compliant': return 'No Cumple';
      default: return 'Sin Estado';
    }
  };

  // Función para obtener ícono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complies': return <CheckCircle className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      case 'not_compliant': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  if (kpiLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Cargando KPI...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Actualizar KPI
          </DialogTitle>
          <DialogDescription>
            Registra un nuevo valor para este KPI
          </DialogDescription>
        </DialogHeader>

        {(kpi && typeof kpi === 'object' && kpi !== null && 'id' in kpi && 'name' in kpi) ? (
          <div className="space-y-6">
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
                  <SalesWeeklyUpdateForm showHeader={false} defaultCompanyId={(kpi as any).companyId} />
                </CardContent>
              </Card>
            ) : (
              // Formulario genérico para otros KPIs
              <>
                {/* Información del KPI */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    Información del KPI
                  </h3>
                  
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Nombre:</span>
                      <div className="font-semibold text-gray-900">{(kpi as any).name}</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Meta:</span>
                        <div className="text-lg font-bold text-blue-600">{(kpi as any).target || 'Sin meta definida'}</div>
                      </div>
                      
                      {latestValue && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Valor Actual:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">{latestValue.value}</span>
                            <Badge className={`text-xs ${getStatusColor(latestValue.status)}`}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(latestValue.status)}
                                {getStatusText(latestValue.status)}
                              </div>
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>

                    {latestValue && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                          <span className="text-sm font-medium text-gray-600">Cumplimiento:</span>
                          <div className="text-lg font-bold text-green-600">{latestValue.compliancePercentage}%</div>
                        </div>
                        
                        <div>
                          <span className="text-sm font-medium text-gray-600">Última actualización:</span>
                          <div className="text-sm text-gray-700 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(latestValue.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {latestValue?.comments && (
                      <div className="pt-2">
                        <span className="text-sm font-medium text-gray-600">Comentarios anteriores:</span>
                        <div className="text-sm text-gray-700 bg-white p-2 rounded border mt-1">
                          {latestValue.comments}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón para editar historial completo */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsBulkEditOpen(true)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Editar Historial Completo del Año
                  </Button>
                </div>

                {/* Formulario de actualización */}
                <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Nuevo Valor
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: 95.5%, 1500 KG, 2.3 días"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Período (Automático)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={true}
                          className="bg-gray-50 text-gray-700 cursor-not-allowed"
                          readOnly
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1">
                        El período se detecta automáticamente basado en la semana actual
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comentarios (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Agrega comentarios sobre esta actualización..."
                          className="min-h-[80px]"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Actualizar KPI
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>

    {/* Modal de edición de historial completo */}
    {kpi && typeof kpi === 'object' && kpi !== null && 'id' in kpi && 'name' in kpi && 'companyId' in kpi && (
      <KpiHistoryBulkEditModal
        kpiId={kpiId}
        companyId={(kpi as any).companyId}
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        kpiName={(kpi as any).name}
      />
    )}
  </>
  );
}