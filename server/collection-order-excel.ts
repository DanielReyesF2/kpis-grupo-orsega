import ExcelJS from 'exceljs';
import { calculatePalletDistribution } from '@shared/collection-order-utils';

// --- Configuración por empresa ---

const ORIGIN_DURA = {
  company: 'DURA INTERNATIONAL',
  address: 'Camino al Alemán 373, int Bodega B5-A',
  colonia: 'NEXTIPAC',
  cp: '45220',
  municipality: 'ZAPOPAN',
  state: 'JALISCO',
  reference: 'DENTRO DE BODEGA ELITE NEXTIPAC II INDUSTRIAL',
  contact: 'JESÚS ESPINOZA',
  phone: '33 1809 2852',
  pickupWindow: 'DE 10:00 A 16:00 HRS',
};

const ORIGIN_ORSEGA = {
  company: 'GRUPO ORSEGA',
  address: 'Camino al Alemán 373, int B5',
  colonia: 'NEXTIPAC',
  cp: '45220',
  municipality: 'ZAPOPAN',
  state: 'JALISCO',
  reference: 'DENTRO DE BODEGA ELITE NEXTIPAC II INDUSTRIAL',
  contact: 'THALIA RODRIGUEZ',
  phone: '33 1587 6361',
  pickupWindow: 'DE 10:00 A 16:00 HRS',
};

const BILLING_DURA = {
  company: 'DURA INTERNATIONAL',
  rfc: 'DIN100908DS8',
  paymentMethod: 'CRÉDITO / FLETE X COBRAR',
};

const BILLING_ORSEGA = {
  company: 'GRUPO ORSEGA',
  rfc: 'GOR920226B20',
  paymentMethod: 'CRÉDITO / FLETE X COBRAR',
};

const PRODUCT_DEFAULTS = {
  claveProducto: '31211600',
  description: 'Aditivos para pinturas',
  dimensions: '60X60X90',
};

const COMPANY_CONFIG: Record<number, { origin: typeof ORIGIN_DURA; billing: typeof BILLING_DURA }> = {
  1: { origin: ORIGIN_DURA, billing: BILLING_DURA },
  2: { origin: ORIGIN_ORSEGA, billing: BILLING_ORSEGA },
};

function getCompanyConfig(companyId: number) {
  return COMPANY_CONFIG[companyId] || COMPANY_CONFIG[1];
}

export interface CollectionOrderData {
  pickupDate: string; // ISO date string
  drumCount: number;
  pickupWindow?: string;
  companyId: number; // 1=Dura, 2=Orsega — determines origin/billing
  // Client/destination data
  clientName: string;
  clientAddress?: string;
  clientColonia?: string;
  clientCp?: string;
  clientMunicipality?: string;
  clientState?: string;
  clientContact?: string;
  clientPhone?: string;
  // Shipment context
  trackingCode?: string;
  product?: string;
}

// Styling helpers
const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E79' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 10,
  name: 'Calibri',
};

const LABEL_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 9,
  name: 'Calibri',
};

