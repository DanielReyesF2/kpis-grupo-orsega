// ================================================
// 📄 document-analyzer.ts
// Analizador unificado de Facturas CFDI 4.0, REPs,
// Comprobantes Bancarios y CxP Idrall
// ================================================

import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// -----------------------------
// Helper para importar pdf-parse (robusto)
// -----------------------------
async function getPdfParse(): Promise<(buffer: Buffer) => Promise<any>> {
  try {
    const pdfParseModule: any = await import("pdf-parse");
    if (typeof pdfParseModule === "function") return pdfParseModule;
    if (pdfParseModule.default && typeof pdfParseModule.default === "function")
      return pdfParseModule.default;
    if (pdfParseModule.pdfParse && typeof pdfParseModule.pdfParse === "function")
      return pdfParseModule.pdfParse;

    throw new Error(
      `❌ pdf-parse no exporta función válida. Keys: ${Object.keys(pdfParseModule || {}).join(", ")}`
    );
  } catch (error: any) {
    console.error("❌ [Document Analyzer] Error importando pdf-parse:", error);
    throw new Error(`Error al importar pdf-parse: ${error.message}`);
  }
}

// -----------------------------
// Interfaces
// -----------------------------
export interface DocumentAnalysisResult {
  documentType?: "invoice" | "rep" | "voucher" | "cxp" | "unknown";
  extractedAmount: number | null;
  extractedSubtotal?: number | null;
  extractedTax?: number | null;
  extractedDate: Date | null;
  extractedDueDate?: Date | null;
  extractedCurrency: string | null;
  extractedSupplierName?: string | null;
  extractedBeneficiaryName?: string | null;
  extractedBank: string | null;
  extractedReference: string | null;
  extractedOriginAccount: string | null;
  extractedDestinationAccount: string | null;
  extractedTrackingKey: string | null;
  extractedInvoiceNumber?: string | null;
  extractedTaxId?: string | null;
  relatedInvoiceUUID?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  ocrConfidence: number;
  rawResponse?: string;
  cxpRecords?: IdrallCxPRecord[]; // Registros individuales cuando es tipo CxP
}

export interface IdrallCxPRecord {
  supplierName: string;
  amount: number;
  currency: string;
  dueDate: Date;
  reference: string | null;
  status: string | null;
  notes: string | null;
}

export interface IdrallProcessingResult {
  records: IdrallCxPRecord[];
  totalRecords: number;
  processedFiles: number;
  errors: string[];
}

