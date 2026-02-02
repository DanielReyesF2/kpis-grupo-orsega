/**
 * Selector de tarjeta KPI por tipo (kpiType del API).
 * Una sola fuente de verdad: backend envía kpiType; frontend solo elige componente.
 */

import type { KpiCardType } from '@shared/kpi-card-types';
import { EnhancedKpiCard } from './EnhancedKpiCard';
import { RetentionKpiCard } from './RetentionKpiCard';
import { VolumeKpiCard } from './VolumeKpiCard';
import { NewClientsKpiCard } from './NewClientsKpiCard';

export interface KpiCardByTypeProps {
  kpi: {
    id: number;
    name: string;
    value: number | null;
    target: string;
    unit: string;
    compliancePercentage: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    areaName?: string;
    responsible?: string;
    companyId?: number;
    company?: string;
    historicalData?: Array<{ value: number; recordedAt: string }>;
    kpiType?: KpiCardType;
    monthlyAchievement?: { achieved: number; total: number; byMonth?: Array<{ period: string; achieved: boolean }> };
  };
  onClick?: () => void;
  onViewDetails?: () => void;
  delay?: number;
  expandedLayout?: boolean;
}

export function KpiCardByType({ kpi, onClick, onViewDetails, delay = 0, expandedLayout = false }: KpiCardByTypeProps) {
  const kpiType: KpiCardType = kpi.kpiType ?? 'default';

  if (kpiType === 'retention') {
    return (
      <RetentionKpiCard
        kpi={{
          id: kpi.id,
          name: kpi.name,
          value: kpi.value,
          target: kpi.target,
          unit: kpi.unit,
          companyId: kpi.companyId,
          responsible: kpi.responsible,
          areaName: kpi.areaName,
          status: kpi.status,
        }}
        onClick={onClick}
        onViewDetails={onViewDetails}
        delay={delay}
      />
    );
  }

  if (kpiType === 'volume') {
    return (
      <VolumeKpiCard
        kpi={{
          id: kpi.id,
          name: kpi.name,
          value: kpi.value,
          target: kpi.target,
          unit: kpi.unit,
          companyId: kpi.companyId,
          responsible: kpi.responsible,
          areaName: kpi.areaName,
          status: kpi.status,
          monthlyAchievement: kpi.monthlyAchievement,
        }}
        onClick={onClick}
        onViewDetails={onViewDetails}
        delay={delay}
      />
    );
  }

  if (kpiType === 'new_clients') {
    return (
      <NewClientsKpiCard
        kpi={{
          id: kpi.id,
          name: kpi.name,
          value: kpi.value,
          target: kpi.target,
          unit: kpi.unit,
          companyId: kpi.companyId,
          responsible: kpi.responsible,
          areaName: kpi.areaName,
          compliancePercentage: kpi.compliancePercentage,
          status: kpi.status,
        }}
        onClick={onClick}
        onViewDetails={onViewDetails}
        delay={delay}
      />
    );
  }

  return (
    <EnhancedKpiCard
      kpi={{
        id: kpi.id,
        name: kpi.name,
        value: kpi.value,
        target: kpi.target,
        unit: kpi.unit,
        compliancePercentage: kpi.compliancePercentage,
        status: kpi.status,
        areaName: kpi.areaName,
        responsible: kpi.responsible,
        companyId: kpi.companyId,
        company: kpi.company,
        historicalData: kpi.historicalData,
      }}
      onClick={onClick}
      onViewDetails={onViewDetails}
      delay={delay}
      expandedLayout={expandedLayout}
    />
  );
}
