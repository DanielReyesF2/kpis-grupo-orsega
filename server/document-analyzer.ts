// ================================================
// 📄 document-analyzer.ts
// Analizador de documentos bancarios, facturas y REPs con OpenAI Vision
// ================================================

import OpenAI from "openai";

// Importación dinámica de pdfjs-dist para evitar errores si no está instalado
let pdfjsLib: any = null;
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.js');
    // CRITICAL FIX: getDocument está en pdfjsModule.default, NO en pdfjsModule directamente
    pdfjsLib = pdfjsModule.default || pdfjsModule;
    return pdfjsLib;
  } catch (error) {
    console.warn('⚠️ pdfjs-dist no está disponible. La extracción de texto de PDFs estará limitada.');
    return null;
  }
}

// -----------------------------
// Interfaces
// -----------------------------
export interface CxpRecord {
  supplierName: string;
  amount: number;
  currency: string;
  dueDate: Date;
  reference?: string | null;
  status?: string | null;
  notes?: string | null;
}

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
  documentType?: "invoice" | "voucher" | "rep" | "cxp" | "unknown";
  extractedSupplierName?: string | null;
  extractedDueDate?: Date | null;
  extractedInvoiceNumber?: string | null;
  extractedTaxId?: string | null;
  relatedInvoiceUUID?: string | null;
  paymentMethod?: string | null;
  cxpRecords?: CxpRecord[];
  notes?: string | null;
}

