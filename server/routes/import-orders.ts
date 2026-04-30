/**
 * Import Orders Routes — Módulo de Importaciones
 * CRUD + AI extraction + checklist + status flow
 * Multi-tenant: EVERY query filters by company_id from authenticated user
 */

import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { sql, getAuthUser, type AuthRequest } from "./_helpers";
import { jwtAuthMiddleware } from "../auth";
import { insertImportOrderSchema, insertImportOrderItemSchema, importOrderStatusSchema, importOrderStatusValues } from "@shared/schema";
import { extractPurchaseOrderData } from "../services/oc-extractor";
import { uploadFile } from "../storage/file-storage";

const router = Router();

// Multer config for OC uploads (PDF, Excel, Images — 20MB max)
const ocUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}. Use PDF, Excel o imagen.`));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Checklist items por stage (26 items total)
const DEFAULT_CHECKLIST: Array<{
  stage: string;
  label: string;
  type: "check" | "file";
  isRequired: boolean;
  sortOrder: number;
}> = [
  // OC Creada (4)
  { stage: "oc_created", label: "Documento OC subido", type: "file", isRequired: true, sortOrder: 1 },
  { stage: "oc_created", label: "Proveedor confirmado", type: "check", isRequired: true, sortOrder: 2 },
  { stage: "oc_created", label: "Incoterm definido", type: "check", isRequired: true, sortOrder: 3 },
  { stage: "oc_created", label: "Fecha estimada de embarque confirmada", type: "check", isRequired: true, sortOrder: 4 },

  // Camino a Aduana (5)
  { stage: "in_transit_to_customs", label: "Confirmación de embarque internacional", type: "check", isRequired: true, sortOrder: 1 },
  { stage: "in_transit_to_customs", label: "Bill of Lading / Guía aérea", type: "file", isRequired: true, sortOrder: 2 },
  { stage: "in_transit_to_customs", label: "Factura comercial", type: "file", isRequired: true, sortOrder: 3 },
  { stage: "in_transit_to_customs", label: "Packing list", type: "file", isRequired: true, sortOrder: 4 },
  { stage: "in_transit_to_customs", label: "Seguro de carga", type: "file", isRequired: true, sortOrder: 5 },

  // En Aduana (4)
  { stage: "in_customs", label: "Pedimento de importación", type: "file", isRequired: true, sortOrder: 1 },
  { stage: "in_customs", label: "Pago de impuestos/aranceles", type: "check", isRequired: true, sortOrder: 2 },
  { stage: "in_customs", label: "Inspección aduanal completada", type: "check", isRequired: true, sortOrder: 3 },
  { stage: "in_customs", label: "Liberación de mercancía", type: "check", isRequired: true, sortOrder: 4 },

  // En Patio (4 + 1 opcional)
  { stage: "in_yard", label: "Confirmación de llegada", type: "check", isRequired: true, sortOrder: 1 },
  { stage: "in_yard", label: "Descarga completada", type: "check", isRequired: true, sortOrder: 2 },
  { stage: "in_yard", label: "Conteo físico de inventario", type: "check", isRequired: true, sortOrder: 3 },
  { stage: "in_yard", label: "Inspección de calidad", type: "check", isRequired: true, sortOrder: 4 },
  { stage: "in_yard", label: "Reporte de daños", type: "file", isRequired: false, sortOrder: 5 },

  // Camino a Bodega (3)
  { stage: "in_transit_to_warehouse", label: "Transportista asignado", type: "check", isRequired: true, sortOrder: 1 },
  { stage: "in_transit_to_warehouse", label: "Carga completada", type: "check", isRequired: true, sortOrder: 2 },
  { stage: "in_transit_to_warehouse", label: "Salida confirmada", type: "check", isRequired: true, sortOrder: 3 },

  // En Bodega (4)
  { stage: "in_warehouse", label: "Llegada a destino confirmada", type: "check", isRequired: true, sortOrder: 1 },
  { stage: "in_warehouse", label: "Recepción firmada", type: "check", isRequired: true, sortOrder: 2 },
  { stage: "in_warehouse", label: "Inventario verificado", type: "check", isRequired: true, sortOrder: 3 },
  { stage: "in_warehouse", label: "Documentación completa", type: "check", isRequired: true, sortOrder: 4 },
];

// Status flow — orden lineal
const STATUS_ORDER = [
  "oc_created",
  "in_transit_to_customs",
  "in_customs",
  "in_yard",
  "in_transit_to_warehouse",
  "in_warehouse",
] as const;

// Valid status values for filtering (excludes "all")
const VALID_STATUSES = new Set(importOrderStatusValues);

// Helper: resolver companyId del usuario autenticado
// Prioriza el query param si el usuario es admin (puede ver ambas empresas)
function resolveCompanyId(user: NonNullable<AuthRequest["user"]>, queryCompanyId?: string): number {
  // Admin puede filtrar por cualquier empresa
  if (user.role === "admin" && queryCompanyId && queryCompanyId !== "all") {
    const parsed = parseInt(queryCompanyId);
    if (parsed === 1 || parsed === 2) return parsed;
  }
  // Non-admin: siempre su propia empresa
  if (user.companyId) return user.companyId;
  // Fallback (admin sin query param): retorna el query o default 1
  if (queryCompanyId && queryCompanyId !== "all") {
    const parsed = parseInt(queryCompanyId);
    if (parsed === 1 || parsed === 2) return parsed;
  }
  return 1;
}

// Helper: generar referencia auto-incremental (con retry para race conditions)
async function generateReference(companyId: number): Promise<string> {
  const prefix = companyId === 1 ? "DUR" : "ORS";
  const year = new Date().getFullYear();
  const pattern = `IMP-${prefix}-${year}-%`;

  // Usar COALESCE + MAX para obtener el siguiente número disponible
  const result = await sql`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(reference FROM '\\d{4}$') AS int)),
      0
    ) + 1 AS next_num
    FROM import_orders
    WHERE company_id = ${companyId}
    AND reference LIKE ${pattern}
  `;
  const nextNum = result[0]?.next_num || 1;
  const padded = String(nextNum).padStart(4, "0");
  return `IMP-${prefix}-${year}-${padded}`;
}

// Helper: verificar que un import order pertenece a la empresa del usuario
async function verifyOrderOwnership(orderId: number, companyId: number): Promise<Record<string, unknown> | null> {
  const orders = await sql`
    SELECT * FROM import_orders WHERE id = ${orderId} AND company_id = ${companyId}
  `;
  return orders.length > 0 ? orders[0] : null;
}

// ============================================
// POST /api/import-orders/extract
// Recibe archivo, Claude extrae datos, retorna JSON
// ============================================
router.post(
  "/api/import-orders/extract",
  jwtAuthMiddleware,
  (req, res, next) => {
    ocUpload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      if (!req.file) {
        return res.status(400).json({ message: "No se recibió archivo" });
      }

      console.log(`[Import-Orders] Extracting OC data from ${req.file.originalname} by user ${user.id}`);

      const extracted = await extractPurchaseOrderData(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      res.json({
        extracted,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      });
    } catch (error) {
      console.error("[Import-Orders] Extract error:", error);
      res.status(500).json({ message: "Error extrayendo datos del documento" });
    }
  }
);

// ============================================
// GET /api/import-orders
// Lista con filtros (companyId, status, page, limit)
// Multi-tenant: filtra por empresa del usuario
// ============================================
router.get("/api/import-orders", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const { companyId: queryCompanyId, status, page = "1", limit = "50" } = req.query;

    const companyId = resolveCompanyId(user, queryCompanyId as string);

    let query = `
      SELECT io.*,
        (SELECT json_agg(json_build_object(
          'id', ioi.id, 'productName', ioi.product_name,
          'quantity', ioi.quantity, 'unit', ioi.unit, 'unitPrice', ioi.unit_price
        )) FROM import_order_items ioi WHERE ioi.import_order_id = io.id) as items,
        (SELECT COUNT(*)::int FROM import_order_checklist_items
         WHERE import_order_id = io.id AND stage = io.status AND is_required = true) as total_required,
        (SELECT COUNT(*)::int FROM import_order_checklist_items
         WHERE import_order_id = io.id AND stage = io.status AND is_required = true AND is_completed = true) as completed_required
      FROM import_orders io
      WHERE io.company_id = $1
    `;
    const params: (string | number)[] = [companyId];

    // Only apply status filter if it's a valid status (ignore "all" or invalid values)
    if (status && typeof status === "string" && VALID_STATUSES.has(status as typeof importOrderStatusValues[number])) {
      params.push(status);
      query += ` AND io.status = $${params.length}`;
    }

    query += ` ORDER BY io.created_at DESC`;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;
    params.push(limitNum);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const orders = await sql(query, params);

    res.json(orders);
  } catch (error) {
    console.error("[Import-Orders] List error:", error);
    res.status(500).json({ message: "Error obteniendo importaciones" });
  }
});

// ============================================
// GET /api/import-orders/:id
// Detalle con items + checklist + actividad
// Multi-tenant: verifica pertenencia a la empresa
// ============================================
router.get("/api/import-orders/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = getAuthUser(req as AuthRequest);
    const companyId = resolveCompanyId(user);

    const order = await verifyOrderOwnership(parseInt(id), companyId);
    if (!order) {
      return res.status(404).json({ message: "Importación no encontrada" });
    }

    const [items, checklist, activity] = await Promise.all([
      sql`SELECT * FROM import_order_items WHERE import_order_id = ${order.id} ORDER BY id`,
      sql`SELECT * FROM import_order_checklist_items WHERE import_order_id = ${order.id} ORDER BY stage, sort_order`,
      sql`SELECT * FROM import_order_activity_log WHERE import_order_id = ${order.id} ORDER BY created_at DESC LIMIT 50`,
    ]);

    res.json({ ...order, items, checklist, activity });
  } catch (error) {
    console.error("[Import-Orders] Detail error:", error);
    res.status(500).json({ message: "Error obteniendo detalle de importación" });
  }
});

// ============================================
// POST /api/import-orders
// Crear (con items) + siembra checklist + sube archivo OC
// ============================================
router.post(
  "/api/import-orders",
  jwtAuthMiddleware,
  (req, res, next) => {
    ocUpload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);

      // Parse body — items viene como JSON string en multipart
      const body = typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body;

      const validatedOrder = insertImportOrderSchema.parse({
        ...body,
        companyId: parseInt(body.companyId),
      });

      // Validate dates if provided
      const estimatedShipDate = body.estimatedShipDate && /^\d{4}-\d{2}-\d{2}$/.test(body.estimatedShipDate)
        ? body.estimatedShipDate
        : null;
      const estimatedArrivalDate = body.estimatedArrivalDate && /^\d{4}-\d{2}-\d{2}$/.test(body.estimatedArrivalDate)
        ? body.estimatedArrivalDate
        : null;

      // Validate totalValue if provided
      const totalValue = body.totalValue && !isNaN(Number(body.totalValue))
        ? Number(body.totalValue)
        : null;

      const items: z.infer<typeof insertImportOrderItemSchema>[] = [];
      if (Array.isArray(body.items)) {
        for (const item of body.items) {
          items.push(insertImportOrderItemSchema.parse(item));
        }
      }

      // Generate reference
      const reference = await generateReference(validatedOrder.companyId);

      // Upload OC document if provided
      let ocDocumentKey: string | null = null;
      let ocDocumentName: string | null = null;
      if (req.file) {
        const uploadResult = await uploadFile(
          req.file.buffer,
          "importaciones",
          req.file.originalname,
          req.file.mimetype
        );
        ocDocumentKey = uploadResult.key;
        ocDocumentName = req.file.originalname;
      }

      // Insert order
      const insertResult = await sql`
        INSERT INTO import_orders (
          company_id, reference, status,
          oc_document_key, oc_document_name,
          supplier_name, supplier_country,
          incoterm, currency, total_value, purchase_order_number,
          destination, destination_detail,
          estimated_ship_date, estimated_arrival_date,
          notes, created_by
        ) VALUES (
          ${validatedOrder.companyId}, ${reference}, 'oc_created',
          ${ocDocumentKey}, ${ocDocumentName},
          ${validatedOrder.supplierName}, ${validatedOrder.supplierCountry || null},
          ${validatedOrder.incoterm || null}, ${validatedOrder.currency || "USD"},
          ${totalValue}, ${validatedOrder.purchaseOrderNumber || null},
          ${validatedOrder.destination || "bodega_nextipac"}, ${validatedOrder.destinationDetail || null},
          ${estimatedShipDate}, ${estimatedArrivalDate},
          ${validatedOrder.notes || null}, ${user.id}
        )
        RETURNING *
      `;

      const order = insertResult[0];

      // Insert items (parameterized queries — user input, must be safe)
      for (const item of items) {
        await sql`
          INSERT INTO import_order_items (import_order_id, product_name, quantity, unit, unit_price, description)
          VALUES (${order.id}, ${item.productName}, ${item.quantity || null}, ${item.unit || null}, ${item.unitPrice || null}, ${item.description || null})
        `;
      }

      // Insert checklist items (parameterized — safe)
      for (const ci of DEFAULT_CHECKLIST) {
        const isOcDoc = ci.stage === "oc_created" && ci.label === "Documento OC subido";
        const isCompleted = isOcDoc && !!ocDocumentKey;
        await sql`
          INSERT INTO import_order_checklist_items
            (import_order_id, stage, label, type, is_required, sort_order, is_completed, completed_at, completed_by, file_key, file_name)
          VALUES
            (${order.id}, ${ci.stage}, ${ci.label}, ${ci.type}, ${ci.isRequired}, ${ci.sortOrder},
             ${isCompleted}, ${isCompleted ? new Date().toISOString() : null}, ${isCompleted ? user.id : null},
             ${isOcDoc && ocDocumentKey ? ocDocumentKey : null}, ${isOcDoc && ocDocumentName ? ocDocumentName : null})
        `;
      }

      // Activity log
      await sql`
        INSERT INTO import_order_activity_log (import_order_id, action, to_status, details, user_id, user_name)
        VALUES (${order.id}, 'created', 'oc_created', ${'Importación creada' + (ocDocumentKey ? ' (AI extracción)' : '')}, ${user.id}, ${user.name})
      `;

      console.log(`[Import-Orders] Created ${reference} by user ${user.id}`);

      // Return full order with items
      const fullOrder = await sql`SELECT * FROM import_orders WHERE id = ${order.id}`;
      const orderItems = await sql`SELECT * FROM import_order_items WHERE import_order_id = ${order.id}`;

      res.status(201).json({ ...fullOrder[0], items: orderItems });
    } catch (error) {
      console.error("[Import-Orders] Create error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error creando importación" });
    }
  }
);

// ============================================
// PATCH /api/import-orders/:id
// Editar campos (fechas, envío, aduana, notas)
// Multi-tenant: verifica pertenencia
// ============================================
router.patch("/api/import-orders/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = getAuthUser(req as AuthRequest);
    const companyId = resolveCompanyId(user);
    const body = req.body;

    // Verify ownership
    const existing = await verifyOrderOwnership(parseInt(id), companyId);
    if (!existing) {
      return res.status(404).json({ message: "Importación no encontrada" });
    }

    // Campos permitidos para edición
    const allowedFields: Record<string, string> = {
      supplierName: "supplier_name",
      supplierCountry: "supplier_country",
      incoterm: "incoterm",
      currency: "currency",
      totalValue: "total_value",
      purchaseOrderNumber: "purchase_order_number",
      destination: "destination",
      destinationDetail: "destination_detail",
      estimatedShipDate: "estimated_ship_date",
      estimatedArrivalDate: "estimated_arrival_date",
      estimatedCustomsClearDate: "estimated_customs_clear_date",
      estimatedWarehouseDate: "estimated_warehouse_date",
      actualShipDate: "actual_ship_date",
      actualArrivalDate: "actual_arrival_date",
      actualCustomsClearDate: "actual_customs_clear_date",
      actualWarehouseDate: "actual_warehouse_date",
      vesselName: "vessel_name",
      containerNumber: "container_number",
      billOfLadingNumber: "bill_of_lading_number",
      pedimentoNumber: "pedimento_number",
      customsBroker: "customs_broker",
      localCarrier: "local_carrier",
      notes: "notes",
    };

    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
      if (body[jsKey] !== undefined) {
        params.push(body[jsKey] === "" ? null : body[jsKey]);
        setClauses.push(`${dbCol} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: "No hay campos para actualizar" });
    }

    setClauses.push("updated_at = NOW()");

    // WHERE includes company_id for extra safety
    params.push(parseInt(id));
    params.push(companyId);
    const query = `UPDATE import_orders SET ${setClauses.join(", ")} WHERE id = $${params.length - 1} AND company_id = $${params.length} RETURNING *`;

    const result = await sql(query, params);

    if (result.length === 0) {
      return res.status(404).json({ message: "Importación no encontrada" });
    }

    // Activity log
    const changedFields = Object.keys(body).filter((k) => allowedFields[k]);
    await sql`
      INSERT INTO import_order_activity_log (import_order_id, action, details, user_id, user_name)
      VALUES (${parseInt(id)}, 'updated', ${'Datos actualizados: ' + changedFields.join(', ')}, ${user.id}, ${user.name})
    `;

    res.json(result[0]);
  } catch (error) {
    console.error("[Import-Orders] Update error:", error);
    res.status(500).json({ message: "Error actualizando importación" });
  }
});

