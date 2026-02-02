/**
 * Nova Invoice Processor — Processes PDF/XML invoices uploaded via Nova chat.
 *
 * When users attach PDFs on the Tesorería page, this module:
 * 1. Analyzes each PDF via analyzePaymentDocument()
 * 2. Finds matching suppliers in the database
 * 3. Uploads files to R2/local storage
 * 4. Creates scheduledPayment + paymentVoucher records
 * 5. Returns a summary for Nova's additionalContext
 */

import { storage } from '../storage';
import { db } from '../db';
import { suppliers } from '@shared/schema';
import type {
  InsertScheduledPayment,
  InsertPaymentVoucher,
  ScheduledPayment,
  PaymentVoucher,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { analyzePaymentDocument, type DocumentAnalysisResult } from '../document-analyzer';
import { uploadFile } from '../storage/file-storage';

// ============================================================================
// Types
// ============================================================================

export interface InvoiceProcessResult {
  success: boolean;
  fileName: string;
  error?: string;
  analysis?: DocumentAnalysisResult;
  scheduledPayment?: ScheduledPayment;
  paymentVoucher?: PaymentVoucher;
  supplierName?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
}

export interface InvoiceProcessorSummary {
  processed: number;
  succeeded: number;
  failed: number;
  results: InvoiceProcessResult[];
  contextSummary: string;
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Process multiple PDF/XML invoices from Nova chat.
 * Called by nova-routes.ts when pageContext === 'treasury' and PDFs are attached.
 *
 * @param userMessage — The user's chat message, used as a hint for supplier name
 *                      and payment date when OCR can't extract them from the PDF.
 */
export async function processInvoicesFromChat(
  files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
  companyId: number,
  userId: number,
  userMessage?: string,
): Promise<InvoiceProcessorSummary> {
  // Extract hints from the user's chat message
  const hints = userMessage ? extractHintsFromMessage(userMessage) : {};
  const results: InvoiceProcessResult[] = [];

  for (const file of files) {
    // Only process PDFs and XMLs (invoices)
    if (!file.mimetype.includes('pdf') && !file.mimetype.includes('xml')) {
      results.push({
        success: false,
        fileName: file.originalname,
        error: 'Solo se procesan archivos PDF y XML como facturas',
      });
      continue;
    }

    try {
      const result = await processSingleInvoice(file, companyId, userId, hints);
      results.push(result);
    } catch (error) {
      console.error(`[InvoiceProcessor] Error processing ${file.originalname}:`, error);
      results.push({
        success: false,
        fileName: file.originalname,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    processed: results.length,
    succeeded,
    failed,
    results,
    contextSummary: buildContextSummary(results),
  };
}

// ============================================================================
// Single invoice processing
// ============================================================================

async function processSingleInvoice(
  file: { buffer: Buffer; originalname: string; mimetype: string },
  companyId: number,
  userId: number,
  hints: MessageHints = {},
): Promise<InvoiceProcessResult> {
  console.log(`[InvoiceProcessor] Processing: ${file.originalname}, hints: ${JSON.stringify(hints)}`);

  // 1. Analyze document
  const analysis = await analyzePaymentDocument(file.buffer, file.mimetype);
  console.log(
    `[InvoiceProcessor] Analysis: type=${analysis.documentType}, amount=${analysis.extractedAmount}, supplier=${analysis.extractedSupplierName}`,
  );

  // Only reject complemento de pago (REP) — these are payment receipts, not invoices.
  // Vouchers and unknown types with extractable amounts are still processable
  // since the user explicitly uploaded them on the treasury page.
  if (analysis.documentType === 'rep') {
    return {
      success: false,
      fileName: file.originalname,
      error: 'Documento detectado como complemento de pago (REP), no como factura',
      analysis,
    };
  }

  // Must have an amount
  if (!analysis.extractedAmount || analysis.extractedAmount <= 0) {
    return {
      success: false,
      fileName: file.originalname,
      error: 'No se pudo extraer el monto de la factura',
      analysis,
    };
  }

  // 2. Find supplier match — use OCR result first, then user message hint
  const nameForSearch = analysis.extractedSupplierName && analysis.extractedSupplierName !== 'NO ENCONTRADO'
    ? analysis.extractedSupplierName
    : hints.supplierHint || null;

  const supplierMatch = await findBestSupplierMatch(
    nameForSearch,
    analysis.extractedTaxId || null,
    companyId,
  );

  const supplierName =
    supplierMatch?.name ||
    (analysis.extractedSupplierName && analysis.extractedSupplierName !== 'NO ENCONTRADO' ? analysis.extractedSupplierName : null) ||
    hints.supplierHint ||
    'Proveedor desconocido';
  const supplierId = supplierMatch?.id || null;

  // 3. Upload file to storage
  const uploadResult = await uploadFile(
    file.buffer,
    'facturas',
    file.originalname,
    file.mimetype,
  );
  console.log(`[InvoiceProcessor] Uploaded to ${uploadResult.storage}: ${uploadResult.url}`);

  // 4. Calculate due date — use OCR result, then user message hint, then default +30 days
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const dueDate =
    analysis.extractedDueDate ||
    hints.paymentDateHint ||
    (analysis.extractedDate
      ? new Date(new Date(analysis.extractedDate).getTime() + thirtyDaysMs)
      : new Date(now.getTime() + thirtyDaysMs));
  const paymentDate = dueDate;

  // 5. Create scheduled payment
  const scheduledPaymentData: InsertScheduledPayment = {
    companyId,
    supplierId,
    supplierName,
    amount: analysis.extractedAmount,
    currency: analysis.extractedCurrency || 'MXN',
    dueDate,
    paymentDate,
    reference:
      analysis.extractedInvoiceNumber || `Factura-Nova-${Date.now()}`,
    status: 'idrall_imported',
    sourceType: 'manual',
    notes: `Procesada via Nova Chat. ${analysis.extractedTaxId ? `RFC: ${analysis.extractedTaxId}` : ''}`.trim(),
    hydralFileUrl: uploadResult.url,
    hydralFileName: file.originalname,
    createdBy: userId,
  };

  const createdPayment = await storage.createScheduledPayment(scheduledPaymentData);
  console.log(`[InvoiceProcessor] Scheduled payment created: ID ${createdPayment.id}`);

  // 6. Create payment voucher for Kanban
  const fileExt = file.originalname.toLowerCase().split('.').pop();
  const voucherFileType =
    file.mimetype || (fileExt === 'pdf' ? 'application/pdf' : 'application/xml');

  const voucherData: InsertPaymentVoucher = {
    companyId,
    payerCompanyId: companyId,
    clientId: supplierId || 0,
    clientName: supplierName,
    scheduledPaymentId: createdPayment.id,
    status: 'pago_programado' as const,
    voucherFileUrl: uploadResult.url,
    voucherFileName: file.originalname,
    voucherFileType,
    extractedAmount: analysis.extractedAmount,
    extractedDate: analysis.extractedDate || dueDate,
    extractedBank: null,
    extractedReference: analysis.extractedInvoiceNumber || null,
    extractedCurrency: analysis.extractedCurrency || 'MXN',
    extractedOriginAccount: null,
    extractedDestinationAccount: null,
    extractedTrackingKey: null,
    extractedBeneficiaryName: null,
    ocrConfidence: analysis.ocrConfidence,
    uploadedBy: userId,
  };

  const createdVoucher = await storage.createPaymentVoucher(voucherData);
  console.log(
    `[InvoiceProcessor] Payment voucher created: ID ${createdVoucher.id}, status: pago_programado`,
  );

  return {
    success: true,
    fileName: file.originalname,
    analysis,
    scheduledPayment: createdPayment,
    paymentVoucher: createdVoucher,
    supplierName,
    amount: analysis.extractedAmount,
    currency: analysis.extractedCurrency || 'MXN',
    dueDate: dueDate.toISOString().split('T')[0],
  };
}

// ============================================================================
// Supplier matching
// ============================================================================

async function findBestSupplierMatch(
  extractedName: string | null,
  extractedTaxId: string | null,
  companyId: number,
): Promise<{ id: number; name: string } | null> {
  if (!extractedName && !extractedTaxId) return null;

  try {
    // Get all active suppliers for this company
    const allSuppliers = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true)));

    // Strategy 1: Match by tax ID (highest confidence)
    if (extractedTaxId) {
      const normalizedTaxId = extractedTaxId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = allSuppliers.find((s) => {
        const text = JSON.stringify(s).toLowerCase();
        return text.includes(normalizedTaxId);
      });
      if (match) {
        return { id: match.id, name: match.name || match.shortName || extractedName || 'Proveedor' };
      }
    }

    // Strategy 2: Match by name
    if (extractedName) {
      const normalized = normalizeName(extractedName);

      // Exact match
      const exact = allSuppliers.find((s) => {
        return normalizeName(s.name || s.shortName || '') === normalized;
      });
      if (exact) {
        return { id: exact.id, name: exact.name || exact.shortName || extractedName };
      }

      // Contains match
      const contains = allSuppliers.find((s) => {
        const sName = normalizeName(s.name || s.shortName || '');
        return sName.includes(normalized) || normalized.includes(sName);
      });
      if (contains) {
        return { id: contains.id, name: contains.name || contains.shortName || extractedName };
      }

      // Word overlap match
      const extractedWords = normalized.split(/\s+/).filter((w) => w.length > 3);
      if (extractedWords.length > 0) {
        const wordMatch = allSuppliers.find((s) => {
          const sName = normalizeName(s.name || s.shortName || '');
          const sWords = sName.split(/\s+/).filter((w) => w.length > 3);
          const common = extractedWords.filter((w) => sWords.includes(w));
          return common.length >= 2 || (common.length >= 1 && extractedWords.length <= 3);
        });
        if (wordMatch) {
          return {
            id: wordMatch.id,
            name: wordMatch.name || wordMatch.shortName || extractedName,
          };
        }
      }
    }

    // Fallback: check clients table
    const allClients = await storage.getClientsByCompany(companyId);

    if (extractedTaxId) {
      const normalizedTaxId = extractedTaxId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const clientMatch = allClients.find((c: any) => {
        return JSON.stringify(c).toLowerCase().includes(normalizedTaxId);
      });
      if (clientMatch) {
        return { id: clientMatch.id, name: clientMatch.name };
      }
    }

    if (extractedName) {
      const normalized = normalizeName(extractedName);
      const clientMatch = allClients.find((c: any) => {
        const cName = normalizeName(c.name || '');
        return cName === normalized || cName.includes(normalized) || normalized.includes(cName);
      });
      if (clientMatch) {
        return { id: clientMatch.id, name: clientMatch.name };
      }
    }
  } catch (error) {
    console.error('[InvoiceProcessor] Error finding supplier:', error);
  }

  return null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// User message hint extraction
// ============================================================================

interface MessageHints {
  supplierHint?: string;
  paymentDateHint?: Date;
}

/**
 * Extract supplier name and payment date from the user's chat message.
 * Examples:
 *   "sube esta factura de econova" → supplierHint: "econova"
 *   "fecha de pago 5 febrero" → paymentDateHint: 2026-02-05
 */
function extractHintsFromMessage(message: string): MessageHints {
  const hints: MessageHints = {};
  const lower = message.toLowerCase();

  // --- Supplier hint ---
  // Match patterns: "factura de [NAME]", "de [NAME]", "proveedor [NAME]"
  const supplierPatterns = [
    /factura\s+de\s+([a-záéíóúñü][\w\s&.,'-]{1,40}?)(?:\s+con|\s+fecha|\s+por|\s+para|$)/i,
    /proveedor\s+(?:es\s+)?([a-záéíóúñü][\w\s&.,'-]{1,40}?)(?:\s+con|\s+fecha|\s+por|$)/i,
  ];
  for (const pattern of supplierPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim();
      // Skip noise words
      if (candidate.length > 2 && !/^(esta|este|la|el|un|una|del|los|las)$/i.test(candidate)) {
        hints.supplierHint = candidate;
        break;
      }
    }
  }

  // --- Payment date hint ---
  // Match patterns: "fecha de pago [DATE]", "pago [DATE]", "vence [DATE]"
  const months: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  };

  // "5 de febrero", "5 febrero", "febrero 5"
  const datePattern1 = /(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)(?:\s+(?:de\s+)?(\d{4}))?/i;
  const datePattern2 = /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2})(?:\s+(?:de\s+)?(\d{4}))?/i;

  const m1 = lower.match(datePattern1);
  if (m1) {
    const day = parseInt(m1[1]);
    const month = months[m1[2].toLowerCase()];
    const year = m1[3] ? parseInt(m1[3]) : new Date().getFullYear();
    if (month !== undefined && day >= 1 && day <= 31) {
      hints.paymentDateHint = new Date(year, month, day);
    }
  } else {
    const m2 = lower.match(datePattern2);
    if (m2) {
      const month = months[m2[1].toLowerCase()];
      const day = parseInt(m2[2]);
      const year = m2[3] ? parseInt(m2[3]) : new Date().getFullYear();
      if (month !== undefined && day >= 1 && day <= 31) {
        hints.paymentDateHint = new Date(year, month, day);
      }
    }
  }

  return hints;
}

// ============================================================================
// Context summary builder
// ============================================================================

function buildContextSummary(results: InvoiceProcessResult[]): string {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  let summary = '';

  if (succeeded.length > 0) {
    summary += `Se procesaron ${succeeded.length} factura(s) exitosamente:\n`;
    for (const r of succeeded) {
      summary += `- ${r.fileName}: ${r.supplierName} por $${r.amount?.toLocaleString('es-MX')} ${r.currency}, vence ${r.dueDate}\n`;
    }
    summary +=
      '\nSe crearon las tarjetas correspondientes en el Kanban de Tesorería con status "Pago Programado".\n';
  }

  if (failed.length > 0) {
    summary += `\n${failed.length} archivo(s) no se pudieron procesar:\n`;
    for (const r of failed) {
      summary += `- ${r.fileName}: ${r.error}\n`;
    }
  }

  return summary;
}
