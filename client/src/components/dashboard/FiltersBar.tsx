import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Calendar, 
  CheckCircle, 
  Building, 
  LayoutGrid, 
  Download,
  FileSpreadsheet 
} from 'lucide-react';
import { getPeriodOptions, getStatusOptions } from '@/lib/utils/dates';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

interface FiltersBarProps {
  onFilterChange: (filters: {
    companyId?: number;
    areaId?: number;
    status?: string;
    period?: string;
  }) => void;
}

export function FiltersBar({ onFilterChange }: FiltersBarProps) {
  const [companyId, setCompanyId] = useState<string>('all');
  const [areaId, setAreaId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [period, setPeriod] = useState<string>(getPeriodOptions()[0].value);

  // Fetch companies
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['/api/companies'],
  });

  // Fetch areas (filtered by company if selected)
  const { data: areas, isLoading: isLoadingAreas } = useQuery({
    queryKey: ['/api/areas', companyId && companyId !== 'all' && !isNaN(parseInt(companyId)) ? { companyId: parseInt(companyId) } : null],
    enabled: true,
  });

  // Update filters when values change
  useEffect(() => {
    // Crear un objeto de filtros excluyendo companyId para evitar
    // que se restablezca la selección de empresa en Dashboard
    const filters: any = {
      areaId: areaId && areaId !== "all" ? parseInt(areaId) : undefined,
      status: status && status !== "all" ? status : undefined,
      period,
    };
    
    // Solo incluir companyId si se ha seleccionado explícitamente
    // en el selector de este componente
    if (companyId && companyId !== "all") {
      filters.companyId = parseInt(companyId);
    }
    
    onFilterChange(filters);
  }, [companyId, areaId, status, period, onFilterChange]);

  const handleExportPDF = () => {
    alert('La exportación a PDF se implementará en una futura versión.');
  };

  const handleExportExcel = () => {
    alert('La exportación a Excel se implementará en una futura versión.');
  };

  const periodOptions = getPeriodOptions();
  const statusOptions = getStatusOptions();

  return (
    <div className="hidden">
      {/* Filtros eliminados según petición del usuario, pero mantenemos el componente
      para evitar errores en otras partes de la aplicación que puedan depender de estos valores */}
    </div>
  );
}
