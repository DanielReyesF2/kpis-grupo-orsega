import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { FiltersBar } from '@/components/dashboard/FiltersBar';
import type { Company, Kpi, KpiValue, KpiDetail } from '@shared/schema';

import { KpiDetailDialog } from '@/components/kpis/KpiDetailDialog';
import { FilteredKpisModal } from '@/components/kpis/FilteredKpisModal';
import { SalesSummary } from '@/components/dashboard/SalesSummary';
import { ExchangeRateCards } from '@/components/dashboard/ExchangeRateCards';
import { DashboardOnboardingDialog } from '@/components/dashboard/DashboardOnboardingDialog';

// Importación de ShipmentCarbonFootprint eliminada a petición del usuario
import { CompanySelector } from '@/components/dashboard/CompanySelector';
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
  Leaf
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
  
  // Estado para el onboarding del dashboard
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  // Verificar si el usuario ya completó el onboarding
  useEffect(() => {
    const completed = localStorage.getItem('dashboard_onboarding_completed');
    if (!completed) {
      setIsOnboardingOpen(true);
    }
  }, []);

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
      <div className="relative mb-6 sm:mb-10 overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-r from-[#273949] to-[#1a2a36] p-4 sm:p-8 shadow-lg dark:from-[#15202b] dark:to-[#0d1117]">
        <div className="absolute inset-0 bg-grid-white/10 bg-[length:20px_20px] [mask-image:linear-gradient(to_bottom,white_20%,transparent_60%)]"></div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#b5e951]/20 to-transparent"></div>
        
        <div className="relative">
          <h2 className="mb-2 sm:mb-3 text-xl sm:text-2xl md:text-3xl font-bold text-white">
            Hola {user?.name?.split(' ')[0] || 'Usuario'}, bienvenido a tu Sistema Digital de Gestión
          </h2>
          <p className="mb-4 sm:mb-6 max-w-2xl text-sm sm:text-base text-white/90 leading-relaxed">
            Aquí podrás ver los KPIs de tus colaboradores y tener acceso a datos en tiempo real 
            para que puedas tomar decisiones informadas. <span className="font-semibold text-white">¿Qué te gustaría ver hoy?</span>
          </p>
          
          {/* Selector de empresa ahora visible en la cabecera */}
          {companies && companies.length > 0 && (
            <div className="mb-4 sm:mb-6 max-w-full sm:max-w-xs">
              <CompanySelector 
                companies={companies} 
                selectedCompanyId={Number(filters.companyId) || 1} 
                onCompanyChange={(companyId) => handleFilterChange({ companyId })} 
              />
            </div>
          )}
          
          <div className="mt-4 sm:mt-8 grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-4" data-onboarding="kpi-stats">
            <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm text-white">
              <p className="text-xs text-white/70">Volumen de ventas (último mes)</p>
              <p className="text-2xl font-bold">
                {Number(filters.companyId) === 2 ? "237,464 Unidades" : "59,680 KG"}
              </p>
              <p className="text-xs flex items-center text-emerald-400">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>{Number(filters.companyId) === 2 ? "+26%" : "+4.2%"} vs mes anterior</span>
              </p>
            </div>
            
            <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm text-white">
              <p className="text-xs text-white/70">KPIs en seguimiento</p>
              <p className="text-2xl font-bold">{filteredKpis.length}</p>
              <p className="text-xs text-white/70">{filteredKpis.filter((kpi: KpiDetail) => kpi.status === 'complies').length} cumpliendo objetivo</p>
            </div>
            
            <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm text-white">
              <p className="text-xs text-white/70">Última actualización</p>
              <p className="text-xl font-bold">{getLastUpdatedDate()}</p>
              <p className="text-xs text-white/70">Datos en tiempo real</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tipos de Cambio - Prioridad para Emilio */}
      <div className="mb-6 sm:mb-12" data-onboarding="exchange-rates">
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl shadow-md mx-2 sm:mx-0">
          <ExchangeRateCards />
        </div>
      </div>
      
      {/* Reporte de Ventas */}
      <div className="mb-6 sm:mb-12" data-onboarding="sales-report">
        <div className="bg-slate-50 dark:bg-primary-950/50 p-3 sm:p-6 rounded-xl sm:rounded-2xl shadow-md mx-2 sm:mx-0">
          <div className="flex items-center gap-2 mb-3 sm:mb-6">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Reporte de Ventas</h2>
          </div>
          <SalesSummary key={`sales-summary-${filters.companyId}`} companyId={Number(filters.companyId) || 1} />
        </div>
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
      
      {/* Dashboard Onboarding */}
      <DashboardOnboardingDialog
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
      </div>
    </AppLayout>
  );
}
