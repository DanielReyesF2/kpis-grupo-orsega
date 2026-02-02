import { Router } from 'express';
import { z } from 'zod';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { storage } from '../storage';

const router = Router();

// ========================================================================
// ACCOUNTING HUB ENDPOINTS
// ========================================================================

// GET /api/treasury/accounting/documents - Obtener documentos de contabilidad por empresa
router.get("/api/treasury/accounting/documents", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    // Non-admin users can only see their own company's data
    if (user.role !== 'admin' && companyId !== user.companyId) {
      return res.status(403).json({ error: 'Acceso denegado a datos de otra empresa' });
    }

    const vouchers = await storage.getPaymentVouchersByCompany(companyId);

    // Get scheduled payments only for the user's company
    const scheduledPayments = await storage.getScheduledPaymentsByCompany(companyId);
    const allCompanies = await storage.getCompanies();

    // Crear mapa de empresas para nombres
    const companiesMap = new Map(allCompanies.map(c => [c.id, c.name]));

    // Combinar vouchers y scheduled payments en documentos unificados
    const documents = vouchers.map((v: any) => ({
      id: v.id,
      type: v.invoiceFileUrl ? "invoice" : "voucher",
      companyId: v.payerCompanyId || v.payer_company_id,
      companyName: companiesMap.get(v.payerCompanyId || v.payer_company_id) || "N/A",
      supplierName: v.clientName || v.client_name,
      amount: v.extractedAmount || v.extracted_amount || 0,
      currency: v.extractedCurrency || v.extracted_currency || "MXN",
      date: v.extractedDate || v.extracted_date || v.createdAt || v.created_at,
      status: v.status || "factura_pagada",
      files: {
        invoice: v.invoiceFileUrl ? {
          url: v.invoiceFileUrl,
          name: v.invoiceFileName || "factura.pdf"
        } : undefined,
        voucher: v.voucherFileUrl ? {
          url: v.voucherFileUrl,
          name: v.voucherFileName || "comprobante.pdf"
        } : undefined,
        complement: v.complementFileUrl ? {
          url: v.complementFileUrl,
          name: v.complementFileName || "complemento.pdf"
        } : undefined,
      },
      extractedData: {
        invoiceNumber: v.extractedReference || v.extracted_reference,
        taxId: null, // No está en payment_vouchers actualmente
        bank: v.extractedBank || v.extracted_bank,
        reference: v.extractedReference || v.extracted_reference,
        trackingKey: v.extractedTrackingKey || v.extracted_tracking_key,
      },
    }));

    // Agregar scheduled payments como facturas pendientes
    const invoiceDocuments = scheduledPayments
      .filter((sp: any) => sp.status !== "payment_completed")
      .map((sp: any) => ({
        id: `sp-${sp.id}`,
        type: "invoice" as const,
        companyId: sp.companyId || sp.company_id,
        companyName: companiesMap.get(sp.companyId || sp.company_id) || "N/A",
        supplierName: sp.supplierName || sp.supplier_name || "N/A",
        amount: sp.amount || 0,
        currency: sp.currency || "MXN",
        date: sp.dueDate || sp.due_date || sp.createdAt || sp.created_at,
        status: sp.status || "pending",
        files: {
          invoice: sp.hydralFileUrl ? {
            url: sp.hydralFileUrl,
            name: sp.hydralFileName || "factura.pdf"
          } : undefined,
        },
        extractedData: {
          invoiceNumber: sp.reference,
          taxId: null,
          bank: null,
          reference: sp.reference,
          trackingKey: null,
        },
      }));

    res.json([...documents, ...invoiceDocuments]);
  } catch (error) {
    console.error("Error fetching accounting documents:", error);
    res.status(500).json({ error: "Error al obtener documentos" });
  }
});

// POST /api/treasury/accounting/download-batch - Descarga masiva de documentos
router.post("/api/treasury/accounting/download-batch", jwtAuthMiddleware, async (req, res) => {
  try {
    const { documentIds } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: "Se requiere un array de IDs de documentos" });
    }

    // Por ahora, retornar error ya que necesitaríamos una librería de compresión
    // En producción, usar archiver o similar
    res.status(501).json({
      error: "Descarga masiva en desarrollo",
      message: "Esta funcionalidad está en desarrollo. Por favor descarga los documentos individualmente."
    });
  } catch (error) {
    console.error("Error en descarga masiva:", error);
    res.status(500).json({ error: "Error al procesar descarga masiva" });
  }
});

// GET /api/treasury/accounting/export - Exportar resumen a Excel
router.get("/api/treasury/accounting/export", jwtAuthMiddleware, async (req, res) => {
  try {
    const { type, company, status, dateFrom, dateTo } = req.query;

    // Obtener documentos filtrados (similar a /documents pero con filtros)
    const vouchers = await storage.getPaymentVouchers();

    // Aplicar filtros básicos
    let filtered = vouchers;
    if (type && type !== "all") {
      // Filtrar por tipo si es necesario
    }
    if (company && company !== "all") {
      filtered = filtered.filter((v: any) => (v.payerCompanyId || v.payer_company_id) === parseInt(company as string));
    }
    if (status && status !== "all") {
      filtered = filtered.filter((v: any) => (v.status || "factura_pagada") === status);
    }

    // Generar CSV simple (en producción usar exceljs o similar)
    const csvRows = [
      ["Tipo", "Empresa", "Proveedor", "Monto", "Moneda", "Fecha", "Estado", "Referencia"].join(","),
      ...filtered.map((v: any) => [
        v.invoiceFileUrl ? "Factura" : "Comprobante",
        v.payerCompanyId || v.payer_company_id,
        v.clientName || v.client_name || "",
        v.extractedAmount || v.extracted_amount || 0,
        v.extractedCurrency || v.extracted_currency || "MXN",
        v.extractedDate || v.extracted_date || "",
        v.status || "factura_pagada",
        v.extractedReference || v.extracted_reference || "",
      ].join(","))
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="resumen-contabilidad-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvRows.join("\n"));
  } catch (error) {
    console.error("Error exportando resumen:", error);
    res.status(500).json({ error: "Error al exportar resumen" });
  }
});

export default router;
