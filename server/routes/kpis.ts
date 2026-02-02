import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { sql, getAuthUser, type AuthRequest, createKPIStatusChangeNotification, collaboratorPerformanceCache } from "./_helpers";
import { jwtAuthMiddleware, jwtAdminMiddleware } from "../auth";
import { insertKpiSchema, updateKpiSchema } from "@shared/schema";
import { calculateKpiStatus, calculateCompliance, parseNumericValue, isLowerBetterKPI } from "@shared/kpi-utils";
import { salesKpiTypeToCardType } from "@shared/kpi-card-types";
import { calculateSalesKpiValue, identifySalesKpiType } from "../sales-kpi-calculator";
import { db } from "../db";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { validateTenantAccess } from "../middleware/tenant-validation";

const router = Router();

// ==============================
// GET /api/kpis
// ==============================
router.get("/api/kpis", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const rawCompanyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

    console.log("🔵 [GET /api/kpis] Endpoint llamado");
    console.log(`📊 Usuario: ${user.name}, Company ID: ${rawCompanyId ?? "ALL"}`);

    const addKpiType = (list: any[]) =>
      list.map((kpi) => ({
        ...kpi,
        kpiType: salesKpiTypeToCardType(identifySalesKpiType(kpi.name || kpi.kpiName || ''))
      }));

    if (rawCompanyId !== undefined) {
      if (rawCompanyId !== 1 && rawCompanyId !== 2) {
        return res.status(400).json({ error: "Invalid company ID. Use 1 for Dura or 2 for Orsega." });
      }
      const result = await storage.getKpis(rawCompanyId);
      return res.json(addKpiType(result));
    }

    const result = await storage.getKpis();
    res.json(addKpiType(result));
  } catch (error: any) {
    console.error("❌ Error fetching KPIs:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// ==============================
// Admin: Fix Dura KPI goal/meta
// ==============================
router.post("/api/admin/fix-dura-kpi-goal", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Solo administradores' });
    }

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);

    // KPI de Volumen de Ventas de Dura: id 39 por convención
    const MONTHLY_GOAL = 53480; // en KG
    const UNIT = 'KG';
    const monthlyGoalStr = MONTHLY_GOAL.toString();

    const resultById = await sql`
      UPDATE kpis_dura
      SET goal = ${monthlyGoalStr}, unit = ${UNIT}
      WHERE id = 39
      RETURNING id, kpi_name, goal, unit
    `;

    let updatedRows = resultById.length;

    if (updatedRows === 0) {
      const resultByName = await sql`
        UPDATE kpis_dura
        SET goal = ${monthlyGoalStr}, unit = ${UNIT}
        WHERE lower(kpi_name) LIKE '%ventas%'
        RETURNING id, kpi_name, goal, unit
      `;
      updatedRows = resultByName.length;
    }

    return res.json({ ok: true, updated: updatedRows });
  } catch (error) {
    console.error('[POST /api/admin/fix-dura-kpi-goal] Error:', error);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// ==============================
// GET /api/kpis/:id
// ==============================
router.get("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de KPI inválido" });
    }

    let companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

    // Si no se proporciona companyId, intentar encontrarlo automáticamente
    if (!companyId || (companyId !== 1 && companyId !== 2)) {
      console.log(`[GET /api/kpis/${id}] companyId no proporcionado, buscando automáticamente...`);
      // Buscar en todas las empresas
      const duraKpi = await storage.getKpi(id, 1);
      const orsegaKpi = await storage.getKpi(id, 2);

      if (duraKpi) {
        companyId = 1;
      } else if (orsegaKpi) {
        companyId = 2;
      } else {
        // Si no se encuentra en ninguna tabla, intentar buscar en la lista de todos los KPIs
        const allKpis = await storage.getKpis();
        const match = allKpis.find((item) => item.id === id);
        if (match) {
          companyId = match.companyId ?? undefined;
        }
      }
    }

    if (!companyId || (companyId !== 1 && companyId !== 2)) {
      return res.status(404).json({ message: "KPI not found" });
    }

    const kpi = await storage.getKpi(id, companyId);
    if (!kpi) {
      return res.status(404).json({ message: "KPI not found" });
    }

    // Asegurar que el companyId esté presente en la respuesta
    const kpiResponse = {
      ...kpi,
      companyId: kpi.companyId ?? companyId, // Asegurar que companyId esté presente
      isLowerBetter: isLowerBetterKPI(kpi.name || ""),
    };

    console.log(`[GET /api/kpis/${id}] KPI encontrado:`, { id: kpiResponse.id, name: kpiResponse.name, companyId: kpiResponse.companyId });
    res.json(kpiResponse);
  } catch (error) {
    console.error(`[GET /api/kpis/${req.params.id}] Error:`, error);
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// ==============================
// POST /api/kpis
// ==============================
router.post("/api/kpis", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    // 🔒 SEGURO: Solo administradores y gerentes pueden crear KPIs
    if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
      return res.status(403).json({ message: "No tienes permisos para crear KPIs" });
    }

    const validatedData = insertKpiSchema.parse(req.body);

    // VUL-001: Validar acceso multi-tenant
    if (validatedData.companyId) {
      validateTenantAccess(req as AuthRequest, validatedData.companyId);
    }

    const kpi = await storage.createKpi(validatedData);
    collaboratorPerformanceCache.flushAll();
    res.status(201).json(kpi);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// ==============================
// PUT /api/kpis/:id
// ==============================
router.put("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
  // Parse ID outside try block to make it available in catch block
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "ID de KPI inválido" });
  }

  try {
    const authReq = req as AuthRequest;

    // 🔒 SEGURO: Solo administradores y gerentes pueden actualizar KPIs
    if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
      return res.status(403).json({ message: "No tienes permisos para actualizar KPIs" });
    }

    // Intentar obtener companyId del body, query, o buscarlo automáticamente
    let companyId: number | undefined;
    const bodyCompanyId = req.body?.companyId;
    const queryCompanyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

    if (bodyCompanyId !== undefined && bodyCompanyId !== null) {
      companyId = typeof bodyCompanyId === 'string' ? parseInt(bodyCompanyId, 10) : bodyCompanyId;
    } else if (queryCompanyId !== undefined) {
      companyId = queryCompanyId;
    } else {
      // Si no se proporciona, intentar encontrarlo automáticamente
      console.log(`[PUT /api/kpis/${id}] companyId no proporcionado, buscando automáticamente...`);
      // El storage.updateKpi intentará encontrarlo automáticamente
    }

    // Validar companyId solo si se proporcionó (si no, se buscará automáticamente)
    if (companyId !== undefined && companyId !== null) {
      if (companyId !== 1 && companyId !== 2) {
        return res.status(400).json({ message: "companyId debe ser 1 (Dura) o 2 (Orsega)" });
      }
    }

    const validatedData = updateKpiSchema.parse({
      ...req.body,
      companyId: companyId,
    });

    console.log(`[PUT /api/kpis/${id}] Datos validados:`, validatedData);

    // Actualizar el KPI - esto intentará encontrar companyId si no se proporcionó
    const kpi = await storage.updateKpi(id, validatedData);

    if (!kpi) {
      return res.status(404).json({ message: "KPI no encontrado o no se pudo actualizar" });
    }

    // Obtener el companyId real del KPI actualizado para validar acceso
    const finalCompanyId = kpi.companyId ?? companyId;

    // VUL-001: Validar acceso multi-tenant (después de obtener el companyId real)
    if (finalCompanyId) {
      try {
        validateTenantAccess(req as AuthRequest, finalCompanyId);
      } catch (tenantError) {
        console.error(`[PUT /api/kpis/${id}] Error de validación de tenant:`, tenantError);
        return res.status(403).json({
          message: tenantError instanceof Error ? tenantError.message : "Acceso denegado",
          code: 'TENANT_ACCESS_DENIED'
        });
      }
    }

    console.log(`[PUT /api/kpis/${id}] KPI actualizado exitosamente:`, kpi.id);
    collaboratorPerformanceCache.flushAll();
    res.json(kpi);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[PUT /api/kpis/${id}] Error de validación:`, error.errors);
      return res.status(400).json({ message: "Error de validación", errors: error.errors });
    }
    if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('Access denied'))) {
      console.error(`[PUT /api/kpis/${id}] Error de acceso:`, error.message);
      return res.status(403).json({ message: error.message });
    }
    // Capturar errores de DatabaseStorage que pueden lanzarse
    if (error instanceof Error && (error.message.includes('No se pudo determinar') || error.message.includes('no encontrado'))) {
      console.error(`[PUT /api/kpis/${id}] Error al encontrar KPI:`, error.message);
      return res.status(404).json({ message: error.message });
    }
    console.error(`[PUT /api/kpis/${id}] Error interno:`, error);
    console.error(`[PUT /api/kpis/${id}] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// ==============================
