/**
 * 📋 invoice-templates.ts
 * Sistema de templates para extracción de datos de facturas PDF
 *
 * Cada template define patrones regex para extraer datos de proveedores conocidos
 * Esto es MUCHO más confiable que OCR genérico para proveedores recurrentes
 */

export interface InvoiceTemplate {
  // Identificación del proveedor
  name: string;
  keywords: string[]; // Palabras clave para detectar este proveedor
  excludeKeywords?: string[]; // Palabras que excluyen este template

  // Patrones de extracción (regex)
  patterns: {
    supplierName?: RegExp | RegExp[];
    amount?: RegExp | RegExp[];
    total?: RegExp | RegExp[];
    subtotal?: RegExp | RegExp[];
    invoiceNumber?: RegExp | RegExp[];
    date?: RegExp | RegExp[];
    dueDate?: RegExp | RegExp[];
    taxId?: RegExp | RegExp[]; // RFC
    currency?: RegExp | RegExp[];
    reference?: RegExp | RegExp[];
  };

  // Valores estáticos (si siempre son iguales)
  staticValues?: {
    currency?: string;
    paymentTerms?: string;
    supplierName?: string;
  };

  // Formato de fecha esperado
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';
}

/**
 * Templates para proveedores conocidos
 * Agregar nuevos templates aquí para mejorar la extracción
 * MEJORADO: Keywords completas para máxima compatibilidad
 */
