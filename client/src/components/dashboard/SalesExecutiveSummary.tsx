/**
 * Resumen Ejecutivo de Ventas
 * Muestra un resumen conciso con datos reales de /api/sales-stats
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Users,
  ArrowRight,
  Lightbulb,
  UserPlus,
  UserMinus
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SalesMetrics {
  activeClients: number;
  currentVolume: number;
  unit: string;
  growth: number;
  activeAlerts: number;
  activeClientsMetrics?: {
    thisMonth: number;
    last3Months: number;
  };
  retentionRate?: {
    rate: number;
    retainedClients: number;
  };
  newClients?: {
    count: number;
  };
  clientChurn?: {
    count: number;
    rate: number;
  };
}

interface SalesExecutiveSummaryProps {
  companyId: number; // 1 = DURA, 2 = ORSEGA
}

export function SalesExecutiveSummary({ companyId }: SalesExecutiveSummaryProps) {
  const { data: metrics, isLoading } = useQuery<SalesMetrics>({
    queryKey: ['/api/sales-stats', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const isDura = companyId === 1;
  const isPositive = (metrics?.growth || 0) >= 0;
  const formatNumber = (num: number) => new Intl.NumberFormat('es-MX').format(num);

  if (isLoading) {
    return (
      <Card className="shadow-lg border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calcular accion prioritaria basada en datos reales
  const getAccionPrioritaria = () => {
    if (!metrics) return { accion: "Cargar datos de ventas", oportunidad: "Sin datos suficientes" };

    const churnCount = metrics.clientChurn?.count || 0;
    const newCount = metrics.newClients?.count || 0;
    const retentionRate = metrics.retentionRate?.rate || 0;

    if (churnCount > newCount) {
      return {
        accion: `Analizar ${churnCount} clientes perdidos`,
        oportunidad: `Implementar programa de reactivacion para recuperar volumen`
      };
    } else if (retentionRate < 80) {
      return {
        accion: `Mejorar retencion (${retentionRate.toFixed(0)}%)`,
        oportunidad: "Fortalecer relacion con clientes clave"
      };
    } else if (isPositive) {
      return {
        accion: "Mantener momentum de crecimiento",
        oportunidad: `Capitalizar ${metrics.growth.toFixed(1)}% de crecimiento`
      };
    } else {
      return {
        accion: "Revisar estrategia comercial",
        oportunidad: "Identificar areas de mejora para revertir tendencia"
      };
    }
  };

  const accion = getAccionPrioritaria();

  return (
    <Card className="shadow-lg border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {isPositive ? (
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Resumen Ejecutivo - {isDura ? 'DURA International' : 'Grupo ORSEGA'}</CardTitle>
              <p className="text-sm text-muted-foreground">Datos en tiempo real de sales_data</p>
            </div>
          </div>
          <Badge variant={isPositive ? "default" : "destructive"} className="text-sm px-3 py-1">
            {isPositive ? (
              <><CheckCircle2 className="h-4 w-4 mr-1" /> En Crecimiento</>
            ) : (
              <><AlertTriangle className="h-4 w-4 mr-1" /> Requiere Atencion</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Columna 1: Situacion Actual */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Target className="h-4 w-4" /> Situacion Actual
            </h4>
            <div className={`p-3 rounded-lg ${isPositive ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{metrics?.growth?.toFixed(1) || 0}%
                </span>
                <span className="text-sm text-muted-foreground">vs año anterior</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatNumber(metrics?.currentVolume || 0)} {metrics?.unit || 'unidades'} este mes
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-blue-500" />
              <span><strong>{metrics?.activeClients || 0}</strong> clientes activos este mes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                <strong>{metrics?.activeClientsMetrics?.last3Months || 0}</strong> clientes ultimos 3 meses
              </span>
            </div>
          </div>

          {/* Columna 2: Clientes */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4" /> Dinamica de Clientes
            </h4>
            <div className="p-3 rounded-lg border border-border">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-bold text-lg text-green-600">{metrics?.newClients?.count || 0}</p>
                    <p className="text-xs text-muted-foreground">Nuevos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserMinus className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-bold text-lg text-red-600">{metrics?.clientChurn?.count || 0}</p>
                    <p className="text-xs text-muted-foreground">Perdidos</p>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Retencion:</span>
                  <span className={`font-bold ${(metrics?.retentionRate?.rate || 0) >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                    {metrics?.retentionRate?.rate?.toFixed(0) || 0}%
                  </span>
                </div>
              </div>
            </div>
            {(metrics?.activeAlerts || 0) > 0 && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{metrics?.activeAlerts} alertas activas</span>
              </div>
            )}
          </div>

          {/* Columna 3: Accion Recomendada */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Lightbulb className="h-4 w-4" /> Accion Prioritaria
            </h4>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">{accion.accion}</p>
                  <p className="text-xs text-muted-foreground mt-1">{accion.oportunidad}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Basado en datos reales de ventas
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
