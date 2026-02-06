import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { handleSalesUpload } from '../sales-upload-handler-NEW';
import { handleIDRALLUpload, detectExcelFormat } from '../sales-idrall-handler';
import { handleACUMGO2026Upload } from '../sales-acum-go-handler';
import { autoAnalyzeSalesUpload } from '../nova/nova-auto-analyze';

const router = Router();

// Rate limiter para uploads - Controla uso de OpenAI API
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 archivos por hora por IP
  message: 'Límite de uploads alcanzado. Por favor, intenta en 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/sales-data
router.get("/api/sales-data", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, clientId, productId, year, month, startDate, endDate, limit = '1000' } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    let query = `
      SELECT
        id,
        company_id,
        client_id,
        product_id,
        cliente as client_name,
        producto as product_name,
        cantidad as quantity,
        unidad as unit,
        precio_unitario as unit_price,
        importe as total_amount,
        fecha as sale_date,
        mes as sale_month,
        anio as sale_year,
        factura as invoice_number,
        folio,
        NULL as notes,
        familia_producto,
        tipo_cambio,
        utilidad_bruta
      FROM ventas
      WHERE company_id = $1
    `;

    const params: any[] = [resolvedCompanyId];
    let paramIndex = 2;

    if (clientId) {
      query += ` AND client_id = $${paramIndex}`;
      params.push(parseInt(clientId as string));
      paramIndex++;
    }

    if (productId) {
      query += ` AND product_id = $${paramIndex}`;
      params.push(parseInt(productId as string));
      paramIndex++;
    }

    if (year) {
      query += ` AND anio = $${paramIndex}`;
      params.push(parseInt(year as string));
      paramIndex++;
    }

    if (month) {
      query += ` AND mes = $${paramIndex}`;
      params.push(parseInt(month as string));
      paramIndex++;
    }

    if (startDate) {
      query += ` AND fecha >= $${paramIndex}`;
      params.push(startDate as string);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND fecha <= $${paramIndex}`;
      params.push(endDate as string);
      paramIndex++;
    }

    query += ` ORDER BY fecha DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const salesData = await sql(query, params);

    res.json(salesData);
  } catch (error) {
    console.error('[GET /api/sales-data] Error:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Configurar multer para archivos Excel de ventas
const salesUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'sales');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `sales-${uniqueSuffix}-${file.originalname}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/excel'
    ];
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// POST /api/sales/upload - Subir archivo Excel de ventas
router.post("/api/sales/upload", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
  console.log('📤 [Sales Upload] ========== INICIO DE UPLOAD ==========');
  console.log('📤 [Sales Upload] Petición recibida en /api/sales/upload');
  console.log('📤 [Sales Upload] Content-Type:', req.headers['content-type']);

  salesUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ [Sales Upload] Multer error:', err.message);
      return res.status(400).json({
        error: 'Error al procesar archivo',
        details: err.message
      });
    }
    console.log('✅ [Sales Upload] Archivo procesado por multer');
    next();
  });
}, async (req, res) => {
  // Detectar formato del archivo y usar el handler apropiado
  const ExcelJS = await import('exceljs');
  const file = (req as any).file;

  if (!file) {
    return res.status(400).json({
      error: 'No se subió ningún archivo',
      details: 'Asegúrate de seleccionar un archivo Excel antes de subirlo'
    });
  }

  try {
    // Leer archivo para detectar formato
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    const format = await detectExcelFormat(workbook);
    console.log(`📋 [Sales Upload] Formato detectado: ${format}`);

    // Capture response to trigger auto-analysis
    const origJson = res.json.bind(res);
    let uploadSuccess = false;
    res.json = function(body: any) {
      if (!res.headersSent && body && !body.error) {
        uploadSuccess = true;
      }
      const result = origJson(body);
      // Fire-and-forget auto-analysis after successful upload
      if (uploadSuccess) {
        const user = (req as any).user;
        const sheetNames = workbook.worksheets.map((s: any) => s.name);
        autoAnalyzeSalesUpload(
          { summary: `Archivo Excel subido con hojas: ${sheetNames.join(', ')}. Formato: ${format}`, rowCount: workbook.worksheets.reduce((acc: number, s: any) => acc + s.rowCount, 0), companies: sheetNames },
          user?.companyId,
          user?.id?.toString()
        ).then(({ analysisId }) => {
          console.log(`[Nova] Sales auto-analysis started: ${analysisId}`);
        }).catch(err => {
          console.error('[Nova] Sales auto-analysis error:', err);
        });
      }
      return result;
    } as any;

    if (format === 'IDRALL') {
      console.log('🔄 [Sales Upload] Usando handler IDRALL...');
      await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
    } else if (format === 'LEGACY') {
      console.log('🔄 [Sales Upload] Usando handler LEGACY...');
      await handleSalesUpload(req, res, { getAuthUser, ExcelJS });
    } else if (format === 'ACUM_GO_2026') {
      console.log('🔄 [Sales Upload] Usando handler ACUM GO 2026...');
      await handleACUMGO2026Upload(req, res, { getAuthUser, ExcelJS });
    } else {
      console.log('🔄 [Sales Upload] Formato desconocido, intentando con IDRALL...');
      await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
    }
  } catch (error: any) {
    console.error('❌ [Sales Upload] Error detectando formato:', error.message);
    // Fallback: intentar con IDRALL
    await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
  }
});

// POST /api/sales-data/import-from-nova — Importar Excel desde el chat de Nova (Confirmar importación)
// Reutiliza la misma lógica que /api/sales/upload; no dispara auto-análisis Nova.
router.post("/api/sales-data/import-from-nova", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
  salesUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ [Import from Nova] Multer error:', err.message);
      return res.status(400).json({
        error: 'Error al procesar archivo',
        details: err.message
      });
    }
    next();
  });
}, async (req, res) => {
  const ExcelJS = await import('exceljs');
  const file = (req as any).file;
  const user = (req as any).user;

  if (!file) {
    return res.status(400).json({
      error: 'No se subió ningún archivo',
      details: 'Envía el mismo Excel que compartiste en el chat para importar.'
    });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    const format = await detectExcelFormat(workbook);
    console.log(`📋 [Import from Nova] Formato detectado: ${format}`);

    // Asegurar company_id del usuario para el handler (multer deja body en req.body)
    const body = (req as any).body ?? {};
    if (user?.companyId != null && body.companyId == null) {
      (req as any).body = { ...body, companyId: String(user.companyId) };
    }

    if (format === 'IDRALL') {
      await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
    } else if (format === 'LEGACY') {
      await handleSalesUpload(req, res, { getAuthUser, ExcelJS });
    } else if (format === 'ACUM_GO_2026') {
      await handleACUMGO2026Upload(req, res, { getAuthUser, ExcelJS });
    } else {
      await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
    }
  } catch (error: any) {
    console.error('❌ [Import from Nova] Error:', error.message);
    res.status(500).json({
      error: 'Error al importar ventas',
      details: error.message || 'Revisa que el archivo sea un Excel de ventas válido (IDRALL o 4 hojas).'
    });
  }
});

export default router;
