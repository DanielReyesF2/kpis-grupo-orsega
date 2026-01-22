/**
 * TremorCollaboratorCard - Tarjeta de colaborador usando Tremor
 * Muestra métricas de cumplimiento de KPIs por colaborador
 */

import { useState } from 'react';
import {
  Card,
  Metric,
  Text,
  Flex,
  BadgeDelta,
  ProgressBar,
  CategoryBar,
  Bold,
  DonutChart,
  Legend,
} from "@tremor/react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Eye, User } from "lucide-react";
import type { DeltaType } from "./TremorKpiCard";

export interface CollaboratorKpi {
  id: number;
  name: string;
  compliance: number;
  complianceChange?: number | null;
  trendDirection?: 'up' | 'down' | 'stable' | null;
  status: string;
  [key: string]: any;
}

export interface TremorCollaboratorData {
  name: string;
  score: number;
  status: 'excellent' | 'good' | 'regular' | 'critical';
  averageCompliance: number;
  compliantKpis: number;
  alertKpis: number;
  notCompliantKpis: number;
  totalKpis: number;
  lastUpdate: string | null;
  scoreChange?: number | null;
  scoreChangePeriod?: string | null;
  trendDirection?: 'up' | 'down' | 'stable' | null;
  kpis: CollaboratorKpi[];
}