// DELETE /api/kpis/:id
// ==============================
router.delete("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    // 🔒 SEGURO: Solo administradores y gerentes pueden eliminar KPIs
    if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
      return res.status(403).json({ message: "No tienes permisos para eliminar KPIs" });
    }

    const id = parseInt(req.params.id, 10);
    let companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

    if (!companyId || (companyId !== 1 && companyId !== 2)) {
      const allKpis = await storage.getKpis();
      const match = allKpis.find((item) => item.id === id);
      if (!match) {
        return res.status(404).json({ message: "KPI not found" });
      }
      companyId = match.companyId ?? undefined;
    }

    // VUL-001: Validar acceso multi-tenant
    if (companyId) {
      validateTenantAccess(req as AuthRequest, companyId);
    }

    const success = companyId ? await storage.deleteKpi(id, companyId) : false;

    if (!success) {
      return res.status(404).json({ message: "KPI not found" });
    }

    collaboratorPerformanceCache.flushAll();
    res.json({ message: "KPI eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ==============================
// PATCH /api/kpis/:id/transfer - Transferir un KPI a otra persona
// ==============================
router.patch("/api/kpis/:id/transfer", jwtAuthMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "ID de KPI inválido" });
  }

  try {
    const authReq = req as AuthRequest;

    // 🔒 SEGURO: Solo administradores y gerentes pueden transferir KPIs
    if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
      return res.status(403).json({ message: "No tienes permisos para transferir KPIs" });
    }

    const { responsible, companyId: bodyCompanyId } = req.body;

    if (!responsible || typeof responsible !== 'string') {
      return res.status(400).json({ message: "El campo 'responsible' es requerido y debe ser una cadena de texto" });
    }

    // Determinar companyId del body o buscando el KPI
    let companyId: number | undefined;
    if (bodyCompanyId !== undefined && bodyCompanyId !== null) {
      companyId = typeof bodyCompanyId === 'string' ? parseInt(bodyCompanyId, 10) : bodyCompanyId;
    } else {
      // Si no se proporciona, buscar el KPI para obtener su companyId
      console.log(`[PATCH /api/kpis/${id}/transfer] companyId no proporcionado, buscando automáticamente...`);
      const allKpis = await storage.getKpis();
      const match = allKpis.find((item) => item.id === id);
      if (match) {
        companyId = match.companyId ?? undefined;
      }
    }

    if (companyId !== undefined && companyId !== null && companyId !== 1 && companyId !== 2) {
      return res.status(400).json({ message: "companyId debe ser 1 (Dura) o 2 (Orsega)" });
    }

    // VUL-001: Validar acceso multi-tenant
    if (companyId) {
      try {
        validateTenantAccess(req as AuthRequest, companyId);
      } catch (tenantError) {
        console.error(`[PATCH /api/kpis/${id}/transfer] Error de validación de tenant:`, tenantError);
        return res.status(403).json({
          message: tenantError instanceof Error ? tenantError.message : "Acceso denegado",
          code: 'TENANT_ACCESS_DENIED'
        });
      }
    }

    const kpi = await storage.updateKpi(id, { responsible, companyId });

    if (!kpi) {
      return res.status(404).json({ message: "KPI no encontrado o no se pudo transferir" });
    }

    console.log(`[PATCH /api/kpis/${id}/transfer] KPI transferido exitosamente a "${responsible}" por usuario ${authReq.user?.name} (role: ${authReq.user?.role})`);
    collaboratorPerformanceCache.flushAll();
    res.json(kpi);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('Access denied'))) {
      console.error(`[PATCH /api/kpis/${id}/transfer] Error de acceso:`, error.message);
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof Error && (error.message.includes('No se pudo determinar') || error.message.includes('no encontrado'))) {
      console.error(`[PATCH /api/kpis/${id}/transfer] Error al encontrar KPI:`, error.message);
      return res.status(404).json({ message: error.message });
    }
    console.error(`[PATCH /api/kpis/${id}/transfer] Error interno:`, error);
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});


