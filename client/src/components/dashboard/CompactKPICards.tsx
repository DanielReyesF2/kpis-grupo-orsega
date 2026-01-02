/**
 * Compact KPI Cards - Tarjetas compactas de métricas principales
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { Users, TrendingUp, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactKPICardsProps {
  companyId: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}

export function CompactKPICards({ companyId }: CompactKPICardsProps) {
  const { data: salesMetrics, isLoading } = useQuery({
    queryKey: ["/api/sales-stats", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: profitabilityData } = useQuery({
    queryKey: ["/api/profitability-metrics", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/profitability-metrics?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const profitability = profitabilityData?.overallProfitability || salesMetrics?.profitability || 18;

  const kpis = [
    {
      title: "Clientes Activos",
      value: formatNumber(salesMetrics?.activeClients || 0),
      icon: Users,
      color: "bg-blue-500/20 text-blue-600",
    },
    {
      title: "Rentabilidad",
      value: `${profitability.toFixed(1)}%`,
      icon: Percent,
      color: "bg-emerald-500/20 text-emerald-600",
    },
    {
      title: "Crecimiento",
      value: `${salesMetrics?.growth >= 0 ? '+' : ''}${salesMetrics?.growth?.toFixed(1) || 0}%`,
      icon: TrendingUp,
      color: salesMetrics?.growth >= 0 
        ? "bg-emerald-500/20 text-emerald-600" 
        : "bg-red-500/20 text-red-600",
    },
  ];

  return (
    <div className="space-y-3">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">{kpi.title}</p>
                    <p className="text-xl font-bold">{kpi.value}</p>
                  </div>
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