interface TremorCollaboratorCardProps {
  collaborator: TremorCollaboratorData;
  onViewDetails?: (collaborator: TremorCollaboratorData) => void;
  onUpdateKpi?: (kpiId: number) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

// Determinar el tipo de delta basado en el cambio
function getDeltaType(change: number | null | undefined): DeltaType {
  if (change === null || change === undefined) return "unchanged";
  if (change >= 10) return "increase";
  if (change > 0) return "moderateIncrease";
  if (change === 0) return "unchanged";
  if (change > -10) return "moderateDecrease";
  return "decrease";
}

// Obtener color basado en el status
function getStatusColor(status: string): "emerald" | "blue" | "yellow" | "rose" {
  switch (status) {
    case 'excellent':
      return "emerald";
    case 'good':
      return "blue";
    case 'regular':
      return "yellow";
    case 'critical':
      return "rose";
    default:
      return "yellow";
  }
}

// Obtener texto de status en español
function getStatusText(status: string): string {
  switch (status) {
    case 'excellent':
      return "Excelente";
    case 'good':
      return "Bueno";
    case 'regular':
      return "Regular";
    case 'critical':
      return "Crítico";
    default:
      return "Sin estado";
  }
}

// Generar iniciales del nombre
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export function TremorCollaboratorCard({
  collaborator,
  onViewDetails,
  onUpdateKpi,
  expanded = false,
  onToggleExpand,
}: TremorCollaboratorCardProps) {
  const statusColor = getStatusColor(collaborator.status);

  // Datos para CategoryBar (distribución de KPIs)
  const categoryValues = [
    collaborator.compliantKpis,
    collaborator.alertKpis,
    collaborator.notCompliantKpis,
  ];

  // Datos para DonutChart
  const donutData = [
    { name: "Cumplidos", value: collaborator.compliantKpis },
    { name: "En Riesgo", value: collaborator.alertKpis },
    { name: "Críticos", value: collaborator.notCompliantKpis },
  ];

  // Delta value para mostrar cambio en score
  const deltaValue = collaborator.scoreChange !== null && collaborator.scoreChange !== undefined
    ? `${collaborator.scoreChange >= 0 ? '+' : ''}${collaborator.scoreChange.toFixed(1)}%`
    : null;

  const deltaType = getDeltaType(collaborator.scoreChange);

  return (
    <Card className={`ring-1 ${
      statusColor === 'emerald' ? 'ring-emerald-200 dark:ring-emerald-800' :
      statusColor === 'blue' ? 'ring-blue-200 dark:ring-blue-800' :
      statusColor === 'yellow' ? 'ring-yellow-200 dark:ring-yellow-800' :
      'ring-rose-200 dark:ring-rose-800'
    }`}>
      <Flex alignItems="start" justifyContent="between" className="gap-4">
        {/* Avatar y Nombre */}
        <Flex alignItems="center" className="gap-3 flex-shrink-0">
          <div className={`flex items-center justify-center w-12 h-12 rounded-lg border ${
            statusColor === 'emerald' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700' :
            statusColor === 'blue' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700' :
            statusColor === 'yellow' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-700' :
            'bg-rose-50 border-rose-200 dark:bg-rose-900/30 dark:border-rose-700'
          }`}>
            <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {getInitials(collaborator.name)}
            </span>
          </div>
          <div>
            <Text className="font-semibold text-gray-900 dark:text-gray-100">
              {collaborator.name}
            </Text>
            <Flex alignItems="center" className="gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                statusColor === 'emerald' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                statusColor === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
              }`}>
                {getStatusText(collaborator.status)}
              </span>
              {deltaValue && (
                <BadgeDelta deltaType={deltaType} size="xs">
                  {deltaValue}
                </BadgeDelta>
              )}
            </Flex>
          </div>
        </Flex>

        {/* Métricas centrales */}
        <Flex className="gap-6 flex-1 justify-center">
          {/* Cumplimiento promedio */}
          <div className="text-center">
            <Metric className={`text-2xl ${
              collaborator.averageCompliance >= 100 ? 'text-emerald-600' :
              collaborator.averageCompliance >= 90 ? 'text-yellow-600' : 'text-rose-600'
            }`}>
              {collaborator.averageCompliance.toFixed(1)}%
            </Metric>
            <Text className="text-xs text-gray-500">Cumplimiento</Text>
          </div>

          {/* Distribución de KPIs */}
          <Flex className="gap-3">
            <div className="text-center px-3 border-l border-gray-200 dark:border-gray-700">
              <Bold className="text-xl text-emerald-600">{collaborator.compliantKpis}</Bold>
              <Text className="text-xs text-gray-500">Cumplidos</Text>
            </div>
            <div className="text-center px-3 border-l border-gray-200 dark:border-gray-700">
              <Bold className="text-xl text-yellow-600">{collaborator.alertKpis}</Bold>
              <Text className="text-xs text-gray-500">En Riesgo</Text>
            </div>
            <div className="text-center px-3 border-l border-gray-200 dark:border-gray-700">
              <Bold className="text-xl text-rose-600">{collaborator.notCompliantKpis}</Bold>
              <Text className="text-xs text-gray-500">Críticos</Text>
            </div>
          </Flex>
        </Flex>

        {/* Botón de acción */}
        <div className="flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex items-center gap-2"
            onClick={onToggleExpand}
          >
            <Eye className="h-4 w-4" />
            {expanded ? 'Ocultar' : 'Ver KPIs'}
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Flex>

      {/* Barra de distribución de KPIs */}
      <div className="mt-4">
        <CategoryBar
          values={categoryValues}
          colors={["emerald", "yellow", "rose"]}
          className="mt-2"
        />
        <Flex className="mt-2" justifyContent="between">
          <Text className="text-xs text-gray-500">
            Total: <Bold>{collaborator.totalKpis}</Bold> KPIs
          </Text>
          {collaborator.lastUpdate && (
            <Text className="text-xs text-gray-500">
              Actualizado: {collaborator.lastUpdate}
            </Text>
          )}
        </Flex>
      </div>
    </Card>
  );
}

// Versión expandida que muestra los KPIs detallados
export function TremorCollaboratorCardExpanded({
  collaborator,
  onUpdateKpi,
}: {
  collaborator: TremorCollaboratorData;
  onUpdateKpi?: (kpiId: number) => void;
}) {
  // Ordenar KPIs por cumplimiento
  const sortedKpis = [...collaborator.kpis].sort((a, b) => a.compliance - b.compliance);

  return (
    <Card className="mt-0 rounded-t-none border-t-0 bg-gray-50/50 dark:bg-gray-900/50">
      <Text className="font-medium mb-4">KPIs de {collaborator.name}</Text>

      <div className="space-y-3">
        {sortedKpis.map((kpi) => {
          const kpiStatus = kpi.compliance >= 100 ? 'complies' :
                           kpi.compliance >= 90 ? 'alert' : 'not_compliant';
          const progressColor = kpiStatus === 'complies' ? 'emerald' :
                               kpiStatus === 'alert' ? 'yellow' : 'rose';

          const deltaValue = kpi.complianceChange !== null && kpi.complianceChange !== undefined
            ? `${kpi.complianceChange >= 0 ? '+' : ''}${kpi.complianceChange.toFixed(1)}%`
            : null;

          return (
            <div
              key={kpi.id}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <Flex justifyContent="between" alignItems="start">
                <div className="flex-1 min-w-0">
                  <Flex alignItems="center" className="gap-2">
                    <Text className="font-medium truncate">{kpi.name}</Text>
                    {deltaValue && (
                      <BadgeDelta deltaType={getDeltaType(kpi.complianceChange)} size="xs">
                        {deltaValue}
                      </BadgeDelta>
                    )}
                  </Flex>
                  <Flex className="mt-2 gap-4" alignItems="center">
                    <ProgressBar
                      value={Math.min(kpi.compliance, 100)}
                      color={progressColor}
                      className="w-40"
                    />
                    <Bold className={`text-sm ${
                      kpiStatus === 'complies' ? 'text-emerald-600' :
                      kpiStatus === 'alert' ? 'text-yellow-600' : 'text-rose-600'
                    }`}>
                      {kpi.compliance.toFixed(1)}%
                    </Bold>
                  </Flex>
                </div>

                {onUpdateKpi && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs flex-shrink-0"
                    onClick={() => onUpdateKpi(kpi.id)}
                  >
                    Actualizar
                  </Button>
                )}
              </Flex>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default TremorCollaboratorCard;
