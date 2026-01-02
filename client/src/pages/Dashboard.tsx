import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { FiltersBar } from '@/components/dashboard/FiltersBar';
import { motion } from 'framer-motion';

import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { FilteredKpisModal } from '@/components/kpis/FilteredKpisModal';
import { CompanySelector } from '@/components/dashboard/CompanySelector';
import { ExecutiveKPICards } from '@/components/dashboard/ExecutiveKPICards';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { YearlyTotalsBarChart } from '@/components/dashboard/YearlyTotalsBarChart';
import { TopClientsChart } from '@/components/dashboard/TopClientsChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';
import { ProfitabilityMetrics } from '@/components/dashboard/ProfitabilityMetrics';
import { AnnualSummary } from '@/components/dashboard/AnnualSummary';

export default function Dashboard() {
  const { user } = useAuth();
  // Referencia para capturar el dashboard para exportar a PDF
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  
  // Estado simplificado para la compañía seleccionada
  const [selectedCompany, setSelectedCompany] = useState<number>(() => {
    const storedCompany = localStorage.getItem('selectedCompanyId');
    return storedCompany ? Number(storedCompany) : 1; // Por defecto DURA
  });
  
  const [filters, setFilters] = useState({
    companyId: selectedCompany,
    areaId: undefined,
    status: undefined,
    period: undefined,
  });
  
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [isFilteredKpisModalOpen, setIsFilteredKpisModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'complies' | 'alert' | 'not_compliant' | 'all' | undefined>(undefined);

  // Handler para cambio de empresa
  const handleCompanyChange = (companyId: number) => {
    localStorage.setItem('selectedCompanyId', String(companyId));
    setSelectedCompany(companyId);
    setFilters(prev => ({ ...prev, companyId }));
  };

  // Handler for changing filters
  const handleFilterChange = (newFilters: any) => {
    if ('companyId' in newFilters) {
      const newCompanyId = Number(newFilters.companyId);
      handleCompanyChange(newCompanyId);
    } else {
      setFilters(prev => ({ ...prev, ...newFilters }));
    }
  };

  // Handler for viewing KPI details
  const handleViewKpiDetails = (kpiId: number) => {
    setSelectedKpiId(kpiId);
    setIsKpiModalOpen(true);
  };

  return (
    <AppLayout title="Dashboard Ejecutivo">
      <div id="dashboard-container" ref={dashboardRef} className="min-h-screen">
        {/* Filters Bar (Oculto) */}
        <FiltersBar onFilterChange={handleFilterChange} />

        {/* Header elegante con selector */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex-1" />
          <CompanySelector
            selectedCompany={selectedCompany}
            onChange={handleCompanyChange}
          />
        </div>

        {/* Layout principal: Grid asimétrico optimizado */}
        <div className="grid grid-cols-12 gap-6 auto-rows-min">
          {/* Columna izquierda: KPIs principales (8 columnas) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* KPIs Principales - Grid optimizado */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ExecutiveKPICards companyId={selectedCompany} />
            </motion.div>

            {/* Gráfico de tendencias principal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <SalesTrendChart companyId={selectedCompany} months={12} />
            </motion.div>

            {/* Rankings en grid 2x1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <TopProductsChart
                  companyId={selectedCompany}
                  limit={5}
                  period="month"
                  variant="compact"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <TopProductsChart
                  companyId={selectedCompany}
                  limit={5}
                  period="year"
                  variant="compact"
                />
              </motion.div>
            </div>
          </div>

          {/* Columna derecha: Sidebar con métricas complementarias (4 columnas) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Comparativo anual - Sticky en desktop */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="lg:sticky lg:top-6"
            >
              <YearlyTotalsBarChart
                companyId={selectedCompany}
                variant="compact"
              />
            </motion.div>

            {/* Top Clientes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <TopClientsChart
                companyId={selectedCompany}
                limit={5}
                period="year"
                variant="compact"
              />
            </motion.div>
          </div>
        </div>

        {/* Métricas de Rentabilidad Detalladas */}
        <section className="mt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ProfitabilityMetrics companyId={selectedCompany} />
          </motion.div>
        </section>

        {/* Resumen Anual Ejecutivo */}
        <section className="mt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <AnnualSummary companyId={selectedCompany} />
          </motion.div>
        </section>

        {/* KPI Details Dialog */}
        <KpiDetailDialog
          kpiId={selectedKpiId}
          isOpen={isKpiModalOpen}
          onClose={() => setIsKpiModalOpen(false)}
        />

        {/* Filtered KPIs Modal */}
        <FilteredKpisModal
          isOpen={isFilteredKpisModalOpen}
          onClose={() => setIsFilteredKpisModalOpen(false)}
          status={selectedStatus}
          kpis={[]}
          onViewKpiDetails={handleViewKpiDetails}
        />
      </div>
    </AppLayout>
  );
}