// ============================================
// PATCH /api/import-orders/:id/status
// Avanzar etapa (valida checklist completo)
// Multi-tenant: verifica pertenencia
// ============================================
router.patch("/api/import-orders/:id/status", jwtAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = getAuthUser(req as AuthRequest);
    const companyId = resolveCompanyId(user);
    const { status: newStatus } = req.body;

    // Validar nuevo status
    const parsed = importOrderStatusSchema.parse(newStatus);

    // Verify ownership
    const order = await verifyOrderOwnership(parseInt(id), companyId);
    if (!order) {
      return res.status(404).json({ message: "Importación no encontrada" });
    }

    const currentStatus = order.status as string;

    // Permitir cancelación desde cualquier estado
    if (parsed === "cancelled") {
      await sql`UPDATE import_orders SET status = 'cancelled', updated_at = NOW() WHERE id = ${parseInt(id)} AND company_id = ${companyId}`;
      await sql`
        INSERT INTO import_order_activity_log (import_order_id, action, from_status, to_status, details, user_id, user_name)
        VALUES (${parseInt(id)}, 'status_change', ${currentStatus}, 'cancelled', ${req.body.reason || 'Importación cancelada'}, ${user.id}, ${user.name})
      `;
      const updated = await sql`SELECT * FROM import_orders WHERE id = ${parseInt(id)}`;
      return res.json(updated[0]);
    }

    // Validar que es el siguiente paso (no se saltan etapas)
    const currentIndex = STATUS_ORDER.indexOf(currentStatus as typeof STATUS_ORDER[number]);
    const newIndex = STATUS_ORDER.indexOf(parsed as typeof STATUS_ORDER[number]);

    if (newIndex !== currentIndex + 1) {
      return res.status(400).json({
        message: `No se puede avanzar de "${currentStatus}" a "${parsed}". Solo se puede avanzar al siguiente paso.`,
      });
    }

    // Validar checklist de la etapa actual completo (solo requeridos)
    const incomplete = await sql`
      SELECT label FROM import_order_checklist_items
      WHERE import_order_id = ${parseInt(id)}
      AND stage = ${currentStatus}
      AND is_required = true
      AND is_completed = false
    `;

    if (incomplete.length > 0) {
      return res.status(400).json({
        message: `Faltan ${incomplete.length} items: ${incomplete.map((i: Record<string, unknown>) => i.label).join(", ")}`,
        missingItems: incomplete.map((i: Record<string, unknown>) => i.label),
      });
    }

    // Actualizar status
    await sql`UPDATE import_orders SET status = ${parsed}, updated_at = NOW() WHERE id = ${parseInt(id)} AND company_id = ${companyId}`;

    // Activity log
    await sql`
      INSERT INTO import_order_activity_log (import_order_id, action, from_status, to_status, details, user_id, user_name)
      VALUES (${parseInt(id)}, 'status_change', ${currentStatus}, ${parsed}, ${'Avanzó a ' + parsed}, ${user.id}, ${user.name})
    `;

    console.log(`[Import-Orders] ${order.reference} status: ${currentStatus} → ${parsed} by user ${user.id}`);

    const updated = await sql`SELECT * FROM import_orders WHERE id = ${parseInt(id)}`;
    res.json(updated[0]);
  } catch (error) {
    console.error("[Import-Orders] Status update error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Status inválido", errors: error.errors });
    }
    res.status(500).json({ message: "Error actualizando status" });
  }
});

