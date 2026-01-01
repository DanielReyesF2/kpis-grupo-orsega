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
      <div id="dashboard-container" ref={dashboardRef}>
        {/* Filters Bar (Oculto) */}
        <FiltersBar onFilterChange={handleFilterChange} />

        {/* Header Premium con gradiente y sombra */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-8 overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/60 p-6 shadow-lg"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Saludo personalizado */}
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Hola, {user?.name?.split(' ')[0] || 'Usuario'}
              </h1>
              <p className="text-muted-foreground mt-1">Bienvenido a tu Dashboard Ejecutivo</p>
            </div>

            {/* Selector de empresa elegante */}
            <CompanySelector
              selectedCompany={selectedCompany}
              onChange={handleCompanyChange}
            />
          </div>
        </motion.div>

        {/* KPIs Principales con animación escalonada */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ExecutiveKPICards companyId={selectedCompany} />
        </motion.div>

        {/* Gráfico de Tendencias - Card grande premium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8"
        >
          <SalesTrendChart companyId={selectedCompany} months={12} />
        </motion.div>

        {/* Grid de Rankings con hover effects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <TopProductsChart
            companyId={selectedCompany}
            limit={5}
            period="month"
            variant="compact"
          />
          <TopProductsChart
            companyId={selectedCompany}
            limit={5}
            period="year"
            variant="compact"
          />
          <TopClientsChart
            companyId={selectedCompany}
            limit={5}
            period="year"
            variant="compact"
          />
          <YearlyTotalsBarChart
            companyId={selectedCompany}
            variant="compact"
          />
        </motion.div>

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
