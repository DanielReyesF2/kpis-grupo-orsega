// ================================================
// 📄 document-analyzer.ts
// Analizador HÍBRIDO de documentos:
//   1. XML (CFDI) → Parser nativo (100% precisión)
//   2. PDF → invoice2data Python microservice (95% precisión)
//   3. PDF → Templates TypeScript + pdf-parse (alta precisión)
//   4. Fallback → OpenAI Vision (para documentos desconocidos)
// ================================================

import OpenAI from "openai";
import { isCFDI, parseCFDI, cfdiToInvoiceData } from "./cfdi-parser";
import { findMatchingTemplate, extractWithTemplate, fallbackTemplate } from "./invoice-templates";

// URL del microservicio Python de invoice2data
const INVOICE2DATA_URL = process.env.INVOICE2DATA_URL || "http://localhost:5050";

// ========================================
// DIAGNÓSTICO DE CONFIGURACIÓN Y DEPENDENCIAS
// ========================================
const CONFIG_STATUS = {
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  OPENAI_API_KEY_PREFIX: process.env.OPENAI_API_KEY?.substring(0, 7) || 'NOT_SET',
  INVOICE2DATA_URL: process.env.INVOICE2DATA_URL || 'default:localhost:5050',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

console.log('📊 [Document Analyzer] ====================================================');
console.log('📊 [Document Analyzer] MÓDULO CARGADO - Diagnóstico de inicio');
console.log('📊 [Document Analyzer] ====================================================');
console.log('📊 [Document Analyzer] Configuración:', JSON.stringify(CONFIG_STATUS, null, 2));

// Verificar dependencias críticas al cargar el módulo
(async () => {
  console.log('🔍 [Dependency Check] Verificando dependencias críticas...');

  // 1. Verificar pdf-parse
  try {
    const pdfParse = await import('pdf-parse') as any;
    console.log('✅ [Dependency Check] pdf-parse: OK');
  } catch (e: any) {
    console.error('❌ [Dependency Check] pdf-parse: ERROR -', e.message);
  }

  // 2. Verificar OpenAI
  try {
    const openai = await import('openai');
    console.log('✅ [Dependency Check] openai: OK');
  } catch (e: any) {
    console.error('❌ [Dependency Check] openai: ERROR -', e.message);
  }

  // 3. Verificar microservicio invoice2data
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${INVOICE2DATA_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const healthData = await response.json();
      console.log('✅ [Dependency Check] invoice2data microservice: OK');
      console.log('   - URL:', INVOICE2DATA_URL);
      console.log('   - pdf2image:', healthData.dependencies?.pdf2image || 'unknown');
      console.log('   - poppler:', healthData.dependencies?.poppler || 'unknown');
    } else {
      console.warn('⚠️ [Dependency Check] invoice2data microservice: HTTP', response.status);
    }
  } catch (e: any) {
    console.warn('⚠️ [Dependency Check] invoice2data microservice: NO disponible -', e.message?.substring(0, 50));
  }

  console.log('📊 [Document Analyzer] ====================================================');
  console.log('📊 [Document Analyzer] Diagnóstico completado');
  console.log('📊 [Document Analyzer] ====================================================');
})();

/**
 * Llama al microservicio Python invoice2data para extraer datos
 */