// ============================================
// PATCH /api/import-orders/:id/checklist/:itemId
// Marcar check completado
// Multi-tenant + stage validation
// ============================================
router.patch("/api/import-orders/:id/checklist/:itemId", jwtAuthMiddleware, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const user = getAuthUser(req as AuthRequest);
    const companyId = resolveCompanyId(user);
    const { isCompleted } = req.body;

    // Verify ownership
    const order = await verifyOrderOwnership(parseInt(id), companyId);
    if (!order) {
      return res.status(404).json({ message: "Importación no encontrada" });
    }

    // Verify checklist item belongs to current or past stage (can't edit future stages)
    const currentStageIdx = STATUS_ORDER.indexOf(order.status as typeof STATUS_ORDER[number]);
    const checkItem = await sql`
      SELECT * FROM import_order_checklist_items WHERE id = ${parseInt(itemId)} AND import_order_id = ${parseInt(id)}
    `;
    if (checkItem.length === 0) {
      return res.status(404).json({ message: "Item de checklist no encontrado" });
    }

    const itemStageIdx = STATUS_ORDER.indexOf(checkItem[0].stage as typeof STATUS_ORDER[number]);
    if (itemStageIdx > currentStageIdx) {
      return res.status(400).json({ message: "No se puede modificar un item de una etapa futura" });
    }

    const result = await sql`
      UPDATE import_order_checklist_items
      SET is_completed = ${!!isCompleted},
          completed_at = ${isCompleted ? new Date().toISOString() : null},
          completed_by = ${isCompleted ? user.id : null}
      WHERE id = ${parseInt(itemId)} AND import_order_id = ${parseInt(id)}
      RETURNING *
    `;

    // Activity log
    const item = result[0];
    await sql`
      INSERT INTO import_order_activity_log (import_order_id, action, details, user_id, user_name)
      VALUES (${parseInt(id)}, ${isCompleted ? 'checklist_completed' : 'checklist_unchecked'}, ${item.label}, ${user.id}, ${user.name})
    `;

    res.json(result[0]);
  } catch (error) {
    console.error("[Import-Orders] Checklist update error:", error);
    res.status(500).json({ message: "Error actualizando checklist" });
  }
});

