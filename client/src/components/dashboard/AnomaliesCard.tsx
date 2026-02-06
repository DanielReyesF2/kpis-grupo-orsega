/**
 * Anomalies Card - Transacciones canceladas y datos anómalos
 * Replica la sección "Anomalías y Datos" del análisis Nova
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { formatCurrency } from "@/lib/sales-utils";
import { AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";

interface AnomaliesCardProps {
  companyId: number;
  year: number;
  month: number;
}

export function AnomaliesCard({ companyId, year, month }: AnomaliesCardProps) {
  const { data, isLoading } = useMonthlyFinancial(companyId, year, month);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const anomalies: { cancelledTransactions: number; cancelledAmount: number } | undefined = data?.anomalies;
  const hasCancelled = anomalies && anomalies.cancelledTransactions > 0;
  const monthName: string = (data as any)?.monthName || 'este mes';
  const financialMetrics: { totalTransactions: number; totalItems: number; totalRevenueMXN: number } | undefined = (data as any)?.financialMetrics;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Anomalías
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cancelled transactions */}
        {hasCancelled ? (
          <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 space-y-2">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Transacciones Canceladas</span>
            </div>
            <div className="flex items-center justify-between pl-6">
              <span className="text-sm text-muted-foreground">Cantidad</span>
              <Badge variant="destructive" className="text-xs">
                {anomalies!.cancelledTransactions}
              </Badge>
            </div>
            <div className="flex items-center justify-between pl-6">
              <span className="text-sm text-muted-foreground">Monto total</span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                {formatCurrency(anomalies!.cancelledAmount, companyId)}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Sin cancelaciones
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 pl-6">
              No se detectaron transacciones canceladas en {monthName}
            </p>
          </div>
        )}

        {/* Summary stats */}
        <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Resumen del Mes</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Transacciones válidas</span>
            <span className="text-sm font-semibold">
              {financialMetrics?.totalTransactions || 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Líneas de detalle</span>
            <span className="text-sm font-semibold">
              {financialMetrics?.totalItems || 0}
            </span>
          </div>
          {hasCancelled && (
            <div className="flex items-center justify-between">
              <span className="text-sm">% Cancelado (monto)</span>
              <span className="text-sm font-semibold text-red-600">
                {financialMetrics?.totalRevenueMXN && financialMetrics.totalRevenueMXN > 0
                  ? ((anomalies!.cancelledAmount / (financialMetrics.totalRevenueMXN + anomalies!.cancelledAmount)) * 100).toFixed(1)
                  : '0'}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
