import { Router } from 'express';
import { CHURN_AT_RISK_DAYS_MIN, CHURN_CRITICAL_DAYS_MIN } from '@shared/kpi-card-types';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { getSalesMetrics } from '../sales-metrics';
import { generateSalesAnalystInsights } from '../sales-analyst';
import { calculateRealProfitability } from '../profitability-metrics';
import { getAnnualSummary, getAvailableYears } from '../annual-summary';
import { emailService } from '../email-service';
import { z } from 'zod';

const router = Router();

// ============================================
// ============================================
// EMAIL TEST ENDPOINT (para probar Resend)
// ============================================
router.post("/api/test-email", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden enviar emails de prueba' });
    }

    const { to, department = 'treasury', useTestEmail = true } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Email destination required' });
    }

    // Para pruebas, usar email de Resend por defecto
    const fromEmail = useTestEmail
      ? 'onboarding@resend.dev'
      : undefined; // Si no usar test email, el servicio usará el dominio configurado

    console.log(`[TEST EMAIL] Enviando prueba a ${to} desde ${fromEmail || 'dominio configurado'}`);

    const testResult = await emailService.sendEmail({
      to,
      from: fromEmail,
      subject: 'Prueba de Email - Sistema Econova',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">✅ Email de Prueba Exitoso</h2>
          <p>Este es un email de prueba del sistema de Econova.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Departamento:</strong> ${department}</p>
            <p><strong>Remitente:</strong> ${fromEmail || 'Dominio configurado'}</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString('es-MX')}</p>
            <p><strong>Estado:</strong> ✅ Funcionando correctamente</p>
          </div>
          <p>El sistema de emails está configurado y funcionando.</p>
          <p>Saludos,<br>Equipo de Desarrollo - Econova</p>
        </div>
      `
    }, department as 'treasury' | 'logistics');

    if (!testResult.success) {
      console.error('[TEST EMAIL] Error:', testResult.error);
    }

    res.json({
      success: testResult.success,
      message: testResult.success
        ? 'Email enviado exitosamente. Revisa tu bandeja de entrada (y spam).'
        : `Error enviando email: ${testResult.error}`,
      messageId: testResult.messageId,
      error: testResult.error,
      from: fromEmail || 'dominio configurado'
    });

  } catch (error: any) {
    console.error('[TEST EMAIL] Error en test de email:', error);
    res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error?.message || String(error)}`
    });
  }
});

// ============================================================================
// SALES MODULE API - Módulo de Ventas
// ============================================================================

// GET /api/sales-stats - Estadísticas generales de ventas
router.get("/api/sales-stats", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId } = req.query;

    // Multi-tenant filtering
    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    console.log(`[GET /api/sales-stats] Solicitando métricas para companyId: ${resolvedCompanyId}`);

    // Calcular todas las métricas usando el módulo optimizado
    const metrics = await getSalesMetrics(resolvedCompanyId);

    console.log(`[GET /api/sales-stats] Métricas calculadas:`, {
      activeClients: metrics.activeClients,
      currentVolume: metrics.currentVolume,
      unit: metrics.unit,
      growth: metrics.growth
    });

    // Retornar métricas (incluye backward compatibility + nuevas métricas)
    res.json(metrics);
  } catch (error) {
    console.error('[GET /api/sales-stats] Error:', error);
    if (error instanceof Error) {
      console.error('[GET /api/sales-stats] Error stack:', error.stack);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to fetch sales stats',
      details: errorMessage
    });
  }
});

// GET /api/sales-comparison - Comparativo año actual vs anterior por cliente
router.get("/api/sales-comparison", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, year, month } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

    const comparison = await sql(`
      SELECT
        current_year.client_id,
        current_year.client_name,
        SUM(current_year.quantity) as current_year_total,
        COALESCE(SUM(previous_year.quantity), 0) as previous_year_total,
        SUM(current_year.quantity) - COALESCE(SUM(previous_year.quantity), 0) as differential,
        CASE
          WHEN COALESCE(SUM(previous_year.quantity), 0) > 0
          THEN ROUND(((SUM(current_year.quantity) - SUM(previous_year.quantity)) / SUM(previous_year.quantity) * 100)::numeric, 2)
          ELSE NULL
        END as percent_change,
        current_year.unit
      FROM sales_data current_year
      LEFT JOIN sales_data previous_year
        ON current_year.client_id = previous_year.client_id
        AND current_year.company_id = previous_year.company_id
        AND current_year.sale_month = previous_year.sale_month
        AND current_year.sale_year = previous_year.sale_year + 1
      WHERE current_year.company_id = $1
        AND current_year.sale_year = $2
        AND current_year.sale_month = $3
      GROUP BY
        current_year.client_id,
        current_year.client_name,
        current_year.unit
      ORDER BY differential ASC
    `, [resolvedCompanyId, targetYear, targetMonth]);

    res.json(comparison);
  } catch (error) {
    console.error('[GET /api/sales-comparison] Error:', error);
    res.status(500).json({ error: 'Failed to fetch sales comparison' });
  }
});

