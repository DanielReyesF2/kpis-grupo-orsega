/**
 * TremorKpiUpdateModal - Modal simple para actualizar KPIs
 * Diseño limpio usando Tremor, enfocado solo en actualizar el valor
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Title,
  Text,
  Flex,
  NumberInput,
  TextInput,
  Button,
  Metric,
  Badge,
  ProgressBar,
  Callout,
} from "@tremor/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Target,
  TrendingUp,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';

interface TremorKpiUpdateModalProps {
  kpiId: number;
  isOpen: boolean;
  onClose: () => void;
}

// Obtener período actual automáticamente
function getCurrentPeriod(): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const now = new Date();
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

export function TremorKpiUpdateModal({ kpiId, isOpen, onClose }: TremorKpiUpdateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newValue, setNewValue] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Obtener datos del KPI
  const { data: kpi, isLoading: kpiLoading } = useQuery({
    queryKey: [`/api/kpis/${kpiId}`],
    queryFn: async () => {
      if (!kpiId) return null;
      const response = await apiRequest('GET', `/api/kpis/${kpiId}`);
      if (!response.ok) throw new Error('Error al cargar KPI');
      return response.json();
    },
    enabled: isOpen && !!kpiId,
    staleTime: 0,
  });

  // Obtener valor más reciente
  const { data: kpiValues } = useQuery({
    queryKey: ['/api/kpi-values', { kpiId }],
    queryFn: async () => {
      if (!kpiId) return [];
      const response = await apiRequest('GET', `/api/kpi-values?kpiId=${kpiId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isOpen && !!kpiId,
  });

  const latestValue = kpiValues?.sort((a: any, b: any) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  // Reset form cuando se abre
  useEffect(() => {
    if (isOpen) {
      setNewValue('');
      setComments('');
    }
  }, [isOpen]);

  // Mutación para actualizar
  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/kpi-values', {
        kpiId,
        value: newValue,
        period: getCurrentPeriod(),
        comments: comments || '',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar');
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "KPI actualizado",
        description: "El valor se ha registrado correctamente.",
      });

      // Invalidar caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/collaborators-performance'] }),
      ]);

      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el KPI",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    if (!newValue || newValue.trim() === '') {
      toast({
        title: "Campo requerido",
        description: "Ingresa un valor para el KPI",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calcular cumplimiento estimado con el nuevo valor
  const estimatedCompliance = (() => {
    if (!newValue || !kpi?.target) return null;
    const valueNum = parseFloat(newValue);
    const targetNum = parseFloat(String(kpi.target).replace(/[^0-9.-]/g, ''));
    if (isNaN(valueNum) || isNaN(targetNum) || targetNum === 0) return null;
    return (valueNum / targetNum) * 100;
  })();

  const getComplianceColor = (compliance: number | null) => {
    if (!compliance) return "gray";
    if (compliance >= 100) return "emerald";
    if (compliance >= 90) return "yellow";
    return "rose";
  };

  if (kpiLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Actualizar KPI
            </DialogTitle>
          </DialogHeader>
          {kpi && (
            <Text className="text-blue-100 mt-1 text-sm">
              {kpi.name}
            </Text>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Info actual */}
          {kpi && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <Text className="text-xs text-gray-500">Meta</Text>
                <Metric className="text-lg text-blue-600">
                  {kpi.target || kpi.goal || '-'}
                </Metric>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <Text className="text-xs text-gray-500">Valor Actual</Text>
                <Metric className="text-lg text-gray-900">
                  {latestValue?.value || '-'}
                </Metric>
              </div>
            </div>
          )}

          {/* Cumplimiento actual */}
          {latestValue && (
            <div>
              <Flex justifyContent="between" className="mb-1">
                <Text className="text-xs text-gray-500">Cumplimiento actual</Text>
                <Text className="text-xs font-medium">
                  {latestValue.compliancePercentage}%
                </Text>
              </Flex>
              <ProgressBar
                value={Math.min(parseFloat(latestValue.compliancePercentage) || 0, 100)}
                color={getComplianceColor(parseFloat(latestValue.compliancePercentage))}
              />
            </div>
          )}

          {/* Input de nuevo valor */}
          <div className="space-y-2">
            <Text className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Nuevo Valor
            </Text>
            <TextInput
              placeholder="Ej: 45000, 95.5, etc."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={isSubmitting}
              className="text-lg"
            />
          </div>

          {/* Preview del cumplimiento estimado */}
          {estimatedCompliance !== null && (
            <Callout
              title={`Cumplimiento estimado: ${estimatedCompliance.toFixed(1)}%`}
              icon={estimatedCompliance >= 100 ? CheckCircle : AlertTriangle}
              color={getComplianceColor(estimatedCompliance)}
            >
              {estimatedCompliance >= 100
                ? "Este valor cumple con la meta"
                : estimatedCompliance >= 90
                  ? "Cerca de la meta"
                  : "Por debajo de la meta"}
            </Callout>
          )}

          {/* Período (solo informativo) */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>Período: <strong>{getCurrentPeriod()}</strong></span>
          </div>

          {/* Comentarios (opcional) */}
          <div className="space-y-2">
            <Text className="text-sm text-gray-500">Comentarios (opcional)</Text>
            <TextInput
              placeholder="Notas sobre esta actualización..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Botones */}
          <Flex justifyContent="end" className="gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !newValue}
              loading={isSubmitting}
              icon={CheckCircle}
            >
              {isSubmitting ? 'Guardando...' : 'Actualizar'}
            </Button>
          </Flex>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TremorKpiUpdateModal;