// -----------------------------
// Función principal
// -----------------------------
export async function analyzePaymentDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Si no hay API key, devolver resultado vacío para verificación manual
  if (!apiKey) {
    console.warn("⚠️ [Document Analyzer] OPENAI_API_KEY no está configurado.");
    console.warn("⚠️ [Document Analyzer] El documento se procesará sin análisis automático.");
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
      rawResponse: 'OpenAI API key no configurada. Verificación manual requerida.',
      documentType: 'unknown',
      extractedSupplierName: null,
      extractedDueDate: null,
      extractedInvoiceNumber: null,
      extractedTaxId: null,
      relatedInvoiceUUID: null,
      paymentMethod: null,
    };
  }

  const openai = new OpenAI({ apiKey });

  console.log(`🔍 Analizando documento tipo: ${fileType}`);

  try {
    let textContent = "";
    let base64Data = "";

    // --- 1️⃣ Extracción inicial según tipo ---
    if (fileType.includes("pdf")) {
      // ESTRATEGIA MEJORADA: Intentar múltiples métodos de extracción
      let extractionSuccess = false;
      
      // Método 1: pdf-parse (generalmente más confiable para texto)
      try {
        const pdfParse = await import('pdf-parse');
        const pdfData = await pdfParse.default(fileBuffer);
        textContent = pdfData.text.trim();
        if (textContent && textContent.length > 50) {
          console.log(`📄 [Método 1: pdf-parse] Texto extraído: ${textContent.length} caracteres, ${pdfData.numpages} páginas`);
          extractionSuccess = true;
        }
      } catch (error) {
        console.warn('⚠️ [Método 1] pdf-parse no disponible o falló:', error);
      }
      
      // Método 2: pdfjs-dist (mejor para PDFs con layout complejo)
      if (!extractionSuccess || textContent.length < 100) {
        const pdfjs = await loadPdfjs();
        if (pdfjs && pdfjs.getDocument) {
          try {
            const loadingTask = pdfjs.getDocument({data: new Uint8Array(fileBuffer)});
            const pdf = await loadingTask.promise;
            let pdfjsText = "";

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const content = await page.getTextContent();
              // Mejorar extracción: preservar estructura y espacios
              const pageText = content.items
                .map((item: any) => {
                  // Preservar espacios y saltos de línea
                  if (item.str) {
                    return item.str;
                  }
                  return '';
                })
                .join(' ');
              pdfjsText += pageText + '\n\n'; // Doble salto de línea entre páginas
            }

            pdfjsText = pdfjsText.trim();
            if (pdfjsText && pdfjsText.length > textContent.length) {
              textContent = pdfjsText;
              console.log(`📄 [Método 2: pdfjs-dist] Texto extraído: ${textContent.length} caracteres, ${pdf.numPages} páginas`);
              extractionSuccess = true;
            }
          } catch (error) {
            console.warn('⚠️ [Método 2] Error con pdfjs-dist:', error);
          }
        }
      }
      
      // Si aún no tenemos texto suficiente, preparar para análisis con visión
      if (!extractionSuccess || textContent.length < 50) {
        console.warn('⚠️ Extracción de texto limitada. Se usará análisis de imagen como fallback.');
        // Para PDFs, intentar convertir primera página a imagen para análisis visual
        base64Data = fileBuffer.toString("base64");
      } else {
        console.log(`✅ Texto extraído exitosamente: ${textContent.length} caracteres`);
        // Mostrar preview del texto extraído (primeros 500 caracteres)
        console.log(`📝 Preview: ${textContent.substring(0, 500)}...`);
      }
    } else {
      base64Data = fileBuffer.toString("base64");
    }

    const imageType = fileType.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = base64Data ? `data:${imageType};base64,${base64Data}` : "";

    // --- 2️⃣ PROMPT MEJORADO Y MÁS ROBUSTO ---
    const documentTypePrompt = `
You are an expert in Mexican financial and fiscal documents. Analyze ANY format of invoice, receipt, or payment document and extract ALL available information.

### YOUR TASK
Extract ALL visible data from the document, even if it's in different formats, layouts, or languages. Be VERY thorough and extract every piece of information you can see.

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
  "paymentMethod": string | null
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
   - The company name that appears in the "EMISOR" or "EMITTER" field
   - Company names in the SELLER/VENDOR section, NOT in the BUYER/CUSTOMER section
   - DO NOT extract names like "Grupo Orsega", "Dura International", "ORSEGA", "DURA" - these are the buyers, not suppliers
   - If you see "Receptor" or "Receiver" label, the name next to it is NOT the supplier
   - Extract the name from "Emisor" section, even if it appears after "Receptor"

2. **AMOUNT (amount)**: Extract ANY monetary value. Look for:
   - "Total", "Monto", "Amount", "Importe", "Suma", "$", "MXN", "USD"
   - The LARGEST number is usually the total
   - Remove currency symbols and commas, keep only the number
   - Look in headers, footers, summary sections, anywhere

3. **DUE DATE (dueDate)**: Extract payment deadline. Look for:
   - "Fecha de Vencimiento", "Due Date", "Vence", "Fecha Límite", "Payment Due"
   - "Términos de Pago", "Payment Terms" (may contain days like "30 días")
   - If you see an invoice date and payment terms (e.g., "Net 30"), calculate the due date
   - ANY date that seems related to payment deadline
   - If no explicit due date, use invoice date + 30 days as fallback

4. **INVOICE NUMBER (invoiceNumber)**: Extract any invoice/receipt number. Look for:
   - "Folio", "Número", "Number", "No.", "#", "Invoice #", "Factura"
   - Sequential numbers, alphanumeric codes

5. **TAX ID (taxId)**: Extract RFC or tax identifier. Look for:
   - "RFC", "Tax ID", "CIF", "NIT" followed by alphanumeric code
   - Usually 12-13 characters (e.g., "ABC123456789")

6. **DATE (date)**: Invoice/transaction date. Look for:
   - "Fecha", "Date", "Fecha de Emisión", "Issued Date"
   - Usually near the invoice number

7. **CURRENCY (currency)**: Default to "MXN" if you see peso signs ($) or Mexican context, "USD" for dollar signs

### IMPORTANT INSTRUCTIONS
- Extract data even if the format is unusual or non-standard
- If you see multiple values for the same field, use the most prominent or largest one
- For amounts, always use the TOTAL amount, not subtotals
- For dates, try to parse common formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
- If a field is truly not visible, return null
- BE GENEROUS with extraction - if you're 70% sure, extract it
- Output MUST be pure JSON — no text before or after it

### EXAMPLES

Example 1 - Simple Invoice:
"FACTURA No. 001234
Proveedor: Empresa ABC S.A. de C.V.
RFC: ABC123456789
Fecha: 15/11/2025
Total: $27,840.00 MXN
Términos: Net 30 días"
Output:
{
  "documentType": "invoice",
  "amount": 27840,
  "currency": "MXN",
  "date": "2025-11-15",
  "bank": null,
  "reference": null,
  "originAccount": null,
  "destinationAccount": null,
  "trackingKey": null,
  "beneficiaryName": null,
  "supplierName": "Empresa ABC S.A. de C.V.",
  "dueDate": "2025-12-15",
  "invoiceNumber": "001234",
  "taxId": "ABC123456789",
  "relatedInvoiceUUID": null,
  "paymentMethod": null
}

Example 2 - CFDI Invoice with Emisor and Receptor:
"CFDI Factura
Emisor: ECONOVA S.A. DE C.V.
RFC Emisor: ECO123456789
Receptor: GRUPO ORSEGA
RFC Receptor: GRO123456789
Folio: FEA0000000373
Fecha: 04/11/2025
Total: $50,000.00 MXN
Términos: Net 30 días"
Output:
{
  "documentType": "invoice",
  "amount": 50000,
  "currency": "MXN",
  "date": "2025-11-04",
  "bank": null,
  "reference": null,
  "originAccount": null,
  "destinationAccount": null,
  "trackingKey": null,
  "beneficiaryName": null,
  "supplierName": "ECONOVA S.A. DE C.V.",
  "dueDate": "2025-12-04",
  "invoiceNumber": "FEA0000000373",
  "taxId": "ECO123456789",
  "relatedInvoiceUUID": null,
  "paymentMethod": null
}
NOTE: "GRUPO ORSEGA" is the RECEPTOR (buyer), NOT the supplier. The supplier is "ECONOVA S.A. DE C.V." from the EMISOR section.

Example 3 - Bank Transfer:
"Transferencia SPEI 12/05/2025 Banco Santander CLABE 012345678901234567 Monto $15,000.00 MXN Beneficiario Juan Pérez"
Output:
{
  "documentType": "voucher",
  "amount": 15000,
  "currency": "MXN",
  "date": "2025-05-12",
  "bank": "Banco Santander",
  "reference": null,
  "originAccount": null,
  "destinationAccount": "012345678901234567",
  "trackingKey": null,
  "beneficiaryName": "Juan Pérez",
  "supplierName": null,
  "dueDate": null,
  "invoiceNumber": null,
  "taxId": null,
  "relatedInvoiceUUID": null,
  "paymentMethod": null
}

### CRITICAL REMINDERS
- **MOST IMPORTANT**: Extract ONLY the EMISOR/EMITTER (seller) name, NOT the RECEPTOR/RECEIVER (buyer) name
- In CFDI invoices, look for "Emisor" section - that's the supplier we need
- DO NOT extract "Grupo Orsega", "Dura International", "ORSEGA", "DURA" - these are buyers, not suppliers
- If the document shows "Receptor: Grupo Orsega", then the supplier is in the "Emisor" section
- Calculate due dates from payment terms if explicit due date is missing
- Extract amounts even if formatted differently (with commas, spaces, currency symbols)
- Be flexible with date formats - try to parse common variations
- For invoices, ALWAYS try to extract: supplierName (EMISOR only), amount, and calculate dueDate if possible

Now analyze the following document carefully and extract ALL available information. Respond ONLY with valid JSON, no explanations.
`;

    // --- 3️⃣ LLAMADA A OPENAI ---
    let response;
    if (fileType.includes("pdf")) {
      // Si tenemos texto extraído, usarlo para análisis
      if (textContent && textContent.length > 50) {
        // Enviar más contexto al prompt para mejor extracción
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
          temperature: 0.1, // Baja temperatura para respuestas más consistentes
          max_tokens: 1200, // Aumentar tokens para respuestas más completas
        });
      } else if (textContent && textContent.length > 0) {
        // Si tenemos algo de texto (aunque sea poco), intentar analizarlo
        console.warn(`⚠️ [PDF] Texto extraído limitado (${textContent.length} caracteres). El PDF podría ser una imagen escaneada.`);
        console.warn(`⚠️ [PDF] Intentando análisis con texto disponible: "${textContent.substring(0, 200)}..."`);
        
        // Intentar análisis con el texto disponible (aunque sea limitado)
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
        // Si no hay texto en absoluto, el análisis manual intentará extraer datos básicos
        console.warn('⚠️ [PDF] PDF sin texto extraíble detectado. Esto podría ser una imagen escaneada.');
        console.warn('⚠️ [PDF] El análisis será limitado, pero se intentará extraer datos básicos mediante análisis manual.');
        // No hacer llamada a OpenAI, dejar que el análisis manual maneje esto
        // Crear una respuesta vacía para que el análisis manual pueda procesar
        response = null as any;
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
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } }, // Alta resolución para mejor OCR
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1200, // Aumentar tokens para respuestas más completas
      });
    }

    // --- 4️⃣ PARSING ROBUSTO MEJORADO ---
    let parsedData: any;
    let rawResponse = ""; // Declarar fuera del bloque para que esté disponible en todo el scope
    
    // Si no hay respuesta de OpenAI (PDF sin texto), usar solo análisis manual
    if (!response) {
      console.log(`⚠️ [Parsing] No hay respuesta de OpenAI, usando solo análisis manual`);
      parsedData = {}; // Inicializar objeto vacío para análisis manual
      rawResponse = ""; // Sin respuesta
    } else {
      rawResponse = response.choices[0]?.message?.content?.trim() || "";
      console.log(`🧠 [OpenAI Response] Respuesta recibida (${rawResponse.length} caracteres)`);
      console.log(`🧠 [OpenAI Response] Fragmento: ${rawResponse.slice(0, 600)}...`);
      
      try {
        // Intentar extraer JSON de la respuesta (puede venir con markdown code blocks)
        let jsonStr = rawResponse;
        
        // Remover code blocks si existen
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Buscar el objeto JSON (puede estar rodeado de texto)
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
        parsedData = {}; // Inicializar para análisis manual
      }
    }
    
    // --- 4.5️⃣ ANÁLISIS MANUAL MEJORADO (fallback o complemento) ---
    // Siempre intentar análisis manual para complementar o reemplazar datos de OpenAI
    if (textContent && textContent.length > 0) {
      const txt = textContent.toLowerCase();
      const originalText = textContent; // Mantener texto original para búsquedas case-sensitive
      
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
      
      // Extracción manual de monto (si no está en parsedData o para validar)
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
          
          // Usar el monto más grande (probablemente el total)
          if (amounts.length > 0) {
            parsedData.amount = Math.max(...amounts);
            console.log(`✅ [Manual Extraction] Monto extraído manualmente: ${parsedData.amount}`);
            break;
          }
        }
      }
      
      // Extracción manual de proveedor (si no está en parsedData)
      // IMPORTANTE: Solo extraer el EMISOR, NO el RECEPTOR
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
        // Prioridad 1: Buscar específicamente en sección "Emisor" (CFDI)
        const emisorPatterns = [
          // Patrón CFDI: "Emisor:" o "Datos del Emisor"
          /(?:datos\s+del\s+)?emisor[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?|S\.?C\.?|C\.?V\.?|INC\.?|LLC\.?)?)/i,
          // Patrón: RFC Emisor seguido del nombre
          /rfc\s+emisor[\s:]+[A-Z0-9]{10,15}[\s\n]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?)?)/i,
          // Patrón: Nombre después de "Emisor" y antes de "Receptor"
          /emisor[^r]{0,200}?([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?)?)[\s\n]+(?:receptor|rfc receptor)/i,
        ];
        
        let foundSupplier = false;
        for (const pattern of emisorPatterns) {
          const match = originalText.match(pattern);
          if (match && match[1]) {
            const candidate = match[1].trim().substring(0, 100);
            // Validar que no sea una empresa receptora conocida
            if (candidate.length >= 5 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(candidate) && !isKnownBuyer(candidate)) {
              parsedData.supplierName = candidate;
              console.log(`✅ [Manual Extraction] Proveedor extraído de sección Emisor: ${parsedData.supplierName}`);
              foundSupplier = true;
              break;
            }
          }
        }
        
        // Prioridad 2: Si no se encontró en sección Emisor, buscar en otros lugares pero excluyendo receptores
        if (!foundSupplier) {
          const supplierPatterns = [
            // Buscar "Proveedor" pero asegurarse de que no sea "Receptor"
            /(?:proveedor|supplier|vendedor)(?![\s:]*receptor)[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?|S\.? de R\.?L\.?|S\.?C\.?|C\.?V\.?|INC\.?|LLC\.?)?)/i,
            // Buscar RFC seguido de nombre, pero verificar que no sea receptor
            /rfc(?!\s+receptor)[\s:]+[A-Z0-9]{10,15}[\s\n]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?)?)(?![\s\n]+(?:receptor|dura|orsega|grupo orsega))/i,
          ];
          
          for (const pattern of supplierPatterns) {
            const match = originalText.match(pattern);
            if (match && match[1]) {
              const candidate = match[1].trim().substring(0, 100);
              // Validar que no sea una empresa receptora conocida
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
        // Si ya hay un supplierName extraído, verificar que no sea una empresa receptora
        if (isKnownBuyer(parsedData.supplierName)) {
          console.warn(`⚠️ [Supplier Filter] Nombre extraído "${parsedData.supplierName}" es una empresa receptora conocida, descartándolo...`);
          parsedData.supplierName = null; // Descartar y buscar de nuevo
          
          // Intentar buscar el emisor real
          const emisorMatch = originalText.match(/(?:datos\s+del\s+)?emisor[\s:]+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s,\.&\-]{5,80}(?:S\.?A\.?|S\.?A\.? de C\.?V\.?)?)/i);
          if (emisorMatch && emisorMatch[1] && !isKnownBuyer(emisorMatch[1])) {
            parsedData.supplierName = emisorMatch[1].trim().substring(0, 100);
            console.log(`✅ [Supplier Filter] Proveedor corregido (emisor real): ${parsedData.supplierName}`);
          }
        }
      }
      
      // Extracción manual de fecha (si no está en parsedData)
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
    // Calcular fecha de vencimiento si no está presente pero hay fecha de factura
    let dueDate = parsedData.dueDate ? parseDate(parsedData.dueDate) : null;
    const invoiceDate = parsedData.date ? parseDate(parsedData.date) : null;
    
    // Si no hay fecha de vencimiento pero hay fecha de factura, calcular +30 días por defecto
    if (!dueDate && invoiceDate && (docType === "invoice" || docType === "unknown")) {
      dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30); // Default: 30 days from invoice date
      console.log(`📅 [Date Calculation] Fecha de vencimiento calculada: ${dueDate.toISOString().split('T')[0]} (fecha factura + 30 días)`);
    }

    // Limpiar nombre del proveedor (remover espacios extras, normalizar)
    // La extracción manual ya se hizo arriba, solo limpiar y normalizar
    // FILTRAR empresas receptoras conocidas (Grupo Orsega, Dura International)
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
    
    let supplierName = parsedData.supplierName || null;
    
    // Filtrar empresas receptoras conocidas
    if (supplierName && isKnownBuyer(supplierName)) {
      console.warn(`⚠️ [Supplier Filter] "${supplierName}" es una empresa receptora conocida, descartándolo...`);
      supplierName = null;
    }
    
    if (supplierName) {
      supplierName = supplierName.trim().replace(/\s+/g, ' ');
      // Intentar extraer nombre de empresa si viene con formato largo
      if (supplierName.length > 100) {
        // Tomar las primeras palabras (probablemente el nombre de la empresa)
        supplierName = supplierName.split(/\s+/).slice(0, 8).join(' ');
      }
      // Remover caracteres especiales al final
      supplierName = supplierName.replace(/[,;:\.]+$/, '').trim();
      
      // Verificar nuevamente después de limpiar
      if (isKnownBuyer(supplierName)) {
        console.warn(`⚠️ [Supplier Filter] Después de limpiar, "${supplierName}" sigue siendo una empresa receptora, descartándolo...`);
        supplierName = null;
      }
    } else if (docType === "invoice" || docType === "unknown") {
      console.warn(`⚠️ [Supplier] No se pudo extraer el nombre del proveedor (emisor) del documento`);
      console.warn(`⚠️ [Supplier] Asegúrate de que el documento tenga una sección "Emisor" con el nombre del proveedor`);
    }

    // Limpiar y normalizar monto
    // La extracción manual ya se hizo arriba, solo limpiar y validar
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
      extractedCurrency: parsedData.currency || "MXN", // Default a MXN si no se especifica
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

    console.log(
      `✅ Resultado final (${docType}): monto=${result.extractedAmount} confianza=${(
        result.ocrConfidence * 100
      ).toFixed(1)}%`
    );

    return result;
  } catch (error) {
    console.error("❌ Error durante el análisis:", error);

    // En lugar de fallar completamente, devolvemos un resultado por defecto
    // Esto permite al usuario continuar con verificación manual
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isOpenAIError = errorMessage.includes('API key') ||
                          errorMessage.includes('401') ||
                          errorMessage.includes('OpenAI') ||
                          errorMessage.includes('OPENAI');

    if (isOpenAIError) {
      console.warn('⚠️ [Document Analyzer] OpenAI no disponible. Continuando sin análisis automático.');
      console.warn('⚠️ [Document Analyzer] El usuario deberá verificar los datos manualmente.');
    }

    // Devolver resultado por defecto para permitir verificación manual
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
      ocrConfidence: 0, // 0% confianza = requiere verificación manual
      rawResponse: `Error en análisis: ${errorMessage}`,
      documentType: 'unknown' as const, // El usuario deberá especificar el tipo
      extractedSupplierName: null,
      extractedDueDate: null,
      extractedInvoiceNumber: null,
      extractedTaxId: null,
      relatedInvoiceUUID: null,
      paymentMethod: null,
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

  // Intentar parsear formato ISO
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Intentar formatos comunes: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
  const formats = [
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{2})-(\d{2})-(\d{4})/,   // DD-MM-YYYY
    /(\d{4})-(\d{2})-(\d{2})/,   // YYYY-MM-DD
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // D/M/YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let day: number, month: number, year: number;
      
      if (format.source.includes('YYYY-MM-DD')) {
        // YYYY-MM-DD
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        // DD/MM/YYYY o DD-MM-YYYY
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
  // Para facturas, los campos más críticos son supplierName y amount
  // dueDate puede calcularse si tenemos invoiceDate
  const critical = ["supplierName", "amount"];
  const important = ["invoiceNumber", "taxId", "date"];
  const optional = ["currency", "dueDate"];
  
  const cScore = critical.filter(f => !!data[f]).length / critical.length;
  const iScore = important.filter(f => !!data[f]).length / important.length;
  const oScore = optional.filter(f => !!data[f]).length / optional.length;
  
  // Ponderación: 60% críticos, 30% importantes, 10% opcionales
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