/**
 * TremorKpiDashboard - Dashboard ejecutivo de KPIs con Tremor
 * Vista "Colaborador-First": scoreboard del equipo con semáforo y distribución de KPIs
 */

import { useMemo } from 'react';
import {
  Card,
  Metric,
  Text,
  Flex,
  Grid,
  Title,
  BadgeDelta,
  ProgressBar,
  CategoryBar,
  BarList,
  Bold,
} from "@tremor/react";
import { type TremorCollaboratorData } from "./TremorCollaboratorCard";
import { AlertTriangle, CheckCircle, Users } from "lucide-react";
import type { DeltaType } from "./TremorKpiCard";

// Umbrales de cumplimiento (deben coincidir con @shared/kpi-utils.ts)
// Fuente de verdad: shared/kpi-utils.ts -> calculateKpiStatus()
const KPI_THRESHOLDS = {
  COMPLIES: 100,    // >= 100% = cumple
  ALERT: 90,        // >= 90% = alerta
  // < 90% = no cumple
} as const;

// Helper para determinar status desde compliance
function getStatusFromCompliance(compliance: number): 'complies' | 'alert' | 'not_compliant' {
  if (compliance >= KPI_THRESHOLDS.COMPLIES) return 'complies';
  if (compliance >= KPI_THRESHOLDS.ALERT) return 'alert';
  return 'not_compliant';
}

// Helper para obtener etiqueta de status en español
function getStatusLabel(status: string): string {
  switch (status) {
    case 'excellent': return "Excelente";
    case 'good': return "Bueno";
    case 'regular': return "Regular";
    case 'critical': return "Crítico";
    default: return "Sin estado";
  }
}

// Helper para obtener color del dot de status
function getStatusDotColor(status: string): string {
  switch (status) {
    case 'excellent': return "bg-emerald-500";
    case 'good': return "bg-blue-500";
    case 'regular': return "bg-yellow-500";
    case 'critical': return "bg-rose-500";
    default: return "bg-gray-400";
  }
}

// Helper para obtener color de decoración de Card por status
function getStatusDecorationColor(status: string): "emerald" | "blue" | "yellow" | "rose" {
  switch (status) {
    case 'excellent': return "emerald";
    case 'good': return "blue";
    case 'regular': return "yellow";
    case 'critical': return "rose";
    default: return "blue";
  }
}

// Tipos para los datos del dashboard
export interface DashboardKpi {
  id: number;
  name: string;
  value: number | string;
  target: number | string;
  unit?: string;
  status: 'complies' | 'alert' | 'not_compliant';
  compliancePercentage: number;
  previousValue?: number | null;
  historicalData?: Array<{ date: string; value: number }>;
  frequency?: string;
  responsible?: string;
  area?: string;
}

