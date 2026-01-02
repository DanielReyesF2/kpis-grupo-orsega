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
  Package,
  Users,
  UserPlus,
  UserMinus,
  ShoppingCart,
  Percent,
  Calendar,
  Award,
  BarChart3,
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
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableYears.length}, 1fr)` }}>
              {availableYears.map((year) => (
                <TabsTrigger key={year} value={year.toString()}>
                  {year}
                </TabsTrigger>
              ))}
            </TabsList>

            {availableYears.map((year) => (
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

      {/* Top Producto y Top Productos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Producto Destacado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Producto Estrella del Año
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary">
                <p className="text-2xl font-bold mb-2">{summary.topProduct.name}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Volumen</p>
                    <p className="text-lg font-semibold">
                      {formatNumber(summary.topProduct.volume)} {summary.topProduct.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos</p>
                    <p className="text-lg font-semibold">{formatCurrency(summary.topProduct.revenue)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Productos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Top 10 Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.topProducts.map((product, index) => (
                <motion.div
                  key={product.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(product.volume)} {product.unit}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{product.transactions} trans.</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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

      {/* Top Clientes y Clientes Inactivos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Top 10 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.topClients.map((client, index) => (
                <motion.div
                  key={client.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.transactions} transacciones
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(client.revenue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(client.avgTicket)} promedio
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clientes Inactivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserMinus className="w-5 h-5" />
              Clientes Inactivos
              <Badge variant="secondary">{summary.inactiveClients}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.inactiveClientsList.slice(0, 10).map((client, index) => (
                <motion.div
                  key={client.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Última compra: {client.lastPurchaseDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Año anterior</p>
                    <p className="font-semibold text-sm">{formatCurrency(client.previousYearRevenue)}</p>
                  </div>
                </motion.div>
              ))}
              {summary.inactiveClientsList.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay clientes inactivos
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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

