/**
 * TremorKpiCard - Tarjeta de KPI usando componentes de Tremor
 * Diseño moderno con BadgeDelta, ProgressBar y SparkChart
 */

import {
  Card,
  Metric,
  Text,
  Flex,
  Grid,
  Col,
  BadgeDelta,
  ProgressBar,
  SparkAreaChart,
  Bold,
  Tracker,
  Callout,
} from "@tremor/react";
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

// Tipo para datos del Tracker
interface TrackerItem {
  color: "emerald" | "yellow" | "rose" | "gray";
  tooltip: string;
}

export type DeltaType = "increase" | "moderateIncrease" | "unchanged" | "moderateDecrease" | "decrease";

interface HistoricalDataPoint {
  date: string;
  value: number;
}

interface TremorKpiCardProps {
  id: number;
  name: string;
  value: number | string;
  target: number | string;
  unit?: string;
  status: 'complies' | 'alert' | 'not_compliant';
  compliancePercentage: number;
  previousValue?: number | null;
  historicalData?: HistoricalDataPoint[];
  frequency?: string;
  onViewDetails?: (id: number) => void;
  onUpdate?: (id: number) => void;
}

// Determinar el tipo de delta basado en el cambio porcentual
function getDeltaType(change: number): DeltaType {
  if (change >= 10) return "increase";
  if (change > 0) return "moderateIncrease";
  if (change === 0) return "unchanged";
  if (change > -10) return "moderateDecrease";
  return "decrease";
}

// Obtener color de la barra de progreso según el status
function getProgressColor(status: string): "emerald" | "yellow" | "rose" {
  switch (status) {
    case 'complies':
      return "emerald";
    case 'alert':
      return "yellow";
    case 'not_compliant':
      return "rose";
    default:
      return "yellow";
  }
}

// Obtener texto de status en español
function getStatusText(status: string): string {
  switch (status) {
    case 'complies':
      return "En meta";
    case 'alert':
      return "Cerca";
    case 'not_compliant':
      return "Bajo meta";
    default:
      return "Sin datos";
  }
}

export function TremorKpiCard({
  id,
  name,
  value,
  target,
  unit = "",
  status,
  compliancePercentage,
  previousValue,
  historicalData,
  frequency,
  onViewDetails,
  onUpdate,
}: TremorKpiCardProps) {
  // Calcular variación vs periodo anterior
  const currentNum = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  const prevNum = previousValue ?? null;

  let deltaValue: string | null = null;
  let deltaType: DeltaType = "unchanged";

  if (prevNum !== null && prevNum !== 0 && !isNaN(currentNum)) {
    const change = ((currentNum - prevNum) / prevNum) * 100;
    deltaValue = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    deltaType = getDeltaType(change);
  }

  // Preparar datos para sparkline
  const sparkData = historicalData?.slice(-6).map(d => ({
    date: d.date,
    value: d.value,
  })) || [];

  // Formatear valor para mostrar
  const displayValue = typeof value === 'number'
    ? value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    : value;

  const displayTarget = typeof target === 'number'
    ? target.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    : target;

  return (
    <Card className="p-4 ring-1 ring-gray-200 dark:ring-gray-800">
      {/* Header: Nombre y Delta */}
      <Flex alignItems="start" justifyContent="between">
        <div className="truncate">
          <Text className="truncate font-medium">{name}</Text>
          {frequency && (
            <Text className="text-xs text-gray-500">{frequency}</Text>
          )}
        </div>
        {deltaValue && (
          <BadgeDelta deltaType={deltaType} size="sm">
            {deltaValue}
          </BadgeDelta>
        )}
      </Flex>

      {/* Métrica principal */}
      <Flex alignItems="baseline" className="mt-2 space-x-2">
        <Metric>{displayValue}</Metric>
        {unit && <Text className="text-gray-500">{unit}</Text>}
      </Flex>

      {/* Sparkline si hay datos */}
      {sparkData.length > 1 && (
        <SparkAreaChart
          data={sparkData}
          categories={["value"]}
          index="date"
          colors={[getProgressColor(status)]}
          className="mt-2 h-10 w-full"
        />
      )}

      {/* Barra de progreso */}
      <Flex className="mt-4" justifyContent="between">
        <Text className="text-xs">
          Meta: <Bold>{displayTarget}</Bold> {unit}
        </Text>
        <Text className="text-xs">
          <Bold className={
            status === 'complies' ? 'text-emerald-600' :
            status === 'alert' ? 'text-yellow-600' : 'text-rose-600'
          }>
            {compliancePercentage.toFixed(1)}%
          </Bold>
        </Text>
      </Flex>

      <ProgressBar
        value={Math.min(compliancePercentage, 100)}
        color={getProgressColor(status)}
        className="mt-2"
      />

      {/* Tracker - historial visual compacto (solo si hay datos) */}
      {historicalData && historicalData.length > 0 && (
        <div className="mt-3">
          <Text className="text-xs text-gray-500 mb-1">Historial reciente</Text>
          <Tracker
            data={historicalData.slice(-12).map((d): TrackerItem => {
              const compliance = typeof d.value === 'number' ? d.value : 0;
              return {
                color: compliance >= 100 ? 'emerald' : compliance >= 90 ? 'yellow' : 'rose',
                tooltip: `${d.date}: ${compliance.toFixed(1)}%`,
              };
            })}
            className="w-full"
          />
        </div>
      )}

      {/* Callout para KPIs críticos */}
      {status === 'not_compliant' && compliancePercentage < 80 && (
        <Callout
          title="Requiere atención"
          icon={AlertTriangle}
          color="rose"
          className="mt-3 text-xs"
        >
          {(100 - compliancePercentage).toFixed(1)}% por debajo de la meta
        </Callout>
      )}

      {/* Status indicator */}
      <Flex className="mt-3" justifyContent="between" alignItems="center">
        <Flex alignItems="center" className="gap-1">
          {status === 'complies' && <TrendingUp className="h-3 w-3 text-emerald-600" />}
          {status === 'not_compliant' && <TrendingDown className="h-3 w-3 text-rose-600" />}
          <Text className={`text-xs font-medium ${
            status === 'complies' ? 'text-emerald-600' :
            status === 'alert' ? 'text-yellow-600' : 'text-rose-600'
          }`}>
            {getStatusText(status)}
          </Text>
        </Flex>

        {onUpdate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onUpdate(id)}
          >
            Actualizar
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </Flex>
    </Card>
  );
}

