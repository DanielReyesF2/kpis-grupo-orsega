import ExcelJS from 'exceljs';

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
 * Exporta datos a un archivo Excel
 * @param data Array de objetos a exportar
 * @param columns Definición de columnas (nombre y clave)
 * @param filename Nombre del archivo a generar
 * @param sheetName Nombre de la hoja de cálculo
 * @param title Título del reporte
 */
export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: { header: string; key: string; width?: number; format?: (value: any) => any }[],
  filename: string,
  sheetName: string = 'Datos',
  title: string = 'Reporte'
): Promise<void> {
  // Crear un nuevo libro de trabajo
  const workbook = new ExcelJS.Workbook();
  
  // Agregar metadatos
  workbook.creator = 'Econova KPI Dashboard';
  workbook.lastModifiedBy = 'Econova KPI Dashboard';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Crear una hoja
  const worksheet = workbook.addWorksheet(sheetName);

  // Agregar título
  worksheet.mergeCells('A1:H1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = title;
  titleRow.font = {
    size: 16,
    bold: true,
    color: { argb: '2B5797' }
  };
  titleRow.alignment = { horizontal: 'center' };
  worksheet.addRow([]); // Fila en blanco después del título

  // Definir columnas
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 20
  }));

  // Estilo para las cabeceras
  worksheet.getRow(3).font = {
    bold: true,
    color: { argb: 'FFFFFF' }
  };
  worksheet.getRow(3).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2B5797' }
  };
  worksheet.getRow(3).alignment = { horizontal: 'center' };

  // Agregar datos
  data.forEach(item => {
    const rowData: Record<string, any> = {};
    
    columns.forEach(col => {
      // Si hay una función de formato definida, usarla
      if (col.format && typeof col.format === 'function') {
        rowData[col.key] = col.format(item[col.key]);
      } else if (item[col.key] instanceof Date) {
        // Formatear fechas automáticamente
        rowData[col.key] = formatDate(item[col.key]);
      } else {
        rowData[col.key] = item[col.key];
      }
    });
    
    worksheet.addRow(rowData);
  });

  // Agregar bordes a todas las celdas con datos
  const lastRowIndex = worksheet.rowCount;
  const lastColIndex = columns.length;
  
  for (let i = 3; i <= lastRowIndex; i++) {
    for (let j = 1; j <= lastColIndex; j++) {
      const cell = worksheet.getCell(i, j);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  // Generar y descargar el archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Función de ayuda para exportar datos de envíos a Excel
 */
export function exportShipmentsToExcel(shipments: any[], title: string = 'Reporte de Envíos'): Promise<void> {
  const columns = [
    { header: 'Código de Seguimiento', key: 'trackingCode', width: 25 },
    { header: 'Empresa', key: 'companyName', width: 25 },
    { header: 'Cliente', key: 'customerName', width: 30 },
    { header: 'Origen', key: 'origin', width: 30 },
    { header: 'Destino', key: 'destination', width: 30 },
    { header: 'Producto', key: 'product', width: 25 },
    { header: 'Cantidad', key: 'quantity', width: 15, format: (v: any) => `${v} ${shipments[0]?.unit || 'KG'}` },
    { header: 'Transportista', key: 'carrier', width: 30 },
    { header: 'Estado', key: 'status', width: 15, format: (v: string) => formatShipmentStatus(v) },
    { header: 'Huella de Carbono', key: 'carbonFootprint', width: 20, format: (v: any) => v ? `${v} kg CO2e` : 'N/A' },
    { header: 'Fecha de Salida', key: 'departureDate', width: 20, format: (v: string) => formatDate(new Date(v)) },
    { header: 'Fecha de Entrega Est.', key: 'estimatedDeliveryDate', width: 20, format: (v: string) => formatDate(new Date(v)) }
  ];
  
  return exportToExcel(
    shipments.map(s => ({
      ...s,
      companyName: s.company?.name || 'N/A',
      status: s.status
    })),
    columns,
    'Envios',
    'Envíos',
    title
  );
}

/**
 * Función de ayuda para exportar datos de KPIs a Excel
 */
export function exportKpisToExcel(kpis: any[], title: string = 'Reporte de KPIs'): Promise<void> {
  const columns = [
    { header: 'KPI', key: 'name', width: 40 },
    { header: 'Área', key: 'areaName', width: 25 },
    { header: 'Empresa', key: 'companyName', width: 25 },
    { header: 'Descripción', key: 'description', width: 50 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Frecuencia', key: 'frequency', width: 15 },
    { header: 'Meta', key: 'target', width: 15 },
    { header: 'Unidad', key: 'unit', width: 15 },
    { header: 'Último Valor', key: 'lastValue', width: 20 },
    { header: 'Fecha de Actualización', key: 'lastUpdated', width: 20 }
  ];
  
  return exportToExcel(kpis, columns, 'KPIs', 'Indicadores', title);
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