import { devLog } from "@/lib/logger";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, Download, FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { es } from "date-fns/locale";
interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: any[];
}

type PeriodType = "today" | "tomorrow" | "thisWeek" | "nextWeek" | "thisMonth" | "custom";

export function ReportModal({ isOpen, onClose, shipments }: ReportModalProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const filterShipmentsByPeriod = (shipments: any[], period: PeriodType): any[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    // Obtener el lunes de esta semana
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay() + 1);
    const thisWeekEnd = new Date(thisWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    // Obtener el lunes de la próxima semana
    const nextWeekStart = new Date(thisWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekEnd = new Date(nextWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    // Obtener primer y último día del mes
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return shipments.filter(shipment => {
      const deliveryDate = shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate) : null;
      const createdDate = shipment.createdAt ? new Date(shipment.createdAt) : new Date();
      
      // Usar fecha de entrega estimada si existe, sino fecha de creación
      const compareDate = deliveryDate || createdDate;
      
      switch (period) {
        case "today":
          return compareDate >= today && compareDate < tomorrow;
        case "tomorrow":
          const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
          return compareDate >= tomorrow && compareDate < dayAfterTomorrow;
        case "thisWeek":
          return compareDate >= thisWeekStart && compareDate <= thisWeekEnd;
        case "nextWeek":
          return compareDate >= nextWeekStart && compareDate <= nextWeekEnd;
        case "thisMonth":
          return compareDate >= thisMonthStart && compareDate <= thisMonthEnd;
        case "custom":
          if (!customStartDate || !customEndDate) return false;
          const startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999); // Incluir todo el día
          return compareDate >= startDate && compareDate <= endDate;
        default:
          return true;
      }
    });
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const filteredShipments = filterShipmentsByPeriod(shipments, periodType);
      
      // Crear el PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Configurar fuente
      pdf.setFont("helvetica");
      
      // Encabezado
      pdf.setFontSize(20);
      pdf.setTextColor(39, 57, 73); // Color Econova
      pdf.text("ECONOVA - Reporte de Envíos", pageWidth / 2, 25, { align: "center" });
      
      // Información del reporte
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      const reportDate = format(new Date(), "dd 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
      pdf.text(`Generado el ${reportDate}`, pageWidth / 2, 35, { align: "center" });
      
      // Período del reporte
      let periodText = "";
      switch (periodType) {
        case "today": periodText = "Envíos de Hoy"; break;
        case "tomorrow": periodText = "Envíos de Mañana"; break;
        case "thisWeek": periodText = "Envíos de Esta Semana"; break;
        case "nextWeek": periodText = "Envíos de la Próxima Semana"; break;
        case "thisMonth": periodText = "Envíos de Este Mes"; break;
        case "custom": 
          if (customStartDate && customEndDate) {
            periodText = `Del ${format(new Date(customStartDate), "dd/MM/yyyy")} al ${format(new Date(customEndDate), "dd/MM/yyyy")}`;
          } else {
            periodText = "Rango personalizado";
          }
          break;
      }
      
      pdf.setFontSize(14);
      pdf.setTextColor(39, 57, 73);
      pdf.text(periodText, pageWidth / 2, 50, { align: "center" });
      
      // Estadísticas generales
      const statusCounts = filteredShipments.reduce((acc, shipment) => {
        const status = shipment.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const statusLabels = {
        pending: "Pendientes",
        in_transit: "En Tránsito",
        delivered: "Entregados",
        delayed: "Retrasados",
        cancelled: "Cancelados"
      };
      
      // Resumen por estado
      let yPosition = 70;
      pdf.setFontSize(16);
      pdf.text("Resumen por Estado", 20, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(12);
      Object.entries(statusCounts).forEach(([status, count]) => {
        const label = statusLabels[status as keyof typeof statusLabels] || status;
        pdf.text(`${label}: ${count} envíos`, 20, yPosition);
        yPosition += 8;
      });
      
      yPosition += 10;
      pdf.text(`Total de envíos: ${filteredShipments.length}`, 20, yPosition);
      
      // Tabla de envíos
      yPosition += 20;
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 30;
      }
      
      pdf.setFontSize(16);
      pdf.text("Detalle de Envíos", 20, yPosition);
      yPosition += 15;
      
      // Encabezados de tabla
      pdf.setFontSize(10);
      pdf.setTextColor(39, 57, 73);
      const colWidths = [25, 45, 25, 35, 25, 30];
      const headers = ["Código", "Cliente", "Estado", "Producto", "Cantidad", "Entrega"];
      let xPosition = 15;
      
      headers.forEach((header, index) => {
        pdf.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      
      yPosition += 8;
      
      // Línea separadora
      pdf.setDrawColor(200, 200, 200);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 5;
      
      // Datos de envíos
      pdf.setTextColor(60, 60, 60);
      filteredShipments.forEach(shipment => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 30;
        }
        
        xPosition = 15;
        const rowData = [
          shipment.trackingCode || "N/A",
          (shipment.customerName && shipment.customerName.length > 20) ? shipment.customerName.substring(0, 17) + "..." : (shipment.customerName || "N/A"),
          statusLabels[shipment.status as keyof typeof statusLabels] || shipment.status || "N/A",
          (shipment.product && shipment.product.length > 15) ? shipment.product.substring(0, 12) + "..." : (shipment.product || "N/A"),
          `${shipment.quantity || 0} ${shipment.unit || ""}`,
          shipment.estimatedDeliveryDate ? format(new Date(shipment.estimatedDeliveryDate), "dd/MM") : "N/A"
        ];
        
        rowData.forEach((data, index) => {
          pdf.text(data, xPosition, yPosition);
          xPosition += colWidths[index];
        });
        
        yPosition += 7;
      });
      
      // Pie de página
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        pdf.text("ECONOVA - Sistema de Gestión Logística", pageWidth / 2, pageHeight - 5, { align: "center" });
      }
      
      // Descargar el PDF
      const fileName = `reporte-envios-${periodType}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`;
      pdf.save(fileName);
      
      onClose();
    } catch (error) {
      devLog.error("Error al generar PDF:", error);
      alert("Error al generar el PDF. Por favor, inténtalo de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredShipments = filterShipmentsByPeriod(shipments, periodType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Generar Reporte PDF
          </DialogTitle>
          <DialogDescription>
            Selecciona el período de tiempo para generar el reporte de envíos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selector de período */}
          <div className="space-y-2">
            <Label htmlFor="period">Período del reporte</Label>
            <Select value={periodType} onValueChange={(value: PeriodType) => setPeriodType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Envíos de Hoy</SelectItem>
                <SelectItem value="tomorrow">Envíos de Mañana</SelectItem>
                <SelectItem value="thisWeek">Esta Semana</SelectItem>
                <SelectItem value="nextWeek">Próxima Semana</SelectItem>
                <SelectItem value="thisMonth">Este Mes</SelectItem>
                <SelectItem value="custom">Rango Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fechas personalizadas */}
          {periodType === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Vista previa */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Vista previa del reporte:</h4>
            <p className="text-sm text-gray-600 mb-2">
              <strong>{filteredShipments.length}</strong> envíos encontrados
            </p>
            <div className="text-xs text-gray-500">
              {filteredShipments.length === 0 ? (
                "No hay envíos en el período seleccionado"
              ) : (
                `Estados: ${Object.entries(
                  filteredShipments.reduce((acc, s) => {
                    acc[s.status] = (acc[s.status] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([status, count]) => `${count} ${status}`).join(", ")}`
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={generatePDF} 
              disabled={isGenerating || (periodType === "custom" && (!customStartDate || !customEndDate))}
              className="flex-1 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}