import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/AppLayout';

// Dashboard components - Monthly Executive Snapshot
import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { MonthlyKPICards } from '@/components/dashboard/MonthlyKPICards';
import { MonthlyTrendCard } from '@/components/dashboard/MonthlyTrendCard';
import { RiskAlertsCard } from '@/components/dashboard/RiskAlertsCard';
import { MonthlyTopClientsCard, MonthlyTopProductsCard } from '@/components/dashboard/MonthlyTopListsCard';
import { AIInsightsBanner } from '@/components/dashboard/AIInsightsBanner';


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
        {/* ROW 1: KPIs del mes */}
        <MonthlyKPICards companyId={selectedCompany} />

        {/* ROW 2: Tendencia + Alertas de Riesgo */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7">
            <MonthlyTrendCard companyId={selectedCompany} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <RiskAlertsCard companyId={selectedCompany} />
          </div>
        </div>

        {/* ROW 3: Top Clientes + Top Productos del Mes */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6">
            <MonthlyTopClientsCard companyId={selectedCompany} />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <MonthlyTopProductsCard companyId={selectedCompany} />
          </div>
        </div>

        {/* ROW 4: AI Insights Banner */}
        <AIInsightsBanner companyId={selectedCompany} />

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