// GET /api/sales-alerts - Obtener alertas activas
router.get("/api/sales-alerts", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, type } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    let query = `
      SELECT
        id, alert_type, client_id, client_name, severity,
        title, description, data, is_active, is_read,
        created_at, resolved_at
      FROM sales_alerts
      WHERE company_id = $1
        AND is_active = true
    `;

    const params: any[] = [resolvedCompanyId];

    if (type) {
      query += ` AND alert_type = $2`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC`;

    const alerts = await sql(query, params);

    res.json(alerts);
  } catch (error) {
    console.error('[GET /api/sales-alerts] Error:', error);
    res.status(500).json({ error: 'Failed to fetch sales alerts' });
  }
});

// POST /api/sales-alerts/:id/read - Marcar alerta como leída
router.post("/api/sales-alerts/:id/read", jwtAuthMiddleware, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);

    await sql(`
      UPDATE sales_alerts
      SET is_read = true
      WHERE id = $1
    `, [alertId]);

    res.json({ success: true });
  } catch (error) {
    console.error('[POST /api/sales-alerts/:id/read] Error:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// GET /api/sales-monthly-trends - Datos mensuales para gráficos
// Soporta: ?year=2025 para un año específico, o ?months=12 para últimos N meses
router.get("/api/sales-monthly-trends", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, months, year } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    let monthlyData;

    // Si se especifica un año, filtrar por ese año completo
    if (year) {
      const selectedYear = parseInt(year as string);
      monthlyData = await sql(`
        SELECT
          sale_year,
          sale_month,
          COALESCE(SUM(quantity), 0) as total_volume,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as active_clients,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          AND sale_year = $2
        GROUP BY sale_year, sale_month
        ORDER BY sale_month ASC
      `, [resolvedCompanyId, selectedYear]);
    } else {
      // Cuando no se especifica year, usar el último año completo con datos disponibles
      // Esto es mejor que usar fechas relativas porque puede haber datos futuros
      const monthsCount = parseInt(months as string) || 12;

      // Primero obtener el último año con datos
      const latestYearResult = await sql(`
        SELECT MAX(sale_year) as max_year
        FROM sales_data
        WHERE company_id = $1
      `, [resolvedCompanyId]);

      const latestYear = latestYearResult[0]?.max_year
        ? parseInt(latestYearResult[0].max_year)
        : new Date().getFullYear();

      console.log(`[GET /api/sales-monthly-trends] Último año con datos para companyId ${resolvedCompanyId}: ${latestYear}`);

      // Obtener los últimos N meses del último año con datos
      monthlyData = await sql(`
        SELECT
          sale_year,
          sale_month,
          COALESCE(SUM(quantity), 0) as total_volume,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as active_clients,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          AND sale_year = $2
        GROUP BY sale_year, sale_month
        ORDER BY sale_month DESC
        LIMIT $3
      `, [resolvedCompanyId, latestYear, monthsCount]);

      // Si no hay suficientes datos en el último año, incluir también el año anterior
      if (monthlyData.length < monthsCount && latestYear > 2020) {
        const previousYear = latestYear - 1;
        const remainingMonths = monthsCount - monthlyData.length;

        const previousYearData = await sql(`
          SELECT
            sale_year,
            sale_month,
            COALESCE(SUM(quantity), 0) as total_volume,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as active_clients,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
            AND sale_year = $2
          GROUP BY sale_year, sale_month
          ORDER BY sale_month DESC
          LIMIT $3
        `, [resolvedCompanyId, previousYear, remainingMonths]);

        // Combinar datos: año anterior primero, luego último año
        monthlyData = [...previousYearData.reverse(), ...monthlyData.reverse()];
      } else {
        // Invertir para tener orden cronológico (más antiguo primero)
        monthlyData.reverse();
      }
    }

    // Formatear datos para el gráfico (orden cronológico: más antiguo primero, más reciente al final = izquierda a derecha)
    const formattedData = monthlyData.map((row: any) => {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const saleMonth = parseInt(row.sale_month);
      const saleYear = parseInt(row.sale_year);
      return {
        month: `${monthNames[saleMonth - 1]}`,
        monthFull: `${monthNames[saleMonth - 1]} ${saleYear}`,
        volume: parseFloat(row.total_volume || '0'),
        amount: parseFloat(row.total_amount || '0'),
        clients: parseInt(row.active_clients || '0'),
        year: saleYear,
        monthNum: saleMonth
      };
    });

    res.json(formattedData);
  } catch (error) {
    console.error('[GET /api/sales-monthly-trends] Error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly trends' });
  }
});

// GET /api/sales-yearly-comparison - Comparativo anual dinámico (reemplaza datos hardcodeados)
router.get("/api/sales-yearly-comparison", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, year1, year2 } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    // Dynamic year comparison: current year vs previous year
    const dynamicCurrentYear = new Date().getFullYear();
    const compareYear1 = year1 ? parseInt(year1 as string) : dynamicCurrentYear - 1;
    const compareYear2 = year2 ? parseInt(year2 as string) : dynamicCurrentYear;

    // Verificar qué años realmente existen en la base de datos
    const availableYearsCheck = await sql(`
      SELECT DISTINCT sale_year, COUNT(*) as count
      FROM sales_data
      WHERE company_id = $1
      GROUP BY sale_year
      ORDER BY sale_year DESC
    `, [resolvedCompanyId]);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[GET /api/sales-yearly-comparison] Años disponibles en BD para companyId ${resolvedCompanyId}:`,
        availableYearsCheck.map((r: any) => ({ year: r.sale_year, count: r.count })));
    }

    // Verificar si hay datos de 2026 para incluir automáticamente
    const year2026Check = await sql(`
      SELECT COUNT(*) as count
      FROM sales_data
      WHERE company_id = $1 AND sale_year = 2026
    `, [resolvedCompanyId]);

    const has2026Data = parseInt(year2026Check[0]?.count || '0') > 0;
    const yearsToCompare = has2026Data ? [compareYear1, compareYear2, 2026] : [compareYear1, compareYear2];

    // Verificar que los años que queremos comparar realmente existan
    const existingYears = availableYearsCheck.map((r: any) => {
      const year = typeof r.sale_year === 'string' ? parseInt(r.sale_year) : Number(r.sale_year);
      return year;
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[GET /api/sales-yearly-comparison] Años a comparar: ${yearsToCompare.join(', ')}`);
      console.log(`[GET /api/sales-yearly-comparison] Años existentes en BD: ${existingYears.join(', ')}`);
      yearsToCompare.forEach(year => {
        if (!existingYears.includes(year)) {
          console.warn(`[GET /api/sales-yearly-comparison] ⚠️ Año ${year} no encontrado en BD para companyId ${resolvedCompanyId}`);
        }
      });
    }

    // Obtener datos mensuales para los años a comparar (2 o 3 años)
    // Usar parámetros dinámicos según la cantidad de años
    let monthlyData;
    if (yearsToCompare.length === 3) {
      monthlyData = await sql(`
        SELECT
          sale_month,
          sale_year,
          COALESCE(SUM(quantity), 0) as total_quantity,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(DISTINCT client_name) as unique_clients,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          AND sale_year = ANY(ARRAY[$2, $3, $4]::integer[])
        GROUP BY sale_year, sale_month
        ORDER BY sale_year, sale_month
      `, [resolvedCompanyId, yearsToCompare[0], yearsToCompare[1], yearsToCompare[2]]);
    } else {
      // Query simplificada - igual que annual-summary que SÍ funciona
      monthlyData = await sql(`
        SELECT
          sale_month,
          sale_year,
          COALESCE(SUM(quantity), 0) as total_quantity,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(DISTINCT client_name) as unique_clients,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          AND sale_year = ANY(ARRAY[$2, $3]::integer[])
        GROUP BY sale_year, sale_month
        ORDER BY sale_year, sale_month
      `, [resolvedCompanyId, yearsToCompare[0], yearsToCompare[1]]);
    }

    // Log para debugging (siempre, no solo en desarrollo)
    console.log(`[GET /api/sales-yearly-comparison] companyId: ${resolvedCompanyId}, Años solicitados: year1=${compareYear1}, year2=${compareYear2}`);
    console.log(`[GET /api/sales-yearly-comparison] Años a comparar: ${yearsToCompare.join(', ')}`);
    console.log(`[GET /api/sales-yearly-comparison] Registros retornados: ${monthlyData.length}`);
    if (monthlyData.length > 0) {
      const data2024 = monthlyData.filter((r: any) => Number(r.sale_year) === 2024);
      const data2025 = monthlyData.filter((r: any) => Number(r.sale_year) === 2025);
      console.log(`[GET /api/sales-yearly-comparison] Registros 2024: ${data2024.length}, Registros 2025: ${data2025.length}`);
      if (data2024.length > 0) {
        console.log(`[GET /api/sales-yearly-comparison] Datos 2024 encontrados:`, data2024.map((r: any) => ({
          month: Number(r.sale_month),
          amount: Number(r.total_amount),
          quantity: Number(r.total_quantity)
        })));
      }
    }

    // Organizar datos por mes
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const comparisonData = monthNames.map((mes, index) => {
      const monthNum = index + 1;
      const dataPoint: any = {
        mes,
        monthNum,
      };

      // Agregar datos de todos los años a comparar
      yearsToCompare.forEach((year) => {
        // Buscar datos del año y mes - usar comparación estricta
        const yearData = monthlyData.find((r: any) => {
          // Convertir a números de forma explícita
          const rMonth = Number(r.sale_month);
          const rYear = Number(r.sale_year);
          return rMonth === monthNum && rYear === year;
        });

        if (yearData) {
          dataPoint[`qty_${year}`] = Number(yearData.total_quantity) || 0;
          dataPoint[`amt_${year}`] = Number(yearData.total_amount) || 0;
        } else {
          dataPoint[`qty_${year}`] = 0;
          dataPoint[`amt_${year}`] = 0;
        }

        // Log detallado para el primer mes y año 2024
        if (process.env.NODE_ENV !== 'production' && index === 0 && year === 2024) {
          console.log(`[GET /api/sales-yearly-comparison] Mes ${monthNum} (${mes}), Año 2024:`, {
            found: !!yearData,
            total_amount: yearData ? Number(yearData.total_amount) : 0,
            total_quantity: yearData ? Number(yearData.total_quantity) : 0,
            allMonthlyDataFor2024: monthlyData.filter((r: any) => Number(r.sale_year) === 2024).map((r: any) => ({
              month: Number(r.sale_month),
              year: Number(r.sale_year),
              amount: Number(r.total_amount)
            }))
          });
        }
      });

      // Calcular diferencias y porcentajes (solo entre los dos primeros años para compatibilidad)
      const qty1 = dataPoint[`qty_${compareYear1}`] || 0;
      const qty2 = dataPoint[`qty_${compareYear2}`] || 0;
      const amt1 = dataPoint[`amt_${compareYear1}`] || 0;
      const amt2 = dataPoint[`amt_${compareYear2}`] || 0;

      dataPoint.qty_diff = qty2 - qty1;
      dataPoint.qty_percent = qty1 > 0 ? ((qty2 - qty1) / qty1) * 100 : (qty2 > 0 ? 100 : 0);
      dataPoint.amt_diff = amt2 - amt1;
      dataPoint.amt_percent = amt1 > 0 ? ((amt2 - amt1) / amt1) * 100 : (amt2 > 0 ? 100 : 0);

      // Determinar unidad
      const firstYearData = monthlyData.find((r: any) => parseInt(r.sale_month) === monthNum && parseInt(r.sale_year) === yearsToCompare[0]);
      dataPoint.unit = firstYearData?.unit || (resolvedCompanyId === 1 ? 'KG' : 'unidades');

      return dataPoint;
    });

    // Calcular totales para todos los años
    const totals = comparisonData.reduce((acc, row) => {
      const totalsObj: any = { ...acc };
      yearsToCompare.forEach((year) => {
        totalsObj[`qty_${year}`] = (totalsObj[`qty_${year}`] || 0) + (row[`qty_${year}`] || 0);
        totalsObj[`amt_${year}`] = (totalsObj[`amt_${year}`] || 0) + (row[`amt_${year}`] || 0);
      });
      return totalsObj;
    }, yearsToCompare.reduce((acc: any, year) => {
      acc[`qty_${year}`] = 0;
      acc[`amt_${year}`] = 0;
      return acc;
    }, {}));

    // Obtener años disponibles para selector
    const availableYears = await sql(`
      SELECT DISTINCT sale_year
      FROM sales_data
      WHERE company_id = $1
      ORDER BY sale_year DESC
    `, [resolvedCompanyId]);

    // Log para debugging (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[GET /api/sales-yearly-comparison] Comparando años: ${yearsToCompare.join(', ')}`);
      console.log(`[GET /api/sales-yearly-comparison] Total registros encontrados: ${monthlyData.length}`);
      console.log(`[GET /api/sales-yearly-comparison] Totales calculados:`, totals);
      console.log(`[GET /api/sales-yearly-comparison] Años disponibles:`, availableYears.map((r: any) => {
        const year = typeof r.sale_year === 'string' ? parseInt(r.sale_year) : r.sale_year;
        return year;
      }));
    }

    res.json({
      companyId: resolvedCompanyId,
      year1: compareYear1,
      year2: compareYear2,
      data: comparisonData,
      totals: {
        ...totals,
        qty_diff: totals[`qty_${compareYear2}`] - totals[`qty_${compareYear1}`],
        qty_percent: totals[`qty_${compareYear1}`] > 0
          ? ((totals[`qty_${compareYear2}`] - totals[`qty_${compareYear1}`]) / totals[`qty_${compareYear1}`]) * 100
          : 0,
        amt_diff: totals[`amt_${compareYear2}`] - totals[`amt_${compareYear1}`],
        amt_percent: totals[`amt_${compareYear1}`] > 0
          ? ((totals[`amt_${compareYear2}`] - totals[`amt_${compareYear1}`]) / totals[`amt_${compareYear1}`]) * 100
          : 0,
      },
      availableYears: availableYears.map((r: any) => {
        const year = typeof r.sale_year === 'string' ? parseInt(r.sale_year) : r.sale_year;
        return year;
      }),
      unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
    });
  } catch (error) {
    console.error('[GET /api/sales-yearly-comparison] Error:', error);
    res.status(500).json({ error: 'Failed to fetch yearly comparison' });
  }
});

