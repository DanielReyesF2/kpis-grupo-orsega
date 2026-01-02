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
import { SalesOverviewCard } from '@/components/dashboard/SalesOverviewCard';
import { OrderStatsCard } from '@/components/dashboard/OrderStatsCard';
import { CompactKPICards } from '@/components/dashboard/CompactKPICards';
import { SalesBySourceCard } from '@/components/dashboard/SalesBySourceCard';
import { ProfitabilityByProductsCard } from '@/components/dashboard/ProfitabilityByProductsCard';

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

        {/* Header con selector */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1" />
          <CompanySelector
            selectedCompany={selectedCompany}
            onChange={handleCompanyChange}
          />
        </div>

        {/* Layout principal: Grid denso estilo dashboard moderno */}
        <div className="grid grid-cols-12 gap-4 auto-rows-min">
          {/* Invoice Overview - Top Left (5 columnas) */}
          <div className="col-span-12 lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SalesOverviewCard companyId={selectedCompany} />
            </motion.div>
          </div>

          {/* Order Stats - Top Right (4 columnas) */}
          <div className="col-span-12 lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <OrderStatsCard companyId={selectedCompany} />
            </motion.div>
          </div>

          {/* KPIs Compactos - Top Right (3 columnas) */}
          <div className="col-span-12 lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <CompactKPICards companyId={selectedCompany} />
            </motion.div>
          </div>

          {/* Sales By Source - Bottom Left (5 columnas) */}
          <div className="col-span-12 lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <SalesBySourceCard companyId={selectedCompany} />
            </motion.div>
          </div>

          {/* Rentabilidad por Productos - Bottom Right (7 columnas) */}
          <div className="col-span-12 lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <ProfitabilityByProductsCard companyId={selectedCompany} />
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
