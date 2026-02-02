import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { type InsertPaymentVoucher, paymentVouchers, deletedPaymentVouchers } from '@shared/schema';
import { db } from '../db';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import { sendEmail as sendGridEmail, getPaymentReceiptEmailTemplate } from '../sendgrid';
import { uploadFile, saveTempFile, moveTempToStorage, isUsingR2 } from '../storage/file-storage';
import * as fileStorage from '../file-storage';

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

    // Analizar el documento con OpenAI
    let analysis;
    try {
      console.log(`🤖 [Upload Voucher] Iniciando análisis con OpenAI...`);
      const { analyzePaymentDocument } = await import("../document-analyzer");
      // Usar buffer directamente (memoryStorage)
      const fileBuffer = file.buffer;

      analysis = await analyzePaymentDocument(fileBuffer, file.mimetype);
      console.log(`✅ [Upload Voucher] Análisis completado:`, {
        documentType: analysis.documentType,
        extractedAmount: analysis.extractedAmount,
        ocrConfidence: analysis.ocrConfidence
      });
    } catch (analyzeError: any) {
      console.error('❌ [Upload Voucher] Error en análisis de documento:', analyzeError);
      // Si falla el análisis, continuar pero con valores por defecto
      analysis = {
        documentType: 'unknown' as any,
        extractedAmount: null,
        extractedDate: null,
        extractedBank: null,
        extractedReference: null,
        extractedCurrency: null,
        extractedOriginAccount: null,
        extractedDestinationAccount: null,
        extractedTrackingKey: null,
        extractedBeneficiaryName: null,
        ocrConfidence: 0,
      };
      console.log(`⚠️ [Upload Voucher] Continuando con análisis fallido (valores por defecto)`);
    }

    // Verificar que sea un comprobante (solo si el análisis fue exitoso)
    if (analysis.documentType && analysis.documentType !== 'voucher' && analysis.documentType !== 'rep' && analysis.documentType !== 'unknown') {
      console.error(`❌ [Upload Voucher] Tipo de documento inválido: ${analysis.documentType}`);
      return res.status(400).json({
        error: 'Documento inválido',
        details: 'Solo se pueden subir comprobantes de pago o REPs. Las facturas deben subirse primero.'
      });
    }

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

// POST /api/payment-vouchers/upload - Subir comprobante con análisis automático OpenAI - Con rate limiting
console.log('✅ [Routes] Registrando endpoint POST /api/payment-vouchers/upload');

// Endpoint de prueba para diagnosticar
router.post("/api/payment-vouchers/upload-test", jwtAuthMiddleware, (req, res) => {
  console.log('🧪 [TEST] Endpoint de prueba llamado');
  console.log('🧪 [TEST] Content-Type:', req.headers['content-type']);
  console.log('🧪 [TEST] req.body:', req.body);
  console.log('🧪 [TEST] req.body keys:', Object.keys(req.body || {}));
  res.json({
    message: 'Test endpoint funcionando',
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body || {}),
    body: req.body
  });
});

