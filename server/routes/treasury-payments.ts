import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { moveTempToStorage } from '../storage/file-storage';

const router = Router();

// GET /api/treasury/payments - Listar pagos programados
router.get("/api/treasury/payments", jwtAuthMiddleware, async (req, res) => {
  try {
    const { companyId, status } = req.query;
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (companyId) {
      whereClause += ` AND company_id = $${paramIndex}`;
      params.push(parseInt(companyId as string));
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
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

    // Buscar duplicados por nombre de proveedor
    const duplicates = await sql(`
      SELECT id, supplier_name, amount, due_date, created_at
      FROM scheduled_payments
      WHERE LOWER(supplier_name) LIKE LOWER($1)
      ORDER BY created_at DESC
    `, [`%${supplierName}%`]);

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
      supplierId: validatedData.supplierId || null,
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

    // ✅ NUEVO: Crear paymentVoucher con status pago_programado para el Kanban
    const voucherData = {
      companyId: validatedData.payerCompanyId,
      payerCompanyId: validatedData.payerCompanyId,
      clientId: validatedData.supplierId || 0, // Usar supplierId si existe
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

export default router;
