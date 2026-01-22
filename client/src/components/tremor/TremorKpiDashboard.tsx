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
  BarList,
  Bold,
  Divider,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Select,
  SelectItem,
} from "@tremor/react";
import { TremorKpiCard, TremorKpiCardCompact } from "./TremorKpiCard";
import { TremorCollaboratorCard, TremorCollaboratorCardExpanded, type TremorCollaboratorData } from "./TremorCollaboratorCard";
import { Target, Users, TrendingUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { DeltaType } from "./TremorKpiCard";

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
}: TremorKpiDashboardProps) {
  const [expandedCollaborator, setExpandedCollaborator] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'collaborators' | 'kpis'>('collaborators');
  const [sortBy, setSortBy] = useState<'compliance' | 'name' | 'status'>('compliance');

  // Calcular métricas si no se proporcionan
  const calculatedMetrics = useMemo(() => {
    if (metrics) return metrics;

    const allKpis = collaborators.flatMap(c => c.kpis);
    const totalKpis = allKpis.length;
    const compliantKpis = allKpis.filter(k => k.compliance >= 100).length;
    const alertKpis = allKpis.filter(k => k.compliance >= 90 && k.compliance < 100).length;
    const criticalKpis = allKpis.filter(k => k.compliance < 90).length;
    const averageCompliance = totalKpis > 0
      ? allKpis.reduce((sum, k) => sum + k.compliance, 0) / totalKpis
      : 0;

    return {
      totalKpis,
      compliantKpis,
      alertKpis,
      criticalKpis,
      averageCompliance,
    };
  }, [collaborators, metrics]);

  // Datos para el gráfico de área
  const chartData = useMemo(() => {
    if (historicalData.length > 0) return historicalData;

    // Generar datos de ejemplo si no hay históricos
    return [
      { date: "Ene", compliance: 85 },
      { date: "Feb", compliance: 88 },
      { date: "Mar", compliance: 87 },
      { date: "Abr", compliance: 91 },
      { date: "May", compliance: 89 },
      { date: "Jun", compliance: calculatedMetrics.averageCompliance },
    ];
  }, [historicalData, calculatedMetrics.averageCompliance]);

  // Datos para DonutChart
  const donutData = [
    { name: "Cumplidos", value: calculatedMetrics.compliantKpis },
    { name: "En Riesgo", value: calculatedMetrics.alertKpis },
    { name: "Críticos", value: calculatedMetrics.criticalKpis },
  ];

  // Top KPIs críticos para BarList
  const criticalKpisList = useMemo(() => {
    const allKpis = collaborators.flatMap(c =>
      c.kpis.map(k => ({ ...k, collaborator: c.name }))
    );
    return allKpis
      .filter(k => k.compliance < 100)
      .sort((a, b) => a.compliance - b.compliance)
      .slice(0, 5)
      .map(k => ({
        name: `${k.name} (${k.collaborator})`,
        value: k.compliance,
      }));
  }, [collaborators]);

  // Ordenar colaboradores
  const sortedCollaborators = useMemo(() => {
    return [...collaborators].sort((a, b) => {
      switch (sortBy) {
        case 'compliance':
          return b.averageCompliance - a.averageCompliance;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          const statusOrder = { excellent: 4, good: 3, regular: 2, critical: 1 };
          return statusOrder[b.status] - statusOrder[a.status];
        default:
          return 0;
      }
    });
  }, [collaborators, sortBy]);

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

      <Divider />

      {/* Tabs para alternar entre vistas */}
      <TabGroup>
        <Flex justifyContent="between" alignItems="center">
          <TabList variant="solid">
            <Tab icon={Users}>Por Colaborador</Tab>
            <Tab icon={Target}>Por KPI</Tab>
          </TabList>

          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as any)}
            className="w-40"
          >
            <SelectItem value="compliance">Por Cumplimiento</SelectItem>
            <SelectItem value="name">Por Nombre</SelectItem>
            <SelectItem value="status">Por Estado</SelectItem>
          </Select>
        </Flex>

        <TabPanels>
          {/* Vista por Colaborador */}
          <TabPanel>
            <div className="space-y-4 mt-4">
              {sortedCollaborators.length === 0 ? (
                <Card>
                  <Text className="text-center py-8 text-gray-500">
                    No hay colaboradores para mostrar
                  </Text>
                </Card>
              ) : (
                sortedCollaborators.map((collaborator) => (
                  <div key={collaborator.name}>
                    <TremorCollaboratorCard
                      collaborator={collaborator}
                      expanded={expandedCollaborator === collaborator.name}
                      onToggleExpand={() =>
                        setExpandedCollaborator(
                          expandedCollaborator === collaborator.name ? null : collaborator.name
                        )
                      }
                      onUpdateKpi={onUpdateKpi}
                    />
                    {expandedCollaborator === collaborator.name && (
                      <TremorCollaboratorCardExpanded
                        collaborator={collaborator}
                        onUpdateKpi={onUpdateKpi}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </TabPanel>

          {/* Vista por KPI */}
          <TabPanel>
            <div className="mt-4">
              {kpis.length > 0 ? (
                <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-4">
                  {kpis.map((kpi) => (
                    <TremorKpiCard
                      key={kpi.id}
                      id={kpi.id}
                      name={kpi.name}
                      value={kpi.value}
                      target={kpi.target}
                      unit={kpi.unit}
                      status={kpi.status}
                      compliancePercentage={kpi.compliancePercentage}
                      previousValue={kpi.previousValue}
                      historicalData={kpi.historicalData}
                      frequency={kpi.frequency}
                      onViewDetails={onViewKpiDetails}
                      onUpdate={onUpdateKpi}
                    />
                  ))}
                </Grid>
              ) : (
                <div className="space-y-2">
                  {sortedCollaborators.flatMap(c =>
                    c.kpis.map(kpi => ({
                      ...kpi,
                      collaborator: c.name,
                    }))
                  ).sort((a, b) => {
                    switch (sortBy) {
                      case 'compliance':
                        return b.compliance - a.compliance;
                      case 'name':
                        return a.name.localeCompare(b.name);
                      default:
                        return 0;
                    }
                  }).map((kpi) => {
                    const extendedKpi = kpi as any;
                    return (
                      <TremorKpiCardCompact
                        key={`${kpi.collaborator}-${kpi.id}`}
                        id={kpi.id}
                        name={`${kpi.name} (${kpi.collaborator})`}
                        value={extendedKpi.latestValue?.value ?? kpi.compliance}
                        target={extendedKpi.target || '100'}
                        unit={extendedKpi.unit || '%'}
                        status={
                          kpi.compliance >= 100 ? 'complies' :
                          kpi.compliance >= 90 ? 'alert' : 'not_compliant'
                        }
                        compliancePercentage={kpi.compliance}
                        previousValue={null}
                        onViewDetails={onViewKpiDetails}
                        onUpdate={onUpdateKpi}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

export default TremorKpiDashboard;
