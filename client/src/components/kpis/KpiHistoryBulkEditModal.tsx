import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Save, 
  Calendar, 
  Loader2,
  Edit,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface KpiHistoryBulkEditModalProps {
  kpiId: number;
  companyId: number;
  isOpen: boolean;
  onClose: () => void;
  kpiName?: string;
}

interface HistoryValue {
  month: string;
  year: number;
  value: string;
  status: string | null;
  compliancePercentage: string | null;
  comments?: string | null;
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function KpiHistoryBulkEditModal({ 
  kpiId, 
  companyId, 
  isOpen, 
  onClose,
  kpiName 
}: KpiHistoryBulkEditModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResults, setSaveResults] = useState<{ successful: number; failed: number } | null>(null);

  // Obtener historial del KPI
  // ✅ FIX CRÍTICO: Optimizar cache para reducir queries innecesarias
  const { data: history, isLoading, refetch: refetchHistory } = useQuery({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12, companyId }],
    queryFn: async () => {
      console.log(`[KpiHistoryBulkEditModal] Obteniendo historial para KPI ${kpiId}, companyId ${companyId}`);
      const response = await apiRequest('GET', `/api/kpi-history/${kpiId}?months=12&companyId=${companyId}`);
      if (!response.ok) {
        throw new Error(`Error al obtener historial: ${response.status}`);
      }
      const data = await response.json();
      console.log(`[KpiHistoryBulkEditModal] Historial obtenido:`, data?.length || 0, 'registros');
      return data;
    },
    enabled: isOpen && !!kpiId && !!companyId,
    staleTime: 60 * 1000, // ✅ Cachear 60 segundos - balance entre freshness y performance
    refetchOnWindowFocus: false, // ✅ No refetch al cambiar ventana
    refetchOnMount: false, // ✅ Usar cache si está disponible
    gcTime: 5 * 60 * 1000, // ✅ Mantener en memoria 5 minutos
  });

  // Preparar datos del año seleccionado
  const yearData = useMemo(() => {
    if (!history || !Array.isArray(history)) return [];

    const yearHistory = history.filter((item: any) => {
      const period = item.period || '';
      const yearMatch = period.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      return year === selectedYear;
    });

    // Crear un objeto con todos los meses del año
    const monthsData: Record<string, HistoryValue> = {};
    
    monthNames.forEach(month => {
      const existing = yearHistory.find((item: any) => {
        const period = item.period || '';
        return period.toLowerCase().includes(month.toLowerCase());
      });

      if (existing) {
        monthsData[month] = {
          month,
          year: selectedYear,
          value: existing.value?.toString() || '0',
          status: existing.status,
          compliancePercentage: existing.compliancePercentage,
          comments: existing.comments,
        };
      } else {
        monthsData[month] = {
          month,
          year: selectedYear,
          value: '0',
          status: null,
          compliancePercentage: null,
          comments: null,
        };
      }
    });

    return Object.values(monthsData);
  }, [history, selectedYear]);

  // Inicializar editedValues cuando cambian los datos
  useEffect(() => {
    if (yearData.length > 0) {
      const initial: Record<string, string> = {};
      yearData.forEach(item => {
        initial[`${item.month}-${item.year}`] = item.value;
      });
      setEditedValues(initial);
    }
  }, [yearData]);

  // Mutación para guardar cambios
  const saveMutation = useMutation({
    mutationFn: async (values: Array<{ month: string; year: number; value: string }>) => {
      console.log('[KpiHistoryBulkEditModal] Enviando bulk update:', {
        kpiId,
        companyId,
        valuesCount: values.length
      });

      try {
        const response = await apiRequest('PUT', '/api/kpi-values/bulk', {
          kpiId,
          companyId,
          values,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
          throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[KpiHistoryBulkEditModal] Respuesta exitosa:', data);
        return data;
      } catch (error: any) {
        console.error('[KpiHistoryBulkEditModal] Error en la petición:', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      setSaveError(null);
      setSaveResults({
        successful: data.successful || data.results?.filter((r: any) => r.success).length || 0,
        failed: data.failed || data.results?.filter((r: any) => !r.success).length || 0
      });

      const successCount = data.successful || data.results?.filter((r: any) => r.success).length || 0;
      const totalCount = data.total || data.results?.length || 0;
      const failedCount = data.failed || data.results?.filter((r: any) => !r.success).length || 0;

      if (failedCount > 0) {
        toast({
          title: "⚠️ Actualización parcial",
          description: data.message || `Se guardaron ${successCount} de ${totalCount} valores. ${failedCount} fallaron.`,
          variant: "default",
        });
      } else {
        toast({
          title: "✅ Historial actualizado",
          description: data.message || "Todos los valores se han guardado correctamente.",
        });
      }
      
      console.log('[KpiHistoryBulkEditModal] ✅ Actualización exitosa, invalidando queries...');

      // PASO 1: Invalidar TODAS las queries relacionadas de forma MUY agresiva
      console.log('[KpiHistoryBulkEditModal] Paso 1: Invalidando todas las queries...');

      // Invalidar usando predicate para cubrir TODAS las variantes
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          if (typeof queryKey === 'string') {
            return queryKey.includes('/api/kpi') ||
                   queryKey.includes('/api/kpis') ||
                   queryKey.includes('/api/collaborators-performance') ||
                   queryKey.includes('/api/sales');
          }
          return false;
        }
      });

      // Invalidar específicamente las queries conocidas con exact: false para cubrir todas las variantes
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/kpi-history/${kpiId}`], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-history'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpis'], exact: false }),
        queryClient.invalidateQueries({ queryKey: [`/api/kpis/${kpiId}`], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/collaborators-performance'], exact: false }),
      ]);

      console.log('[KpiHistoryBulkEditModal] ✅ Todas las queries invalidadas');

      // PASO 2: Refetch inmediato y forzado del historial
      console.log('[KpiHistoryBulkEditModal] Paso 2: Refetch del historial...');
      try {
        // Refetch forzado usando el método del hook
        await refetchHistory();
        console.log('[KpiHistoryBulkEditModal] ✅ Historial refrescado desde servidor');

        // También refetch todas las queries relacionadas con historial
        await queryClient.refetchQueries({
          queryKey: [`/api/kpi-history/${kpiId}`],
          exact: false
        });
        console.log('[KpiHistoryBulkEditModal] ✅ Todas las queries de historial refrescadas');
      } catch (error) {
        console.error('[KpiHistoryBulkEditModal] ❌ Error al refrescar historial:', error);
      }

      // PASO 3: Esperar un momento breve para asegurar que React Query procese el refetch
      console.log('[KpiHistoryBulkEditModal] Paso 3: Esperando procesamiento...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Cerrar después de mostrar el resultado
      console.log('[KpiHistoryBulkEditModal] Cerrando modal...');
      onClose();
      setSaveResults(null);
    },
    onError: (error: any) => {
      console.error('[KpiHistoryBulkEditModal] Error al guardar:', error);
      const errorMessage = error.message || error.error || "No se pudieron guardar los cambios.";
      setSaveError(errorMessage);
      setSaveResults(null);
      
      toast({
        title: "❌ Error al guardar",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleValueChange = (month: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [`${month}-${selectedYear}`]: value,
    }));
  };

  const handleSave = () => {
    console.log('[KpiHistoryBulkEditModal] ====== INICIO handleSave ======');
    console.log('[KpiHistoryBulkEditModal] kpiId:', kpiId);
    console.log('[KpiHistoryBulkEditModal] companyId:', companyId);
    console.log('[KpiHistoryBulkEditModal] selectedYear:', selectedYear);
    console.log('[KpiHistoryBulkEditModal] editedValues:', editedValues);

    setSaveError(null);
    setSaveResults(null);
    setIsSaving(true);

    const valuesToSave = monthNames.map(month => {
      const key = `${month}-${selectedYear}`;
      const value = editedValues[key] || '0';
      console.log(`[KpiHistoryBulkEditModal] Procesando ${month}: raw="${value}"`);

      // Limpiar el valor: remover caracteres no numéricos excepto punto decimal
      const cleanedValue = value.toString().replace(/[^0-9.]/g, '') || '0';
      console.log(`[KpiHistoryBulkEditModal]   → cleaned="${cleanedValue}"`);

      return {
        month,
        year: selectedYear,
        value: cleanedValue,
      };
    });

    console.log('[KpiHistoryBulkEditModal] ====== VALORES A GUARDAR ======');
    console.log('[KpiHistoryBulkEditModal] Total de valores:', valuesToSave.length);
    console.log('[KpiHistoryBulkEditModal] Primeros 3 valores:', valuesToSave.slice(0, 3));

    // Validar que hay valores para guardar
    if (valuesToSave.length === 0) {
      console.error('[KpiHistoryBulkEditModal] ❌ ERROR: No hay valores para guardar');
      setIsSaving(false);
      setSaveError('No hay valores para guardar');
      return;
    }

    console.log('[KpiHistoryBulkEditModal] ====== LLAMANDO saveMutation.mutate ======');

    saveMutation.mutate(valuesToSave, {
      onSettled: () => {
        console.log('[KpiHistoryBulkEditModal] ====== saveMutation SETTLED ======');
        setIsSaving(false);
      },
      onError: (error) => {
        console.error('[KpiHistoryBulkEditModal] ====== saveMutation ERROR ======');
        console.error('[KpiHistoryBulkEditModal] Error:', error);
      },
      onSuccess: (data) => {
        console.log('[KpiHistoryBulkEditModal] ====== saveMutation SUCCESS ======');
        console.log('[KpiHistoryBulkEditModal] Data:', data);
      }
    });
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case 'complies':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" /> Cumple</Badge>;
      case 'alert':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><AlertTriangle className="h-3 w-3 mr-1" /> Alerta</Badge>;
      case 'not_compliant':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" /> No cumple</Badge>;
      default:
        return null;
    }
  };

  const availableYears = useMemo(() => {
    if (!history || !Array.isArray(history)) return [selectedYear];
    
    const years = new Set<number>();
    history.forEach((item: any) => {
      const period = item.period || '';
      const yearMatch = period.match(/(\d{4})/);
      if (yearMatch) {
        years.add(parseInt(yearMatch[1]));
      }
    });
    
    if (years.size === 0) years.add(selectedYear);
    
    return Array.from(years).sort((a, b) => b - a);
  }, [history, selectedYear]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Historial Completo del Año
          </DialogTitle>
          <DialogDescription>
            {kpiName && (
              <span className="font-semibold text-foreground">{kpiName}</span>
            )}
            <br />
            Edita los valores mensuales del año seleccionado. Los estados se calcularán automáticamente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2">Cargando historial...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selector de año */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Año:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border rounded-md"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Tabla de valores mensuales */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yearData.map((item) => {
                    const key = `${item.month}-${item.year}`;
                    const currentValue = editedValues[key] || item.value;
                    const hasChanges = currentValue !== item.value;

                    return (
                      <div
                        key={item.month}
                        className={`p-3 border rounded-lg ${
                          hasChanges ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{item.month}</span>
                          {item.status && getStatusBadge(item.status)}
                        </div>
                        <Input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleValueChange(item.month, e.target.value)}
                          className="h-9 text-sm"
                          placeholder="0"
                        />
                        {item.compliancePercentage && (
                          <div className="text-xs text-gray-500 mt-1">
                            {item.compliancePercentage}
                          </div>
                        )}
                        {hasChanges && (
                          <div className="text-xs text-blue-600 mt-1 font-medium">
                            * Modificado
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Mensajes de error o éxito */}
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">Error al guardar:</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{saveError}</p>
              </div>
            )}

            {saveResults && (
              <div className={`p-3 border rounded-lg ${
                saveResults.failed > 0 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className={`flex items-center gap-2 ${
                  saveResults.failed > 0 ? 'text-yellow-800' : 'text-green-800'
                }`}>
                  {saveResults.failed > 0 ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {saveResults.failed > 0 ? 'Actualización parcial' : 'Actualización exitosa'}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  saveResults.failed > 0 ? 'text-yellow-700' : 'text-green-700'
                }`}>
                  {saveResults.successful} valores guardados correctamente
                  {saveResults.failed > 0 && `, ${saveResults.failed} fallaron`}
                </p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSaveError(null);
                  setSaveResults(null);
                  onClose();
                }} 
                disabled={isSaving || saveMutation.isPending}
              >
                {saveResults ? 'Cerrar' : 'Cancelar'}
              </Button>
              {!saveResults && (
                <Button
                  onClick={handleSave}
                  disabled={isSaving || saveMutation.isPending}
                  className="gap-2"
                >
                  {isSaving || saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

