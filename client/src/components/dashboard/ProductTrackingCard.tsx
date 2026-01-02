/**
 * Product Tracking Card - Similar a Product Tracking
 * Muestra actualizaciones recientes y gráfico de línea
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { ShoppingCart, Package, Truck, Box } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ProductTrackingCardProps {
  companyId: number;
}

export function ProductTrackingCard({ companyId }: ProductTrackingCardProps) {
  const { data: monthlyTrends, isLoading } = useQuery({
    queryKey: ["/api/sales-monthly-trends", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-monthly-trends?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Simular actualizaciones recientes
  const updates = [
    {
      icon: ShoppingCart,
      text: "Tiene 5 órdenes pendientes. Entregado",
      date: "Nov 02",
      time: "Hace 6 horas",
    },
    {
      icon: Package,
      text: "Nueva orden recibida. Recogida",
      date: "Nov 03",
      time: "Hace 1 día",
    },
    {
      icon: Truck,
      text: "Gerente publicó. En tránsito",
      date: "Nov 03",
      time: "Ayer",
    },
    {
      icon: Box,
      text: "Tiene 1 orden pendiente. Hace 2 horas",
      date: "Nov 04",
      time: "Hace 6 horas",
    },
  ];

  // Preparar datos para gráfico de línea
  const chartData = monthlyTrends?.slice(0, 5).map((month: any) => ({
    month: month.month,
    value: month.volume || 0,
  })) || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Seguimiento de Productos</CardTitle>
          <Badge variant="outline" className="text-xs">Ver Todo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de actualizaciones */}
        <div className="space-y-3">
          {updates.map((update, index) => {
            const Icon = update.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{update.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{update.date}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{update.time}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Gráfico de línea */}
        <div className="h-32 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                hide
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