// Versión compacta para listas
export function TremorKpiCardCompact({
  id,
  name,
  value,
  target,
  unit = "",
  status,
  compliancePercentage,
  previousValue,
  onViewDetails,
  onUpdate,
}: Omit<TremorKpiCardProps, 'historicalData' | 'frequency'>) {
  // Calcular variación
  const currentNum = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  const prevNum = previousValue ?? null;

  let deltaValue: string | null = null;
  let deltaType: DeltaType = "unchanged";

  if (prevNum !== null && prevNum !== 0 && !isNaN(currentNum)) {
    const change = ((currentNum - prevNum) / prevNum) * 100;
    deltaValue = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    deltaType = getDeltaType(change);
  }

  const displayValue = typeof value === 'number'
    ? value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    : value;

  return (
    <Card
      className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      onClick={() => onViewDetails?.(id)}
    >
      <Grid numItems={4} className="gap-4">
        <Col numColSpan={1}>
          <Text className="truncate font-medium text-sm">{name}</Text>
          <Text className={`text-xs font-medium ${
            status === 'complies' ? 'text-emerald-600' :
            status === 'alert' ? 'text-yellow-600' : 'text-rose-600'
          }`}>
            {getStatusText(status)}
          </Text>
        </Col>

        <Col numColSpan={1}>
          <Text className="text-xs text-gray-500">Valor Actual</Text>
          <Flex alignItems="baseline" className="space-x-1">
            <Bold>{displayValue}</Bold>
            {unit && <Text className="text-xs text-gray-500">{unit}</Text>}
          </Flex>
        </Col>

        <Col numColSpan={1}>
          <Text className="text-xs text-gray-500">Meta</Text>
          <Flex alignItems="baseline" className="space-x-1">
            <Bold>{target}</Bold>
            {unit && <Text className="text-xs text-gray-500">{unit}</Text>}
          </Flex>
        </Col>

        <Col numColSpan={1}>
          <Text className="text-xs text-gray-500">Cumplimiento</Text>
          <Flex alignItems="center" className="space-x-2">
            <ProgressBar
              value={Math.min(compliancePercentage, 100)}
              color={getProgressColor(status)}
              className="w-20"
            />
            <Flex alignItems="center" className="space-x-1">
              <Bold className={
                status === 'complies' ? 'text-emerald-600' :
                status === 'alert' ? 'text-yellow-600' : 'text-rose-600'
              }>
                {compliancePercentage.toFixed(1)}%
              </Bold>
              {deltaValue && (
                <BadgeDelta deltaType={deltaType} size="xs">
                  {deltaValue}
                </BadgeDelta>
              )}
            </Flex>
          </Flex>
        </Col>
      </Grid>
    </Card>
  );
}

export default TremorKpiCard;