// GET /api/sales-multi-year-trend - Tendencia multi-año para gráfica overlay
router.get("/api/sales-multi-year-trend", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    // Obtener datos mensuales agrupados por año
    const monthlyData = await sql(`
      SELECT
        sale_year,
        sale_month,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COUNT(DISTINCT client_name) as unique_clients,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = $1
      GROUP BY sale_year, sale_month
      ORDER BY sale_year, sale_month
    `, [resolvedCompanyId]);

    // Organizar por año para la gráfica overlay
    // Convertir a números para comparación correcta (PostgreSQL puede retornar strings)
    const years = [...new Set(monthlyData.map((r: any) => parseInt(r.sale_year)))].sort();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Formato para gráfica: array de meses con valores por año
    const chartData = monthNames.map((month, index) => {
      const monthNum = index + 1;
      const dataPoint: any = { month, monthNum };

      years.forEach((year: number) => {
        const record = monthlyData.find((r: any) => parseInt(r.sale_year) === year && parseInt(r.sale_month) === monthNum);
        dataPoint[`qty_${year}`] = parseFloat(record?.total_quantity || '0');
        dataPoint[`amt_${year}`] = parseFloat(record?.total_amount || '0');
      });

      return dataPoint;
    });

    // Calcular totales por año
    const yearTotals = years.map((year: number) => {
      const yearData = monthlyData.filter((r: any) => parseInt(r.sale_year) === year);
      return {
        year,
        totalQty: yearData.reduce((sum: number, r: any) => sum + parseFloat(r.total_quantity || '0'), 0),
        totalAmt: yearData.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount || '0'), 0),
        avgMonthly: yearData.reduce((sum: number, r: any) => sum + parseFloat(r.total_quantity || '0'), 0) / 12
      };
    });

    res.json({
      companyId: resolvedCompanyId,
      years,
      data: chartData,
      yearTotals,
      unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
    });
  } catch (error) {
    console.error('[GET /api/sales-multi-year-trend] Error:', error);
    res.status(500).json({ error: 'Failed to fetch multi-year trend' });
  }
});

