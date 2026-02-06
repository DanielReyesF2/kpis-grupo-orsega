/**
 * Client Efficiency Card - Comparativa de eficiencia operativa de clientes
 * Replica la sección "Comparativa Clientes - Eficiencia Operativa" del análisis Nova
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientEfficiencyCardProps {
  companyId: number;
  year: number;
  month: number;
}

const ratingConfig = {
  high: { label: 'Alta', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  low: { label: 'Baja', className: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' },
};

export function ClientEfficiencyCard({ companyId, year, month }: ClientEfficiencyCardProps) {
  const { data, isLoading } = useMonthlyFinancial(companyId, year, month);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  type ClientEff = { name: string; avgSaleValue: number; avgVolume: number; avgMargin: number; transactions: number; totalRevenue: number; efficiencyRating: 'high' | 'medium' | 'low' };
  const clients: ClientEff[] = data?.clientEfficiency || [];
  const topClients = clients.slice(0, 10);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Eficiencia Operativa
          </CardTitle>
          <Badge variant="outline" className="text-xs">Top {topClients.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {topClients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos de eficiencia</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-2">Cliente</th>
                  <th className="text-right py-2 pr-2">Vta Prom</th>
                  <th className="text-right py-2 pr-2">Vol Prom</th>
                  <th className="text-right py-2 pr-2">Margen</th>
                  <th className="text-right py-2">Eficiencia</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((client, idx) => {
                  const rc = ratingConfig[client.efficiencyRating];
                  return (
                    <tr key={client.name || idx} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-2 font-medium truncate max-w-[150px]">{client.name}</td>
                      <td className="py-2 pr-2 text-right text-muted-foreground">
                        {formatCurrency(client.avgSaleValue, companyId)}
                      </td>
                      <td className="py-2 pr-2 text-right text-muted-foreground">
                        {formatNumber(Math.round(client.avgVolume))}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <span className={cn(
                          "font-semibold",
                          client.avgMargin > 0 ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          {client.avgMargin > 0 ? `${client.avgMargin.toFixed(1)}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Badge variant="outline" className={cn("text-xs", rc.className)}>
                          {rc.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
