/**
 * Monthly Top Lists - Top 5 clientes y productos del mes
 * Se divide en dos exports: MonthlyTopClientsCard y MonthlyTopProductsCard
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { Users, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5, 280 65% 60%))",
];

interface TopCardProps {
  companyId: number;
}

export function MonthlyTopClientsCard({ companyId }: TopCardProps) {
  const { data: topClients, isLoading } = useQuery({
    queryKey: ["/api/sales-top-clients", companyId, "month"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-top-clients?companyId=${companyId}&period=month&limit=5&sortBy=revenue`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const clients = (topClients || []).slice(0, 5);
  const maxRevenue = clients.length > 0 ? Math.max(...clients.map((c: any) => c.revenue || 0)) : 1;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Top Clientes del Mes
          </CardTitle>
          <Badge variant="outline" className="text-xs">Por revenue</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin datos para el mes actual
          </p>
        ) : (
          <div className="space-y-3">
            {clients.map((client: any, idx: number) => {
              const widthPercent = maxRevenue > 0 ? ((client.revenue || 0) / maxRevenue) * 100 : 0;
              return (
                <div key={client.name || idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[60%]">
                      {idx + 1}. {client.name}
                    </span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(client.revenue || 0, companyId)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: COLORS[idx % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MonthlyTopProductsCard({ companyId }: TopCardProps) {
  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["/api/sales-top-products", companyId, "month"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-top-products?companyId=${companyId}&period=month&limit=5`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const products = (topProducts || []).slice(0, 5);
  const totalVolume = products.reduce((sum: number, p: any) => sum + (p.volume || 0), 0);

  const pieData = products.map((product: any, idx: number) => ({
    name: product.name,
    value: product.volume || 0,
    color: COLORS[idx % COLORS.length],
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Top Productos del Mes
          </CardTitle>
          <Badge variant="outline" className="text-xs">Por volumen</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin datos para el mes actual
          </p>
        ) : (
          <div className="space-y-4">
            {/* Donut Chart */}
            <div className="h-40 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {pieData.map((product: any, idx: number) => {
                const pct = totalVolume > 0 ? ((product.value / totalVolume) * 100).toFixed(1) : "0";
                return (
                  <div key={product.name || idx} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: product.color }}
                      />
                      <span className="text-sm truncate max-w-[150px]">{product.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatNumber(product.value)}</span>
                      <Badge variant="outline" className="text-xs">{pct}%</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