// GET /api/sales-churn-risk - Análisis de riesgo de churn de clientes
router.get("/api/sales-churn-risk", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    // Análisis de clientes: última compra, volumen actual vs anterior, tendencia
    const clientAnalysis = await sql(`
      WITH client_stats AS (
        SELECT
          client_name,
          MAX(sale_date) as last_purchase,
          SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) as qty_current_year,
          SUM(CASE WHEN sale_year = $3 THEN quantity ELSE 0 END) as qty_last_year,
          SUM(CASE WHEN sale_year = $2 THEN total_amount ELSE 0 END) as amt_current_year,
          SUM(CASE WHEN sale_year = $3 THEN total_amount ELSE 0 END) as amt_last_year,
          COUNT(DISTINCT sale_year) as years_active,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
        GROUP BY client_name
      )
      SELECT
        client_name,
        last_purchase,
        qty_current_year,
        qty_last_year,
        amt_current_year,
        amt_last_year,
        years_active,
        unit,
        CURRENT_DATE - last_purchase as days_since_purchase,
        CASE
          WHEN qty_last_year > 0 THEN ((qty_current_year - qty_last_year) / qty_last_year * 100)
          ELSE 0
        END as yoy_change
      FROM client_stats
      ORDER BY last_purchase DESC
    `, [resolvedCompanyId, currentYear, lastYear]);

    // Categorizar clientes por riesgo (umbrales: shared/kpi-card-types)
    // atRisk = 90–179 días sin compra; critical = 180+ días
    const categorized = {
      atRisk: [] as any[],
      critical: [] as any[],
      warning: [] as any[],
      declining: [] as any[],
      stable: [] as any[],
      growing: [] as any[],
      new: [] as any[],
      lost: [] as any[]
    };

    clientAnalysis.forEach((client: any) => {
      const daysSince = parseInt(client.days_since_purchase || '0');
      const yoyChange = parseFloat(client.yoy_change || '0');
      const qtyCurrentYear = parseFloat(client.qty_current_year || '0');
      const qtyLastYear = parseFloat(client.qty_last_year || '0');

      const clientData = {
        name: client.client_name,
        lastPurchase: client.last_purchase,
        daysSincePurchase: daysSince,
        qtyCurrentYear,
        qtyLastYear,
        yoyChange: yoyChange,
        amtCurrentYear: parseFloat(client.amt_current_year || '0'),
        unit: client.unit
      };

      if (qtyLastYear > 0 && qtyCurrentYear === 0) {
        categorized.lost.push(clientData);
      } else if (daysSince >= CHURN_CRITICAL_DAYS_MIN) {
        categorized.critical.push(clientData);
      } else if (daysSince >= CHURN_AT_RISK_DAYS_MIN) {
        categorized.atRisk.push(clientData);
      } else if (yoyChange < -30) {
        categorized.warning.push(clientData);
      } else if (yoyChange < -10) {
        categorized.declining.push(clientData);
      } else if (qtyLastYear === 0 && qtyCurrentYear > 0) {
        categorized.new.push(clientData);
      } else if (yoyChange > 10) {
        categorized.growing.push(clientData);
      } else {
        categorized.stable.push(clientData);
      }
    });

    categorized.critical.sort((a, b) => b.qtyLastYear - a.qtyLastYear);
    categorized.atRisk.sort((a, b) => b.qtyLastYear - a.qtyLastYear);
    categorized.warning.sort((a, b) => (b.qtyLastYear - b.qtyCurrentYear) - (a.qtyLastYear - a.qtyCurrentYear));
    categorized.lost.sort((a, b) => b.qtyLastYear - a.qtyLastYear);

    const summary = {
      totalClients: clientAnalysis.length,
      atRiskCount: categorized.atRisk.length,
      criticalCount: categorized.critical.length,
      warningCount: categorized.warning.length,
      lostCount: categorized.lost.length,
      newCount: categorized.new.length,
      growingCount: categorized.growing.length,
      lostVolume: categorized.lost.reduce((sum, c) => sum + c.qtyLastYear, 0),
      atRiskVolume: [...categorized.atRisk, ...categorized.critical].reduce((sum, c) => sum + c.qtyLastYear, 0)
    };

    res.json({
      companyId: resolvedCompanyId,
      currentYear,
      lastYear,
      summary,
      clients: categorized,
      unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
    });
  } catch (error) {
    console.error('[GET /api/sales-churn-risk] Error:', error);
    res.status(500).json({ error: 'Failed to fetch churn risk analysis' });
  }
});

