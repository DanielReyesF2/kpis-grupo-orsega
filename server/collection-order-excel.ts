import ExcelJS from 'exceljs';
import { calculatePalletDistribution } from '@shared/collection-order-utils';

// --- Configuración por empresa ---

const ORIGIN_DURA = {
  company: 'DURA INTERNATIONAL',
  address: 'Camino al Alemán 373, int Bodega B5-A,',
  colonia: 'NEXTIPAC',
  cp: '45220',
  municipality: 'ZAPOPAN',
  state: 'JALISCO',
  reference: 'DENTRO DE BODEGA ELITE NEXTIPAC II INDUSTRIAL',
  contact: 'JESÚS ESPINOZA',
  phone: '33 1809 2852',
  pickupWindow: 'DE 10:00 A 16:00 HRS',
  requestedBy: 'DANIEL MARQUEZ',
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
  requestedBy: 'THALIA RODRIGUEZ',
};

const BILLING_DURA = {
  company: 'DURA INTERNATIONAL',
  rfc: 'DIN100908DS8',
  contact: 'DANIEL MARQUEZ',
  paymentMethod: 'CRÉDITO',
  paymentNote: 'FLETE X COBRAR',
};

const BILLING_ORSEGA = {
  company: 'GRUPO ORSEGA',
  rfc: 'GOR920226B20',
  contact: 'THALIA RODRIGUEZ',
  paymentMethod: 'CRÉDITO',
  paymentNote: 'FLETE X COBRAR',
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
  pickupDate: string;
  drumCount: number;
  pickupWindow?: string;
  companyId: number;
  clientName: string;
  clientAddress?: string;
  clientColonia?: string;
  clientCp?: string;
  clientMunicipality?: string;
  clientState?: string;
  clientContact?: string;
  clientPhone?: string;
  trackingCode?: string;
  product?: string;
  requestedBy?: string;
  appointmentRequired?: boolean;
  appointmentNotes?: string;
}

// --- Styling ---

const NAVY_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' },
};

const LIGHT_BLUE_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' },
};

const WHITE_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9, name: 'Calibri' };
const LABEL_FONT: Partial<ExcelJS.Font> = { bold: true, size: 8, name: 'Calibri' };
const VALUE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10, name: 'Calibri' };
const SMALL_FONT: Partial<ExcelJS.Font> = { size: 7, name: 'Calibri' };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14, name: 'Calibri' };
const RED_FONT: Partial<ExcelJS.Font> = { bold: true, size: 8, name: 'Calibri', color: { argb: 'FFFF0000' } };
const GREEN_BOLD_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF006100' } };

const GREEN_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' },
};

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/** Set cell with border, font, alignment, optional fill */
function setCell(
  ws: ExcelJS.Worksheet,
  row: number, col: number,
  value: string,
  font: Partial<ExcelJS.Font>,
  opts?: { fill?: ExcelJS.FillPattern; hAlign?: 'left' | 'center' | 'right'; wrap?: boolean }
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font = font;
  cell.border = BORDER;
  cell.alignment = {
    horizontal: opts?.hAlign || 'left',
    vertical: 'middle',
    wrapText: opts?.wrap ?? true,
  };
  if (opts?.fill) cell.fill = opts.fill;
}

/** Merge cells and set value */
function mergeSet(
  ws: ExcelJS.Worksheet,
  r1: number, c1: number, r2: number, c2: number,
  value: string, font: Partial<ExcelJS.Font>,
  opts?: { fill?: ExcelJS.FillPattern; hAlign?: 'left' | 'center' | 'right'; wrap?: boolean }
) {
  ws.mergeCells(r1, c1, r2, c2);
  setCell(ws, r1, c1, value, font, opts);
}

/** Apply borders to a range */
function borderRange(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = BORDER;
    }
  }
}

