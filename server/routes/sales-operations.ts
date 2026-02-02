import { Router } from 'express';
import { sql } from './_helpers';
import { getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { updateWeeklySales, autoCloseMonth } from '../../scripts/weekly_sales_update';
import { storage } from '../storage';
import { parseNumericValue } from '@shared/kpi-utils';

const router = Router();

  router.post("/api/sales/weekly-update", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/weekly-update] SIMPLIFICADO - Recibida solicitud:`, req.body);

      const { value, companyId, weekNumber, month, year, adminOverride } = req.body;
      const user = getAuthUser(req as AuthRequest);

      // Validar que se proporcionen los datos mínimos necesarios
      if (!value || !companyId) {
        return res.status(400).json({
          message: "Datos insuficientes. Se requiere value y companyId"
        });
      }

      // Preparar datos para la actualización (con soporte para modo administrador)
      const salesData: any = {
        value: parseFloat(value),
        companyId: parseInt(companyId || '1'), // Default a Dura International
        userId: user.id // Usuario autenticado
      };

      // Si es administrador y tiene adminOverride, agregar parámetros manuales
      if (user.role === 'admin' && adminOverride && weekNumber && month && year) {
        salesData.adminOverride = true;
        salesData.weekNumber = weekNumber;
        salesData.month = month;
        salesData.year = parseInt(year);
        console.log(`[POST /api/sales/weekly-update] ADMIN OVERRIDE - Período manual: ${weekNumber} - ${month} ${year}`);
      } else {
        console.log(`[POST /api/sales/weekly-update] Modo normal - detección automática`);
      }

      // PROTECCIÓN: Verificar si el mes ya está cerrado antes de permitir actualizaciones
      let targetMonth: string, targetYear: number;

      if (salesData.adminOverride && salesData.month && salesData.year) {
        // Usar período manual del administrador
        targetMonth = salesData.month;
        targetYear = salesData.year;
      } else {
        // Usar período automático actual
        const today = new Date();
        const monthNames = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        targetMonth = monthNames[today.getMonth()];
        targetYear = today.getFullYear();
      }

      // Verificar si el mes está cerrado (solo para usuarios no-admin o admin sin override explícito)
      const shouldCheckClosure = !(user.role === 'admin' && salesData.adminOverride);

      if (shouldCheckClosure) {
        const allKpis = await storage.getKpis();
        const volumeKpi = allKpis.find(kpi =>
          kpi.name.includes("Volumen de ventas") &&
          kpi.companyId === salesData.companyId
        );

        if (volumeKpi) {
          const kpiValues = await storage.getKpiValuesByKpi(volumeKpi.id, volumeKpi.companyId ?? salesData.companyId);
          const monthlyRecord = kpiValues.find(value =>
            value.period === `${targetMonth} ${targetYear}` && !value.period.includes('Semana')
          );

          if (monthlyRecord) {
            console.log(`[POST /api/sales/weekly-update] ❌ ACCESO DENEGADO - Mes ${targetMonth} ${targetYear} ya está cerrado`);
            return res.status(409).json({
              success: false,
              message: `El mes ${targetMonth} ${targetYear} ya está cerrado y no se pueden hacer más actualizaciones.`,
              monthStatus: {
                closed: true,
                period: `${targetMonth} ${targetYear}`,
                closedValue: monthlyRecord.value,
                closedDate: monthlyRecord.date
              },
              suggestion: "Contacta a un administrador si necesitas actualizar este período."
            });
          }
        }
      } else {
        console.log(`[POST /api/sales/weekly-update] 🔓 ADMIN OVERRIDE - Permitiendo actualización en período ${targetMonth} ${targetYear}`);
      }

      // Llamar a la función de actualización semanal
      const result = await updateWeeklySales(salesData);

      if (result.success) {
        console.log(`[POST /api/sales/weekly-update] ✅ Actualización exitosa:`, {
          period: result.currentPeriod?.period,
          monthlyPreview: result.monthlyPreview?.formattedValue
        });

        res.status(200).json({
          success: true,
          message: result.message || "Ventas actualizadas exitosamente",
          weeklyRecord: result.weeklyRecord,
          currentPeriod: result.currentPeriod,
          monthlyPreview: result.monthlyPreview
        });
      } else {
        console.error(`[POST /api/sales/weekly-update] ❌ Error:`, result.message);
        res.status(400).json({
          success: false,
          message: result.message || "Error al actualizar datos de ventas"
        });
      }
    } catch (error: any) {
      console.error('[POST /api/sales/weekly-update] ❌ Error crítico:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  });

  // SIMPLIFIED: Monthly Sales Update Endpoint - Direct monthly updates
  router.post("/api/sales/update-month", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/update-month] Recibida solicitud:`, req.body);

      const { value, companyId, month, year, period } = req.body;
      const user = getAuthUser(req as AuthRequest);

      const numericCompanyId = Number(companyId);
      const numericYear = Number(year);

      if (!value || isNaN(numericCompanyId) || !month || isNaN(numericYear)) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos requeridos: valor, compañía, mes y año"
        });
      }

      if (numericCompanyId !== 1 && numericCompanyId !== 2) {
        return res.status(400).json({
          success: false,
          message: "companyId debe ser 1 (Dura) o 2 (Orsega)"
        });
      }

      // Buscar el KPI de ventas por nombre en lugar de usar ID hardcodeado
      const allKpis = await storage.getKpis(numericCompanyId);
      const salesKpi = allKpis.find((kpi: any) => {
        const name = (kpi.name || kpi.kpiName || '').toLowerCase();
        return (name.includes('volumen') && name.includes('ventas')) ||
               name.includes('ventas') ||
               name.includes('sales');
      });

      if (!salesKpi) {
        console.error(`[POST /api/sales/update-month] ❌ KPI de ventas no encontrado para companyId ${numericCompanyId}`);
        return res.status(404).json({
          success: false,
          message: `KPI de ventas no encontrado. Por favor, verifica que el KPI de ventas esté configurado para ${numericCompanyId === 1 ? 'Dura International' : 'Grupo Orsega'}.`
        });
      }

      const kpiId = salesKpi.id;
      const periodString = period || `${month} ${numericYear}`;

      console.log(`[POST /api/sales/update-month] KPI encontrado: ID ${kpiId}, nombre "${salesKpi.name}" para companyId ${numericCompanyId}`);
      console.log(`[POST /api/sales/update-month] Actualizando para período: ${periodString}`);

      const createdValue = await storage.createKpiValue({
        companyId: numericCompanyId,
        kpiId,
        value: value.toString(),
        period: periodString,
        month,
        year: numericYear,
        updatedBy: user.id,
      });

      // Calcular monthlyTarget desde annualGoal del KPI (NO hardcodeado)
      let monthlyTarget: number;
      if (salesKpi.annualGoal) {
        // Prioridad 1: Usar annualGoal del KPI
        const annualGoal = parseFloat(String(salesKpi.annualGoal).toString().replace(/[^0-9.-]+/g, ''));
        if (!isNaN(annualGoal) && annualGoal > 0) {
          monthlyTarget = Math.round(annualGoal / 12);
          console.log(`[POST /api/sales/update-month] ✅ Usando annualGoal del KPI: ${annualGoal} → monthlyTarget: ${monthlyTarget}`);
        } else {
          // Fallback a goal mensual * 12 / 12 = goal mensual
          const goalValue = parseFloat(String(salesKpi.goal || '').toString().replace(/[^0-9.-]+/g, ''));
          monthlyTarget = !isNaN(goalValue) && goalValue > 0 ? Math.round(goalValue) : (numericCompanyId === 1 ? 55620 : 858373);
        }
      } else {
        // Prioridad 2: Calcular desde goal mensual del KPI
        const goalValue = parseFloat(String(salesKpi.goal || '').toString().replace(/[^0-9.-]+/g, ''));
        monthlyTarget = !isNaN(goalValue) && goalValue > 0 ? Math.round(goalValue) : (numericCompanyId === 1 ? 55620 : 858373);
      }

      const numericValue = parseNumericValue(value);
      const compliance = isNaN(numericValue)
        ? null
        : Math.round((numericValue / monthlyTarget) * 100);

      res.status(200).json({
        success: true,
        message: `Ventas de ${periodString} actualizadas correctamente`,
        data: {
          period: periodString,
          value,
          monthlyTarget,
          compliance,
          record: createdValue,
          kpiId: kpiId, // Incluir el KPI ID en la respuesta para invalidación correcta
          companyId: numericCompanyId,
        }
      });

    } catch (error: any) {
      console.error('[POST /api/sales/update-month] ❌ Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al actualizar ventas mensuales"
      });
    }
  });

  // Manual monthly close endpoint (admin-only) - replaces automatic scheduler
  router.post("/api/sales/auto-close-month", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/auto-close-month] Iniciando auto-cierre mensual:`, req.body);

      const { companyId, month, year } = req.body;
      const user = getAuthUser(req as AuthRequest);

      // Validar que sea un usuario administrador
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Solo los administradores pueden ejecutar el auto-cierre mensual"
        });
      }

      // Si no se especifica companyId, cerrar para ambas empresas
      const companiesToClose = companyId ? [parseInt(companyId)] : [1, 2]; // 1=Dura, 2=Orsega

      console.log(`[POST /api/sales/auto-close-month] Procesando empresas:`, companiesToClose);

      const results = [];
      for (const compId of companiesToClose) {
        try {
          console.log(`[POST /api/sales/auto-close-month] Procesando empresa ${compId}...`);
          const result = await autoCloseMonth(compId, month, year);
          results.push({
            companyId: compId,
            success: result,
            message: result ? 'Mes cerrado exitosamente' : 'No hay datos para cerrar o ya está cerrado'
          });
        } catch (error: any) {
          console.error(`[POST /api/sales/auto-close-month] Error para empresa ${compId}:`, error);
          results.push({
            companyId: compId,
            success: false,
            message: error.message || 'Error al cerrar mes'
          });
        }
      }

      const allSuccessful = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      console.log(`[POST /api/sales/auto-close-month] ✅ Completado - ${successCount}/${results.length} empresas procesadas`);

      res.status(200).json({
        success: allSuccessful,
        message: `Auto-cierre completado: ${successCount}/${results.length} empresas procesadas`,
        results: results,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('[POST /api/sales/auto-close-month] ❌ Error crítico:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor durante el auto-cierre"
      });
    }
  });

  // NEW: Manual Monthly Close Endpoint (improved version for manual operations)
  router.post("/api/sales/monthly-close", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/monthly-close] CIERRE MANUAL iniciado:`, req.body);

      const { companyId, month, year, override = false } = req.body;
      const user = getAuthUser(req as AuthRequest);

      // Validar que sea un usuario administrador
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Solo los administradores pueden cerrar meses manualmente"
        });
      }

      // Validar parámetros requeridos
      if (!companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Parámetros requeridos: companyId, month, year"
        });
      }

      // Verificar si el mes ya está cerrado (evitar duplicados)
      const targetPeriod = `${month} ${year}`;
      const allKpis = await storage.getKpis();
      const volumeKpi = allKpis.find(kpi =>
        kpi.name.includes("Volumen de ventas") &&
        kpi.companyId === parseInt(companyId)
      );

      if (!volumeKpi) {
        return res.status(404).json({
          success: false,
          message: `No se encontró KPI de volumen de ventas para la compañía ${companyId}`
        });
      }

      // Verificar si ya existe un registro mensual
      const existingKpiValues = await storage.getKpiValuesByKpi(
        volumeKpi.id,
        volumeKpi.companyId ?? parseInt(companyId)
      );
      const existingMonthlyRecord = existingKpiValues.find(value =>
        value.period === targetPeriod && !value.period.includes('Semana')
      );

      if (existingMonthlyRecord && !override) {
        return res.status(409).json({
          success: false,
          message: `El mes ${month} ${year} ya está cerrado. Usa override=true para volver a cerrar.`,
          existingRecord: {
            id: existingMonthlyRecord.id,
            value: existingMonthlyRecord.value,
            date: existingMonthlyRecord.date,
            period: existingMonthlyRecord.period
          }
        });
      }

      console.log(`[POST /api/sales/monthly-close] Ejecutando cierre para empresa ${companyId}, período: ${targetPeriod}`);

      // Ejecutar cierre manual
      const result = await autoCloseMonth(parseInt(companyId), month, parseInt(year));

      if (result) {
        console.log(`[POST /api/sales/monthly-close] ✅ Cierre manual exitoso para compañía ${companyId}`);

        const actionText = existingMonthlyRecord && override ? 'actualizado' : 'cerrado';
        res.status(200).json({
          success: true,
          message: `Mes ${month} ${year} ${actionText} exitosamente`,
          companyId: parseInt(companyId),
          period: targetPeriod,
          wasOverride: !!(existingMonthlyRecord && override),
          closedBy: user.name || user.id
        });
      } else {
        console.error(`[POST /api/sales/monthly-close] ❌ Error en cierre manual para compañía ${companyId}`);
        res.status(500).json({
          success: false,
          message: `Error al cerrar el mes ${month} ${year} - posiblemente no hay datos semanales suficientes`
        });
      }

    } catch (error: any) {
      console.error('[POST /api/sales/monthly-close] ❌ Error crítico:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor durante cierre manual",
        error: error.message
      });
    }
  });

  // Check if a month is already closed (utility endpoint)
  router.get("/api/sales/monthly-status", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, month, year } = req.query;

      if (!companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Parámetros requeridos: companyId, month, year"
        });
      }

      const targetPeriod = `${month} ${year}`;
      const allKpis = await storage.getKpis();
      const volumeKpi = allKpis.find(kpi =>
        kpi.name.includes("Volumen de ventas") &&
        kpi.companyId === parseInt(companyId as string)
      );

      if (!volumeKpi) {
        return res.status(404).json({
          success: false,
          message: `No se encontró KPI de volumen de ventas para la compañía ${companyId}`
        });
      }

      // Buscar registro mensual y semanal
      const kpiValues = await storage.getKpiValuesByKpi(
        volumeKpi.id,
        volumeKpi.companyId ?? parseInt(companyId as string)
      );
      const monthlyRecord = kpiValues.find(value =>
        value.period === targetPeriod && !value.period.includes('Semana')
      );

      const weeklyRecords = kpiValues.filter(value =>
        value.period?.includes(month as string) &&
        value.period?.includes(year as string) &&
        value.period?.includes("Semana")
      );

      res.status(200).json({
        success: true,
        closed: !!monthlyRecord,
        period: targetPeriod,
        monthlyRecord: monthlyRecord || null,
        weeklyRecordsCount: weeklyRecords.length,
        weeklyRecords: weeklyRecords.map(w => ({
          period: w.period,
          value: w.value,
          date: w.date
        }))
      });

    } catch (error: any) {
      console.error('[GET /api/sales/monthly-status] Error:', error);
      res.status(500).json({
        success: false,
        message: "Error al consultar estado del mes"
      });
    }
  });

export default router;
