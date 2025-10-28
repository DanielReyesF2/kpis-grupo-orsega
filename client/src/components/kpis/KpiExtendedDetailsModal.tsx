import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Edit2, Save, X, FileText } from 'lucide-react';

const extendedKpiSchema = z.object({
  kpiDefinition: z.string().optional(),
  businessPerspectives: z.string().optional(),
  measurementApproach: z.string().optional(),
  trendAnalysis: z.string().optional(),
  diagnosticQuestions: z.string().optional(),
  visualizationSuggestions: z.string().optional(),
  riskAlerts: z.string().optional(),
  practicalRecommendations: z.string().optional(),
  integrationPoints: z.string().optional(),
  toolsTechnologies: z.string().optional(),
  impactOfChange: z.string().optional(),
});

type FormValues = z.infer<typeof extendedKpiSchema>;

interface KpiExtendedDetailsModalProps {
  kpiId: number;
  isOpen: boolean;
  onClose: () => void;
}

const fieldLabels: Record<keyof FormValues, string> = {
  kpiDefinition: 'Definición del KPI',
  businessPerspectives: 'Perspectivas de Negocio',
  measurementApproach: 'Enfoque de Medición',
  trendAnalysis: 'Análisis de Tendencias',
  diagnosticQuestions: 'Preguntas de Diagnóstico',
  visualizationSuggestions: 'Sugerencias de Visualización',
  riskAlerts: 'Alertas de Riesgo',
  practicalRecommendations: 'Recomendaciones Prácticas',
  integrationPoints: 'Puntos de Integración',
  toolsTechnologies: 'Herramientas y Tecnologías',
  impactOfChange: 'Impacto del Cambio',
};

export function KpiExtendedDetailsModal({ kpiId, isOpen, onClose }: KpiExtendedDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Obtener datos del KPI
  const { data: kpi, isLoading: kpiLoading } = useQuery({
    queryKey: [`/api/kpis/${kpiId}`],
    enabled: isOpen && !!kpiId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(extendedKpiSchema),
    defaultValues: {
      kpiDefinition: '',
      businessPerspectives: '',
      measurementApproach: '',
      trendAnalysis: '',
      diagnosticQuestions: '',
      visualizationSuggestions: '',
      riskAlerts: '',
      practicalRecommendations: '',
      integrationPoints: '',
      toolsTechnologies: '',
      impactOfChange: '',
    },
  });

  // Actualizar el formulario cuando cargan los datos del KPI
  useEffect(() => {
    if (kpi) {
      form.reset({
        kpiDefinition: kpi.kpiDefinition || '',
        businessPerspectives: kpi.businessPerspectives || '',
        measurementApproach: kpi.measurementApproach || '',
        trendAnalysis: kpi.trendAnalysis || '',
        diagnosticQuestions: kpi.diagnosticQuestions || '',
        visualizationSuggestions: kpi.visualizationSuggestions || '',
        riskAlerts: kpi.riskAlerts || '',
        practicalRecommendations: kpi.practicalRecommendations || '',
        integrationPoints: kpi.integrationPoints || '',
        toolsTechnologies: kpi.toolsTechnologies || '',
        impactOfChange: kpi.impactOfChange || '',
      });
    }
  }, [kpi, form]);

  // Mutación para actualizar KPI
  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest('PUT', `/api/kpis/${kpiId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kpis/${kpiId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      setIsEditing(false);
      setIsSubmitting(false);
      toast({ 
        title: 'Información extendida actualizada', 
        description: 'Los datos del KPI se han guardado correctamente.' 
      });
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      toast({ 
        title: 'Error al guardar', 
        description: error.message || 'No se pudo guardar la información.',
        variant: 'destructive'
      });
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    if (kpi) {
      form.reset({
        kpiDefinition: kpi.kpiDefinition || '',
        businessPerspectives: kpi.businessPerspectives || '',
        measurementApproach: kpi.measurementApproach || '',
        trendAnalysis: kpi.trendAnalysis || '',
        diagnosticQuestions: kpi.diagnosticQuestions || '',
        visualizationSuggestions: kpi.visualizationSuggestions || '',
        riskAlerts: kpi.riskAlerts || '',
        practicalRecommendations: kpi.practicalRecommendations || '',
        integrationPoints: kpi.integrationPoints || '',
        toolsTechnologies: kpi.toolsTechnologies || '',
        impactOfChange: kpi.impactOfChange || '',
      });
    }
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Información Extendida del KPI
          </DialogTitle>
          <DialogDescription>
            {kpi?.name || 'Cargando...'}
          </DialogDescription>
        </DialogHeader>

        {kpiLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex justify-end gap-2">
                {!isEditing ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isSubmitting ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                {(Object.keys(fieldLabels) as Array<keyof FormValues>).map((field) => (
                  <FormField
                    key={field}
                    control={form.control}
                    name={field}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">
                          {fieldLabels[field]}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...formField}
                            disabled={!isEditing}
                            placeholder={`Ingresa información sobre ${fieldLabels[field].toLowerCase()}...`}
                            className={`min-h-[100px] resize-none ${
                              !isEditing ? 'bg-gray-50 dark:bg-gray-800' : ''
                            }`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
