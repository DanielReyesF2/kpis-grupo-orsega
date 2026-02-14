/**
 * ClientPurchaseBehavior - Heatmap de comportamiento de compras por cliente
 * Muestra patrones mensuales de compra para 2024-2025
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChartCard } from '@/components/salesforce/layout/ChartCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Search, Grid3X3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/sales-utils';
import { cn } from '@/lib/utils';

interface ClientPurchaseBehaviorProps {
  companyId: number;
}

interface ClientBehaviorData {
  clientName: string;
  months: Record<string, { volume: number; revenue: number; transactions: number }>;
  totals: { volume: number; revenue: number; transactions: number };
}

interface PurchaseBehaviorResponse {
  clients: ClientBehaviorData[];
  months: string[];
  unit: string;
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function ClientPurchaseBehavior({ companyId }: ClientPurchaseBehaviorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCount, setShowCount] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/client-purchase-behavior', companyId, showCount],
    queryFn: async () => {
      const res = await apiRequest(
        'GET',
        `/api/client-purchase-behavior?companyId=${companyId}&limit=${showCount}`
      );
      return res.json() as Promise<PurchaseBehaviorResponse>;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <ChartCard
        title="Comportamiento de Compras"
        subtitle="Cargando datos..."
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </ChartCard>
    );
  }

  if (error || !data) {
    return (
      <ChartCard
        title="Comportamiento de Compras"
        subtitle="Error al cargar"
      >
        <div className="text-center py-8 text-muted-foreground">
          <p>No se pudieron cargar los datos de comportamiento</p>
        </div>
      </ChartCard>
    );
  }

  // Filter clients by search term
  const filteredClients = data.clients.filter((client) =>
    client.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate max revenue for color intensity
  const maxMonthlyRevenue = Math.max(
    ...data.clients.flatMap((client) =>
      Object.values(client.months).map((m) => m.revenue)
    ),
    1
  );

  // Get cell color based on revenue intensity
  const getCellColor = (revenue: number): string => {
    if (revenue === 0) return 'bg-gray-100 dark:bg-gray-800';
    const intensity = Math.min(revenue / maxMonthlyRevenue, 1);
    if (intensity > 0.7) return 'bg-emerald-500 text-white';
    if (intensity > 0.4) return 'bg-emerald-400 text-white';
    if (intensity > 0.2) return 'bg-emerald-300';
    if (intensity > 0.1) return 'bg-emerald-200';
    return 'bg-emerald-100';
  };

  // Calculate trend for a client (2024 vs 2025)
  const getClientTrend = (client: ClientBehaviorData): { type: 'up' | 'down' | 'stable'; percent: number } => {
    let revenue2024 = 0;
    let revenue2025 = 0;

    Object.entries(client.months).forEach(([monthKey, data]) => {
      if (monthKey.startsWith('2024')) revenue2024 += data.revenue;
      else if (monthKey.startsWith('2025')) revenue2025 += data.revenue;
    });

    if (revenue2024 === 0) {
      return revenue2025 > 0 ? { type: 'up', percent: 100 } : { type: 'stable', percent: 0 };
    }

    const change = ((revenue2025 - revenue2024) / revenue2024) * 100;
    if (change > 10) return { type: 'up', percent: change };
    if (change < -10) return { type: 'down', percent: Math.abs(change) };
    return { type: 'stable', percent: Math.abs(change) };
  };

  // Generate month columns for 2024 and 2025
  const months2024 = Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, '0')}`);
  const months2025 = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);

  return (
    <ChartCard
      title="Comportamiento de Compras"
      subtitle="Patron mensual por cliente (2024-2025)"
      headerActions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 w-48 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCount((prev) => (prev === 20 ? 50 : 20))}
          >
            {showCount === 20 ? 'Ver mas' : 'Ver menos'}
          </Button>
        </div>
      }
    >
      <TooltipProvider>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium sticky left-0 bg-background z-10 min-w-[200px]">
                  Cliente
                </th>
                <th className="text-center py-2 px-1 font-medium" colSpan={12}>
                  <div className="flex items-center justify-center gap-1">
                    <span>2024</span>
                  </div>
                </th>
                <th className="w-px bg-border"></th>
                <th className="text-center py-2 px-1 font-medium" colSpan={12}>
                  <div className="flex items-center justify-center gap-1">
                    <span>2025</span>
                  </div>
                </th>
                <th className="text-center py-2 px-2 font-medium">Tendencia</th>
              </tr>
              <tr className="border-b bg-muted/30">
                <th className="sticky left-0 bg-muted/30 z-10"></th>
                {MONTH_LABELS.map((m, i) => (
                  <th key={`2024-${i}`} className="text-center py-1 px-1 font-normal text-muted-foreground w-8">
                    {m}
                  </th>
                ))}
                <th className="w-px bg-border"></th>
                {MONTH_LABELS.map((m, i) => (
                  <th key={`2025-${i}`} className="text-center py-1 px-1 font-normal text-muted-foreground w-8">
                    {m}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={26} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No se encontraron clientes' : 'No hay datos disponibles'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const trend = getClientTrend(client);

                  return (
                    <tr key={client.clientName} className="hover:bg-muted/30">
                      <td className="py-2 px-2 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[180px]" title={client.clientName}>
                            {client.clientName}
                          </span>
                        </div>
                      </td>
                      {/* 2024 months */}
                      {months2024.map((monthKey) => {
                        const monthData = client.months[monthKey];
                        const hasData = monthData && monthData.revenue > 0;

                        return (
                          <td key={monthKey} className="py-1 px-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'w-6 h-6 rounded-sm mx-auto cursor-default transition-colors',
                                    hasData ? getCellColor(monthData.revenue) : 'bg-gray-100 dark:bg-gray-800'
                                  )}
                                />
                              </TooltipTrigger>
                              {hasData && (
                                <TooltipContent side="top">
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">{client.clientName}</p>
                                    <p>{monthKey}</p>
                                    <p>Revenue: {formatCurrency(monthData.revenue, companyId)}</p>
                                    <p>Transacciones: {monthData.transactions}</p>
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </td>
                        );
                      })}
                      {/* Separator */}
                      <td className="w-px bg-border"></td>
                      {/* 2025 months */}
                      {months2025.map((monthKey) => {
                        const monthData = client.months[monthKey];
                        const hasData = monthData && monthData.revenue > 0;

                        return (
                          <td key={monthKey} className="py-1 px-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'w-6 h-6 rounded-sm mx-auto cursor-default transition-colors',
                                    hasData ? getCellColor(monthData.revenue) : 'bg-gray-100 dark:bg-gray-800'
                                  )}
                                />
                              </TooltipTrigger>
                              {hasData && (
                                <TooltipContent side="top">
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">{client.clientName}</p>
                                    <p>{monthKey}</p>
                                    <p>Revenue: {formatCurrency(monthData.revenue, companyId)}</p>
                                    <p>Transacciones: {monthData.transactions}</p>
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </td>
                        );
                      })}
                      {/* Trend */}
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            trend.type === 'up' && 'border-emerald-300 text-emerald-700 bg-emerald-50',
                            trend.type === 'down' && 'border-red-300 text-red-700 bg-red-50',
                            trend.type === 'stable' && 'border-gray-300 text-gray-700 bg-gray-50'
                          )}
                        >
                          {trend.type === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
                          {trend.type === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
                          {trend.type === 'stable' && <Minus className="w-3 h-3 mr-1" />}
                          {trend.percent > 0 ? `${Math.round(trend.percent)}%` : '-'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="font-medium">Intensidad de compras:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800" />
              <span>Sin compras</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-100" />
              <span>Baja</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-300" />
              <span>Media</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-500" />
              <span>Alta</span>
            </div>
          </div>
          <span>{filteredClients.length} clientes</span>
        </div>
      </TooltipProvider>
    </ChartCard>
  );
}