// Abbreviation → state mapping for auto-highlight
const CITY_ABBR_TO_STATES: Record<string, string[]> = {
  'AGS': ['AGUASCALIENTES'],
  'CAN': ['CANCUN', 'QUINTANA ROO'],
  'CDJ': ['CIUDAD JUAREZ', 'CHIHUAHUA'],
  'CHIH': ['CHIHUAHUA'],
  'DGO': ['DURANGO'],
  'GDL': ['GUADALAJARA', 'JALISCO'],
  'LEON': ['LEON', 'GUANAJUATO'],
  'MER': ['MERIDA', 'YUCATAN'],
  'MEX': ['MEXICO', 'ESTADO DE MEXICO', 'EDOMEX', 'CDMX', 'CIUDAD DE MEXICO'],
  'MTY': ['MONTERREY', 'NUEVO LEON'],
  'MOR': ['MORELIA', 'MICHOACAN'],
  'NLAR': ['NUEVO LAREDO', 'TAMAULIPAS'],
  'PUE': ['PUEBLA'],
  'PTOVALL': ['PUERTO VALLARTA'],
  'QRO': ['QUERETARO'],
  'REY': ['REYNOSA'],
  'SALT': ['SALTILLO', 'COAHUILA'],
  'SLP': ['SAN LUIS POTOSI'],
  'TAM': ['TAMPICO'],
  'TOL': ['TOLUCA'],
  'TOR': ['TORREON'],
  'TUX': ['TUXTLA', 'CHIAPAS'],
  'VER': ['VERACRUZ'],
  'VHSA': ['VILLAHERMOSA', 'TABASCO'],
};

function matchDestinationAbbr(state?: string, municipality?: string): string | null {
  if (!state && !municipality) return null;
  const upperState = (state || '').toUpperCase().trim();
  const upperMuni = (municipality || '').toUpperCase().trim();

  for (const [abbr, matches] of Object.entries(CITY_ABBR_TO_STATES)) {
    for (const m of matches) {
      if (upperState.includes(m) || upperMuni.includes(m)) return abbr;
    }
  }
  return null;
}

/**
 * Genera un archivo Excel con el formato homologado de Flete Potosinos.
 */
