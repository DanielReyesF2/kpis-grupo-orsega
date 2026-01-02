/**
 * Order Stats Card - Similar a Order Stats
 * Muestra donut chart con estadísticas de órdenes
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

interface OrderStatsCardProps {
  companyId: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}

export function OrderStatsCard({ companyId }: OrderStatsCardProps) {
  const { data: salesMetrics, isLoading } = useQuery({
    queryKey: ["/api/sales-stats", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Simular datos de órdenes (en producción vendría de un endpoint real)
  const totalTransactions = salesMetrics?.avgOrderValue ? Math.round(salesMetrics.currentVolume / (salesMetrics.avgOrderValue || 1)) : 0;
  const completedOrders = Math.round(totalTransactions * 0.85);
  const processingOrders = Math.round(totalTransactions * 0.12);
  const cancelledOrders = Math.round(totalTransactions * 0.03);

  const orderData = [
    { name: "Completadas", value: completedOrders, color: "hsl(var(--chart-1))", icon: CheckCircle2 },
    { name: "En Proceso", value: processingOrders, color: "hsl(var(--chart-2))", icon: Clock },
    { name: "Canceladas", value: cancelledOrders, color: "hsl(var(--chart-4))", icon: XCircle },
  ];

  const totalOrders = completedOrders + processingOrders + cancelledOrders;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Productos Vendidos</CardTitle>
          <Badge variant="outline" className="text-xs">Anual</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Donut Chart */}
        <div className="h-48 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={productData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {productData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatNumber(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Leyenda y datos */}
        <div className="space-y-2">
          {productData.map((product, index) => {
            const percentage = totalVolume > 0 ? (product.value / totalVolume) * 100 : 0;

            return (
              <motion.div
                key={product.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: product.color }}
                  />
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate flex-1">{product.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatNumber(product.value)}</span>
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                  >
                    {percentage.toFixed(1)}%
                  </Badge>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

