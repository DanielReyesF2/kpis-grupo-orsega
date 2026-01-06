/**
 * Dashboard de Ventas - Rediseñado completamente con datos reales
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Users, Target, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

// Salesforce components
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";

// New components
import { SalesKPICard } from "./SalesKPICard";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { MonthlyTrendsChart } from "./MonthlyTrendsChart";
import { TopClientsTable } from "./TopClientsTable";
import { TopProductsTable } from "./TopProductsTable";
import { YearlyComparisonChart } from "./YearlyComparisonChart";
import { ClientTrendsTable } from "./ClientTrendsTable";

// KPIS Modal
import { SalesAnalyst } from "../analyst/SalesAnalyst";

interface SalesDashboardProps {
  companyId?: number;
}

export function SalesDashboard({ companyId }: SalesDashboardProps) {
  // Usar directamente companyId del prop (viene del contexto/URL)
  const resolvedCompanyId = companyId || 1;
  
  // Estado para el modal de KPIS
  const [showKPIsModal, setShowKPIsModal] = useState(false);

  // Fetch sales stats for KPIs
  const { data: salesStats, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['/api/sales-stats', resolvedCompanyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-stats?companyId=${resolvedCompanyId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch sales stats: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch monthly trends to calculate total revenue
  const { data: monthlyTrends } = useQuery({
    queryKey: ['/api/sales-monthly-trends', resolvedCompanyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-monthly-trends?companyId=${resolvedCompanyId}`);
      if (!res.ok) {
        return [];
      }
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate total revenue from monthly trends
  const totalRevenue = monthlyTrends?.reduce((sum: number, month: any) => sum + (month.amount || 0), 0) || 0;

  // Calculate growth percentage
  const growthPercent = salesStats?.growth || 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        objectIcon={TrendingUp}
        title="Dashboard de Ventas"
        subtitle="Vista general de pipeline, objetivos y distribución de ventas"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas', href: '/sales' },
          { label: 'Dashboard' },
        ]}
        actions={[
          {
            label: "KPIS",
            onClick: () => {
              setShowKPIsModal(true);
            },
            variant: "default" as const,
            icon: Target,
            primary: true
          }
        ]}
      />

      {/* KPIs Principales - Grid 4 columnas */}
      {isLoadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : statsError ? (
        <ErrorState variant="page" message="Error al cargar métricas de ventas" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SalesKPICard
            title="Revenue Total"
            value={formatCurrency(totalRevenue, resolvedCompanyId)}
            subtitle={`${formatNumber(salesStats?.currentVolume || 0)} ${salesStats?.unit || 'KG'} vendidos`}
            icon={DollarSign}
            trend={growthPercent !== undefined ? {
              value: growthPercent,
              label: "vs período anterior"
            } : undefined}
            variant="success"
          />
          <SalesKPICard
            title="Clientes Activos"
            value={salesStats?.activeClients || 0}
            subtitle={`${salesStats?.activeClientsMetrics?.last3Months || 0} últimos 3 meses`}
            icon={Users}
            variant="default"
          />
          <SalesKPICard
            title="Crecimiento"
            value={`${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%`}
            subtitle="vs período anterior"
            icon={TrendingUp}
            variant={growthPercent >= 0 ? "success" : "danger"}
          />
          <SalesKPICard
            title="Retención"
            value={`${(salesStats?.retentionRate?.rate || 0).toFixed(1)}%`}
            subtitle={`${salesStats?.retentionRate?.retainedClients || 0} clientes retenidos`}
            icon={Target}
            variant="default"
          />
        </div>
      )}

      {/* Comparativo Anual */}
      <YearlyComparisonChart companyId={resolvedCompanyId} />

      {/* Top Clientes y Top Productos - Grid 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopClientsTable companyId={resolvedCompanyId} limit={10} period="year" />
        <TopProductsTable companyId={resolvedCompanyId} limit={10} period="year" />
      </div>

      {/* Tendencias Mensuales */}
      <MonthlyTrendsChart companyId={resolvedCompanyId} />

      {/* Tendencias de Clientes */}
      <ClientTrendsTable companyId={resolvedCompanyId} limit={10} />

      {/* Modal de KPIS */}
      <div 
        className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ease-out ${
          showKPIsModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Overlay */}
        <div 
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            showKPIsModal ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setShowKPIsModal(false)}
        />
        
        {/* Panel lateral */}
        <div 
          className={`absolute right-0 top-0 bottom-0 w-full max-w-5xl bg-background shadow-2xl overflow-y-auto transition-transform duration-300 ease-out ${
            showKPIsModal ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header del modal */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Panel de KPIs</h2>
                <p className="text-sm text-white/80">Análisis estratégico con IA</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowKPIsModal(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Contenido del modal */}
          <div className="p-6">
            {showKPIsModal && <SalesAnalyst companyId={resolvedCompanyId} embedded={true} />}
          </div>
        </div>
      </div>
    </div>
  );
}
