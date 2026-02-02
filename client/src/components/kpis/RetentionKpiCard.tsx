/**
 * Tarjeta KPI para Tasa de Retención de Clientes.
 * Mensaje directo: % actual + clientes en riesgo (3–6 meses) + clientes críticos (6+ meses).
 */

import type React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatKpiValue } from '@/lib/formatKpiValue';
import { KpiCardShell, MetricHero, TwoColumnBlock } from './primitives/KpiCardPrimitives';
import { Activity, AlertCircle } from 'lucide-react';
import type { ChurnRiskResponse } from '@shared/kpi-card-types';

export interface RetentionKpiCardProps {
  kpi: {
    id: number;
    name: string;
    value: number | null;
    target: string;
    unit: string;
    companyId?: number;
    responsible?: string;
    areaName?: string;
    status: string;
  };
  onViewDetails?: () => void;
  onClick?: () => void;
  delay?: number;
}

export function RetentionKpiCard({ kpi, onViewDetails, onClick, delay = 0 }: RetentionKpiCardProps) {
  const companyId = kpi.companyId ?? undefined;
  const { data: churnData, isLoading, error } = useQuery<ChurnRiskResponse>({
    queryKey: ['/api/sales-churn-risk', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-churn-risk?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error al cargar riesgo de churn');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });

  const atRiskCount = churnData?.summary?.atRiskCount ?? 0;
  const criticalCount = churnData?.summary?.criticalCount ?? 0;

  // Badge según valor vs meta real (retención: mayor es mejor). No depender del status del backend.
  const valueNum = typeof kpi.value === 'number' ? kpi.value : parseFloat(String(kpi.value ?? '').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
  const targetNum = parseFloat(String(kpi.target ?? '').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
  const meetsTarget = targetNum > 0 && valueNum >= targetNum;
  const nearTarget = targetNum > 0 && valueNum >= targetNum * 0.9 && valueNum < targetNum;

  const statusBadge =
    meetsTarget ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
        <Activity className="h-3 w-3" /> En meta
      </span>
    ) : nearTarget ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
        Cerca
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" /> Bajo meta
      </span>
    );

  return (
    <KpiCardShell
      companyId={companyId}
      responsible={kpi.responsible}
      title={kpi.name}
      subtitle={kpi.areaName}
      statusBadge={statusBadge}
    >
      <MetricHero
        value={formatKpiValue(kpi.value, kpi.unit)}
        label="Tasa de retención actual"
        context={`Meta: ${formatKpiValue(kpi.target, kpi.unit)}`}
      />
      <div className="pt-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Activity className="h-4 w-4 animate-spin" />
            Cargando clientes en riesgo...
          </div>
        )}
        {error ? (
          <p className="text-sm text-amber-600">No se pudo cargar el detalle de clientes en riesgo</p>
        ) : null}
        {!isLoading && !error && (
          <TwoColumnBlock
            leftLabel="Clientes en riesgo"
            leftSubtitle="3–6 meses sin compra"
            leftValue={atRiskCount}
            rightLabel="Clientes críticos"
            rightSubtitle="6+ meses sin compra"
            rightValue={criticalCount}
          />
        )}
      </div>
    </KpiCardShell>
  );
}
