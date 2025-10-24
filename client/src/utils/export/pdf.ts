import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Función auxiliar para formatear fechas
function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  
  // Verificar si la fecha es válida
  if (isNaN(date.getTime())) return 'N/A';
  
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Exporta datos a un archivo PDF
 * @param data Array de objetos a exportar
 * @param columns Definición de columnas (título y clave)
 * @param filename Nombre del archivo a generar
 * @param title Título del reporte
 * @param subtitle Subtítulo opcional
 */
export function exportToPdf<T extends Record<string, any>>(
  data: T[],
  columns: { title: string; dataKey: string; format?: (value: any) => any }[],
  filename: string,
  title: string = 'Reporte',
  subtitle: string = ''
): void {
  // Crear un nuevo documento PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  // Configurar fuente y colores
  doc.setFont('helvetica');
  
  // Agregar título
  doc.setFontSize(18);
  doc.setTextColor(43, 87, 151); // Color azul corporativo
  doc.text(title, 14, 20);
  
  // Agregar subtítulo si existe
  if (subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 28);
  }
  
  // Agregar fecha del reporte
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado: ${formatDate(new Date())}`, doc.internal.pageSize.width - 60, 20);
  
  // Preparar datos para la tabla
  const tableData = data.map(item => {
    return columns.map(col => {
      // Si hay una función de formato definida, usarla
      if (col.format && typeof col.format === 'function') {
        return col.format(item[col.dataKey]);
      } else if (item[col.dataKey] instanceof Date) {
        // Formatear fechas automáticamente
        return formatDate(item[col.dataKey]);
      } else {
        return item[col.dataKey] || '';
      }
    });
  });
  
  // Crear tabla
  autoTable(doc, {
    startY: subtitle ? 32 : 24,
    head: [columns.map(col => col.title)],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [43, 87, 151],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
      fontSize: 9
    },
    columnStyles: {
      // Establecer estilos específicos para columnas si es necesario
    },
    didDrawPage: (data) => {
      // Agregar pie de página con número de página
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      
      // Obtener número de página actual
      const currentPage = doc.getNumberOfPages();
      
      doc.text(
        `Página ${currentPage} de ${currentPage}`,
        pageSize.width - 40, 
        pageHeight - 10
      );
      
      // Agregar logo o texto de la empresa en el pie de página
      doc.text('Econova KPI Dashboard', 14, pageHeight - 10);
    }
  });
  
  // Generar y descargar el archivo
  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Función de ayuda para exportar datos de envíos a PDF
 */
export function exportShipmentsToPdf(shipments: any[], title: string = 'Reporte de Envíos'): void {
  const columns = [
    { title: 'Código', dataKey: 'trackingCode' },
    { title: 'Empresa', dataKey: 'companyName' },
    { title: 'Cliente', dataKey: 'customerName' },
    { title: 'Origen', dataKey: 'origin' },
    { title: 'Destino', dataKey: 'destination' },
    { title: 'Producto', dataKey: 'product' },
    { title: 'Cantidad', dataKey: 'quantity', format: (v: any) => `${v} ${shipments[0]?.unit || 'KG'}` },
    { title: 'Estado', dataKey: 'status', format: (v: string) => formatShipmentStatus(v) },
    { title: 'Huella CO2', dataKey: 'carbonFootprint', format: (v: any) => v ? `${v} kg CO2e` : 'N/A' },
    { title: 'Salida', dataKey: 'departureDate', format: (v: string) => formatDate(new Date(v)) }
  ];
  
  exportToPdf(
    shipments.map(s => ({
      ...s,
      companyName: s.company?.name || 'N/A',
      status: s.status
    })),
    columns,
    'Envios',
    title,
    `Total: ${shipments.length} envíos`
  );
}

/**
 * Función de ayuda para exportar datos de KPIs a PDF
 */
export function exportKpisToPdf(kpis: any[], title: string = 'Reporte de KPIs'): void {
  const columns = [
    { title: 'KPI', dataKey: 'name' },
    { title: 'Área', dataKey: 'areaName' },
    { title: 'Empresa', dataKey: 'companyName' },
    { title: 'Descripción', dataKey: 'description' },
    { title: 'Tipo', dataKey: 'type' },
    { title: 'Frecuencia', dataKey: 'frequency' },
    { title: 'Meta', dataKey: 'target' },
    { title: 'Último Valor', dataKey: 'lastValue' },
    { title: 'Actualización', dataKey: 'lastUpdated' }
  ];
  
  exportToPdf(kpis, columns, 'KPIs', title, `Total: ${kpis.length} indicadores`);
}

/**
 * Formatea el estado del envío para mejor legibilidad
 */
function formatShipmentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Pendiente',
    'in_transit': 'En Tránsito',
    'delivered': 'Entregado',
    'delayed': 'Retrasado',
    'returned': 'Devuelto',
    'cancelled': 'Cancelado'
  };
  
  return statusMap[status] || status;
}