// ==============================
// GET /api/kpis-by-user/:userId - Obtener KPIs específicos de un usuario
// ==============================
router.get("/api/kpis-by-user/:userId", jwtAuthMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    console.log(`🔵 [GET /api/kpis-by-user/${userId}] Endpoint llamado`);

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userKpis = await storage.getUserKpis(userId);
    const aggregated: any[] = [];
    aggregated.push(...userKpis);

    if (aggregated.length === 0) {
      const companiesToCheck = user.companyId ? [user.companyId] : [1, 2];
      const responsibleKey = (user.name?.split(' ')[0] || '').toLowerCase();

      for (const companyId of companiesToCheck) {
        if (companyId !== 1 && companyId !== 2) continue;
        const kpisByCompany = await storage.getKpis(companyId);
        const matches = kpisByCompany.filter((kpi) =>
          (kpi.responsible ?? '').toLowerCase().includes(responsibleKey)
        );
        aggregated.push(...matches);
      }
    }

    const deduped = Array.from(new Map(aggregated.map((kpi) => [kpi.id, kpi])).values());

    console.log(`📊 [GET /api/kpis-by-user/${userId}] Retornando ${deduped.length} KPIs para ${user.name}`);
    res.json(deduped);
  } catch (error) {
    console.error('❌ Error fetching KPIs by user:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs by user' });
  }
});


