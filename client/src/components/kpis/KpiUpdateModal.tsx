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
import { useAuth } from '@/hooks/use-auth';
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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [isEditingAnnualGoal, setIsEditingAnnualGoal] = useState(false);
  const [newAnnualGoal, setNewAnnualGoal] = useState('');

  // Obtener datos del KPI
  // IMPORTANTE: Incluir companyId en el query key si está disponible para evitar problemas de cache
  const { data: kpi, isLoading: kpiLoading, error: kpiError, refetch: refetchKpi } = useQuery({
    queryKey: [`/api/kpis/${kpiId}`],
    queryFn: async () => {
      if (!kpiId) return null;
      console.log(`[KpiUpdateModal] Obteniendo datos del KPI ${kpiId}`);
      const response = await apiRequest('GET', `/api/kpis/${kpiId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al obtener KPI: ${response.status} ${errorText}`);
      }
      const kpiData = await response.json();
      console.log(`[KpiUpdateModal] KPI obtenido:`, kpiData);
      // Log detallado para debugging
      console.log(`[KpiUpdateModal] KPI datos completos:`, {
        id: kpiData.id,
        name: kpiData.name,
        goal: kpiData.goal,
        target: kpiData.target,
        annualGoal: kpiData.annualGoal,
        companyId: kpiData.companyId
      });
      return kpiData;
    },
    enabled: isOpen && !!kpiId,
    retry: 2,
    staleTime: 0, // No cachear para ver datos actualizados
    refetchOnWindowFocus: true,
    refetchOnMount: true, // Refetch cuando el componente se monta
    gcTime: 0, // No mantener en cache (anteriormente cacheTime)
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

  // Log para debugging y asegurar que companyId esté disponible
  useEffect(() => {
    if (kpi && isOpen && typeof kpi === 'object' && kpi !== null && 'id' in kpi && 'name' in kpi) {
      console.log('[KpiUpdateModal] KPI detectado:', {
        id: (kpi as any).id,
        name: (kpi as any).name,
        companyId: (kpi as any).companyId,
        goal: (kpi as any).goal,
        target: (kpi as any).target,
        annualGoal: (kpi as any).annualGoal,
        isSalesKpi: isSalesKpi,
        willShowSalesForm: isSalesKpi
      });
      
      // Inicializar los valores de goal y annualGoal cuando el KPI se carga
      if ('target' in kpi || 'goal' in kpi) {
        const goalValue = (kpi as any).goal || (kpi as any).target || '';
        setNewGoal(goalValue);
      }
      if ('annualGoal' in kpi) {
        const annualGoalValue = (kpi as any).annualGoal || '';
        setNewAnnualGoal(annualGoalValue);
      }
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

    // Formato simple: "Diciembre 2025" para compatibilidad con upsert por mes/año
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
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
    onSuccess: async (data) => {
      console.log('[KPI Update] Actualización exitosa, invalidando cachés y actualizando historial');
      
      toast({
        title: "✅ KPI actualizado exitosamente",
        description: "El valor del KPI ha sido registrado correctamente y se ha guardado en el historial.",
        variant: "default",
      });
      
      // Invalidar cachés relevantes para actualizar la UI y forzar refetch inmediato
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values', kpiId] }),
        queryClient.invalidateQueries({ queryKey: [`/api/kpis/${kpiId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/kpi-history/${kpiId}`] }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/collaborators-performance'] }),
      ]);

      // Forzar refetch inmediato para ver cambios sin esperar staleTime
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/kpi-values'] }),
        queryClient.refetchQueries({ queryKey: ['/api/kpis'] }),
        queryClient.refetchQueries({ queryKey: [`/api/kpi-history/${kpiId}`] }),
      ]);
      
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

  // Actualizar newGoal y newAnnualGoal cuando cambia el KPI (sincronización adicional)
  // IMPORTANTE: Este efecto sincroniza el estado local con los datos del servidor
  // Solo se ejecuta cuando NO estamos editando para evitar conflictos
  useEffect(() => {
    if (kpi && typeof kpi === 'object' && kpi !== null && !isEditingGoal && !isEditingAnnualGoal) {
      const goalValue = (kpi as any).goal || (kpi as any).target || '';
      const annualGoalValue = (kpi as any).annualGoal || '';
      
      // Convertir a strings para comparación
      const currentGoalStr = String(newGoal || '');
      const newGoalStr = String(goalValue || '');
      const currentAnnualGoalStr = String(newAnnualGoal || '');
      const newAnnualGoalStr = String(annualGoalValue || '');
      
      // Solo actualizar si los valores han cambiado y NO estamos editando
      if (newGoalStr !== currentGoalStr) {
        setNewGoal(newGoalStr);
        console.log(`[KpiUpdateModal] ✅ Goal sincronizado desde servidor: ${newGoalStr}`);
      }
      if (newAnnualGoalStr !== currentAnnualGoalStr) {
        setNewAnnualGoal(newAnnualGoalStr);
        console.log(`[KpiUpdateModal] ✅ AnnualGoal sincronizado desde servidor: ${newAnnualGoalStr}`);
      }
    }
  }, [kpi, isEditingGoal, isEditingAnnualGoal]); // Incluir flags de edición para evitar conflictos

  // Detectar si es KPI de ventas
  const isSalesKpiForAnnualGoal = kpi && typeof kpi === 'object' && kpi !== null && 'name' in kpi && 
    ((kpi as any).name?.toLowerCase().includes('volumen') && (kpi as any).name?.toLowerCase().includes('ventas'));

  // Mutación para actualizar la meta del KPI
  const updateGoalMutation = useMutation({
    mutationFn: async (goal: string) => {
      // Obtener companyId del KPI actual o buscar desde el KPI cargado
      let companyId: number | undefined;
      
      // Primero intentar obtenerlo del KPI cargado
      if (kpi && typeof kpi === 'object' && kpi !== null && 'companyId' in kpi) {
        companyId = (kpi as any).companyId;
        console.log(`[KpiUpdateModal] companyId obtenido del KPI cargado: ${companyId}`);
      }
      
      // Si no está disponible, cargar el KPI desde el servidor
      if (!companyId) {
        console.log(`[KpiUpdateModal] companyId no disponible, cargando KPI ${kpiId}...`);
        try {
          const kpiResponse = await apiRequest('GET', `/api/kpis/${kpiId}`);
          if (!kpiResponse.ok) {
            const errorText = await kpiResponse.text();
            throw new Error(`No se pudo cargar el KPI: ${kpiResponse.status} ${errorText}`);
          }
          const kpiData = await kpiResponse.json();
          companyId = kpiData.companyId;
          console.log(`[KpiUpdateModal] companyId obtenido del servidor: ${companyId}`);
        } catch (error) {
          console.error('[KpiUpdateModal] Error al cargar KPI:', error);
          throw new Error('No se pudo cargar el KPI para determinar la compañía');
        }
      }
      
      if (!companyId || (companyId !== 1 && companyId !== 2)) {
        throw new Error(`No se pudo determinar la compañía del KPI. companyId: ${companyId}`);
      }
      
      console.log(`[KpiUpdateModal] Actualizando meta del KPI ${kpiId} para companyId ${companyId}`, {
        goal: goal
      });
      
      const response = await apiRequest('PUT', `/api/kpis/${kpiId}`, {
        goal: goal,
        target: goal,
        companyId: companyId
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[KpiUpdateModal] Error en respuesta: ${response.status} ${errorText}`);
        throw new Error(`Error al actualizar meta: ${response.status} ${errorText}`);
      }
      
      const updatedKpi = await response.json();
      console.log(`[KpiUpdateModal] KPI actualizado exitosamente:`, updatedKpi);
      return updatedKpi;
    },
    onSuccess: async (updatedKpi) => {
      console.log('[KpiUpdateModal] ✅ Actualización de meta exitosa, invalidando queries...');
      console.log('[KpiUpdateModal] KPI actualizado recibido:', updatedKpi);
      
      // PASO 1: Invalidar TODAS las queries relacionadas de forma MUY agresiva
      console.log('[KpiUpdateModal] Paso 1: Invalidando todas las queries...');
      
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
      
      // Invalidar específicamente las queries conocidas con exact: false
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/kpis/${kpiId}`], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpis'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-history'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/collaborators-performance'], exact: false }),
      ]);
      
      console.log('[KpiUpdateModal] Paso 2: Forzando refetch inmediato...');
      
      // PASO 2: Forzar refetch inmediato del KPI para ver los cambios
      try {
        const refetchedData = await refetchKpi();
        console.log('[KpiUpdateModal] ✅ Refetch completado:', refetchedData.data);
      } catch (error) {
        console.error('[KpiUpdateModal] ❌ Error en refetch:', error);
      }
      
      // PASO 3: Esperar un momento para que las queries se invaliden completamente
      console.log('[KpiUpdateModal] Paso 3: Esperando invalidación de queries...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // PASO 4: Forzar refetch de nuevo después de la invalidación
      console.log('[KpiUpdateModal] Paso 4: Refetch después de invalidación...');
      try {
        const refetchedDataAfterInvalidation = await refetchKpi();
        console.log('[KpiUpdateModal] ✅ Refetch después de invalidación completado:', refetchedDataAfterInvalidation.data);
        
        // Actualizar estado local con los datos recién obtenidos del servidor
        if (refetchedDataAfterInvalidation.data) {
          const freshKpi = refetchedDataAfterInvalidation.data;
          console.log('[KpiUpdateModal] Datos frescos del servidor:', {
            annualGoal: freshKpi.annualGoal,
            goal: freshKpi.goal,
            target: freshKpi.target
          });
          
          if (freshKpi.goal !== undefined || freshKpi.target !== undefined) {
            const goalStr = String(freshKpi.goal || freshKpi.target || '');
            setNewGoal(goalStr);
            console.log('[KpiUpdateModal] ✅ Goal actualizado en estado desde servidor:', goalStr);
          }
          
          // Si también se actualizó el objetivo anual, actualizar el estado
          if (freshKpi.annualGoal !== undefined) {
            const annualGoalStr = String(freshKpi.annualGoal || '');
            setNewAnnualGoal(annualGoalStr);
            console.log('[KpiUpdateModal] ✅ AnnualGoal actualizado en estado desde servidor:', annualGoalStr);
          }
        }
      } catch (error) {
        console.error('[KpiUpdateModal] ❌ Error en segundo refetch:', error);
        // Si el refetch falla, usar los datos de la respuesta original
        if (updatedKpi) {
          if (updatedKpi.goal !== undefined || updatedKpi.target !== undefined) {
            setNewGoal(String(updatedKpi.goal || updatedKpi.target || ''));
          }
          if (updatedKpi.annualGoal !== undefined) {
            setNewAnnualGoal(String(updatedKpi.annualGoal || ''));
          }
        }
      }
      
      // PASO 5: Forzar re-render del componente
      console.log('[KpiUpdateModal] Paso 5: Forzando re-render...');
      setIsEditingGoal(false);
      
      // PASO 6: Mostrar toast de éxito
      toast({
        title: '✅ Meta actualizada',
        description: 'La meta del KPI se ha actualizado correctamente.'
      });
      
      console.log('[KpiUpdateModal] ✅ Proceso de actualización completado');
    },
    onError: (error: any) => {
      console.error('[KpiUpdateModal] Error al actualizar meta:', error);
      toast({
        title: 'Error al actualizar meta',
        description: error.message || 'No se pudo actualizar la meta. Verifica que tengas permisos de administrador.',
        variant: 'destructive'
      });
    },
  });

  const handleSaveGoal = () => {
    if (!newGoal || newGoal.trim() === '') {
      toast({
        title: 'Error',
        description: 'La meta no puede estar vacía.',
        variant: 'destructive'
      });
      return;
    }
    updateGoalMutation.mutate(newGoal);
  };

  const handleCancelEditGoal = () => {
    if (kpi && typeof kpi === 'object' && kpi !== null && 'target' in kpi) {
      setNewGoal((kpi as any).target || (kpi as any).goal || '');
    }
    setIsEditingGoal(false);
  };

  // Mutación para actualizar el objetivo anual del KPI
  const updateAnnualGoalMutation = useMutation({
    mutationFn: async (annualGoal: string) => {
      // Obtener companyId del KPI actual o buscar desde el KPI cargado
      let companyId: number | undefined;
      
      // Primero intentar obtenerlo del KPI cargado
      if (kpi && typeof kpi === 'object' && kpi !== null && 'companyId' in kpi) {
        companyId = (kpi as any).companyId;
        console.log(`[KpiUpdateModal] companyId obtenido del KPI cargado: ${companyId}`);
      }
      
      // Si no está disponible, cargar el KPI desde el servidor
      if (!companyId) {
        console.log(`[KpiUpdateModal] companyId no disponible, cargando KPI ${kpiId}...`);
        try {
          const kpiResponse = await apiRequest('GET', `/api/kpis/${kpiId}`);
          if (!kpiResponse.ok) {
            const errorText = await kpiResponse.text();
            throw new Error(`No se pudo cargar el KPI: ${kpiResponse.status} ${errorText}`);
          }
          const kpiData = await kpiResponse.json();
          companyId = kpiData.companyId;
          console.log(`[KpiUpdateModal] companyId obtenido del servidor: ${companyId}`);
        } catch (error) {
          console.error('[KpiUpdateModal] Error al cargar KPI:', error);
          throw new Error('No se pudo cargar el KPI para determinar la compañía');
        }
      }
      
      if (!companyId || (companyId !== 1 && companyId !== 2)) {
        throw new Error(`No se pudo determinar la compañía del KPI. companyId: ${companyId}`);
      }
      
      // Normalizar annualGoal: si está vacío, enviar null
      const normalizedAnnualGoal = annualGoal.trim() === '' ? null : annualGoal.trim();
      
      console.log(`[KpiUpdateModal] Actualizando objetivo anual del KPI ${kpiId} para companyId ${companyId}`, {
        annualGoal: normalizedAnnualGoal,
        originalValue: annualGoal
      });
      
      const response = await apiRequest('PUT', `/api/kpis/${kpiId}`, {
        annualGoal: normalizedAnnualGoal,
        companyId: companyId
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[KpiUpdateModal] Error en respuesta: ${response.status} ${errorText}`);
        throw new Error(`Error al actualizar objetivo anual: ${response.status} ${errorText}`);
      }
      
      const updatedKpi = await response.json();
      console.log(`[KpiUpdateModal] KPI actualizado exitosamente:`, updatedKpi);
      return updatedKpi;
    },
    onSuccess: async (updatedKpi) => {
      console.log('[KpiUpdateModal] ✅ Actualización exitosa, invalidando queries...');
      console.log('[KpiUpdateModal] KPI actualizado recibido:', updatedKpi);

      // PASO 1: Actualizar directamente el cache de React Query con los datos devueltos
      // Esto es más confiable que depender del refetch
      console.log('[KpiUpdateModal] Paso 1: Actualizando cache directamente...');
      queryClient.setQueryData([`/api/kpis/${kpiId}`], updatedKpi);
      console.log('[KpiUpdateModal] ✅ Cache actualizado con datos de la mutación');

      // PASO 2: Invalidar TODAS las queries relacionadas de forma MUY agresiva
      console.log('[KpiUpdateModal] Paso 2: Invalidando todas las queries...');
      
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
      
      // Invalidar específicamente las queries conocidas con exact: false
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/kpis/${kpiId}`], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpis'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-history'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['/api/collaborators-performance'], exact: false }),
      ]);

      // PASO 3: Actualizar estado local inmediatamente con los datos de la mutación
      console.log('[KpiUpdateModal] Paso 3: Actualizando estado local...');
      if (updatedKpi.annualGoal !== undefined && updatedKpi.annualGoal !== null) {
        const annualGoalStr = String(updatedKpi.annualGoal);
        setNewAnnualGoal(annualGoalStr);
        console.log('[KpiUpdateModal] ✅ AnnualGoal actualizado en estado:', annualGoalStr);
      } else {
        setNewAnnualGoal('');
        console.log('[KpiUpdateModal] ✅ AnnualGoal limpiado (null/undefined)');
      }

      if (updatedKpi.goal !== undefined || updatedKpi.target !== undefined) {
        const goalStr = String(updatedKpi.goal || updatedKpi.target || '');
        setNewGoal(goalStr);
        console.log('[KpiUpdateModal] ✅ Goal actualizado en estado:', goalStr);
      }

      // PASO 4: Forzar refetch de otras queries relacionadas (opcional, ya que usamos setQueryData)
      console.log('[KpiUpdateModal] Paso 4: Refetch de queries relacionadas...');
      try {
        await refetchKpi();
        console.log('[KpiUpdateModal] ✅ Refetch completado');
      } catch (error) {
        console.error('[KpiUpdateModal] ❌ Error en refetch:', error);
      }

      // PASO 5: Forzar re-render del componente
      console.log('[KpiUpdateModal] Paso 5: Forzando re-render...');
      setIsEditingAnnualGoal(false);

      // PASO 6: Mostrar toast de éxito
      toast({
        title: '✅ Objetivo anual actualizado',
        description: 'El objetivo anual del KPI se ha actualizado correctamente. La meta mensual se ha calculado automáticamente.',
      });
      
      console.log('[KpiUpdateModal] ✅ Proceso de actualización completado');
    },
    onError: (error: any) => {
      console.error('[KpiUpdateModal] Error al actualizar objetivo anual:', error);
      toast({
        title: 'Error al actualizar objetivo anual',
        description: error.message || 'No se pudo actualizar el objetivo anual. Verifica que tengas permisos de administrador.',
        variant: 'destructive'
      });
    },
  });

  const handleSaveAnnualGoal = () => {
    // Permitir valores vacíos (se convertirán a null en el backend)
    // Validar que sea un número si no está vacío
    const trimmedValue = newAnnualGoal.trim();
    if (trimmedValue !== '' && isNaN(Number(trimmedValue))) {
      toast({
        title: 'Error',
        description: 'El objetivo anual debe ser un número válido.',
        variant: 'destructive'
      });
      return;
    }
    updateAnnualGoalMutation.mutate(newAnnualGoal);
  };

  const handleCancelEditAnnualGoal = () => {
    if (kpi && typeof kpi === 'object' && kpi !== null) {
      setNewAnnualGoal((kpi as any).annualGoal || '');
    }
    setIsEditingAnnualGoal(false);
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

  if (kpiError) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Error al cargar KPI</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              {kpiError instanceof Error ? kpiError.message : 'No se pudo cargar el KPI. Por favor, intenta nuevamente.'}
            </p>
            <p className="text-xs text-gray-500">
              KPI ID: {kpiId}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!kpi || (typeof kpi === 'object' && kpi !== null && !('id' in kpi))) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>KPI no encontrado</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              No se pudo encontrar el KPI con ID {kpiId}. Por favor, verifica que el KPI existe.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Cerrar
            </Button>
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-600">Meta Mensual:</span>
                          {/* Solo permitir editar meta manualmente si NO es KPI de ventas con annualGoal */}
                          {isAdmin && !isEditingGoal && !(isSalesKpiForAnnualGoal && (kpi as any)?.annualGoal) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setIsEditingGoal(true)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          {/* Si hay annualGoal, mostrar que es calculada automáticamente */}
                          {isSalesKpiForAnnualGoal && (kpi as any)?.annualGoal && (
                            <span className="text-xs text-gray-500 italic">(calculada automáticamente)</span>
                          )}
                        </div>
                        {isEditingGoal ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={newGoal}
                              onChange={(e) => setNewGoal(e.target.value)}
                              className="w-32 h-8 text-sm"
                              placeholder="Meta"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleSaveGoal}
                              disabled={updateGoalMutation.isPending}
                            >
                              <Save className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleCancelEditGoal}
                              disabled={updateGoalMutation.isPending}
                            >
                              <XCircle className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-lg font-bold text-blue-600">
                            {/* USAR ESTADO LOCAL en lugar de kpi directamente */}
                            {newGoal || (kpi as any)?.target || (kpi as any)?.goal || 'Sin meta definida'}
                            {isSalesKpiForAnnualGoal && (newAnnualGoal || (kpi as any)?.annualGoal) && (
                              <span className="text-xs text-gray-500 ml-2 font-normal italic">
                                (del anual: {Number(newAnnualGoal || (kpi as any).annualGoal).toLocaleString('es-MX', { maximumFractionDigits: 0 })} / 12)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Objetivo Anual (solo para KPIs de ventas) */}
                      {isSalesKpiForAnnualGoal && (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Objetivo Anual:</span>
                            {isAdmin && !isEditingAnnualGoal && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setIsEditingAnnualGoal(true)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {isEditingAnnualGoal ? (
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={newAnnualGoal}
                                onChange={(e) => setNewAnnualGoal(e.target.value)}
                                className="w-40 h-8 text-sm"
                                placeholder="Objetivo anual"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveAnnualGoal}
                                disabled={updateAnnualGoalMutation.isPending}
                              >
                                <Save className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEditAnnualGoal}
                                disabled={updateAnnualGoalMutation.isPending}
                              >
                                <XCircle className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-lg font-bold text-purple-600">
                              {(() => {
                                // USAR ESTADO LOCAL en lugar de kpi.annualGoal directamente
                                const annualGoalValue = newAnnualGoal || (kpi as any)?.annualGoal;
                                if (annualGoalValue) {
                                  const annualGoalNum = Number(annualGoalValue);
                                  if (!isNaN(annualGoalNum) && annualGoalNum > 0) {
                                    return annualGoalNum.toLocaleString('es-MX', { maximumFractionDigits: 0 });
                                  }
                                }
                                return 'Sin objetivo anual definido';
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                      
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