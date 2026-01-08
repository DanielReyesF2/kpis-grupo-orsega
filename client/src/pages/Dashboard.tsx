import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarChart3 } from 'lucide-react';

// Salesforce components
import { PageHeader } from '@/components/salesforce/layout/PageHeader';

// Dashboard components
import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { SalesOverviewCard } from '@/components/dashboard/SalesOverviewCard';
import { OrderStatsCard } from '@/components/dashboard/OrderStatsCard';
import { AnnualSummary } from '@/components/dashboard/AnnualSummary';

export default function Dashboard() {
  const { user } = useAuth();
  const dashboardRef = React.useRef<HTMLDivElement>(null);

  // Company selection
  const [selectedCompany, setSelectedCompany] = useState<number>(() => {
    const storedCompany = localStorage.getItem('selectedCompanyId');
    return storedCompany ? Number(storedCompany) : 1;
  });

  // Listen to company changes from sidebar
  React.useEffect(() => {
    const handleCompanyChange = (event: CustomEvent) => {
      const { companyId } = event.detail;
      setSelectedCompany(companyId);
      localStorage.setItem('selectedCompanyId', String(companyId));
    };

    window.addEventListener('companyChanged', handleCompanyChange as EventListener);
    return () => {
      window.removeEventListener('companyChanged', handleCompanyChange as EventListener);
    };
  }, []);

  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);

  return (
    <AppLayout title="Dashboard Ejecutivo">
      <div id="dashboard-container" ref={dashboardRef} className="min-h-screen space-y-6">
        {/* Page Header */}
        <PageHeader
          objectIcon={BarChart3}
          title="Dashboard Ejecutivo"
          subtitle={`Vista general de KPIs y métricas de ventas${user ? ` - ${user.name}` : ''}`}
          breadcrumbs={[
            { label: 'Inicio', href: '/' },
            { label: 'Dashboard' },
          ]}
        />

        {/* SECCIÓN PRINCIPAL - Vista ejecutiva */}
        <div className="grid grid-cols-12 gap-4">
          {/* Resumen de Ventas - Ocupa más espacio */}
          <div className="col-span-12 lg:col-span-7">
            <SalesOverviewCard companyId={selectedCompany} />
          </div>

          {/* Estadísticas de Órdenes - Gráfica circular */}
          <div className="col-span-12 lg:col-span-5">
            <OrderStatsCard companyId={selectedCompany} />
          </div>

          {/* Resumen Anual Ejecutivo - Hasta Tendencias Mensuales */}
          <div className="col-span-12">
            <AnnualSummary companyId={selectedCompany} />
          </div>
        </div>

        {/* KPI Details Dialog */}
        <KpiDetailDialog
          kpiId={selectedKpiId}
          isOpen={isKpiModalOpen}
          onClose={() => setIsKpiModalOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
