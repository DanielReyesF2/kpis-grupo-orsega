/**
 * Nova Auto-Analyze — Async post-upload analysis
 *
 * Runs novaChat() with a specialized prompt after uploads.
 * Stores results in analysisStore for client polling via GET /api/nova/analysis/:id.
 */

import crypto from 'crypto';
import { novaChat } from './nova-agent';
import { analysisStore } from './nova-routes';

// Max concurrent auto-analysis tasks
const MAX_CONCURRENT_ANALYSES = 10;
let activeAnalyses = 0;

// Max entries in analysisStore
const MAX_ANALYSIS_STORE_SIZE = 1000;

// Max size per analysis result (500KB)
const MAX_RESULT_SIZE = 500 * 1024;

/**
 * Truncate a result object to fit within MAX_RESULT_SIZE.
 */
function truncateResult(result: any): any {
  const json = JSON.stringify(result);
  if (json.length <= MAX_RESULT_SIZE) return result;

  // Truncate the answer field if present
  if (result.answer && typeof result.answer === 'string') {
    const overhead = json.length - result.answer.length;
    const maxAnswerLen = MAX_RESULT_SIZE - overhead - 50;
    return { ...result, answer: result.answer.slice(0, Math.max(100, maxAnswerLen)) + '\n\n[Respuesta truncada por limite de tamaño]' };
  }
  return result;
}

/**
 * Generate a cryptographically secure analysis ID.
 */
function generateAnalysisId(): string {
  return `nova-${crypto.randomUUID()}`;
}

/**
 * Evict oldest entries if store exceeds max size.
 */
function evictIfNeeded(): void {
  if (analysisStore.size >= MAX_ANALYSIS_STORE_SIZE) {
    let oldest: { id: string; ts: number } | null = null;
    for (const [id, entry] of analysisStore) {
      if (!oldest || entry.timestamp < oldest.ts) {
        oldest = { id, ts: entry.timestamp };
      }
    }
    if (oldest) analysisStore.delete(oldest.id);
  }
}

/**
 * Auto-analyze uploaded sales data.
 * Called fire-and-forget after a successful sales Excel upload.
 *
 * @returns { analysisId } — the ID clients use to poll the result
 */
export async function autoAnalyzeSalesUpload(
  parsedData: { summary: string; rowCount: number; companies?: string[] },
  companyId: number | undefined,
  userId: string | undefined
): Promise<{ analysisId: string; error?: string }> {
  // Concurrency guard
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
    console.warn('[Nova] Max concurrent analyses reached, skipping');
    return { analysisId: '', error: 'Demasiados analisis en curso. Intenta de nuevo mas tarde.' };
  }

  const analysisId = generateAnalysisId();

  evictIfNeeded();

  // Store a pending placeholder with userId for ownership
  analysisStore.set(analysisId, {
    result: { status: 'processing', analysisId },
    timestamp: Date.now(),
    userId: userId?.toString(),
  });

  // Run analysis async (non-blocking)
  activeAnalyses++;
  (async () => {
    try {
      // Sanitize summary to limit size and prevent prompt injection markers
      const safeSummary = (parsedData.summary || '').slice(0, 5000);

      const prompt = `Analiza los siguientes datos de ventas que acaban de ser subidos al sistema.

${safeSummary}

Total de registros: ${parsedData.rowCount}
${parsedData.companies ? `Empresas: ${parsedData.companies.join(', ')}` : ''}

Proporciona:
1. Resumen ejecutivo de los datos subidos
2. Anomalias detectadas (cambios >20% vs periodos anteriores si puedes comparar)
3. Top 5 clientes por volumen
4. Tendencias observadas
5. Recomendaciones o alertas

Usa tablas Markdown cuando sea apropiado. Se conciso pero completo.`;

      const result = await novaChat(prompt, {
        userId: userId?.toString(),
        companyId,
        pageContext: 'sales',
      });

      analysisStore.set(analysisId, {
        result: truncateResult({
          status: 'completed',
          analysisId,
          answer: result.answer,
          toolsUsed: result.toolsUsed,
        }),
        timestamp: Date.now(),
        userId: userId?.toString(),
      });

      console.log(`[Nova] Auto-analysis completed: ${analysisId}`);
    } catch (error) {
      console.error(`[Nova] Auto-analysis error for ${analysisId}:`, error instanceof Error ? error.message : error);

      analysisStore.set(analysisId, {
        result: {
          status: 'error',
          analysisId,
          error: 'Error al procesar el analisis automatico',
        },
        timestamp: Date.now(),
        userId: userId?.toString(),
      });
    } finally {
      activeAnalyses--;
    }
  })();

  return { analysisId };
}

/**
 * Auto-analyze an invoice/document after upload.
 * Called fire-and-forget after a successful invoice analysis.
 */
export async function autoAnalyzeInvoice(
  analysisResult: {
    documentType?: string;
    extractedAmount?: number | null;
    extractedSupplierName?: string | null;
    extractedDate?: string | null;
    extractedCurrency?: string | null;
    [key: string]: unknown;
  },
  fileName: string,
  userId: string | undefined
): Promise<{ analysisId: string; error?: string }> {
  // Concurrency guard
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
    console.warn('[Nova] Max concurrent analyses reached, skipping');
    return { analysisId: '', error: 'Demasiados analisis en curso. Intenta de nuevo mas tarde.' };
  }

  const analysisId = generateAnalysisId();

  evictIfNeeded();

  analysisStore.set(analysisId, {
    result: { status: 'processing', analysisId },
    timestamp: Date.now(),
    userId: userId?.toString(),
  });

  activeAnalyses++;
  (async () => {
    try {
      const fields = Object.entries(analysisResult)
        .filter(([_, v]) => v != null)
        .map(([k, v]) => `  ${k}: ${String(v).slice(0, 500)}`)
        .join('\n');

      // Sanitize fileName
      const safeFileName = fileName.slice(0, 200);

      const prompt = `Se acaba de subir el archivo "${safeFileName}" y se extrajeron los siguientes datos:

${fields}

Por favor:
1. Verifica si los datos extraidos son coherentes
2. Si es una factura, compara el monto y proveedor contra el historial
3. Sugiere si hay algo inusual o que requiera atencion
4. Indica que campos podrian estar incompletos

Se conciso.`;

      const result = await novaChat(prompt, {
        userId: userId?.toString(),
        pageContext: 'invoices',
      });

      analysisStore.set(analysisId, {
        result: truncateResult({
          status: 'completed',
          analysisId,
          answer: result.answer,
          toolsUsed: result.toolsUsed,
        }),
        timestamp: Date.now(),
        userId: userId?.toString(),
      });

      console.log(`[Nova] Invoice analysis completed: ${analysisId}`);
    } catch (error) {
      console.error(`[Nova] Invoice analysis error for ${analysisId}:`, error instanceof Error ? error.message : error);

      analysisStore.set(analysisId, {
        result: {
          status: 'error',
          analysisId,
          error: 'Error al procesar el analisis de factura',
        },
        timestamp: Date.now(),
        userId: userId?.toString(),
      });
    } finally {
      activeAnalyses--;
    }
  })();

  return { analysisId };
}