export async function generateCollectionOrderExcel(data: CollectionOrderData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nova - Econova';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Hoja1', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });

  // 12 columns
  ws.columns = [
    { width: 14 },  // A
    { width: 22 },  // B
    { width: 12 },  // C
    { width: 14 },  // D
    { width: 12 },  // E
    { width: 12 },  // F
    { width: 6 },   // G (spacer)
    { width: 16 },  // H
    { width: 14 },  // I
    { width: 16 },  // J
    { width: 12 },  // K
    { width: 14 },  // L
  ];

  const dist = calculatePalletDistribution(data.drumCount);
  const { origin: O, billing: B } = getCompanyConfig(data.companyId);
  const pickupWindow = data.pickupWindow || O.pickupWindow;
  const requestedBy = data.requestedBy || O.requestedBy;
  const matchedAbbr = matchDestinationAbbr(data.clientState, data.clientMunicipality);

  let r = 1;

  // ==============================
  // TÍTULO
  // ==============================
  borderRange(ws, r, 1, r, 12);
  r++;
  mergeSet(ws, r, 1, r, 12, 'ORDEN DE RECOLECCIÓN', TITLE_FONT, { hAlign: 'center' });
  ws.getRow(r).height = 28;
  r++;
  r++; // blank row

  // Subtítulo "recoleccion"
  mergeSet(ws, r, 3, r, 5, 'recoleccion', { ...LABEL_FONT, size: 9 }, { hAlign: 'center' });
  r++;

  // Fecha
  mergeSet(ws, r, 1, r, 2, 'FECHA DE LA RECOLECCION', LABEL_FONT, { hAlign: 'left' });
  mergeSet(ws, r, 3, r, 5, formatDate(data.pickupDate), VALUE_FONT, { hAlign: 'center' });
  r++;

  // ==============================
  // PAQUETE (S) header — right side, same row area
  // ==============================
  const paqueteHeaderRow = r;
  mergeSet(ws, paqueteHeaderRow, 8, paqueteHeaderRow, 12, 'PAQUETE (S)', WHITE_FONT, { fill: NAVY_FILL, hAlign: 'center' });
  ws.getRow(paqueteHeaderRow).height = 20;
  r++;

  // ==============================
  // ORIGEN header — left side
  // ==============================
  mergeSet(ws, r, 1, r, 2, 'ORIGEN', WHITE_FONT, { fill: NAVY_FILL, hAlign: 'left' });
  borderRange(ws, r, 3, r, 6);

  // Paquete: NO. DE PIEZAS / CLAVE PRODUCTO row
  mergeSet(ws, r, 8, r, 9, 'NO. DE PIEZAS', LABEL_FONT, { hAlign: 'right' });
  setCell(ws, r, 10, String(data.drumCount), VALUE_FONT, { hAlign: 'center' });
  setCell(ws, r, 11, 'CLAVE PRODUCTO', LABEL_FONT);
  setCell(ws, r, 12, PRODUCT_DEFAULTS.claveProducto, VALUE_FONT, { hAlign: 'center' });
  r++;

  // NOMBRE DE LA EMPRESA O PERSONA label
  mergeSet(ws, r, 1, r, 6, 'NOMBRE DE LA EMPRESA O PERSONA', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  // Paquete: DESCRIPCION
  mergeSet(ws, r, 8, r, 9, 'DESCRIPCION', LABEL_FONT, { hAlign: 'right' });
  mergeSet(ws, r, 10, r, 12, data.product || PRODUCT_DEFAULTS.description, VALUE_FONT, { hAlign: 'center' });
  r++;

  // Company name value
  mergeSet(ws, r, 1, r, 6, O.company, VALUE_FONT, { hAlign: 'center' });
  // Paquete: PESO
  mergeSet(ws, r, 8, r, 9, 'PESO', LABEL_FONT, { hAlign: 'right' });
  mergeSet(ws, r, 10, r, 12, `${dist.totalWeightKg} KGS`, VALUE_FONT, { hAlign: 'center' });
  r++;

  // PERSONA QUE SOLICITA LA RECOLECCION | HORARIO
  mergeSet(ws, r, 1, r, 3, 'PERSONA QUE SOLICITA LA RECOLECCION', SMALL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 4, r, 6, 'HORARIO (mínimo 3 hrs de espacio)', SMALL_FONT, { fill: LIGHT_BLUE_FILL });
  // Paquete: MEDIDAS
  mergeSet(ws, r, 8, r, 9, 'MEDIDAS', LABEL_FONT, { hAlign: 'right' });
  mergeSet(ws, r, 10, r, 12, PRODUCT_DEFAULTS.dimensions, VALUE_FONT, { hAlign: 'center' });
  r++;

  // Values
  mergeSet(ws, r, 1, r, 3, requestedBy, VALUE_FONT, { hAlign: 'center' });
  mergeSet(ws, r, 4, r, 6, pickupWindow, VALUE_FONT, { hAlign: 'center' });
  // Paquete: CONTENIDO
  mergeSet(ws, r, 8, r, 9, 'CONTENIDO', LABEL_FONT, { hAlign: 'right' });
  mergeSet(ws, r, 10, r, 12, dist.description, VALUE_FONT, { hAlign: 'center', wrap: true });
  r++;

  // DIRECCION label
  mergeSet(ws, r, 1, r, 6, 'DIRECCION', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  // Paquete: EN QUE VIENE label
  mergeSet(ws, r, 8, r, 12, 'EN QUE VIENE ( TARIMA,CAJA,ATADO,BULTO,ETC.) o CLAVE DE EMPAQUE.', SMALL_FONT, { fill: LIGHT_BLUE_FILL, wrap: true });
  r++;

  // Address value
  mergeSet(ws, r, 1, r, 6, O.address, VALUE_FONT, { hAlign: 'center' });
  // Paquete: TARIMA value
  mergeSet(ws, r, 8, r, 12, 'TARIMA', VALUE_FONT, { hAlign: 'center' });
  r++;

  // COLONIA | C.P.
  mergeSet(ws, r, 1, r, 1, 'COLONIA', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 2, r, 4, '', LABEL_FONT); // empty for colonia
  setCell(ws, r, 5, 'C.P.', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  setCell(ws, r, 6, '', LABEL_FONT);
  borderRange(ws, r, 8, r, 12);
  r++;

  // Colonia / CP values
  mergeSet(ws, r, 1, r, 1, '', LABEL_FONT);
  mergeSet(ws, r, 2, r, 4, O.colonia, VALUE_FONT, { hAlign: 'center' });
  setCell(ws, r, 5, '', LABEL_FONT);
  setCell(ws, r, 6, O.cp, VALUE_FONT, { hAlign: 'center' });
  borderRange(ws, r, 8, r, 12);
  r++;

  // CRUZA CON
  mergeSet(ws, r, 1, r, 2, 'CRUZA CON.', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 3, r, 6, '', LABEL_FONT);
  borderRange(ws, r, 8, r, 12);
  r++;

  // Reference value
  mergeSet(ws, r, 1, r, 6, O.reference, { ...VALUE_FONT, size: 8 }, { hAlign: 'left', wrap: true });
  borderRange(ws, r, 8, r, 12);
  r++;

  // MUNICIPIO / ESTADO
  mergeSet(ws, r, 1, r, 2, 'MUNICIPIO/DELEGACION', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 3, r, 4, '', LABEL_FONT);
  setCell(ws, r, 5, 'ESTADO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  setCell(ws, r, 6, '', LABEL_FONT);
  borderRange(ws, r, 8, r, 12);
  r++;

  mergeSet(ws, r, 1, r, 2, '', LABEL_FONT);
  mergeSet(ws, r, 3, r, 4, O.municipality, VALUE_FONT, { hAlign: 'center' });
  setCell(ws, r, 5, '', LABEL_FONT);
  setCell(ws, r, 6, O.state, VALUE_FONT, { hAlign: 'center' });
  borderRange(ws, r, 8, r, 12);
  r++;

  // PERSONA DE CONTACTO / TELÉFONO
  mergeSet(ws, r, 1, r, 2, 'PERSONA DE CONTACTO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 3, r, 4, '', LABEL_FONT);
  setCell(ws, r, 5, 'TELÉFONO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  setCell(ws, r, 6, '', LABEL_FONT);
  borderRange(ws, r, 8, r, 12);
  r++;

  mergeSet(ws, r, 1, r, 2, '', LABEL_FONT);
  mergeSet(ws, r, 3, r, 4, O.contact, VALUE_FONT, { hAlign: 'center' });
  setCell(ws, r, 5, '', LABEL_FONT);
  setCell(ws, r, 6, O.phone, VALUE_FONT, { hAlign: 'center' });
  borderRange(ws, r, 8, r, 12);
  r++;

  r++; // spacer

  // ==============================
  // DESTINO header with city abbreviations
  // ==============================
  const cityRow1 = ['DESTINO', 'AGS', 'CAN', 'CDJ', 'CHIH', 'DGO', 'GDL', 'LEON', 'MER', 'MEX', 'MTY', 'MOR', 'NLAR', 'PUE', 'PTOVALL', 'QRO', 'REY'];
  // We'll use columns 1-12 but pack abbreviations in
  setCell(ws, r, 1, 'DESTINO', WHITE_FONT, { fill: NAVY_FILL, hAlign: 'center' });

  // Pack city abbreviations across columns 2-12
  const abbrs1 = ['AGS', 'CAN', 'CDJ', 'CHIH', 'DGO', 'GDL', 'LEON', 'MER', 'MEX', 'MTY', 'MOR'];
  abbrs1.forEach((a, i) => {
    const font = (matchedAbbr === a) ? RED_FONT : { ...LABEL_FONT, size: 7 };
    setCell(ws, r, i + 2, a, font, { hAlign: 'center' });
  });
  r++;

  // Second row: more abbreviations + OCURRE/DOMICILIO
  setCell(ws, r, 1, 'OCURRE', RED_FONT, { hAlign: 'left' });
  const abbrs2 = ['NLAR', 'PUE', 'PTOVALL', 'QRO', 'REY', 'SALT', 'SLP', 'TAM', 'TOL', 'TOR', 'TUX'];
  abbrs2.forEach((a, i) => {
    const font = (matchedAbbr === a) ? RED_FONT : { ...LABEL_FONT, size: 7 };
    setCell(ws, r, i + 2, a, font, { hAlign: 'center' });
  });
  r++;

  setCell(ws, r, 1, 'DOMICILIO', RED_FONT, { hAlign: 'left' });
  const abbrs3 = ['VER', 'VHSA'];
  abbrs3.forEach((a, i) => {
    const font = (matchedAbbr === a) ? RED_FONT : { ...LABEL_FONT, size: 7 };
    setCell(ws, r, i + 2, a, font, { hAlign: 'center' });
  });
  borderRange(ws, r, 1, r, 12);
  r++;

  r++; // spacer

  // ==============================
  // DESTINO details (left) + FACTURAR A (right)
  // ==============================

  // Labels
  mergeSet(ws, r, 1, r, 2, 'NOMBRE DE LA EMPRESA O PERSONA', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 3, r, 6, '', LABEL_FONT);
  // FACTURAR A header
  mergeSet(ws, r, 8, r, 12, 'FACTURAR A:', LABEL_FONT, { fill: LIGHT_BLUE_FILL, hAlign: 'left' });
  r++;

  // Destination company
  mergeSet(ws, r, 1, r, 6, data.clientName, VALUE_FONT, { hAlign: 'center' });
  mergeSet(ws, r, 8, r, 12, B.company, VALUE_FONT, { hAlign: 'center' });
  r++;

  // DIRECCIÓN
  mergeSet(ws, r, 1, r, 1, 'DIRECCIÓN', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 2, r, 6, '', LABEL_FONT);
  setCell(ws, r, 8, 'RFC.', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 9, r, 12, '', LABEL_FONT);
  r++;

  mergeSet(ws, r, 1, r, 1, '', LABEL_FONT);
  mergeSet(ws, r, 2, r, 6, data.clientAddress || '', VALUE_FONT, { hAlign: 'left', wrap: true });
  setCell(ws, r, 8, '', LABEL_FONT);
  mergeSet(ws, r, 9, r, 12, B.rfc, VALUE_FONT, { hAlign: 'center' });
  r++;

  // COLONIA / CP
  setCell(ws, r, 1, 'COLONIA', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 2, r, 4, data.clientColonia || '', VALUE_FONT, { hAlign: 'left' });
  setCell(ws, r, 5, 'C.P.:', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  setCell(ws, r, 6, data.clientCp || '', VALUE_FONT, { hAlign: 'center' });

  setCell(ws, r, 8, 'PERSONA DE CONTACTO', SMALL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 9, r, 12, '', LABEL_FONT);
  r++;

  // MUNICIPIO / ESTADO
  mergeSet(ws, r, 1, r, 2, 'MUCIPIO O DELG.', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 3, r, 4, data.clientMunicipality || '', VALUE_FONT, { hAlign: 'left' });
  setCell(ws, r, 5, 'ESTADO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  setCell(ws, r, 6, data.clientState || '', VALUE_FONT, { hAlign: 'left' });

  setCell(ws, r, 8, '', LABEL_FONT);
  mergeSet(ws, r, 9, r, 12, B.contact, VALUE_FONT, { hAlign: 'center' });
  r++;

  // CONTACTO / TELÉFONO + CITA
  mergeSet(ws, r, 1, r, 2, 'PERSONA DE CONTACTO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  if (data.appointmentRequired) {
    // Cita: contacto en col 3, cita en cols 4-6 con fondo verde
    setCell(ws, r, 3, data.clientContact || '', VALUE_FONT, { hAlign: 'left' });
    const citaText = data.appointmentNotes
      ? `SERVICIO CON CITA ${data.appointmentNotes}`
      : 'SERVICIO CON CITA';
    mergeSet(ws, r, 4, r, 6, citaText, GREEN_BOLD_FONT, { fill: GREEN_FILL, hAlign: 'center', wrap: true });
  } else {
    mergeSet(ws, r, 3, r, 4, data.clientContact || '', VALUE_FONT, { hAlign: 'left' });
    setCell(ws, r, 5, 'TELÉFONO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
    setCell(ws, r, 6, data.clientPhone || '', VALUE_FONT, { hAlign: 'left' });
  }

  // DIRECCION billing (blank for now)
  setCell(ws, r, 8, 'DIRECCION', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 9, r, 12, '', LABEL_FONT);
  r++;

  // Si lleva cita, agregar teléfono en fila separada
  if (data.appointmentRequired) {
    mergeSet(ws, r, 1, r, 2, 'TELÉFONO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
    mergeSet(ws, r, 3, r, 6, data.clientPhone || '', VALUE_FONT, { hAlign: 'left' });
    borderRange(ws, r, 8, r, 12);
    r++;
  }

  // Billing: remaining fields
  borderRange(ws, r, 1, r, 6);

  setCell(ws, r, 8, 'COLONIA', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 9, r, 10, '', LABEL_FONT);
  setCell(ws, r, 11, 'C.P.', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  setCell(ws, r, 12, '', LABEL_FONT);
  r++;

  borderRange(ws, r, 1, r, 6);

  mergeSet(ws, r, 8, r, 8, 'MUNICIPIO/DELEGACION', SMALL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 9, r, 10, '', LABEL_FONT);
  setCell(ws, r, 11, 'ESTADO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  setCell(ws, r, 12, '', LABEL_FONT);
  r++;

  borderRange(ws, r, 1, r, 6);

  setCell(ws, r, 8, 'TELEFONO', LABEL_FONT, { fill: LIGHT_BLUE_FILL });
  mergeSet(ws, r, 9, r, 10, '', LABEL_FONT);
  mergeSet(ws, r, 11, r, 12, '', LABEL_FONT);
  r++;

  r++; // spacer

  // ==============================
  // FORMA DE PAGO
  // ==============================
  borderRange(ws, r, 1, r, 6);
  mergeSet(ws, r, 8, r, 9, 'FORMA DE PAGO', LABEL_FONT, { fill: LIGHT_BLUE_FILL, hAlign: 'right' });
  setCell(ws, r, 10, B.paymentMethod, RED_FONT, { hAlign: 'center' });
  mergeSet(ws, r, 11, r, 12, B.paymentNote, LABEL_FONT, { hAlign: 'left' });
  r++;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
