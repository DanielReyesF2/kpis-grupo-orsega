/**
 * Trends Analysis Page - Vista simplificada y visual de análisis histórico
 * Diseño moderno con gráficas interactivas y sin tablas complejas
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AreaChart,
  Area,
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
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Target,
  Award,
  Zap,
  Building2,
  ChevronRight,
  Table,
  Eye,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// Componentes del dashboard de ventas
import { YearlyTotalsBarChart } from '@/components/dashboard/YearlyTotalsBarChart';
import { MultiYearTrendChart } from '@/components/dashboard/MultiYearTrendChart';
import { TopClientsChart } from '@/components/dashboard/TopClientsChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';

interface MonthlyData {
  month: string;
  year: number;
  volume: number;
  clients: number;
}

interface YearlyData {
  year: number;
  totalQty: number;
  totalAmt: number;
  avgMonthly: number;
}

export default function TrendsAnalysisPage() {
  const [selectedCompany, setSelectedCompany] = useState<number>(1);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Query para tendencias mensuales
  const { data: monthlyTrends, isLoading: isLoadingTrends } = useQuery<MonthlyData[]>({
    queryKey: ['/api/sales-monthly-trends', selectedCompany],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-monthly-trends?companyId=${selectedCompany}&months=24`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query para datos multi-año
  const { data: multiYearData, isLoading: isLoadingMultiYear } = useQuery({
    queryKey: ['/api/sales-multi-year-trend', selectedCompany],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-multi-year-trend?companyId=${selectedCompany}`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const companyName = selectedCompany === 1 ? "DURA" : "ORSEGA";
  const companyConfig = selectedCompany === 2
    ? {
        primary: "#8b5cf6",
        secondary: "#a78bfa",
        gradient: "from-purple-500/20 to-purple-600/10",
        light: "rgba(139, 92, 246, 0.15)",
        border: "border-purple-500/50"
      }
    : {
        primary: "#10b981",
        secondary: "#34d399",
        gradient: "from-emerald-500/20 to-emerald-600/10",
        light: "rgba(16, 185, 129, 0.15)",
        border: "border-emerald-500/50"
      };

  const unit = selectedCompany === 2 ? "unidades" : "KG";

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  const formatFullNumber = (num: number) => {
    return num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  };

  // Calcular estadísticas del período
  const calculateStats = () => {
    if (!monthlyTrends || monthlyTrends.length === 0) {
      return { avgVolume: 0, maxVolume: 0, minVolume: 0, growth: 0, bestMonth: '', trend: 'neutral' as const };
    }

    const volumes = monthlyTrends.map(m => m.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const maxVolume = Math.max(...volumes);
    const minVolume = Math.min(...volumes);
    const bestMonthData = monthlyTrends.find(m => m.volume === maxVolume);
    const bestMonth = bestMonthData ? `${bestMonthData.month} ${bestMonthData.year}` : '';

    // Calcular crecimiento (últimos 6 meses vs 6 anteriores)
    const recent = monthlyTrends.slice(-6);
    const previous = monthlyTrends.slice(-12, -6);

    const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b.volume, 0) / recent.length : 0;
    const previousAvg = previous.length > 0 ? previous.reduce((a, b) => a + b.volume, 0) / previous.length : 0;

    const growth = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
    const trend = growth > 5 ? 'up' as const : growth < -5 ? 'down' as const : 'neutral' as const;

    return { avgVolume, maxVolume, minVolume, growth, bestMonth, trend };
  };

  const stats = calculateStats();

  // Preparar datos para el gráfico de área
  const chartData = monthlyTrends?.map(m => ({
    name: `${m.month.substring(0, 3)} ${m.year.toString().slice(-2)}`,
    fullName: `${m.month} ${m.year}`,
    volume: m.volume,
    clients: m.clients
  })) || [];

  // Calcular CAGR si hay datos multi-año
  const calculateCAGR = () => {
    if (!multiYearData?.yearTotals || multiYearData.yearTotals.length < 2) return 0;
    const yearTotals = multiYearData.yearTotals;
    const firstYear = yearTotals[0];
    const lastYear = yearTotals[yearTotals.length - 1];
    const years = yearTotals.length - 1;

    if (firstYear.totalQty <= 0) return 0;
    return (Math.pow(lastYear.totalQty / firstYear.totalQty, 1 / years) - 1) * 100;
  };

  const cagr = calculateCAGR();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl min-w-[200px]">
        <p className="text-foreground font-bold text-lg mb-3">{data.fullName}</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground text-sm">Volumen</span>
            <span className="text-foreground font-bold">{formatFullNumber(data.volume)} {unit}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground text-sm">Clientes activos</span>
            <span className="text-foreground font-medium">{data.clients}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppLayout title="Análisis Histórico">
      <div className="space-y-8">
        {/* Header moderno */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/50 p-6 sm:p-8 shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10"
            style={{ background: `radial-gradient(circle, ${companyConfig.primary}, transparent)` }}
          />

          <div className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                  <BarChart3 className="h-8 w-8" style={{ color: companyConfig.primary }} />
                  Análisis Histórico
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </h1>
                <p className="text-muted-foreground mt-2">
                  Visualiza tendencias y patrones de ventas de forma simplificada
                </p>
              </div>

              {/* Selector de empresa */}
              <div className="flex gap-2">
                <Button
                  variant={selectedCompany === 1 ? "default" : "outline"}
                  onClick={() => setSelectedCompany(1)}
                  className={`transition-all ${selectedCompany === 1 ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  DURA
                </Button>
                <Button
                  variant={selectedCompany === 2 ? "default" : "outline"}
                  onClick={() => setSelectedCompany(2)}
                  className={`transition-all ${selectedCompany === 2 ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  ORSEGA
                </Button>
              </div>
            </div>

            {/* Stats cards en el header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Target className="h-4 w-4" />
                  <span className="text-xs font-medium">Promedio Mensual</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: companyConfig.primary }}>
                  {isLoadingTrends ? <Skeleton className="h-8 w-20" /> : formatNumber(stats.avgVolume)}
                </p>
                <p className="text-xs text-muted-foreground">{unit}</p>
              </div>

              <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium">Mejor Mes</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {isLoadingTrends ? <Skeleton className="h-6 w-16" /> : stats.bestMonth}
                </p>
                <p className="text-xs text-muted-foreground">{formatNumber(stats.maxVolume)} {unit}</p>
              </div>

              <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  {stats.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : stats.trend === 'down' ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium">Tendencia 6M</span>
                </div>
                <p className={`text-2xl font-bold ${
                  stats.trend === 'up' ? 'text-emerald-500' :
                  stats.trend === 'down' ? 'text-red-500' : 'text-foreground'
                }`}>
                  {isLoadingTrends ? <Skeleton className="h-8 w-16" /> : `${stats.growth >= 0 ? '+' : ''}${stats.growth.toFixed(1)}%`}
                </p>
                <p className="text-xs text-muted-foreground">vs. 6 meses anteriores</p>
              </div>

              <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium">CAGR</span>
                </div>
                <p className={`text-2xl font-bold ${cagr >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isLoadingMultiYear ? <Skeleton className="h-8 w-16" /> : `${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%`}
                </p>
                <p className="text-xs text-muted-foreground">crecimiento compuesto</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico principal de tendencias */}
        <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-muted/10 border-border/50 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  Evolución de Ventas
                  <Badge variant="outline" className="text-xs font-normal">
                    Últimos 24 meses
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Tendencia de volumen mensual con clientes activos
                </CardDescription>
              </div>

              {/* Botón para ver detalle en modal */}
              <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Table className="h-4 w-4" />
                    Ver detalle
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Detalle Mensual - {companyName}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="mt-4">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-semibold">Período</th>
                          <th className="text-right p-3 font-semibold">Volumen</th>
                          <th className="text-right p-3 font-semibold">Clientes</th>
                          <th className="text-right p-3 font-semibold">Prom/Cliente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {monthlyTrends?.slice().reverse().map((m, index) => (
                          <tr key={`${m.month}-${m.year}`} className="hover:bg-muted/30">
                            <td className="p-3 font-medium">{m.month} {m.year}</td>
                            <td className="p-3 text-right font-semibold" style={{ color: companyConfig.primary }}>
                              {formatFullNumber(m.volume)} {unit}
                            </td>
                            <td className="p-3 text-right">{m.clients}</td>
                            <td className="p-3 text-right text-muted-foreground">
                              {m.clients > 0 ? formatNumber(m.volume / m.clients) : '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTrends ? (
              <Skeleton className="h-[350px] w-full rounded-xl" />
            ) : chartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay datos disponibles</p>
                </div>
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={companyConfig.primary} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={companyConfig.primary} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="volume"
                      tickFormatter={formatNumber}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <YAxis
                      yAxisId="clients"
                      orientation="right"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <ReferenceLine
                      yAxisId="volume"
                      y={stats.avgVolume}
                      stroke={companyConfig.primary}
                      strokeDasharray="4 4"
                      opacity={0.5}
                    />
                    <Area
                      yAxisId="volume"
                      type="monotone"
                      dataKey="volume"
                      stroke={companyConfig.primary}
                      strokeWidth={2}
                      fill="url(#volumeGradient)"
                      name="Volumen"
                    />
                    <Line
                      yAxisId="clients"
                      type="monotone"
                      dataKey="clients"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Clientes"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panorama Histórico por Año */}
        <YearlyTotalsBarChart companyId={selectedCompany} />

        {/* Gráficas Multi-Año si hay datos */}
        {multiYearData?.data && multiYearData.data.length > 0 && (
          <MultiYearTrendChart companyId={selectedCompany} />
        )}

        {/* Top Clientes y Productos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopClientsChart companyId={selectedCompany} limit={5} />
          <TopProductsChart companyId={selectedCompany} limit={5} />
        </div>

        {/* Insight final */}
        <Card className="bg-gradient-to-r from-muted/30 to-muted/10 border-border/50">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Resumen del Análisis</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {companyName} muestra una tendencia {stats.trend === 'up' ? 'positiva' : stats.trend === 'down' ? 'negativa' : 'estable'} en los últimos 6 meses
                  con un cambio del {stats.growth >= 0 ? '+' : ''}{stats.growth.toFixed(1)}% respecto al período anterior.
                  El mejor mes fue <strong>{stats.bestMonth}</strong> con un volumen de {formatFullNumber(stats.maxVolume)} {unit}.
                  {cagr !== 0 && (
                    <> El crecimiento compuesto anual (CAGR) es del {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%.</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
