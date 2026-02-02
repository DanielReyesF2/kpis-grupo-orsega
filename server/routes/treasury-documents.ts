import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import multer from 'multer';
import { sendEmail as sendGridEmail, getPaymentReceiptEmailTemplate } from '../sendgrid';
import { uploadFile, getFile } from '../storage/file-storage';

const router = Router();

// Configure multer for file uploads (memoryStorage for R2 support)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/xml', 'text/xml'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xml')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF y XML'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// POST /api/treasury/payments/:id/receipts - Subir comprobante
router.post("/api/treasury/payments/:id/receipts", jwtAuthMiddleware, upload.single('file'), async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const paymentId = parseInt(req.params.id);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Upload to R2 or local storage
      const uploadResult = await uploadFile(
        file.buffer,
        'receipts',
        file.originalname,
        file.mimetype
      );
      console.log(`[Receipt Upload] Archivo subido a ${uploadResult.storage}: ${uploadResult.url}`);

      const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'xml';

      const result = await sql(`
        INSERT INTO payment_receipts (payment_id, file_name, file_url, file_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [paymentId, file.originalname, uploadResult.url, fileType, user.id]);

      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      res.status(500).json({ error: 'Failed to upload receipt' });
    }
  });

  // GET /api/treasury/payments/:id/receipts - Listar comprobantes de un pago
  router.get("/api/treasury/payments/:id/receipts", jwtAuthMiddleware, async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);

      const result = await sql(`
        SELECT * FROM payment_receipts
        WHERE payment_id = $1
        ORDER BY uploaded_at DESC
      `, [paymentId]);

      res.json(result);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      res.status(500).json({ error: 'Failed to fetch receipts' });
    }
  });

  // POST /api/treasury/receipts/send - Enviar comprobantes por email
  router.post("/api/treasury/receipts/send", jwtAuthMiddleware, async (req, res) => {
    try {
      const { receiptIds, emails } = req.body;

      if (!receiptIds || !emails || emails.length === 0) {
        return res.status(400).json({ error: 'receiptIds and emails are required' });
      }

      // Obtener los comprobantes y datos del pago
      const receipts = await sql(`
        SELECT pr.*, sp.supplier_name, sp.amount, sp.currency, sp.reference
        FROM payment_receipts pr
        JOIN scheduled_payments sp ON pr.payment_id = sp.id
        WHERE pr.id = ANY($1)
      `, [receiptIds]);

      if (receipts.length === 0) {
        return res.status(404).json({ error: 'No receipts found' });
      }

      // Preparar archivos adjuntos (soporta R2 y local)
      const attachments = [];
      for (const receipt of receipts) {
        try {
          const fileContent = await getFile(receipt.file_url);
          const base64Content = fileContent.toString('base64');

          attachments.push({
            content: base64Content,
            filename: receipt.file_name,
            type: receipt.file_type === 'pdf' ? 'application/pdf' : 'application/xml',
            disposition: 'attachment'
          });
        } catch (err) {
          console.error(`[Email] No se pudo obtener archivo: ${receipt.file_url}`, err);
        }
      }

      // Obtener template de email
      const payment = receipts[0];
      const emailTemplate = getPaymentReceiptEmailTemplate(payment, receipts);

      // Enviar email a cada destinatario
      for (const email of emails) {
        await sendGridEmail({
          to: email,
          from: 'marioreynoso@grupoorsega.com',
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
          attachments: attachments
        });
      }

      // Actualizar registro
      await sql(`
        UPDATE payment_receipts
        SET sent_to = $1, sent_at = NOW()
        WHERE id = ANY($2)
      `, [emails, receiptIds]);

      res.json({ success: true, message: `Comprobantes enviados a ${emails.join(', ')}` });
    } catch (error) {
      console.error('Error sending receipts:', error);
      res.status(500).json({ error: 'Failed to send receipts' });
    }
  });

  // GET /api/treasury/complements - Listar complementos de pago
  router.get("/api/treasury/complements", jwtAuthMiddleware, async (req, res) => {
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
        SELECT * FROM payment_complements
        ${whereClause}
        ORDER BY created_at DESC
      `, params);

      res.json(result);
    } catch (error) {
      console.error('Error fetching complements:', error);
      res.status(500).json({ error: 'Failed to fetch complements' });
    }
  });

  // POST /api/treasury/complements - Crear complemento de pago
  router.post("/api/treasury/complements", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { companyId, clientName, invoiceReference, amount, currency } = req.body;

      const result = await sql(`
        INSERT INTO payment_complements (
          company_id, client_name, invoice_reference, amount, currency, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [companyId, clientName, invoiceReference, amount, currency || 'MXN', user.id]);

      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error creating complement:', error);
      res.status(500).json({ error: 'Failed to create complement' });
    }
  });

  // PUT /api/treasury/complements/:id/generate - Generar complemento
  router.put("/api/treasury/complements/:id/generate", jwtAuthMiddleware, async (req, res) => {
    try {
      const complementId = parseInt(req.params.id);

      // TODO: Implementar generacion de PDF del complemento
      const complementUrl = `/uploads/complements/complement-${complementId}.pdf`;

      const result = await sql(`
        UPDATE payment_complements
        SET status = 'generated', generated_at = NOW(), complement_url = $1
        WHERE id = $2
        RETURNING *
      `, [complementUrl, complementId]);

      if (result.length === 0) {
        return res.status(404).json({ error: 'Complement not found' });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Error generating complement:', error);
      res.status(500).json({ error: 'Failed to generate complement' });
    }
  });

export default router;