// GET /api/sales-client-trends - Top clientes con tendencia YoY
router.get("/api/sales-client-trends", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, limit = 10 } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    // Use dynamic current year
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    const clientTrends = await sql(`
      SELECT
        client_name,
        SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) as qty_current,
        SUM(CASE WHEN sale_year = $3 THEN quantity ELSE 0 END) as qty_previous,
        SUM(CASE WHEN sale_year = $2 THEN total_amount ELSE 0 END) as amt_current,
        SUM(CASE WHEN sale_year = $3 THEN total_amount ELSE 0 END) as amt_previous,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = $1
        AND sale_year IN ($2, $3)
      GROUP BY client_name
      ORDER BY SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) DESC
      LIMIT $4
    `, [resolvedCompanyId, currentYear, lastYear, parseInt(limit as string)]);

    const formattedData = clientTrends.map((client: any) => {
      const qtyCurrent = parseFloat(client.qty_current || '0');
      const qtyPrevious = parseFloat(client.qty_previous || '0');
      const change = qtyCurrent - qtyPrevious;
      const changePercent = qtyPrevious > 0 ? (change / qtyPrevious) * 100 : (qtyCurrent > 0 ? 100 : 0);

      return {
        name: client.client_name,
        qtyCurrent,
        qtyPrevious,
        change,
        changePercent,
        amtCurrent: parseFloat(client.amt_current || '0'),
        amtPrevious: parseFloat(client.amt_previous || '0'),
        unit: client.unit
      };
    });

    res.json({
      companyId: resolvedCompanyId,
      currentYear,
      previousYear: lastYear,
      clients: formattedData,
      unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
    });
  } catch (error) {
    console.error('[GET /api/sales-client-trends] Error:', error);
    res.status(500).json({ error: 'Failed to fetch client trends' });
  }
});

