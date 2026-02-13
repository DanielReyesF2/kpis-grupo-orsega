/**
 * Risk Alerts Card - Resumen de riesgo de churn y clientes en peligro
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { formatCurrency } from "@/lib/sales-utils";
import { AlertTriangle, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskAlertsCardProps {
  companyId: number;
}

export function RiskAlertsCard({ companyId }: RiskAlertsCardProps) {
  const { data: insights, isLoading } = useSalesAnalyst(companyId);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const churnRisk = insights?.riskAnalysis?.churnRisk ?? 0;
  const revenueAtRisk = insights?.riskAnalysis?.revenueAtRisk ?? 0;
  const criticalCount = insights?.focusClients?.critical?.length ?? 0;
  const warningCount = insights?.focusClients?.warning?.length ?? 0;
  const opportunityCount = insights?.focusClients?.opportunities?.length ?? 0;

  // Color based on risk level
  const riskColor = churnRisk >= 70 ? "text-red-600" : churnRisk >= 40 ? "text-amber-600" : "text-emerald-600";
  const riskBg = churnRisk >= 70 ? "bg-red-500" : churnRisk >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const riskLabel = churnRisk >= 70 ? "Alto" : churnRisk >= 40 ? "Medio" : "Bajo";

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Alertas de Riesgo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Churn Risk Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Riesgo de Churn</span>
            <div className="flex items-center gap-2">
              <span className={cn("text-2xl font-bold", riskColor)}>{churnRisk.toFixed(1)}%</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  churnRisk >= 70 ? "border-red-300 text-red-700 bg-red-50" :
                  churnRisk >= 40 ? "border-amber-300 text-amber-700 bg-amber-50" :
                  "border-emerald-300 text-emerald-700 bg-emerald-50"
                )}
              >
                {riskLabel}
              </Badge>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", riskBg)}
              style={{ width: `${Math.min(churnRisk, 100)}%` }}
            />
          </div>
        </div>

        {/* Revenue at Risk */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium">Revenue en riesgo</span>
          </div>
          <span className="text-sm font-bold text-red-600 dark:text-red-400">
            {formatCurrency(revenueAtRisk, companyId)}
          </span>
        </div>

        {/* Client Counts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-sm">Clientes críticos</span>
            </div>
            <Badge variant="destructive" className="text-xs">
              {criticalCount}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-sm">En seguimiento</span>
            </div>
            <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
              {warningCount}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm">Oportunidades</span>
            </div>
            <Badge className="text-xs bg-emerald-500 hover:bg-emerald-600">
              {opportunityCount}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
