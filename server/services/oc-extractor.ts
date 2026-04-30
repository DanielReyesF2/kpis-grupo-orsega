/**
 * OC Extractor Service — Extrae datos de Órdenes de Compra usando Nova AI
 * Sigue el mismo patrón que callNovaForExtraction() en treasury-payments.ts
 * Nova recibe el documento, lo analiza, y retorna JSON estructurado.
 * Para Excel: se parsea a texto y se envía como mensaje.
 */

import { novaAIClient } from "../nova/nova-client";
import * as XLSX from "xlsx";

interface ExtractedProduct {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
}

export interface ExtractedOCData {
  supplierName: string | null;
  supplierCountry: string | null;
  products: ExtractedProduct[];
  currency: string | null;
  incoterm: string | null;
  totalValue: number | null;
  purchaseOrderNumber: string | null;
  estimatedShipDate: string | null;
  estimatedArrivalDate: string | null;
}

const EXTRACTION_PROMPT = `Analiza este documento de Orden de Compra (Purchase Order) de importación y extrae los siguientes datos en formato JSON:

{
  "supplierName": "Nombre del proveedor/vendedor",
  "supplierCountry": "País del proveedor (si se puede determinar)",
  "products": [
    {
      "name": "Nombre del producto",
      "quantity": 1000,
      "unit": "KG",
      "unitPrice": 3.50
    }
  ],
  "currency": "USD",
  "incoterm": "FOB",
  "totalValue": 5000.00,
  "purchaseOrderNumber": "PO-2026-001",
  "estimatedShipDate": "2026-06-01",
  "estimatedArrivalDate": "2026-06-20"
}

Reglas:
- Si no puedes determinar un campo, usa null
- Para unidades usa abreviaciones estándar: KG, L, PCS, TON, M, M2, M3
- Para moneda usa código ISO: USD, MXN, EUR, CNY
- Para fechas usa formato YYYY-MM-DD
- Incoterms comunes: FOB, CIF, EXW, DDP, CFR, FCA
- Extrae TODOS los productos que aparezcan
- Solo responde con el JSON, sin explicaciones`;

/**
 * Extrae datos de una Orden de Compra usando Nova AI
 * Patrón: mismo que callNovaForExtraction() en tesorería
 */
export async function extractPurchaseOrderData(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedOCData> {
  try {
    // Verificar que Nova esté configurado
    if (!novaAIClient.isConfigured()) {
      console.warn("[OC-Extractor] Nova AI not configured, returning empty result");
      return emptyResult();
    }

    // Para Excel: parsear a texto y enviar como mensaje
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel" ||
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls")
    ) {
      return await extractFromExcel(fileBuffer);
    }

    // Para PDF e imágenes: enviar como archivo adjunto a Nova
    return await extractFromDocument(fileBuffer, mimeType, fileName);
  } catch (error) {
    console.error("[OC-Extractor] Error extracting data:", error);
    return emptyResult();
  }
}

/**
 * Extrae datos de PDF/imagen enviando el archivo a Nova vía streamChat
 * Mismo patrón que callNovaForExtraction() en treasury-payments.ts
 */
async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedOCData> {
  const abortController = new AbortController();
  const result = await new Promise<string>((resolve, reject) => {
    let answer = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        abortController.abort();
        reject(new Error('Nova AI timeout (30s)'));
      }
    }, 30000);

    novaAIClient.streamChat(
      EXTRACTION_PROMPT,
      [{ buffer: fileBuffer, originalname: fileName, mimetype: mimeType }],
      { pageContext: 'importaciones' },
      {
        onToken: (text) => { answer += text; },
        onToolStart: () => {},
        onToolResult: () => {},
        onDone: (res) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(res.answer || answer);
        },
        onError: (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(err);
        },
      },
      abortController.signal,
    );
  });

  return parseNovaResponse(result);
}

/**
 * Extrae datos de Excel: parsea a CSV y envía como texto a Nova
 */
async function extractFromExcel(fileBuffer: Buffer): Promise<ExtractedOCData> {
  // Parsear Excel a texto
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames.slice(0, 3)) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(`--- Hoja: ${sheetName} ---\n${csv}`);
  }

  const excelText = sheets.join("\n\n");
  const prompt = `Este es el contenido de un archivo Excel de una Orden de Compra de importación:\n\n${excelText}\n\n${EXTRACTION_PROMPT}`;

  const abortController = new AbortController();
  const result = await new Promise<string>((resolve, reject) => {
    let answer = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        abortController.abort();
        reject(new Error('Nova AI timeout (30s)'));
      }
    }, 30000);

    novaAIClient.streamChat(
      prompt,
      [], // No file attachment — content is in the prompt text
      { pageContext: 'importaciones' },
      {
        onToken: (text) => { answer += text; },
        onToolStart: () => {},
        onToolResult: () => {},
        onDone: (res) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(res.answer || answer);
        },
        onError: (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(err);
        },
      },
      abortController.signal,
    );
  });

  return parseNovaResponse(result);
}

/**
 * Extrae el primer bloque JSON balanceado (respeta llaves anidadas).
 * Un regex greedy captura basura extra; un lazy corta antes de tiempo
 * en objetos con sub-objetos. Este approach cuenta llaves.
 */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.substring(start, i + 1); }
  }
  return null;
}

/**
 * Parsea la respuesta de Nova buscando JSON estructurado
 */
function parseNovaResponse(responseText: string): ExtractedOCData {
  const jsonBlock = extractBalancedJson(responseText);
  if (!jsonBlock) {
    console.warn("[OC-Extractor] No JSON found in Nova response");
    return emptyResult();
  }

  try {
    const data = JSON.parse(jsonBlock);

    return {
      supplierName: data.supplierName || null,
      supplierCountry: data.supplierCountry || null,
      products: Array.isArray(data.products)
        ? data.products.map((p: Record<string, unknown>) => ({
            name: String(p.name || ""),
            quantity: typeof p.quantity === "number" ? p.quantity : null,
            unit: (p.unit as string) || null,
            unitPrice: typeof p.unitPrice === "number" ? p.unitPrice : null,
          }))
        : [],
      currency: data.currency || "USD",
      incoterm: data.incoterm || null,
      totalValue: typeof data.totalValue === "number" ? data.totalValue : null,
      purchaseOrderNumber: data.purchaseOrderNumber || null,
      estimatedShipDate: data.estimatedShipDate || null,
      estimatedArrivalDate: data.estimatedArrivalDate || null,
    };
  } catch (parseError) {
    console.error("[OC-Extractor] Failed to parse Nova response:", parseError);
    return emptyResult();
  }
}

function emptyResult(): ExtractedOCData {
  return {
    supplierName: null,
    supplierCountry: null,
    products: [],
    currency: "USD",
    incoterm: null,
    totalValue: null,
    purchaseOrderNumber: null,
    estimatedShipDate: null,
    estimatedArrivalDate: null,
  };
}