async function callInvoice2DataService(fileBuffer: Buffer, fileName: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    // Crear FormData manualmente para Node.js
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileContent = fileBuffer.toString('binary');

    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: application/pdf',
      '',
      fileContent,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const response = await fetch(`${INVOICE2DATA_URL}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.from(body, 'binary'),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    return { success: result.success, data: result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ [invoice2data] Error conectando al servicio: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Verifica si el microservicio invoice2data está disponible
 */
async function isInvoice2DataAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const response = await fetch(`${INVOICE2DATA_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Importación dinámica de pdfjs-dist para extracción de texto
let pdfjsLib: any = null;
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib = pdfjsModule.default || pdfjsModule;
    return pdfjsLib;
  } catch (error) {
    console.warn('⚠️ pdfjs-dist no está disponible. La extracción de texto de PDFs estará limitada.');
    return null;
  }
}

/**
 * Convierte la primera página de un PDF a imagen PNG base64
 * USA EL MICROSERVICIO PYTHON - No requiere dependencias nativas locales
 */
async function convertPdfToImage(fileBuffer: Buffer): Promise<string | null> {
  const startTime = Date.now();
  console.log('🖼️ [PDF to Image] ========================================');
  console.log('🖼️ [PDF to Image] Iniciando conversión via MICROSERVICIO...');
  console.log(`🖼️ [PDF to Image] Buffer size: ${fileBuffer.length} bytes`);
  console.log(`🖼️ [PDF to Image] Microservice URL: ${INVOICE2DATA_URL}`);

  try {
    // Verificar que el microservicio esté disponible
    const serviceAvailable = await isInvoice2DataAvailable();
    
    if (!serviceAvailable) {
      console.error('❌ [PDF to Image] Microservicio invoice2data NO disponible');
      console.error('❌ [PDF to Image] URL intentada:', INVOICE2DATA_URL);
      console.error('❌ [PDF to Image] Asegúrate de que INVOICE2DATA_URL esté configurada correctamente');
      return null;
    }

    console.log('✅ [PDF to Image] Microservicio disponible, enviando PDF...');

    // Crear FormData para enviar el archivo
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileContent = fileBuffer.toString('binary');

    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="document.pdf"`,
      'Content-Type: application/pdf',
      '',
      fileContent,
      `--${boundary}`,
      `Content-Disposition: form-data; name="dpi"`,
      '',
      '200',
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const response = await fetch(`${INVOICE2DATA_URL}/pdf-to-image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.from(body, 'binary'),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [PDF to Image] Error HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.image_base64) {
      console.error('❌ [PDF to Image] Microservicio retornó error:', result.error || 'sin imagen');
      return null;
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [PDF to Image] ========================================`);
    console.log(`✅ [PDF to Image] Imagen recibida del microservicio`);
    console.log(`✅ [PDF to Image] Dimensiones: ${result.width}x${result.height}`);
    console.log(`✅ [PDF to Image] Tamaño: ${Math.round(result.image_base64.length / 1024)} KB (base64)`);
    console.log(`✅ [PDF to Image] Tiempo total: ${elapsed}ms`);
    console.log(`✅ [PDF to Image] ========================================`);

    return result.image_base64;

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error('❌ [PDF to Image] ========================================');
    console.error('❌ [PDF to Image] Error convirtiendo PDF a imagen');
    console.error(`❌ [PDF to Image] Error: ${error.message}`);
    console.error(`❌ [PDF to Image] Tiempo: ${elapsed}ms`);
    console.error('❌ [PDF to Image] ========================================');
    return null;
  }
}

// -----------------------------
// Interfaces
// -----------------------------
export interface DocumentAnalysisResult {
  extractedAmount: number | null;
  extractedDate: Date | null;
  extractedBank: string | null;
  extractedReference: string | null;
  extractedCurrency: string | null;
  extractedOriginAccount: string | null;
  extractedDestinationAccount: string | null;
  extractedTrackingKey: string | null;
  extractedBeneficiaryName: string | null;
  ocrConfidence: number;
  rawResponse?: string;
  documentType?: "invoice" | "voucher" | "rep" | "unknown";
  extractedSupplierName?: string | null;
  extractedDueDate?: Date | null;
  extractedInvoiceNumber?: string | null;
  extractedTaxId?: string | null;
  relatedInvoiceUUID?: string | null;
  paymentMethod?: string | null;
  paymentTerms?: string | null;
  transferType?: string | null;
}

// -----------------------------
// Función principal
// -----------------------------
export async function analyzePaymentDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<DocumentAnalysisResult> {
  // 🔄 BUILD VERSION: 2026-01-04-v4 - USA MICROSERVICIO PARA PDF TO IMAGE
  const buildVersion = '2026-01-04-v4-microservice';
  const startTimeTotal = Date.now();

  console.log(`🚀 [Document Analyzer] ====================================================`);
  console.log(`🚀 [Document Analyzer] VERSIÓN: ${buildVersion}`);
  console.log(`🚀 [Document Analyzer] ====================================================`);
  console.log(`🔍 [Document Analyzer] Iniciando análisis híbrido...`);
  console.log(`📄 [Document Analyzer] Tipo de archivo: ${fileType}`);
  console.log(`📄 [Document Analyzer] Tamaño: ${fileBuffer.length} bytes (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`🔑 [Document Analyzer] OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ NO CONFIGURADA'}`);
  console.log(`🐍 [Document Analyzer] INVOICE2DATA_URL: ${process.env.INVOICE2DATA_URL || '⚠️ No configurada (usando default localhost:5050)'}`);
  console.log(`🌐 [Document Analyzer] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 [Document Analyzer] ====================================================`);

  // ========================================
  // PASO 1: Detectar si es XML (CFDI)
  // ========================================
  if (fileType.includes('xml') || fileType.includes('text/xml') || fileType === 'application/xml') {
    console.log(`📋 [CFDI] Detectado archivo XML, intentando parsear como CFDI...`);

    if (isCFDI(fileBuffer)) {
      const cfdiData = parseCFDI(fileBuffer);

      if (cfdiData.parseSuccess) {
        console.log(`✅ [CFDI] Factura CFDI parseada exitosamente - ${cfdiData.emisor.nombre}`);
        const invoiceData = cfdiToInvoiceData(cfdiData);

        return {
          extractedAmount: invoiceData.extractedAmount,
          extractedDate: invoiceData.extractedDate,
          extractedBank: null,
          extractedReference: invoiceData.extractedReference,
          extractedCurrency: invoiceData.extractedCurrency,
          extractedOriginAccount: null,
          extractedDestinationAccount: null,
          extractedTrackingKey: null,
          extractedBeneficiaryName: null,
          ocrConfidence: 1.0, // 100% - datos estructurados
          rawResponse: `CFDI XML parseado exitosamente. UUID: ${cfdiData.uuid}`,
          documentType: invoiceData.documentType,
          extractedSupplierName: invoiceData.extractedSupplierName,
          extractedDueDate: invoiceData.extractedDueDate,
          extractedInvoiceNumber: invoiceData.extractedInvoiceNumber,
          extractedTaxId: invoiceData.extractedTaxId,
          relatedInvoiceUUID: cfdiData.uuid,
          paymentMethod: invoiceData.paymentMethod,
          paymentTerms: invoiceData.paymentTerms,
          transferType: null,
        };
      } else {
        console.warn(`⚠️ [CFDI] Error parseando CFDI:`, cfdiData.parseErrors);
      }
    } else {
      console.log(`ℹ️ [CFDI] XML no es CFDI válido, continuando con análisis estándar`);
    }
  }

  // ========================================
  // PASO 1.5: Intentar microservicio invoice2data (Python)
  // ========================================
  if (fileType.includes('pdf')) {
    const invoice2dataUrl = process.env.INVOICE2DATA_URL || "http://localhost:5050";
    console.log(`🐍 [invoice2data] Verificando disponibilidad del microservicio en ${invoice2dataUrl}...`);

    const serviceAvailable = await isInvoice2DataAvailable();

    if (serviceAvailable) {
      console.log(`✅ [invoice2data] Microservicio disponible, procesando PDF...`);

      const i2dResult = await callInvoice2DataService(fileBuffer, 'invoice.pdf');

      if (i2dResult.success && i2dResult.data) {
        const data = i2dResult.data;
        console.log(`✅ [invoice2data] Extracción exitosa con método: ${data.method}`);

        // Parsear fecha
        let invoiceDate: Date | null = null;
        let dueDate: Date | null = null;

        if (data.date) {
          invoiceDate = new Date(data.date);
          if (isNaN(invoiceDate.getTime())) invoiceDate = null;
        }

        if (data.due_date) {
          dueDate = new Date(data.due_date);
          if (isNaN(dueDate.getTime())) dueDate = null;
        }

        // Si no hay fecha de vencimiento, calcular +30 días
        if (!dueDate && invoiceDate) {
          dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + 30);
        }

        return {
          extractedAmount: data.amount || null,
          extractedDate: invoiceDate,
          extractedBank: null,
          extractedReference: null,
          extractedCurrency: data.currency || 'MXN',
          extractedOriginAccount: null,
          extractedDestinationAccount: null,
          extractedTrackingKey: null,
          extractedBeneficiaryName: null,
          ocrConfidence: data.confidence || 0.95,
          rawResponse: `invoice2data: ${data.method}`,
          documentType: 'invoice',
          extractedSupplierName: data.supplier_name || null,
          extractedDueDate: dueDate,
          extractedInvoiceNumber: data.invoice_number || null,
          extractedTaxId: data.tax_id || null,
          relatedInvoiceUUID: null,
          paymentMethod: null,
          paymentTerms: null,
          transferType: null,
        };
      } else {
        console.log(`⚠️ [invoice2data] No se pudo extraer: ${i2dResult.error || 'sin template match'}`);
      }
    } else {
      console.log(`ℹ️ [invoice2data] Microservicio no disponible, usando fallback...`);
    }
  }

  // ========================================
  // PASO 2: Para PDF, extraer texto primero
  // ========================================
  let extractedText = "";

  if (fileType.includes('pdf')) {
    console.log(`📄 [PDF] Extrayendo texto del PDF...`);

    // Método 1: pdf-parse
    try {
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(fileBuffer);
      extractedText = pdfData.text.trim();
      console.log(`📄 [pdf-parse] Texto extraído: ${extractedText.length} caracteres`);
    } catch (error) {
      console.warn(`⚠️ [pdf-parse] Error:`, error);
    }

    // Método 2: pdfjs-dist como fallback si pdf-parse falló
    if (extractedText.length < 100) {
      const pdfjs = await loadPdfjs();
      if (pdfjs?.getDocument) {
        try {
          const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fileBuffer) });
          const pdf = await loadingTask.promise;
          let pdfjsText = "";

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            pdfjsText += content.items.map((item: any) => item.str).join(' ') + '\n';
          }

          if (pdfjsText.length > extractedText.length) {
            extractedText = pdfjsText.trim();
            console.log(`📄 [pdfjs-dist] Texto extraído: ${extractedText.length} caracteres`);
          }
        } catch (error) {
          console.warn(`⚠️ [pdfjs-dist] Error:`, error);
        }
      }
    }

    // ========================================
    // PASO 2.5: Intentar templates primero (MÁS CONFIABLE)
    // ========================================
    if (extractedText.length > 50) {
      console.log(`📋 [Templates] Buscando template para el documento...`);

      const matchedTemplate = findMatchingTemplate(extractedText);
      const templateToUse = matchedTemplate || fallbackTemplate;

      console.log(`📋 [Templates] Usando template: ${templateToUse.name}`);
      const templateResult = extractWithTemplate(extractedText, templateToUse);

      // Si el template extrajo datos significativos (al menos monto y algo más)
      const hasGoodData = templateResult.amount &&
                          (templateResult.supplierName || templateResult.invoiceNumber || templateResult.taxId);

      if (hasGoodData) {
        console.log(`✅ [Templates] Extracción exitosa con template "${templateToUse.name}"`);

        // Determinar tipo de documento
        let documentType: "invoice" | "voucher" | "rep" | "unknown" = "invoice";
        const lowerText = extractedText.toLowerCase();
        if (lowerText.includes('spei') || lowerText.includes('transferencia') || lowerText.includes('comprobante de pago')) {
          documentType = "voucher";
        } else if (lowerText.includes('complemento de pago') || lowerText.includes('cfdi de pago')) {
          documentType = "rep";
        }

        return {
          extractedAmount: templateResult.amount,
          extractedDate: templateResult.date,
          extractedBank: null,
          extractedReference: templateResult.reference,
          extractedCurrency: templateResult.currency,
          extractedOriginAccount: null,
          extractedDestinationAccount: null,
          extractedTrackingKey: null,
          extractedBeneficiaryName: null,
          ocrConfidence: matchedTemplate ? 0.9 : 0.7, // 90% con template específico, 70% con fallback
          rawResponse: `Extraído con template "${templateToUse.name}"`,
          documentType,
          extractedSupplierName: templateResult.supplierName,
          extractedDueDate: templateResult.dueDate,
          extractedInvoiceNumber: templateResult.invoiceNumber,
          extractedTaxId: templateResult.taxId,
          relatedInvoiceUUID: null,
          paymentMethod: null,
          paymentTerms: null,
          transferType: null,
        };
      } else {
        console.log(`⚠️ [Templates] Template no extrajo suficientes datos, usando OpenAI como fallback`);
      }
    }
  }

  // ========================================
  // PASO 3: Fallback a OpenAI Vision
  // ========================================
  console.log(`🤖 [OpenAI] Usando OpenAI Vision como fallback...`);

  const apiKey = process.env.OPENAI_API_KEY;

  // Si no hay API key, devolver resultado vacío para verificación manual
  if (!apiKey) {
    console.warn("⚠️ [Document Analyzer] ==================================================");
    console.warn("⚠️ [Document Analyzer] OPENAI_API_KEY NO ESTÁ CONFIGURADA");
    console.warn("⚠️ [Document Analyzer] ==================================================");
    console.warn("⚠️ [Document Analyzer] El microservicio invoice2data tampoco extrajo datos.");
    console.warn("⚠️ [Document Analyzer] Los templates TypeScript tampoco extrajeron datos.");
    console.warn("⚠️ [Document Analyzer] SOLUCIÓN: Configurar OPENAI_API_KEY en las variables de entorno.");
    console.warn("⚠️ [Document Analyzer] El usuario deberá completar todos los campos manualmente.");

    return {
      extractedAmount: null,
      extractedDate: null,
      extractedBank: null,
      extractedReference: null,
      extractedCurrency: 'MXN',
      extractedOriginAccount: null,
      extractedDestinationAccount: null,
      extractedTrackingKey: null,
      extractedBeneficiaryName: null,
      ocrConfidence: 0,
      rawResponse: 'OPENAI_API_KEY no configurada y invoice2data no disponible. Configure la API key de OpenAI o despliegue el microservicio Python.',
      documentType: 'invoice', // Asumir factura si viene de flujo de facturas
      extractedSupplierName: null,
      extractedDueDate: null,
      extractedInvoiceNumber: null,
      extractedTaxId: null,
      relatedInvoiceUUID: null,
      paymentMethod: null,
      paymentTerms: null,
      transferType: null,
    };
  }

  const openai = new OpenAI({ apiKey });

  console.log(`🔍 [OpenAI Fallback] Analizando documento tipo: ${fileType}`);

  try {
    // Reutilizar texto ya extraído en pasos anteriores
    let textContent = extractedText;
    let base64Data = "";

    // --- 1️⃣ Si no tenemos texto, intentar extraer (para imágenes o PDFs no procesados) ---
    if (!textContent && fileType.includes("pdf")) {
      console.log(`📄 [OpenAI] Extrayendo texto de PDF (no se extrajo previamente)...`);

      // Método 1: pdf-parse
      try {
        const pdfParse = await import('pdf-parse');
        const pdfData = await pdfParse.default(fileBuffer);
        textContent = pdfData.text.trim();
        if (textContent && textContent.length > 50) {
          console.log(`📄 [pdf-parse] Texto extraído: ${textContent.length} caracteres`);
        }
      } catch (error) {
        console.warn('⚠️ [pdf-parse] Error:', error);
      }

      // Método 2: pdfjs-dist como fallback
      if (!textContent || textContent.length < 100) {
        const pdfjs = await loadPdfjs();
        if (pdfjs && pdfjs.getDocument) {
          try {
            const loadingTask = pdfjs.getDocument({data: new Uint8Array(fileBuffer)});
            const pdf = await loadingTask.promise;
            let pdfjsText = "";

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const content = await page.getTextContent();
              const pageText = content.items
                .map((item: any) => {
                  if (item.str) {
                    return item.str;
                  }
                  return '';
                })
                .join(' ');
              pdfjsText += pageText + '\n\n'; // Doble salto de línea entre páginas
            }

            pdfjsText = pdfjsText.trim();
            if (pdfjsText && pdfjsText.length > (textContent?.length || 0)) {
              textContent = pdfjsText;
              console.log(`📄 [pdfjs-dist] Texto extraído: ${textContent.length} caracteres`);
            }
          } catch (error) {
            console.warn('⚠️ [pdfjs-dist] Error:', error);
          }
        }
      }
    }

    // Para imágenes o PDFs sin texto, usar base64 para visión
    if (!textContent || textContent.length < 50) {
      console.warn('⚠️ [OpenAI] Texto insuficiente, usando análisis visual');
      base64Data = fileBuffer.toString("base64");
    } else {
      console.log(`✅ [OpenAI] Texto disponible: ${textContent.length} caracteres`);
    }

    // Para imágenes, siempre usar base64
    if (!fileType.includes("pdf")) {
      base64Data = fileBuffer.toString("base64");
    }

    const imageType = fileType.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = base64Data ? `data:${imageType};base64,${base64Data}` : "";

    // --- 2️⃣ PROMPT MEJORADO Y MÁS ROBUSTO ---
    const documentTypePrompt = `
You are an expert in Mexican financial and fiscal documents. Analyze ANY format of invoice, receipt, or payment document and extract ALL available information.

### YOUR TASK
Extract ALL visible data from the document, even if it's in different formats, layouts, or languages. Be VERY thorough and extract every piece of information you can see. This includes:
- For INVOICES: supplier, amount, dates (issue and due), RFC, invoice number, payment terms, payment method, bank details if mentioned
- For VOUCHERS: bank, reference, amount, date, origin/destination accounts, SPEI tracking key, beneficiary, payment method, transfer type
- For REPS: related UUID, original invoice number, payment complement details, payment method

### SCHEMA
{
  "documentType": "invoice" | "voucher" | "rep" | "unknown",
  "amount": number | null,
  "currency": "MXN" | "USD" | null,
  "date": "YYYY-MM-DD" | null,
  "bank": string | null,
  "reference": string | null,
  "originAccount": string | null,
  "destinationAccount": string | null,
  "trackingKey": string | null,
  "beneficiaryName": string | null,
  "supplierName": string | null,
  "dueDate": "YYYY-MM-DD" | null,
  "invoiceNumber": string | null,
  "taxId": string | null,
  "relatedInvoiceUUID": string | null,
  "paymentMethod": string | null,
  "paymentTerms": string | null,
  "transferType": string | null
}

### CLASSIFICATION RULES (BE FLEXIBLE)
- "invoice": ANY document that looks like a bill, invoice, or request for payment. Look for:
  * Words like: Factura, Invoice, Bill, Recibo, Nota, Comprobante Fiscal, CFDI
  * Tax IDs (RFC), Invoice numbers, Supplier/Provider names
  * Amounts, dates, payment terms
  * ANY document requesting payment
  
- "voucher": Bank transfer receipts, payment confirmations, SPEI transfers
- "rep": Payment complements, CFDI de Pago, payment receipts for invoices
- "unknown": Only if you truly cannot determine the type

### EXTRACTION RULES (BE VERY THOROUGH)

1. **SUPPLIER NAME (supplierName)**: CRITICAL - Extract ONLY the company/person name that is SELLING/EMITTING the invoice (the SUPPLIER/VENDOR). 
   
   **IMPORTANT**: In Mexican invoices (CFDI), there are TWO company names:
   - **EMISOR (Emitter/Seller)**: The company SELLING/ISSUING the invoice - THIS IS THE SUPPLIER WE NEED
   - **RECEPTOR (Receiver/Buyer)**: The company BUYING/RECEIVING the invoice (e.g., "Grupo Orsega", "Dura International") - DO NOT USE THIS
   
   Look for:
   - "Emisor", "Emitter", "Proveedor", "Supplier", "Vendedor", "From", "De", "Razón Social Emisor"
   - In CFDI format: Look for "Emisor" section, NOT "Receptor" section
   - DO NOT extract names like "Grupo Orsega", "Dura International", "ORSEGA", "DURA" - these are the buyers, not suppliers

2. **AMOUNT (amount)**: Extract ANY monetary value. Look for:
   - "Total", "Monto", "Amount", "Importe", "Suma", "$", "MXN", "USD"
   - The LARGEST number is usually the total
   - Remove currency symbols and commas, keep only the number

3. **DUE DATE (dueDate)**: Extract payment deadline. Look for:
   - "Fecha de Vencimiento", "Due Date", "Vence", "Fecha Límite", "Payment Due"
   - If you see an invoice date and payment terms (e.g., "Net 30"), calculate the due date

4. **INVOICE NUMBER (invoiceNumber)**: Extract any invoice/receipt number. Look for:
   - "Folio", "Número", "Number", "No.", "#", "Invoice #", "Factura"

5. **TAX ID (taxId)**: Extract RFC or tax identifier. Look for:
   - "RFC", "Tax ID", followed by alphanumeric code (12-13 characters)

6. **DATE (date)**: Invoice/transaction date. Look for:
   - "Fecha", "Date", "Fecha de Emisión", "Issued Date"

7. **CURRENCY (currency)**: Default to "MXN" if you see peso signs ($) or Mexican context

### IMPORTANT INSTRUCTIONS
- Extract data even if the format is unusual or non-standard
- For amounts, always use the TOTAL amount, not subtotals
- If a field is truly not visible, return null
- BE GENEROUS with extraction - if you're 70% sure, extract it
- Output MUST be pure JSON — no text before or after it

Now analyze the following document carefully and extract ALL available information. Respond ONLY with valid JSON, no explanations.
`;

    // --- 3️⃣ LLAMADA A OPENAI ---
    let response;
    if (fileType.includes("pdf")) {
      // Si tenemos texto extraído, usarlo para análisis
      if (textContent && textContent.length > 50) {
        const fullText = textContent.length > 30000 
          ? textContent.slice(0, 30000) + "\n\n[Texto truncado...]" 
          : textContent;
        
        console.log(`📤 [OpenAI] Enviando ${fullText.length} caracteres de texto para análisis`);
        
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: `${documentTypePrompt}\n\n=== CONTENIDO DEL DOCUMENTO ===\n${fullText}\n\n=== FIN DEL CONTENIDO ===\n\nAnaliza el contenido anterior y extrae TODOS los datos disponibles.`,
            },
          ],
          temperature: 0.1,
          max_tokens: 1200,
        });
      } else if (textContent && textContent.length > 0) {
        console.warn(`⚠️ [PDF] Texto extraído limitado (${textContent.length} caracteres). El PDF podría ser una imagen escaneada.`);
        
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: `${documentTypePrompt}\n\n=== CONTENIDO DEL DOCUMENTO (TEXTO LIMITADO) ===\n${textContent}\n\n=== FIN DEL CONTENIDO ===\n\nAnaliza el contenido anterior. Si el texto es limitado, extrae TODO lo que puedas identificar.`,
            },
          ],
          temperature: 0.1,
          max_tokens: 1200,
        });
      } else {
        // ========================================
        // PDF SIN TEXTO - USAR MICROSERVICIO PARA IMAGEN
        // ========================================
        console.warn('⚠️ [PDF] PDF sin texto extraíble detectado. Esto podría ser una imagen escaneada.');
        console.log('🖼️ [PDF to Image] Convirtiendo PDF a imagen via MICROSERVICIO...');

        // Convertir PDF a imagen usando el MICROSERVICIO
        const pngBase64 = await convertPdfToImage(fileBuffer);

        if (pngBase64) {
          console.log('📸 [OpenAI Vision] Enviando imagen PNG a OpenAI Vision...');
          const pngDataUrl = `data:image/png;base64,${pngBase64}`;

          try {
            response = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: documentTypePrompt },
                    { type: "image_url", image_url: { url: pngDataUrl, detail: "high" } },
                  ],
                },
              ],
              temperature: 0.1,
              max_tokens: 1200,
            });
            console.log('✅ [OpenAI Vision] Análisis visual completado');
          } catch (visionError: any) {
            console.error('❌ [OpenAI Vision] Error en análisis visual:', visionError.message);
            response = null as any;
          }
        } else {
          console.error('❌ [PDF to Image] No se pudo convertir el PDF a imagen');
          console.error('❌ [PDF to Image] Verifica que INVOICE2DATA_URL esté configurada correctamente');
          console.log('📝 [Fallback] El usuario deberá completar los datos manualmente');
          response = null as any;
        }
      }
    } else {
      // Para imágenes (PNG, JPG), usar análisis de visión
      console.log(`📤 [OpenAI Vision] Analizando imagen: ${fileType}`);
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: documentTypePrompt },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      });
    }

    // --- 4️⃣ PARSING ROBUSTO MEJORADO ---
    let parsedData: any;
    let rawResponse = "";
    
    if (!response) {
      console.log(`⚠️ [Parsing] No hay respuesta de OpenAI, usando solo análisis manual`);
      parsedData = {};
      rawResponse = "";
    } else {
      rawResponse = response.choices[0]?.message?.content?.trim() || "";
      console.log(`🧠 [OpenAI Response] Respuesta recibida (${rawResponse.length} caracteres)`);
      console.log(`🧠 [OpenAI Response] Fragmento: ${rawResponse.slice(0, 600)}...`);
      
      try {
        let jsonStr = rawResponse;
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        
        parsedData = JSON.parse(jsonStr);
        console.log(`✅ [Parsing] JSON parseado exitosamente desde OpenAI`);
      } catch (error) {
        console.warn("⚠️ [Parsing] Error parseando JSON de OpenAI, intentando detección manual...");
        console.warn(`⚠️ [Parsing] Error: ${error}`);
        if (rawResponse) {
          console.warn(`⚠️ [Parsing] Respuesta recibida: ${rawResponse.substring(0, 500)}`);
        }
        parsedData = {};
      }
    }
    
    // --- 4.5️⃣ ANÁLISIS MANUAL MEJORADO (fallback o complemento) ---
    if (textContent && textContent.length > 0) {
      const txt = textContent.toLowerCase();
      const originalText = textContent;
      
      // Detección de tipo de documento
      if (!parsedData.documentType || parsedData.documentType === 'unknown') {
        const isInvoice = /factura|invoice|cfdi|rfc|folio fiscal|proveedor|supplier|bill|recibo fiscal|nota de venta/.test(txt);
        const isVoucher = /spei|clabe|banco|transferencia|voucher|comprobante de pago|transferencia bancaria/.test(txt);
        const isRep = /complemento de pago|cfdi de pago|uuid relacionado|folio relacionado|payment complement/.test(txt);
        
        if (isInvoice) parsedData.documentType = 'invoice';
        else if (isRep) parsedData.documentType = 'rep';
        else if (isVoucher) parsedData.documentType = 'voucher';
        else parsedData.documentType = parsedData.documentType || 'unknown';
      }
      
      // Extracción manual de monto
      if (!parsedData.amount || parsedData.amount === null) {
        const amountPatterns = [
          /(?:total|monto|amount|importe|suma|pagar|due|a pagar)[\s:]*\$?\s*([\d,]+\.?\d*)/i,
          /\$\s*([\d,]+\.?\d*)\s*(?:mxn|usd|pesos)/i,
          /([\d,]+\.?\d*)\s*(?:mxn|usd|pesos)/i,
          /(?:total|monto)[\s\n]+([\d,]+\.?\d*)/i,
        ];
        
        for (const pattern of amountPatterns) {
          const matches = Array.from(originalText.matchAll(new RegExp(pattern, 'gi')));
          const amounts: number[] = [];
          
          for (const match of matches) {
            if (match[1]) {
              const candidate = parseFloat(match[1].replace(/,/g, ''));
              if (candidate && candidate > 0) {
                amounts.push(candidate);
              }
            }
          }
          
          if (amounts.length > 0) {
            parsedData.amount = Math.max(...amounts);
            console.log(`✅ [Manual Extraction] Monto extraído manualmente: ${parsedData.amount}`);
            break;
          }
        }
      }
      
      // Extracción manual de proveedor - SOLO EMISOR, NO RECEPTOR
      const knownBuyerCompanies = [
        'grupo orsega', 'orsega', 'grupo orsega s.a. de c.v.', 'grupo orsega s.a.',
        'dura international', 'dura', 'dura international s.a. de c.v.', 'dura s.a.',
        'durainternational', 'orsega s.a.', 'ors', 'dura chemicals', 'grupo orsega s de rl de cv'
      ];
      
      const isKnownBuyer = (name: string): boolean => {
        if (!name) return false;
        const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
        return knownBuyerCompanies.some(buyer => 
          normalized.includes(buyer) || 
          buyer.includes(normalized) ||
          normalized === buyer
        );
      };
      
      if (!parsedData.supplierName || parsedData.supplierName === null) {
        const emisorPatterns = [
          /(?:datos\s+del\s+)?emisor[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?|S\.?C\.?|C\.?V\.?|INC\.?|LLC\.?)?)/i,
          /rfc\s+emisor[\s:]+[A-Z0-9]{10,15}[\s\n]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?)?)/i,
          /emisor[^r]{0,200}?([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?)?)[\s\n]+(?:receptor|rfc receptor)/i,
        ];
        
        let foundSupplier = false;
        for (const pattern of emisorPatterns) {
          const match = originalText.match(pattern);
          if (match && match[1]) {
            const candidate = match[1].trim().substring(0, 100);
            if (candidate.length >= 5 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(candidate) && !isKnownBuyer(candidate)) {
              parsedData.supplierName = candidate;
              console.log(`✅ [Manual Extraction] Proveedor extraído de sección Emisor: ${parsedData.supplierName}`);
              foundSupplier = true;
              break;
            }
          }
        }
        
        if (!foundSupplier) {
          const supplierPatterns = [
            /(?:proveedor|supplier|vendedor)(?![\s:]*receptor)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?|S\.?C\.?|C\.?V\.?|INC\.?|LLC\.?)?)/i,
            /rfc(?!\s+receptor)[\s:]+[A-Z0-9]{10,15}[\s\n]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?)?)(?![\s\n]+(?:receptor|dura|orsega|grupo orsega))/i,
          ];
          
          for (const pattern of supplierPatterns) {
            const match = originalText.match(pattern);
            if (match && match[1]) {
              const candidate = match[1].trim().substring(0, 100);
              if (candidate.length >= 5 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(candidate) && !isKnownBuyer(candidate)) {
                parsedData.supplierName = candidate;
                console.log(`✅ [Manual Extraction] Proveedor extraído manualmente: ${parsedData.supplierName}`);
                foundSupplier = true;
                break;
              }
            }
          }
        }
      } else {
        if (isKnownBuyer(parsedData.supplierName)) {
          console.warn(`⚠️ [Supplier Filter] Nombre extraído "${parsedData.supplierName}" es una empresa receptora conocida, descartándolo...`);
          parsedData.supplierName = null;
          
          const emisorMatch = originalText.match(/(?:datos\s+del\s+)?emisor[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?)?)/i);
          if (emisorMatch && emisorMatch[1] && !isKnownBuyer(emisorMatch[1])) {
            parsedData.supplierName = emisorMatch[1].trim().substring(0, 100);
            console.log(`✅ [Supplier Filter] Proveedor corregido (emisor real): ${parsedData.supplierName}`);
          }
        }
      }
      
      // Extracción manual de fecha
      if (!parsedData.date || parsedData.date === null) {
        const datePatterns = [
          /(?:fecha|date|fecha de emisión|issued date)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
          /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
        ];
        
        for (const pattern of datePatterns) {
          const match = originalText.match(pattern);
          if (match && match[1]) {
            try {
              const date = parseDate(match[1]);
              if (date) {
                parsedData.date = date.toISOString().split('T')[0];
                console.log(`✅ [Manual Extraction] Fecha extraída manualmente: ${parsedData.date}`);
                break;
              }
            } catch (e) {
              // Continuar con el siguiente patrón
            }
          }
        }
      }
      
      // Extracción manual de número de factura
      if (!parsedData.invoiceNumber || parsedData.invoiceNumber === null) {
        const invoiceNumberPatterns = [
          /(?:folio|número|number|no\.|#|invoice #|factura)[\s:]+([A-Z0-9\-]{3,20})/i,
          /(?:FEA|INV|FAC)[\s:]*([0-9]{6,12})/i,
        ];
        
        for (const pattern of invoiceNumberPatterns) {
          const match = originalText.match(pattern);
          if (match && match[1]) {
            parsedData.invoiceNumber = match[1].trim();
            console.log(`✅ [Manual Extraction] Número de factura extraído: ${parsedData.invoiceNumber}`);
            break;
          }
        }
      }
      
      // Establecer moneda por defecto si no está
      if (!parsedData.currency) {
        parsedData.currency = txt.includes('usd') || txt.includes('dollar') ? "USD" : "MXN";
      }
    }

    const docType = parsedData.documentType || "unknown";
    console.log(`📋 Tipo detectado: ${docType}`);

    // --- 5️⃣ PROCESAMIENTO Y MEJORA DE DATOS ---
    let dueDate = parsedData.dueDate ? parseDate(parsedData.dueDate) : null;
    const invoiceDate = parsedData.date ? parseDate(parsedData.date) : null;
    
    if (!dueDate && invoiceDate && (docType === "invoice" || docType === "unknown")) {
      dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);
      console.log(`📅 [Date Calculation] Fecha de vencimiento calculada: ${dueDate.toISOString().split('T')[0]} (fecha factura + 30 días)`);
    }

    // Filtrar empresas receptoras conocidas
    const knownBuyerCompaniesFilter = [
      'grupo orsega', 'orsega', 'grupo orsega s.a. de c.v.', 'grupo orsega s.a.',
      'dura international', 'dura', 'dura international s.a. de c.v.', 'dura s.a.',
      'durainternational', 'orsega s.a.', 'ors', 'dura chemicals', 'grupo orsega s de rl de cv'
    ];
    
    const isKnownBuyerFilter = (name: string): boolean => {
      if (!name) return false;
      const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
      return knownBuyerCompaniesFilter.some(buyer => 
        normalized.includes(buyer) || 
        buyer.includes(normalized) ||
        normalized === buyer
      );
    };
    
    let supplierName = parsedData.supplierName || null;
    
    if (supplierName && isKnownBuyerFilter(supplierName)) {
      console.warn(`⚠️ [Supplier Filter] "${supplierName}" es una empresa receptora conocida, descartándolo...`);
      supplierName = null;
    }
    
    if (supplierName) {
      supplierName = supplierName.trim().replace(/\s+/g, ' ');
      if (supplierName.length > 100) {
        supplierName = supplierName.split(/\s+/).slice(0, 8).join(' ');
      }
      supplierName = supplierName.replace(/[,;:\.]+$/, '').trim();
      
      if (isKnownBuyerFilter(supplierName)) {
        console.warn(`⚠️ [Supplier Filter] Después de limpiar, "${supplierName}" sigue siendo una empresa receptora, descartándolo...`);
        supplierName = null;
      }
    } else if (docType === "invoice" || docType === "unknown") {
      console.warn(`⚠️ [Supplier] No se pudo extraer el nombre del proveedor (emisor) del documento`);
      console.warn(`⚠️ [Supplier] Asegúrate de que el documento tenga una sección "Emisor" con el nombre del proveedor`);
    }

    let amount = parsedData.amount ? parseFloat(String(parsedData.amount).replace(/[^0-9.-]/g, '')) : null;
    
    if (amount && (isNaN(amount) || amount <= 0)) {
      amount = null;
    }

    // --- 6️⃣ RESULTADO FINAL ---
    const result: DocumentAnalysisResult = {
      extractedAmount: amount,
      extractedDate: invoiceDate,
      extractedBank: parsedData.bank || null,
      extractedReference: parsedData.reference || null,
      extractedCurrency: parsedData.currency || "MXN",
      extractedOriginAccount: parsedData.originAccount || null,
      extractedDestinationAccount: parsedData.destinationAccount || null,
      extractedTrackingKey: parsedData.trackingKey || null,
      extractedBeneficiaryName: parsedData.beneficiaryName || null,
      ocrConfidence:
        docType === "invoice"
          ? calculateInvoiceConfidence(parsedData)
          : calculateConfidence(parsedData),
      rawResponse,
      documentType: docType,
      extractedSupplierName: supplierName,
      extractedDueDate: dueDate,
      extractedInvoiceNumber: parsedData.invoiceNumber || null,
      extractedTaxId: parsedData.taxId || null,
      relatedInvoiceUUID: parsedData.relatedInvoiceUUID || null,
      paymentMethod: parsedData.paymentMethod || null,
      paymentTerms: parsedData.paymentTerms || null,
      transferType: parsedData.transferType || null,
    };

    // Log detallado de extracción
    console.log(`📊 [Extraction Summary]`, {
      documentType: docType,
      supplierName: supplierName || "NO ENCONTRADO",
      amount: amount || "NO ENCONTRADO",
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : "NO ENCONTRADO",
      invoiceDate: invoiceDate ? invoiceDate.toISOString().split('T')[0] : "NO ENCONTRADO",
      invoiceNumber: parsedData.invoiceNumber || "NO ENCONTRADO",
      taxId: parsedData.taxId || "NO ENCONTRADO",
      confidence: (result.ocrConfidence * 100).toFixed(1) + "%"
    });

    const elapsedTotal = Date.now() - startTimeTotal;
    console.log(`🚀 [Document Analyzer] ====================================================`);
    console.log(`✅ [Document Analyzer] Análisis completado`);
    console.log(`📊 [Document Analyzer] Tipo: ${docType}`);
    console.log(`💰 [Document Analyzer] Monto: ${result.extractedAmount || 'NO ENCONTRADO'}`);
    console.log(`🏢 [Document Analyzer] Proveedor: ${supplierName || 'NO ENCONTRADO'}`);
    console.log(`📅 [Document Analyzer] Fecha vencimiento: ${dueDate ? dueDate.toISOString().split('T')[0] : 'NO ENCONTRADO'}`);
    console.log(`📈 [Document Analyzer] Confianza: ${(result.ocrConfidence * 100).toFixed(1)}%`);
    console.log(`⏱️ [Document Analyzer] Tiempo total: ${elapsedTotal}ms (${(elapsedTotal / 1000).toFixed(2)}s)`);
    console.log(`🚀 [Document Analyzer] ====================================================`);

    return result;
  } catch (error) {
    console.error("❌ Error durante el análisis:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isOpenAIError = errorMessage.includes('API key') ||
                          errorMessage.includes('401') ||
                          errorMessage.includes('OpenAI') ||
                          errorMessage.includes('OPENAI');

    if (isOpenAIError) {
      console.warn('⚠️ [Document Analyzer] OpenAI no disponible. Continuando sin análisis automático.');
      console.warn('⚠️ [Document Analyzer] El usuario deberá verificar los datos manualmente.');
    }

    return {
      extractedAmount: null,
      extractedDate: null,
      extractedBank: null,
      extractedReference: null,
      extractedCurrency: 'MXN',
      extractedOriginAccount: null,
      extractedDestinationAccount: null,
      extractedTrackingKey: null,
      extractedBeneficiaryName: null,
      ocrConfidence: 0,
      rawResponse: `Error en análisis: ${errorMessage}`,
      documentType: 'unknown' as const,
      extractedSupplierName: null,
      extractedDueDate: null,
      extractedInvoiceNumber: null,
      extractedTaxId: null,
      relatedInvoiceUUID: null,
      paymentMethod: null,
      paymentTerms: null,
      transferType: null,
    };
  }
}

