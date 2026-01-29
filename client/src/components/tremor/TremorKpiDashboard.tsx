/**
 * TremorKpiDashboard - Dashboard principal de KPIs con Tremor
 * Vista general con métricas, gráficas y listado de colaboradores
 */

import { useState, useMemo } from 'react';
import {
  Card,
  Metric,
  Text,
  Flex,
  Grid,
  Col,
  Title,
  BadgeDelta,
  ProgressBar,
  AreaChart,
  DonutChart,
  BarChart,
  BarList,
} from "@tremor/react";
import { type TremorCollaboratorData } from "./TremorCollaboratorCard";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
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
  const [expandedCollaborator, setExpandedCollaborator] = useState<string | null>(null);

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

  // Datos para el gráfico de área
  const chartData = useMemo(() => {
    if (historicalData.length > 0) return historicalData;

    // Sin datos históricos, mostrar solo el punto actual
    if (calculatedMetrics.averageCompliance > 0) {
      return [{ date: "Actual", compliance: calculatedMetrics.averageCompliance }];
    }
    return [];
  }, [historicalData, calculatedMetrics.averageCompliance]);

  // Datos para DonutChart
  const donutData = [
    { name: "Cumplidos", value: calculatedMetrics.compliantKpis },
    { name: "En Riesgo", value: calculatedMetrics.alertKpis },
    { name: "Críticos", value: calculatedMetrics.criticalKpis },
  ];

  // Datos para BarChart comparativo de colaboradores
  const collaboratorComparisonData = useMemo(() => {
    return collaborators.map(c => ({
      name: c.name,
      "Cumplimiento": parseFloat(c.averageCompliance.toFixed(1)),
      "KPIs Cumplidos": c.compliantKpis,
      "KPIs en Riesgo": c.alertKpis,
      "KPIs Críticos": c.notCompliantKpis,
    }));
  }, [collaborators]);

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

      {/* Métricas principales */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        {/* Cumplimiento promedio */}
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start" justifyContent="between">
            <div>
              <Text>Cumplimiento Promedio</Text>
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

        {/* KPIs Cumplidos */}
        <Card decoration="top" decorationColor="emerald">
          <Flex alignItems="center" className="gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <Text>KPIs Cumplidos</Text>
          </Flex>
          <Metric className="text-emerald-600">{calculatedMetrics.compliantKpis}</Metric>
          <Text className="text-xs text-gray-500 mt-1">
            de {calculatedMetrics.totalKpis} totales
          </Text>
        </Card>

        {/* KPIs en Riesgo */}
        <Card decoration="top" decorationColor="yellow">
          <Flex alignItems="center" className="gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <Text>KPIs en Riesgo</Text>
          </Flex>
          <Metric className="text-yellow-600">{calculatedMetrics.alertKpis}</Metric>
          <Text className="text-xs text-gray-500 mt-1">
            requieren atención
          </Text>
        </Card>

        {/* KPIs Críticos */}
        <Card decoration="top" decorationColor="rose">
          <Flex alignItems="center" className="gap-2">
            <XCircle className="h-5 w-5 text-rose-500" />
            <Text>KPIs Críticos</Text>
          </Flex>
          <Metric className="text-rose-600">{calculatedMetrics.criticalKpis}</Metric>
          <Text className="text-xs text-gray-500 mt-1">
            por debajo de meta
          </Text>
        </Card>
      </Grid>

      {/* Gráficos */}
      <Grid numItemsSm={1} numItemsLg={3} className="gap-4">
        {/* Gráfico de tendencia */}
        <Col numColSpan={1} numColSpanLg={2}>
          <Card>
            <Title>Tendencia de Cumplimiento</Title>
            <AreaChart
              className="h-52 mt-4"
              data={chartData}
              index="date"
              categories={["compliance"]}
              colors={["blue"]}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
              showLegend={false}
              showGridLines={true}
              curveType="monotone"
            />
          </Card>
        </Col>

        {/* Distribución de KPIs */}
        <Card>
          <Title>Distribución de KPIs</Title>
          <DonutChart
            className="h-40 mt-4"
            data={donutData}
            category="value"
            index="name"
            colors={["emerald", "yellow", "rose"]}
            valueFormatter={(value) => `${value} KPIs`}
            showAnimation={true}
          />
          <Flex className="mt-4 gap-4" justifyContent="center">
            <Flex alignItems="center" className="gap-1">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <Text className="text-xs">Cumplidos</Text>
            </Flex>
            <Flex alignItems="center" className="gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <Text className="text-xs">En Riesgo</Text>
            </Flex>
            <Flex alignItems="center" className="gap-1">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <Text className="text-xs">Críticos</Text>
            </Flex>
          </Flex>
        </Card>
      </Grid>

      {/* Comparativa de Colaboradores - Solo si hay más de 1 y no hay filtro de colaborador */}
      {collaborators.length > 1 && selectedCollaborator === 'all' && (
        <Card>
          <Title>Comparativa de Colaboradores</Title>
          <Text className="text-gray-500 mb-4">Cumplimiento promedio por persona</Text>
          <BarChart
            className="h-60"
            data={collaboratorComparisonData}
            index="name"
            categories={["Cumplimiento"]}
            colors={["blue"]}
            valueFormatter={(value: number) => `${value}%`}
            showLegend={false}
            showGridLines={true}
          />
        </Card>
      )}

      {/* KPIs que requieren atención */}
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
