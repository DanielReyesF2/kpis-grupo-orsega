/**
 * Tarjeta KPI para Nuevos Clientes Adquiridos.
 * Enfoque: X clientes vs Meta Y clientes, con barra de cumplimiento y badge según valor vs meta.
 */

import { formatKpiValue } from '@/lib/formatKpiValue';
import { KpiCardShell, MetricHero, OptionalBar } from './primitives/KpiCardPrimitives';
import { AlertCircle, CheckCircle } from 'lucide-react';

export interface NewClientsKpiCardProps {
  kpi: {
    id: number;
    name: string;
    value: number | null;
    target: string;
    unit: string;
    companyId?: number;
    responsible?: string;
    areaName?: string;
    compliancePercentage?: number;
    status?: string;
  };
  onViewDetails?: () => void;
  onClick?: () => void;
  delay?: number;
}

function parseNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(/[^0-9.,]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function NewClientsKpiCard({ kpi, onViewDetails, onClick, delay = 0 }: NewClientsKpiCardProps) {
  const valueNum = parseNum(kpi.value);
  const targetNum = parseNum(kpi.target);
  const compliance = kpi.compliancePercentage ?? (targetNum > 0 ? Math.min(100, (valueNum / targetNum) * 100) : 0);

  const meetsTarget = targetNum > 0 && valueNum >= targetNum;
  const nearTarget = targetNum > 0 && valueNum >= targetNum * 0.9 && valueNum < targetNum;

  const statusBadge =
    meetsTarget ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" /> En meta
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

  const barStatus =
    meetsTarget ? 'excellent' : nearTarget ? 'warning' : 'critical';

  const heroValue = valueNum === 0 && targetNum === 0
    ? 'Sin datos'
    : `${formatKpiValue(kpi.value, kpi.unit || 'clientes')}`;
  const context = targetNum > 0 ? `Meta: ${formatKpiValue(kpi.target, kpi.unit || 'clientes')}` : undefined;

  return (
    <KpiCardShell
      companyId={kpi.companyId}
      responsible={kpi.responsible}
      title={kpi.name}
      subtitle={kpi.areaName}
      statusBadge={statusBadge}
    >
      <MetricHero value={heroValue} label="Clientes adquiridos" context={context} />
      {(targetNum > 0 || compliance > 0) && (
        <div className="pt-3">
          <OptionalBar
            label="Cumplimiento"
            value={compliance}
            status={barStatus}
            context={targetNum > 0 ? `Meta: ${formatKpiValue(kpi.target, kpi.unit || 'clientes')}` : undefined}
          />
        </div>
      )}
    </KpiCardShell>
  );
}
