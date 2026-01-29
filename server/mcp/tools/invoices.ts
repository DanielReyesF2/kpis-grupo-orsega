/**
 * ============================================================================
 * 📄 MCP INVOICES - Herramientas de Procesamiento de Facturas
 * ============================================================================
 *
 * Este módulo expone herramientas para:
 * - Procesar facturas PDF y XML (CFDI)
 * - Validar datos fiscales mexicanos
 * - Extraer información de documentos
 * - Clasificar tipos de documentos
 * - Buscar facturas en el historial
 *
 * Tipos de documentos soportados:
 * - CFDI (Comprobante Fiscal Digital por Internet)
 * - Complemento de Pago (REP)
 * - Nómina
 * - Notas de Crédito
 * - Facturas Internacionales (USD, EUR)
 * - Recibos de Servicios Públicos (CFE, Telmex, Gas, Agua)
 * - Estados de Cuenta Bancarios
 * - Tickets y Recibos
 * - Pedimentos de Importación/Exportación
 *
 * @module mcp/tools/invoices
 */

import type { MCPTool, MCPToolResult, MCPContext } from '../index';

// ============================================================================
// DEFINICIÓN DE HERRAMIENTAS
// ============================================================================

export const invoiceTools: MCPTool[] = [
  // -------------------------------------------------------------------------
  // PROCESS_INVOICE - Procesar factura PDF/XML
  // -------------------------------------------------------------------------
  {
    name: 'process_invoice',
    description: `Procesa una factura en formato PDF o XML y extrae todos los datos relevantes.

    Datos que extrae:
    - Proveedor (nombre, RFC, dirección)
    - Receptor (nombre, RFC)
    - Monto total, subtotal, IVA, ISR, IEPS
    - Número de factura/folio
    - Fecha de emisión y vencimiento
    - UUID (para CFDI)
    - Moneda y tipo de cambio
    - Conceptos/líneas de detalle
    - Método y forma de pago

    Formatos soportados: PDF, XML (CFDI 3.3, 4.0)
    Confianza mínima recomendada: 70%`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        file_base64: {
          type: 'string',
          description: 'Archivo en formato Base64 (PDF o XML)',
        },
        file_url: {
          type: 'string',
          description: 'URL del archivo a procesar (alternativa a base64)',
        },
        file_type: {
          type: 'string',
          description: 'Tipo de archivo',
          enum: ['pdf', 'xml', 'auto'],
        },
        document_type_hint: {
          type: 'string',
          description: 'Pista del tipo de documento para mejorar extracción',
          enum: [
            'cfdi_ingreso',
            'cfdi_egreso',
            'cfdi_traslado',
            'cfdi_nomina',
            'cfdi_pago',
            'nota_credito',
            'recibo_cfe',
            'recibo_telmex',
            'recibo_gas',
            'recibo_agua',
            'factura_internacional',
            'estado_cuenta',
            'ticket',
            'pedimento',
            'auto'
          ],
        },
        extract_line_items: {
          type: 'boolean',
          description: 'Si debe extraer el detalle de conceptos/líneas (default: true)',
        },
        validate_cfdi: {
          type: 'boolean',
          description: 'Si debe validar el CFDI contra el SAT (default: false)',
        },
      },
      required: ['file_base64'],
    },
  },

  // -------------------------------------------------------------------------
  // VALIDATE_RFC - Validar RFC mexicano
  // -------------------------------------------------------------------------
  {
    name: 'validate_rfc',
    description: `Valida un RFC (Registro Federal de Contribuyentes) mexicano.

    Validaciones que realiza:
    - Formato correcto (persona física: 13 caracteres, persona moral: 12)
    - Estructura de fecha válida
    - Dígito verificador correcto
    - Verificación opcional contra lista del SAT

    Retorna:
    - valid: boolean
    - type: 'persona_fisica' | 'persona_moral'
    - name_from_sat: string (si está disponible)
    - status: 'activo' | 'cancelado' | 'suspendido'`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        rfc: {
          type: 'string',
          description: 'RFC a validar (12-13 caracteres)',
        },
        check_sat: {
          type: 'boolean',
          description: 'Verificar contra el SAT (más lento pero más preciso)',
        },
      },
      required: ['rfc'],
    },
  },

  // -------------------------------------------------------------------------
  // VALIDATE_CFDI - Validar CFDI contra SAT
  // -------------------------------------------------------------------------
  {
    name: 'validate_cfdi',
    description: `Valida un CFDI (Comprobante Fiscal Digital) contra el SAT.

    Validaciones:
    - UUID registrado en el SAT
    - Estado del comprobante (vigente, cancelado)
    - Fecha de cancelación (si aplica)
    - Motivo de cancelación (si aplica)
    - RFC emisor y receptor válidos
    - Sello digital válido
    - Cadena original correcta

    Requiere: UUID + RFC emisor + RFC receptor + Total`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID del CFDI (36 caracteres con guiones)',
        },
        rfc_emisor: {
          type: 'string',
          description: 'RFC del emisor',
        },
        rfc_receptor: {
          type: 'string',
          description: 'RFC del receptor',
        },
        total: {
          type: 'number',
          description: 'Monto total del comprobante',
        },
      },
      required: ['uuid', 'rfc_emisor', 'rfc_receptor', 'total'],
    },
  },

  // -------------------------------------------------------------------------
  // CLASSIFY_DOCUMENT - Clasificar tipo de documento
  // -------------------------------------------------------------------------
  {
    name: 'classify_document',
    description: `Clasifica un documento financiero según su tipo.

    Tipos que detecta:
    - CFDI de Ingreso (factura de venta)
    - CFDI de Egreso (nota de crédito)
    - CFDI de Traslado
    - CFDI de Nómina
    - Complemento de Pago (REP)
    - Recibos de servicios (CFE, Telmex, Gas, Agua, Predial)
    - Factura internacional
    - Estado de cuenta bancario
    - Ticket/Recibo simple
    - Pedimento de importación/exportación
    - Contrato
    - Orden de compra
    - Cotización

    Retorna tipo detectado con nivel de confianza.`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        file_base64: {
          type: 'string',
          description: 'Archivo en formato Base64',
        },
        file_url: {
          type: 'string',
          description: 'URL del archivo (alternativa a base64)',
        },
        text_content: {
          type: 'string',
          description: 'Texto ya extraído del documento (alternativa a archivo)',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // SEARCH_INVOICES - Buscar facturas en historial
  // -------------------------------------------------------------------------
  {
    name: 'search_invoices',
    description: `Busca facturas en el historial del sistema.

    Criterios de búsqueda:
    - Por proveedor (nombre o RFC)
    - Por rango de fechas
    - Por rango de montos
    - Por estado (pendiente, pagada, vencida, cancelada)
    - Por número de factura
    - Por UUID
    - Por concepto/descripción

    Ordenamiento: fecha, monto, proveedor
    Paginación incluida`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_name: {
          type: 'string',
          description: 'Nombre del proveedor (búsqueda parcial)',
        },
        supplier_rfc: {
          type: 'string',
          description: 'RFC del proveedor (exacto)',
        },
        date_from: {
          type: 'string',
          description: 'Fecha inicial (YYYY-MM-DD)',
        },
        date_to: {
          type: 'string',
          description: 'Fecha final (YYYY-MM-DD)',
        },
        amount_min: {
          type: 'number',
          description: 'Monto mínimo',
        },
        amount_max: {
          type: 'number',
          description: 'Monto máximo',
        },
        status: {
          type: 'string',
          description: 'Estado de la factura',
          enum: ['pending', 'paid', 'overdue', 'cancelled', 'all'],
        },
        invoice_number: {
          type: 'string',
          description: 'Número de factura (búsqueda parcial)',
        },
        uuid: {
          type: 'string',
          description: 'UUID del CFDI (exacto)',
        },
        concept: {
          type: 'string',
          description: 'Texto en conceptos/descripción',
        },
        currency: {
          type: 'string',
          description: 'Moneda',
          enum: ['MXN', 'USD', 'EUR', 'all'],
        },
        order_by: {
          type: 'string',
          description: 'Campo de ordenamiento',
          enum: ['date_desc', 'date_asc', 'amount_desc', 'amount_asc', 'supplier'],
        },
        page: {
          type: 'number',
          description: 'Página (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Resultados por página (default: 20, max: 100)',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_INVOICE_DETAILS - Obtener detalles de factura
  // -------------------------------------------------------------------------
  {
    name: 'get_invoice_details',
    description: `Obtiene todos los detalles de una factura específica.

    Incluye:
    - Datos completos del proveedor
    - Datos del receptor
    - Desglose de montos (subtotal, IVA, ISR, IEPS, total)
    - Conceptos/líneas de detalle
    - Historial de pagos
    - Documentos relacionados
    - Estado actual y fechas
    - Archivos adjuntos (PDF, XML)`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: {
          type: 'number',
          description: 'ID interno de la factura',
        },
        uuid: {
          type: 'string',
          description: 'UUID del CFDI (alternativa a invoice_id)',
        },
        include_files: {
          type: 'boolean',
          description: 'Incluir archivos en base64 (default: false)',
        },
        include_history: {
          type: 'boolean',
          description: 'Incluir historial de cambios (default: true)',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // COMPARE_INVOICES - Comparar facturas
  // -------------------------------------------------------------------------
  {
    name: 'compare_invoices',
    description: `Compara dos o más facturas para detectar diferencias o patrones.

    Útil para:
    - Detectar duplicados
    - Comparar precios entre periodos
    - Analizar variaciones de un mismo proveedor
    - Detectar anomalías en montos

    Retorna:
    - Diferencias en cada campo
    - Porcentaje de variación en montos
    - Alerta si hay posibles duplicados`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_ids: {
          type: 'array',
          description: 'Lista de IDs de facturas a comparar',
          items: { type: 'number' },
        },
        comparison_type: {
          type: 'string',
          description: 'Tipo de comparación',
          enum: ['full', 'amounts_only', 'dates_only', 'duplicate_check'],
        },
      },
      required: ['invoice_ids'],
    },
  },

  // -------------------------------------------------------------------------
  // GET_SUPPLIER_HISTORY - Historial de proveedor
  // -------------------------------------------------------------------------
  {
    name: 'get_supplier_history',
    description: `Obtiene el historial completo de un proveedor.

    Incluye:
    - Total de facturas
    - Monto total facturado
    - Promedio por factura
    - Frecuencia de facturación
    - Tendencia de precios
    - Tiempo promedio de pago
    - Facturas pendientes
    - Última factura recibida`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_rfc: {
          type: 'string',
          description: 'RFC del proveedor',
        },
        supplier_name: {
          type: 'string',
          description: 'Nombre del proveedor (si no tiene RFC)',
        },
        period_months: {
          type: 'number',
          description: 'Meses de historial a analizar (default: 12)',
        },
        include_invoices: {
          type: 'boolean',
          description: 'Incluir lista de facturas (default: false)',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // EXTRACT_FROM_EMAIL - Extraer facturas de email
  // -------------------------------------------------------------------------
  {
    name: 'extract_from_email',
    description: `Extrae facturas de un correo electrónico.

    Capacidades:
    - Detecta archivos adjuntos PDF y XML
    - Procesa múltiples facturas en un email
    - Extrae información del cuerpo del correo
    - Asocia XML con su PDF correspondiente
    - Maneja correos reenviados`,
    category: 'invoices',
    inputSchema: {
      type: 'object',
      properties: {
        email_content: {
          type: 'string',
          description: 'Contenido del correo en formato EML o texto',
        },
        attachments: {
          type: 'array',
          description: 'Lista de adjuntos en base64 con sus nombres',
          items: { type: 'object' },
        },
        sender_email: {
          type: 'string',
          description: 'Email del remitente para asociar proveedor',
        },
      },
      required: ['email_content'],
    },
  },
];

// ============================================================================
// EJECUTOR DE HERRAMIENTAS
// ============================================================================

/**
 * Ejecuta una herramienta de facturas
 */
export async function executeInvoiceTool(
  toolName: string,
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  console.log(`📄 [MCP Invoices] Ejecutando: ${toolName}`);

  switch (toolName) {
    // -------------------------------------------------------------------------
    case 'process_invoice':
      return await processInvoice(params, context);

    // -------------------------------------------------------------------------
    case 'validate_rfc':
      return await validateRFC(params);

    // -------------------------------------------------------------------------
    case 'validate_cfdi':
      return await validateCFDI(params);

    // -------------------------------------------------------------------------
    case 'classify_document':
      return await classifyDocument(params);

    // -------------------------------------------------------------------------
    case 'search_invoices':
      return await searchInvoices(params, context);

    // -------------------------------------------------------------------------
    case 'get_invoice_details':
      return await getInvoiceDetails(params, context);

    // -------------------------------------------------------------------------
    case 'compare_invoices':
      return await compareInvoices(params, context);

    // -------------------------------------------------------------------------
    case 'get_supplier_history':
      return await getSupplierHistory(params, context);

    // -------------------------------------------------------------------------
    case 'extract_from_email':
      return await extractFromEmail(params, context);

    // -------------------------------------------------------------------------
    default:
      return {
        success: false,
        error: `Herramienta de facturas no implementada: ${toolName}`,
      };
  }
}

// ============================================================================
// IMPLEMENTACIONES
// ============================================================================

/**
 * Procesa una factura PDF o XML
 */
async function processInvoice(
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  try {
    const { file_base64, file_url, file_type = 'auto', document_type_hint, extract_line_items = true, validate_cfdi = false } = params;

    // Importar el analizador de documentos existente
    const { analyzePaymentDocument } = await import('../../document-analyzer');

    // Preparar el archivo
    let fileBuffer: Buffer;
    let mimeType = 'application/pdf';

    if (file_base64) {
      fileBuffer = Buffer.from(file_base64, 'base64');
      // Detectar tipo por magic bytes
      if (fileBuffer[0] === 0x3C) { // '<' = XML
        mimeType = 'text/xml';
      } else if (fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50) { // '%P' = PDF
        mimeType = 'application/pdf';
      }
    } else if (file_url) {
      // Descargar archivo desde URL
      const response = await fetch(file_url);
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      mimeType = response.headers.get('content-type') || 'application/pdf';
    } else {
      return {
        success: false,
        error: 'Se requiere file_base64 o file_url',
      };
    }

    // Usar el analizador existente (2 args: buffer + mimeType)
    const result = await analyzePaymentDocument(fileBuffer, mimeType);

    // Formatear respuesta mapeando desde DocumentAnalysisResult
    return {
      success: true,
      data: {
        // Datos extraídos
        supplier: {
          name: result.extractedSupplierName || null,
          rfc: result.extractedTaxId || null,
        },
        invoice: {
          number: result.extractedInvoiceNumber || null,
          uuid: result.relatedInvoiceUUID || null,
          date: result.extractedDate || null,
          due_date: result.extractedDueDate || null,
        },
        amounts: {
          subtotal: null, // No disponible en DocumentAnalysisResult
          iva: null,
          isr_retained: null,
          iva_retained: null,
          total: result.extractedAmount || null,
          currency: result.extractedCurrency || 'MXN',
        },
        // Metadatos
        document_type: result.documentType || 'invoice',
        extraction_method: result.paymentMethod || 'unknown',
        confidence: result.ocrConfidence || 0,
        raw_text: result.rawResponse?.substring(0, 500) || null,
        // Conceptos no disponibles en DocumentAnalysisResult
        line_items: [],
      },
    };

  } catch (error) {
    console.error('❌ [MCP Invoices] Error procesando factura:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error procesando factura',
    };
  }
}

/**
 * Valida un RFC mexicano
 */
async function validateRFC(params: Record<string, any>): Promise<MCPToolResult> {
  const { rfc, check_sat = false } = params;

  if (!rfc) {
    return { success: false, error: 'RFC es requerido' };
  }

  const rfcClean = rfc.toUpperCase().trim();

  // Patrones de RFC
  const rfcPersonaFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
  const rfcPersonaMoral = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;

  let isValid = false;
  let type: 'persona_fisica' | 'persona_moral' | 'unknown' = 'unknown';

  if (rfcPersonaFisica.test(rfcClean)) {
    isValid = true;
    type = 'persona_fisica';
  } else if (rfcPersonaMoral.test(rfcClean)) {
    isValid = true;
    type = 'persona_moral';
  }

  // Validar fecha embebida
  if (isValid) {
    const dateStart = type === 'persona_fisica' ? 4 : 3;
    const dateStr = rfcClean.substring(dateStart, dateStart + 6);
    const year = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      isValid = false;
    }
  }

  return {
    success: true,
    data: {
      rfc: rfcClean,
      valid: isValid,
      type,
      format_correct: isValid,
      // TODO: Implementar verificación contra SAT si check_sat = true
      sat_verified: check_sat ? null : undefined,
      sat_status: check_sat ? null : undefined,
    },
  };
}

/**
 * Valida un CFDI contra el SAT
 */
async function validateCFDI(params: Record<string, any>): Promise<MCPToolResult> {
  const { uuid, rfc_emisor, rfc_receptor, total } = params;

  // Por ahora, validación básica del formato UUID
  const uuidPattern = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

  if (!uuidPattern.test(uuid)) {
    return {
      success: true,
      data: {
        uuid,
        valid: false,
        status: 'invalid_format',
        message: 'Formato de UUID inválido',
      },
    };
  }

  // TODO: Implementar verificación real contra servicios del SAT
  return {
    success: true,
    data: {
      uuid,
      valid: true,
      status: 'format_valid',
      message: 'Formato de UUID válido. Verificación contra SAT pendiente de implementar.',
      rfc_emisor,
      rfc_receptor,
      total,
      sat_verification: null,
    },
  };
}

/**
 * Clasifica el tipo de documento
 */
async function classifyDocument(params: Record<string, any>): Promise<MCPToolResult> {
  const { file_base64, text_content } = params;

  let text = text_content || '';

  if (file_base64 && !text) {
    // TODO: Extraer texto del documento
    text = '';
  }

  const textLower = text.toLowerCase();

  // Patrones de clasificación
  const patterns: Array<{ type: string; keywords: string[]; confidence: number }> = [
    { type: 'cfdi_ingreso', keywords: ['cfdi', 'comprobante fiscal', 'factura', 'ingreso'], confidence: 0 },
    { type: 'cfdi_nomina', keywords: ['nómina', 'nomina', 'percepciones', 'deducciones', 'salario'], confidence: 0 },
    { type: 'cfdi_pago', keywords: ['complemento de pago', 'recepción de pagos', 'rep'], confidence: 0 },
    { type: 'nota_credito', keywords: ['nota de crédito', 'nota de credito', 'egreso'], confidence: 0 },
    { type: 'recibo_cfe', keywords: ['cfe', 'comisión federal de electricidad', 'kwh'], confidence: 0 },
    { type: 'recibo_telmex', keywords: ['telmex', 'teléfono', 'línea telefónica'], confidence: 0 },
    { type: 'factura_internacional', keywords: ['invoice', 'usd', 'dollar', 'bill to'], confidence: 0 },
    { type: 'estado_cuenta', keywords: ['estado de cuenta', 'saldo anterior', 'movimientos'], confidence: 0 },
    { type: 'ticket', keywords: ['ticket', 'recibo', 'nota de venta'], confidence: 0 },
    { type: 'pedimento', keywords: ['pedimento', 'aduana', 'importación', 'exportación'], confidence: 0 },
  ];

  // Calcular confianza para cada tipo
  for (const pattern of patterns) {
    let matches = 0;
    for (const keyword of pattern.keywords) {
      if (textLower.includes(keyword)) {
        matches++;
      }
    }
    pattern.confidence = matches / pattern.keywords.length;
  }

  // Ordenar por confianza
  patterns.sort((a, b) => b.confidence - a.confidence);

  const topMatch = patterns[0];

  return {
    success: true,
    data: {
      detected_type: topMatch.confidence > 0.2 ? topMatch.type : 'unknown',
      confidence: topMatch.confidence,
      all_matches: patterns.filter(p => p.confidence > 0).slice(0, 3),
    },
  };
}

/**
 * Busca facturas en el historial
 */
async function searchInvoices(
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  // TODO: Implementar búsqueda en base de datos
  return {
    success: true,
    data: {
      invoices: [],
      total: 0,
      page: params.page || 1,
      limit: params.limit || 20,
      message: 'Búsqueda de facturas pendiente de implementar con conexión a DB',
    },
  };
}

/**
 * Obtiene detalles de una factura
 */
async function getInvoiceDetails(
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  // TODO: Implementar consulta a base de datos
  return {
    success: true,
    data: {
      message: 'Detalle de factura pendiente de implementar con conexión a DB',
    },
  };
}

/**
 * Compara facturas
 */
async function compareInvoices(
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  // TODO: Implementar comparación
  return {
    success: true,
    data: {
      message: 'Comparación de facturas pendiente de implementar',
    },
  };
}

/**
 * Obtiene historial de proveedor
 */
async function getSupplierHistory(
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  // TODO: Implementar consulta a base de datos
  return {
    success: true,
    data: {
      message: 'Historial de proveedor pendiente de implementar con conexión a DB',
    },
  };
}

/**
 * Extrae facturas de email
 */
async function extractFromEmail(
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  // TODO: Implementar extracción de email
  return {
    success: true,
    data: {
      message: 'Extracción de email pendiente de implementar',
    },
  };
}

export default {
  invoiceTools,
  executeInvoiceTool,
};
