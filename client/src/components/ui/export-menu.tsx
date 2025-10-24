import React from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';
import { 
  exportShipmentsToExcel, 
  exportShipmentsToPdf, 
  exportKpisToExcel, 
  exportKpisToPdf 
} from '@/utils/export';

interface ExportMenuProps {
  data: any[];
  type: 'shipments' | 'kpis';
  title?: string;
  variant?: 'default' | 'outline' | 'ghost'; 
  disabled?: boolean;
}

export function ExportMenu({ data, type, title, variant = 'outline', disabled = false }: ExportMenuProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const handleExport = (format: 'excel' | 'pdf') => {
    if (type === 'shipments') {
      if (format === 'excel') {
        exportShipmentsToExcel(data, title || 'Reporte de Envíos');
      } else {
        exportShipmentsToPdf(data, title || 'Reporte de Envíos');
      }
    } else if (type === 'kpis') {
      if (format === 'excel') {
        exportKpisToExcel(data, title || 'Reporte de KPIs');
      } else {
        exportKpisToPdf(data, title || 'Reporte de KPIs');
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-1" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Exportar Datos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}