// -----------------------------
// Funciones auxiliares
// -----------------------------

/**
 * Parsea fechas en múltiples formatos
 */
function parseDate(dateStr: string | Date): Date | null {
  if (dateStr instanceof Date) {
    return dateStr;
  }
  
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const formats = [
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})-(\d{2})-(\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let day: number, month: number, year: number;
      
      if (format.source.includes('YYYY-MM-DD')) {
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
      }

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  console.warn(`⚠️ No se pudo parsear la fecha: ${dateStr}`);
  return null;
}

function calculateInvoiceConfidence(data: any): number {
  const critical = ["supplierName", "amount"];
  const important = ["invoiceNumber", "taxId", "date"];
  const optional = ["currency", "dueDate"];
  
  const cScore = critical.filter(f => !!data[f]).length / critical.length;
  const iScore = important.filter(f => !!data[f]).length / important.length;
  const oScore = optional.filter(f => !!data[f]).length / optional.length;
  
  return +(0.6 * cScore + 0.3 * iScore + 0.1 * oScore).toFixed(2);
}

function calculateConfidence(data: any): number {
  const critical = ["amount", "date", "bank", "reference", "currency"];
  const secondary = [
    "originAccount",
    "destinationAccount",
    "trackingKey",
    "beneficiaryName",
    "relatedInvoiceUUID",
  ];
  const cScore = critical.filter(f => !!data[f]).length / critical.length;
  const sScore = secondary.filter(f => !!data[f]).length / secondary.length;
  return +(0.8 * cScore + 0.2 * sScore).toFixed(2);
}