// ========================================

// Nueva ruta para eliminar KPI específico del usuario
router.delete("/api/user-kpis/:kpiId", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const kpiId = parseInt(req.params.kpiId, 10);
    const companyIdParam = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
    const companyId = companyIdParam ?? user.companyId ?? null;

    if (!companyId || (companyId !== 1 && companyId !== 2)) {
      return res.status(400).json({ message: "companyId query param es requerido (1=Dura, 2=Orsega)" });
    }

    const kpi = await storage.getKpi(kpiId, companyId);

    res.json({
      message: "Los KPIs se gestionan a nivel de compañía; no existen valores específicos por usuario que eliminar en este esquema.",
    });
  } catch (error) {
    console.error("Error eliminating user-specific KPI:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// ==============================
// KPI Value routes
// Endpoint para obtener top performers por área
// ==============================
router.get("/api/top-performers", jwtAuthMiddleware, async (req, res) => {
  try {
    const { companyId } = req.query;
    const parsedCompanyId = companyId ? parseInt(companyId as string, 10) : NaN;

    if (parsedCompanyId !== 1 && parsedCompanyId !== 2) {
      return res.status(400).json({ message: 'companyId es requerido (1=Dura, 2=Orsega)' });
    }

    const [areasList, kpis, values] = await Promise.all([
      storage.getAreasByCompany(parsedCompanyId),
      storage.getKpis(parsedCompanyId),
      storage.getKpiValues(parsedCompanyId),
    ]);

    const areaById = new Map(areasList.map((area) => [area.id, area]));
    const stats = new Map<number, { areaId: number; areaName: string; total: number; compliant: number }>();

    const valuesByKpi = new Map<number, any[]>();
    for (const value of values) {
      if (!valuesByKpi.has(value.kpiId)) {
        valuesByKpi.set(value.kpiId, []);
      }
      valuesByKpi.get(value.kpiId)!.push(value);
    }

    for (const valueList of valuesByKpi.values()) {
      valueList.sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });
    }

    for (const kpi of kpis) {
      if (!kpi.areaId) continue;
      const area = areaById.get(kpi.areaId);
      if (!area) continue;

      if (!stats.has(area.id)) {
        stats.set(area.id, { areaId: area.id, areaName: area.name, total: 0, compliant: 0 });
      }

      const areaStats = stats.get(area.id)!;
      areaStats.total += 1;

      const latest = valuesByKpi.get(kpi.id)?.[0];
      if (latest?.status === 'complies') {
        areaStats.compliant += 1;
      }
    }

    const response = Array.from(stats.values())
      .map((stat) => {
        const compliance = stat.total === 0 ? 0 : (stat.compliant * 100) / stat.total;
        return {
          area_name: stat.areaName,
          area_id: stat.areaId,
          total_kpis: stat.total,
          compliant_kpis: stat.compliant,
          compliance_percentage: Number(compliance.toFixed(2)),
        };
      })
      .sort((a, b) => {
        if (b.compliance_percentage === a.compliance_percentage) {
          return b.total_kpis - a.total_kpis;
        }
        return b.compliance_percentage - a.compliance_percentage;
      })
      .slice(0, 5);

    res.json(response);
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;
