import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { getAuthUser, type AuthRequest, sql } from './_helpers';
import { jwtAuthMiddleware } from '../auth';

const router = Router();

// Rate limiter para uploads - Controla uso de OpenAI API
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 archivos por hora por IP
  message: 'Límite de uploads alcanzado. Por favor, intenta en 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Configurar multer para archivos Idrall
const idrallUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'idrall');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `idrall-${uniqueSuffix}-${file.originalname}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/zip', 'application/x-zip-compressed'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.pdf') || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF o ZIP'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB para ZIPs
});

// POST /api/treasury/idrall/upload - Procesar archivos Idrall y crear CxP
console.log('✅ [Routes] Registrando endpoint POST /api/treasury/idrall/upload');
router.post("/api/treasury/idrall/upload", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
  idrallUpload.array('files', 10)(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error (Idrall):', err.message);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  const uploadedFiles: Express.Multer.File[] = [];

  try {
    const user = getAuthUser(req as AuthRequest);
    const files = req.files as Express.Multer.File[];
    const { companyId } = req.body;

    // Validaciones iniciales
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No se subieron archivos',
        details: 'Por favor, selecciona al menos un archivo PDF o ZIP para procesar'
      });
    }

    if (!companyId) {
      return res.status(400).json({
        error: 'companyId es requerido',
        details: 'Debes seleccionar una empresa antes de subir archivos'
      });
    }

    // Validar que companyId sea un número válido
    const parsedCompanyId = parseInt(companyId);
    if (isNaN(parsedCompanyId) || parsedCompanyId <= 0) {
      return res.status(400).json({
        error: 'companyId inválido',
        details: 'El ID de empresa debe ser un número válido'
      });
    }

    console.log(`📦 [Idrall Upload] Procesando ${files.length} archivo(s) para empresa ${parsedCompanyId}`);

    // Verificar que los archivos existen y tienen tamaño válido
    for (const file of files) {
      if (!file || !file.path) {
        return res.status(400).json({
          error: 'Archivo inválido',
          details: `El archivo ${file?.originalname || 'desconocido'} no se subió correctamente`
        });
      }

      try {
        const fileStats = await fs.promises.stat(file.path);
        if (fileStats.size === 0) {
          return res.status(400).json({
            error: 'Archivo vacío',
            details: `El archivo ${file.originalname} está vacío y no puede ser procesado`
          });
        }
      } catch (statError) {
        console.error(`❌ [Idrall Upload] Error verificando archivo ${file.originalname}:`, statError);
        return res.status(400).json({
          error: 'Error accediendo al archivo',
          details: `No se pudo acceder al archivo ${file.originalname}. Por favor, intenta subirlo nuevamente.`
        });
      }

      uploadedFiles.push(file);
    }

    // Procesar archivos con el analizador de documentos unificado
    const { analyzePaymentDocument } = await import("../document-analyzer");

    const allRecords: any[] = [];
    const processingErrors: string[] = [];
    let processedFiles = 0;
    const fileRecordsMap = new Map<number, Express.Multer.File>(); // Mapear registros a archivos

    // Procesar cada archivo
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      let fileProcessed = false;

      try {
        console.log(`📄 [Idrall Upload] Procesando archivo ${i + 1}/${uploadedFiles.length}: ${file.originalname}`);

        const fileBuffer = await fs.promises.readFile(file.path);
        const fileType = file.mimetype || path.extname(file.originalname).toLowerCase();

        const analysisResult = await analyzePaymentDocument(fileBuffer, fileType);
        const analysisResultAny = analysisResult as any;

        // Si es CxP y tiene registros, agregarlos
        if (analysisResultAny.documentType === "cxp" && analysisResultAny.cxpRecords) {
          for (const record of analysisResultAny.cxpRecords) {
            allRecords.push({
              ...record,
              _sourceFileIndex: i // Guardar índice del archivo origen
            });
            fileRecordsMap.set(allRecords.length - 1, file);
          }
          processedFiles++;
          fileProcessed = true;
        } else if (analysisResultAny.documentType === "cxp") {
          // Si es CxP pero no tiene registros individuales, crear uno del resultado agregado
          if (analysisResult.extractedSupplierName && analysisResult.extractedAmount) {
            const recordIndex = allRecords.length;
            allRecords.push({
              supplierName: analysisResult.extractedSupplierName,
              amount: analysisResult.extractedAmount,
              currency: analysisResult.extractedCurrency || "MXN",
              dueDate: analysisResult.extractedDueDate || analysisResult.extractedDate || new Date(),
              reference: analysisResult.extractedReference,
              status: null,
              notes: analysisResultAny.notes,
              _sourceFileIndex: i
            });
            fileRecordsMap.set(recordIndex, file);
            processedFiles++;
            fileProcessed = true;
          }
        } else {
          processingErrors.push(`El archivo "${file.originalname}" no es un documento CxP válido. Tipo detectado: ${analysisResult.documentType || 'desconocido'}`);
        }
      } catch (error: any) {
        console.error(`❌ [Idrall Upload] Error procesando ${file.originalname}:`, error);
        const errorMessage = error?.message || 'Error desconocido al procesar el archivo';
        processingErrors.push(`Error procesando "${file.originalname}": ${errorMessage}`);
      }
    }

    // Si no se procesó ningún archivo exitosamente
    if (allRecords.length === 0 && processingErrors.length > 0) {
      // Limpiar archivos antes de retornar error
      for (const file of uploadedFiles) {
        try {
          if (fs.existsSync(file.path)) {
            await fs.promises.unlink(file.path);
            console.log(`🗑️ [Idrall Upload] Archivo eliminado: ${file.path}`);
          }
        } catch (cleanupError) {
          console.error(`⚠️ [Idrall Upload] Error al limpiar archivo ${file.originalname}:`, cleanupError);
        }
      }

      return res.status(400).json({
        success: false,
        error: 'No se pudo procesar ningún archivo',
        details: 'Ninguno de los archivos subidos pudo ser procesado como documento CxP válido',
        processing: {
          totalRecords: 0,
          processedFiles: 0,
          errors: processingErrors
        }
      });
    }

    // Crear registros de CxP en la base de datos
    const createdPayments = [];
    const errors = [];

    for (let i = 0; i < allRecords.length; i++) {
      const record = allRecords[i];
      const sourceFile = fileRecordsMap.get(i) || uploadedFiles[0]; // Fallback al primer archivo

      try {
        // Validar datos del registro antes de insertar
        if (!record.supplierName || !record.amount) {
          errors.push(`Registro inválido: falta información del proveedor o monto`);
          continue;
        }

        // Buscar proveedor por nombre (fuzzy match)
        const supplierResult = await sql(`
          SELECT id FROM suppliers
          WHERE LOWER(name) LIKE LOWER($1)
          AND company_id = $2
          AND is_active = true
          LIMIT 1
        `, [`%${record.supplierName.trim()}%`, parsedCompanyId]);

        const supplierId = supplierResult.length > 0 ? supplierResult[0].id : null;

        // Validar monto
        const amount = parseFloat(record.amount);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Monto inválido para proveedor "${record.supplierName}": ${record.amount}`);
          continue;
        }

        // Crear registro de scheduled_payment
        const result = await sql(`
          INSERT INTO scheduled_payments (
            company_id, supplier_id, supplier_name, amount, currency, due_date,
            status, reference, notes, source_type, hydral_file_url, hydral_file_name, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          parsedCompanyId,
          supplierId,
          record.supplierName.trim(),
          amount,
          record.currency || 'MXN',
          record.dueDate || new Date(),
          'idrall_imported', // Estado inicial
          record.reference || null,
          record.notes || null,
          'idrall',
          sourceFile.path, // URL del archivo origen
          sourceFile.originalname,
          user.id
        ]);

        createdPayments.push(result[0]);
      } catch (error: any) {
        console.error(`❌ [Idrall Upload] Error creando registro para ${record.supplierName}:`, error);
        const errorDetail = error?.code === '23505'
          ? 'Ya existe un registro con estos datos'
          : error?.message || 'Error desconocido';
        errors.push(`Error creando CxP para "${record.supplierName}": ${errorDetail}`);
      }
    }

    // Limpiar archivos después de procesar (solo si se crearon registros)
    if (createdPayments.length > 0) {
      console.log(`🗑️ [Idrall Upload] Limpiando archivos temporales después de procesamiento exitoso`);
      for (const file of uploadedFiles) {
        try {
          if (fs.existsSync(file.path)) {
            await fs.promises.unlink(file.path);
            console.log(`🗑️ [Idrall Upload] Archivo eliminado: ${file.path}`);
          }
        } catch (cleanupError) {
          console.error(`⚠️ [Idrall Upload] Error al limpiar archivo ${file.originalname}:`, cleanupError);
          // No fallar el request por errores de limpieza
        }
      }
    }

    console.log(`✅ [Idrall Upload] Procesamiento completado: ${createdPayments.length} CxP creados, ${errors.length} errores`);

    res.status(201).json({
      success: true,
      created: createdPayments.length,
      payments: createdPayments,
      processing: {
        totalRecords: allRecords.length,
        processedFiles: processedFiles,
        errors: [...processingErrors, ...errors]
      }
    });
  } catch (error: any) {
    console.error('❌ [Idrall Upload] Error procesando archivos Idrall:', error);

    // Limpiar archivos en caso de error
    for (const file of uploadedFiles) {
      try {
        if (fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
          console.log(`🗑️ [Idrall Upload] Archivo eliminado después de error: ${file.path}`);
        }
      } catch (cleanupError) {
        console.error(`⚠️ [Idrall Upload] Error al limpiar archivo después de error:`, cleanupError);
      }
    }

    const errorMessage = error?.message || 'Error desconocido al procesar los archivos';
    res.status(500).json({
      error: 'Error al procesar archivos Idrall',
      details: errorMessage
    });
  }
});

export default router;
