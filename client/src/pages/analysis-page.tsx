import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Kpi, KpiValue, Company, Area } from '@shared/schema';
import { BarChart3, Download, ChevronLeft, ArrowUpRight, ArrowDownRight, ArrowRight, CheckCircle, XCircle, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { generateAnalysisPdf } from '@/services/pdfService';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export default function AnalysisPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(1);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [kpisByArea, setKpisByArea] = useState<{ [areaId: number]: any[] }>({});
  const [selectedTab, setSelectedTab] = useState<string>('1');

  // Fetch companies
  const { data: companies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Fetch areas
  const { data: areas } = useQuery<Area[]>({
    queryKey: ['/api/areas'],
  });

  // Fetch all KPIs
  const { data: kpis } = useQuery<Kpi[]>({
    queryKey: ['/api/kpis'],
  });

  // Fetch KPI values
  const { data: kpiValues } = useQuery<KpiValue[]>({
    queryKey: ['/api/kpi-values'],
  });

  // Get selected company name
  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);

  useEffect(() => {
    if (!kpis || !kpiValues || !areas) return;

    const processedKpis: { [areaId: number]: any[] } = {};

    // Group KPIs by area
    areas.forEach(area => {
      const areaKpis = kpis.filter(kpi => kpi.areaId === area.id);
      
      // Skip empty areas
      if (areaKpis.length === 0) return;
      
      processedKpis[area.id] = areaKpis.map(kpi => {
        // Get the most recent value
        const allValues = kpiValues.filter(v => v.kpiId === kpi.id);
        const currentValue = allValues.length > 0 ? allValues[0] : null;
        
        // Calculate if the KPI is on target
        let isOnTarget = false;
        if (currentValue && kpi.target) {
          // Extract numeric value from string
          const valueStr = currentValue.value;
          let numericValue = parseFloat(valueStr.replace(/[^0-9.-]+/g, ""));
          
          const targetStr = kpi.target;
          let targetValue = parseFloat(targetStr.replace(/[^0-9.-]+/g, ""));
          
          // For KPIs where lower is better (like "Rotación de cuentas por cobrar")
          if (kpi.name.includes('Rotación de cuentas por cobrar')) {
            isOnTarget = numericValue <= targetValue;
          } else {
            isOnTarget = numericValue >= targetValue;
          }
        }
        
        // Determine trend (simplified logic - could be enhanced)
        let trend = 'stable';
        if (allValues.length > 1) {
          const current = parseFloat(allValues[0].value.replace(/[^0-9.-]+/g, ""));
          const previous = parseFloat(allValues[1].value.replace(/[^0-9.-]+/g, ""));
          
          if (current > previous) {
            trend = 'up';
          } else if (current < previous) {
            trend = 'down';
          }
        }
        
        return {
          ...kpi,
          value: currentValue?.value || 'N/A',
          period: currentValue?.period || '',
          status: isOnTarget ? 'success' : 'warning',
          trend
        };
      });
    });

    setKpisByArea(processedKpis);
    
    // Set default tab to first area that has KPIs
    if (selectedTab === '1' && Object.keys(processedKpis).length > 0) {
      setSelectedTab(Object.keys(processedKpis)[0]);
    }
  }, [kpis, kpiValues, areas, selectedCompanyId, selectedTab]);

  const handleDownloadPdf = async () => {
    if (!selectedCompany) return;
    
    try {
      // Get all KPIs for the selected company
      const companyKpis = Object.values(kpisByArea).flat();
      
      if (companyKpis.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay KPIs disponibles para generar el informe",
          variant: "destructive"
        });
        return;
      }
      
      // Get period text
      let periodText = 'Todos los períodos';
      if (selectedPeriod === 'month') periodText = 'Último mes';
      if (selectedPeriod === 'quarter') periodText = 'Último trimestre';
      if (selectedPeriod === 'year') periodText = 'Último año';
      
      await generateAnalysisPdf(companyKpis, selectedCompany.name, periodText);
      
      toast({
        title: "Reporte generado",
        description: "Se ha descargado el PDF de análisis",
        variant: "default"
      });
    } catch (error) {
      console.error("Error al generar PDF:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el PDF",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="h-9 w-9"
              onClick={() => setLocation('/')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Análisis detallado de KPIs</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              className="gap-2"
              onClick={handleDownloadPdf}
            >
              <Download className="h-4 w-4" />
              <span>Descargar PDF</span>
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Empresa</label>
                    <select 
                      className="w-full p-2 border rounded-md bg-background"
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                    >
                      {companies?.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Período</label>
                    <select 
                      className="w-full p-2 border rounded-md bg-background"
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                    >
                      <option value="all">Todos los períodos</option>
                      <option value="month">Último mes</option>
                      <option value="quarter">Último trimestre</option>
                      <option value="year">Último año</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Vista rápida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(kpisByArea).map(([areaId, areaKpis]) => {
                    const area = areas?.find(a => a.id === Number(areaId));
                    if (!area) return null;
                    
                    const totalKpis = areaKpis.length;
                    const onTargetKpis = areaKpis.filter(k => k.status === 'success').length;
                    const percentage = totalKpis > 0 ? Math.round((onTargetKpis / totalKpis) * 100) : 0;
                    
                    return (
                      <div key={areaId} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{area.name}</span>
                          <Badge variant={percentage >= 70 ? "success" : percentage >= 50 ? "default" : "destructive"}>
                            {percentage}%
                          </Badge>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${percentage >= 70 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {onTargetKpis} de {totalKpis} KPIs dentro del objetivo
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:col-span-3">
            <Card className="h-full">
              <CardHeader className="pb-0">
                <CardTitle className="text-lg">{selectedCompany?.name || 'Empresa'}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs 
                  value={selectedTab} 
                  onValueChange={setSelectedTab}
                  className="w-full"
                >
                  <TabsList className="w-full justify-start overflow-auto whitespace-nowrap mb-4 pb-0 pt-2 px-1">
                    {Object.entries(kpisByArea).map(([areaId, _]) => {
                      const area = areas?.find(a => a.id === Number(areaId));
                      return (
                        <TabsTrigger 
                          key={areaId} 
                          value={areaId}
                          className="data-[state=active]:bg-accent/50"
                        >
                          {area?.name || `Área ${areaId}`}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  <ScrollArea className="h-[calc(100vh-14rem)]">
                    {Object.entries(kpisByArea).map(([areaId, areaKpis]) => (
                      <TabsContent key={areaId} value={areaId} className="mt-0 pt-0">
                        <div className="space-y-6">
                          {areaKpis.map((kpi) => (
                          <div key={kpi.id} className="border rounded-lg p-4 bg-card">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-full ${kpi.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {kpi.status === 'success' ? (
                                    <CheckCircle className="h-5 w-5" />
                                  ) : (
                                    <XCircle className="h-5 w-5" />
                                  )}
                                </div>
                                <h3 className="font-semibold text-lg">{kpi.name}</h3>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{kpi.period}</Badge>
                                <div className="p-1.5 rounded-full bg-muted">
                                  <LineChart className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                              <div className="p-3 bg-muted/50 rounded-md">
                                <div className="text-sm text-muted-foreground mb-1">Valor actual</div>
                                <div className="text-xl font-semibold">{kpi.value}</div>
                              </div>
                              
                              <div className="p-3 bg-muted/50 rounded-md">
                                <div className="text-sm text-muted-foreground mb-1">Meta</div>
                                <div className="text-xl font-semibold">{kpi.target}</div>
                              </div>
                              
                              <div className="p-3 bg-muted/50 rounded-md">
                                <div className="text-sm text-muted-foreground mb-1">Tendencia</div>
                                <div className="flex items-center text-xl font-semibold">
                                  {kpi.trend === 'up' ? (
                                    <>
                                      <span>Creciente</span>
                                      <ArrowUpRight className={`ml-2 h-5 w-5 ${kpi.name.includes('Devoluciones') || kpi.name.includes('Rotación de cuentas por cobrar') ? 'text-red-500' : 'text-emerald-500'}`} />
                                    </>
                                  ) : kpi.trend === 'down' ? (
                                    <>
                                      <span>Decreciente</span>
                                      <ArrowDownRight className={`ml-2 h-5 w-5 ${kpi.name.includes('Devoluciones') || kpi.name.includes('Rotación de cuentas por cobrar') ? 'text-emerald-500' : 'text-red-500'}`} />
                                    </>
                                  ) : (
                                    <>
                                      <span>Estable</span>
                                      <ArrowRight className="ml-2 h-5 w-5 text-amber-500" />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium mb-1">Análisis</h4>
                                <p className="text-sm text-muted-foreground">
                                  {getAnalysisForKpi(kpi)}
                                </p>
                              </div>
                              
                              <div>
                                <h4 className="font-medium mb-1">Recomendaciones</h4>
                                <p className="text-sm text-muted-foreground">
                                  {getRecommendationsForKpi(kpi)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </ScrollArea>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Función para generar análisis basado en el KPI
function getAnalysisForKpi(kpi: any): string {
  const isOnTarget = kpi.status === 'success';
  
  if (kpi.name.includes('Volumen de Ventas')) {
    return isOnTarget 
      ? `El volumen de ventas se mantiene dentro del objetivo establecido. La estrategia de ventas actual está generando resultados positivos y el equipo está cumpliendo con las expectativas.`
      : `El volumen de ventas está por debajo del objetivo establecido. Esto puede deberse a factores estacionales, una disminución en la demanda del mercado o problemas con la estrategia de ventas actual.`;
  }
  
  if (kpi.name.includes('Margen Bruto')) {
    return isOnTarget 
      ? `El margen bruto se mantiene saludable, lo que indica una buena estructura de costos y pricing adecuado para los productos. La empresa está generando un valor adecuado por cada venta realizada.`
      : `El margen bruto está por debajo del objetivo, lo que podría indicar un aumento en los costos de producción, presión competitiva sobre los precios o una mezcla de productos menos favorable.`;
  }
  
  if (kpi.name.includes('Rotación de Inventario')) {
    return isOnTarget 
      ? `La rotación de inventario está en un nivel óptimo, indicando un buen balance entre mantener stock suficiente y minimizar el capital inmovilizado.`
      : `La baja rotación de inventario sugiere que hay productos estancados o que se está manteniendo un nivel de stock demasiado alto, lo que aumenta los costos de almacenamiento y el riesgo de obsolescencia.`;
  }
  
  if (kpi.name.includes('Tiempo de Entrega')) {
    return isOnTarget 
      ? `Los tiempos de entrega están dentro de los objetivos, lo que refleja una cadena de suministro eficiente y procesos logísticos bien optimizados.`
      : `Los tiempos de entrega están por encima de lo esperado, lo que podría estar afectando la satisfacción del cliente y generando ineficiencias operativas.`;
  }
  
  if (kpi.name.includes('Devoluciones')) {
    return isOnTarget 
      ? `La tasa de devoluciones se mantiene bajo control, lo que indica una buena calidad de producto y satisfacción del cliente.`
      : `El aumento en las devoluciones podría estar señalando problemas de calidad, errores en envíos o discrepancias entre las expectativas del cliente y el producto entregado.`;
  }
  
  if (kpi.name.includes('Precisión en estados financieros')) {
    return isOnTarget 
      ? `La precisión en los estados financieros es alta, lo que refleja buenas prácticas contables y controles internos efectivos.`
      : `La precisión en los estados financieros está por debajo del objetivo, lo que podría indicar problemas en los procesos contables o en los sistemas de información.`;
  }
  
  if (kpi.name.includes('Rotación de cuentas por cobrar')) {
    // Para este KPI, valores más bajos son mejores
    const inversedIsOnTarget = !isOnTarget;
    return inversedIsOnTarget 
      ? `La rotación de cuentas por cobrar es adecuada, indicando una buena gestión de crédito y cobranza.`
      : `La alta rotación de cuentas por cobrar sugiere que los clientes están tardando demasiado en pagar, lo que podría estar afectando el flujo de caja.`;
  }
  
  // Análisis genérico para otros KPIs
  return isOnTarget 
    ? `El KPI se mantiene dentro del objetivo establecido, lo que indica un buen desempeño en esta área.`
    : `El KPI está fuera del objetivo, lo que podría requerir acciones correctivas o un análisis más profundo para identificar causas raíz.`;
}

// Función para generar recomendaciones basadas en el KPI
function getRecommendationsForKpi(kpi: any): string {
  const isOnTarget = kpi.status === 'success';
  
  if (kpi.name.includes('Volumen de Ventas')) {
    return isOnTarget 
      ? `Mantener la estrategia actual de ventas. Considerar análisis de productos con mejor desempeño para potenciar aún más los resultados.`
      : `Revisar la estrategia de ventas, capacitar al equipo en nuevas técnicas y evaluar la implementación de promociones estratégicas para impulsar el volumen.`;
  }
  
  if (kpi.name.includes('Margen Bruto')) {
    return isOnTarget 
      ? `Continuar monitoreando los costos y evaluar periódicamente la estrategia de precios para mantener o mejorar el margen.`
      : `Analizar la estructura de costos, renegociar con proveedores, evaluar el mix de productos y considerar ajustes en los precios donde sea posible.`;
  }
  
  if (kpi.name.includes('Rotación de Inventario')) {
    return isOnTarget 
      ? `Mantener las políticas actuales de inventario y continuar optimizando las previsiones de demanda.`
      : `Implementar políticas de gestión de inventario más agresivas, revisar las previsiones de demanda y considerar promociones para productos con baja rotación.`;
  }
  
  if (kpi.name.includes('Tiempo de Entrega')) {
    return isOnTarget 
      ? `Mantener los procesos actuales y considerar documentarlos como mejores prácticas para la organización.`
      : `Analizar los cuellos de botella en la cadena logística, evaluar proveedores de transporte alternativos y optimizar las rutas de entrega.`;
  }
  
  if (kpi.name.includes('Devoluciones')) {
    return isOnTarget 
      ? `Seguir monitoreando las razones de devolución para identificar tendencias y mantener la calidad.`
      : `Implementar un análisis detallado de las causas de devolución, mejorar el control de calidad y revisar la descripción de productos para alinear las expectativas de los clientes.`;
  }
  
  if (kpi.name.includes('Precisión en estados financieros')) {
    return isOnTarget 
      ? `Mantener los controles y procedimientos actuales, considerando la automatización de procesos para mayor eficiencia.`
      : `Revisar los procedimientos contables, implementar verificaciones adicionales y considerar capacitación adicional para el personal.`;
  }
  
  if (kpi.name.includes('Rotación de cuentas por cobrar')) {
    // Para este KPI, valores más bajos son mejores
    const inversedIsOnTarget = !isOnTarget;
    return inversedIsOnTarget 
      ? `Mantener las políticas de crédito actuales y continuar con las prácticas efectivas de cobranza.`
      : `Revisar las políticas de crédito, implementar un seguimiento más proactivo de las cuentas por cobrar y considerar incentivos para pagos anticipados.`;
  }
  
  // Recomendaciones genéricas para otros KPIs
  return isOnTarget 
    ? `Mantener las prácticas actuales y buscar oportunidades de mejora continua para optimizar aún más este indicador.`
    : `Analizar las causas raíz de la desviación, desarrollar un plan de acción específico y establecer revisiones periódicas para monitorear el progreso.`;
}