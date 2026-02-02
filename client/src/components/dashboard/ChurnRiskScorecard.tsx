/**
 * Churn Risk Scorecard - Análisis de riesgo de pérdida de clientes
 * Categoriza clientes por nivel de riesgo y muestra volumen en peligro
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Loader2,
  Clock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ChurnRiskScorecardProps {
  companyId: number;
}

interface ClientRisk {
  name: string;
  lastPurchase: string;
  daysSincePurchase: number;
  qtyCurrentYear: number;
  qtyLastYear: number;
  yoyChange: number;
  amtCurrentYear: number;
  unit: string;
}

interface ChurnData {
  companyId: number;
  currentYear: number;
  lastYear: number;
  summary: {
    totalClients: number;
    atRiskCount?: number;
    criticalCount: number;
    warningCount: number;
    lostCount: number;
    newCount: number;
    growingCount: number;
    lostVolume: number;
    atRiskVolume: number;
  };
  clients: {
    atRisk?: ClientRisk[];
    critical: ClientRisk[];
    warning: ClientRisk[];
    declining: ClientRisk[];
    stable: ClientRisk[];
    growing: ClientRisk[];
    new: ClientRisk[];
    lost: ClientRisk[];
  };
  unit: string;
}

export function ChurnRiskScorecard({ companyId }: ChurnRiskScorecardProps) {
  const [activeTab, setActiveTab] = useState("critical");

  const { data, isLoading, error } = useQuery<ChurnData>({
    queryKey: ['/api/sales-churn-risk', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-churn-risk?companyId=${companyId}`);
      return await res.json();
    },
    enabled: !!companyId,
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('es-MX');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle>Analizando riesgo de clientes...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <p className="text-red-600">Error al cargar análisis de riesgo</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, clients, unit, currentYear, lastYear } = data;

  const categories = [
    ...(summary.atRiskCount !== undefined && summary.atRiskCount > 0
      ? [{
          key: "atRisk" as const,
          label: "En riesgo",
          icon: AlertTriangle,
          color: "text-amber-600",
          bgColor: "bg-amber-50 dark:bg-amber-950/30",
          borderColor: "border-amber-200",
          count: summary.atRiskCount,
          description: "Sin compras 3–6 meses"
        }]
      : []),
    {
      key: "critical",
      label: "Crítico",
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      borderColor: "border-red-200",
      count: summary.criticalCount,
      description: "Sin compras 6+ meses"
    },
    {
      key: "lost",
      label: "Perdidos",
      icon: UserMinus,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      borderColor: "border-orange-200",
      count: summary.lostCount,
      description: `Compraban en ${lastYear}, no en ${currentYear}`
    },
    {
      key: "warning",
      label: "En Alerta",
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      borderColor: "border-amber-200",
      count: summary.warningCount,
      description: "Caída >30% vs año anterior"
    },
    {
      key: "declining",
      label: "Declinando",
      icon: TrendingDown,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
      borderColor: "border-yellow-200",
      count: clients.declining.length,
      description: "Caída 10-30%"
    },
    {
      key: "growing",
      label: "Creciendo",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      borderColor: "border-green-200",
      count: summary.growingCount,
      description: "Crecimiento >10%"
    },
    {
      key: "new",
      label: "Nuevos",
      icon: UserPlus,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      borderColor: "border-blue-200",
      count: summary.newCount,
      description: `Primera compra en ${currentYear}`
    },
  ];

  const renderClientList = (clientList: ClientRisk[], category: typeof categories[0]) => {
    if (clientList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No hay clientes en esta categoría</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {clientList.map((client, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${category.bgColor} ${category.borderColor}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm">{client.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {client.daysSincePurchase > 0
                        ? `Hace ${client.daysSincePurchase} días`
                        : 'Reciente'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">
                    {formatNumber(client.qtyLastYear > 0 ? client.qtyLastYear : client.qtyCurrentYear)} {unit}
                  </p>
                  {client.yoyChange !== 0 && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${client.yoyChange > 0 ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}`}
                    >
                      {client.yoyChange > 0 ? '+' : ''}{client.yoyChange.toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>
              {category.key === 'lost' && (
                <p className="text-xs text-red-600 mt-2">
                  Volumen perdido: {formatNumber(client.qtyLastYear)} {unit}
                </p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Análisis de Riesgo de Clientes</CardTitle>
            <CardDescription>
              {summary.totalClients} clientes analizados | {currentYear} vs {lastYear}
            </CardDescription>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
            <p className="text-xs text-red-600 font-medium">En Riesgo</p>
            <p className="text-2xl font-bold text-red-700">
              {summary.criticalCount + summary.warningCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(summary.atRiskVolume)} {unit}
            </p>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200">
            <p className="text-xs text-orange-600 font-medium">Perdidos</p>
            <p className="text-2xl font-bold text-orange-700">{summary.lostCount}</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(summary.lostVolume)} {unit}
            </p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200">
            <p className="text-xs text-green-600 font-medium">Creciendo</p>
            <p className="text-2xl font-bold text-green-700">{summary.growingCount}</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 font-medium">Nuevos</p>
            <p className="text-2xl font-bold text-blue-700">{summary.newCount}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.key}
                  value={cat.key}
                  className="flex items-center gap-1 text-xs"
                >
                  <Icon className={`h-3 w-3 ${cat.color}`} />
                  <span className="hidden md:inline">{cat.label}</span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {cat.count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.key} value={cat.key}>
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">{cat.description}</p>
              </div>
              {renderClientList((clients[cat.key as keyof typeof clients] ?? []) as ClientRisk[], cat)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