// GET /api/sales-top-clients - Top clientes por volumen
router.get("/api/sales-top-clients", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, limit = 5, period = '3months', sortBy = 'volume' } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let dateFilter = '';
    let params: any[] = [resolvedCompanyId];

    // Determinar filtro de fecha según el período
    if (period === 'month') {
      // Último mes con datos disponibles
      dateFilter = `AND sale_year = $2 AND sale_month = $3`;
      params.push(currentYear, currentMonth);
    } else if (period === 'year') {
      // Año actual completo
      dateFilter = `AND sale_year = $2`;
      params.push(currentYear);
    } else {
      // Default: últimos 3 meses (backward compatibility)
      dateFilter = `AND sale_date >= CURRENT_DATE - INTERVAL '3 months' AND sale_date <= CURRENT_DATE`;
    }

    params.push(parseInt(limit as string) || 5);

    // Buscar top clientes según el período seleccionado
    let topClients = await sql(`
      SELECT
        client_name,
        COALESCE(SUM(quantity), 0) as total_volume,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(*) as transactions,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = $1
        ${dateFilter}
        AND client_name IS NOT NULL AND client_name <> ''
      GROUP BY client_name
      ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
      LIMIT $${params.length}
    `, params);

    // Si no hay datos y es month/year, buscar en el último período con datos
    if ((!topClients || topClients.length === 0 || (topClients[0]?.total_volume === 0)) && (period === 'month' || period === 'year')) {
      topClients = await sql(`
        SELECT
          client_name,
          COALESCE(SUM(quantity), 0) as total_volume,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COUNT(*) as transactions,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
          AND sale_date <= CURRENT_DATE
          AND client_name IS NOT NULL AND client_name <> ''
        GROUP BY client_name
        ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
        LIMIT $2
      `, [resolvedCompanyId, parseInt(limit as string) || 5]);
    }

    const formatted = (topClients || []).map((row: any) => {
      const volume = parseFloat(row.total_volume || '0');
      const revenue = parseFloat(row.total_revenue || '0');
      const profitability = volume > 0 ? revenue / volume : 0; // Revenue por unidad de volumen

      return {
        name: row.client_name,
        volume: volume,
        revenue: revenue,
        profitability: profitability,
        transactions: parseInt(row.transactions || '0'),
        unit: row.unit
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('[GET /api/sales-top-clients] Error:', error);
    res.status(500).json({ error: 'Failed to fetch top clients' });
  }
});