const VALUE_FONT: Partial<ExcelJS.Font> = {
  size: 9,
  name: 'Calibri',
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function addSectionHeader(ws: ExcelJS.Worksheet, row: number, text: string, colStart: number, colEnd: number) {
  ws.mergeCells(row, colStart, row, colEnd);
  const cell = ws.getCell(row, colStart);
  cell.value = text;
  cell.fill = HEADER_FILL;
  cell.font = HEADER_FONT;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = THIN_BORDER;
  ws.getRow(row).height = 22;
}

function addLabelValue(ws: ExcelJS.Worksheet, row: number, labelCol: number, labelColEnd: number, label: string, valueCol: number, valueColEnd: number, value: string) {
  ws.mergeCells(row, labelCol, row, labelColEnd);
  const labelCell = ws.getCell(row, labelCol);
  labelCell.value = label;
  labelCell.font = LABEL_FONT;
  labelCell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
  labelCell.border = THIN_BORDER;

  ws.mergeCells(row, valueCol, row, valueColEnd);
  const valueCell = ws.getCell(row, valueCol);
  valueCell.value = value;
  valueCell.font = VALUE_FONT;
  valueCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  valueCell.border = THIN_BORDER;
}

/**
 * Genera un archivo Excel con el formato de Orden de Recolección (estilo Potosinos).
 */
export async function generateCollectionOrderExcel(data: CollectionOrderData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nova - Econova';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Orden de Recolección', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
  });

  // Column widths (8 columns)
  ws.columns = [
    { width: 16 }, // A
    { width: 16 }, // B
    { width: 16 }, // C
    { width: 16 }, // D
    { width: 16 }, // E
    { width: 16 }, // F
    { width: 16 }, // G
    { width: 16 }, // H
  ];

  const dist = calculatePalletDistribution(data.drumCount);
  const { origin: ORIGIN_WAREHOUSE, billing: BILLING } = getCompanyConfig(data.companyId);
  const pickupWindow = data.pickupWindow || ORIGIN_WAREHOUSE.pickupWindow;
  let r = 1;

  // ============================
  // TÍTULO: ORDEN DE RECOLECCIÓN
  // ============================
  addSectionHeader(ws, r, 'ORDEN DE RECOLECCIÓN', 1, 8);
  ws.getRow(r).height = 28;
  ws.getCell(r, 1).font = { ...HEADER_FONT, size: 14 };
  r++;

  // Fecha y folio
  addLabelValue(ws, r, 1, 2, 'FECHA:', 3, 4, formatDate(data.pickupDate));
  addLabelValue(ws, r, 5, 6, 'FOLIO:', 7, 8, data.trackingCode || '');
  r += 2;

  // =========================
  // SECCIÓN: ORIGEN
  // =========================
  addSectionHeader(ws, r, 'ORIGEN', 1, 8);
  r++;
  addLabelValue(ws, r, 1, 2, 'EMPRESA:', 3, 8, ORIGIN_WAREHOUSE.company);
  r++;
  addLabelValue(ws, r, 1, 2, 'DIRECCIÓN:', 3, 8, ORIGIN_WAREHOUSE.address);
  r++;
  addLabelValue(ws, r, 1, 2, 'COLONIA:', 3, 4, ORIGIN_WAREHOUSE.colonia);
  addLabelValue(ws, r, 5, 6, 'C.P.:', 7, 8, ORIGIN_WAREHOUSE.cp);
  r++;
  addLabelValue(ws, r, 1, 2, 'MUNICIPIO:', 3, 4, ORIGIN_WAREHOUSE.municipality);
  addLabelValue(ws, r, 5, 6, 'ESTADO:', 7, 8, ORIGIN_WAREHOUSE.state);
  r++;
  addLabelValue(ws, r, 1, 2, 'REFERENCIA:', 3, 8, ORIGIN_WAREHOUSE.reference);
  r++;
  addLabelValue(ws, r, 1, 2, 'CONTACTO:', 3, 4, ORIGIN_WAREHOUSE.contact);
  addLabelValue(ws, r, 5, 6, 'TELÉFONO:', 7, 8, ORIGIN_WAREHOUSE.phone);
  r++;
  addLabelValue(ws, r, 1, 2, 'HORARIO:', 3, 8, pickupWindow);
  r += 2;

  // =========================
  // SECCIÓN: PAQUETE / CONTENIDO
  // =========================
  addSectionHeader(ws, r, 'PAQUETE / CONTENIDO', 1, 8);
  r++;

  // Table header row
  const pktHeaders = ['CLAVE PROD.', 'DESCRIPCIÓN', 'PIEZAS', 'PESO (KG)', 'TARIMAS', 'DIMENSIONES', 'CONTENIDO', 'DISTRIBUCIÓN'];
  pktHeaders.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { ...LABEL_FONT, size: 8 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });
  ws.getRow(r).height = 24;
  r++;

  // Table data row
  const pktValues = [
    PRODUCT_DEFAULTS.claveProducto,
    data.product || PRODUCT_DEFAULTS.description,
    String(data.drumCount),
    String(dist.totalWeightKg),
    String(dist.totalTarimas),
    PRODUCT_DEFAULTS.dimensions,
    PRODUCT_DEFAULTS.description,
    dist.description,
  ];
  pktValues.forEach((v, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = v;
    cell.font = VALUE_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });
  ws.getRow(r).height = 36;
  r += 2;

  // =========================
  // SECCIÓN: DESTINO
  // =========================
  addSectionHeader(ws, r, 'DESTINO', 1, 8);
  r++;
  addLabelValue(ws, r, 1, 2, 'EMPRESA:', 3, 8, data.clientName);
  r++;
  addLabelValue(ws, r, 1, 2, 'DIRECCIÓN:', 3, 8, data.clientAddress || '');
  r++;
  addLabelValue(ws, r, 1, 2, 'COLONIA:', 3, 4, data.clientColonia || '');
  addLabelValue(ws, r, 5, 6, 'C.P.:', 7, 8, data.clientCp || '');
  r++;
  addLabelValue(ws, r, 1, 2, 'MUNICIPIO:', 3, 4, data.clientMunicipality || '');
  addLabelValue(ws, r, 5, 6, 'ESTADO:', 7, 8, data.clientState || '');
  r++;
  addLabelValue(ws, r, 1, 2, 'CONTACTO:', 3, 4, data.clientContact || '');
  addLabelValue(ws, r, 5, 6, 'TELÉFONO:', 7, 8, data.clientPhone || '');
  r += 2;

  // =========================
  // SECCIÓN: FACTURAR A
  // =========================
  addSectionHeader(ws, r, 'FACTURAR A', 1, 8);
  r++;
  addLabelValue(ws, r, 1, 2, 'EMPRESA:', 3, 8, BILLING.company);
  r++;
  addLabelValue(ws, r, 1, 2, 'RFC:', 3, 8, BILLING.rfc);
  r += 2;

  // =========================
  // SECCIÓN: FORMA DE PAGO
  // =========================
  addSectionHeader(ws, r, 'FORMA DE PAGO', 1, 8);
  r++;
  addLabelValue(ws, r, 1, 2, 'MÉTODO:', 3, 8, BILLING.paymentMethod);
  r++;

  // Generate buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
