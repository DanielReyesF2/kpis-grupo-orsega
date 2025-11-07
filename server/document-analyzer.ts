// ================================================
// 📄 document-analyzer.ts
// Analizador de documentos bancarios, facturas y REPs con OpenAI Vision
// ================================================

import OpenAI from "openai";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

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
}

// -----------------------------
// Función principal
// -----------------------------
export async function analyzePaymentDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("❌ OPENAI_API_KEY no está configurado");
  const openai = new OpenAI({ apiKey });

  console.log(`🔍 Analizando documento tipo: ${fileType}`);

  try {
    let textContent = "";
    let base64Data = "";

    // --- 1️⃣ Extracción inicial según tipo ---
    if (fileType.includes("pdf")) {
      // Extraer texto del PDF usando pdfjs-dist
      const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(fileBuffer)});
      const pdf = await loadingTask.promise;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        textContent += pageText + '\n';
      }

      textContent = textContent.trim();
      console.log(`📄 Texto extraído del PDF (${textContent.length} caracteres, ${pdf.numPages} páginas)`);
    } else {
      base64Data = fileBuffer.toString("base64");
    }

    const imageType = fileType.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = base64Data ? `data:${imageType};base64,${base64Data}` : "";

    // --- 2️⃣ PROMPT DETALLADO ---
    const documentTypePrompt = `
You are an expert in Mexican financial and fiscal documents (facturas CFDI, recibos electrónicos de pago (REP), and bank payment vouchers).
Your task: analyze the document (text or image) and output ONE SINGLE JSON object matching this schema.

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

### CLASSIFICATION RULES
- Use "invoice" if you detect "Factura", "CFDI", "RFC", "Folio Fiscal", "Proveedor".
- Use "voucher" if you detect "SPEI", "Transferencia", "CLABE", "Banco", "Comprobante de pago".
- Use "rep" if you detect "Complemento de Pago", "CFDI de Pago", "UUID Relacionado", "Folio Fiscal Relacionado".
- Use "unknown" if type cannot be determined confidently.

### EXTRACTION RULES
- Return numeric values only for "amount" (no currency symbols or commas).
- Return ISO 8601 dates (YYYY-MM-DD).
- If a field is missing, return null.
- DO NOT include extra fields or comments.
- Output MUST be pure JSON — no text before or after it.

### EXAMPLES
Input:
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

Input:
"CFDI Factura 1234 Proveedor XYZ RFC XYZ123456789 Fecha 2025-04-30 Monto MXN 12,500.00 Fecha Vencimiento 2025-05-30"
Output:
{
  "documentType": "invoice",
  "amount": 12500,
  "currency": "MXN",
  "date": "2025-04-30",
  "bank": null,
  "reference": null,
  "originAccount": null,
  "destinationAccount": null,
  "trackingKey": null,
  "beneficiaryName": null,
  "supplierName": "Proveedor XYZ",
  "dueDate": "2025-05-30",
  "invoiceNumber": "1234",
  "taxId": "XYZ123456789",
  "relatedInvoiceUUID": null,
  "paymentMethod": null
}

Input:
"CFDI Complemento de Pago UUID Relacionado 3e2c-xxxx-xxxx-abc1 Fecha de Pago 2025-03-10 Monto Pagado $4,500.00 Moneda MXN RFC ABC123456789"
Output:
{
  "documentType": "rep",
  "amount": 4500,
  "currency": "MXN",
  "date": "2025-03-10",
  "bank": null,
  "reference": null,
  "originAccount": null,
  "destinationAccount": null,
  "trackingKey": null,
  "beneficiaryName": null,
  "supplierName": null,
  "dueDate": null,
  "invoiceNumber": null,
  "taxId": "ABC123456789",
  "relatedInvoiceUUID": "3e2c-xxxx-xxxx-abc1",
  "paymentMethod": null
}

Now analyze the following document and respond ONLY with valid JSON.
`;

    // --- 3️⃣ LLAMADA A OPENAI ---
    let response;
    if (fileType.includes("pdf")) {
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `${documentTypePrompt}\n\nDocument content:\n${textContent.slice(0, 15000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 900,
      });
    } else {
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: documentTypePrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 900,
      });
    }

    const rawResponse = response.choices[0]?.message?.content?.trim() || "";
    console.log(`🧠 Respuesta OpenAI (fragmento): ${rawResponse.slice(0, 400)}...`);

    // --- 4️⃣ PARSING ROBUSTO ---
    let parsedData: any;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)?.[0] ?? rawResponse.replace(/```json|```/g, "");
      parsedData = JSON.parse(jsonMatch);
    } catch (error) {
      console.warn("⚠️ Error parseando JSON, aplicando detección manual...");
      const txt = textContent.toLowerCase();
      const isInvoice = /factura|cfdi|rfc|folio fiscal|proveedor/.test(txt);
      const isVoucher = /spei|clabe|banco|transferencia/.test(txt);
      const isRep = /complemento de pago|cfdi de pago|uuid relacionado|folio relacionado/.test(txt);
      parsedData = {
        documentType: isRep ? "rep" : isInvoice ? "invoice" : isVoucher ? "voucher" : "unknown",
      };
    }

    const docType = parsedData.documentType || "unknown";
    console.log(`📋 Tipo detectado: ${docType}`);

    // --- 5️⃣ RESULTADO FINAL ---
    const result: DocumentAnalysisResult = {
      extractedAmount: parsedData.amount ? parseFloat(parsedData.amount) : null,
      extractedDate: parsedData.date ? new Date(parsedData.date) : null,
      extractedBank: parsedData.bank || null,
      extractedReference: parsedData.reference || null,
      extractedCurrency: parsedData.currency || null,
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
      extractedSupplierName: parsedData.supplierName || null,
      extractedDueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : null,
      extractedInvoiceNumber: parsedData.invoiceNumber || null,
      extractedTaxId: parsedData.taxId || null,
      relatedInvoiceUUID: parsedData.relatedInvoiceUUID || null,
      paymentMethod: parsedData.paymentMethod || null,
    };

    console.log(
      `✅ Resultado final (${docType}): monto=${result.extractedAmount} confianza=${(
        result.ocrConfidence * 100
      ).toFixed(1)}%`
    );

    return result;
  } catch (error) {
    console.error("❌ Error durante el análisis:", error);
    throw new Error(`Error al analizar documento: ${error}`);
  }
}

// -----------------------------
// Funciones auxiliares
// -----------------------------
function calculateInvoiceConfidence(data: any): number {
  const critical = ["supplierName", "amount", "invoiceNumber", "taxId"];
  const optional = ["currency", "invoiceDate", "dueDate"];
  const cScore = critical.filter(f => !!data[f]).length / critical.length;
  const oScore = optional.filter(f => !!data[f]).length / optional.length;
  return +(0.8 * cScore + 0.2 * oScore).toFixed(2);
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