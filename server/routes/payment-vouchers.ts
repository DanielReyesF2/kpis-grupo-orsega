import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { storage } from '../storage';
import { getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { type InsertPaymentVoucher, paymentVouchers, deletedPaymentVouchers, scheduledPayments, paymentApplications, suppliers as suppliersTable } from '@shared/schema';
import { db } from '../db';
import { eq, inArray } from 'drizzle-orm';
import { uploadFile } from '../storage/file-storage';
import { analyzeVoucherBackground } from '../nova/nova-voucher-analyze';

const router = Router();

// Rate limiter for upload endpoints
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 archivos por hora por IP
  message: 'Límite de uploads alcanzado. Por favor, intenta en 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// PAYMENT VOUCHERS API - Sistema Kanban
// ============================================

// Configurar multer para payment vouchers (memoryStorage para R2 upload)
const voucherUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/xml',
      'text/xml',
      'application/xhtml+xml'
    ];
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.xml'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, XML, PNG, JPG, JPEG'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// GET /api/payment-vouchers - Listar comprobantes
router.get("/api/payment-vouchers", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const { companyId: companyIdParam, status } = req.query;
    // Usar companyId del query param, o del usuario autenticado como fallback
    const companyId = companyIdParam
      ? parseInt(companyIdParam as string)
      : (user.companyId as number | undefined);

    let vouchers;
    if (status && companyId) {
      vouchers = await storage.getPaymentVouchersByStatus(status as string, companyId);
    } else if (companyId) {
      vouchers = await storage.getPaymentVouchersByCompany(companyId);
    } else if (status) {
      vouchers = await storage.getPaymentVouchersByStatus(status as string);
    } else {
      vouchers = await storage.getPaymentVouchers();
    }

    res.json(vouchers);
  } catch (error) {
    console.error('Error fetching payment vouchers:', error);
    res.status(500).json({ error: 'Failed to fetch payment vouchers' });
  }
});