// -----------------------------
// 🔹 Función principal
// -----------------------------
export async function analyzePaymentDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("❌ OPENAI_API_KEY no está configurado");

  const openai = new OpenAI({ apiKey });
  let textContent = "";
  let base64Data = "";

  console.log(`🔍 [Document Analyzer] Analizando documento tipo: ${fileType}`);

  try {
    // 1️⃣ Extraer texto si es PDF
    if (fileType.includes("pdf")) {
      const pdfParse = await getPdfParse();
      const pdfData = await pdfParse(fileBuffer);
      textContent = pdfData.text.trim();
    } else {
      base64Data = fileBuffer.toString("base64");
    }

    const imageType = fileType.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = base64Data ? `data:${imageType};base64,${base64Data}` : "";

    // 2️⃣ Prompt especializado para CFDI, REPs, SPEI y CxP
    const documentTypePrompt = `
Eres un analista experto en documentos fiscales y financieros mexicanos.
Analiza el documento (texto o imagen) y devuelve **únicamente** JSON válido.

### Campos esperados:
{
  "documentType": "invoice" | "rep" | "voucher" | "cxp" | "unknown",
  "supplierName": "nombre del emisor o proveedor",
  "taxId": "RFC del emisor o proveedor",
  "beneficiaryName": "nombre del receptor o cliente",
  "invoiceNumber": "folio o número de factura",
  "relatedInvoiceUUID": "folio fiscal o UUID relacionado",
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "currency": "MXN" | "USD",
  "amount": número total (solo número, sin símbolos),
  "subtotal": número subtotal (solo número),
  "tax": número de IVA (solo número),
  "paymentMethod": "PUE" | "PPD" | null,
  "bank": "nombre del banco o forma de pago",
  "reference": "número de operación o referencia bancaria",
  "originAccount": "CLABE o cuenta origen",
  "destinationAccount": "CLABE o cuenta destino",
  "trackingKey": "clave de rastreo SPEI",
  "status": "pendiente" | "pagado" | "vencido" | null,
  "notes": "descripción o concepto del pago o factura"
}

### Clasificación del documento:
- Usa **"invoice"** si contiene palabras como “CFDI”, “Factura”, “RFC”, “Folio Fiscal”, “Versión 4.0”.
- Usa **"rep"** si contiene “Complemento de Pago”, “CFDI de Pago”, “UUID Relacionado”.
- Usa **"voucher"** si contiene “SPEI”, “Transferencia”, “Banco”, “Comprobante de pago”.
- Usa **"cxp"** si contiene múltiples líneas o registros de Cuentas por Pagar.
- Usa **"unknown"** si no se puede determinar.

### Reglas adicionales:
- Devuelve SIEMPRE JSON válido (objeto o array).
- Si hay varios registros (CxP), devuelve un array.
- No agregues texto adicional ni explicaciones.
`;

    // 3️⃣ Llamada al modelo
    let response;
    if (fileType.includes("pdf")) {
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: `${documentTypePrompt}\n\nTexto del documento:\n${textContent.slice(0, 15000)}` },
        ],
        temperature: 0.1,
        max_tokens: 2000,
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
        max_tokens: 2000,
      });
    }

    const rawResponse = response.choices[0]?.message?.content?.trim() || "";
    console.log(`🧠 [Document Analyzer] OpenAI output: ${rawResponse.slice(0, 400)}...`);

    // 4️⃣ Parsing seguro del JSON
    let parsedData: any;
    try {
      const jsonMatch = rawResponse.match(/\[.*\]|\{.*\}/s);
      parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
    } catch {
      const txt = textContent.toLowerCase();
      parsedData = {
        documentType: /rep|complemento de pago/.test(txt)
          ? "rep"
          : /factura|cfdi|folio fiscal|versión 4\.0/.test(txt)
          ? "invoice"
          : /spei|clabe|banco|transferencia/.test(txt)
          ? "voucher"
          : /cuentas por pagar|cxp|proveedor/.test(txt)
          ? "cxp"
          : "unknown",
      };
    }

    // 5️⃣ Si es array (CxP de Idrall)
    if (Array.isArray(parsedData)) {
      const records: IdrallCxPRecord[] = parsedData.map((r: any) => ({
        supplierName: r.supplierName || r.proveedor || "",
        amount: r.amount ? parseFloat(String(r.amount)) : 0,
        currency: r.currency || "MXN",
        dueDate: r.dueDate ? new Date(r.dueDate) : new Date(),
        reference: r.reference || r.folio || r.factura || null,
        status: r.status || null,
        notes: r.notes || null,
      }));
      console.log(`✅ [Document Analyzer] ${records.length} registros CxP detectados`);
      return {
        documentType: "cxp",
        extractedAmount: records.reduce((sum, r) => sum + (r.amount || 0), 0),
        extractedDate: new Date(),
        extractedCurrency: "MXN",
        extractedReference: `CxP_${records.length}_registros`,
        extractedBank: null,
        extractedOriginAccount: null,
        extractedDestinationAccount: null,
        extractedTrackingKey: null,
        ocrConfidence: 0.95,
        rawResponse,
        cxpRecords: records, // Incluir registros individuales
      };
    }

    const docType = parsedData.documentType || "unknown";

    // 6️⃣ Construcción del resultado
    const result: DocumentAnalysisResult = {
      documentType: docType,
      extractedSupplierName: parsedData.supplierName || null,
      extractedTaxId: parsedData.taxId || null,
      extractedBeneficiaryName: parsedData.beneficiaryName || null,
      extractedInvoiceNumber: parsedData.invoiceNumber || null,
      relatedInvoiceUUID: parsedData.relatedInvoiceUUID || null,
      extractedDate: parsedData.date ? new Date(parsedData.date) : null,
      extractedDueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : null,
      extractedCurrency: parsedData.currency || "MXN",
      extractedAmount: parsedData.amount ? parseFloat(parsedData.amount) : null,
      extractedSubtotal: parsedData.subtotal ? parseFloat(parsedData.subtotal) : null,
      extractedTax: parsedData.tax ? parseFloat(parsedData.tax) : null,
      paymentMethod: parsedData.paymentMethod || null,
      extractedBank: parsedData.bank || null,
      extractedReference: parsedData.reference || null,
      extractedOriginAccount: parsedData.originAccount || null,
      extractedDestinationAccount: parsedData.destinationAccount || null,
      extractedTrackingKey: parsedData.trackingKey || null,
      notes: parsedData.notes || null,
      ocrConfidence:
        docType === "invoice"
          ? calculateInvoiceConfidence(parsedData)
          : calculateConfidence(parsedData),
      rawResponse,
    };

    console.log(
      `✅ [Document Analyzer] Tipo=${docType} | Monto=${result.extractedAmount} | Conf=${(
        result.ocrConfidence * 100
      ).toFixed(1)}%`
    );

    return result;
  } catch (error) {
    console.error("❌ [Document Analyzer] Error durante análisis:", error);
    throw new Error(`Error al analizar documento: ${error}`);
  }
}

// -----------------------------
// Funciones auxiliares
// -----------------------------
function calculateInvoiceConfidence(data: any): number {
  const critical = ["supplierName", "taxId", "amount", "invoiceNumber", "relatedInvoiceUUID"];
  const optional = ["currency", "dueDate", "paymentMethod", "bank"];
  const cScore = critical.filter(f => !!data[f]).length / critical.length;
  const oScore = optional.filter(f => !!data[f]).length / optional.length;
  return +(0.85 * cScore + 0.15 * oScore).toFixed(2);
}

function calculateConfidence(data: any): number {
  const critical = ["amount", "date", "currency", "bank", "reference"];
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