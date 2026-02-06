/**
 * Client Analysis Card - Tabla de clientes con ranking y análisis de concentración
 * Replica la sección "Análisis de Clientes" del análisis Nova
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientAnalysisCardProps {
  companyId: number;
  year: number;
  month: number;
}

export function ClientAnalysisCard({ companyId, year, month }: ClientAnalysisCardProps) {
  const { data: topClients, isLoading } = useQuery({
    queryKey: ["/api/sales-top-clients", companyId, "month", 10],
    queryFn: async () => {
      const res = await apiRequest("GET",
        `/api/sales-top-clients?companyId=${companyId}&period=month&limit=10&sortBy=revenue`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-72 w-full" /></CardContent>
      </Card>
    );
  }

  const clients = (topClients || []).slice(0, 10);
  const totalRevenue = clients.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0);

  // Concentration analysis
  const top4Revenue = clients.slice(0, 4).reduce((sum: number, c: any) => sum + (c.revenue || 0), 0);
  const top4Pct = totalRevenue > 0 ? (top4Revenue / totalRevenue) * 100 : 0;
  const top1Pct = totalRevenue > 0 && clients[0] ? (clients[0].revenue / totalRevenue) * 100 : 0;

  const concentrationLevel = top1Pct >= 40 ? 'critical' : top4Pct >= 60 ? 'high' : top4Pct >= 40 ? 'medium' : 'low';
  const concentrationColor = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    high: 'text-amber-600 bg-amber-50 border-amber-200',
    medium: 'text-blue-600 bg-blue-50 border-blue-200',
    low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  }[concentrationLevel];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Análisis de Clientes
          </CardTitle>
          <Badge variant="outline" className="text-xs">{clients.length} clientes</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos de clientes</p>
        ) : (
          <>
            {/* Client table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-2">#</th>
                    <th className="text-left py-2 pr-2">Cliente</th>
                    <th className="text-right py-2 pr-2">Txns</th>
                    <th className="text-right py-2 pr-2">Venta</th>
                    <th className="text-right py-2">% Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client: any, idx: number) => {
                    const pct = totalRevenue > 0 ? ((client.revenue || 0) / totalRevenue) * 100 : 0;
                    return (
                      <tr key={client.name || idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 pr-2 text-muted-foreground font-medium">{idx + 1}</td>
                        <td className="py-2 pr-2 font-medium truncate max-w-[200px]">{client.name}</td>
                        <td className="py-2 pr-2 text-right text-muted-foreground">{client.transactions || 0}</td>
                        <td className="py-2 pr-2 text-right font-semibold">
                          {formatCurrency(client.revenue || 0, companyId)}
                        </td>
                        <td className="py-2 text-right">
                          <Badge variant="outline" className="text-xs">{pct.toFixed(1)}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Concentration analysis */}
            <div className={cn("p-3 rounded-lg border", concentrationColor)}>
              <div className="flex items-start gap-2">
                {concentrationLevel === 'critical' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Concentración: Top 4 = {top4Pct.toFixed(1)}% de ventas
                  </p>
                  {clients[0] && (
                    <p className="text-xs">
                      Mayor cliente: <span className="font-medium">{clients[0].name}</span> ({top1Pct.toFixed(1)}%)
                      {top1Pct >= 40 && " — Dependencia crítica"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