// POST /api/scheduled-payments/:id/upload-voucher - Subir comprobante a tarjeta existente
router.post("/api/scheduled-payments/:id/upload-voucher", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
  console.log(`📤 [Upload Voucher] Petición recibida para payment ID: ${req.params.id}`);
  console.log(`📤 [Upload Voucher] Content-Type:`, req.headers['content-type']);

  voucherUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ [Upload Voucher] Multer error:', {
        message: err.message,
        code: (err as any).code,
        field: (err as any).field,
        name: err.name
      });
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const scheduledPaymentId = parseInt(req.params.id);
    const file = req.file;

    console.log(`📤 [Upload Voucher] Procesando archivo para payment ID: ${scheduledPaymentId}`);
    console.log(`📤 [Upload Voucher] Archivo recibido:`, file ? {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    } : 'NINGUNO');

    if (!file) {
      console.error('❌ [Upload Voucher] No se subió ningún archivo');
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    // Obtener el scheduled payment
    const { scheduledPayments } = await import('@shared/schema');

    const [scheduledPayment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, scheduledPaymentId));

    if (!scheduledPayment) {
      console.error(`❌ [Upload Voucher] Payment ID ${scheduledPaymentId} no encontrado`);
      return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
    }

    console.log(`📤 [Upload Voucher] Payment encontrado:`, {
      id: scheduledPayment.id,
      supplierName: scheduledPayment.supplierName,
      amount: scheduledPayment.amount
    });

    // No OCR analysis — Nova 2.0 handles document analysis
    const analysis = {
      documentType: 'unknown' as any,
      extractedAmount: null as number | null,
      extractedDate: null as Date | null,
      extractedBank: null as string | null,
      extractedReference: null as string | null,
      extractedCurrency: null as string | null,
      extractedOriginAccount: null as string | null,
      extractedDestinationAccount: null as string | null,
      extractedTrackingKey: null as string | null,
      extractedBeneficiaryName: null as string | null,
      ocrConfidence: 0,
    };

    // Obtener proveedor/supplier para verificar si requiere REP
    let supplier: any = null;
    if (scheduledPayment.supplierId) {
      const [supplierRow] = await db.select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, scheduledPayment.supplierId));
      supplier = supplierRow || null;
    }
    // Fallback: si no se encuentra el supplier, defaultear a requiresRep=true (más seguro)
    if (!supplier) {
      console.warn(`⚠️ [Upload Voucher] Supplier ID ${scheduledPayment.supplierId} no encontrado en BD, defaulteando requiresRep=true`);
      supplier = {
        id: scheduledPayment.supplierId || 0,
        name: scheduledPayment.supplierName,
        companyId: scheduledPayment.companyId,
        requiresRep: true,
      };
    }

    // Subir archivo a storage (R2 o local)
    console.log(`📤 [Upload Voucher] Subiendo archivo a storage...`);
    const uploadResult = await uploadFile(
      file.buffer,
      'comprobantes',
      file.originalname,
      file.mimetype
    );
    const voucherUrl = uploadResult.url;
    console.log(`✅ [Upload Voucher] Archivo subido a ${uploadResult.storage}: ${voucherUrl}`);

    // Determinar estado del voucher basándose en requiresRep del proveedor PRIMERO
    const requiresREPForStatus = supplier?.requiresRep === true;
    let finalStatus: string;

    if (requiresREPForStatus) {
      // Proveedor requiere REP → SIEMPRE ir a pendiente_complemento
      // independientemente del resultado de OCR o match de monto
      finalStatus = 'pendiente_complemento';
      console.log(`📋 [Upload Voucher] Proveedor ${supplier?.name} requiere REP → pendiente_complemento`);
    } else {
      // Proveedor NO requiere REP → aplicar lógica de OCR/monto
      const criticalFields = ['extractedAmount', 'extractedDate', 'extractedBank', 'extractedReference', 'extractedCurrency'];
      const hasAllCriticalFields = criticalFields.every(field => {
        const value = analysis[field as keyof typeof analysis];
        return value !== null && value !== undefined;
      });

      if (hasAllCriticalFields && analysis.ocrConfidence >= 0.7) {
        finalStatus = 'factura_pagada';
      } else {
        finalStatus = 'pago_programado';
      }

      // Verificar si el monto coincide (con tolerancia del 1%)
      const amountDiff = Math.abs((scheduledPayment.amount - (analysis.extractedAmount || 0)) / scheduledPayment.amount);
      if (amountDiff <= 0.01) {
        finalStatus = 'cierre_contable';
      } else if (analysis.extractedAmount && analysis.extractedAmount < scheduledPayment.amount) {
        finalStatus = 'factura_pagada';
      }

      console.log(`📋 [Upload Voucher] Proveedor ${supplier?.name} NO requiere REP, status → ${finalStatus}`);
    }

    // Crear comprobante vinculado
    console.log(`📝 [Upload Voucher] Preparando datos del voucher...`);
    const newVoucher: InsertPaymentVoucher = {
      companyId: scheduledPayment.companyId,
      payerCompanyId: scheduledPayment.companyId,
      clientId: supplier?.id || scheduledPayment.supplierId || 0,
      clientName: supplier?.name || scheduledPayment.supplierName || 'Proveedor',
      scheduledPaymentId: scheduledPaymentId,
      status: finalStatus as any,
      voucherFileUrl: voucherUrl, // URL de R2 o local
      voucherFileName: file.originalname,
      voucherFileType: file.mimetype,
      extractedAmount: analysis.extractedAmount,
      extractedDate: analysis.extractedDate,
      extractedBank: analysis.extractedBank,
      extractedReference: analysis.extractedReference,
      extractedCurrency: analysis.extractedCurrency,
      extractedOriginAccount: analysis.extractedOriginAccount,
      extractedDestinationAccount: analysis.extractedDestinationAccount,
      extractedTrackingKey: analysis.extractedTrackingKey,
      extractedBeneficiaryName: analysis.extractedBeneficiaryName,
      ocrConfidence: analysis.ocrConfidence,
      uploadedBy: user.id,
    };

    console.log(`📝 [Upload Voucher] Creando voucher en la base de datos...`);
    let voucher;
    try {
      voucher = await storage.createPaymentVoucher(newVoucher);
      console.log(`✅ [Upload Voucher] Voucher creado con ID: ${voucher.id}`);
    } catch (dbError: any) {
      console.error('❌ [Upload Voucher] Error al crear voucher en la BD:', dbError);
      throw new Error(`Error al crear comprobante: ${dbError?.message || 'Error desconocido'}`);
    }

    // Fire-and-forget background analysis via Nova 2.0
    analyzeVoucherBackground({
      voucherId: voucher.id,
      scheduledPaymentId: scheduledPaymentId,
      fileName: file.originalname,
      fileUrl: voucherUrl,
      companyId: scheduledPayment.companyId,
      userId: user.id.toString(),
    });

    // Actualizar scheduled payment con voucherId y estado
    // Usar supplier.requiresRep (del proveedor/supplier, NO del cliente)
    // Si requiere REP → voucher_uploaded (En seguimiento REP)
    // Si NO requiere REP → payment_completed (Pagada)
    const requiresREP = supplier?.requiresRep === true;
    const newStatus = requiresREP ? 'voucher_uploaded' : 'payment_completed';

    await db.update(scheduledPayments)
      .set({
        voucherId: voucher.id,
        status: newStatus,
        totalPaid: scheduledPayment.amount,
        paymentStatus: 'fully_paid',
        paidAt: new Date(),
        paidBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPayments.id, scheduledPaymentId));

    // Crear payment_application para mantener consistencia con pago múltiple
    await db.insert(paymentApplications).values({
      voucherId: voucher.id,
      paymentId: scheduledPaymentId,
      amountApplied: scheduledPayment.amount,
    });

    console.log(`✅ [Upload Voucher] Scheduled payment ${scheduledPaymentId} actualizado: status=${newStatus}, fully_paid`);

    // Obtener el scheduled payment actualizado
    const [updatedPayment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, scheduledPaymentId));

    res.status(201).json({
      voucher,
      scheduledPayment: updatedPayment,
      analysis,
      documentType: analysis.documentType,
      message: 'Comprobante subido y vinculado exitosamente'
    });
  } catch (error: any) {
    console.error('❌ [Upload Voucher] Error completo:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validación fallida',
        details: error.errors
      });
    }

    // Proporcionar mensaje de error más descriptivo
    const errorMessage = error?.message || 'Error al subir comprobante';
    console.error(`❌ [Upload Voucher] Respondiendo con error 500: ${errorMessage}`);

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});


