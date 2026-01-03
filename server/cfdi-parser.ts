/**
 * 📄 cfdi-parser.ts
 * Parser nativo para CFDI (Comprobante Fiscal Digital por Internet)
 * Extrae datos estructurados de facturas electrónicas mexicanas
 *
 * CFDI es XML con estructura definida por el SAT - NO necesita OCR
 */

import { DOMParser } from '@xmldom/xmldom';

export interface CFDIData {
  // Datos generales
  uuid: string | null;
  version: string | null;
  fecha: Date | null;
  folio: string | null;
  serie: string | null;
  formaPago: string | null;
  metodoPago: string | null;
  tipoComprobante: string | null;
  moneda: string | null;
  tipoCambio: number | null;

  // Totales
  subtotal: number | null;
  total: number | null;
  descuento: number | null;

  // Emisor (Proveedor)
  emisor: {
    rfc: string | null;
    nombre: string | null;
    regimenFiscal: string | null;
  };

  // Receptor (Cliente)
  receptor: {
    rfc: string | null;
    nombre: string | null;
    usoCFDI: string | null;
    domicilioFiscal: string | null;
    regimenFiscal: string | null;
  };

  // Conceptos (líneas de detalle)
  conceptos: Array<{
    claveProdServ: string | null;
    cantidad: number;
    claveUnidad: string | null;
    unidad: string | null;
    descripcion: string | null;
    valorUnitario: number;
    importe: number;
    descuento: number | null;
  }>;

  // Impuestos
  impuestos: {
    totalImpuestosTrasladados: number | null;
    totalImpuestosRetenidos: number | null;
    traslados: Array<{
      impuesto: string;
      tipoFactor: string;
      tasaOCuota: number;
      importe: number;
    }>;
    retenciones: Array<{
      impuesto: string;
      importe: number;
    }>;
  };

  // Complementos
  timbreFiscal: {
    uuid: string | null;
    fechaTimbrado: Date | null;
    selloCFD: string | null;
    noCertificadoSAT: string | null;
    selloSAT: string | null;
  } | null;

  // Metadata
  rawXml: string;
  parseSuccess: boolean;
  parseErrors: string[];
}

/**
 * Verifica si el contenido es un CFDI válido
 */
export function isCFDI(content: string | Buffer): boolean {
  const str = content instanceof Buffer ? content.toString('utf-8') : content;

  // Verificar si contiene elementos típicos de CFDI
  return (
    str.includes('cfdi:Comprobante') ||
    str.includes('<Comprobante') ||
    str.includes('xmlns:cfdi') ||
    (str.includes('Version="4.0"') && str.includes('xmlns:cfdi'))
  );
}

/**
 * Parsea un archivo CFDI XML y extrae todos los datos estructurados
 */
