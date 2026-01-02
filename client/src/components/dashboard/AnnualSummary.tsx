/**
 * Componente de Resumen Anual Ejecutivo
 * Muestra todas las métricas relevantes de un año seleccionado
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Percent,
  Calendar,
  BarChart3,
  Users,
  UserPlus,
  UserMinus,
} from "lucide-react";
import type { AnnualSummary } from "@shared/sales-types";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AnnualSummaryProps {
  companyId: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}

export function AnnualSummary({ companyId }: AnnualSummaryProps) {
  // Obtener años disponibles
  const { data: availableYears, isLoading: isLoadingYears } = useQuery<number[]>({
    queryKey: ["/api/annual-summary/years", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/annual-summary/years?companyId=${companyId}`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Usar el año más reciente por defecto
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    // Inicializar con el año actual, se actualizará cuando availableYears se cargue
    return new Date().getFullYear();
  });

  // Actualizar selectedYear cuando availableYears se carga
  useEffect(() => {
    if (availableYears && availableYears.length > 0) {
      // Si el año seleccionado no está en los años disponibles, usar el más reciente
      if (!availableYears.includes(selectedYear)) {
        setSelectedYear(availableYears[0]);
      }
    }
  }, [availableYears, selectedYear]);

  // Obtener resumen anual
  const { data: summary, isLoading: isLoadingSummary } = useQuery<AnnualSummary>({
    queryKey: ["/api/annual-summary", companyId, selectedYear],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/annual-summary?companyId=${companyId}&year=${selectedYear}`);
      return await res.json();
    },
    enabled: !!selectedYear,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoadingYears) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!availableYears || availableYears.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No hay datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  // Ordenar años de menor a mayor (ascendente)
  const sortedYears = [...(availableYears || [])].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Tabs de años */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Resumen Ejecutivo Anual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted/50 p-1.5 gap-1.5 w-full overflow-x-auto">
              {sortedYears.map((year) => (
                <TabsTrigger 
                  key={year} 
                  value={year.toString()}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-w-[80px]",
                    "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-primary/20",
                    "data-[state=inactive]:bg-muted/80 data-[state=inactive]:text-foreground/80 data-[state=inactive]:border data-[state=inactive]:border-border/60 hover:bg-muted hover:text-foreground hover:border-border"
                  )}
                >
                  {year}
                </TabsTrigger>
              ))}
            </TabsList>

            {sortedYears.map((year) => (
              <TabsContent key={year} value={year.toString()} className="mt-6">
                {isLoadingSummary ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : summary ? (
                  <AnnualSummaryContent summary={summary} />
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AnnualSummaryContent({ summary }: { summary: AnnualSummary }) {
  return (
    <div className="space-y-8">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Ventas Totales"
          value={formatNumber(summary.totalSales)}
          unit={summary.unit}
          icon={BarChart3}
          trend={summary.growthVsPreviousYear}
          trendLabel="vs año anterior"
        />
        <MetricCard
          title="Ingresos Totales"
          value={formatCurrency(summary.totalRevenue)}
          icon={DollarSign}
          trend={summary.growthVsPreviousYear}
          trendLabel="vs año anterior"
        />
        <MetricCard
          title="Rentabilidad"
          value={`${summary.profitability.toFixed(1)}%`}
          subtitle={`Utilidad: ${formatCurrency(summary.totalProfit)}`}
          icon={Percent}
        />
        <MetricCard
          title="Transacciones"
          value={formatNumber(summary.totalTransactions)}
          subtitle={`Ticket promedio: ${formatCurrency(summary.avgTicket)}`}
          icon={ShoppingCart}
        />
      </div>

      {/* Gráfico mensual */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencias Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="monthName" 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="volume" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name={`Volumen (${summary.unit})`}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Ingresos"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Métricas de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Clientes"
          value={formatNumber(summary.totalClients)}
          icon={Users}
        />
        <MetricCard
          title="Nuevos Clientes"
          value={formatNumber(summary.newClients)}
          icon={UserPlus}
          variant="success"
        />
        <MetricCard
          title="Clientes Perdidos"
          value={formatNumber(summary.lostClients)}
          icon={UserMinus}
          variant="danger"
        />
        <MetricCard
          title="Tasa Retención"
          value={`${summary.retentionRate.toFixed(1)}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Clientes Inactivos - Visualización Mejorada */}
      <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <UserMinus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              Clientes Inactivos
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                {summary.inactiveClients} clientes
              </Badge>
            </CardTitle>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Revenue Perdido</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(
                  summary.inactiveClientsList.reduce((sum, c) => sum + (c.previousYearRevenue || 0), 0)
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {summary.inactiveClientsList.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">¡Excelente!</p>
              <p className="text-xs text-muted-foreground mt-1">No hay clientes inactivos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.inactiveClientsList.slice(0, 12).map((client, index) => {
                const revenue = client.previousYearRevenue || 0;
                const isHighValue = revenue > 100000;
                const isMediumValue = revenue > 50000;
                
                // Calcular días desde última compra
                const lastPurchase = client.lastPurchaseDate 
                  ? new Date(client.lastPurchaseDate) 
                  : null;
                const daysSince = lastPurchase 
                  ? Math.floor((new Date().getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                
                return (
                  <motion.div
                    key={client.name}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-[1.02]",
                      isHighValue
                        ? "border-red-300 dark:border-red-800 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20"
                        : isMediumValue
                        ? "border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20"
                        : "border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50/50 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/10"
                    )}
                  >
                    {/* Badge de prioridad */}
                    {isHighValue && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-red-500 text-white text-[10px] px-2 py-0.5">
                          ALTA PRIORIDAD
                        </Badge>
                      </div>
                    )}
                    
                    {/* Avatar/Iniciales */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0",
                        isHighValue
                          ? "bg-gradient-to-br from-red-500 to-red-600"
                          : isMediumValue
                          ? "bg-gradient-to-br from-amber-500 to-orange-500"
                          : "bg-gradient-to-br from-orange-400 to-amber-400"
                      )}>
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{client.name}</p>
                        {daysSince !== null && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {daysSince > 365 
                              ? `${Math.floor(daysSince / 365)} año${Math.floor(daysSince / 365) > 1 ? 's' : ''} sin comprar`
                              : daysSince > 30
                              ? `${Math.floor(daysSince / 30)} mes${Math.floor(daysSince / 30) > 1 ? 'es' : ''} sin comprar`
                              : `${daysSince} día${daysSince > 1 ? 's' : ''} sin comprar`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Revenue perdido destacado */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 dark:bg-background/40">
                        <span className="text-xs font-medium text-muted-foreground">Revenue Perdido</span>
                        <span className={cn(
                          "text-base font-bold",
                          isHighValue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {formatCurrency(revenue)}
                        </span>
                      </div>
                      
                      {/* Barra de progreso visual */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((revenue / 500000) * 100, 100)}%` }}
                          transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                          className={cn(
                            "h-full rounded-full",
                            isHighValue
                              ? "bg-gradient-to-r from-red-500 to-red-600"
                              : isMediumValue
                              ? "bg-gradient-to-r from-amber-500 to-orange-500"
                              : "bg-gradient-to-r from-orange-400 to-amber-400"
                          )}
                        />
                      </div>
                    </div>
                    
                    {/* Fecha última compra */}
                    {lastPurchase && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Última compra: {lastPurchase.toLocaleDateString('es-MX', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Meses Bajo Promedio</p>
                <p className="text-3xl font-bold">{summary.monthsBelowAverage}</p>
                <p className="text-xs text-muted-foreground mt-1">de {summary.monthlySales.length} meses</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Crecimiento Anual</p>
                <p className={cn(
                  "text-3xl font-bold",
                  summary.growthVsPreviousYear >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {summary.growthVsPreviousYear >= 0 ? '+' : ''}{summary.growthVsPreviousYear.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">vs año anterior</p>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center",
                summary.growthVsPreviousYear >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"
              )}>
                {summary.growthVsPreviousYear >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Utilidad Total</p>
                <p className="text-3xl font-bold">{formatCurrency(summary.totalProfit)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.profitability.toFixed(1)}% de {formatCurrency(summary.totalRevenue)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  variant?: "default" | "success" | "danger";
}

function MetricCard({ 
  title, 
  value, 
  unit, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendLabel,
  variant = "default"
}: MetricCardProps) {
  const iconColors = {
    default: "bg-blue-500/20 text-blue-600",
    success: "bg-emerald-500/20 text-emerald-600",
    danger: "bg-red-500/20 text-red-600",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend !== undefined && trendLabel && (
              <div className={cn(
                "flex items-center gap-1 mt-2 text-sm font-medium",
                trend >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {trend >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}% {trendLabel}</span>
              </div>
            )}
          </div>
          <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", iconColors[variant])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

