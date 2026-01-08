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
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Percent,
  Calendar,
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
    <div className="space-y-6">
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

      {/* Gráfico mensual - Final del Dashboard */}
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

