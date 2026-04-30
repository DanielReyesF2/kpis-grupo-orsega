import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { DOMParser } from '@xmldom/xmldom';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { moveTempToStorage } from '../storage/file-storage';
import { novaAIClient } from '../nova/nova-client';

// Multer config for invoice analysis (memory storage)
const analyzeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'application/xml', 'text/xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado'));
    }
  },
});

const router = Router();

// GET /api/treasury/payments - Listar pagos programados
router.get("/api/treasury/payments", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const { companyId: companyIdParam, status } = req.query;
    // Usar companyId del query param, o del usuario autenticado como fallback
    const companyId = companyIdParam
      ? parseInt(companyIdParam as string)
      : (user.companyId as number | undefined);

    // SEGURIDAD: Siempre filtrar por companyId para aislamiento multi-tenant
    if (!companyId) {
      return res.status(400).json({ error: 'companyId requerido' });
    }

    let whereClause = "WHERE company_id = $1";
    const params: (string | number | null)[] = [companyId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    const result = await sql(`
      SELECT * FROM scheduled_payments
      ${whereClause}
      ORDER BY due_date ASC
    `, params);

    console.log(`📊 [GET /api/treasury/payments] Retornando ${result.length} pagos programados`);
    if (result.length > 0) {
      console.log(`📊 [GET /api/treasury/payments] Ejemplo de pago:`, {
        id: result[0].id,
        supplierName: result[0].supplier_name,
        amount: result[0].amount,
        dueDate: result[0].due_date,
        paymentDate: result[0].payment_date,
        status: result[0].status,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/treasury/payments - Crear pago programado
router.post("/api/treasury/payments", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const data = { ...req.body, createdBy: user.id };

    const result = await sql(`
      INSERT INTO scheduled_payments (
        company_id, supplier_name, amount, currency, due_date,
        status, reference, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      data.companyId,
      data.supplierName,
      data.amount,
      data.currency || 'MXN',
      data.dueDate,
      data.status || 'pending',
      data.reference || null,
      data.notes || null,
      data.createdBy
    ]);

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// GET /api/treasury/payments/payable-by-supplier/:supplierId - Facturas pendientes del mismo proveedor
// Usado por el diálogo de pago múltiple para mostrar qué facturas se pueden incluir
router.get("/api/treasury/payments/payable-by-supplier/:supplierId", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const supplierId = parseInt(req.params.supplierId);
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : (user.companyId as number | undefined);

    if (!supplierId || isNaN(supplierId)) {
      return res.status(400).json({ error: 'supplierId inválido' });
    }

    // SEGURIDAD: Siempre filtrar por companyId
    if (!companyId) {
      return res.status(400).json({ error: 'companyId requerido' });
    }

    const whereClause = `WHERE sp.supplier_id = $1 AND sp.company_id = $2 AND sp.payment_status != 'fully_paid'`;
    const params: (string | number | null)[] = [supplierId, companyId];

    const result = await sql(`
      SELECT sp.id, sp.supplier_name, sp.amount, sp.currency, sp.due_date,
             sp.payment_date, sp.reference, sp.status, sp.total_paid, sp.payment_status,
             (sp.amount - COALESCE(sp.total_paid, 0)) as remaining_balance
      FROM scheduled_payments sp
      ${whereClause}
      ORDER BY sp.due_date ASC
    `, params);

    console.log(`📊 [Payable by Supplier] Supplier ${supplierId}: ${result.length} facturas pendientes`);
    res.json(result);
  } catch (error) {
    console.error('[Payable by Supplier] Error:', error);
    res.status(500).json({ error: 'Error al obtener facturas pendientes' });
  }
});

// DELETE /api/treasury/payments/:id - Eliminar pago programado
router.delete("/api/treasury/payments/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id);

    // Verificar que el pago existe
    const existing = await sql(`SELECT * FROM scheduled_payments WHERE id = $1`, [paymentId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    // Eliminar el pago
    await sql(`DELETE FROM scheduled_payments WHERE id = $1`, [paymentId]);
    console.log(`🗑️ [Treasury] Pago eliminado: ID ${paymentId}`);

    res.json({ success: true, message: 'Pago eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// POST /api/treasury/payments/cleanup-duplicates - Limpiar pagos duplicados
router.post("/api/treasury/payments/cleanup-duplicates", jwtAuthMiddleware, async (req, res) => {
  try {
    const { supplierName } = req.body;

    if (!supplierName) {
      return res.status(400).json({ error: 'supplierName es requerido' });
    }

    // Filter by company to prevent cross-tenant data deletion
    const user = (req as any).user;
    const companyId = user?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    // Buscar duplicados por nombre de proveedor filtrado por empresa
    const duplicates = await sql(`
      SELECT id, supplier_name, amount, due_date, created_at
      FROM scheduled_payments
      WHERE LOWER(supplier_name) LIKE LOWER($1) AND company_id = $2
      ORDER BY created_at DESC
    `, [`%${supplierName}%`, companyId]);

    if (duplicates.length <= 1) {
      return res.json({
        message: 'No se encontraron duplicados',
        count: duplicates.length
      });
    }

    // Mantener el primero (más reciente), eliminar el resto
    const toKeep = duplicates[0];
    const toDelete = duplicates.slice(1);

    for (const payment of toDelete) {
      await sql(`DELETE FROM scheduled_payments WHERE id = $1`, [payment.id]);
      console.log(`🗑️ [Cleanup] Eliminado duplicado: ID ${payment.id} - ${payment.supplier_name}`);
    }

    res.json({
      success: true,
      message: `Eliminados ${toDelete.length} duplicados de "${supplierName}"`,
      kept: toKeep,
      deleted: toDelete.map(p => p.id)
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    res.status(500).json({ error: 'Failed to cleanup duplicates' });
  }
});

// POST /api/treasury/payments/repair-voucher-links - Reparar vínculos entre vouchers y payments
router.post("/api/treasury/payments/repair-voucher-links", jwtAuthMiddleware, async (req, res) => {
  try {
    const { db } = await import('../db');
    const { paymentVouchers, scheduledPayments } = await import('../../shared/schema');
    const { eq, isNotNull, isNull } = await import('drizzle-orm');

    // 1. Encontrar todos los vouchers que tienen scheduledPaymentId
    const vouchersWithPayments = await db.select()
      .from(paymentVouchers)
      .where(isNotNull(paymentVouchers.scheduledPaymentId));

    console.log(`🔧 [Repair] Encontrados ${vouchersWithPayments.length} vouchers con scheduledPaymentId`);

    let repaired = 0;
    let alreadyLinked = 0;
    const errors: string[] = [];

    for (const voucher of vouchersWithPayments) {
      if (!voucher.scheduledPaymentId) continue;

      // Verificar si el scheduled_payment ya tiene voucherId
      const [payment] = await db.select()
        .from(scheduledPayments)
        .where(eq(scheduledPayments.id, voucher.scheduledPaymentId));

      if (!payment) {
        errors.push(`Payment ${voucher.scheduledPaymentId} no encontrado para voucher ${voucher.id}`);
        continue;
      }

      if (payment.voucherId === voucher.id) {
        alreadyLinked++;
        continue;
      }

      // Actualizar el scheduled_payment con el voucherId
      await db.update(scheduledPayments)
        .set({
          voucherId: voucher.id,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPayments.id, voucher.scheduledPaymentId));

      console.log(`✅ [Repair] Vinculado voucher ${voucher.id} → payment ${voucher.scheduledPaymentId}`);
      repaired++;
    }

    res.json({
      success: true,
      message: `Reparación completada`,
      stats: {
        totalVouchers: vouchersWithPayments.length,
        repaired,
        alreadyLinked,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error repairing voucher links:', error);
    res.status(500).json({ error: 'Failed to repair voucher links' });
  }
});

// POST /api/scheduled-payments/confirm - Confirmar creación de cuenta por pagar con fecha de pago
router.post("/api/scheduled-payments/confirm", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);

    // Validar datos recibidos
    const confirmSchema = z.object({
      payerCompanyId: z.number().int().positive(),
      supplierId: z.number().int().positive().nullable().optional(),
      supplierName: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().default('MXN'),
      dueDate: z.string().or(z.date()), // Fecha de vencimiento
      paymentDate: z.string().or(z.date()), // Fecha de pago (OBLIGATORIA)
      reference: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      invoiceFilePath: z.string(), // Ruta del archivo temporal
      invoiceFileName: z.string(), // Nombre original del archivo
      extractedInvoiceNumber: z.string().nullable().optional(),
      extractedTaxId: z.string().nullable().optional(),
    });

    const validatedData = confirmSchema.parse(req.body);

    // Validar que paymentDate esté presente
    if (!validatedData.paymentDate) {
      return res.status(400).json({
        error: 'Fecha de pago requerida',
        details: 'La fecha de pago es obligatoria para confirmar la cuenta por pagar'
      });
    }

    // Parsear fechas
    const dueDate = validatedData.dueDate instanceof Date
      ? validatedData.dueDate
      : new Date(validatedData.dueDate);

    const paymentDate = validatedData.paymentDate instanceof Date
      ? validatedData.paymentDate
      : new Date(validatedData.paymentDate);

    // Crear cuenta por pagar usando storage
    const scheduledPaymentData = {
      companyId: validatedData.payerCompanyId,
      supplierId: validatedData.supplierId || null, // Se resolverá abajo para el voucher
      supplierName: validatedData.supplierName,
      amount: validatedData.amount,
      currency: validatedData.currency || 'MXN',
      dueDate: dueDate,
      paymentDate: paymentDate, // ✅ Fecha de pago obligatoria
      reference: validatedData.reference || validatedData.extractedInvoiceNumber || `Factura ${Date.now()}`,
      status: 'idrall_imported',
      sourceType: 'manual',
      notes: validatedData.notes || `Factura confirmada desde ${validatedData.invoiceFileName}. ${validatedData.extractedTaxId ? `RFC: ${validatedData.extractedTaxId}` : ''}`,
      createdBy: user.id,
    };

    const createdScheduledPayment = await storage.createScheduledPayment(scheduledPaymentData);
    console.log(`✅ [Confirm Invoice] Cuenta por pagar creada: ID ${createdScheduledPayment.id}`);

    // Mover archivo de temp a storage permanente (R2 o local)
    const fsModule = await import('fs');
    let invoiceFileUrl = '';

    if (fsModule.existsSync(validatedData.invoiceFilePath)) {
      // Detectar MIME type basado en extensión
      const ext = validatedData.invoiceFileName.toLowerCase().split('.').pop();
      const mimeTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'xml': 'application/xml'
      };
      const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';

      const uploadResult = await moveTempToStorage(
        validatedData.invoiceFilePath,
        'facturas',
        validatedData.invoiceFileName,
        mimeType
      );
      invoiceFileUrl = uploadResult.url;
      console.log(`✅ [Confirm Invoice] Archivo subido a ${uploadResult.storage}: ${invoiceFileUrl}`);
    } else {
      console.warn(`⚠️ [Confirm Invoice] Archivo temporal no encontrado: ${validatedData.invoiceFilePath}`);
    }

    // Actualizar el scheduled payment con la URL del archivo
    const { db } = await import('../db');
    const { scheduledPayments } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(scheduledPayments)
      .set({
        hydralFileUrl: invoiceFileUrl,
        hydralFileName: validatedData.invoiceFileName,
      })
      .where(eq(scheduledPayments.id, createdScheduledPayment.id));

    // Obtener el scheduled payment actualizado
    const [updatedPayment] = await db.select()
      .from(scheduledPayments)
      .where(eq(scheduledPayments.id, createdScheduledPayment.id));

    console.log(`✅ [Confirm Invoice] Cuenta por pagar confirmada y archivo movido: ID ${createdScheduledPayment.id}`);
    console.log(`✅ [Confirm Invoice] Datos del pago creado:`, {
      id: updatedPayment.id,
      supplierName: updatedPayment.supplierName,
      amount: updatedPayment.amount,
      dueDate: updatedPayment.dueDate,
      paymentDate: updatedPayment.paymentDate,
      status: updatedPayment.status,
      companyId: updatedPayment.companyId,
    });

    // Resolver supplierId: si no viene, buscar por nombre en suppliers
    let resolvedSupplierId = validatedData.supplierId || null;
    if (!resolvedSupplierId && validatedData.supplierName) {
      const matchResult = await sql(`
        SELECT id FROM suppliers
        WHERE company_id = $1
          AND (LOWER(TRIM(name)) = LOWER(TRIM($2)) OR LOWER(TRIM(short_name)) = LOWER(TRIM($2)) OR LOWER(TRIM(razon_social)) = LOWER(TRIM($2)))
        LIMIT 1
      `, [validatedData.payerCompanyId, validatedData.supplierName]);
      if (matchResult.length > 0) {
        resolvedSupplierId = matchResult[0].id;
        console.log(`🔗 [Confirm Invoice] Auto-resolved supplier "${validatedData.supplierName}" → ID ${resolvedSupplierId}`);
      } else {
        console.warn(`⚠️ [Confirm Invoice] No se encontró supplier para "${validatedData.supplierName}" en company ${validatedData.payerCompanyId}`);
      }
    }

    // Crear paymentVoucher con status pago_programado para el Kanban
    const voucherData = {
      companyId: validatedData.payerCompanyId,
      payerCompanyId: validatedData.payerCompanyId,
      clientId: resolvedSupplierId || 0,
      clientName: validatedData.supplierName,
      scheduledPaymentId: createdScheduledPayment.id,
      status: 'pago_programado' as const, // ✅ Nuevo status para Kanban
      voucherFileUrl: invoiceFileUrl,
      voucherFileName: validatedData.invoiceFileName,
      voucherFileType: validatedData.invoiceFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      extractedAmount: validatedData.amount,
      extractedDate: dueDate,
      extractedBank: null,
      extractedReference: validatedData.reference || validatedData.extractedInvoiceNumber || null,
      extractedCurrency: validatedData.currency || 'MXN',
      extractedOriginAccount: null,
      extractedDestinationAccount: null,
      extractedTrackingKey: null,
      extractedBeneficiaryName: null,
      ocrConfidence: 0.9, // Alta confianza porque ya fue verificado
      uploadedBy: user.id,
    };

    const createdVoucher = await storage.createPaymentVoucher(voucherData);
    console.log(`✅ [Confirm Invoice] PaymentVoucher creado para Kanban: ID ${createdVoucher.id}, status: pago_programado`);

    res.status(201).json({
      scheduledPayment: updatedPayment,
      paymentVoucher: createdVoucher,
      message: 'Cuenta por pagar creada exitosamente con fecha de pago'
    });
  } catch (error) {
    console.error('❌ [Confirm Invoice] Error confirmando cuenta por pagar:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validación fallida',
        details: error.errors
      });
    }
    res.status(500).json({
      error: 'Error al confirmar cuenta por pagar',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// PUT /api/treasury/payments/:id/pay - Marcar pago como pagado
router.put("/api/treasury/payments/:id/pay", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const paymentId = parseInt(req.params.id);

    const result = await sql(`
      UPDATE scheduled_payments
      SET status = 'paid', paid_at = NOW(), paid_by = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [user.id, paymentId]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
  }
});

// GET /api/scheduled-payments/:id/documents - Obtener repertorio de documentos y detalles del pago
router.get("/api/scheduled-payments/:id/documents", jwtAuthMiddleware, async (req, res) => {
  try {
    const scheduledPaymentId = parseInt(req.params.id);

    // Obtener scheduled payment
    const { db } = await import('../db');
    const { scheduledPayments, paymentVouchers } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');

    const [payment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, scheduledPaymentId));

    if (!payment) {
      return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
    }

    const documents: any[] = [];

    // 1. Factura (hydralFileUrl)
    if (payment.hydralFileUrl && payment.hydralFileName) {
      documents.push({
        type: 'invoice',
        name: payment.hydralFileName,
        url: payment.hydralFileUrl,
        uploadedAt: payment.createdAt,
      });
    }

    // 2. Comprobante (voucherId -> payment_voucher)
    if (payment.voucherId) {
      const [voucher] = await db.select().from(paymentVouchers).where(eq(paymentVouchers.id, payment.voucherId));
      if (voucher) {
        documents.push({
          type: 'voucher',
          name: voucher.voucherFileName,
          url: voucher.voucherFileUrl,
          uploadedAt: voucher.createdAt,
          extractedAmount: voucher.extractedAmount,
          extractedDate: voucher.extractedDate,
          extractedBank: voucher.extractedBank,
          extractedReference: voucher.extractedReference,
        });

        // 3. REP (complementFileUrl del voucher)
        if (voucher.complementFileUrl && voucher.complementFileName) {
          documents.push({
            type: 'rep',
            name: voucher.complementFileName,
            url: voucher.complementFileUrl,
            uploadedAt: voucher.updatedAt,
          });
        }
      }
    }

    // Incluir detalles del pago en la respuesta
    res.json({
      scheduledPaymentId,
      payment: {
        id: payment.id,
        supplierName: payment.supplierName,
        amount: payment.amount,
        currency: payment.currency,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        status: payment.status,
        reference: payment.reference,
        notes: payment.notes,
        sourceType: payment.sourceType,
        createdAt: payment.createdAt,
      },
      documents,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// PUT /api/scheduled-payments/:id/status - Actualizar estado (para drag & drop)
router.put("/api/scheduled-payments/:id/status", jwtAuthMiddleware, async (req, res) => {
  try {
    const scheduledPaymentId = parseInt(req.params.id);

    const statusSchema = z.object({
      status: z.enum([
        'idrall_imported',
        'pending_approval',
        'approved',
        'payment_scheduled',
        'payment_pending',
        'payment_completed',
        'voucher_uploaded',
        'closed'
      ]),
    });

    const validatedData = statusSchema.parse(req.body);

    // Actualizar usando Drizzle
    const { db } = await import('../db');
    const { scheduledPayments } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');

    const [updated] = await db.update(scheduledPayments)
      .set({
        status: validatedData.status,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPayments.id, scheduledPaymentId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating scheduled payment status:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validación fallida', details: error.errors });
    }
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// Helper: Call Nova AI to extract invoice data from a file (PDF or image)
async function callNovaForExtraction(file: Express.Multer.File): Promise<{
  amount: number | null;
  currency: string;
  dueDate: string | null;
  invoiceNumber: string | null;
  taxId: string | null;
  issuerName: string | null;
} | null> {
  const prompt = `Analiza esta factura/documento y extrae los siguientes datos en formato JSON:
{
  "amount": (número, monto total sin IVA),
  "currency": "MXN" o "USD",
  "dueDate": "YYYY-MM-DD" (fecha de vencimiento si existe),
  "invoiceNumber": "folio o número de factura",
  "taxId": "RFC del emisor",
  "issuerName": "nombre del emisor/proveedor"
}
Solo responde con el JSON, sin explicaciones.`;

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
      [{ buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype }],
      { pageContext: 'treasury' },
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

  const jsonBlock = extractBalancedJson(result);
  if (!jsonBlock) return null;
  try {
    const parsed = JSON.parse(jsonBlock);
    return {
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      currency: parsed.currency || 'MXN',
      dueDate: parsed.dueDate || null,
      invoiceNumber: parsed.invoiceNumber || null,
      taxId: parsed.taxId || null,
      issuerName: parsed.issuerName || null,
    };
  } catch (parseError) {
    console.error('[Treasury] Failed to parse Nova AI JSON response:', parseError);
  }
  return null;
}

/**
 * Extrae el primer bloque JSON balanceado (respeta llaves anidadas).
 * Un regex greedy captura basura extra; un lazy corta en sub-objetos.
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

// POST /api/treasury/analyze-invoice - Analizar factura y extraer datos
router.post("/api/treasury/analyze-invoice", jwtAuthMiddleware, analyzeUpload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    console.log(`[Treasury] Analizando factura: ${file.originalname} (${file.mimetype})`);

    // Default empty response
    let extractedData = {
      amount: null as number | null,
      currency: 'MXN' as string,
      dueDate: null as string | null,
      invoiceNumber: null as string | null,
      taxId: null as string | null,
      issuerName: null as string | null,
    };
    let extractionMethod: 'cfdi' | 'nova' | 'none' = 'none';
    let extractionError: string | null = null;

    // For XML files (CFDI), parse directly
    if (file.mimetype === 'application/xml' || file.mimetype === 'text/xml') {
      try {
        const xmlContent = file.buffer.toString('utf-8');
        extractedData = parseCFDI(xmlContent);
        extractionMethod = 'cfdi';
        console.log(`[Treasury] CFDI XML parsed:`, extractedData);
      } catch (parseError) {
        console.error('[Treasury] Error parsing CFDI XML:', parseError);
        extractionError = 'Error al parsear CFDI XML';
      }
    }
    // For PDFs: first try to extract embedded CFDI XML, then fallback to Nova AI
    else if (file.mimetype === 'application/pdf') {
      let cfdiExtracted = false;

      // Step 1: Try deterministic extraction of CFDI XML from PDF
      try {
        console.log('[Treasury] Attempting CFDI extraction from PDF...');
        const pdfData = await pdfParse(file.buffer);
        const pdfText = pdfData.text || '';

        // Also check raw buffer for XML signatures (some PDFs embed XML as attachments)
        const rawText = file.buffer.toString('latin1');
        const textToSearch = pdfText.length > rawText.length ? pdfText : rawText;

        // Look for CFDI XML signature
        const cfdiStart = textToSearch.match(/<(?:cfdi:)?Comprobante[\s>]/);
        if (cfdiStart && cfdiStart.index !== undefined) {
          // Extract from <Comprobante ...> to </Comprobante>
          const startIdx = cfdiStart.index;
          const endPattern = /<\/(?:cfdi:)?Comprobante>/;
          const endMatch = textToSearch.substring(startIdx).match(endPattern);

          if (endMatch && endMatch.index !== undefined) {
            const xmlBlock = textToSearch.substring(startIdx, startIdx + endMatch.index + endMatch[0].length);
            const cfdiData = parseCFDI(xmlBlock);

            // Only use if we got at least amount or invoice number
            if (cfdiData.amount || cfdiData.invoiceNumber) {
              extractedData = cfdiData;
              cfdiExtracted = true;
              extractionMethod = 'cfdi';
              console.log(`[Treasury] CFDI extracted from PDF (deterministic):`, extractedData);
            }
          }
        }

        if (!cfdiExtracted) {
          console.log('[Treasury] No CFDI XML found in PDF text/buffer');
        }
      } catch (pdfError) {
        console.error('[Treasury] pdf-parse failed, will try Nova AI:', pdfError);
      }

      // Step 2: If no CFDI extracted, try Nova AI
      if (!cfdiExtracted && novaAIClient.isConfigured()) {
        try {
          console.log('[Treasury] Using Nova AI for PDF analysis...');
          const result = await callNovaForExtraction(file);
          if (result) {
            extractedData = result;
            extractionMethod = 'nova';
            console.log(`[Treasury] Nova AI extracted from PDF:`, extractedData);
          } else {
            extractionError = 'Nova AI no pudo extraer datos del documento';
          }
        } catch (novaError) {
          const msg = novaError instanceof Error ? novaError.message : 'Error desconocido';
          console.error('[Treasury] Nova AI PDF analysis failed:', msg);
          extractionError = `Nova AI falló: ${msg}`;
        }
      } else if (!cfdiExtracted) {
        console.log('[Treasury] No CFDI in PDF and Nova AI not configured');
        extractionError = 'Nova AI no está configurado';
      }
    }
    // For images (PNG, JPG): only Nova AI can help
    else if (novaAIClient.isConfigured()) {
      try {
        console.log('[Treasury] Using Nova AI for image analysis...');
        const result = await callNovaForExtraction(file);
        if (result) {
          extractedData = result;
          extractionMethod = 'nova';
          console.log(`[Treasury] Nova AI extracted from image:`, extractedData);
        } else {
          extractionError = 'Nova AI no pudo extraer datos de la imagen';
        }
      } catch (novaError) {
        const msg = novaError instanceof Error ? novaError.message : 'Error desconocido';
        console.error('[Treasury] Nova AI image analysis failed:', msg);
        extractionError = `Nova AI falló: ${msg}`;
      }
    } else {
      console.log('[Treasury] Image file and Nova AI not configured, returning empty data');
      extractionError = 'Nova AI no está configurado';
    }

    res.json({
      success: true,
      extracted: extractedData,
      extractionMethod,
      extractionError,
      fileName: file.originalname,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('[Treasury] Error analyzing invoice:', error);
    res.status(500).json({ error: 'Error al analizar factura' });
  }
});

// Helper: Parse Mexican CFDI XML using a real DOM parser (not regex)
function parseCFDI(xmlContent: string): {
  amount: number | null;
  currency: string;
  dueDate: string | null;
  invoiceNumber: string | null;
  taxId: string | null;
  issuerName: string | null;
} {
  const result = {
    amount: null as number | null,
    currency: 'MXN',
    dueDate: null as string | null,
    invoiceNumber: null as string | null,
    taxId: null as string | null,
    issuerName: null as string | null,
  };

  const doc = new DOMParser({
    onError: () => {},  // Silence warnings/errors — we validate fields after parsing
  }).parseFromString(xmlContent, 'text/xml');
  if (!doc || !doc.documentElement) return result;

  const root = doc.documentElement;

  // Total / SubTotal — root element attributes
  const totalStr = root.getAttribute('Total') || root.getAttribute('total');
  if (totalStr) {
    result.amount = parseFloat(totalStr);
  }
  if (!result.amount || isNaN(result.amount)) {
    const subStr = root.getAttribute('SubTotal') || root.getAttribute('subTotal');
    if (subStr) result.amount = parseFloat(subStr);
  }
  if (result.amount && isNaN(result.amount)) result.amount = null;

  // Currency (Moneda)
  const moneda = root.getAttribute('Moneda') || root.getAttribute('moneda');
  if (moneda) result.currency = moneda;

  // Folio + Serie → invoiceNumber
  const folio = root.getAttribute('Folio') || root.getAttribute('folio');
  const serie = root.getAttribute('Serie') || root.getAttribute('serie');
  if (serie && folio) {
    result.invoiceNumber = `${serie}-${folio}`;
  } else if (folio) {
    result.invoiceNumber = folio;
  } else if (serie) {
    result.invoiceNumber = serie;
  }

  // Emisor — handles any namespace (cfdi:Emisor, tfd:Emisor, plain Emisor)
  const emisor = root.getElementsByTagNameNS('*', 'Emisor')[0]
    || doc.getElementsByTagName('Emisor')[0];
  if (emisor) {
    const rfc = emisor.getAttribute('Rfc') || emisor.getAttribute('rfc');
    if (rfc) result.taxId = rfc;
    const nombre = emisor.getAttribute('Nombre') || emisor.getAttribute('nombre');
    if (nombre) result.issuerName = nombre;
  }

  // Fecha → base date for due date calculation
  const fecha = root.getAttribute('Fecha') || root.getAttribute('fecha');
  if (fecha) {
    const dateStr = fecha.split('T')[0];
    result.dueDate = dateStr;
  }

  // CondicionesDePago → "30 días" → calculate actual due date
  const condiciones = root.getAttribute('CondicionesDePago') || root.getAttribute('condicionesDePago');
  if (condiciones && fecha) {
    const diasMatch = condiciones.match(/(\d+)\s*d[ií]as?/i);
    if (diasMatch) {
      const baseDate = new Date(fecha);
      if (!isNaN(baseDate.getTime())) {
        baseDate.setDate(baseDate.getDate() + parseInt(diasMatch[1]));
        result.dueDate = baseDate.toISOString().split('T')[0];
      }
    }
  }

  return result;
}

// GET /api/treasury/pending-rep-reminders - Vouchers pendientes de REP para N8N
// Auth: x-n8n-token header (mismo token que otros endpoints N8N)
router.get("/api/treasury/pending-rep-reminders", async (req, res) => {
  const n8nToken = req.headers['x-n8n-token'];
  const expectedToken = process.env.N8N_WEBHOOK_TOKEN;
  if (!expectedToken || n8nToken !== expectedToken) {
    return res.status(401).json({ error: 'Token N8N inválido' });
  }
  try {
    const minDays = parseInt(req.query.minDays as string) || 3;
    const companyIdParam = req.query.companyId as string | undefined;

    // Query vouchers en pendiente_complemento con más de minDays días
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minDays);

    let query = `
      SELECT
        pv.id as voucher_id,
        pv.client_name,
        pv.extracted_amount,
        pv.extracted_currency,
        pv.updated_at as status_changed_at,
        pv.company_id,
        c.email as client_email,
        c.name as client_name_full,
        EXTRACT(DAY FROM NOW() - pv.updated_at)::int as days_pending
      FROM payment_vouchers pv
      LEFT JOIN clients c ON c.id = pv.client_id
      WHERE pv.status = 'pendiente_complemento'
        AND pv.updated_at <= $1
    `;
    const params: any[] = [cutoffDate];
    let paramIndex = 2;

    if (companyIdParam) {
      query += ` AND pv.company_id = $${paramIndex}`;
      params.push(parseInt(companyIdParam));
      paramIndex++;
    }

    // Excluir los que ya recibieron recordatorio hoy
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    query += `
      AND NOT EXISTS (
        SELECT 1 FROM email_outbox eo
        WHERE eo.voucher_id = pv.id
          AND eo.created_at >= $${paramIndex}
          AND (eo.subject ILIKE '%recordatorio%' OR eo.subject ILIKE '%complemento%')
      )
    `;
    params.push(todayStart);

    query += ` ORDER BY pv.updated_at ASC`;

    const results = await sql(query, params);

    // Enriquecer con tier de recordatorio
    const REMINDER_TIERS = [
      { minDays: 14, label: '3er recordatorio (urgente)', tier: 3 },
      { minDays: 7, label: '2do recordatorio', tier: 2 },
      { minDays: 3, label: '1er recordatorio', tier: 1 },
    ];

    const reminders = results
      .filter((r: any) => r.client_email) // Solo los que tienen email
      .map((r: any) => {
        const daysPending = r.days_pending || 0;
        const reminderTier = REMINDER_TIERS.find(t => daysPending >= t.minDays) || REMINDER_TIERS[2];

        return {
          voucherId: r.voucher_id,
          clientName: r.client_name_full || r.client_name,
          clientEmail: r.client_email,
          amount: r.extracted_amount,
          currency: r.extracted_currency || 'MXN',
          daysPending,
          statusChangedAt: r.status_changed_at,
          reminderTier: reminderTier.tier,
          reminderLabel: reminderTier.label,
          companyId: r.company_id,
        };
      });

    console.log(`[Treasury] Pending REP reminders: ${reminders.length} (de ${results.length} vouchers pendientes)`);
    res.json(reminders);
  } catch (error) {
    console.error('[Treasury] Error fetching pending REP reminders:', error);
    res.status(500).json({ error: 'Error al obtener recordatorios pendientes' });
  }
});

// POST /api/treasury/rep-reminder-sent - N8N confirma que envió el recordatorio
// Auth: x-n8n-token header (mismo token que otros endpoints N8N)
router.post("/api/treasury/rep-reminder-sent", async (req, res) => {
  const n8nToken = req.headers['x-n8n-token'];
  const expectedToken = process.env.N8N_WEBHOOK_TOKEN;
  if (!expectedToken || n8nToken !== expectedToken) {
    return res.status(401).json({ error: 'Token N8N inválido' });
  }
  try {
    const bodySchema = z.object({
      voucherId: z.number(),
      emailTo: z.string().email(),
      reminderTier: z.number().min(1).max(3),
      success: z.boolean(),
      messageId: z.string().optional(),
    });

    const data = bodySchema.parse(req.body);

    await sql(`
      INSERT INTO email_outbox (voucher_id, email_to, email_cc, subject, html_content, status, message_id, sent_at)
      VALUES ($1, $2, '{}', $3, $4, $5, $6, $7)
    `, [
      data.voucherId,
      `{${data.emailTo}}`,
      `Recordatorio #${data.reminderTier} — Complemento de Pago Pendiente`,
      `Recordatorio automático #${data.reminderTier} enviado via N8N. Resultado: ${data.success ? 'enviado' : 'fallido'}`,
      data.success ? 'sent' : 'failed',
      data.messageId || null,
      data.success ? new Date() : null,
    ]);

    console.log(`[Treasury] REP reminder logged: voucher ${data.voucherId} → ${data.emailTo} (tier ${data.reminderTier})`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Treasury] Error logging REP reminder:', error);
    res.status(500).json({ error: 'Error al registrar recordatorio' });
  }
});

export default router;