export interface DashboardMetrics {
  totalKpis: number;
  compliantKpis: number;
  alertKpis: number;
  criticalKpis: number;
  averageCompliance: number;
  previousAverageCompliance?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface TremorKpiDashboardProps {
  collaborators: TremorCollaboratorData[];
  kpis?: DashboardKpi[];
  metrics?: DashboardMetrics;
  historicalData?: Array<{ date: string; compliance: number }>;
  onViewKpiDetails?: (kpiId: number) => void;
  onUpdateKpi?: (kpiId: number) => void;
  title?: string;
  subtitle?: string;
  selectedCollaborator?: string;
  statusFilter?: string;
}

// Función para obtener delta type
function getDeltaType(current: number, previous: number | undefined): DeltaType {
  if (!previous) return "unchanged";
  const change = current - previous;
  if (change >= 10) return "increase";
  if (change > 0) return "moderateIncrease";
  if (change === 0) return "unchanged";
  if (change > -10) return "moderateDecrease";
  return "decrease";
}

// Función para obtener delta type desde un cambio numérico
function getDeltaTypeFromChange(change: number | null | undefined): DeltaType {
  if (change === null || change === undefined) return "unchanged";
  if (change >= 10) return "increase";
  if (change > 0) return "moderateIncrease";
  if (change === 0) return "unchanged";
  if (change > -10) return "moderateDecrease";
  return "decrease";
}

export function TremorKpiDashboard({
  collaborators,
  kpis = [],
  metrics,
  historicalData = [],
  onViewKpiDetails,
  onUpdateKpi,
  title = "Centro de Control de KPIs",
  subtitle = "Monitoreo de indicadores clave de desempeño",
  selectedCollaborator = 'all',
  statusFilter = 'all',
}: TremorKpiDashboardProps) {
  // Filtrar colaboradores según el filtro seleccionado
  const filteredCollaborators = useMemo(() => {
    if (selectedCollaborator === 'all') return collaborators;
    return collaborators.filter(c => c.name === selectedCollaborator);
  }, [collaborators, selectedCollaborator]);

  // Filtrar KPIs por estado
  const filteredCollaboratorsWithStatus = useMemo(() => {
    if (statusFilter === 'all') return filteredCollaborators;

    return filteredCollaborators.map(c => ({
      ...c,
      kpis: c.kpis.filter(k => {
        const kpiStatus = getStatusFromCompliance(k.compliance);
        return kpiStatus === statusFilter;
      }),
      // Recalcular conteos usando umbrales centralizados
      compliantKpis: c.kpis.filter(k => k.compliance >= KPI_THRESHOLDS.COMPLIES && (statusFilter === 'all' || statusFilter === 'complies')).length,
      alertKpis: c.kpis.filter(k => k.compliance >= KPI_THRESHOLDS.ALERT && k.compliance < KPI_THRESHOLDS.COMPLIES && (statusFilter === 'all' || statusFilter === 'alert')).length,
      notCompliantKpis: c.kpis.filter(k => k.compliance < KPI_THRESHOLDS.ALERT && (statusFilter === 'all' || statusFilter === 'not_compliant')).length,
    })).filter(c => c.kpis.length > 0);
  }, [filteredCollaborators, statusFilter]);

  // Calcular métricas basadas en colaboradores filtrados
  const calculatedMetrics = useMemo(() => {
    const allKpis = filteredCollaboratorsWithStatus.flatMap(c => c.kpis);
    const totalKpis = allKpis.length;
    // Usar umbrales centralizados para consistencia con backend
    const compliantKpis = allKpis.filter(k => k.compliance >= KPI_THRESHOLDS.COMPLIES).length;
    const alertKpis = allKpis.filter(k => k.compliance >= KPI_THRESHOLDS.ALERT && k.compliance < KPI_THRESHOLDS.COMPLIES).length;
    const criticalKpis = allKpis.filter(k => k.compliance < KPI_THRESHOLDS.ALERT).length;
    const averageCompliance = totalKpis > 0
      ? allKpis.reduce((sum, k) => sum + k.compliance, 0) / totalKpis
      : 0;

    // Si hay métricas externas y no hay filtro, usarlas
    if (metrics && selectedCollaborator === 'all' && statusFilter === 'all') {
      return metrics;
    }

    return {
      totalKpis,
      compliantKpis,
      alertKpis,
      criticalKpis,
      averageCompliance,
    };
  }, [filteredCollaboratorsWithStatus, metrics, selectedCollaborator, statusFilter]);

  // Conteo de colaboradores que necesitan atención
  const collaboratorsNeedingAttention = useMemo(() => {
    return filteredCollaboratorsWithStatus.filter(
      c => c.status === 'critical' || c.status === 'regular'
    ).length;
  }, [filteredCollaboratorsWithStatus]);

  // Colaboradores ordenados: mejor primero (mayor a menor cumplimiento)
  const sortedCollaborators = useMemo(() => {
    return [...filteredCollaboratorsWithStatus].sort((a, b) => {
      if (a.averageCompliance !== b.averageCompliance)
        return b.averageCompliance - a.averageCompliance;
      return a.notCompliantKpis - b.notCompliantKpis; // menos críticos primero
    });
  }, [filteredCollaboratorsWithStatus]);

  // Top KPIs críticos para BarList (KPIs que no cumplen al 100%)
  const criticalKpisList = useMemo(() => {
    const allKpis = filteredCollaboratorsWithStatus.flatMap(c =>
      c.kpis.map(k => ({ ...k, collaborator: c.name }))
    );
    return allKpis
      .filter(k => k.compliance < KPI_THRESHOLDS.COMPLIES)
      .sort((a, b) => a.compliance - b.compliance)
      .slice(0, 5)
      .map(k => ({
        name: `${k.name} (${k.collaborator})`,
        value: k.compliance,
      }));
  }, [filteredCollaboratorsWithStatus]);

  const deltaValue = metrics?.previousAverageCompliance
    ? `${(calculatedMetrics.averageCompliance - metrics.previousAverageCompliance) >= 0 ? '+' : ''}${(calculatedMetrics.averageCompliance - metrics.previousAverageCompliance).toFixed(1)}%`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Title>{title}</Title>
        <Text className="text-gray-500">{subtitle}</Text>
      </div>

      {/* Sección 1: Resumen compacto - 3 tarjetas */}
      <Grid numItemsSm={2} numItemsLg={3} className="gap-4">
        {/* Cumplimiento del Equipo */}
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start" justifyContent="between">
            <div>
              <Text>Cumplimiento del Equipo</Text>
              <Metric className={`${
                calculatedMetrics.averageCompliance >= 100 ? 'text-emerald-600' :
                calculatedMetrics.averageCompliance >= 90 ? 'text-yellow-600' : 'text-rose-600'
              }`}>
                {calculatedMetrics.averageCompliance.toFixed(1)}%
              </Metric>
            </div>
            {deltaValue && (
              <BadgeDelta
                deltaType={getDeltaType(calculatedMetrics.averageCompliance, metrics?.previousAverageCompliance)}
              >
                {deltaValue}
              </BadgeDelta>
            )}
          </Flex>
          <ProgressBar
            value={Math.min(calculatedMetrics.averageCompliance, 100)}
            color={calculatedMetrics.averageCompliance >= 100 ? "emerald" :
                   calculatedMetrics.averageCompliance >= 90 ? "yellow" : "rose"}
            className="mt-3"
          />
        </Card>

        {/* Total de KPIs */}
        <Card decoration="top" decorationColor="emerald">
          <Flex alignItems="center" className="gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <Text>Total de KPIs</Text>
          </Flex>
          <Metric>{calculatedMetrics.totalKpis}</Metric>
          <CategoryBar
            values={[
              calculatedMetrics.compliantKpis,
              calculatedMetrics.alertKpis,
              calculatedMetrics.criticalKpis,
            ]}
            colors={["emerald", "yellow", "rose"]}
            className="mt-3"
          />
          <Text className="text-xs text-gray-500 mt-2">
            {calculatedMetrics.compliantKpis} cumplidos / {calculatedMetrics.alertKpis} riesgo / {calculatedMetrics.criticalKpis} críticos
          </Text>
        </Card>

        {/* Colaboradores en Alerta */}
        <Card decoration="top" decorationColor="rose">
          <Flex alignItems="center" className="gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <Text>Colaboradores en Alerta</Text>
          </Flex>
          <Metric className={collaboratorsNeedingAttention > 0 ? "text-rose-600" : "text-emerald-600"}>
            {collaboratorsNeedingAttention}
          </Metric>
          <Text className="text-xs text-gray-500 mt-1">
            de {filteredCollaboratorsWithStatus.length} colaboradores
          </Text>
        </Card>
      </Grid>

      {/* Sección 2: Tarjetas por Colaborador */}
      <div>
        <Title>Scoreboard del Equipo</Title>
        <Text className="text-gray-500 dark:text-gray-400 mb-4">Ordenado por cumplimiento (mayor a menor)</Text>

        {sortedCollaborators.length === 0 ? (
          <Card>
            <Flex justifyContent="center" alignItems="center" className="py-12 flex-col gap-3">
              <Users className="h-12 w-12 text-gray-300" />
              <Text className="text-gray-400">Sin datos de colaboradores</Text>
            </Flex>
          </Card>
        ) : (
          <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-4">
            {sortedCollaborators.map((collaborator) => {
              const complianceColor =
                collaborator.averageCompliance >= 100
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : collaborator.averageCompliance >= 90
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-rose-600 dark:text-rose-400';

              const categoryValues = [
                collaborator.compliantKpis,
                collaborator.alertKpis,
                collaborator.notCompliantKpis,
              ];

              const scoreChangeValue = collaborator.scoreChange !== null && collaborator.scoreChange !== undefined
                ? `${collaborator.scoreChange >= 0 ? '+' : ''}${collaborator.scoreChange.toFixed(1)}%`
                : null;

              return (
                <Card
                  key={collaborator.name}
                  decoration="left"
                  decorationColor={getStatusDecorationColor(collaborator.status)}
                >
                  {/* Nombre + BadgeDelta */}
                  <Flex justifyContent="between" alignItems="start">
                    <p className="font-semibold truncate min-w-0 flex-1 text-sm" style={{ color: 'var(--text-primary, #111827)' }}>
                      {collaborator.name}
                    </p>
                    {scoreChangeValue && (
                      <BadgeDelta deltaType={getDeltaTypeFromChange(collaborator.scoreChange)} size="xs">
                        {scoreChangeValue}
                      </BadgeDelta>
                    )}
                  </Flex>

                  {/* Status dot + label */}
                  <Flex justifyContent="start" className="gap-1.5 mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${getStatusDotColor(collaborator.status)}`} />
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {getStatusLabel(collaborator.status)}
                    </Text>
                  </Flex>

                  {/* Hero: % de cumplimiento */}
                  <div className="mt-3 mb-3">
                    <Metric className={complianceColor}>
                      {collaborator.averageCompliance.toFixed(1)}%
                    </Metric>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">Cumplimiento</Text>
                  </div>

                  {/* CategoryBar distribución */}
                  <CategoryBar
                    values={categoryValues}
                    colors={["emerald", "yellow", "rose"]}
                  />

                  {/* Desglose con colores */}
                  <Flex justifyContent="start" className="mt-3 gap-1 flex-wrap">
                    <Text className="text-xs">
                      <Bold className="text-emerald-600 dark:text-emerald-400">{collaborator.compliantKpis}</Bold>
                      <span className="text-gray-500 dark:text-gray-400"> cumplidos</span>
                    </Text>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <Text className="text-xs">
                      <Bold className="text-yellow-600 dark:text-yellow-400">{collaborator.alertKpis}</Bold>
                      <span className="text-gray-500 dark:text-gray-400"> riesgo</span>
                    </Text>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <Text className="text-xs">
                      <Bold className="text-rose-600 dark:text-rose-400">{collaborator.notCompliantKpis}</Bold>
                      <span className="text-gray-500 dark:text-gray-400"> críticos</span>
                    </Text>
                  </Flex>

                  {/* Ratio resumen */}
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {collaborator.compliantKpis}/{collaborator.totalKpis} cumplidos
                  </Text>
                </Card>
              );
            })}
          </Grid>
        )}
      </div>

      {/* Sección 3: KPIs que requieren atención */}
      {criticalKpisList.length > 0 && (
        <Card>
          <Title>KPIs que Requieren Atención</Title>
          <Text className="text-gray-500 mb-4">Los 5 KPIs con menor cumplimiento</Text>
          <BarList
            data={criticalKpisList}
            valueFormatter={(value: number) => `${value.toFixed(1)}%`}
            color="rose"
          />
        </Card>
      )}

    </div>
  );
}

export default TremorKpiDashboard;
