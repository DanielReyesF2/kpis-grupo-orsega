/**
 * Product Profitability Card - Productos con mayor y menor utilidad
 * Muestra eficiencia operativa basada en márgenes reales de la BD
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientEfficiencyCardProps {
  companyId: number;
  year: number;
  month: number;
}

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

  type FamilyData = { family: string; transactions: number; quantity: number; revenue: number; percentOfSales: number; avgMargin: number };
  const families: FamilyData[] = data?.productsByFamily || [];

  // Also use clientEfficiency if available
  type ClientEff = { name: string; avgSaleValue: number; avgVolume: number; avgMargin: number; transactions: number; totalRevenue: number; efficiencyRating: 'high' | 'medium' | 'low' };
  const clients: ClientEff[] = data?.clientEfficiency || [];

  // Sort families by margin to find best/worst
  const withMargin = families.filter(f => f.avgMargin !== 0 && f.revenue > 0);
  const sortedByMargin = [...withMargin].sort((a, b) => b.avgMargin - a.avgMargin);
  const bestMargin = sortedByMargin.slice(0, 3);
  const worstMargin = sortedByMargin.slice(-3).reverse();

  const hasProductData = families.length > 0;
  const hasClientData = clients.length > 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Eficiencia Operativa
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {families.length} familias / {clients.length} clientes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasProductData && !hasClientData ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos de eficiencia</p>
        ) : (
          <>
            {/* Product margins section */}
            {hasProductData && bestMargin.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  Mayor Utilidad (Familia)
                </div>
                <div className="space-y-1">
                  {bestMargin.map((f, idx) => (
                    <div key={f.family || idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30">
                      <span className="text-sm font-medium truncate max-w-[180px]">{f.family}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(f.revenue, companyId)}
                        </span>
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          {f.avgMargin > 0 ? `+${f.avgMargin.toFixed(1)}%` : `${f.avgMargin.toFixed(1)}%`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasProductData && worstMargin.length > 0 && worstMargin[0]?.family !== bestMargin[bestMargin.length - 1]?.family && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                  Menor Utilidad (Familia)
                </div>
                <div className="space-y-1">
                  {worstMargin.map((f, idx) => (
                    <div key={f.family || idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30">
                      <span className="text-sm font-medium truncate max-w-[180px]">{f.family}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(f.revenue, companyId)}
                        </span>
                        <Badge variant="outline" className={cn("text-xs",
                          f.avgMargin < 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {f.avgMargin > 0 ? `+${f.avgMargin.toFixed(1)}%` : `${f.avgMargin.toFixed(1)}%`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client efficiency section */}
            {hasClientData && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Top Clientes por Margen</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-1.5 pr-2">Cliente</th>
                        <th className="text-right py-1.5 pr-2">Vta Prom</th>
                        <th className="text-right py-1.5">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.slice(0, 5).map((client, idx) => (
                        <tr key={client.name || idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-1.5 pr-2 font-medium truncate max-w-[140px]">{client.name}</td>
                          <td className="py-1.5 pr-2 text-right text-muted-foreground text-xs">
                            {formatCurrency(client.avgSaleValue, companyId)}
                          </td>
                          <td className="py-1.5 text-right">
                            <span className={cn("text-xs font-semibold",
                              client.avgMargin > 0 ? "text-emerald-600" : "text-muted-foreground"
                            )}>
                              {client.avgMargin > 0 ? `${client.avgMargin.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