router.post("/api/payment-vouchers/upload", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
  console.log('📤 [Upload] ========== INICIO DE UPLOAD ==========');
  console.log('📤 [Upload] Petición recibida en /api/payment-vouchers/upload');
  console.log('📤 [Upload] Content-Type:', req.headers['content-type']);
  console.log('📤 [Upload] Content-Length:', req.headers['content-length']);
  console.log('📤 [Upload] req.body ANTES de multer:', req.body);
  console.log('📤 [Upload] req.body keys ANTES de multer:', Object.keys(req.body || {}));

  voucherUpload.single('voucher')(req, res, (err) => {
    if (err) {
      console.error('❌ [Multer] Error detectado:', {
        message: err.message,
        code: (err as any).code,
        field: (err as any).field,
        name: err.name
      });
      console.error('❌ [Multer] Stack trace:', err.stack);

      // Determinar el tipo de error y dar mensaje más específico
      let errorDetails = err.message;
      if ((err as any).code === 'LIMIT_FILE_SIZE') {
        errorDetails = 'El archivo excede el tamaño máximo permitido (10MB)';
      } else if ((err as any).code === 'LIMIT_UNEXPECTED_FILE') {
        errorDetails = 'Campo de archivo inesperado. Asegúrate de usar el campo "voucher"';
      } else if (err.message.includes('Solo se permiten')) {
        errorDetails = err.message;
      }

      return res.status(400).json({
        error: 'Error al procesar archivo',
        details: errorDetails,
        code: (err as any).code || 'MULTER_ERROR'
      });
    }
    console.log('✅ [Multer] Archivo procesado exitosamente');
    console.log('📤 [Upload] req.body DESPUÉS de multer:', req.body);
    console.log('📤 [Upload] req.body keys DESPUÉS de multer:', Object.keys(req.body || {}));
    console.log('📤 [Upload] req.file:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'null');
    next();
  });
}, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const file = req.file;

    console.log('📁 [Upload] Archivo recibido:', file ? {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    } : 'null');

    if (!file) {
      console.error('❌ [Upload] No se recibió ningún archivo');
      return res.status(400).json({
        error: 'No se subió ningún archivo',
        details: 'Asegúrate de seleccionar un archivo antes de subirlo'
      });
    }

    // SIMPLIFIED SECURITY: Validación de archivo simplificada pero segura
    // Validamos la extensión (ya que multer validó el mimetype)
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    const allowedExtensions = ['.pdf', '.xml', '.png', '.jpg', '.jpeg'];

    if (!allowedExtensions.includes(fileExtension)) {
      console.error(`❌ [Upload] Extensión no permitida: ${fileExtension}`);
      return res.status(400).json({
        error: 'Tipo de archivo no permitido',
        details: `Solo se permiten archivos: ${allowedExtensions.join(', ')}`
      });
    }

    console.log(`✅ [Upload] Archivo aceptado: ${file.originalname} (${fileExtension})`);

    // Analizar el documento primero para determinar el tipo
    console.log('🔍 [Upload] Iniciando análisis del documento...');
    const { analyzePaymentDocument } = await import("../document-analyzer");
    // Usar buffer directamente (memoryStorage)
    const fileBuffer = file.buffer;

    console.log('📄 [Upload] Buffer disponible, tamaño:', fileBuffer.length, 'bytes');
    let analysis = await analyzePaymentDocument(fileBuffer, file.mimetype);
    console.log('✅ [Upload] Análisis completado - DATOS EXTRAÍDOS:', JSON.stringify({
      documentType: analysis?.documentType,
      ocrConfidence: analysis?.ocrConfidence,
      extractedAmount: analysis?.extractedAmount,
      extractedSupplierName: analysis?.extractedSupplierName,
      extractedDueDate: analysis?.extractedDueDate ? analysis.extractedDueDate.toISOString() : null,
      extractedDate: analysis?.extractedDate ? analysis.extractedDate.toISOString() : null,
      extractedInvoiceNumber: analysis?.extractedInvoiceNumber,
      extractedTaxId: analysis?.extractedTaxId,
      extractedCurrency: analysis?.extractedCurrency,
      extractedReference: analysis?.extractedReference
    }, null, 2));

    // DEBUG: Log completo del análisis para diagnóstico
    console.log('🔍 [Upload DEBUG] Tipo detectado:', analysis?.documentType);
    console.log('🔍 [Upload DEBUG] ¿Es factura?:', analysis?.documentType === 'invoice');
    console.log('🔍 [Upload DEBUG] ¿Es comprobante?:', analysis?.documentType === 'voucher');
    if (analysis?.documentType && analysis.documentType !== 'invoice' && analysis.documentType !== 'voucher') {
      console.warn(`⚠️ [Upload WARNING] Tipo de documento inesperado: ${analysis.documentType}`);
    }

    // Validar request body - hacer más flexible para manejar FormData
    // Multer parsea FormData y los campos están en req.body como strings
    console.log('📋 [Upload] req.body recibido:', JSON.stringify(req.body, null, 2));
    console.log('📋 [Upload] req.body keys:', Object.keys(req.body || {}));

    // Función helper para parsear números de FormData
    const parseNumber = (val: any): number | undefined => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = typeof val === 'string' ? Number(val) : val;
      if (isNaN(num) || num <= 0) return undefined;
      return num;
    };

    // Parsear datos manualmente para mayor control
    const validatedData = {
      payerCompanyId: parseNumber(req.body?.payerCompanyId),
      supplierId: parseNumber(req.body?.supplierId), // FIX: Parsear supplierId del frontend
      clientId: parseNumber(req.body?.clientId),
      companyId: parseNumber(req.body?.companyId),
      scheduledPaymentId: parseNumber(req.body?.scheduledPaymentId),
      notes: req.body?.notes || undefined,
      notify: req.body?.notify === 'true' || req.body?.notify === '1' || req.body?.notify === true,
      emailTo: req.body?.emailTo
        ? (Array.isArray(req.body.emailTo) ? req.body.emailTo : req.body.emailTo.split(',').map((e: string) => e.trim()).filter((e: string) => e))
        : [],
      emailCc: req.body?.emailCc
        ? (Array.isArray(req.body.emailCc) ? req.body.emailCc : req.body.emailCc.split(',').map((e: string) => e.trim()).filter((e: string) => e))
        : [],
      emailMessage: req.body?.emailMessage || undefined,
    };

    console.log('✅ [Upload] Datos parseados:', validatedData);

    // Para facturas, payerCompanyId es requerido
    if (analysis.documentType === 'invoice' && !validatedData.payerCompanyId) {
      return res.status(400).json({
        error: 'PayerCompanyId requerido',
        details: 'Se requiere especificar la empresa pagadora para procesar la factura. Asegúrate de seleccionar la empresa antes de subir el archivo.'
      });
    }

    console.log(`📤 [Upload] Procesando documento: ${file.originalname} (tipo: ${analysis.documentType})`);

    // LÓGICA INTELIGENTE REFACTORIZADA: Priorizar intención del usuario sobre detección automática
    // PRINCIPIO: Si el usuario seleccionó empresa (payerCompanyId) y NO hay tarjeta existente (scheduledPaymentId),
    // entonces es factura nueva, independientemente de qué detecte OpenAI.
    // OpenAI solo sirve para PRELLENAR datos, no para determinar intención.

    // Manejo de errores: Si el análisis falla completamente, crear objeto por defecto
    if (!analysis || !analysis.documentType) {
      console.warn('[Upload] ⚠️ Análisis falló o retornó null, usando valores por defecto');
      const existingAnalysis = analysis || {};
      analysis = {
        documentType: (existingAnalysis.documentType || 'unknown') as "invoice" | "voucher" | "rep" | "unknown",
        extractedAmount: existingAnalysis.extractedAmount ?? null,
        extractedSupplierName: existingAnalysis.extractedSupplierName ?? null,
        extractedDueDate: existingAnalysis.extractedDueDate ?? null,
        extractedDate: existingAnalysis.extractedDate ?? null,
        extractedInvoiceNumber: existingAnalysis.extractedInvoiceNumber ?? null,
        extractedReference: existingAnalysis.extractedReference ?? null,
        extractedTaxId: existingAnalysis.extractedTaxId ?? null,
        extractedCurrency: (existingAnalysis.extractedCurrency || 'MXN') as string,
        extractedBank: existingAnalysis.extractedBank ?? null,
        extractedOriginAccount: existingAnalysis.extractedOriginAccount ?? null,
        extractedDestinationAccount: existingAnalysis.extractedDestinationAccount ?? null,
        extractedTrackingKey: existingAnalysis.extractedTrackingKey ?? null,
        extractedBeneficiaryName: existingAnalysis.extractedBeneficiaryName ?? null,
        ocrConfidence: existingAnalysis.ocrConfidence ?? 0,
        rawResponse: existingAnalysis.rawResponse,
        relatedInvoiceUUID: existingAnalysis.relatedInvoiceUUID ?? null,
        paymentMethod: existingAnalysis.paymentMethod ?? null
      };
    }

    const hasInvoiceCharacteristics = (
      analysis.extractedSupplierName ||
      (analysis.extractedAmount && analysis.documentType !== 'voucher' && analysis.documentType !== 'rep')
    );

    // NUEVA LÓGICA: Priorizar intención del usuario
    let shouldCreateInvoice: boolean;
    let decisionReason: string;

    // PRIORIDAD 1: Si hay scheduledPaymentId → es comprobante para tarjeta existente (intención clara)
    if (validatedData.scheduledPaymentId) {
      shouldCreateInvoice = false;
      decisionReason = 'COMPROBANTE_EXISTENTE';
    }
    // PRIORIDAD 2: Si hay payerCompanyId y NO scheduledPaymentId → es factura nueva (intención del usuario)
    else if (validatedData.payerCompanyId) {
      shouldCreateInvoice = true;
      decisionReason = 'FACTURA_NUEVA_INTENCION_USUARIO';
    }
    // PRIORIDAD 3: Fallback a detección de OpenAI solo si no hay intención clara del usuario
    else {
      const detectedAsInvoice: boolean = Boolean(
        analysis.documentType === 'invoice' ||
        (analysis.documentType === 'unknown' && hasInvoiceCharacteristics)
      );
      shouldCreateInvoice = detectedAsInvoice;
      decisionReason = detectedAsInvoice ? 'DETECCION_OPENAI' : 'FALLO_DETECCION';
    }

    // Logging estructurado con razón de decisión
    console.log('🤖 [Upload] Decisión automática:', JSON.stringify({
      documentType: analysis.documentType || 'NULL',
      hasScheduledPaymentId: !!validatedData.scheduledPaymentId,
      scheduledPaymentId: validatedData.scheduledPaymentId || null,
      hasPayerCompanyId: !!validatedData.payerCompanyId,
      payerCompanyId: validatedData.payerCompanyId || null,
      hasInvoiceCharacteristics: hasInvoiceCharacteristics,
      extractedSupplierName: analysis.extractedSupplierName ? analysis.extractedSupplierName.substring(0, 50) : "NO ENCONTRADO",
      extractedAmount: analysis.extractedAmount || "NO ENCONTRADO",
      extractedDueDate: analysis.extractedDueDate ? "SÍ" : "NO",
      shouldCreateInvoice: shouldCreateInvoice,
      decisionReason: decisionReason
    }, null, 2));

    // Si debe crear FACTURA/TARJETA DE PAGO, guardar archivo y devolver datos para verificación
    if (shouldCreateInvoice) {
      // Validación más flexible: permitir verificación manual incluso si faltan algunos campos
      // El usuario podrá completar los campos faltantes en el modal de verificación
      console.log(`📋 [Invoice Detection] Datos extraídos del análisis:`, {
        supplierName: analysis.extractedSupplierName || "NO ENCONTRADO",
        amount: analysis.extractedAmount || "NO ENCONTRADO",
        dueDate: analysis.extractedDueDate || "NO ENCONTRADO",
        invoiceDate: analysis.extractedDate || "NO ENCONTRADO",
        invoiceNumber: analysis.extractedInvoiceNumber || "NO ENCONTRADO",
        taxId: analysis.extractedTaxId || "NO ENCONTRADO",
        currency: analysis.extractedCurrency || "NO ENCONTRADO",
        documentType: analysis.documentType,
        ocrConfidence: analysis.ocrConfidence
      });

      // Si no hay monto, mostrar advertencia pero permitir verificación manual
      if (!analysis.extractedAmount) {
        console.warn(`⚠️ [Invoice Detection] ADVERTENCIA: No se pudo extraer el monto de la factura. Se permitirá verificación manual.`);
        // NO rechazar, permitir que el usuario complete el monto manualmente
      }

      // Si falta proveedor o fecha de vencimiento, aún permitir verificación manual
      // El usuario podrá completar estos campos en el modal
      if (!analysis.extractedSupplierName) {
        console.warn(`⚠️ [Invoice Detection] Proveedor no encontrado en factura. Se permitirá verificación manual.`);
      }

      if (!analysis.extractedDueDate) {
        console.warn(`⚠️ [Invoice Detection] Fecha de vencimiento no encontrada. Se calculará o el usuario la especificará.`);
        // Si hay fecha de factura, calcular fecha de vencimiento por defecto (+30 días)
        if (analysis.extractedDate) {
          const defaultDueDate = new Date(analysis.extractedDate);
          defaultDueDate.setDate(defaultDueDate.getDate() + 30);
          analysis.extractedDueDate = defaultDueDate;
          console.log(`📅 [Invoice Detection] Fecha de vencimiento calculada por defecto: ${defaultDueDate.toISOString().split('T')[0]}`);
        }
      }

      try {
        console.log(`📋 [Invoice Detection] Factura detectada, preparando datos para verificación`);

        // Preservar null si no se extrajo (no convertir a '')
        const supplierName = analysis.extractedSupplierName ?? null;
        const taxId = analysis.extractedTaxId ?? null;

        // Buscar cliente/proveedor existente con búsqueda mejorada
        if (!validatedData.payerCompanyId) {
          return res.status(400).json({ error: 'PayerCompanyId requerido para procesar factura' });
        }
        const payerCompanyId = validatedData.payerCompanyId; // Type narrowing

        // Función mejorada de matching de proveedores
        const findBestSupplierMatch = async (
          extractedName: string | null,
          extractedTaxId: string | null
        ): Promise<{ supplier: any; confidence: number; source: 'client' | 'supplier' } | null> => {
          if (!extractedName && !extractedTaxId) return null;

          // Normalizar nombres
          const normalizeName = (name: string): string => {
            if (!name) return '';
            return name
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Remover acentos
              .replace(/[^a-z0-9\s]/g, "") // Remover caracteres especiales
              .replace(/\s+/g, " ") // Normalizar espacios
              .trim();
          };

          // Calcular similitud (Levenshtein simplificado)
          const calculateSimilarity = (str1: string, str2: string): number => {
            const longer = str1.length > str2.length ? str1 : str2;
            const shorter = str1.length > str2.length ? str2 : str1;
            if (longer.length === 0) return 1.0;
            const distance = levenshteinDistance(longer, shorter);
            return (longer.length - distance) / longer.length;
          };

          const levenshteinDistance = (str1: string, str2: string): number => {
            const matrix: number[][] = [];
            for (let i = 0; i <= str2.length; i++) {
              matrix[i] = [i];
            }
            for (let j = 0; j <= str1.length; j++) {
              matrix[0][j] = j;
            }
            for (let i = 1; i <= str2.length; i++) {
              for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                  matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                  matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                  );
                }
              }
            }
            return matrix[str2.length][str1.length];
          };

          const normalizedSupplierName = extractedName ? normalizeName(extractedName) : '';

          // ESTRATEGIA 1: Buscar por RFC/Tax ID (más confiable - 95% confianza)
          if (extractedTaxId) {
            // Buscar en clients (si tienen campo taxId/RFC)
            const allClients = await storage.getClientsByCompany(payerCompanyId);
            const clientByTaxId = allClients.find((client: any) => {
              // Buscar en notes o en cualquier campo que pueda contener RFC
              const clientText = JSON.stringify(client).toLowerCase();
              const normalizedTaxId = extractedTaxId.toLowerCase().replace(/[^a-z0-9]/g, '');
              return clientText.includes(normalizedTaxId);
            });

            if (clientByTaxId) {
              return { supplier: clientByTaxId, confidence: 0.95, source: 'client' };
            }

            // Buscar en suppliers (si tienen campo taxId/RFC)
            const { suppliers } = await import('@shared/schema');
            const { and } = await import('drizzle-orm');

            const allSuppliers = await db.select().from(suppliers)
              .where(and(
                eq(suppliers.companyId, payerCompanyId),
                eq(suppliers.isActive, true)
              ));

            const supplierByTaxId = allSuppliers.find((supplier: any) => {
              const supplierText = JSON.stringify(supplier).toLowerCase();
              const normalizedTaxId = extractedTaxId.toLowerCase().replace(/[^a-z0-9]/g, '');
              return supplierText.includes(normalizedTaxId);
            });

            if (supplierByTaxId) {
              return { supplier: supplierByTaxId, confidence: 0.95, source: 'supplier' };
            }
          }

          // ESTRATEGIA 2: Buscar por nombre exacto (85% confianza)
          if (extractedName) {
            const allClients = await storage.getClientsByCompany(payerCompanyId);
            const exactMatch = allClients.find((client: any) => {
              const normalizedClientName = normalizeName(client.name);
              return normalizedClientName === normalizedSupplierName;
            });

            if (exactMatch) {
              return { supplier: exactMatch, confidence: 0.85, source: 'client' };
            }

            // Buscar en suppliers también
            const { suppliers } = await import('@shared/schema');
            const { and } = await import('drizzle-orm');

            const allSuppliers = await db.select().from(suppliers)
              .where(and(
                eq(suppliers.companyId, payerCompanyId),
                eq(suppliers.isActive, true)
              ));

            const exactSupplierMatch = allSuppliers.find((supplier: any) => {
              const normalizedSupplierName2 = normalizeName(supplier.name || supplier.shortName || '');
              return normalizedSupplierName2 === normalizedSupplierName;
            });

            if (exactSupplierMatch) {
              return { supplier: exactSupplierMatch, confidence: 0.85, source: 'supplier' };
            }
          }

          // ESTRATEGIA 3: Fuzzy matching (70-80% confianza)
          if (extractedName) {
            const allClients = await storage.getClientsByCompany(payerCompanyId);
            const fuzzyMatches: Array<{ supplier: any; confidence: number; source: 'client' | 'supplier' }> = [];

            allClients.forEach((client: any) => {
              const normalizedClientName = normalizeName(client.name);
              const similarity = calculateSimilarity(normalizedSupplierName, normalizedClientName);

              // Coincidencia parcial (una contiene a la otra)
              const containsMatch = normalizedClientName.includes(normalizedSupplierName) ||
                                   normalizedSupplierName.includes(normalizedClientName);

              // Coincidencia de palabras clave
              const supplierWords = normalizedSupplierName.split(/\s+/).filter(w => w.length > 3);
              const clientWords = normalizedClientName.split(/\s+/).filter(w => w.length > 3);
              const commonWords = supplierWords.filter(w => clientWords.includes(w));
              const wordMatch = commonWords.length >= 2 || (commonWords.length >= 1 && supplierWords.length <= 3);

              let confidence = 0;
              if (similarity > 0.9) confidence = 0.8;
              else if (similarity > 0.7) confidence = 0.75;
              else if (containsMatch) confidence = 0.7;
              else if (wordMatch) confidence = 0.7;

              if (confidence >= 0.7) {
                fuzzyMatches.push({ supplier: client, confidence, source: 'client' });
              }
            });

            // Buscar en suppliers también
            const { suppliers } = await import('@shared/schema');
            const { and } = await import('drizzle-orm');

            const allSuppliers = await db.select().from(suppliers)
              .where(and(
                eq(suppliers.companyId, payerCompanyId),
                eq(suppliers.isActive, true)
              ));

            allSuppliers.forEach((supplier: any) => {
              const supplierDisplayName = supplier.name || supplier.shortName || '';
              const normalizedSupplierName2 = normalizeName(supplierDisplayName);
              const similarity = calculateSimilarity(normalizedSupplierName, normalizedSupplierName2);

              const containsMatch = normalizedSupplierName2.includes(normalizedSupplierName) ||
                                   normalizedSupplierName.includes(normalizedSupplierName2);

              const supplierWords = normalizedSupplierName.split(/\s+/).filter(w => w.length > 3);
              const supplierWords2 = normalizedSupplierName2.split(/\s+/).filter(w => w.length > 3);
              const commonWords = supplierWords.filter(w => supplierWords2.includes(w));
              const wordMatch = commonWords.length >= 2 || (commonWords.length >= 1 && supplierWords.length <= 3);

              let confidence = 0;
              if (similarity > 0.9) confidence = 0.8;
              else if (similarity > 0.7) confidence = 0.75;
              else if (containsMatch) confidence = 0.7;
              else if (wordMatch) confidence = 0.7;

              if (confidence >= 0.7) {
                fuzzyMatches.push({ supplier, confidence, source: 'supplier' });
              }
            });

            // Retornar el mejor match
            if (fuzzyMatches.length > 0) {
              fuzzyMatches.sort((a, b) => b.confidence - a.confidence);
              return fuzzyMatches[0];
            }
          }

          return null;
        };

        // Usar la función mejorada de matching
        let matchingSupplier: any = null;
        let finalSupplierId: number | null = null;
        let matchConfidence = 0;

        // FIX: Priorizar supplierId del frontend (usuario ya seleccionó proveedor)
        if (validatedData.supplierId) {
          console.log(`🔗 [Invoice Detection] Usando supplierId del frontend: ${validatedData.supplierId}`);

          // Buscar el proveedor en la BD por ID
          const { suppliers } = await import('@shared/schema');

          const [supplierFromDb] = await db.select().from(suppliers).where(eq(suppliers.id, validatedData.supplierId));

          if (supplierFromDb) {
            matchingSupplier = supplierFromDb;
            finalSupplierId = supplierFromDb.id;
            matchConfidence = 1.0; // 100% confianza porque el usuario lo seleccionó
            console.log(`✅ [Invoice Detection] Proveedor del frontend encontrado: ${supplierFromDb.name} (ID: ${finalSupplierId})`);
          } else {
            console.warn(`⚠️ [Invoice Detection] supplierId ${validatedData.supplierId} no encontrado en BD, intentando matching por extracción`);
          }
        }

        // Si no hay supplierId del frontend o no se encontró, intentar matching por extracción
        if (!matchingSupplier && (supplierName || taxId)) {
          const matchResult = await findBestSupplierMatch(supplierName, taxId);
          if (matchResult) {
            matchingSupplier = matchResult.supplier;
            finalSupplierId = matchingSupplier.id;
            matchConfidence = matchResult.confidence;
            console.log(`🔗 [Invoice Detection] Proveedor encontrado por extracción (${matchResult.source}): ${matchingSupplier.name} (ID: ${finalSupplierId}, Confianza: ${(matchConfidence * 100).toFixed(0)}%)`);
          } else {
            console.log(`⚠️ [Invoice Detection] Proveedor "${supplierName || 'N/A'}" no encontrado en base de datos`);
          }
        } else if (!matchingSupplier) {
          console.log(`⚠️ [Invoice Detection] Sin supplierId del frontend y sin datos de extracción, requerirá selección manual`);
        }

        // Guardar el archivo de factura temporalmente para verificación
        // (siempre local porque es temporal - se moverá a R2 al confirmar)
        const invoiceFilePath = saveTempFile(fileBuffer, 'facturas', file.originalname);

        // Log detallado de datos extraídos
        const hasSupplier = !!analysis.extractedSupplierName;
        const hasAmount = !!analysis.extractedAmount;
        const hasDueDate = !!analysis.extractedDueDate;

        console.log(`📋 [Invoice Detection] Datos extraídos para verificación:`, {
          supplierName: analysis.extractedSupplierName || "⚠️ NO ENCONTRADO - requerirá entrada manual",
          amount: analysis.extractedAmount || "⚠️ NO ENCONTRADO - requerirá entrada manual",
          currency: analysis.extractedCurrency || 'MXN',
          dueDate: analysis.extractedDueDate ? analysis.extractedDueDate.toISOString().split('T')[0] : "⚠️ NO ENCONTRADO - se calculará o requerirá entrada manual",
          invoiceDate: analysis.extractedDate ? analysis.extractedDate.toISOString().split('T')[0] : "NO ENCONTRADO",
          invoiceNumber: analysis.extractedInvoiceNumber || "NO ENCONTRADO",
          taxId: analysis.extractedTaxId || "NO ENCONTRADO",
          confidence: (analysis.ocrConfidence * 100).toFixed(1) + "%",
          summary: `Proveedor: ${hasSupplier ? '✅' : '❌'}, Monto: ${hasAmount ? '✅' : '❌'}, Fecha Vencimiento: ${hasDueDate ? '✅' : '❌'}`
        });

        // Construir mensaje descriptivo según qué datos se encontraron
        let message = 'Factura detectada. ';
        if (hasSupplier && hasAmount && hasDueDate) {
          message += 'Datos extraídos correctamente. Por favor verifica la información y especifica la fecha de pago.';
        } else if (hasAmount && hasSupplier) {
          message += 'Se extrajo el proveedor y el monto. Por favor completa la fecha de vencimiento (si falta) y especifica la fecha de pago.';
        } else if (hasAmount) {
          message += 'Se extrajo el monto, pero faltan algunos datos. Por favor completa el proveedor, fecha de vencimiento (si falta) y especifica la fecha de pago.';
        } else {
          message += 'Algunos datos no se pudieron extraer automáticamente. Por favor completa todos los campos necesarios (proveedor, monto, fecha de vencimiento) y especifica la fecha de pago.';
        }

        // Retornar datos extraídos para verificación (NO crear cuenta por pagar aún)
        // SIEMPRE permitir verificación manual, incluso si faltan todos los campos
        console.log(`✅ [Invoice Detection] Retornando datos para verificación manual (siempre permitido)`);

        // Preparar respuesta con datos extraídos
        // IMPORTANTE: Preservar null (no convertir a '') para que el frontend pueda usar fallbacks
        const responseData = {
          requiresVerification: true,
          documentType: 'invoice',
          analysis: {
            // Preservar null en lugar de convertir a '' - permite que frontend use supplier.name como fallback
            extractedSupplierName: analysis.extractedSupplierName ?? null, // null si no se encontró (no '')
            extractedAmount: analysis.extractedAmount ?? null, // null si no se encontró
            extractedCurrency: analysis.extractedCurrency ?? 'MXN', // Default solo si es null/undefined
            extractedDueDate: analysis.extractedDueDate ? analysis.extractedDueDate.toISOString() : null,
            extractedDate: analysis.extractedDate ? analysis.extractedDate.toISOString() : null, // Incluir fecha de factura
            extractedInvoiceNumber: analysis.extractedInvoiceNumber ?? null,
            extractedReference: analysis.extractedReference ?? null,
            extractedTaxId: analysis.extractedTaxId ?? null,
            // Campos adicionales extraídos
            extractedBank: analysis.extractedBank ?? null,
            extractedOriginAccount: analysis.extractedOriginAccount ?? null,
            extractedDestinationAccount: analysis.extractedDestinationAccount ?? null,
            extractedTrackingKey: analysis.extractedTrackingKey ?? null,
            extractedBeneficiaryName: analysis.extractedBeneficiaryName ?? null,
            paymentMethod: analysis.paymentMethod ?? null,
            paymentTerms: analysis.paymentTerms ?? null,
            transferType: analysis.transferType ?? null,
          },
          invoiceFile: {
            path: invoiceFilePath,
            originalName: file.originalname,
          },
          supplier: {
            id: finalSupplierId,
            // FIX: Priorizar nombre del proveedor seleccionado (del frontend) sobre el extraído
            name: (matchingSupplier ? matchingSupplier.name : null) ?? supplierName ?? null,
          },
          payerCompanyId: payerCompanyId,
          message: message,
          matchConfidence: matchConfidence,
          extractionConfidence: analysis.ocrConfidence, // Confianza de extracción de datos
          supplierSuggestions: matchingSupplier ? [{
            id: matchingSupplier.id,
            name: matchingSupplier.name,
            confidence: matchConfidence,
          }] : [],
        };

        // Log detallado de lo que se está retornando
        console.log('📤 [Invoice Detection] Datos que se retornan al frontend:', JSON.stringify({
          extractedSupplierName: responseData.analysis.extractedSupplierName,
          extractedAmount: responseData.analysis.extractedAmount,
          extractedCurrency: responseData.analysis.extractedCurrency,
          extractedDueDate: responseData.analysis.extractedDueDate,
          extractedDate: responseData.analysis.extractedDate,
          extractedInvoiceNumber: responseData.analysis.extractedInvoiceNumber,
          extractedTaxId: responseData.analysis.extractedTaxId,
          supplierId: responseData.supplier.id,
          supplierName: responseData.supplier.name,
          payerCompanyId: responseData.payerCompanyId
        }, null, 2));

        return res.status(200).json(responseData);

      } catch (invoiceError) {
        console.error(`❌ [Invoice Detection] Error procesando factura:`, invoiceError);
        return res.status(500).json({
          error: 'Error al procesar factura',
          details: invoiceError instanceof Error ? invoiceError.message : 'Error desconocido'
        });
      }
    }

    // NOTA: Ya no rechazamos comprobantes sin scheduledPaymentId
    // La lógica inteligente arriba decide si crear tarjeta o comprobante
    // Si llegamos aquí, es porque NO es una factura, es un comprobante

    // Para comprobantes, obtener el cliente desde scheduledPayment o clientId
    let client = null;
    let scheduledPaymentForClient = null;
    if (validatedData.scheduledPaymentId) {
      // Usar Drizzle directamente para obtener scheduled payment
      const { scheduledPayments } = await import('@shared/schema');

      const [payment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, validatedData.scheduledPaymentId));
      scheduledPaymentForClient = payment;

      if (!scheduledPaymentForClient) {
        return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
      }
      // Buscar cliente por supplierId si existe
      if (scheduledPaymentForClient.supplierId) {
        client = await storage.getClient(scheduledPaymentForClient.supplierId);
      }
      // Si no hay cliente pero hay supplierName, crear un objeto cliente temporal
      if (!client && scheduledPaymentForClient.supplierName) {
        client = {
          id: scheduledPaymentForClient.supplierId || 0,
          name: scheduledPaymentForClient.supplierName,
          companyId: scheduledPaymentForClient.companyId,
          email: null,
          requiresPaymentComplement: false,
        } as any;
      }
    } else if (validatedData.clientId) {
      client = await storage.getClient(validatedData.clientId);
      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
    } else {
      return res.status(400).json({ error: 'Se requiere clientId o scheduledPaymentId para comprobantes' });
    }

    // Determinar estado inicial basado en calidad del OCR (solo para comprobantes)
    // Si todos los campos críticos están presentes -> VALIDADO
    // Si faltan campos críticos -> PENDIENTE_VALIDACIÓN
    const criticalFields = (analysis.documentType === 'voucher' || analysis.documentType === 'rep')
      ? ['extractedAmount', 'extractedDate', 'extractedBank', 'extractedReference', 'extractedCurrency']
      : ['extractedAmount', 'extractedSupplierName', 'extractedDueDate'];
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

    // Subir archivo a storage (R2 o local)
    console.log(`📤 [Upload] Subiendo comprobante a storage...`);
    const voucherUploadResult = await uploadFile(
      fileBuffer,
      'comprobantes',
      file.originalname,
      file.mimetype
    );
    const voucherFileUrl = voucherUploadResult.url;
    console.log(`✅ [Upload] Comprobante subido a ${voucherUploadResult.storage}: ${voucherFileUrl}`);

    // Usar companyId del cliente si no se especifica
    const voucherCompanyId = validatedData.companyId || client?.companyId || validatedData.payerCompanyId;

    // Crear comprobante usando storage
    // Asegurar que clientId sea un número válido (no null)
    const voucherClientId = validatedData.clientId || (scheduledPaymentForClient?.supplierId ?? 0);
    if (!voucherClientId || voucherClientId === 0) {
      return res.status(400).json({ error: 'Se requiere un cliente válido para crear el comprobante' });
    }

    // Validar que payerCompanyId esté presente para comprobantes
    if (!validatedData.payerCompanyId) {
      return res.status(400).json({ error: 'PayerCompanyId requerido para crear comprobante' });
    }
    const payerCompanyIdForVoucher = validatedData.payerCompanyId; // Type narrowing

    const newVoucher: InsertPaymentVoucher = {
      companyId: voucherCompanyId,
      payerCompanyId: payerCompanyIdForVoucher,
      clientId: voucherClientId,
      clientName: client?.name || scheduledPaymentForClient?.supplierName || 'Cliente',
      scheduledPaymentId: validatedData.scheduledPaymentId || null,
      status: initialStatus as any,
      voucherFileUrl: voucherFileUrl, // URL de R2 o local
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
      notify: validatedData.notify !== false,
      emailTo: validatedData.emailTo || [],
      emailCc: validatedData.emailCc || [],
      emailMessage: validatedData.emailMessage || null,
      notes: validatedData.notes || null,
      uploadedBy: user.id,
    };

    const voucher = await storage.createPaymentVoucher(newVoucher);

    // AUTOMATIZACIÓN: Procesamiento automático
    let finalStatus = initialStatus;
    let linkedInvoiceId: number | null = null;
    let linkedInvoiceUuid: string | null = null;

    try {
      // 1. Intentar vincular con factura/pago programado
      if (validatedData.scheduledPaymentId && scheduledPaymentForClient) {
        const scheduledPayment = scheduledPaymentForClient;
        if (scheduledPayment) {
          // Verificar si el monto coincide (con tolerancia del 1%)
          const amountDiff = Math.abs((scheduledPayment.amount - (analysis.extractedAmount || 0)) / scheduledPayment.amount);
          if (amountDiff <= 0.01) {
            // Monto coincide -> CIERRE_CONTABLE
            finalStatus = 'cierre_contable';
            linkedInvoiceId = scheduledPayment.id;
            console.log(`🔗 [Automation] Vinculado con pago programado ${scheduledPayment.id}`);
          } else if (analysis.extractedAmount && analysis.extractedAmount < scheduledPayment.amount) {
            // Pago parcial -> PENDIENTE_COMPLEMENTO
            finalStatus = 'pendiente_complemento';
            console.log(`⚠️ [Automation] Pago parcial detectado`);
          } else {
            // Monto diferente -> FACTURA_PAGADA (requiere revisión manual)
            finalStatus = 'factura_pagada';
            console.log(`❓ [Automation] Monto no coincide, requiere revisión`);
          }
        }
      } else if (analysis.extractedAmount && analysis.extractedReference) {
        // Buscar pagos programados por monto o referencia
        // (Nota: Esto requeriría una función de búsqueda en storage)
        // Por ahora, dejar en FACTURA_PAGADA para revisión manual
        finalStatus = 'factura_pagada';
      }

      // 2. Si el cliente requiere complemento y no está cerrado
      if (client?.requiresPaymentComplement && finalStatus !== 'cierre_contable') {
        if (finalStatus === 'factura_pagada') {
          finalStatus = 'pendiente_complemento';
        }
      }

      // Actualizar estado si cambió
      if (finalStatus !== initialStatus) {
        await storage.updatePaymentVoucher(voucher.id, {
          status: finalStatus as any,
          linkedInvoiceId,
          linkedInvoiceUuid,
        });
        voucher.status = finalStatus as any;
      }

      // 2.5. Actualizar scheduled_payment si está vinculado
      if (validatedData.scheduledPaymentId && scheduledPaymentForClient) {
        // Determinar el estado del scheduled_payment basado en si requiere REP
        const requiresREP = client?.requiresPaymentComplement === true;
        const scheduledPaymentStatus = requiresREP ? 'voucher_uploaded' : 'payment_completed';

        // Importar scheduledPayments si no están disponibles
        const { scheduledPayments } = await import('@shared/schema');

        await db.update(scheduledPayments)
          .set({
            voucherId: voucher.id,
            status: scheduledPaymentStatus,
            paidAt: new Date(),
            paidBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(scheduledPayments.id, validatedData.scheduledPaymentId));

        console.log(`✅ [Upload] Scheduled payment ${validatedData.scheduledPaymentId} actualizado: status=${scheduledPaymentStatus} (requiere REP: ${requiresREP})`);
      }

      // 3. Enviar correo automáticamente a menos que notify=false explícitamente
      if (validatedData.notify !== false && (validatedData.emailTo?.length || client?.email)) {
        const { emailService } = await import('../email-service');

        const emailAddresses = validatedData.emailTo?.length
          ? validatedData.emailTo
          : client?.email
            ? [client.email]
            : [];

        if (emailAddresses.length > 0) {
          try {
            // Obtener nombre de la empresa pagadora
            if (!validatedData.payerCompanyId) {
              console.warn('⚠️ [Email] PayerCompanyId no disponible, usando nombre genérico');
              return;
            }
            const payerCompanyIdForEmail = validatedData.payerCompanyId; // Type narrowing
            const payerCompany = await storage.getCompany(payerCompanyIdForEmail);
            const companyName = payerCompany?.name || 'Empresa';

            // Crear contenido del email
            const subject = `Comprobante de pago – ${companyName} – ${analysis.extractedCurrency || 'MXN'} ${analysis.extractedAmount?.toLocaleString('es-MX') || 'N/A'}`;

            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
                  Comprobante de Pago
                </h2>

                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 16px;"><strong>Estimado/a ${client?.name || 'Cliente'},</strong></p>
                  <p style="margin: 10px 0; font-size: 14px;">
                    Se ha registrado el siguiente comprobante de pago:
                  </p>
                </div>

                <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Empresa Pagadora:</strong> ${companyName}</p>
                  ${analysis.extractedAmount ? `<p style="margin: 5px 0;"><strong>Monto:</strong> ${analysis.extractedCurrency || 'MXN'} $${analysis.extractedAmount.toLocaleString('es-MX')}</p>` : ''}
                  ${analysis.extractedDate ? `<p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(analysis.extractedDate).toLocaleDateString('es-MX')}</p>` : ''}
                  ${analysis.extractedBank ? `<p style="margin: 5px 0;"><strong>Banco:</strong> ${analysis.extractedBank}</p>` : ''}
                  ${analysis.extractedReference ? `<p style="margin: 5px 0;"><strong>Referencia:</strong> ${analysis.extractedReference}</p>` : ''}
                  ${analysis.extractedTrackingKey ? `<p style="margin: 5px 0;"><strong>Clave de Rastreo:</strong> ${analysis.extractedTrackingKey}</p>` : ''}
                </div>

                ${validatedData.emailMessage ? `<div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px;"><strong>Mensaje:</strong></p>
                  <p style="margin: 5px 0; font-size: 14px;">${validatedData.emailMessage}</p>
                </div>` : ''}

                <p style="margin-top: 20px; font-size: 14px;">
                  El comprobante se encuentra adjunto a este correo.
                </p>

                <p style="margin-top: 20px; font-size: 14px;">
                  Saludos cordiales,<br>
                  <strong>Lolita</strong><br>
                  Equipo de Tesorería - Econova
                </p>
              </div>
            `;

            // Preparar archivo adjunto (usando buffer de memoryStorage)
            const attachment = {
              filename: file.originalname,
              content: file.buffer,
              type: file.mimetype,
            };

            // Enviar email (nota: emailService necesita soporte para attachments)
            // Por ahora, solo enviar el HTML
            const emailResult = await emailService.sendEmail({
              to: emailAddresses[0],
              subject,
              html: emailHtml,
            }, 'treasury');

            // Registrar en email_outbox
            if (emailResult.success || emailResult.error) {
              const { emailOutbox } = await import('@shared/schema');

              await db.insert(emailOutbox).values({
                voucherId: voucher.id,
                emailTo: emailAddresses,
                emailCc: validatedData.emailCc || [],
                subject,
                htmlContent: emailHtml,
                status: emailResult.success ? 'sent' : 'failed',
                messageId: emailResult.messageId || null,
                errorMessage: emailResult.error || null,
                sentAt: emailResult.success ? new Date() : null,
              });

              console.log(`📧 [Email] ${emailResult.success ? 'Enviado' : 'Error'}: ${emailAddresses[0]}`);
            }
          } catch (emailError) {
            console.error('📧 [Email] Error enviando correo:', emailError);
            // No fallar el upload si el email falla
          }
        }
      }

      console.log(`🤖 [Automation] Flujo automático completado: ${finalStatus}`);
    } catch (automationError) {
      console.error('🤖 [Automation] Error en flujo automático:', automationError);
      // No fallar el upload si la automatización falla
    }

    console.log(`✅ [Upload] Comprobante creado con ID: ${voucher.id}, estado: ${voucher.status}`);

    res.status(201).json({
      voucher,
      analysis,
      autoStatus: initialStatus,
      requiresComplement: client?.requiresPaymentComplement || false,
      scheduledPayment: scheduledPaymentForClient || null, // Incluir cuenta por pagar si está vinculada
      documentType: analysis.documentType,
    });
  } catch (error) {
    console.error('❌ [Upload] Error completo:', error);
    console.error('❌ [Upload] Stack trace:', error instanceof Error ? error.stack : 'No stack available');

    if (error instanceof z.ZodError) {
      console.error('❌ [Upload] Error de validación Zod:', error.errors);
      return res.status(400).json({
        error: 'Validación fallida',
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    }

    if (error instanceof Error) {
      console.error('❌ [Upload] Error message:', error.message);
      // Si el error menciona algo específico, devolverlo
      if (error.message.includes('No se subió') || error.message.includes('archivo')) {
        return res.status(400).json({
          error: 'Error al procesar archivo',
          details: error.message
        });
      }
      if (error.message.includes('PayerCompanyId') || error.message.includes('empresa')) {
        return res.status(400).json({
          error: 'Datos incompletos',
          details: error.message
        });
      }
    }

    res.status(500).json({
      error: 'Error al subir comprobante',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    // FIX BUG #5: Siempre limpiar el archivo temporal
    // Esto previene acumulación de archivos basura cuando hay errores
    if (req.file?.path) {
      try {
        // Solo eliminar si el archivo aún existe en la ubicación temporal
        // (si fue movido con renameSync, ya no existirá en file.path)
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log(`🗑️ [Upload Cleanup] Archivo temporal eliminado: ${req.file.path}`);
        }
      } catch (cleanupError) {
        console.error('⚠️ [Upload Cleanup] Error al eliminar archivo temporal:', cleanupError);
        // No fallar la request por error de limpieza
      }
    }
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

    // Analizar el comprobante con OpenAI
    const { analyzePaymentDocument } = await import("../document-analyzer");
    // Usar file.buffer directamente (memoryStorage)
    const fileBuffer = file.buffer;
    const analysis = await analyzePaymentDocument(fileBuffer, file.mimetype);

    console.log(`💳 [Pay] Análisis del comprobante:`, {
      amount: analysis?.extractedAmount,
      date: analysis?.extractedDate,
      reference: analysis?.extractedReference
    });

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
