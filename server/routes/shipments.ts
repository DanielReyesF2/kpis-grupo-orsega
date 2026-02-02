import { Router } from 'express';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest, updateLogisticsKPIs } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { insertShipmentSchema, updateShipmentStatusSchema } from '@shared/schema';
import { sendEmail as sendGridEmail, getShipmentStatusEmailTemplate } from '../sendgrid';
import { z } from 'zod';
import { validateTenantAccess } from '../middleware/tenant-validation';

const router = Router();

  // Shipment routes with pagination and temporal filters
  router.get("/api/shipments", jwtAuthMiddleware, async (req, res) => {
    try {
      const {
        companyId,
        status,
        limit = '50', // Default 50 envíos por página
        page = '1',
        since // Filtro temporal: 'YYYY-MM-DD' o días como '30d'
      } = req.query;

      // Parse parameters
      const limitNum = parseInt(limit as string);
      const pageNum = parseInt(page as string);
      const offset = (pageNum - 1) * limitNum;

      // Calculate temporal filter
      let sinceDate: Date | undefined;
      if (since) {
        const sinceStr = since as string;
        if (sinceStr.endsWith('d')) {
          // Format like '30d' = 30 days ago
          const days = parseInt(sinceStr.replace('d', ''));
          sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - days);
        } else {
          // Format like '2025-01-15'
          sinceDate = new Date(sinceStr);
        }
      }

      let shipments: any[];

      if (companyId) {
        const companyIdNum = parseInt(companyId as string);
        shipments = await storage.getShipmentsByCompany(companyIdNum);
      } else {
        shipments = await storage.getShipments();
      }

      // Apply status filter
      if (status) {
        shipments = shipments.filter(s => s.status === status);
      }

      // Apply temporal filter
      if (sinceDate) {
        shipments = shipments.filter(s => {
          const shipmentDate = new Date(s.actualDeliveryDate || s.updatedAt || s.createdAt);
          return shipmentDate >= sinceDate!;
        });
      }

      // Sort by date (newest first) - CRITICAL for monthly grouping
      shipments.sort((a, b) => {
        const dateA = new Date(a.actualDeliveryDate || a.updatedAt || a.createdAt);
        const dateB = new Date(b.actualDeliveryDate || b.updatedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      // Apply pagination
      const total = shipments.length;
      const paginatedShipments = shipments.slice(offset, offset + limitNum);

      // Response with pagination metadata
      res.json({
        shipments: paginatedShipments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: offset + limitNum < total
        }
      });

    } catch (error) {
      console.error('[GET /api/shipments] Error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint para obtener productos únicos de envíos anteriores
  router.get("/api/shipments/products", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { companyId } = req.query;

      console.log("[GET /api/shipments/products] Usuario:", user.name, "Empresa filtro:", companyId);

      let whereConditions = ["product IS NOT NULL AND product != ''"];
      let queryParams: any[] = [];
      let paramCount = 0;

      // ✅ ACCESO UNIVERSAL: Todos los usuarios ven todos los productos
      // Sin restricciones por empresa o rol

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      const query = `
        SELECT DISTINCT product
        FROM shipments
        ${whereClause}
        ORDER BY product ASC
      `;

      const result = await sql(query, queryParams);
      const products = result.map((row: any) => row.product);

      console.log(`[GET /api/shipments/products] Encontrados ${products.length} productos únicos`);
      res.json(products);
    } catch (error) {
      console.error("[GET /api/shipments/products] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/api/shipments/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const shipment = await storage.getShipment(id);

      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }

      // Obtener items del embarque
      const items = await storage.getShipmentItems(id);

      res.json({ ...shipment, items });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/api/shipments/tracking/:trackingCode", jwtAuthMiddleware, async (req, res) => {
    try {
      const trackingCode = req.params.trackingCode;
      const shipment = await storage.getShipmentByTrackingCode(trackingCode);

      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }

      res.json(shipment);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/api/shipments", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log("[POST /api/shipments] Datos recibidos:", JSON.stringify(req.body, null, 2));

      // Extraer items del body
      const { items, ...shipmentData } = req.body;

      // Transformar fechas de string a Date antes de validar
      const transformedData = {
        ...shipmentData,
        estimatedDeliveryDate: shipmentData.estimatedDeliveryDate ? new Date(shipmentData.estimatedDeliveryDate) : null,
        departureDate: shipmentData.departureDate ? new Date(shipmentData.departureDate) : null,
        actualDeliveryDate: shipmentData.actualDeliveryDate ? new Date(shipmentData.actualDeliveryDate) : null
      };

      console.log("[POST /api/shipments] Datos transformados:", JSON.stringify(transformedData, null, 2));

      // Validar datos con Zod
      const validatedData = insertShipmentSchema.parse(transformedData);
      console.log("[POST /api/shipments] Datos validados:", JSON.stringify(validatedData, null, 2));

      // VUL-001: Validar acceso multi-tenant
      if (validatedData.companyId) {
        validateTenantAccess(req as AuthRequest, validatedData.companyId);
      }

      // Crear el envío
      const shipment = await storage.createShipment(validatedData);
      console.log("[POST /api/shipments] Envío creado:", shipment);

      // Crear items si existen
      if (items && Array.isArray(items) && items.length > 0) {
        const itemsToCreate = items.map((item: any) => ({
          shipmentId: shipment.id,
          product: item.product,
          quantity: item.quantity,
          unit: item.unit,
          description: item.description || null
        }));

        await storage.createShipmentItems(itemsToCreate);
        console.log("[POST /api/shipments] Items creados:", itemsToCreate.length);
      }

      // Obtener shipment con items
      const shipmentItems = await storage.getShipmentItems(shipment.id);

      res.status(201).json({ ...shipment, items: shipmentItems });
    } catch (error) {
      console.error("[POST /api/shipments] Error completo:", error);
      console.error("[POST /api/shipments] Stack trace:", (error as Error)?.stack);

      if (error instanceof z.ZodError) {
        console.error("[POST /api/shipments] ❌ Errores de validación:");
        error.errors.forEach((err) => {
          console.error(`  - Campo: ${err.path.join('.')}, Error: ${err.message}`);
        });
        return res.status(400).json({
          error: "Validation error",
          message: "Los datos enviados no son válidos",
          errors: error.errors,
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }

      // Si es un error de base de datos, dar más detalles
      if ((error as any)?.code) {
        console.error("[POST /api/shipments] ❌ Error de base de datos:", (error as any).code, (error as any).detail);
      }

      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message || "Error al crear el embarque. Por favor, verifica los datos e intenta nuevamente."
      });
    }
  });

  // Editar datos generales del envío
  router.patch("/api/shipments/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getShipment(id);
      if (!existing) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      const data = req.body || {};
      // Normalizar fechas si vienen como string
      const patch: any = { ...data };
      if (typeof patch.estimatedDeliveryDate === 'string') {
        patch.estimatedDeliveryDate = patch.estimatedDeliveryDate ? new Date(patch.estimatedDeliveryDate) : null;
      }
      if (typeof patch.departureDate === 'string') {
        patch.departureDate = patch.departureDate ? new Date(patch.departureDate) : null;
      }
      if (typeof patch.actualDeliveryDate === 'string') {
        patch.actualDeliveryDate = patch.actualDeliveryDate ? new Date(patch.actualDeliveryDate) : null;
      }
      const updated = await storage.updateShipment(id, patch);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update shipment" });
      }
      res.json(updated);
    } catch (error) {
      console.error("[PATCH /api/shipments/:id] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Shipment Items routes
  router.get("/api/shipments/:id/items", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const items = await storage.getShipmentItems(shipmentId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add shipment item
  router.post("/api/shipments/:id/items", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const existing = await storage.getShipment(shipmentId);
      if (!existing) return res.status(404).json({ message: "Shipment not found" });
      const { product, quantity, unit, description } = req.body || {};
      if (!product || !quantity || !unit) {
        return res.status(400).json({ message: "product, quantity y unit son requeridos" });
      }
      const created = await storage.createShipmentItem({
        shipmentId,
        product,
        quantity,
        unit,
        description: description || null
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("[POST /api/shipments/:id/items] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete shipment item
  router.delete("/api/shipments/:id/items/:itemId", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const existing = await storage.getShipment(shipmentId);
      if (!existing) return res.status(404).json({ message: "Shipment not found" });
      const ok = await storage.deleteShipmentItem(itemId);
      if (!ok) return res.status(404).json({ message: "Item not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/shipments/:id/items/:itemId] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/api/shipments/:id/items", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const shipmentId = parseInt(req.params.id);

      console.log(`[POST /api/shipments/${shipmentId}/items] Agregando item por ${user.name}:`, req.body);

      // Validar datos requeridos
      if (!req.body.product || !req.body.quantity || !req.body.unit) {
        return res.status(400).json({
          message: "Product, quantity, and unit are required",
          error: "Missing required fields"
        });
      }

      const itemData = {
        shipmentId,
        product: req.body.product,
        quantity: req.body.quantity,
        unit: req.body.unit,
        description: req.body.description || null
      };

      const item = await storage.createShipmentItem(itemData);

      if (!item) {
        return res.status(500).json({ message: "Error creating item" });
      }

      console.log(`[POST /api/shipments/${shipmentId}/items] Item creado exitosamente:`, item.id);
      res.status(201).json(item);
    } catch (error: any) {
      console.error("[POST /api/shipments/:id/items] Error:", error);
      res.status(500).json({
        message: error?.message || "Internal server error",
        error: String(error)
      });
    }
  });

  router.patch("/api/shipments/:id/items/:itemId", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const itemId = parseInt(req.params.itemId);

      console.log(`[PATCH /api/shipments/:id/items/${itemId}] Actualizando item por ${user.name}:`, req.body);

      // Validar que el item pertenezca al envío
      const shipmentId = parseInt(req.params.id);
      const existingItems = await storage.getShipmentItems(shipmentId);
      const item = existingItems.find((it: any) => it.id === itemId);

      if (!item) {
        console.error(`[PATCH /api/shipments/:id/items/${itemId}] Item no encontrado en envío ${shipmentId}`);
        return res.status(404).json({ message: "Item not found in this shipment" });
      }

      const updatedItem = await storage.updateShipmentItem(itemId, req.body);

      if (!updatedItem) {
        console.error(`[PATCH /api/shipments/:id/items/${itemId}] Error al actualizar item`);
        return res.status(500).json({ message: "Error updating item" });
      }

      console.log(`[PATCH /api/shipments/:id/items/${itemId}] Item actualizado exitosamente`);
      res.json(updatedItem);
    } catch (error: any) {
      console.error("[PATCH /api/shipments/:id/items/:itemId] Error:", error);
      res.status(500).json({
        message: error?.message || "Internal server error",
        error: String(error)
      });
    }
  });

  router.delete("/api/shipments/:id/items/:itemId", jwtAuthMiddleware, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const success = await storage.deleteShipmentItem(itemId);

      if (!success) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/shipments/:id/items/:itemId] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/api/shipments/:id/updates", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const updates = await storage.getShipmentUpdates(shipmentId);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Action Plan routes
  router.get("/api/action-plans", jwtAuthMiddleware, async (req, res) => {
    try {
      if (req.query.kpiId) {
        const kpiId = parseInt(req.query.kpiId as string);
        const actionPlans = await storage.getActionPlansByKpi(kpiId);
        res.json(actionPlans);
      } else {
        // For now, return empty array for general action plans
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/api/action-plans/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const actionPlan = await storage.getActionPlan(id);

      if (!actionPlan) {
        return res.status(404).json({ message: "Action plan not found" });
      }

      res.json(actionPlan);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Shipment Status Update with Notifications
  router.patch("/api/shipments/:id/status", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const user = getAuthUser(req as AuthRequest);
      const validatedData = updateShipmentStatusSchema.parse(req.body);

      console.log("[PATCH /api/shipments/:id/status] Actualizando estado del envío:", { shipmentId, data: validatedData });

      // Obtener el envío actual
      const shipment = await storage.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ message: "Envío no encontrado" });
      }

      // VALIDACIÓN: Si el nuevo estado es in_transit, debe tener número de factura
      if (validatedData.status === 'in_transit') {
        const hasInvoiceNumber = validatedData.invoiceNumber || shipment.invoiceNumber;
        if (!hasInvoiceNumber) {
          return res.status(400).json({
            message: "Número de factura requerido",
            error: "Para mover un envío a 'En Tránsito' es necesario proporcionar el número de factura.",
            requiresInvoiceNumber: true
          });
        }
      }

      // Verificar si el estado realmente cambió (idempotencia)
      const statusChanged = shipment.status !== validatedData.status;

      // Actualizar el envío con el nuevo estado y número de factura (si se proporciona)
      const updateData: any = {
        status: validatedData.status,
        updatedAt: new Date()
      };

      // Agregar invoiceNumber si se proporciona
      if (validatedData.invoiceNumber) {
        updateData.invoiceNumber = validatedData.invoiceNumber;
      }

      // KPIs de Logística: Capturar timestamps automáticamente según el estado
      if (validatedData.status === 'in_transit' && !shipment.inRouteAt) {
        updateData.inRouteAt = new Date();
        console.log(`[KPI Logística] Capturando timestamp inRouteAt para shipment ${shipmentId}`);
      }

      if (validatedData.status === 'delivered' && !shipment.deliveredAt) {
        const deliveryDate = new Date();
        updateData.deliveredAt = deliveryDate;
        updateData.actualDeliveryDate = deliveryDate;
        console.log(`[KPI Logística] Capturando timestamp deliveredAt y actualDeliveryDate para shipment ${shipmentId}`);
      }

      const updatedShipment = await storage.updateShipment(shipmentId, updateData);

      if (!updatedShipment) {
        return res.status(404).json({ message: "Error al actualizar el envío" });
      }

      // Crear registro de actualización en el historial
      const shipmentUpdate = await storage.createShipmentUpdate({
        shipmentId: shipmentId,
        status: validatedData.status,
        location: validatedData.location || null,
        comments: validatedData.comments || null,
        updatedBy: user.id
      });

      // Recalculate cycle times automatically after status update
      try {
        await storage.recalculateShipmentCycleTime(shipmentId);
        console.log(`[Cycle Times] Recalculated for shipment ${shipmentId}`);
      } catch (cycleTimeError) {
        console.error(`[Cycle Times] Error recalculating for shipment ${shipmentId}:`, cycleTimeError);
        // Don't fail the status update for a cycle time calculation error
      }

      // KPIs de Logística: Actualizar automáticamente cuando se marca como entregado
      if (validatedData.status === 'delivered' && statusChanged) {
        try {
          await updateLogisticsKPIs(updatedShipment.companyId);
          console.log(`[KPI Logística] KPIs actualizados automáticamente para company ${updatedShipment.companyId}`);
        } catch (kpiError) {
          console.error(`[KPI Logística] Error actualizando KPIs:`, kpiError);
          // Don't fail the status update for a KPI calculation error
        }
      }

      // Sistema de notificaciones automáticas por email
      let emailNotificationSent = false;
      let emailWarning: string | null = null;

      if (statusChanged && validatedData.sendNotification !== false) {
        try {
          // Determinar destinatario y preferencias
          let recipientEmail: string | null = null;
          let emailNotificationsEnabled = true;
          let clientId: number | null = null;

          // Prioridad 1: customerId (relación con tabla clients)
          if (updatedShipment.customerId) {
            const clientQuery = await sql(
              `SELECT id, email, email_notifications FROM clients WHERE id = $1 LIMIT 1`,
              [updatedShipment.customerId]
            );

            if (clientQuery.length > 0) {
              const client = clientQuery[0];
              recipientEmail = client.email;
              emailNotificationsEnabled = client.email_notifications !== false;
              clientId = client.id;
              console.log(`[Notification] Cliente encontrado: ${recipientEmail}, notificaciones: ${emailNotificationsEnabled}`);
            }
          }

          // Prioridad 2: customerEmail (legacy/fallback)
          if (!recipientEmail && updatedShipment.customerEmail) {
            recipientEmail = updatedShipment.customerEmail;
            emailNotificationsEnabled = true; // Por defecto activado para legacy
            console.log(`[Notification] Usando customerEmail legacy: ${recipientEmail}`);
          }

          // Verificar idempotencia: ¿Ya se envió notificación para este estado?
          if (recipientEmail && emailNotificationsEnabled) {
            const existingNotificationQuery = await sql(
              `SELECT id FROM shipment_notifications
               WHERE shipment_id = $1 AND shipment_status = $2 AND status = 'sent' LIMIT 1`,
              [shipmentId, validatedData.status]
            );

            if (existingNotificationQuery.length > 0) {
              console.log(`[Notification] Ya existe notificación enviada para estado ${validatedData.status}, omitiendo duplicado`);
              emailWarning = 'Notificación ya enviada previamente para este estado';
            } else {
              // Enviar notificación usando la nueva función
              const { sendShipmentStatusNotification } = await import('../email-logistics.js');

              const emailResult = await sendShipmentStatusNotification({
                to: recipientEmail,
                shipment: updatedShipment,
                status: validatedData.status
              });

              // Registrar notificación en historial
              await storage.createShipmentNotification({
                shipmentId: shipmentId,
                emailTo: recipientEmail,
                subject: `Actualización de Envío - ${validatedData.status}`,
                status: 'sent',
                sentBy: user.id,
                shipmentStatus: validatedData.status,
                errorMessage: null
              });

              emailNotificationSent = true;
              console.log(`[Notification] Email enviado exitosamente a ${recipientEmail} (${emailResult.provider})`);
            }
          } else if (!recipientEmail) {
            emailWarning = 'No hay email de cliente configurado';
            console.log(`[Notification] Sin email de cliente para enviar notificación`);
          } else if (!emailNotificationsEnabled) {
            emailWarning = 'Cliente tiene notificaciones deshabilitadas';
            console.log(`[Notification] Cliente ${recipientEmail} tiene notificaciones deshabilitadas`);
          }
        } catch (emailError) {
          console.error("[Notification] Error al enviar notificación:", emailError);
          emailWarning = emailError instanceof Error ? emailError.message : 'Error desconocido';

          // Registrar fallo en historial
          if (updatedShipment.customerEmail) {
            try {
              await storage.createShipmentNotification({
                shipmentId: shipmentId,
                emailTo: updatedShipment.customerEmail,
                subject: `Actualización de Envío - ${validatedData.status}`,
                status: 'failed',
                sentBy: user.id,
                shipmentStatus: validatedData.status,
                errorMessage: emailWarning
              });
            } catch (logError) {
              console.error("[Notification] Error al registrar fallo:", logError);
            }
          }
        }
      }

      res.json({
        shipment: updatedShipment,
        update: shipmentUpdate,
        emailNotificationSent,
        emailWarning
      });
    } catch (error) {
      console.error("[PUT /api/shipments/:id/status] Error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Get shipment notification history
  router.get("/api/shipments/:id/notifications", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const notifications = await storage.getShipmentNotificationsByShipment(shipmentId);
      res.json(notifications);
    } catch (error) {
      console.error("[GET /api/shipments/:id/notifications] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Cycle Times API routes
  router.get("/api/shipments/:id/cycle-times", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);

      // Recalculate cycle times for this shipment to ensure freshness
      const cycleTime = await storage.recalculateShipmentCycleTime(shipmentId);

      if (!cycleTime) {
        return res.status(404).json({ message: "Envío no encontrado" });
      }

      res.json(cycleTime);
    } catch (error) {
      console.error("[GET /api/shipments/:id/cycle-times] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  router.get("/api/metrics/cycle-times", jwtAuthMiddleware, async (req, res) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const metrics = await storage.getAggregateCycleTimes(companyId, startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error("[GET /api/metrics/cycle-times] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

export default router;
