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
 */
export const invoiceTemplates: InvoiceTemplate[] = [
  // Template genérico para CFDI/SAT
  {
    name: 'CFDI Genérico',
    keywords: ['cfdi', 'comprobante fiscal', 'sat', 'folio fiscal', 'uuid'],
    patterns: {
      supplierName: [
        /(?:emisor|emitter|proveedor)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?)?)/i,
        /razón\s+social[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80})/i,
      ],
      amount: [
        /total[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /importe\s+total[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      ],
      invoiceNumber: [
        /folio[\s:]+([A-Z0-9\-]{3,20})/i,
        /número\s+de\s+factura[\s:]+([A-Z0-9\-]{3,20})/i,
        /(?:FEA|FAC|INV)[:\s]*([0-9]{6,15})/i,
      ],
      date: [
        /fecha\s+de\s+emisión[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /fecha[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      ],
      taxId: [
        /rfc[\s:]+([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
      ],
    },
    staticValues: {
      currency: 'MXN',
    },
    dateFormat: 'DD/MM/YYYY',
  },

  // Template para facturas de energía (CFE, etc.)
  {
    name: 'Servicios Públicos',
    keywords: ['cfe', 'comisión federal de electricidad', 'telmex', 'izzi', 'totalplay'],
    patterns: {
      amount: [
        /total\s+a\s+pagar[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /importe[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      ],
      invoiceNumber: [
        /número\s+de\s+servicio[\s:]+(\d{10,15})/i,
        /cuenta[\s:]+(\d{8,15})/i,
        /recibo[\s:]+([A-Z0-9\-]{5,20})/i,
      ],
      dueDate: [
        /fecha\s+límite[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /vence[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      ],
    },
    staticValues: {
      currency: 'MXN',
    },
  },

  // Template para proveedores internacionales
  {
    name: 'Internacional (USD)',
    keywords: ['invoice', 'bill to', 'ship to', 'usd', 'united states', 'usa'],
    excludeKeywords: ['mxn', 'pesos', 'cfdi'],
    patterns: {
      supplierName: [
        /(?:from|vendor|supplier)[\s:]+([A-Za-z0-9\s,\.&\-]{5,80}(?:Inc\.?|LLC\.?|Corp\.?)?)/i,
      ],
      amount: [
        /(?:total|amount\s+due|balance\s+due)[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
        /(?:grand\s+total)[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      ],
      invoiceNumber: [
        /invoice\s+(?:#|no\.?|number)[\s:]+([A-Z0-9\-]{3,20})/i,
        /inv[\s#:]+([A-Z0-9\-]{3,20})/i,
      ],
      date: [
        /(?:invoice\s+)?date[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /dated[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      ],
      dueDate: [
        /(?:due\s+date|payment\s+due)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(?:net\s+)(\d+)\s+days/i, // "Net 30 days" - calcular desde fecha
      ],
    },
    staticValues: {
      currency: 'USD',
    },
    dateFormat: 'MM/DD/YYYY',
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
 * Parsea una fecha según el formato del template
 */
function parseTemplateDate(dateStr: string, format?: InvoiceTemplate['dateFormat']): Date | null {
  try {
    // Limpiar la cadena
    dateStr = dateStr.trim();

    // Intentar detectar el formato
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length !== 3) return null;

    let day: number, month: number, year: number;

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
 */
export const fallbackTemplate: InvoiceTemplate = {
  name: 'Fallback Genérico',
  keywords: [],
  patterns: {
    supplierName: [
      /(?:proveedor|emisor|supplier|from|vendor)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80})/i,
      /razón\s+social[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80})/i,
    ],
    amount: [
      /(?:total|monto|amount|importe|suma)[\s:$]*\$?\s*([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.?\d*)\s*(?:mxn|usd|pesos)?/i,
    ],
    invoiceNumber: [
      /(?:folio|número|number|no\.|#|factura|invoice)[\s:#]+([A-Z0-9\-]{3,20})/i,
    ],
    date: [
      /(?:fecha|date)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    ],
    taxId: [
      /rfc[\s:]+([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
      /tax\s*id[\s:]+([A-Z0-9\-]{9,15})/i,
    ],
  },
  staticValues: {
    currency: 'MXN',
  },
  dateFormat: 'DD/MM/YYYY',
};
