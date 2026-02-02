/**
 * Tarjeta KPI para Volumen de Ventas Alcanzado.
 * Mensaje principal: cuántos meses alcanzó la meta (no ventas totales).
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatKpiValue } from '@/lib/formatKpiValue';
import { KpiCardShell, MetricHero } from './primitives/KpiCardPrimitives';
import { AlertCircle, CheckCircle } from 'lucide-react';
import type { MonthlyAchievement } from '@shared/kpi-card-types';

export interface VolumeKpiCardProps {
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
    monthlyAchievement?: MonthlyAchievement;
  };
  onViewDetails?: () => void;
  onClick?: () => void;
  delay?: number;
}

export function VolumeKpiCard({ kpi, onViewDetails, onClick, delay = 0 }: VolumeKpiCardProps) {
  const companyId = kpi.companyId ?? undefined;
  const shouldFetch = !kpi.monthlyAchievement && !!companyId && !!kpi.id;

  const { data: fetchedMa, isLoading: loadingMa } = useQuery<MonthlyAchievement>({
    queryKey: ['/api/kpi-monthly-achievement', kpi.id, companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/kpi-monthly-achievement?kpiId=${kpi.id}&companyId=${companyId}`);
      if (!res.ok) throw new Error('Error al cargar cumplimiento mensual');
      return res.json();
    },
    enabled: shouldFetch,
    staleTime: 60 * 1000,
  });

  const ma = kpi.monthlyAchievement ?? fetchedMa;
  const achieved = ma?.achieved ?? 0;
  const total = ma?.total ?? 0;
  const byMonth = ma?.byMonth ?? [];
  const isLoading = shouldFetch && loadingMa;

  const statusBadge =
    kpi.status === 'excellent' || kpi.status === 'good' ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" /> En meta
      </span>
    ) : kpi.status === 'warning' ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
        Cerca
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" /> Bajo meta
      </span>
    );

  const heroValue = isLoading
    ? 'Cargando...'
    : total > 0
      ? `${achieved} de ${total} meses alcanzando la meta`
      : 'Sin datos mensuales';
  const context = kpi.target ? `Meta mensual ref: ${formatKpiValue(kpi.target, kpi.unit)}` : undefined;

  return (
    <KpiCardShell
      companyId={kpi.companyId}
      responsible={kpi.responsible}
      title={kpi.name}
      subtitle={kpi.areaName}
      statusBadge={statusBadge}
    >
      <MetricHero value={heroValue} label="Cumplimiento mensual" context={context} />
      {byMonth.length > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">Por mes</p>
          <div className="flex flex-wrap gap-1">
            {byMonth.map((m, i) => (
              <span
                key={i}
                className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs font-medium ${
                  m.achieved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
                title={`${m.period}: ${m.achieved ? 'Cumplió' : 'No cumplió'}`}
              >
                {m.achieved ? '✓' : '—'}
              </span>
            ))}
          </div>
        </div>
      )}
    </KpiCardShell>
  );
}
