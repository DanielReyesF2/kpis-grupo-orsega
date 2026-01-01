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

        {/* ============================================
            SECCIÓN 1: KPIs PRINCIPALES - Vista Ejecutiva
            ============================================ */}
        <section className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-1 w-12 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Resumen Ejecutivo
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Métricas clave de rendimiento para toma de decisiones
                </p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            {/* Contenedor con fondo sutil para agrupar visualmente */}
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-muted/20 via-muted/10 to-transparent border border-border/40 backdrop-blur-sm">
              <ExecutiveKPICards companyId={selectedCompany} />
            </div>
          </motion.div>
        </section>

        {/* Separador visual entre secciones */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-16" />

        {/* ============================================
            SECCIÓN 2: ANÁLISIS DE TENDENCIAS
            ============================================ */}
        <section className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Evolución de Ventas
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Tendencias mensuales y comparativas anuales
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Gráfico principal de tendencias - Ocupa 2 columnas en XL */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="xl:col-span-2"
            >
              <SalesTrendChart companyId={selectedCompany} months={12} />
            </motion.div>

            {/* Comparativo anual - 1 columna en XL */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="xl:col-span-1"
            >
              <YearlyTotalsBarChart
                companyId={selectedCompany}
                variant="compact"
              />
            </motion.div>
          </div>
        </section>

        {/* Separador visual entre secciones */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-16" />

        {/* ============================================
            SECCIÓN 3: ANÁLISIS DETALLADO
            ============================================ */}
        <section className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-1 w-12 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Análisis Detallado
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Top productos, clientes y rankings por período
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Productos - Mes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <TopProductsChart
                companyId={selectedCompany}
                limit={5}
                period="month"
                variant="compact"
              />
            </motion.div>

            {/* Top Productos - Año */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <TopProductsChart
                companyId={selectedCompany}
                limit={5}
                period="year"
                variant="compact"
              />
            </motion.div>

            {/* Top Clientes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <TopClientsChart
                companyId={selectedCompany}
                limit={5}
                period="year"
                variant="compact"
              />
            </motion.div>
          </div>
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
