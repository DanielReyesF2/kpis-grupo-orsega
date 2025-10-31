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

// Función para generar información predeterminada basada en el tipo de KPI
function getDefaultKpiInfo(kpiName: string, kpiDescription?: string, target?: string, unit?: string): Partial<FormValues> {
  const name = kpiName?.toLowerCase() || '';
  const description = kpiDescription || '';
  
  // Volumen de Ventas
  if (name.includes('volumen') && name.includes('ventas')) {
    return {
      kpiDefinition: `Mide el volumen total de ventas mensual alcanzado. ${description || 'Este KPI es fundamental para evaluar el desempeño comercial de la empresa y medir el cumplimiento de objetivos de venta.'}`,
      businessPerspectives: `El volumen de ventas es un indicador clave de la salud comercial del negocio. Afecta directamente el flujo de caja, la rentabilidad y la capacidad de crecimiento. Un volumen sostenido permite evaluar la efectividad de estrategias comerciales y la demanda del mercado.`,
      measurementApproach: `Se calcula mediante la suma del volumen total de todas las ventas en ${unit || 'unidades'} durante el período de medición (mensual). Los datos se obtienen del sistema CRM y reportes de ventas. La frecuencia de medición es mensual para permitir análisis de tendencias y ajustes estratégicos.`,
      trendAnalysis: `El análisis de tendencias permite identificar patrones estacionales, ciclos de demanda y oportunidades de crecimiento. Es importante comparar con períodos anteriores, considerar factores externos como condiciones de mercado, y evaluar el impacto de campañas comerciales.`,
      diagnosticQuestions: `• ¿Se está cumpliendo el objetivo de ventas mensual?\n• ¿Existen variaciones estacionales en el volumen?\n• ¿Qué factores están impactando el desempeño?\n• ¿Hay oportunidades de crecimiento no aprovechadas?\n• ¿Cómo se compara con la competencia?`,
      visualizationSuggestions: `Gráficas de barras mensuales, líneas de tendencia temporal, gráficas comparativas año sobre año, heatmaps de volumen por producto o región.`,
      riskAlerts: `Alertas cuando el volumen desciende más del 15% respecto al mes anterior, cuando no se alcanza el 80% del objetivo mensual, o cuando hay tendencias descendentes por 3 meses consecutivos.`,
      practicalRecommendations: `Mantener seguimiento diario de ventas, identificar productos o regiones con bajo desempeño, reforzar estrategias comerciales en períodos críticos, y establecer acciones correctivas cuando el volumen esté por debajo del objetivo.`,
      integrationPoints: `Integración con sistema CRM, módulo de facturación, reportes financieros, y análisis de inventario para correlacionar ventas con disponibilidad de producto.`,
      toolsTechnologies: `CRM (Customer Relationship Management), sistemas ERP, herramientas de Business Intelligence, dashboards en tiempo real, y reportes automatizados.`,
      impactOfChange: `Cambios en el volumen de ventas impactan directamente el flujo de caja, la rentabilidad, la capacidad operativa, y el crecimiento del negocio. Una mejora del 10% puede significar un aumento significativo en ingresos anuales.`
    };
  }
  
  // Nuevos Clientes
  if (name.includes('nuevos clientes') || name.includes('clientes adquiridos')) {
    return {
      kpiDefinition: `Mide la cantidad de nuevos clientes adquiridos durante el período. ${description || 'Este KPI es esencial para evaluar la efectividad de las estrategias de captación y el crecimiento de la base de clientes.'}`,
      businessPerspectives: `La adquisición de nuevos clientes es fundamental para el crecimiento sostenible del negocio. Cada nuevo cliente representa potencial de ingresos recurrentes, expansión de mercado y diversificación del portafolio comercial.`,
      measurementApproach: `Se calcula mediante el conteo de nuevos clientes registrados en el sistema CRM durante el mes. Un cliente se considera "nuevo" si no ha realizado compras en los 12 meses anteriores. La frecuencia de medición es mensual.`,
      trendAnalysis: `Analizar tendencias de adquisición permite identificar qué estrategias de marketing y ventas son más efectivas, qué canales generan más clientes, y cuáles son los períodos del año con mayor captación.`,
      diagnosticQuestions: `• ¿Se está cumpliendo la meta de ${target || '2'} nuevos clientes por mes?\n• ¿Qué canales están generando más clientes?\n• ¿Cuál es el costo de adquisición por cliente?\n• ¿Hay diferencias estacionales en la adquisición?\n• ¿Qué estrategias están funcionando mejor?`,
      visualizationSuggestions: `Gráficas de barras mensuales, funnels de conversión, gráficas de tendencia, análisis por canal de adquisición, y comparativas año sobre año.`,
      riskAlerts: `Alertas cuando no se alcanza el 50% de la meta mensual, cuando hay una disminución del 30% respecto al mes anterior, o cuando la adquisición se detiene por más de 2 semanas.`,
      practicalRecommendations: `Diversificar canales de adquisición, optimizar estrategias de marketing digital, mejorar procesos de seguimiento de leads, establecer programas de referidos, y analizar el ciclo de conversión.`,
      integrationPoints: `Integración con CRM para seguimiento de leads, herramientas de marketing automation, sistemas de análisis web, y módulos de facturación para validar conversión.`,
      toolsTechnologies: `CRM, plataformas de marketing digital, herramientas de análisis web (Google Analytics), sistemas de email marketing, y dashboards de conversión.`,
      impactOfChange: `El aumento en nuevos clientes impacta directamente el crecimiento de ingresos, la expansión de mercado, la diversificación del riesgo, y el valor de la empresa. Un incremento del 50% puede duplicar el potencial de crecimiento.`
    };
  }
  
  // Retención de Clientes
  if (name.includes('retención') || name.includes('retention')) {
    return {
      kpiDefinition: `Mide el porcentaje de clientes que permanecen activos y continúan realizando compras. ${description || 'Este KPI es crucial para evaluar la satisfacción del cliente y la salud a largo plazo del negocio.'}`,
      businessPerspectives: `La retención de clientes es más rentable que la adquisición de nuevos. Un cliente retenido genera ingresos recurrentes, referencias, y requiere menos inversión en marketing. Es un indicador de satisfacción y lealtad.`,
      measurementApproach: `Se calcula como: (Clientes activos que realizaron compras en el período / Total de clientes activos al inicio del período) × 100. La frecuencia de medición es mensual para detectar cambios rápidamente.`,
      trendAnalysis: `Analizar tendencias de retención ayuda a identificar qué segmentos de clientes son más leales, qué productos o servicios generan mayor retención, y qué factores influyen en la pérdida de clientes.`,
      diagnosticQuestions: `• ¿Se está alcanzando la meta de ${target || '90%'} de retención?\n• ¿Qué segmentos tienen mayor/menor retención?\n• ¿Cuáles son las principales razones de pérdida de clientes?\n• ¿Qué productos o servicios generan mayor lealtad?\n• ¿Cómo se compara con la industria?`,
      visualizationSuggestions: `Gráficas de línea temporal, análisis cohorte, gráficas de segmentación, heatmaps de retención por producto, y comparativas de período.`,
      riskAlerts: `Alertas cuando la retención desciende por debajo del ${target ? parseFloat(target) - 10 : '80'}%, cuando hay una caída del 5% respecto al mes anterior, o cuando se pierden clientes clave.`,
      practicalRecommendations: `Mejorar programas de fidelización, establecer comunicación proactiva con clientes, ofrecer servicios de valor agregado, analizar razones de pérdida, y crear experiencias personalizadas.`,
      integrationPoints: `Integración con CRM para seguimiento de actividad, sistemas de servicio al cliente, plataformas de email marketing, y herramientas de análisis de satisfacción.`,
      toolsTechnologies: `CRM, sistemas de gestión de relaciones con clientes, plataformas de encuestas, herramientas de análisis de churn, y dashboards de retención.`,
      impactOfChange: `Un aumento del 5% en retención puede incrementar las ganancias entre 25% y 95%. La pérdida de clientes impacta negativamente los ingresos recurrentes y el crecimiento sostenible.`
    };
  }
  
  // Crecimiento
  if (name.includes('crecimiento') || name.includes('growth')) {
    return {
      kpiDefinition: `Mide el porcentaje de crecimiento comparado con un período de referencia (generalmente el año anterior). ${description || 'Este KPI permite evaluar el desempeño comparativo y la dirección del negocio.'}`,
      businessPerspectives: `El crecimiento es un indicador clave de la expansión del negocio y la salud financiera. Permite evaluar si la empresa está avanzando hacia sus objetivos estratégicos y comparar el desempeño con períodos anteriores.`,
      measurementApproach: `Se calcula como: ((Valor actual - Valor período anterior) / Valor período anterior) × 100. La comparación típicamente se realiza año sobre año (YoY) o mes sobre mes (MoM). La frecuencia de medición es mensual.`,
      trendAnalysis: `El análisis de crecimiento permite identificar tendencias a largo plazo, ciclos de negocio, impacto de estrategias implementadas, y comparación con objetivos establecidos. Es importante considerar factores estacionales y externos.`,
      diagnosticQuestions: `• ¿Se está cumpliendo el objetivo de crecimiento del ${target || '+10%'}?\n• ¿El crecimiento es sostenible?\n• ¿Qué factores están impulsando o limitando el crecimiento?\n• ¿Cómo se compara con la competencia?\n• ¿Hay oportunidades de crecimiento no aprovechadas?`,
      visualizationSuggestions: `Gráficas de línea temporal, gráficas comparativas año sobre año, gráficas de barras con crecimiento positivo/negativo, y dashboards de tendencias.`,
      riskAlerts: `Alertas cuando hay crecimiento negativo por 2 meses consecutivos, cuando el crecimiento está por debajo del 50% del objetivo, o cuando hay desaceleraciones significativas.`,
      practicalRecommendations: `Establecer estrategias de crecimiento sostenible, diversificar canales de ingresos, optimizar procesos existentes, identificar nuevas oportunidades de mercado, y monitorear indicadores líderes.`,
      integrationPoints: `Integración con sistemas de ventas, módulos financieros, análisis de mercado, herramientas de benchmarking, y sistemas de inteligencia de negocio.`,
      toolsTechnologies: `Sistemas ERP, herramientas de Business Intelligence, plataformas de análisis financiero, dashboards ejecutivos, y herramientas de benchmarking.`,
      impactOfChange: `El crecimiento sostenido es esencial para la viabilidad a largo plazo del negocio. Un crecimiento del ${target || '10%'} anual puede duplicar el tamaño del negocio en aproximadamente 7 años.`
    };
  }
  
  // Información genérica por defecto
  return {
    kpiDefinition: description || `KPI que mide ${kpiName}. Este indicador es importante para evaluar el desempeño en esta área del negocio.`,
    businessPerspectives: `Este KPI proporciona una perspectiva valiosa sobre el desempeño del negocio en esta área específica. Es importante para la toma de decisiones estratégicas y operativas.`,
    measurementApproach: `Se mide mediante ${description || 'métodos establecidos'}. La frecuencia de medición es ${target || 'periódica'} para permitir seguimiento continuo y ajustes oportunos.`,
    trendAnalysis: `El análisis de tendencias permite identificar patrones, oportunidades de mejora, y áreas que requieren atención. Es importante comparar con períodos anteriores y objetivos establecidos.`,
    diagnosticQuestions: `• ¿Se está cumpliendo el objetivo establecido?\n• ¿Qué factores están impactando el desempeño?\n• ¿Hay tendencias ascendentes o descendentes?\n• ¿Qué acciones correctivas se pueden implementar?\n• ¿Cómo se compara con benchmarks de la industria?`,
    visualizationSuggestions: `Gráficas de línea temporal, gráficas de barras, gráficas comparativas, dashboards interactivos, y visualizaciones de tendencias.`,
    riskAlerts: `Es importante monitorear desviaciones significativas del objetivo, tendencias descendentes sostenidas, y cambios abruptos en el indicador.`,
    practicalRecommendations: `Establecer objetivos claros, monitorear regularmente, implementar acciones correctivas cuando sea necesario, y comunicar resultados al equipo.`,
    integrationPoints: `Integración con sistemas relacionados, herramientas de análisis, y plataformas de reporting para una visión integral del desempeño.`,
    toolsTechnologies: `Sistemas de gestión, herramientas de análisis, dashboards, y plataformas de Business Intelligence para seguimiento y análisis.`,
    impactOfChange: `Las mejoras en este KPI impactan directamente el desempeño del área y contribuyen al logro de los objetivos estratégicos del negocio.`
  };
}

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
      // Si el KPI no tiene información, generar información predeterminada
      const defaultInfo = getDefaultKpiInfo(
        kpi.name || '', 
        kpi.description || '', 
        kpi.target || '',
        kpi.unit || ''
      );
      
      form.reset({
        kpiDefinition: kpi.kpiDefinition || defaultInfo.kpiDefinition || '',
        businessPerspectives: kpi.businessPerspectives || defaultInfo.businessPerspectives || '',
        measurementApproach: kpi.measurementApproach || defaultInfo.measurementApproach || '',
        trendAnalysis: kpi.trendAnalysis || defaultInfo.trendAnalysis || '',
        diagnosticQuestions: kpi.diagnosticQuestions || defaultInfo.diagnosticQuestions || '',
        visualizationSuggestions: kpi.visualizationSuggestions || defaultInfo.visualizationSuggestions || '',
        riskAlerts: kpi.riskAlerts || defaultInfo.riskAlerts || '',
        practicalRecommendations: kpi.practicalRecommendations || defaultInfo.practicalRecommendations || '',
        integrationPoints: kpi.integrationPoints || defaultInfo.integrationPoints || '',
        toolsTechnologies: kpi.toolsTechnologies || defaultInfo.toolsTechnologies || '',
        impactOfChange: kpi.impactOfChange || defaultInfo.impactOfChange || '',
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
