import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';

// Dashboard components - Análisis Profundo Mensual (estilo Nova)
import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { MonthYearSelector } from '@/components/dashboard/MonthYearSelector';
import { MonthlyKPICards } from '@/components/dashboard/MonthlyKPICards';
import { MonthlyTrendCard } from '@/components/dashboard/MonthlyTrendCard';
import { ClientAnalysisCard } from '@/components/dashboard/ClientAnalysisCard';
import { ProductAnalysisCard } from '@/components/dashboard/ProductAnalysisCard';
import { AnomaliesCard } from '@/components/dashboard/AnomaliesCard';
import { ClientEfficiencyCard } from '@/components/dashboard/ClientEfficiencyCard';
import { DerivedKPIsCard } from '@/components/dashboard/DerivedKPIsCard';
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

import { DollarSign, Users, BarChart3, Activity, Upload, Brain, ArrowRight } from 'lucide-react';


export default function Dashboard() {
  const { user } = useAuth();
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
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

        {/* SECTION 5: Acceso rapido al Analisis de Tendencias */}
        <section>
          <div
            onClick={() => navigate('/trends-analysis')}
            className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-white cursor-pointer hover:shadow-xl transition-all hover:scale-[1.01] group"
          >
            {/* Patron decorativo */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-white rounded-full translate-x-1/4 translate-y-1/4"></div>
            </div>

            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Analisis de Tendencias</h3>
                  <p className="text-purple-100 text-sm">
                    Tendencias historicas, clientes prioritarios y acciones semanales con IA
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm group-hover:bg-white group-hover:text-purple-600 transition-all"
              >
                Ir al Analisis
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
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
