/**
 * Top Clients Chart - Gráfica moderna de mejores clientes
 * Diseño premium con barras horizontales y estadísticas
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import {
  Users,
  Trophy,
  TrendingUp,
  Loader2,
  Crown
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TopClient {
  name: string;
  volume: number;
  transactions: number;
  unit: string;
}

interface TopClientsChartProps {
  companyId?: number;
  limit?: number;
}

export function TopClientsChart({ companyId = 1, limit = 5 }: TopClientsChartProps) {
  const { data: topClients, isLoading, error } = useQuery<TopClient[]>({
    queryKey: ['/api/sales-top-clients', companyId, limit],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-top-clients?companyId=${companyId}&limit=${limit}`);
      return await res.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const companyName = companyId === 1 ? "DURA" : "ORSEGA";

  // Colores para el diseño
  const companyConfig = companyId === 2
    ? {
        primary: "#8b5cf6",
        secondary: "#a78bfa",
        light: "rgba(139, 92, 246, 0.15)",
        gradient: ["#8b5cf6", "#6366f1", "#818cf8", "#a78bfa", "#c4b5fd"]
      }
    : {
        primary: "#10b981",
        secondary: "#34d399",
        light: "rgba(16, 185, 129, 0.15)",
        gradient: ["#10b981", "#059669", "#14b8a6", "#22d3ee", "#34d399"]
      };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatFullNumber = (num: number) => {
    return num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden bg-gradient-to-br from-card to-muted/30 border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (error || !topClients?.length) {
    return (
      <Card className="overflow-hidden border-dashed border-2">
        <CardContent className="py-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">No hay datos de clientes disponibles</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sube datos de ventas para ver los top clientes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar datos para el gráfico
  const chartData = topClients.map((client, index) => ({
    name: client.name.length > 20 ? client.name.substring(0, 20) + '...' : client.name,
    fullName: client.name,
    volume: client.volume,
    transactions: client.transactions,
    unit: client.unit,
    rank: index + 1
  }));

  // Calcular estadísticas
  const totalVolume = topClients.reduce((sum, c) => sum + c.volume, 0);
  const avgTransactions = Math.round(topClients.reduce((sum, c) => sum + c.transactions, 0) / topClients.length);
  const topClientPercent = totalVolume > 0 ? ((topClients[0].volume / totalVolume) * 100).toFixed(1) : 0;
  const unit = topClients[0]?.unit || (companyId === 2 ? "unidades" : "KG");

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl min-w-[220px]">
        <div className="flex items-center gap-2 mb-3">
          {data.rank === 1 && <Crown className="h-4 w-4 text-amber-500" />}
          <p className="text-foreground font-bold">{data.fullName}</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground text-sm">Volumen</span>
            <span className="text-foreground font-bold">{formatFullNumber(data.volume)} {data.unit}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground text-sm">Transacciones</span>
            <span className="text-foreground font-medium">{data.transactions}</span>
          </div>
          <div className="flex justify-between items-center gap-4 pt-2 border-t border-border/50">
            <span className="text-muted-foreground text-sm">% del Top {limit}</span>
            <span className="text-foreground font-semibold" style={{ color: companyConfig.primary }}>
              {((data.volume / totalVolume) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-muted/20 border-border/50 shadow-lg">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-2xl shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${companyConfig.primary}20, ${companyConfig.primary}10)`,
                boxShadow: `0 4px 20px ${companyConfig.light}`
              }}
            >
              <Trophy className="h-6 w-6" style={{ color: companyConfig.primary }} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Top {limit} Clientes
                <Crown className="h-4 w-4 text-amber-500" />
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {companyName} · Últimos 3 meses
              </p>
            </div>
          </div>

          {/* Badge del cliente principal */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-md"
            style={{
              background: `linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))`,
              color: 'rgb(180, 117, 8)',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            <Crown className="h-4 w-4" />
            <span>#{1} = {topClientPercent}% del total</span>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-background to-muted/30 rounded-2xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Clientes en Top</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: companyConfig.primary }}>
              {topClients.length}
            </p>
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-background to-muted/30 rounded-2xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Volumen Total</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(totalVolume)}</p>
            <p className="text-[11px] text-muted-foreground">{unit}</p>
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-background to-muted/30 rounded-2xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-medium">Trans. Promedio</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{avgTransactions}</p>
            <p className="text-[11px] text-muted-foreground">por cliente</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Chart de barras horizontales */}
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            >
              <defs>
                {chartData.map((_, index) => (
                  <linearGradient key={`gradient-${index}`} id={`clientGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={companyConfig.gradient[index % companyConfig.gradient.length]} stopOpacity={1} />
                    <stop offset="100%" stopColor={companyConfig.gradient[index % companyConfig.gradient.length]} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis
                type="number"
                tickFormatter={formatNumber}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fontWeight: 500, fill: 'hsl(var(--foreground))' }}
                tickLine={false}
                axisLine={false}
                width={150}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
              <Bar
                dataKey="volume"
                radius={[0, 8, 8, 0]}
                maxBarSize={40}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? '#f59e0b' : `url(#clientGradient-${index})`}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lista detallada */}
        <div className="mt-6 pt-5 border-t border-border/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Ranking Detallado</p>
            <p className="text-xs text-muted-foreground">Ordenado por volumen</p>
          </div>
          <div className="space-y-2">
            {topClients.map((client, index) => (
              <div
                key={client.name}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:shadow-md ${
                  index === 0
                    ? 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/50 dark:border-amber-700/50'
                    : 'bg-gradient-to-r from-background to-muted/20 border-border/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0
                        ? 'bg-amber-500 text-white'
                        : index === 1
                          ? 'bg-gray-400 text-white'
                          : index === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.transactions} transacciones</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: index === 0 ? '#f59e0b' : companyConfig.primary }}>
                    {formatFullNumber(client.volume)}
                  </p>
                  <p className="text-xs text-muted-foreground">{client.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
