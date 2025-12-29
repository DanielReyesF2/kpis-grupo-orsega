import { devLog } from "@/lib/logger";
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { generatePdfFromElement } from '@/services/pdfService';
import { Company } from '@shared/schema';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PdfExportProps {
  dashboardRef: React.RefObject<HTMLDivElement>;
  companyId: number;
  period: string;
}

export function PdfExport({ dashboardRef, companyId, period }: PdfExportProps) {
  const { toast } = useToast();
  
  // Get company data
  const { data: companies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });
  
  const company = companies?.find((c: Company) => c.id === companyId);
  
  const handleDownload = async () => {
    if (!dashboardRef.current || !company) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Get period text
      let periodText = 'Todos los períodos';
      if (period === 'month') periodText = 'Último mes';
      if (period === 'quarter') periodText = 'Último trimestre';
      if (period === 'year') periodText = 'Último año';
      
      // Current date
      const currentDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
      
      await generatePdfFromElement(dashboardRef.current, {
        company: company.name,
        title: `Dashboard de KPIs - ${company.name}`,
        subtitle: `Período: ${periodText} - Fecha: ${currentDate}`,
        fileName: `kpis-dashboard-${company.name.toLowerCase().replace(/\s+/g, '-')}`,
      });
      
      toast({
        title: "PDF generado",
        description: "El reporte se ha descargado correctamente",
      });
    } catch (error) {
      devLog.error("Error al generar PDF:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el PDF",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="flex items-center gap-1.5 text-sm bg-transparent border-primary-200 text-primary-700 dark:border-primary-800 dark:text-white hover:bg-primary-50 dark:hover:bg-primary-900"
      onClick={handleDownload}
    >
      <Download className="h-4 w-4" />
      <span>Descargar PDF</span>
    </Button>
  );
}