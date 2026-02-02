/**
 * Nova Voucher Analyze — Background analysis of payment vouchers via Nova 2.0
 *
 * After a voucher file is uploaded via drag-drop, this fires a non-streaming
 * request to Nova 2.0 asking it to extract payment data from the document.
 * Nova 2.0 has direct DB access and updates the voucher record itself.
 */

import { novaAIClient } from './nova-client';

const MAX_CONCURRENT = 5;
let active = 0;

export function analyzeVoucherBackground(opts: {
  voucherId: number;
  scheduledPaymentId?: number;
  fileName: string;
  fileUrl: string;
  companyId: number;
  userId?: string;
}): void {
  if (active >= MAX_CONCURRENT) {
    console.warn('[Nova] Max concurrent voucher analyses reached, skipping');
    return;
  }
  if (!novaAIClient.isConfigured()) {
    console.warn('[Nova] Nova AI not configured, skipping voucher analysis');
    return;
  }

  active++;
  (async () => {
    try {
      const prompt = `Analiza el comprobante de pago (voucher ID: ${opts.voucherId}) que se acaba de subir.
El archivo se llama "${opts.fileName}" y está en: ${opts.fileUrl}
${opts.scheduledPaymentId ? `Está vinculado al pago programado ID: ${opts.scheduledPaymentId}` : ''}
Empresa ID: ${opts.companyId}

Por favor:
1. Extrae los datos del comprobante (monto, fecha, banco, referencia, moneda, beneficiario)
2. Actualiza el registro del voucher ${opts.voucherId} en la base de datos con los datos extraídos
3. Si el monto coincide con el pago programado, actualiza el status apropiadamente`;

      await novaAIClient.chat(prompt, {
        userId: opts.userId,
        companyId: opts.companyId,
        pageContext: 'treasury',
      });

      console.log(`[Nova] Voucher ${opts.voucherId} background analysis completed`);
    } catch (error) {
      console.error(`[Nova] Voucher ${opts.voucherId} analysis error:`,
        error instanceof Error ? error.message : error);
    } finally {
      active--;
    }
  })();
}
