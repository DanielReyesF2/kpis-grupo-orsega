/**
 * Executive KPI Cards - Tarjetas premium de métricas ejecutivas
 * Diseño moderno mejorado con mejor UX, jerarquía visual y información contextual
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
  AlertTriangle,
  Percent,
  Target,
  Info,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SalesMetrics } from "@shared/sales-types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    monthlyTrends?.reduce((sum: number, month: any) => sum + (month.volume || 0), 0) || 0;

  // Get current month and previous month
  const currentMonth = monthlyTrends?.[monthlyTrends.length - 1];
  const previousMonth = monthlyTrends?.[monthlyTrends.length - 2];
  const currentMonthVolume = currentMonth?.volume || 0;
  const previousMonthVolume = previousMonth?.volume || 0;
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

  if (isLoadingMetrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="rounded-xl border border-border/60">
            <CardContent className="p-5">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Configuración mejorada de tarjetas con mejor UX
  const executiveCards = [
    {
      id: 1,
      title: "Ventas Totales Año",
      value: formatNumber(currentYearTotal),
      unit: unit,
      subtitle: `Objetivo: ${formatNumber(annualGoal)} ${unit}`,
      progress: Math.min(yearProgress, 100),
      progressLabel: `${yearProgress.toFixed(0)}% del objetivo`,
      badge: {
        value: yearProgress >= 100 ? "✅ Cumplido" : yearProgress >= 75 ? "🟡 En curso" : "🔴 Bajo objetivo",
        variant: yearProgress >= 100 ? "default" : yearProgress >= 75 ? "secondary" : "destructive",
      },
      icon: DollarSign,
      iconBg: companyId === 1 
        ? "bg-gradient-to-br from-green-500 to-emerald-600" 
        : "bg-gradient-to-br from-purple-500 to-violet-600",
      cardBg: companyId === 1
        ? "from-green-50/80 via-emerald-50/60 to-transparent dark:from-green-950/30 dark:via-emerald-950/20"
        : "from-purple-50/80 via-violet-50/60 to-transparent dark:from-purple-950/30 dark:via-violet-950/20",
      borderAccent: companyId === 1 ? "border-l-green-500" : "border-l-purple-500",
      tooltip: `Total acumulado del año vs objetivo anual de ${formatNumber(annualGoal)} ${unit}`,
    },
    {
      id: 2,
      title: "Ventas Mes Actual",
      value: formatNumber(currentMonthVolume),
      unit: unit,
      subtitle: `Mes anterior: ${formatNumber(previousMonthVolume)} ${unit}`,
      trend: monthGrowth,
      trendLabel: monthGrowth >= 0 ? `+${monthGrowth.toFixed(1)}%` : `${monthGrowth.toFixed(1)}%`,
      badge: {
        value: monthGrowth >= 0 ? "↑ Creciendo" : "↓ Decreciendo",
        variant: monthGrowth >= 0 ? "default" : "destructive",
        icon: monthGrowth >= 0 ? ArrowUp : ArrowDown,
      },
      icon: Calendar,
      iconBg: "bg-gradient-to-br from-blue-500 to-cyan-600",
      cardBg: "from-blue-50/80 via-cyan-50/60 to-transparent dark:from-blue-950/30 dark:via-cyan-950/20",
      borderAccent: "border-l-blue-500",
      tooltip: `Comparación del mes actual vs mes anterior`,
    },
    {
      id: 3,
      title: "Crecimiento YoY",
      value: `${salesMetrics?.growth >= 0 ? "+" : ""}${salesMetrics?.growth?.toFixed(1) || 0}%`,
      unit: "",
      subtitle: `Comparación año sobre año`,
      trend: salesMetrics?.growth || 0,
      badge: null,
      icon: salesMetrics?.growth >= 0 ? TrendingUp : TrendingDown,
      iconBg: salesMetrics?.growth >= 0
        ? "bg-gradient-to-br from-emerald-500 to-green-600"
        : "bg-gradient-to-br from-red-500 to-rose-600",
      cardBg: salesMetrics?.growth >= 0
        ? "from-emerald-50/80 via-green-50/60 to-transparent dark:from-emerald-950/30 dark:via-green-950/20"
        : "from-red-50/80 via-rose-50/60 to-transparent dark:from-red-950/30 dark:via-rose-950/20",
      borderAccent: salesMetrics?.growth >= 0 ? "border-l-emerald-500" : "border-l-red-500",
      tooltip: `Crecimiento porcentual comparado con el mismo período del año anterior`,
    },
    {
      id: 4,
      title: "Clientes Activos",
      value: salesMetrics?.activeClientsMetrics?.thisMonth || 0,
      unit: "clientes",
      subtitle: `Últimos 3 meses: ${salesMetrics?.activeClientsMetrics?.last3Months || 0} clientes`,
      badge: null,
      icon: Users,
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      cardBg: "from-amber-50/80 via-orange-50/60 to-transparent dark:from-amber-950/30 dark:via-orange-950/20",
      borderAccent: "border-l-amber-500",
      tooltip: `Clientes que realizaron compras este mes vs últimos 3 meses`,
    },
    {
      id: 5,
      title: "Meses Bajo Promedio",
      value: salesMetrics?.monthsBelowAverage?.toString() || "0",
      unit: "de 12 meses",
      subtitle: `Año ${new Date().getFullYear()}`,
      progress: salesMetrics?.monthsBelowAverage 
        ? (salesMetrics.monthsBelowAverage / 12) * 100 
        : 0,
      progressLabel: `${salesMetrics?.monthsBelowAverage || 0} meses bajo el promedio mensual`,
      badge: {
        value: salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 6 
          ? "⚠️ Atención" 
          : salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 3
          ? "🟡 Moderado"
          : "✅ Bueno",
        variant: salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 6
          ? "destructive"
          : salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 3
          ? "secondary"
          : "default",
      },
      icon: AlertTriangle,
      iconBg: salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 6
        ? "bg-gradient-to-br from-red-500 to-rose-600"
        : salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 3
        ? "bg-gradient-to-br from-amber-500 to-orange-600"
        : "bg-gradient-to-br from-emerald-500 to-green-600",
      cardBg: salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 6
        ? "from-red-50/80 via-rose-50/60 to-transparent dark:from-red-950/30 dark:via-rose-950/20"
        : salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 3
        ? "from-amber-50/80 via-orange-50/60 to-transparent dark:from-amber-950/30 dark:via-orange-950/20"
        : "from-emerald-50/80 via-green-50/60 to-transparent dark:from-emerald-950/30 dark:via-green-950/20",
      borderAccent: salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 6
        ? "border-l-red-500"
        : salesMetrics?.monthsBelowAverage && salesMetrics.monthsBelowAverage > 3
        ? "border-l-amber-500"
        : "border-l-emerald-500",
      tooltip: `Cantidad de meses del año actual que están por debajo del promedio mensual de ventas`,
    },
    {
      id: 6,
      title: "Rentabilidad",
      value: salesMetrics?.profitability 
        ? `${salesMetrics.profitability.toFixed(1)}%`
        : "N/A",
      unit: "",
      subtitle: `Margen bruto estimado`,
      progress: salesMetrics?.profitability || 0,
      progressLabel: salesMetrics?.profitability 
        ? `${salesMetrics.profitability.toFixed(1)}% de margen bruto`
        : "Sin datos",
      badge: {
        value: salesMetrics?.profitability 
          ? salesMetrics.profitability >= 20
            ? "⭐ Excelente"
            : salesMetrics.profitability >= 15
            ? "✅ Buena"
            : salesMetrics.profitability >= 10
            ? "🟡 Regular"
            : "🔴 Baja"
          : "N/A",
        variant: salesMetrics?.profitability
          ? salesMetrics.profitability >= 20
            ? "default"
            : salesMetrics.profitability >= 15
            ? "default"
            : salesMetrics.profitability >= 10
            ? "secondary"
            : "destructive"
          : "secondary",
      },
      icon: Percent,
      iconBg: salesMetrics?.profitability
        ? salesMetrics.profitability >= 20
          ? "bg-gradient-to-br from-emerald-500 to-green-600"
          : salesMetrics.profitability >= 15
          ? "bg-gradient-to-br from-blue-500 to-cyan-600"
          : salesMetrics.profitability >= 10
          ? "bg-gradient-to-br from-amber-500 to-orange-600"
          : "bg-gradient-to-br from-red-500 to-rose-600"
        : "bg-gradient-to-br from-gray-500 to-slate-600",
      cardBg: salesMetrics?.profitability
        ? salesMetrics.profitability >= 20
          ? "from-emerald-50/80 via-green-50/60 to-transparent dark:from-emerald-950/30 dark:via-green-950/20"
          : salesMetrics.profitability >= 15
          ? "from-blue-50/80 via-cyan-50/60 to-transparent dark:from-blue-950/30 dark:via-cyan-950/20"
          : salesMetrics.profitability >= 10
          ? "from-amber-50/80 via-orange-50/60 to-transparent dark:from-amber-950/30 dark:via-orange-950/20"
          : "from-red-50/80 via-rose-50/60 to-transparent dark:from-red-950/30 dark:via-rose-950/20"
        : "from-gray-50/80 via-slate-50/60 to-transparent dark:from-gray-950/30 dark:via-slate-950/20",
      borderAccent: salesMetrics?.profitability
        ? salesMetrics.profitability >= 20
          ? "border-l-emerald-500"
          : salesMetrics.profitability >= 15
          ? "border-l-blue-500"
          : salesMetrics.profitability >= 10
          ? "border-l-amber-500"
          : "border-l-red-500"
        : "border-l-gray-500",
      tooltip: `Porcentaje de margen bruto estimado basado en estándares de la industria`,
    },
  ];

  // Agrupar tarjetas por categoría para mejor organización visual
  const primaryKPIs = executiveCards.slice(0, 4); // Ventas, Mes Actual, Crecimiento, Clientes
  const executiveMetrics = executiveCards.slice(4); // Meses Bajo Promedio, Rentabilidad

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Grupo 1: KPIs Principales de Ventas - Grid más amplio */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Métricas de Ventas
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {primaryKPIs.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={cn(
                      "relative overflow-hidden rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all duration-300",
                      "bg-gradient-to-br backdrop-blur-sm",
                      kpi.cardBg,
                      kpi.borderAccent,
                      "group cursor-pointer"
                    )}
                  >
                    {/* Patrón de fondo sutil */}
                    <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity">
                      <div className="absolute inset-0" style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                        backgroundSize: '24px 24px'
                      }} />
                    </div>

                    <CardContent className="relative p-5">
                      {/* Header con icono y tooltip */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-foreground/90 leading-tight">
                              {kpi.title}
                            </h3>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {kpi.subtitle}
                          </p>
                        </div>
                        <div className={cn(
                          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                          kpi.iconBg,
                          "text-white"
                        )}>
                          <Icon className="w-6 h-6" />
                        </div>
                      </div>

                      {/* Valor principal */}
                      <div className="mb-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-foreground tracking-tight">
                            {kpi.value}
                          </span>
                          {kpi.unit && (
                            <span className="text-sm font-medium text-muted-foreground">
                              {kpi.unit}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra de progreso o indicador de tendencia */}
                      {kpi.progress !== undefined && kpi.id !== 6 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                              {kpi.progressLabel}
                            </span>
                            {kpi.progress > 0 && (
                              <span className="text-xs font-semibold text-foreground/70">
                                {kpi.progress.toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <motion.div
                              className={cn(
                                "h-full rounded-full",
                                kpi.progress >= 75 ? "bg-emerald-500" :
                                kpi.progress >= 50 ? "bg-blue-500" :
                                kpi.progress >= 25 ? "bg-amber-500" : "bg-red-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(kpi.progress, 100)}%` }}
                              transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Barra de rentabilidad (escala 0-30%) */}
                      {kpi.id === 6 && salesMetrics?.profitability && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                              {kpi.progressLabel}
                            </span>
                            <span className="text-xs font-semibold text-foreground/70">
                              {salesMetrics.profitability.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <motion.div
                              className={cn(
                                "h-full rounded-full",
                                salesMetrics.profitability >= 20 ? "bg-emerald-500" :
                                salesMetrics.profitability >= 15 ? "bg-blue-500" :
                                salesMetrics.profitability >= 10 ? "bg-amber-500" : "bg-red-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((salesMetrics.profitability / 30) * 100, 100)}%` }}
                              transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Indicador de tendencia */}
                      {kpi.trend !== undefined && kpi.trendLabel && (
                        <div className="mb-3">
                          <div className={cn(
                            "flex items-center gap-1.5 text-sm font-semibold",
                            kpi.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {kpi.trend >= 0 ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            )}
                            <span>{kpi.trendLabel}</span>
                          </div>
                        </div>
                      )}

                      {/* Badge de estado */}
                      {kpi.badge && (
                        <div className="mt-auto pt-2 border-t border-border/40">
                          <Badge
                            variant={kpi.badge.variant as any}
                            className="flex items-center gap-1.5 w-fit text-xs font-medium"
                          >
                            {kpi.badge.icon && <kpi.badge.icon className="h-3 w-3" />}
                            {kpi.badge.value}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{kpi.tooltip}</p>
                </TooltipContent>
            </Tooltip>
          </motion.div>
          );
            })}
          </div>
        </div>

        {/* Separador visual sutil */}
        <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent my-6" />

        {/* Grupo 2: Métricas Ejecutivas - Grid más compacto */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Indicadores Ejecutivos
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {executiveMetrics.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={kpi.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: (index + primaryKPIs.length) * 0.05 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card
                      className={cn(
                        "relative overflow-hidden rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all duration-300",
                        "bg-gradient-to-br backdrop-blur-sm",
                        kpi.cardBg,
                        kpi.borderAccent,
                        "group cursor-pointer"
                      )}
                    >
                      {/* Patrón de fondo sutil */}
                      <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity">
                        <div className="absolute inset-0" style={{
                          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                          backgroundSize: '24px 24px'
                        }} />
                      </div>

                      <CardContent className="relative p-5">
                        {/* Header con icono y tooltip */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-foreground/90 leading-tight">
                                {kpi.title}
                              </h3>
                              <Info className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {kpi.subtitle}
                            </p>
                          </div>
                          <div className={cn(
                            "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                            kpi.iconBg,
                            "text-white"
                          )}>
                            <Icon className="w-6 h-6" />
                          </div>
                        </div>

                        {/* Valor principal */}
                        <div className="mb-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground tracking-tight">
                              {kpi.value}
                            </span>
                            {kpi.unit && (
                              <span className="text-sm font-medium text-muted-foreground">
                                {kpi.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Barra de progreso o indicador de tendencia */}
                        {kpi.progress !== undefined && kpi.id !== 6 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                {kpi.progressLabel}
                              </span>
                              {kpi.progress > 0 && (
                                <span className="text-xs font-semibold text-foreground/70">
                                  {kpi.progress.toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                              <motion.div
                                className={cn(
                                  "h-full rounded-full",
                                  kpi.progress >= 75 ? "bg-emerald-500" :
                                  kpi.progress >= 50 ? "bg-blue-500" :
                                  kpi.progress >= 25 ? "bg-amber-500" : "bg-red-500"
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(kpi.progress, 100)}%` }}
                                transition={{ duration: 0.8, delay: (index + primaryKPIs.length) * 0.1 + 0.3 }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Barra de rentabilidad (escala 0-30%) */}
                        {kpi.id === 6 && salesMetrics?.profitability && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                {kpi.progressLabel}
                              </span>
                              <span className="text-xs font-semibold text-foreground/70">
                                {salesMetrics.profitability.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                              <motion.div
                                className={cn(
                                  "h-full rounded-full",
                                  salesMetrics.profitability >= 20 ? "bg-emerald-500" :
                                  salesMetrics.profitability >= 15 ? "bg-blue-500" :
                                  salesMetrics.profitability >= 10 ? "bg-amber-500" : "bg-red-500"
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((salesMetrics.profitability / 30) * 100, 100)}%` }}
                                transition={{ duration: 0.8, delay: (index + primaryKPIs.length) * 0.1 + 0.3 }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Indicador de tendencia */}
                        {kpi.trend !== undefined && kpi.trendLabel && (
                          <div className="mb-3">
                            <div className={cn(
                              "flex items-center gap-1.5 text-sm font-semibold",
                              kpi.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {kpi.trend >= 0 ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              )}
                              <span>{kpi.trendLabel}</span>
                            </div>
                          </div>
                        )}

                        {/* Badge de estado */}
                        {kpi.badge && (
                          <div className="mt-auto pt-2 border-t border-border/40">
                            <Badge
                              variant={kpi.badge.variant as any}
                              className="flex items-center gap-1.5 w-fit text-xs font-medium"
                            >
                              {kpi.badge.icon && <kpi.badge.icon className="h-3 w-3" />}
                              {kpi.badge.value}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{kpi.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
