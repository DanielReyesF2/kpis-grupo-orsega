/**
 * Company Comparison Cards - Vista ejecutiva de ambas empresas
 * Usa datos reales de /api/sales-stats (tabla sales_data)
 * Diseñado para el Dashboard principal como "Hub"
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  UserMinus,
  Percent
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SalesMetrics {
  activeClients: number;
  currentVolume: number;
  unit: string;
  growth: number;
  activeAlerts: number;
  activeClientsMetrics?: {
    thisMonth: number;
    last3Months: number;
  };
  retentionRate?: {
    rate: number;
    retainedClients: number;
  };
  newClients?: {
    count: number;
  };
  clientChurn?: {
    count: number;
    rate: number;
  };
}

interface CompanyCardProps {
  companyId: number;
  companyName: string;
  logoUrl: string;
  accentColor: string;
  onNavigate: () => void;
}

function CompanyCard({ companyId, companyName, logoUrl, accentColor, onNavigate }: CompanyCardProps) {
  const { data: metrics, isLoading } = useQuery<SalesMetrics>({
    queryKey: ['/api/sales-stats', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-stats?companyId=${companyId}`);
      return await res.json();
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString('es-MX');
  };

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <Skeleton className="h-16 w-32 mx-auto mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const growthPositive = (metrics?.growth || 0) >= 0;

  return (
    <Card className={`relative overflow-hidden border-2 hover:shadow-lg transition-all ${
      accentColor === 'green'
        ? 'border-green-200 hover:border-green-300 dark:border-green-800'
        : 'border-purple-200 hover:border-purple-300 dark:border-purple-800'
    }`}>
      {/* Accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        accentColor === 'green' ? 'bg-green-500' : 'bg-purple-500'
      }`} />

      <CardContent className="p-6">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img
            src={logoUrl}
            alt={companyName}
            className="h-16 w-auto object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>

        {/* Main KPIs Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Clientes Activos */}
          <div className={`p-3 rounded-lg ${
            accentColor === 'green'
              ? 'bg-green-50 dark:bg-green-950/30'
              : 'bg-purple-50 dark:bg-purple-950/30'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Users className={`h-4 w-4 ${
                accentColor === 'green' ? 'text-green-600' : 'text-purple-600'
              }`} />
              <span className="text-xs text-muted-foreground">Clientes</span>
            </div>
            <p className="text-2xl font-bold">{metrics?.activeClients || 0}</p>
            <p className="text-xs text-muted-foreground">
              3 meses: {metrics?.activeClientsMetrics?.last3Months || 0}
            </p>
          </div>

          {/* Volumen */}
          <div className={`p-3 rounded-lg ${
            accentColor === 'green'
              ? 'bg-green-50 dark:bg-green-950/30'
              : 'bg-purple-50 dark:bg-purple-950/30'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Package className={`h-4 w-4 ${
                accentColor === 'green' ? 'text-green-600' : 'text-purple-600'
              }`} />
              <span className="text-xs text-muted-foreground">Volumen</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(metrics?.currentVolume || 0)}</p>
            <p className="text-xs text-muted-foreground">{metrics?.unit || 'unidades'}</p>
          </div>

          {/* Crecimiento YoY */}
          <div className={`p-3 rounded-lg ${
            growthPositive
              ? 'bg-green-50 dark:bg-green-950/30'
              : 'bg-red-50 dark:bg-red-950/30'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {growthPositive
                ? <TrendingUp className="h-4 w-4 text-green-600" />
                : <TrendingDown className="h-4 w-4 text-red-600" />
              }
              <span className="text-xs text-muted-foreground">Crecimiento</span>
            </div>
            <p className={`text-2xl font-bold ${growthPositive ? 'text-green-600' : 'text-red-600'}`}>
              {growthPositive ? '+' : ''}{metrics?.growth || 0}%
            </p>
            <p className="text-xs text-muted-foreground">vs año anterior</p>
          </div>

          {/* Retención */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Retención</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {metrics?.retentionRate?.rate?.toFixed(0) || 0}%
            </p>
            <p className="text-xs text-muted-foreground">mes actual</p>
          </div>
        </div>

        {/* Secondary metrics row */}
        <div className="flex justify-between items-center py-2 border-t border-b border-border/50 mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              <span className="font-semibold text-green-600">{metrics?.newClients?.count || 0}</span>
              <span className="text-muted-foreground ml-1">nuevos</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-red-500" />
            <span className="text-sm">
              <span className="font-semibold text-red-600">{metrics?.clientChurn?.count || 0}</span>
              <span className="text-muted-foreground ml-1">perdidos</span>
            </span>
          </div>
          {(metrics?.activeAlerts || 0) > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {metrics?.activeAlerts}
            </Badge>
          )}
        </div>

        {/* Action button */}
        <Button
          onClick={onNavigate}
          className="w-full"
          variant={accentColor === 'green' ? 'default' : 'secondary'}
        >
          Ver análisis completo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function CompanyComparisonCards() {
  const [, setLocation] = useLocation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <CompanyCard
        companyId={1}
        companyName="DURA International"
        logoUrl="/logodura.jpg"
        accentColor="green"
        onNavigate={() => setLocation('/sales/dura')}
      />
      <CompanyCard
        companyId={2}
        companyName="Grupo ORSEGA"
        logoUrl="/logo orsega.jpg"
        accentColor="purple"
        onNavigate={() => setLocation('/sales/orsega')}
      />
    </div>
  );
}
