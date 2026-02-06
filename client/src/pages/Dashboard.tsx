import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/AppLayout';

// Dashboard components - Análisis Profundo Mensual (estilo Nova)
import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { MonthYearSelector } from '@/components/dashboard/MonthYearSelector';
import { MonthlyKPICards } from '@/components/dashboard/MonthlyKPICards';
import { MonthlyTrendCard } from '@/components/dashboard/MonthlyTrendCard';
import { RiskAlertsCard } from '@/components/dashboard/RiskAlertsCard';
import { ClientAnalysisCard } from '@/components/dashboard/ClientAnalysisCard';
import { ProductAnalysisCard } from '@/components/dashboard/ProductAnalysisCard';
import { AnomaliesCard } from '@/components/dashboard/AnomaliesCard';
import { ClientEfficiencyCard } from '@/components/dashboard/ClientEfficiencyCard';
import { DerivedKPIsCard } from '@/components/dashboard/DerivedKPIsCard';
import { StrategicRecommendationsCard } from '@/components/dashboard/StrategicRecommendationsCard';
import { AIInsightsBanner } from '@/components/dashboard/AIInsightsBanner';

import { DollarSign, Users, BarChart3, Activity, Lightbulb } from 'lucide-react';


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

  // Period selection
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);

  return (
    <AppLayout title="Dashboard Ejecutivo">
      <div id="dashboard-container" ref={dashboardRef} className="min-h-screen space-y-8">
        {/* Period Selector */}
        <MonthYearSelector
          companyId={selectedCompany}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
        />

        {/* AI Insights Banner */}
        <AIInsightsBanner companyId={selectedCompany} />

        {/* SECTION 1: Desempeño Financiero */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Desempeño Financiero
          </h2>
          <MonthlyKPICards
            companyId={selectedCompany}
            year={selectedYear}
            month={selectedMonth}
          />
        </section>

        {/* SECTION 2: Análisis Comercial */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Análisis Comercial
          </h2>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-7">
              <ClientAnalysisCard
                companyId={selectedCompany}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <ProductAnalysisCard
                companyId={selectedCompany}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: Tendencias y Patrones */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendencias y Patrones
          </h2>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-8">
              <MonthlyTrendCard
                companyId={selectedCompany}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <AnomaliesCard
                companyId={selectedCompany}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
          </div>
        </section>

        {/* SECTION 4: Indicadores de Salud */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Indicadores de Salud
          </h2>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <ClientEfficiencyCard
                companyId={selectedCompany}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
            <div className="col-span-12 lg:col-span-6">
              <DerivedKPIsCard
                companyId={selectedCompany}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
          </div>
        </section>

        {/* SECTION 5: Riesgo y Recomendaciones */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Riesgo y Recomendaciones
          </h2>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-5">
              <RiskAlertsCard companyId={selectedCompany} />
            </div>
            <div className="col-span-12 lg:col-span-7">
              <StrategicRecommendationsCard companyId={selectedCompany} />
            </div>
          </div>
        </section>

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
