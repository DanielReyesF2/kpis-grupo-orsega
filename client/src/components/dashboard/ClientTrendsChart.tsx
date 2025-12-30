/**
 * Client Trends Chart - Top clientes con comparativo YoY
 * Barras horizontales mostrando volumen actual vs anterior
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import { TrendingUp, TrendingDown, Users, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ClientTrendsChartProps {
  companyId: number;
  limit?: number;
}

interface ClientTrend {
  name: string;
  qtyCurrent: number;
  qtyPrevious: number;
  change: number;
  changePercent: number;
  amtCurrent: number;
  amtPrevious: number;
  unit: string;
}

interface ClientTrendsData {
  companyId: number;
  currentYear: number;
  previousYear: number;
  clients: ClientTrend[];
  unit: string;
}

export function ClientTrendsChart({ companyId, limit = 10 }: ClientTrendsChartProps) {
  const { data, isLoading, error } = useQuery<ClientTrendsData>({
    queryKey: ['/api/sales-client-trends', companyId, limit],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-client-trends?companyId=${companyId}&limit=${limit}`);
      return await res.json();
    },
    enabled: !!companyId,
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  const shortenName = (name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle>Cargando clientes...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <p className="text-red-600">Error al cargar tendencias de clientes</p>
        </CardContent>
      </Card>
    );
  }

  const { clients, currentYear, previousYear, unit } = data;
  const companyName = companyId === 1 ? "DURA" : "ORSEGA";

  // Preparar datos para el chart
  const chartData = clients.map(c => ({
    name: shortenName(c.name, 18),
    fullName: c.name,
    [previousYear]: c.qtyPrevious,
    [currentYear]: c.qtyCurrent,
    change: c.change,
    changePercent: c.changePercent
  }));

  // Estadísticas
  const totalCurrent = clients.reduce((sum, c) => sum + c.qtyCurrent, 0);
  const totalPrevious = clients.reduce((sum, c) => sum + c.qtyPrevious, 0);
  const growingClients = clients.filter(c => c.change > 0).length;
  const decliningClients = clients.filter(c => c.change < 0).length;

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${companyId === 1 ? 'bg-blue-100' : 'bg-purple-100'}`}>
              <Users className={`h-5 w-5 ${companyId === 1 ? 'text-blue-600' : 'text-purple-600'}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Top {limit} Clientes - {companyName}</CardTitle>
              <CardDescription>Comparativo {previousYear} vs {currentYear}</CardDescription>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-3 mt-3">
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-green-600">{growingClients} creciendo</span>
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-600" />
            <span className="text-red-600">{decliningClients} declinando</span>
          </Badge>
          <Badge variant="secondary">
            Top {limit}: {formatNumber(totalCurrent)} {unit}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tickFormatter={formatNumber}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={95}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatNumber(value) + ' ' + unit,
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullName;
                  }
                  return label;
                }}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}
              />
              <Legend />
              <Bar
                dataKey={previousYear.toString()}
                name={previousYear.toString()}
                fill="#94a3b8"
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey={currentYear.toString()}
                name={currentYear.toString()}
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.change >= 0 ? '#10b981' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed list */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
          {clients.slice(0, 6).map((client, idx) => (
            <div
              key={idx}
              className={`flex justify-between items-center p-2 rounded-lg border ${
                client.change >= 0 ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{client.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(client.qtyCurrent)} {unit}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`ml-2 ${
                  client.change >= 0
                    ? 'text-green-600 border-green-300'
                    : 'text-red-600 border-red-300'
                }`}
              >
                {client.change >= 0 ? '+' : ''}{formatNumber(client.change)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