// ============================================
// POST /api/import-orders/:id/checklist/:itemId/upload
// Subir archivo para item tipo file
// Multi-tenant + stage validation
// ============================================
router.post(
  "/api/import-orders/:id/checklist/:itemId/upload",
  jwtAuthMiddleware,
  (req, res, next) => {
    ocUpload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id, itemId } = req.params;
      const user = getAuthUser(req as AuthRequest);
      const companyId = resolveCompanyId(user);

      if (!req.file) {
        return res.status(400).json({ message: "No se recibió archivo" });
      }

      // Verify ownership
      const order = await verifyOrderOwnership(parseInt(id), companyId);
      if (!order) {
        return res.status(404).json({ message: "Importación no encontrada" });
      }

      // Verify stage (can't upload to future stages)
      const currentStageIdx = STATUS_ORDER.indexOf(order.status as typeof STATUS_ORDER[number]);
      const checkItem = await sql`
        SELECT * FROM import_order_checklist_items WHERE id = ${parseInt(itemId)} AND import_order_id = ${parseInt(id)}
      `;
      if (checkItem.length === 0) {
        return res.status(404).json({ message: "Item de checklist no encontrado" });
      }
      const itemStageIdx = STATUS_ORDER.indexOf(checkItem[0].stage as typeof STATUS_ORDER[number]);
      if (itemStageIdx > currentStageIdx) {
        return res.status(400).json({ message: "No se puede subir archivo a una etapa futura" });
      }

      // Upload to R2
      const uploadResult = await uploadFile(
        req.file.buffer,
        "importaciones",
        req.file.originalname,
        req.file.mimetype
      );

      // Update checklist item
      const result = await sql`
        UPDATE import_order_checklist_items
        SET is_completed = true,
            completed_at = NOW(),
            completed_by = ${user.id},
            file_key = ${uploadResult.key},
            file_name = ${req.file.originalname}
        WHERE id = ${parseInt(itemId)} AND import_order_id = ${parseInt(id)}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ message: "Item de checklist no encontrado" });
      }

      // Activity log
      await sql`
        INSERT INTO import_order_activity_log (import_order_id, action, details, user_id, user_name)
        VALUES (${parseInt(id)}, 'file_uploaded', ${req.file.originalname + ' → ' + result[0].label}, ${user.id}, ${user.name})
      `;

      res.json(result[0]);
    } catch (error) {
      console.error("[Import-Orders] File upload error:", error);
      res.status(500).json({ message: "Error subiendo archivo" });
    }
  }
);

// ============================================
// GET /api/import-orders/:id/activity
// Log de actividad (multi-tenant)
// ============================================
router.get("/api/import-orders/:id/activity", jwtAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = getAuthUser(req as AuthRequest);
    const companyId = resolveCompanyId(user);

    // Verify ownership
    const order = await verifyOrderOwnership(parseInt(id), companyId);
    if (!order) {
      return res.status(404).json({ message: "Importación no encontrada" });
    }

    const activity = await sql`
      SELECT * FROM import_order_activity_log
      WHERE import_order_id = ${parseInt(id)}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    res.json(activity);
  } catch (error) {
    console.error("[Import-Orders] Activity error:", error);
    res.status(500).json({ message: "Error obteniendo actividad" });
  }
});

export default router;