export const invoiceTemplates: InvoiceTemplate[] = [
  // Template genérico para CFDI/SAT - KEYWORDS COMPLETAS
  {
    name: 'CFDI Genérico',
    keywords: [
      // Identificadores CFDI
      'cfdi', 'comprobante fiscal', 'comprobante fiscal digital', 'folio fiscal',
      'uuid', 'sat', 'timbrado', 'factura', 'rfc', 'timbre', 'comprobante',
      'sello digital', 'cadena original', 'certificado digital', 'serie y folio',
      // Datos fiscales
      'régimen fiscal', 'regimen fiscal', 'uso de cfdi', 'clave de producto',
      'clave sat', 'tipo de comprobante', 'lugar de expedición',
      // Partes involucradas
      'emisor', 'receptor', 'razón social', 'razon social', 'domicilio fiscal',
      // Métodos y formas de pago
      'método de pago', 'metodo de pago', 'forma de pago', 'condiciones de pago',
      'pue', 'ppd', 'transferencia electrónica',
      // Montos y moneda
      'subtotal', 'iva', 'total', 'descuento', 'moneda mxn', 'pesos mexicanos',
      'tipo de cambio', 'importe', 'impuesto trasladado', 'impuesto retenido', 'isr', 'ieps'
    ],
    excludeKeywords: ['invoice only', 'usd only'],
    patterns: {
      supplierName: [
        /(?:emisor|emitter|proveedor|raz[oó]n\s*social|nombre\s*del?\s*emisor)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{3,100}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?)?)/i,
        /rfc[\s:]+[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}[\s\n]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{3,100})/i,
      ],
      amount: [
        /(?:total|monto\s*total|importe\s*total)[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.?\d*)\s*(?:mxn|total)/i,
      ],
      invoiceNumber: [
        // Patrones específicos de México
        /no\.?\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /n[°º]\.?\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /n[uú]m\.?\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /n[uú]mero\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /#\s*factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /factura\s*no\.?[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /factura\s*#[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /factura[\s:#]+([A-Z0-9\-\/]{3,20})/i,
        // Folio y Serie
        /folio[\s:]+([A-Z0-9\-\/]{1,30})/i,
        /serie\s*y?\s*folio[\s:]+([A-Z0-9\-\/]{1,30})/i,
        /folio\s*fiscal[\s:]+([A-Z0-9\-\/]{1,30})/i,
        /serie[\s:]+([A-Z]{1,5})/i,
        // Prefijos comunes
        /(?:F|FA|FACT|INV|FEA)[\-:\s#]+([A-Z0-9\-\/]{3,20})/i,
        // Documento
        /documento\s*no\.?[\s:#]*([A-Z0-9\-\/]{1,30})/i,
        /doc\.?\s*no\.?[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      ],
      date: [
        /fecha\s*(?:de\s*)?emisi[oó]n[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /fecha\s*(?:de\s*)?expedici[oó]n[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /fecha\s*(?:de\s*)?timbrado[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /fecha[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
      ],
      dueDate: [
        // Patrones en español
        /fecha\s*(?:de\s*)?vencimiento[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /vencimiento[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /vence[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /fecha\s*l[ií]mite(?:\s*(?:de\s*)?pago)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /pagar?\s*antes\s*(?:de|del)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /pago\s*antes\s*(?:de|del)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /vigencia[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /validez[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /expira[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        // Patrones en inglés
        /(?:due\s*date|payment\s*due|pay\s*by)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        // Formatos ISO
        /fecha\s*(?:de\s*)?vencimiento[\s:]+(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
        // Formatos con nombre de mes en español
        /(?:vencimiento|vence|fecha\s*l[ií]mite)[\s:]+(\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+|del?\s+)?\d{2,4})?)/i,
        /(?:vencimiento|vence|fecha\s*l[ií]mite)[\s:]+(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s+\d{2,4})/i,
      ],
      taxId: [
        /rfc[\s:]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
        /r\.f\.c\.[\s:]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
      ],
    },
    staticValues: {
      currency: 'MXN',
    },
    dateFormat: 'DD/MM/YYYY',
  },

  // Template para facturas de energía (CFE, Telmex, etc.) - KEYWORDS COMPLETAS
  {
    name: 'Servicios Públicos',
    keywords: [
      // Electricidad
      'cfe', 'comisión federal de electricidad', 'comision federal de electricidad',
      'kwh', 'kilowatt', 'tarifa dac', 'tarifa doméstica', 'consumo de energía',
      'suministro eléctrico', 'medidor', 'lectura anterior', 'lectura actual',
      // Telefonía e Internet
      'telmex', 'izzi', 'totalplay', 'megacable', 'at&t', 'telcel', 'movistar', 'axtel',
      'línea telefónica', 'internet', 'fibra óptica', 'mbps',
      // Gas
      'naturgy', 'gas natural', 'gas natural fenosa', 'm3', 'metros cúbicos',
      // Agua
      'agua potable', 'sapasma', 'caem', 'conagua', 'sacmex', 'siapa',
      'agua y saneamiento', 'consumo de agua',
      // Predial
      'predial', 'impuesto predial', 'catastro', 'valor catastral', 'tenencia',
      // Términos comunes
      'número de servicio', 'numero de servicio', 'número de cuenta', 'numero de cuenta',
      'periodo de consumo', 'cargo fijo', 'subsidio', 'recibo',
      'fecha límite de pago', 'fecha limite de pago', 'corte', 'reconexión',
      'adeudo', 'saldo anterior', 'pago mínimo'
    ],
    excludeKeywords: ['cfdi', 'folio fiscal', 'uuid'],
    patterns: {
      supplierName: [
        /(Comisi[oó]n\s*Federal\s*de\s*Electricidad|CFE|TELMEX|Izzi|Totalplay|Megacable|TELCEL|Naturgy|Gas\s*Natural|SACMEX|SIAPA|CAEM)/i,
      ],
      amount: [
        /total\s*a\s*pagar[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /importe\s*total[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /monto\s*a\s*pagar[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /pago\s*m[ií]nimo[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      ],
      invoiceNumber: [
        /n[uú]mero\s*(?:de\s*)?servicio[\s:]+([A-Z0-9\-]{6,20})/i,
        /n[uú]mero\s*(?:de\s*)?cuenta[\s:]+([A-Z0-9\-]{6,20})/i,
        /cuenta[\s:]+(\d{8,15})/i,
        /contrato[\s:]+([A-Z0-9\-]{6,20})/i,
        /recibo[\s:]+([A-Z0-9\-]{5,20})/i,
      ],
      dueDate: [
        /fecha\s*l[ií]mite[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /vence[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /pague?\s*antes\s*del?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /fecha\s*(?:de\s*)?vencimiento[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /corte[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ],
      date: [
        /periodo[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /fecha\s*(?:de\s*)?emisi[oó]n[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /periodo\s*(?:de\s*)?consumo[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ],
    },
    staticValues: {
      currency: 'MXN',
    },
  },

  // Template para proveedores internacionales - KEYWORDS COMPLETAS
  {
    name: 'Internacional (USD)',
    keywords: [
      // Identificadores
      'invoice', 'invoice number', 'inv', 'invoice no', 'commercial invoice',
      'proforma invoice', 'proforma', 'purchase order', 'po number', 'p.o.', 'quotation', 'quote',
      // Direcciones
      'bill to', 'ship to', 'sold to', 'remit to', 'billing address', 'shipping address',
      // Monedas
      'usd', 'dollar', 'dollars', 'eur', 'euro', 'euros', 'gbp', 'united states',
      // Términos de pago
      'payment terms', 'terms', 'net 15', 'net 30', 'net 60', 'net 90',
      'due on receipt', 'cod', 'prepaid',
      // Montos
      'total due', 'amount due', 'balance due', 'subtotal', 'tax', 'grand total',
      'unit price', 'qty', 'quantity', 'discount', 'shipping', 'handling',
      // Información bancaria
      'bank details', 'wire transfer', 'swift', 'iban', 'routing number', 'account number', 'ach',
      // Otros
      'vendor', 'supplier', 'customer', 'description', 'item', 'sku', 'reference'
    ],
    excludeKeywords: ['cfdi', 'sat', 'mxn', 'pesos', 'rfc', 'timbrado', 'folio fiscal'],
    patterns: {
      supplierName: [
        /(?:from|vendor|supplier|company|bill\s*from)[\s:]+([A-Za-z][A-Za-z0-9\s,\.&\-]{3,100}(?:Inc\.?|LLC\.?|Corp\.?)?)/i,
      ],
      amount: [
        /(?:total\s*due|amount\s*due|balance\s*due|grand\s*total|total)[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      ],
      invoiceNumber: [
        /invoice\s*(?:#|no\.?|number)[\s:]+([A-Z0-9\-]{3,30})/i,
        /inv[\s#:]+([A-Z0-9\-]{3,30})/i,
      ],
      date: [
        /(?:invoice\s*date|date\s*issued?|issue\s*date|date)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ],
      dueDate: [
        /(?:due\s*date|payment\s*due|pay\s*by|due)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /(?:net\s+)(\d+)\s+days/i, // "Net 30 days" - calcular desde fecha
      ],
      taxId: [
        /(?:tax\s*id|ein|vat|tin)[\s:#]*([A-Z0-9\-]{8,20})/i,
      ],
    },
    staticValues: {
      currency: 'USD',
    },
    dateFormat: 'MM/DD/YYYY',
  },

  // Template para Complemento de Pago (REP)
  {
    name: 'Complemento de Pago',
    keywords: [
      'complemento de pago', 'recepción de pagos', 'recepcion de pagos',
      'cfdi de pago', 'rep', 'documento relacionado', 'uuid relacionado',
      'parcialidad', 'saldo insoluto', 'importe pagado', 'número de operación'
    ],
    excludeKeywords: ['cfe', 'telmex', 'nómina'],
    patterns: {
      supplierName: [
        /(?:emisor|proveedor|raz[oó]n\s*social)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{3,100})/i,
      ],
      amount: [
        /monto\s*(?:del?\s*)?pago[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /importe\s*pagado[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /total\s*pagado[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      ],
      invoiceNumber: [
        /n[uú]mero\s*(?:de\s*)?operaci[oó]n[\s:]+([A-Z0-9\-]{3,30})/i,
        /referencia[\s:]+([A-Z0-9\-]{3,30})/i,
        /folio[\s:]+([A-Z0-9\-]{1,30})/i,
      ],
      date: [
        /fecha\s*(?:de\s*)?pago[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /fecha\s*(?:de\s*)?operaci[oó]n[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ],
      taxId: [
        /rfc[\s:]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
      ],
    },
    staticValues: {
      currency: 'MXN',
    },
    dateFormat: 'DD/MM/YYYY',
  },

  // Template para Nómina
  {
    name: 'CFDI Nómina',
    keywords: [
      'recibo de nómina', 'recibo de nomina', 'cfdi de nómina', 'cfdi de nomina',
      'percepciones', 'deducciones', 'neto a pagar', 'sueldo neto',
      'total percepciones', 'total deducciones', 'salario', 'trabajador',
      'empleado', 'curp', 'nss', 'imss', 'infonavit', 'registro patronal'
    ],
    excludeKeywords: ['cfe', 'telmex', 'invoice'],
    patterns: {
      supplierName: [
        /(?:patr[oó]n|empleador|empresa|raz[oó]n\s*social)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{3,100})/i,
      ],
      amount: [
        /neto\s*a\s*pagar[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /sueldo\s*neto[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /total\s*neto[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      ],
      invoiceNumber: [
        /n[uú]mero\s*(?:de\s*)?empleado[\s:]+([A-Z0-9\-]{3,20})/i,
        /folio[\s:]+([A-Z0-9\-]{1,30})/i,
      ],
      date: [
        /fecha\s*(?:de\s*)?pago[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /periodo\s*(?:de\s*)?pago[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ],
      taxId: [
        /rfc[\s:]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
      ],
    },
    staticValues: {
      currency: 'MXN',
    },
    dateFormat: 'DD/MM/YYYY',
  },
];

/**
 * Encuentra el mejor template para un texto dado
 */
export function findMatchingTemplate(text: string): InvoiceTemplate | null {
  const normalizedText = text.toLowerCase();

  for (const template of invoiceTemplates) {
    // Verificar palabras de exclusión primero
    if (template.excludeKeywords?.some(kw => normalizedText.includes(kw.toLowerCase()))) {
      continue;
    }

    // Verificar palabras clave
    const matchCount = template.keywords.filter(kw =>
      normalizedText.includes(kw.toLowerCase())
    ).length;

    // Necesitamos al menos 1 keyword match
    if (matchCount >= 1) {
      console.log(`📋 [Template Match] Template "${template.name}" encontrado (${matchCount} keywords)`);
      return template;
    }
  }

  return null;
}

/**
 * Extrae datos usando un template específico
 */
export function extractWithTemplate(
  text: string,
  template: InvoiceTemplate
): {
  supplierName: string | null;
  amount: number | null;
  invoiceNumber: string | null;
  date: Date | null;
  dueDate: Date | null;
  taxId: string | null;
  currency: string | null;
  reference: string | null;
} {
  const result: ReturnType<typeof extractWithTemplate> = {
    supplierName: null,
    amount: null,
    invoiceNumber: null,
    date: null,
    dueDate: null,
    taxId: null,
    currency: template.staticValues?.currency || null,
    reference: null,
  };

  // Helper para aplicar patrones
  const applyPatterns = (patterns: RegExp | RegExp[] | undefined, text: string): string | null => {
    if (!patterns) return null;
    const patternList = Array.isArray(patterns) ? patterns : [patterns];

    for (const pattern of patternList) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  // Extraer cada campo
  result.supplierName = applyPatterns(template.patterns.supplierName, text) ||
                        template.staticValues?.supplierName || null;

  const amountStr = applyPatterns(template.patterns.amount, text) ||
                    applyPatterns(template.patterns.total, text);
  if (amountStr) {
    result.amount = parseFloat(amountStr.replace(/,/g, ''));
  }

  result.invoiceNumber = applyPatterns(template.patterns.invoiceNumber, text);
  result.taxId = applyPatterns(template.patterns.taxId, text);
  result.reference = applyPatterns(template.patterns.reference, text);

  // Parsear fechas
  const dateStr = applyPatterns(template.patterns.date, text);
  if (dateStr) {
    result.date = parseTemplateDate(dateStr, template.dateFormat);
  }

  const dueDateStr = applyPatterns(template.patterns.dueDate, text);
  if (dueDateStr) {
    // Verificar si es "Net X days"
    const netDaysMatch = dueDateStr.match(/^(\d+)$/);
    if (netDaysMatch && result.date) {
      const days = parseInt(netDaysMatch[1]);
      result.dueDate = new Date(result.date);
      result.dueDate.setDate(result.dueDate.getDate() + days);
    } else {
      result.dueDate = parseTemplateDate(dueDateStr, template.dateFormat);
    }
  }

  // Si no hay dueDate pero hay date, calcular +30 días
  if (!result.dueDate && result.date) {
    result.dueDate = new Date(result.date);
    result.dueDate.setDate(result.dueDate.getDate() + 30);
  }

  console.log(`📋 [Template Extract] Datos extraídos:`, {
    template: template.name,
    supplierName: result.supplierName || 'NO ENCONTRADO',
    amount: result.amount || 'NO ENCONTRADO',
    invoiceNumber: result.invoiceNumber || 'NO ENCONTRADO',
    date: result.date?.toISOString().split('T')[0] || 'NO ENCONTRADO',
    dueDate: result.dueDate?.toISOString().split('T')[0] || 'NO ENCONTRADO',
  });

  return result;
}

/**
 * Mapa de nombres de meses en español
 */
const spanishMonths: { [key: string]: number } = {
  'enero': 0, 'ene': 0,
  'febrero': 1, 'feb': 1,
  'marzo': 2, 'mar': 2,
  'abril': 3, 'abr': 3,
  'mayo': 4, 'may': 4,
  'junio': 5, 'jun': 5,
  'julio': 6, 'jul': 6,
  'agosto': 7, 'ago': 7,
  'septiembre': 8, 'sep': 8, 'sept': 8,
  'octubre': 9, 'oct': 9,
  'noviembre': 10, 'nov': 10,
  'diciembre': 11, 'dic': 11,
  // English months
  'january': 0, 'jan': 0,
  'february': 1,
  'march': 2,
  'april': 3, 'apr': 3,
  'june': 5,
  'july': 6,
  'august': 7, 'aug': 7,
  'september': 8,
  'october': 9,
  'november': 10,
  'december': 11, 'dec': 11,
};

/**
 * Parsea una fecha según el formato del template
 */
function parseTemplateDate(dateStr: string, format?: InvoiceTemplate['dateFormat']): Date | null {
  try {
    // Limpiar la cadena
    dateStr = dateStr.trim().toLowerCase();

    // Intentar primero con nombres de meses en español/inglés
    // Formatos: "15 de enero de 2024", "15 enero 2024", "15 ene 2024", "enero 15, 2024"
    const monthNameMatch = dateStr.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)\.?\s*(?:de\s+|del?\s+)?(\d{2,4})?/i);
    if (monthNameMatch) {
      const day = parseInt(monthNameMatch[1]);
      const monthName = monthNameMatch[2].toLowerCase().replace('.', '');
      const month = spanishMonths[monthName];

      if (month !== undefined) {
        let year = monthNameMatch[3] ? parseInt(monthNameMatch[3]) : new Date().getFullYear();
        if (year < 100) {
          year += year > 50 ? 1900 : 2000;
        }
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? null : date;
      }
    }

    // Intentar detectar el formato numérico
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length !== 3) return null;

    let day: number, month: number, year: number;

    // Detectar formato ISO (YYYY-MM-DD) automáticamente si el primer número tiene 4 dígitos
    if (parts[0].length === 4 && parseInt(parts[0]) > 1900) {
      year = parseInt(parts[0]);
      month = parseInt(parts[1]) - 1;
      day = parseInt(parts[2]);
    } else {
      switch (format) {
        case 'MM/DD/YYYY':
          month = parseInt(parts[0]) - 1;
          day = parseInt(parts[1]);
          year = parseInt(parts[2]);
          break;
        case 'YYYY-MM-DD':
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          day = parseInt(parts[2]);
          break;
        case 'DD-MM-YYYY':
        case 'DD/MM/YYYY':
        default:
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          year = parseInt(parts[2]);
      }
    }

    // Ajustar año de 2 dígitos
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }

    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Template genérico de fallback para cuando no hay match
 * MEJORADO: Patrones más amplios y flexibles
 */
export const fallbackTemplate: InvoiceTemplate = {
  name: 'Fallback Genérico',
  keywords: [],
  patterns: {
    supplierName: [
      // Buscar emisor primero (más confiable para CFDI)
      /(?:emisor|emitter|proveedor|raz[oó]n\s*social|nombre\s*del?\s*emisor)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{3,100})/i,
      // Buscar después de RFC (común en facturas mexicanas)
      /rfc[\s:]*[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}[\s\n]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{3,100})/i,
      // Patrones más genéricos
      /(?:supplier|from|vendor|company)[\s:]+([A-Za-z][A-Za-z0-9\s,\.&\-]{3,80})/i,
    ],
    amount: [
      // Buscar total primero
      /(?:total|monto\s*total|importe\s*total|grand\s*total)[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      // Buscar montos con símbolo de peso
      /\$\s*([\d,]+\.?\d*)/,
      // Buscar montos con MXN/USD
      /([\d,]+\.?\d*)\s*(?:mxn|usd|pesos|dollars?)/i,
      // Buscar el número más grande en el documento (probablemente el total)
      /(?:amount|importe|suma|a\s*pagar)[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
    ],
    invoiceNumber: [
      // Patrones específicos de México
      /no\.?\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      /n[°º]\.?\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      /n[uú]m\.?\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      /n[uú]mero\s*(?:de\s*)?factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      /#\s*factura[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      /factura\s*no\.?[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      /factura[\s:#]+([A-Z0-9\-\/]{3,20})/i,
      // Folio y Serie
      /folio[\s:]+([A-Z0-9\-\/]{1,30})/i,
      /serie\s*y?\s*folio[\s:]+([A-Z0-9\-\/]{1,30})/i,
      /folio\s*fiscal[\s:]+([A-Z0-9\-\/]{1,30})/i,
      // Prefijos comunes
      /(?:F|FA|FACT|INV|FEA)[\-:\s#]+([A-Z0-9\-\/]{3,20})/i,
      // Genéricos
      /(?:number|no\.|#|invoice)[\s:#]*([A-Z0-9\-\/]{1,30})/i,
      /documento\s*no\.?[\s:#]*([A-Z0-9\-\/]{1,30})/i,
    ],
    date: [
      /(?:fecha\s*(?:de\s*)?emisi[oó]n|fecha|date|emitida?)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
      /(\d{4}[\/\-]\d{2}[\/\-]\d{2})/,
    ],
    dueDate: [
      // Patrones en español
      /fecha\s*(?:de\s*)?vencimiento[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /vencimiento[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /vence[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /fecha\s*l[ií]mite(?:\s*(?:de\s*)?pago)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /pagar?\s*antes\s*(?:de|del)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /vigencia[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /validez[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /expira[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      // Patrones en inglés
      /(?:due\s*date|payment\s*due|pay\s*by)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      // Formatos ISO
      /fecha\s*(?:de\s*)?vencimiento[\s:]+(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
      // Formatos con nombre de mes en español
      /(?:vencimiento|vence|fecha\s*l[ií]mite)[\s:]+(\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+|del?\s+)?\d{2,4})?)/i,
      /(?:vencimiento|vence|fecha\s*l[ií]mite)[\s:]+(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s+\d{2,4})/i,
    ],
    taxId: [
      /rfc[\s:]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
      /r\.f\.c\.[\s:]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
      /tax\s*id[\s:]+([A-Z0-9\-]{9,15})/i,
    ],
  },
  staticValues: {
    currency: 'MXN',
  },
  dateFormat: 'DD/MM/YYYY',
};