export function parseCFDI(xmlContent: string | Buffer): CFDIData {
  const xml = xmlContent instanceof Buffer ? xmlContent.toString('utf-8') : xmlContent;
  const errors: string[] = [];

  const result: CFDIData = {
    uuid: null,
    version: null,
    fecha: null,
    folio: null,
    serie: null,
    formaPago: null,
    metodoPago: null,
    tipoComprobante: null,
    moneda: null,
    tipoCambio: null,
    subtotal: null,
    total: null,
    descuento: null,
    emisor: { rfc: null, nombre: null, regimenFiscal: null },
    receptor: { rfc: null, nombre: null, usoCFDI: null, domicilioFiscal: null, regimenFiscal: null },
    conceptos: [],
    impuestos: {
      totalImpuestosTrasladados: null,
      totalImpuestosRetenidos: null,
      traslados: [],
      retenciones: [],
    },
    timbreFiscal: null,
    rawXml: xml,
    parseSuccess: false,
    parseErrors: [],
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Buscar el elemento Comprobante (raíz del CFDI)
    const comprobante = doc.getElementsByTagName('cfdi:Comprobante')[0] ||
                        doc.getElementsByTagName('Comprobante')[0];

    if (!comprobante) {
      errors.push('No se encontró el elemento Comprobante en el XML');
      result.parseErrors = errors;
      return result;
    }

    // Extraer atributos del Comprobante
    result.version = comprobante.getAttribute('Version') || comprobante.getAttribute('version');
    result.folio = comprobante.getAttribute('Folio') || comprobante.getAttribute('folio');
    result.serie = comprobante.getAttribute('Serie') || comprobante.getAttribute('serie');
    result.formaPago = comprobante.getAttribute('FormaPago');
    result.metodoPago = comprobante.getAttribute('MetodoPago');
    result.tipoComprobante = comprobante.getAttribute('TipoDeComprobante');
    result.moneda = comprobante.getAttribute('Moneda') || 'MXN';

    const fechaStr = comprobante.getAttribute('Fecha');
    if (fechaStr) {
      result.fecha = new Date(fechaStr);
    }

    const tipoCambioStr = comprobante.getAttribute('TipoCambio');
    if (tipoCambioStr) {
      result.tipoCambio = parseFloat(tipoCambioStr);
    }

    const subtotalStr = comprobante.getAttribute('SubTotal');
    if (subtotalStr) {
      result.subtotal = parseFloat(subtotalStr);
    }

    const totalStr = comprobante.getAttribute('Total');
    if (totalStr) {
      result.total = parseFloat(totalStr);
    }

    const descuentoStr = comprobante.getAttribute('Descuento');
    if (descuentoStr) {
      result.descuento = parseFloat(descuentoStr);
    }

    // Extraer Emisor
    const emisor = doc.getElementsByTagName('cfdi:Emisor')[0] ||
                   doc.getElementsByTagName('Emisor')[0];
    if (emisor) {
      result.emisor.rfc = emisor.getAttribute('Rfc') || emisor.getAttribute('rfc');
      result.emisor.nombre = emisor.getAttribute('Nombre') || emisor.getAttribute('nombre');
      result.emisor.regimenFiscal = emisor.getAttribute('RegimenFiscal');
    }

    // Extraer Receptor
    const receptor = doc.getElementsByTagName('cfdi:Receptor')[0] ||
                     doc.getElementsByTagName('Receptor')[0];
    if (receptor) {
      result.receptor.rfc = receptor.getAttribute('Rfc') || receptor.getAttribute('rfc');
      result.receptor.nombre = receptor.getAttribute('Nombre') || receptor.getAttribute('nombre');
      result.receptor.usoCFDI = receptor.getAttribute('UsoCFDI');
      result.receptor.domicilioFiscal = receptor.getAttribute('DomicilioFiscalReceptor');
      result.receptor.regimenFiscal = receptor.getAttribute('RegimenFiscalReceptor');
    }

    // Extraer Conceptos
    const conceptos = doc.getElementsByTagName('cfdi:Concepto') ||
                      doc.getElementsByTagName('Concepto');
    for (let i = 0; i < conceptos.length; i++) {
      const concepto = conceptos[i];
      result.conceptos.push({
        claveProdServ: concepto.getAttribute('ClaveProdServ'),
        cantidad: parseFloat(concepto.getAttribute('Cantidad') || '1'),
        claveUnidad: concepto.getAttribute('ClaveUnidad'),
        unidad: concepto.getAttribute('Unidad'),
        descripcion: concepto.getAttribute('Descripcion'),
        valorUnitario: parseFloat(concepto.getAttribute('ValorUnitario') || '0'),
        importe: parseFloat(concepto.getAttribute('Importe') || '0'),
        descuento: concepto.getAttribute('Descuento') ? parseFloat(concepto.getAttribute('Descuento')!) : null,
      });
    }

    // Extraer Impuestos
    const impuestos = doc.getElementsByTagName('cfdi:Impuestos')[0] ||
                      doc.getElementsByTagName('Impuestos')[0];
    if (impuestos) {
      const totalTrasladados = impuestos.getAttribute('TotalImpuestosTrasladados');
      if (totalTrasladados) {
        result.impuestos.totalImpuestosTrasladados = parseFloat(totalTrasladados);
      }

      const totalRetenidos = impuestos.getAttribute('TotalImpuestosRetenidos');
      if (totalRetenidos) {
        result.impuestos.totalImpuestosRetenidos = parseFloat(totalRetenidos);
      }

      // Traslados
      const traslados = impuestos.getElementsByTagName('cfdi:Traslado') ||
                        impuestos.getElementsByTagName('Traslado');
      for (let i = 0; i < traslados.length; i++) {
        const traslado = traslados[i];
        result.impuestos.traslados.push({
          impuesto: traslado.getAttribute('Impuesto') || '',
          tipoFactor: traslado.getAttribute('TipoFactor') || '',
          tasaOCuota: parseFloat(traslado.getAttribute('TasaOCuota') || '0'),
          importe: parseFloat(traslado.getAttribute('Importe') || '0'),
        });
      }

      // Retenciones
      const retenciones = impuestos.getElementsByTagName('cfdi:Retencion') ||
                          impuestos.getElementsByTagName('Retencion');
      for (let i = 0; i < retenciones.length; i++) {
        const retencion = retenciones[i];
        result.impuestos.retenciones.push({
          impuesto: retencion.getAttribute('Impuesto') || '',
          importe: parseFloat(retencion.getAttribute('Importe') || '0'),
        });
      }
    }

    // Extraer Timbre Fiscal Digital (complemento obligatorio)
    const timbre = doc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] ||
                   doc.getElementsByTagName('TimbreFiscalDigital')[0];
    if (timbre) {
      result.timbreFiscal = {
        uuid: timbre.getAttribute('UUID'),
        fechaTimbrado: timbre.getAttribute('FechaTimbrado') ? new Date(timbre.getAttribute('FechaTimbrado')!) : null,
        selloCFD: timbre.getAttribute('SelloCFD'),
        noCertificadoSAT: timbre.getAttribute('NoCertificadoSAT'),
        selloSAT: timbre.getAttribute('SelloSAT'),
      };

      // El UUID del timbre es el identificador principal del CFDI
      result.uuid = result.timbreFiscal.uuid;
    }

    result.parseSuccess = true;

    console.log(`✅ [CFDI Parser] Factura parseada exitosamente:`, {
      uuid: result.uuid,
      emisor: result.emisor.nombre,
      receptor: result.receptor.nombre,
      total: result.total,
      moneda: result.moneda,
      conceptos: result.conceptos.length,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Error parseando XML: ${errorMsg}`);
    console.error(`❌ [CFDI Parser] Error:`, error);
  }

  result.parseErrors = errors;
  return result;
}

/**
 * Convierte datos de CFDI al formato esperado por el sistema de facturas
 */
export function cfdiToInvoiceData(cfdi: CFDIData): {
  extractedSupplierName: string | null;
  extractedAmount: number | null;
  extractedCurrency: string | null;
  extractedDueDate: Date | null;
  extractedDate: Date | null;
  extractedInvoiceNumber: string | null;
  extractedTaxId: string | null;
  extractedReference: string | null;
  documentType: 'invoice' | 'voucher' | 'rep' | 'unknown';
  ocrConfidence: number;
  paymentMethod: string | null;
  paymentTerms: string | null;
  // Datos adicionales de CFDI
  cfdiData: {
    uuid: string | null;
    receptor: {
      rfc: string | null;
      nombre: string | null;
    };
    conceptos: number;
    impuestos: number | null;
  };
} {
  // Calcular fecha de vencimiento (30 días por defecto si no hay info)
  let dueDate: Date | null = null;
  if (cfdi.fecha) {
    dueDate = new Date(cfdi.fecha);
    dueDate.setDate(dueDate.getDate() + 30); // Default +30 días
  }

  // Determinar tipo de documento basado en TipoDeComprobante
  let documentType: 'invoice' | 'voucher' | 'rep' | 'unknown' = 'invoice';
  if (cfdi.tipoComprobante === 'P') {
    documentType = 'rep'; // Pago
  } else if (cfdi.tipoComprobante === 'I') {
    documentType = 'invoice'; // Ingreso
  } else if (cfdi.tipoComprobante === 'E') {
    documentType = 'invoice'; // Egreso (nota de crédito)
  }

  // Construir número de factura
  let invoiceNumber = cfdi.folio || '';
  if (cfdi.serie && cfdi.folio) {
    invoiceNumber = `${cfdi.serie}-${cfdi.folio}`;
  }

  // Método de pago legible
  const metodoPagoMap: Record<string, string> = {
    'PUE': 'Pago en Una Exhibición',
    'PPD': 'Pago en Parcialidades o Diferido',
  };

  return {
    extractedSupplierName: cfdi.emisor.nombre,
    extractedAmount: cfdi.total,
    extractedCurrency: cfdi.moneda,
    extractedDueDate: dueDate,
    extractedDate: cfdi.fecha,
    extractedInvoiceNumber: invoiceNumber || null,
    extractedTaxId: cfdi.emisor.rfc,
    extractedReference: cfdi.uuid,
    documentType,
    ocrConfidence: cfdi.parseSuccess ? 1.0 : 0, // 100% confianza para CFDI parseado
    paymentMethod: cfdi.formaPago,
    paymentTerms: cfdi.metodoPago ? metodoPagoMap[cfdi.metodoPago] || cfdi.metodoPago : null,
    cfdiData: {
      uuid: cfdi.uuid,
      receptor: {
        rfc: cfdi.receptor.rfc,
        nombre: cfdi.receptor.nombre,
      },
      conceptos: cfdi.conceptos.length,
      impuestos: cfdi.impuestos.totalImpuestosTrasladados,
    },
  };
}