// PUT /api/payment-vouchers/:id/status - Actualizar estado del comprobante (Kanban)
router.put("/api/payment-vouchers/:id/status", jwtAuthMiddleware, async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id);

    // Validar request body - solo valores válidos del enum en la base de datos
    const statusSchema = z.object({
      status: z.enum([
        'pago_programado', // Nuevo status
        'factura_pagada',
        'pendiente_complemento',
        'complemento_recibido',
        'cierre_contable'
      ]),
    });

    const validatedData = statusSchema.parse(req.body);

    // Actualizar usando storage
    const updatedVoucher = await storage.updatePaymentVoucherStatus(voucherId, validatedData.status);

    if (!updatedVoucher) {
      return res.status(404).json({ error: 'Payment voucher not found' });
    }

    res.json(updatedVoucher);
  } catch (error) {
    console.error('Error updating payment voucher status:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validación fallida', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update payment voucher status' });
  }
});

// POST /api/payment-vouchers/:id/pay - Subir comprobante de pago para un voucher (factura)
// Este endpoint recibe el comprobante de pago y actualiza el status según si requiere REP
console.log('✅ [Routes] Registrando endpoint POST /api/payment-vouchers/:id/pay');
router.post("/api/payment-vouchers/:id/pay", jwtAuthMiddleware, (req, res, next) => {
  voucherUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ [Pay] Error de Multer:', err);
      return res.status(400).json({ error: 'Error al procesar archivo', details: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id);
    const user = getAuthUser(req as AuthRequest);
    const file = req.file;

    console.log(`💳 [Pay] Procesando pago para voucher ID: ${voucherId}`);
    console.log(`💳 [Pay] Archivo recibido:`, file ? {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      hasBuffer: !!file.buffer,
      bufferLength: file.buffer?.length
    } : 'null');

    if (!file) {
      return res.status(400).json({ error: 'No se subió ningún archivo de comprobante' });
    }

    if (!file.buffer) {
      console.error('❌ [Pay] Error: file.buffer es undefined');
      return res.status(400).json({ error: 'Error al procesar archivo: buffer vacío' });
    }

    // Obtener el voucher actual
    const existingVoucher = await storage.getPaymentVoucher(voucherId);
    if (!existingVoucher) {
      return res.status(404).json({ error: 'Voucher no encontrado' });
    }

    // Verificar que esté en estado pago_programado o factura_pagada
    if (!['pago_programado', 'factura_pagada'].includes(existingVoucher.status)) {
      return res.status(400).json({
        error: 'El voucher no está en estado de pago programado',
        currentStatus: existingVoucher.status
      });
    }

    // No OCR analysis — Nova 2.0 handles document analysis
    const analysis = {
      extractedAmount: null as number | null,
      extractedDate: null as Date | null,
      extractedBank: null as string | null,
      extractedReference: null as string | null,
      extractedTrackingKey: null as string | null,
      ocrConfidence: 0,
    };

    // Subir archivo a storage (R2 o local)
    const uploadResult = await uploadFile(
      file.buffer,
      'comprobantes',
      file.originalname,
      file.mimetype
    );
    const voucherFileUrl = uploadResult.url;
    console.log(`💳 [Pay] Archivo subido a ${uploadResult.storage}: ${voucherFileUrl}`);

    // Verificar si el proveedor requiere REP
    // Default a true (más seguro: peor caso es ir a pendiente_complemento, no saltarse REP)
    let requiresREP = true;

    // Obtener supplierId desde el scheduled payment vinculado
    let supplierId = null;
    if (existingVoucher.scheduledPaymentId) {
      const [scheduledPayment] = await db.select()
        .from(scheduledPayments)
        .where(eq(scheduledPayments.id, existingVoucher.scheduledPaymentId));
      supplierId = scheduledPayment?.supplierId;
    }

    if (supplierId) {
      const [supplier] = await db.select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, supplierId));

      if (supplier) {
        requiresREP = supplier.requiresRep === true;
        console.log(`💳 [Pay] Supplier ${supplier.name} requiresREP: ${requiresREP}`);
      } else {
        console.warn(`⚠️ [Pay] Supplier ID ${supplierId} no encontrado en BD, defaulteando requiresREP=true`);
      }
    } else {
      console.warn(`⚠️ [Pay] Voucher ${voucherId} sin scheduledPaymentId o supplierId, defaulteando requiresREP=true`);
    }

    // Determinar nuevo status basado en REP
    // Si requiere REP → pendiente_complemento (esperando complemento del proveedor)
    // Si NO requiere REP → cierre_contable (completado)
    const newStatus = requiresREP ? 'pendiente_complemento' : 'cierre_contable';
    console.log(`💳 [Pay] Nuevo status: ${newStatus} (requiresREP: ${requiresREP})`);

    // Actualizar el voucher con los datos del comprobante de pago
    const updatedVoucher = await storage.updatePaymentVoucher(voucherId, {
      status: newStatus as any,
      // Guardar datos del comprobante en campos adicionales si los hay
      extractedAmount: analysis?.extractedAmount || existingVoucher.extractedAmount,
      extractedDate: analysis?.extractedDate || existingVoucher.extractedDate,
      extractedBank: analysis?.extractedBank || existingVoucher.extractedBank,
      extractedReference: analysis?.extractedReference || existingVoucher.extractedReference,
      extractedTrackingKey: analysis?.extractedTrackingKey || existingVoucher.extractedTrackingKey,
      ocrConfidence: analysis?.ocrConfidence || existingVoucher.ocrConfidence,
      notes: `${existingVoucher.notes || ''}\nComprobante de pago subido: ${file.originalname}`.trim(),
    });

    // También actualizar el scheduled payment vinculado si existe
    if (existingVoucher.scheduledPaymentId) {
      const [linkedPayment] = await db.select()
        .from(scheduledPayments)
        .where(eq(scheduledPayments.id, existingVoucher.scheduledPaymentId));

      if (linkedPayment) {
        await db.update(scheduledPayments)
          .set({
            status: requiresREP ? 'voucher_uploaded' : 'payment_completed',
            totalPaid: linkedPayment.amount,
            paymentStatus: 'fully_paid',
            paidAt: new Date(),
            paidBy: user.id,
          })
          .where(eq(scheduledPayments.id, existingVoucher.scheduledPaymentId));

        // Crear payment_application para consistencia
        await db.insert(paymentApplications).values({
          voucherId: voucherId,
          paymentId: existingVoucher.scheduledPaymentId,
          amountApplied: linkedPayment.amount,
        });

        console.log(`💳 [Pay] Scheduled payment ${existingVoucher.scheduledPaymentId}: fully_paid, payment_application creada`);
      }
    }

    // Fire-and-forget background analysis via Nova 2.0
    analyzeVoucherBackground({
      voucherId: voucherId,
      scheduledPaymentId: existingVoucher.scheduledPaymentId || undefined,
      fileName: file.originalname,
      fileUrl: voucherFileUrl,
      companyId: existingVoucher.companyId,
      userId: user.id.toString(),
    });

    console.log(`✅ [Pay] Pago registrado exitosamente. Voucher ${voucherId} actualizado a ${newStatus}`);

    res.json({
      voucher: updatedVoucher,
      requiresREP,
      newStatus,
      message: requiresREP
        ? 'Pago registrado. El proveedor requiere REP, pendiente complemento.'
        : 'Pago completado y cerrado contablemente.'
    });
  } catch (error) {
    console.error('❌ [Pay] Error:', error);
    res.status(500).json({
      error: 'Error al procesar pago',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// POST /api/payment-vouchers/multi-pay - Pago múltiple: un comprobante cubre N facturas
// Crea un voucher + N payment_applications, actualiza total_paid/payment_status de cada factura
router.post("/api/payment-vouchers/multi-pay", jwtAuthMiddleware, (req, res, next) => {
  voucherUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ [Multi-Pay] Error de Multer:', err);
      return res.status(400).json({ error: 'Error al procesar archivo', details: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se subió ningún archivo de comprobante' });
    }

    // Validar body — viene como string en FormData
    const invoicesRaw = req.body.invoices;
    if (!invoicesRaw) {
      return res.status(400).json({ error: 'No se proporcionaron facturas' });
    }

    const invoicesSchema = z.array(z.object({
      paymentId: z.number().int().positive(),
      amountApplied: z.number().positive(),
    })).min(1);

    let invoices: z.infer<typeof invoicesSchema>;
    try {
      invoices = invoicesSchema.parse(JSON.parse(invoicesRaw));
    } catch (parseErr) {
      return res.status(400).json({ error: 'Formato de facturas inválido', details: parseErr });
    }

    console.log(`💳 [Multi-Pay] Procesando pago múltiple: ${invoices.length} facturas`);

    // Obtener todas las facturas para validar
    const paymentIds = invoices.map(i => i.paymentId);

    const payments = await db.select()
      .from(scheduledPayments)
      .where(inArray(scheduledPayments.id, paymentIds));

    if (payments.length !== invoices.length) {
      return res.status(400).json({
        error: `Se encontraron ${payments.length} de ${invoices.length} facturas. Alguna no existe.`
      });
    }

    // Validar que todas son del mismo proveedor y misma moneda
    const supplierIds = new Set(payments.map(p => p.supplierId));
    if (supplierIds.size > 1) {
      return res.status(400).json({ error: 'Todas las facturas deben ser del mismo proveedor' });
    }
    const currencies = new Set(payments.map(p => p.currency));
    if (currencies.size > 1) {
      return res.status(400).json({ error: 'Todas las facturas deben tener la misma moneda' });
    }

    // Validar montos: amount_applied no puede exceder saldo pendiente
    for (const inv of invoices) {
      const payment = payments.find(p => p.id === inv.paymentId)!;
      const remainingBalance = payment.amount - (payment.totalPaid || 0);
      if (inv.amountApplied > remainingBalance + 1) { // tolerancia $1 por redondeo
        return res.status(400).json({
          error: `Monto aplicado ($${inv.amountApplied}) excede saldo pendiente ($${remainingBalance}) de factura ${payment.reference || payment.id}`
        });
      }
    }

    // Obtener supplier para requiresRep
    const supplierId = payments[0].supplierId;
    let requiresREP = true; // default seguro
    if (supplierId) {
      const [supplier] = await db.select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, supplierId));
      if (supplier) {
        requiresREP = supplier.requiresRep === true;
      }
    }

    // Subir archivo
    const uploadResult = await uploadFile(file.buffer, 'comprobantes', file.originalname, file.mimetype);
    console.log(`✅ [Multi-Pay] Archivo subido a ${uploadResult.storage}`);

    // Crear voucher
    const firstPayment = payments[0];
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amountApplied, 0);
    const voucherStatus = requiresREP ? 'pendiente_complemento' : 'cierre_contable';

    const newVoucher: InsertPaymentVoucher = {
      companyId: firstPayment.companyId,
      payerCompanyId: firstPayment.companyId,
      clientId: supplierId || 0,
      clientName: firstPayment.supplierName || 'Proveedor',
      scheduledPaymentId: firstPayment.id, // referencia al primer pago para backwards compat
      status: voucherStatus as any,
      voucherFileUrl: uploadResult.url,
      voucherFileName: file.originalname,
      voucherFileType: file.mimetype,
      extractedAmount: totalAmount,
      extractedCurrency: firstPayment.currency,
      ocrConfidence: 0,
      uploadedBy: user.id,
    };

    const voucher = await storage.createPaymentVoucher(newVoucher);
    console.log(`✅ [Multi-Pay] Voucher creado: ID ${voucher.id}`);

    // Crear payment_applications y actualizar cada factura
    for (const inv of invoices) {
      // Crear payment_application
      await db.insert(paymentApplications).values({
        voucherId: voucher.id,
        paymentId: inv.paymentId,
        amountApplied: inv.amountApplied,
      });

      // Actualizar total_paid y payment_status
      const payment = payments.find(p => p.id === inv.paymentId)!;
      const newTotalPaid = (payment.totalPaid || 0) + inv.amountApplied;
      const isFullyPaid = (payment.amount - newTotalPaid) < 1; // tolerancia $1
      const newPaymentStatus = isFullyPaid ? 'fully_paid' : 'partially_paid';

      // Solo transicionar status del scheduled_payment si está fully_paid
      const spUpdate: any = {
        totalPaid: newTotalPaid,
        paymentStatus: newPaymentStatus,
        updatedAt: new Date(),
      };

      if (isFullyPaid) {
        spUpdate.voucherId = voucher.id;
        spUpdate.status = requiresREP ? 'voucher_uploaded' : 'payment_completed';
        spUpdate.paidAt = new Date();
        spUpdate.paidBy = user.id;
      }

      await db.update(scheduledPayments)
        .set(spUpdate)
        .where(eq(scheduledPayments.id, inv.paymentId));

      console.log(`  📝 [Multi-Pay] Factura ${inv.paymentId}: +$${inv.amountApplied} → total_paid=$${newTotalPaid} (${newPaymentStatus})`);
    }

    // Background analysis
    analyzeVoucherBackground({
      voucherId: voucher.id,
      scheduledPaymentId: firstPayment.id,
      fileName: file.originalname,
      fileUrl: uploadResult.url,
      companyId: firstPayment.companyId,
      userId: user.id.toString(),
    });

    console.log(`✅ [Multi-Pay] Pago múltiple completado: ${invoices.length} facturas, voucher ${voucher.id}`);

    res.status(201).json({
      voucher,
      invoicesProcessed: invoices.length,
      totalAmount,
      requiresREP,
      message: `Pago registrado para ${invoices.length} factura(s). ${requiresREP ? 'Pendiente complemento REP.' : 'Cerrado contablemente.'}`,
    });
  } catch (error) {
    console.error('❌ [Multi-Pay] Error:', error);
    res.status(500).json({
      error: 'Error al procesar pago múltiple',
      details: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

// PUT /api/payment-vouchers/:id - Actualizar comprobante (para agregar factura o complemento)
router.put("/api/payment-vouchers/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id);

    // Validar request body
    const updateSchema = z.object({
      invoiceFileUrl: z.string().optional(),
      invoiceFileName: z.string().optional(),
      invoiceFileType: z.string().optional(),
      complementFileUrl: z.string().optional(),
      complementFileName: z.string().optional(),
      complementFileType: z.string().optional(),
      notes: z.string().optional(),
    });

    const validatedData = updateSchema.parse(req.body);

    // Verificar que hay algo para actualizar
    if (Object.keys(validatedData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Actualizar usando storage
    const updatedVoucher = await storage.updatePaymentVoucher(voucherId, validatedData);

    if (!updatedVoucher) {
      return res.status(404).json({ error: 'Payment voucher not found' });
    }

    res.json(updatedVoucher);
  } catch (error) {
    console.error('Error updating payment voucher:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validación fallida', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update payment voucher' });
  }
});

// DELETE /api/payment-vouchers/:id - Eliminar comprobante con razón (soft delete - se archiva)
router.delete("/api/payment-vouchers/:id", jwtAuthMiddleware, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const voucherId = parseInt(authReq.params.id);
    const userId = authReq.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Validar razón de eliminación
    const deleteSchema = z.object({
      reason: z.string().min(3, 'La razón debe tener al menos 3 caracteres').max(500, 'La razón no puede exceder 500 caracteres'),
    });

    const { reason } = deleteSchema.parse(req.body);

    // Obtener el voucher original antes de eliminar
    const originalVoucher = await db.query.paymentVouchers.findFirst({
      where: eq(paymentVouchers.id, voucherId),
    });

    if (!originalVoucher) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    // Guardar en la tabla de eliminados (soft delete)
    await db.insert(deletedPaymentVouchers).values({
      originalVoucherId: originalVoucher.id,
      companyId: originalVoucher.companyId,
      payerCompanyId: originalVoucher.payerCompanyId,
      clientId: originalVoucher.clientId,
      clientName: originalVoucher.clientName,
      status: originalVoucher.status,
      voucherFileUrl: originalVoucher.voucherFileUrl,
      voucherFileName: originalVoucher.voucherFileName,
      extractedAmount: originalVoucher.extractedAmount,
      extractedCurrency: originalVoucher.extractedCurrency,
      extractedReference: originalVoucher.extractedReference,
      extractedBank: originalVoucher.extractedBank,
      originalCreatedAt: originalVoucher.createdAt,
      deletionReason: reason,
      deletedBy: userId,
      originalData: JSON.stringify(originalVoucher), // Backup completo
    });

    // Eliminar el voucher original
    await db.delete(paymentVouchers).where(eq(paymentVouchers.id, voucherId));

    console.log(`🗑️ [Delete Voucher] Voucher ${voucherId} eliminado por usuario ${userId}. Razón: ${reason}`);

    res.json({
      success: true,
      message: 'Comprobante eliminado y archivado correctamente',
      voucherId
    });
  } catch (error) {
    console.error('Error deleting payment voucher:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validación fallida', details: error.errors });
    }
    res.status(500).json({ error: 'Error al eliminar el comprobante' });
  }
});

// POST /api/payment-vouchers/:id/upload-rep - Subir REP (complemento de pago) y transicionar status
router.post("/api/payment-vouchers/:id/upload-rep", jwtAuthMiddleware, voucherUpload.single('file'), async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó archivo REP' });
    }

    // Verificar que el voucher existe y está en status correcto
    const voucher = await db.query.paymentVouchers.findFirst({
      where: eq(paymentVouchers.id, voucherId),
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    if (voucher.status !== 'pendiente_complemento') {
      return res.status(400).json({
        error: `No se puede subir REP en status "${voucher.status}". Solo aplica para comprobantes en "Esperando REP".`
      });
    }

    // Subir archivo a storage
    console.log(`📤 [Upload REP] Subiendo REP para voucher ${voucherId}...`);
    const uploadResult = await uploadFile(
      file.buffer,
      'complementos',
      file.originalname,
      file.mimetype
    );
    console.log(`✅ [Upload REP] Archivo subido a ${uploadResult.storage}: ${uploadResult.url}`);

    // Actualizar voucher con archivo REP y transicionar status
    const updatedVoucher = await storage.updatePaymentVoucher(voucherId, {
      complementFileUrl: uploadResult.url,
      complementFileName: file.originalname,
      complementFileType: file.mimetype,
      status: 'complemento_recibido',
    });

    console.log(`✅ [Upload REP] Voucher ${voucherId} actualizado: status → complemento_recibido`);

    res.json({
      success: true,
      voucher: updatedVoucher,
      message: 'REP recibido exitosamente',
    });
  } catch (error) {
    console.error('❌ [Upload REP] Error:', error);
    res.status(500).json({ error: 'Error al subir REP' });
  }
});

export default router;
