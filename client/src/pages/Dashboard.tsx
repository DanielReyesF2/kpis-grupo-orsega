import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { FiltersBar } from '@/components/dashboard/FiltersBar';
import type { Company, Kpi, KpiValue, KpiDetail } from '@shared/schema';

import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { FilteredKpisModal } from '@/components/kpis/FilteredKpisModal';
import { SalesSummary } from '@/components/dashboard/SalesSummary';
import { CompanyComparisonCards } from '@/components/dashboard/CompanyComparisonCards';
import { ExchangeRateCards } from '@/components/dashboard/ExchangeRateCards';
import { LogisticsPreview } from '@/components/dashboard/LogisticsPreview';
import { ExchangeRateForm } from '@/components/treasury/common/ExchangeRateForm';
import { SalesVolumeChart } from '@/components/kpis/SalesVolumeChart';
import { YearlyTotalsBarChart } from '@/components/dashboard/YearlyTotalsBarChart';
import { TopClientsChart } from '@/components/dashboard/TopClientsChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Importación de ShipmentCarbonFootprint eliminada a petición del usuario
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateAndTime } from '@/lib/utils/dates';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUp, 
  DollarSign, 
  ListFilter,
  Package,
  AlertTriangle,
  BadgeCheck,
  Clock,
  MapPin,
  Leaf,
  Target
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  // Referencia para capturar el dashboard para exportar a PDF
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  // Estado específico para la compañía seleccionada, usando localStorage para persistencia
  const [selectedCompany, setSelectedCompany] = useState<number>(() => {
    // Intentar recuperar la compañía seleccionada del localStorage
    const storedCompany = localStorage.getItem('selectedCompanyId');
    return storedCompany ? Number(storedCompany) : 2; // Por defecto, Grupo Orsega (ID: 2)
  });
  
  const [filters, setFilters] = useState({
    companyId: selectedCompany,
    areaId: undefined,
    status: undefined,
    period: undefined,
  });
  
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'charts' | 'details'>('charts');
  
  // Estado para el modal de KPIs filtrados
  const [isFilteredKpisModalOpen, setIsFilteredKpisModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'complies' | 'alert' | 'not_compliant' | 'all' | undefined>(undefined);
  
  // Estado para la empresa seleccionada en el gráfico de histórico de ventas (dentro del div de bienvenida)
  const [selectedChartCompany, setSelectedChartCompany] = useState<number>(1); // Por defecto Dura

  // Estado para el formulario de tipos de cambio
  const [showRateForm, setShowRateForm] = useState(false);
  const [formSource, setFormSource] = useState<string | undefined>(undefined);

  // Fetch all companies with optimized refresh
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    staleTime: 5 * 60 * 1000, // Los datos son válidos por 5 minutos
    refetchInterval: 30000, // Refrescar cada 30 segundos (reducido desde 5s)
    refetchOnWindowFocus: false, // Deshabilitado para reducir requests
    enabled: !!user, // Solo ejecutar cuando el usuario esté autenticado
  });

  // Fetch all KPIs with their latest values and optimized refresh
  const { data: kpis, isLoading: isLoadingKpis } = useQuery<Kpi[]>({
    queryKey: ['/api/kpis'],
    staleTime: 2 * 60 * 1000, // Los datos son válidos por 2 minutos
    refetchInterval: 20000, // Refrescar cada 20 segundos (reducido desde 5s)
    refetchOnWindowFocus: false, // Deshabilitado para reducir requests
    enabled: !!user, // Solo ejecutar cuando el usuario esté autenticado
  });

  // Fetch all KPI values with balanced refresh - crucial para ver actualizaciones de otros usuarios
  const { data: kpiValues, isLoading: isLoadingKpiValues } = useQuery<KpiValue[]>({
    queryKey: ['/api/kpi-values'],
    staleTime: 1 * 60 * 1000, // Los datos son válidos por 1 minuto
    refetchInterval: 15000, // Refrescar cada 15 segundos (reducido desde 5s)
    refetchOnWindowFocus: false, // Deshabilitado para reducir requests
    enabled: !!user, // Solo ejecutar cuando el usuario esté autenticado
  });

  // Get filtered KPIs with their latest values
  const getFilteredKpisWithValues = (): KpiDetail[] => {
    if (!kpis || !kpiValues) return [];
    
    // Asegurarse que kpis es un array
    if (!Array.isArray(kpis)) return [];
    
    // Asegurarse que kpiValues es un array
    if (!Array.isArray(kpiValues)) return [];
    
    // Filtrar KPIs solo para la compañía seleccionada y eliminar duplicados basados en ID
    const companyKpis = kpis.filter((kpi: Kpi) => kpi.companyId === Number(filters.companyId));
    const uniqueKpis = Array.from(new Map(companyKpis.map((kpi: Kpi) => [kpi.id, kpi])).values());
    
    return uniqueKpis.map((kpi: Kpi) => {
      // Find values for this KPI
      const values = kpiValues.filter((value: KpiValue) => value.kpiId === kpi.id);
      
      // Filter by period if specified
      const filteredValues = filters.period && filters.period !== 'all'
        ? values.filter((value: KpiValue) => value.period === filters.period)
        : values;
      
      if (!filteredValues || filteredValues.length === 0) return null;
      
      // Ordenar todos los valores por fecha, más reciente primero
      const sortedValues = filteredValues.sort((a: KpiValue, b: KpiValue) => {
        const dateA = new Date(a.date || '').getTime();
        const dateB = new Date(b.date || '').getTime();
        return dateB - dateA;
      });
      
      // Usar el valor más reciente
      const latestValue = sortedValues[0];
      
      // Filter by status if specified
      if (filters.status && filters.status !== 'all' && latestValue.status !== filters.status) return null;
      
      // Filter by area if specified
      if (filters.areaId && kpi.areaId !== filters.areaId) return null;
      
      return {
        id: kpi.id,
        name: kpi.name,
        status: latestValue.status as 'complies' | 'alert' | 'not_compliant',
        value: latestValue.value,
        compliancePercentage: latestValue.compliancePercentage,
        target: kpi.target,
        period: latestValue.period,
        comments: latestValue.comments
      };
    }).filter(Boolean) as KpiDetail[];
  };

  const filteredKpis = getFilteredKpisWithValues();
  
  // Get filtered companies based on companyId filter
  const filteredCompanies = companies 
    ? filters.companyId 
      ? companies.filter((company: Company) => company.id === filters.companyId)
      : companies
    : [];

  // Handler for changing filters
  const handleFilterChange = (newFilters: any) => {
    console.log("Cambiando filtros:", newFilters);
    // Si se está cambiando la compañía, tratarla de manera especial
    if ('companyId' in newFilters) {
      const newCompanyId = Number(newFilters.companyId);
      console.log("Cambiando compañía a:", newCompanyId);
      
      // Guardar la selección en localStorage para persistencia
      localStorage.setItem('selectedCompanyId', String(newCompanyId));
      
      // Forzar una actualización completa para asegurar que toda la UI refleje el cambio de compañía
      // Actualizar ambos estados
      setSelectedCompany(newCompanyId);
      setFilters(prev => ({
        ...prev,
        companyId: newCompanyId
      }));

      // Registrar el cambio para validar
      console.log(`CompanyId actualizado en filters: ${newCompanyId}`);
    } else {
      // Para otros filtros, actualizar normalmente
      setFilters(prev => {
        const updated = {
          ...prev,
          ...newFilters
        };
        console.log("Filtros actualizados:", updated);
        return updated;
      });
    }
  };

  // Handler for viewing KPI details
  const handleViewKpiDetails = (kpiId: number) => {
    setSelectedKpiId(kpiId);
    setIsKpiModalOpen(true);
  };

  // Get last updated date with time
  const getLastUpdatedDate = () => {
    if (!kpiValues || kpiValues.length === 0) return 'N/A';
    
    const dates = kpiValues.map((value: KpiValue) => new Date(value.date || ''));
    const latestDate = new Date(Math.max(...dates.map((date: Date) => date.getTime())));
    
    return formatDateAndTime(latestDate);
  };

  // Determinar si se está cargando el panel
  const isLoading = isLoadingCompanies || isLoadingKpis || isLoadingKpiValues;
  
  return (
    <AppLayout title="Panel de Control">
      <div id="dashboard-container" ref={dashboardRef}>
      {/* Filters Bar (Oculto) */}
      <FiltersBar onFilterChange={handleFilterChange} />
      
      {/* Header con stats rápidas */}
      <div className="relative mb-6 sm:mb-10 overflow-hidden rounded-lg sm:rounded-xl bg-card border border-border p-4 sm:p-8 shadow-md">
        <div className="relative">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-2 leading-tight">
              <span className="text-primary">Hola {user?.name?.split(' ')[0] || 'Usuario'}</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              Bienvenido a tu Sistema Digital de Gestión
            </p>
          </div>
          
          {/* Comparativa de ambas empresas - Hub principal */}
          <div className="mb-6 sm:mb-8" data-onboarding="company-comparison">
            <CompanyComparisonCards />
          </div>

          {/* Selector de empresa para gráficos detallados */}
          <div className="flex justify-center gap-3 mb-4">
            <button
              onClick={() => setSelectedChartCompany(1)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedChartCompany === 1
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-muted text-foreground opacity-70 hover:opacity-100 border border-border'
              }`}
            >
              DURA - Ventas mensuales
            </button>
            <button
              onClick={() => setSelectedChartCompany(2)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedChartCompany === 2
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-muted text-foreground opacity-70 hover:opacity-100 border border-border'
              }`}
            >
              ORSEGA - Ventas mensuales
            </button>
          </div>

          {/* Gráfico de Histórico de Ventas - Se muestra según la empresa seleccionada */}
          <div className="mt-6" data-onboarding="sales-chart">
            <Tabs value={selectedChartCompany.toString()} onValueChange={(value) => setSelectedChartCompany(Number(value))}>
              <TabsContent value="1" className="mt-0">
                <SalesVolumeChart
                  companyId={1}
                  kpiId={39}
                  target="55620"
                  limit={12}
                  showControls={true}
                />
              </TabsContent>
              <TabsContent value="2" className="mt-0">
                <SalesVolumeChart
                  companyId={2}
                  kpiId={1}
                  target="858373"
                  limit={12}
                  showControls={true}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Panorama Histórico de Ventas por Año */}
          <div className="mt-8" data-onboarding="yearly-chart">
            <YearlyTotalsBarChart companyId={selectedChartCompany} />
          </div>

          {/* Top Clientes y Top Productos */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6" data-onboarding="top-charts">
            <TopClientsChart companyId={selectedChartCompany} limit={5} />
            <TopProductsChart companyId={selectedChartCompany} limit={5} />
          </div>

        </div>
      </div>

      {/* Comparativa de Tipos de Cambio */}
      <div className="mb-6 sm:mb-10" data-onboarding="exchange-rates">
        <ExchangeRateCards
          onUpdateRate={(source) => {
            setFormSource(source);
            setShowRateForm(true);
          }}
        />
      </div>

      {/* Modal de formulario para actualizar tipo de cambio */}
      <ExchangeRateForm
        isOpen={showRateForm}
        onClose={() => {
          setShowRateForm(false);
          setFormSource(undefined);
        }}
        source={formSource}
      />

      {/* Preview de Logística */}
      <div className="mb-6 sm:mb-10" data-onboarding="logistics-preview">
        <LogisticsPreview />
      </div>

      
      {/* Sección de Huella de Carbono eliminada a petición del usuario - ahora solo mostrada en la página de trazabilidad de envíos */}
      

      
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
        kpis={filteredKpis}
        onViewKpiDetails={handleViewKpiDetails}
      />
      
      </div>
    </AppLayout>
  );
}
