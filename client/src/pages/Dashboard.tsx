import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQueryClient } from '@tanstack/react-query';
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
import { AIInsightsWidget } from '@/components/dashboard/AIInsightsWidget';
import { SalesExcelUploader } from '@/components/sales/SalesExcelUploader';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { DollarSign, Users, BarChart3, Activity, Lightbulb, Upload } from 'lucide-react';


export default function Dashboard() {
  const { user } = useAuth();
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);

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
        {/* Header: Period Selector + Upload Button */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <MonthYearSelector
            companyId={selectedCompany}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
          />

          {/* Upload Button */}
          <Sheet open={isUploaderOpen} onOpenChange={setIsUploaderOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="w-4 h-4" />
                Actualizar Datos
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Actualizar Ventas</SheetTitle>
                <SheetDescription>
                  Sube tu archivo Excel para actualizar los datos de ventas
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <SalesExcelUploader
                  companyId={selectedCompany}
                  onUploadComplete={(result) => {
                    if (result.success) {
                      // Invalidate and refetch all dashboard queries
                      queryClient.invalidateQueries({ queryKey: ['/api/monthly-financial-summary'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/sales-analyst'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/sales-data'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/annual-summary'] });
                      // Close drawer after short delay
                      setTimeout(() => setIsUploaderOpen(false), 2000);
                    }
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

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
            <div className="col-span-12 lg:col-span-4">
              <RiskAlertsCard companyId={selectedCompany} />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <AIInsightsWidget companyId={selectedCompany} />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <StrategicRecommendationsCard companyId={selectedCompany} year={selectedYear} month={selectedMonth} />
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
