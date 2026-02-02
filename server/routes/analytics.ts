import { Router } from 'express';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { calculateSalesKpiHistory } from '../sales-kpi-calculator';
import { calculateKpiStatus, calculateCompliance, parseNumericValue, isLowerBetterKPI } from '@shared/kpi-utils';

const router = Router();

router.get("/api/job-profiles/:userId", jwtAuthMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const profile = await storage.getJobProfileWithDetails(userId);

    if (!profile) {
      return res.status(404).json({ message: "Perfil de trabajo no encontrado" });
    }

    res.json(profile);
  } catch (error) {
    console.error("[GET /api/job-profiles/:userId] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

router.get("/api/user-kpis/:userId", jwtAuthMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userKpis = await storage.getUserKpis(userId);
    res.json(userKpis);
  } catch (error) {
    console.error("[GET /api/user-kpis/:userId] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// KPI Overview - Vista consolidada para ejecutivos
router.get("/api/kpi-overview", jwtAuthMiddleware, async (req, res) => {
  try {
    const kpiOverview = await storage.getKPIOverview();
    res.json(kpiOverview);
  } catch (error) {
    console.error("[GET /api/kpi-overview] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// KPI History - Historial mensual de un KPI específico
router.get("/api/kpi-history/:kpiId", jwtAuthMiddleware, async (req, res) => {
  try {
    const kpiId = parseInt(req.params.kpiId);
    const months = parseInt(req.query.months as string) || 12;
    const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

    // Resolver companyId si no se proporciona
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const allKpis = await storage.getKpis();
      const kpi = allKpis.find(k => k.id === kpiId);
      if (kpi?.companyId) {
        resolvedCompanyId = kpi.companyId;
      } else {
        // Si no se puede resolver, usar lógica tradicional
        const kpiHistory = await storage.getKPIHistory(kpiId, months, companyId);
        return res.json(kpiHistory);
      }
    }

    // Obtener información del KPI para verificar si es de ventas
    const kpi = await storage.getKpi(kpiId, resolvedCompanyId);
    if (!kpi) {
      return res.status(404).json({ message: "KPI not found" });
    }

    const kpiName = kpi.name || '';

    // Si es un KPI de ventas, calcular historial desde sales_data
    if (storage.isSalesKpi(kpiName)) {
      console.log(`[GET /api/kpi-history/:kpiId] KPI de ventas detectado: ${kpiName}, calculando desde sales_data`);

      try {
        const historyResult = await calculateSalesKpiHistory(kpiName, resolvedCompanyId, months);

        if (!historyResult.supported) {
          return res.json([]);
        }

        // Formatear al formato esperado por el frontend (compatible con kpi_values)
        // El formato debe coincidir exactamente con mapKpiValueRecord
        const formattedHistory = historyResult.data.map(h => {
          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const monthIndex = h.date.getMonth();
          const monthName = monthNames[monthIndex];
          const year = h.date.getFullYear();
          // Formato de period debe ser: "Mes Año" (ej: "Enero 2025")
          const periodString = `${monthName} ${year}`;
          // month debe ser el nombre del mes (ej: "Enero"), no el número
          const monthString = monthName;

          return {
            id: 0, // Valor calculado, no tiene ID en BD
            kpiId: kpiId,
            companyId: resolvedCompanyId as 1 | 2,
            value: h.value.toString(), // Sin unidad, solo el número como string
            period: periodString,
            month: monthString,
            year: year,
            date: h.date,
            compliancePercentage: null,
            status: null,
            comments: 'Valor histórico calculado desde sales_data',
            updatedBy: null
          };
        });

        console.log(`[GET /api/kpi-history/:kpiId] Retornando ${formattedHistory.length} registros calculados desde sales_data`);
        return res.json(formattedHistory);
      } catch (error) {
        console.error(`[GET /api/kpi-history/:kpiId] Error calculando historial desde sales_data:`, error);
        // Fallback a lógica tradicional si hay error
        const kpiHistory = await storage.getKPIHistory(kpiId, months, resolvedCompanyId);
        return res.json(kpiHistory);
      }
    }

    // Si no es KPI de ventas, usar lógica tradicional (leer de kpi_values)
    const kpiHistory = await storage.getKPIHistory(kpiId, months, resolvedCompanyId);
    res.json(kpiHistory);
  } catch (error) {
    console.error("[GET /api/kpi-history/:kpiId] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// User KPI History - Historial de todos los KPIs de un usuario (Requiere autenticación)
router.get("/api/user-kpi-history/:userId", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const requestedUserId = parseInt(req.params.userId);
    const months = parseInt(req.query.months as string) || 6;

    // Security: Users can only see their own history unless they are admin/manager
    if (user?.id !== requestedUserId && user?.role !== 'admin' && user?.role !== 'manager') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo puedes ver tu propio historial de KPIs.'
      });
    }

    console.log(`[GET /api/user-kpi-history/:userId] User ${user?.id} requesting userId: ${requestedUserId}, months: ${months}`);

    const userHistory = await storage.getUserKPIHistory(requestedUserId, months);
    console.log(`[GET /api/user-kpi-history/:userId] Returning ${userHistory?.length || 0} records for user ${requestedUserId}`);
    res.json(userHistory);
  } catch (error) {
    console.error("[GET /api/user-kpi-history/:userId] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// KPI History by Users - Historial de un KPI con todos los usuarios
router.get("/api/kpi-history-by-users/:kpiId", jwtAuthMiddleware, async (req, res) => {
  try {
    const kpiId = parseInt(req.params.kpiId);
    const months = parseInt(req.query.months as string) || 6;

    const kpiHistory = await storage.getKPIHistoryByUsers(kpiId, months);

    if (!kpiHistory) {
      return res.status(404).json({ message: "KPI no encontrado" });
    }

    res.json(kpiHistory);
  } catch (error) {
    console.error("[GET /api/kpi-history-by-users/:kpiId] Error:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;