// GET /api/sales-top-products - Top productos por volumen vendido
router.get("/api/sales-top-products", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, limit = 5, period = '3months', sortBy = 'volume' } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let dateFilter = '';
    let params: any[] = [resolvedCompanyId];

    // Determinar filtro de fecha según el período
    if (period === 'month') {
      // Último mes con datos disponibles
      dateFilter = `AND sale_year = $2 AND sale_month = $3`;
      params.push(currentYear, currentMonth);
    } else if (period === 'year') {
      // Año actual completo
      dateFilter = `AND sale_year = $2`;
      params.push(currentYear);
    } else {
      // Default: últimos 3 meses (backward compatibility)
      dateFilter = `AND sale_date >= CURRENT_DATE - INTERVAL '3 months' AND sale_date <= CURRENT_DATE`;
    }

    params.push(parseInt(limit as string) || 5);

    // Buscar top productos según el período seleccionado
    let topProducts = await sql(`
      SELECT
        product_name,
        COALESCE(SUM(quantity), 0) as total_volume,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(DISTINCT client_name) as unique_clients,
        COUNT(*) as transactions,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = $1
        ${dateFilter}
        AND product_name IS NOT NULL AND product_name <> ''
      GROUP BY product_name
      ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
      LIMIT $${params.length}
    `, params);

    // Si no hay datos y es month/year, buscar en el último período con datos
    if ((!topProducts || topProducts.length === 0) && (period === 'month' || period === 'year')) {
      topProducts = await sql(`
        SELECT
          product_name,
          COALESCE(SUM(quantity), 0) as total_volume,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COUNT(DISTINCT client_name) as unique_clients,
          COUNT(*) as transactions,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
          AND sale_date <= CURRENT_DATE
          AND product_name IS NOT NULL AND product_name <> ''
        GROUP BY product_name
        ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
        LIMIT $2
      `, [resolvedCompanyId, parseInt(limit as string) || 5]);
    }

    const formatted = (topProducts || []).map((row: any) => {
      const volume = parseFloat(row.total_volume) || 0;
      const revenue = parseFloat(row.total_revenue) || 0;
      const profitability = volume > 0 ? revenue / volume : 0; // Revenue por unidad de volumen

      return {
        name: row.product_name || 'Sin nombre',
        volume: volume,
        revenue: revenue,
        profitability: profitability,
        uniqueClients: parseInt(row.unique_clients) || 0,
        transactions: parseInt(row.transactions) || 0,
        unit: row.unit || (resolvedCompanyId === 2 ? 'unidades' : 'KG')
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('[GET /api/sales-top-products] Error:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// GET /api/sales-analyst/insights - Análisis estratégico consolidado del analista de ventas
router.get("/api/sales-analyst/insights", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    console.log(`[GET /api/sales-analyst/insights] Generando insights para companyId: ${resolvedCompanyId}`);

    const insights = await generateSalesAnalystInsights(resolvedCompanyId);

    console.log(`[GET /api/sales-analyst/insights] Insights generados exitosamente`);

    res.json(insights);
  } catch (error) {
    console.error('[GET /api/sales-analyst/insights] Error:', error);
    if (error instanceof Error) {
      console.error('[GET /api/sales-analyst/insights] Error stack:', error.stack);
    }
    res.status(500).json({
      error: 'Failed to generate sales analyst insights',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/sales-alerts/:id/resolve - Resolver alerta
router.post("/api/sales-alerts/:id/resolve", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const alertId = parseInt(req.params.id);

    await sql(`
      UPDATE sales_alerts
      SET
        is_active = false,
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = $1
      WHERE id = $2
    `, [user?.id, alertId]);

    res.json({ success: true });
  } catch (error) {
    console.error('[POST /api/sales-alerts/:id/resolve] Error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// GET /api/profitability-metrics - Métricas detalladas de rentabilidad
router.get("/api/profitability-metrics", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, year } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    const targetYear = year ? parseInt(year as string) : undefined;
    const metrics = await calculateRealProfitability(resolvedCompanyId, targetYear);

    res.json(metrics);
  } catch (error) {
    console.error('[GET /api/profitability-metrics] Error:', error);
    res.status(500).json({ error: 'Failed to fetch profitability metrics' });
  }
});

// GET /api/annual-summary - Resumen anual ejecutivo
router.get("/api/annual-summary", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, year } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    if (!year) {
      return res.status(400).json({ error: 'Year parameter is required' });
    }

    const targetYear = parseInt(year as string);
    const summary = await getAnnualSummary(resolvedCompanyId, targetYear);

    res.json(summary);
  } catch (error) {
    console.error('[GET /api/annual-summary] Error:', error);
    res.status(500).json({ error: 'Failed to fetch annual summary' });
  }
});

// GET /api/annual-summary/years - Obtener años disponibles
router.get("/api/annual-summary/years", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId } = req.query;

    const resolvedCompanyId = user?.role === 'admin' && companyId
      ? parseInt(companyId as string)
      : user?.companyId;

    if (!resolvedCompanyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    const years = await getAvailableYears(resolvedCompanyId);
    res.json(years);
  } catch (error) {
    console.error('[GET /api/annual-summary/years] Error:', error);
    res.status(500).json({ error: 'Failed to fetch available years' });
  }
});

export default router;
