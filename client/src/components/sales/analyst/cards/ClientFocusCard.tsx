/**
 * Card reutilizable para mostrar información de un cliente a enfocar
 */

import { useMemo } from "react";
import { Calendar, TrendingDown, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/sales-utils";
import type { ClientFocus } from "@shared/sales-analyst-types";

interface ClientFocusCardProps {
  client: ClientFocus;
  companyId: number;
}

export function ClientFocusCard({ client, companyId }: ClientFocusCardProps) {
  const priorityConfig = useMemo(() => {
    switch (client.priority) {
      case 'dormant':
        return {
          border: 'border-purple-200',
          bg: 'bg-purple-50/50',
          badge: 'secondary',
          icon: AlertCircle,
          iconColor: 'text-purple-600',
          label: 'Dormido'
        };
      case 'critical':
        return {
          border: 'border-red-200',
          bg: 'bg-red-50/50',
          badge: 'destructive',
          icon: AlertCircle,
          iconColor: 'text-red-600',
          label: 'Critico'
        };
      case 'at-risk':
        return {
          border: 'border-amber-200',
          bg: 'bg-amber-50/50',
          badge: 'secondary',
          icon: AlertCircle,
          iconColor: 'text-amber-600',
          label: 'En Riesgo'
        };
      case 'opportunity':
        return {
          border: 'border-emerald-200',
          bg: 'bg-emerald-50/50',
          badge: 'default',
          icon: TrendingUp,
          iconColor: 'text-emerald-600',
          label: 'Oportunidad'
        };
    }
  }, [client.priority]);

  const Icon = priorityConfig?.icon ?? AlertCircle;
  const isPositive = client.yoyChange > 0;

  return (
    <Card className={cn("border-2 transition-all hover:shadow-md", priorityConfig?.border, priorityConfig?.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn("h-4 w-4 flex-shrink-0", priorityConfig?.iconColor)} />
              <h4 className="font-semibold text-sm truncate">{client.name}</h4>
              <Badge variant={(priorityConfig?.badge ?? 'default') as any} className="text-xs">
                {priorityConfig?.label ?? client.priority}
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {client.daysSincePurchase > 0 
                    ? `${client.daysSincePurchase} días sin compra`
                    : 'Compra reciente'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={cn(
                  "font-medium",
                  isPositive ? "text-emerald-600" : "text-red-600"
                )}>
                  {isPositive ? '+' : ''}{client.yoyChange.toFixed(1)}% vs año anterior
                </span>
              </div>

              <div className="pt-1 border-t border-border/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue histórico:</span>
                  <span className="font-medium">{formatCurrency(client.previousYearRevenue, companyId)}</span>
                </div>
                {client.currentYearRevenue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue actual:</span>
                    <span className="font-medium">{formatCurrency(client.currentYearRevenue, companyId)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold text-white",
              client.priority === 'dormant' ? "bg-purple-500" :
              client.priority === 'critical' ? "bg-red-500" :
              client.priority === 'at-risk' ? "bg-amber-500" :
              "bg-emerald-500"
            )}>
              {client.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {client.recommendedActions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Acciones recomendadas:</p>
            <ul className="text-xs space-y-1.5">
              {client.recommendedActions.slice(0, 2).map((action, idx) => {
                const isUrgent = action.includes('URGENTE') || action.includes('URGENT');
                const isHigh = action.includes('ALTA') || action.includes('HIGH');
                return (
                  <li key={idx} className={cn(
                    "flex items-start gap-2 p-1.5 rounded",
                    isUrgent ? "bg-red-50 border border-red-200" :
                    isHigh ? "bg-amber-50 border border-amber-200" :
                    "bg-slate-50"
                  )}>
                    <span className={cn(
                      "font-semibold mt-0.5 flex-shrink-0",
                      isUrgent ? "text-red-600" :
                      isHigh ? "text-amber-600" :
                      "text-primary"
                    )}>•</span>
                    <span className={cn(
                      "flex-1",
                      isUrgent ? "text-red-900" :
                      isHigh ? "text-amber-900" :
                      "text-slate-700"
                    )}>{action}</span>
                  </li>
                );
              })}
            </ul>
            {client.recommendedActions.length > 2 && (
              <p className="text-xs text-muted-foreground mt-1.5 italic">
                +{client.recommendedActions.length - 2} acción(es) adicional(es)
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

