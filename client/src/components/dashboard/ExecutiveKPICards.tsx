/**
 * Executive KPI Cards - Tarjetas premium de métricas ejecutivas
 * Diseño moderno con gradientes, animaciones y badges informativos
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SalesMetrics } from "@shared/sales-types";
import { cn } from "@/lib/utils";

interface ExecutiveKPICardsProps {
  companyId: number;
}

interface KPI {
  id: number;
  name: string;
  annualGoal?: string | number;
  target?: string | number;
}

export function ExecutiveKPICards({ companyId }: ExecutiveKPICardsProps) {
  // Fetch sales metrics
  const { data: salesMetrics, isLoading: isLoadingMetrics } = useQuery<SalesMetrics>({
    queryKey: ["/api/sales-stats", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch KPIs to get annual goal
  const { data: kpis } = useQuery<KPI[]>({
    queryKey: ["/api/kpis", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kpis?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch monthly trends to get current month vs previous month
  const { data: monthlyTrends } = useQuery({
    queryKey: ["/api/sales-monthly-trends", companyId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/sales-monthly-trends?companyId=${companyId}&months=12`
      );
      return await res.json();
    },
    staleTime: 60000,
  });

  // Find sales KPI to get annual goal
  const salesKpi = kpis?.find((kpi) => {
    const name = (kpi.name || "").toLowerCase();
    return (
      name.includes("volumen") ||
      name.includes("ventas") ||
      name.includes("sales")
    );
  });

  const annualGoal = salesKpi?.annualGoal
    ? parseFloat(String(salesKpi.annualGoal).replace(/[^0-9.-]+/g, ""))
    : companyId === 1
      ? 667449
      : 10300476;

  // Calculate current year total from monthly trends
  const currentYearTotal =
    monthlyTrends?.reduce((sum: number, month: any) => sum + (month.totalQty || 0), 0) || 0;

  // Get current month and previous month
  const currentMonth = monthlyTrends?.[monthlyTrends.length - 1];
  const previousMonth = monthlyTrends?.[monthlyTrends.length - 2];
  const currentMonthVolume = currentMonth?.totalQty || 0;
  const previousMonthVolume = previousMonth?.totalQty || 0;
  const monthGrowth =
    previousMonthVolume > 0
      ? ((currentMonthVolume - previousMonthVolume) / previousMonthVolume) * 100
      : 0;

  // Calculate year progress
  const yearProgress = annualGoal > 0 ? (currentYearTotal / annualGoal) * 100 : 0;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString("es-MX", { maximumFractionDigits: 0 });
  };

  const unit = companyId === 1 ? "KG" : "unidades";
  const companyColor = companyId === 1 ? "green" : "purple";

  if (isLoadingMetrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-xl">
            <CardContent className="p-6">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpiCards = [
    {
      id: 1,
      title: "Ventas Totales Año",
      value: formatNumber(currentYearTotal),
      unit: unit,
      subtitle: `vs objetivo anual`,
      badge: {
        value: `${yearProgress.toFixed(0)}%`,
        variant:
          yearProgress >= 100
            ? "default"
            : yearProgress >= 75
              ? "secondary"
              : "destructive",
      },
      icon: DollarSign,
      gradient: companyId === 1
        ? "from-green-50 to-emerald-100/50 dark:from-green-950/20 dark:to-emerald-900/10"
        : "from-purple-50 to-violet-100/50 dark:from-purple-950/20 dark:to-violet-900/10",
      borderColor: companyId === 1 ? "border-green-500" : "border-purple-500",
      iconColor: companyId === 1 ? "text-green-600" : "text-purple-600",
      iconBg: companyId === 1
        ? "bg-green-500/20"
        : "bg-purple-500/20",
    },
    {
      id: 2,
      title: "Ventas Mes Actual",
      value: formatNumber(currentMonthVolume),
      unit: unit,
      subtitle: `vs mes anterior`,
      badge: {
        value: `${monthGrowth >= 0 ? "+" : ""}${monthGrowth.toFixed(1)}%`,
        variant: monthGrowth >= 0 ? "default" : "destructive",
        icon: monthGrowth >= 0 ? ArrowUp : ArrowDown,
      },
      icon: Calendar,
      gradient: "from-blue-50 to-cyan-100/50 dark:from-blue-950/20 dark:to-cyan-900/10",
      borderColor: "border-blue-500",
      iconColor: "text-blue-600",
      iconBg: "bg-blue-500/20",
    },
    {
      id: 3,
      title: "Crecimiento YoY",
      value: `${salesMetrics?.growth >= 0 ? "+" : ""}${salesMetrics?.growth?.toFixed(1) || 0}%`,
      unit: "",
      subtitle: `vs año anterior`,
      badge: null,
      icon: salesMetrics?.growth >= 0 ? TrendingUp : TrendingDown,
      gradient: salesMetrics?.growth >= 0
        ? "from-emerald-50 to-green-100/50 dark:from-emerald-950/20 dark:to-green-900/10"
        : "from-red-50 to-rose-100/50 dark:from-red-950/20 dark:to-rose-900/10",
      borderColor: salesMetrics?.growth >= 0 ? "border-emerald-500" : "border-red-500",
      iconColor: salesMetrics?.growth >= 0 ? "text-emerald-600" : "text-red-600",
      iconBg: salesMetrics?.growth >= 0 ? "bg-emerald-500/20" : "bg-red-500/20",
    },
    {
      id: 4,
      title: "Clientes Activos",
      value: salesMetrics?.activeClientsMetrics?.thisMonth || 0,
      unit: "",
      subtitle: `últimos 3 meses: ${salesMetrics?.activeClientsMetrics?.last3Months || 0}`,
      badge: null,
      icon: Users,
      gradient: "from-amber-50 to-orange-100/50 dark:from-amber-950/20 dark:to-orange-900/10",
      borderColor: "border-amber-500",
      iconColor: "text-amber-600",
      iconBg: "bg-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -4 }}
          >
            <Card
              className={cn(
                "relative overflow-hidden rounded-xl border-2 shadow-md hover:shadow-xl transition-all duration-300",
                `bg-gradient-to-br ${kpi.gradient}`,
                kpi.borderColor
              )}
            >
              {/* Borde superior de acento */}
              <div className={cn("absolute top-0 left-0 right-0 h-1", kpi.borderColor.replace("border-", "bg-"))} />

              {/* Icono grande con blur */}
              <div className={cn("absolute top-4 right-4 w-16 h-16 rounded-full backdrop-blur-sm flex items-center justify-center", kpi.iconBg)}>
                <Icon className={cn("w-8 h-8", kpi.iconColor)} />
              </div>

              <CardContent className="p-6 pt-8">
                <p className="text-sm text-muted-foreground mb-2 font-medium">{kpi.title}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-4xl font-bold text-foreground">{kpi.value}</p>
                  {kpi.unit && (
                    <span className="text-sm text-muted-foreground font-medium">{kpi.unit}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{kpi.subtitle}</p>
                {kpi.badge && (
                  <Badge
                    variant={kpi.badge.variant as any}
                    className="flex items-center gap-1 w-fit"
                  >
                    {kpi.badge.icon && <kpi.badge.icon className="h-3 w-3" />}
                    {kpi.badge.value}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

