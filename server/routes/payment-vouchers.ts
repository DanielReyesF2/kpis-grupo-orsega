import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { storage } from '../storage';
import { getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { type InsertPaymentVoucher, paymentVouchers, deletedPaymentVouchers } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { uploadFile } from '../storage/file-storage';

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
    const { companyId, status } = req.query;

    let vouchers;
    if (status && companyId) {
      vouchers = await storage.getPaymentVouchersByStatus(status as string, parseInt(companyId as string));
    } else if (companyId) {
      vouchers = await storage.getPaymentVouchersByCompany(parseInt(companyId as string));
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

    // Obtener cliente/proveedor
    let client = null;
    if (scheduledPayment.supplierId) {
      client = await storage.getClient(scheduledPayment.supplierId);
    }
    if (!client && scheduledPayment.supplierName) {
      client = {
        id: scheduledPayment.supplierId || 0,
        name: scheduledPayment.supplierName,
        companyId: scheduledPayment.companyId,
        email: null,
        requiresPaymentComplement: false,
      } as any;
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

    // Determinar estado inicial
    const criticalFields = ['extractedAmount', 'extractedDate', 'extractedBank', 'extractedReference', 'extractedCurrency'];
    const hasAllCriticalFields = criticalFields.every(field => {
      const value = analysis[field as keyof typeof analysis];
      return value !== null && value !== undefined;
    });

    let initialStatus: string;
    if (hasAllCriticalFields && analysis.ocrConfidence >= 0.7) {
      // Datos completos y confiables -> factura pagada
      initialStatus = 'factura_pagada';
    } else {
      // Datos incompletos -> pendiente complemento para validar
      initialStatus = 'pendiente_complemento';
    }

    // Verificar si el monto coincide (con tolerancia del 1%)
    const amountDiff = Math.abs((scheduledPayment.amount - (analysis.extractedAmount || 0)) / scheduledPayment.amount);
    let finalStatus = initialStatus;
    if (amountDiff <= 0.01) {
      // Monto coincide -> cerrar contablemente
      finalStatus = 'cierre_contable';
    } else if (analysis.extractedAmount && analysis.extractedAmount < scheduledPayment.amount) {
      // Monto menor -> pendiente complemento
      finalStatus = 'pendiente_complemento';
    }

    // Crear comprobante vinculado
    console.log(`📝 [Upload Voucher] Preparando datos del voucher...`);
    const newVoucher: InsertPaymentVoucher = {
      companyId: scheduledPayment.companyId,
      payerCompanyId: scheduledPayment.companyId,
      clientId: client?.id || scheduledPayment.supplierId || 0,
      clientName: client?.name || scheduledPayment.supplierName || 'Cliente',
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

    // Actualizar scheduled payment con voucherId y estado
    // SIEMPRE cambiar el estado basado en si el cliente requiere REP
    // Si requiere REP → voucher_uploaded (En seguimiento REP)
    // Si NO requiere REP → payment_completed (Pagada)
    const requiresREP = client?.requiresPaymentComplement === true;
    const newStatus = requiresREP ? 'voucher_uploaded' : 'payment_completed';

    await db.update(scheduledPayments)
      .set({
        voucherId: voucher.id,
        status: newStatus,
        paidAt: new Date(), // Siempre actualizar cuando se sube comprobante
        paidBy: user.id, // Siempre actualizar cuando se sube comprobante
        updatedAt: new Date(),
      })
      .where(eq(scheduledPayments.id, scheduledPaymentId));

    console.log(`✅ [Upload Voucher] Scheduled payment ${scheduledPaymentId} actualizado: status=${newStatus} (requiere REP: ${requiresREP})`);

    console.log(`✅ [Upload Voucher] Comprobante vinculado a cuenta por pagar ${scheduledPaymentId}, voucher ID: ${voucher.id}`);

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
    const fileBuffer = file.buffer;
    const analysis = {
      extractedAmount: null as number | null,
      extractedDate: null as Date | null,
      extractedBank: null as string | null,
      extractedReference: null as string | null,
      extractedTrackingKey: null as string | null,
      ocrConfidence: 0,
    };

    // Guardar el comprobante en la ubicación final
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const voucherDir = path.join(process.cwd(), 'uploads', 'comprobantes', String(year), month);

    if (!fs.existsSync(voucherDir)) {
      fs.mkdirSync(voucherDir, { recursive: true });
    }

    const voucherFileName = `${Date.now()}-pago-${file.originalname}`;
    const finalPath = path.join(voucherDir, voucherFileName);
    // Escribir el buffer al archivo (memoryStorage no tiene file.path)
    fs.writeFileSync(finalPath, fileBuffer);

    // Verificar si el proveedor requiere REP
    // Buscar el supplier/client para verificar requiresPaymentComplement
    const { suppliers, scheduledPayments } = await import('@shared/schema');

    let requiresREP = false;

    // Primero intentar obtener el supplierId desde el scheduled payment
    let supplierId = null;
    if (existingVoucher.scheduledPaymentId) {
      const [scheduledPayment] = await db.select()
        .from(scheduledPayments)
        .where(eq(scheduledPayments.id, existingVoucher.scheduledPaymentId));
      supplierId = scheduledPayment?.supplierId;
    }

    if (supplierId) {
      const [supplier] = await db.select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId));

      requiresREP = supplier?.requiresRep === true;
      console.log(`💳 [Pay] Supplier ${supplier?.name} requiresREP: ${requiresREP}`);
    }

    // Determinar nuevo status basado en REP
    // Si requiere REP → pendiente_complemento
    // Si NO requiere REP → cierre_contable
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
      await db.update(scheduledPayments)
        .set({
          status: requiresREP ? 'voucher_uploaded' : 'payment_completed',
          paidAt: new Date(),
          paidBy: user.id,
        })
        .where(eq(scheduledPayments.id, existingVoucher.scheduledPaymentId));
      console.log(`💳 [Pay] Scheduled payment ${existingVoucher.scheduledPaymentId} actualizado a ${requiresREP ? 'voucher_uploaded' : 'payment_completed'}`);
    }

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

export default router;
