import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { sql, collaboratorPerformanceCache, getAuthUser, type AuthRequest, createKPIStatusChangeNotification } from "./_helpers";
import { jwtAuthMiddleware } from "../auth";
import { insertKpiValueSchema, type Kpi } from "@shared/schema";
import { calculateKpiStatus, calculateCompliance, parseNumericValue, isLowerBetterKPI } from "@shared/kpi-utils";
import { calculateSalesKpiValue, calculateSalesKpiHistory } from "../sales-kpi-calculator";
import { logger } from "../logger";

const router = Router();

// ==============================
// GET /api/kpi-values
// ==============================
router.get("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
  try {
    const companyIdParam = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
    if (companyIdParam !== undefined && companyIdParam !== 1 && companyIdParam !== 2) {
      return res.status(400).json({ error: "companyId query param inválido (1=Dura, 2=Orsega)" });
    }

    if (req.query.kpiId) {
      const kpiId = parseInt(req.query.kpiId as string, 10);
      let kpi: Kpi | undefined;
      let resolvedCompanyId: number;

      if (companyIdParam !== undefined) {
        kpi = await storage.getKpi(kpiId, companyIdParam);
        if (!kpi) {
          return res.status(404).json({ message: "KPI not found for this company" });
        }
        resolvedCompanyId = companyIdParam;
      } else {
        const allKpis = await storage.getKpis();
        const match = allKpis.find((item) => item.id === kpiId);
        if (!match?.companyId) {
          return res.status(404).json({ message: "KPI not found" });
        }
        kpi = match;
        resolvedCompanyId = match.companyId;
      }

      // Si es un KPI de ventas, calcular valor en tiempo real desde sales_data
      const kpiName = kpi.name || '';
      if (storage.isSalesKpi(kpiName)) {
        console.log(`[GET /api/kpi-values] KPI de ventas detectado: ${kpiName}, calculando desde sales_data`);

        // Obtener período si se especifica en query params
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const month = req.query.month ? parseInt(req.query.month as string) : undefined;

        // Calcular valor en tiempo real
        const calculatedValue = await calculateSalesKpiValue(kpiName, resolvedCompanyId, { year, month });

        if (calculatedValue) {
          // Obtener historial si se solicita
          const includeHistory = req.query.history === 'true';
          let history: Array<{ period: string; value: number; date: Date }> = [];

          if (includeHistory) {
            const historyResult = await calculateSalesKpiHistory(kpiName, resolvedCompanyId, 12);
            history = historyResult.data;
          }

          // Formatear respuesta en el formato esperado por KpiValue
          const now = new Date();
          const periodString = year && month
            ? `${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][month - 1]} ${year}`
            : `${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()]} ${now.getFullYear()}`;

          // Calcular compliance y status usando funciones centralizadas de @shared/kpi-utils
          let compliancePercentage: string | null = null;
          let status: string | null = null;

          if (kpi.target || kpi.goal) {
            const targetReference = kpi.target || kpi.goal;
            const kpiNameForCalc = kpi.name || kpiName || '';
            status = calculateKpiStatus(calculatedValue.value, targetReference, kpiNameForCalc);
            compliancePercentage = calculateCompliance(calculatedValue.value, targetReference, kpiNameForCalc);
          }

          const kpiValue = {
            id: 0, // Valor calculado, no tiene ID en BD
            kpiId: kpiId,
            companyId: resolvedCompanyId,
            value: calculatedValue.value.toString() + (calculatedValue.unit ? ` ${calculatedValue.unit}` : ''),
            period: periodString,
            month: month?.toString() || (now.getMonth() + 1).toString(),
            year: year || now.getFullYear(),
            date: now,
            compliancePercentage,
            status,
            comments: 'Valor calculado en tiempo real desde sales_data',
            updatedBy: null
          };

          // Si hay historial, incluir también esos valores
          if (includeHistory && history.length > 0) {
            const historyValues = history.map((h, idx) => ({
              id: -(idx + 1), // IDs negativos para valores históricos calculados
              kpiId: kpiId,
              companyId: resolvedCompanyId,
              value: h.value.toString() + (calculatedValue.unit ? ` ${calculatedValue.unit}` : ''),
              period: h.period,
              month: (h.date.getMonth() + 1).toString(),
              year: h.date.getFullYear(),
              date: h.date,
              compliancePercentage: null,
              status: null,
              comments: 'Valor histórico calculado desde sales_data',
              updatedBy: null
            }));

            return res.json([kpiValue, ...historyValues]);
          }

          return res.json([kpiValue]);
        }
      }

      // Si no es KPI de ventas, usar lógica tradicional
      const kpiValues = await storage.getKpiValuesByKpi(kpiId, resolvedCompanyId);
      return res.json(kpiValues);
    }

    // Cuando se consultan todos los valores, calcular en tiempo real los de ventas
    const allValues = await storage.getKpiValues(companyIdParam);
    const allKpis = await storage.getKpis();

    // Filtrar KPIs de ventas y calcular sus valores en tiempo real
    const salesKpis = allKpis.filter(kpi => {
      const kpiName = kpi.name || '';
      return storage.isSalesKpi(kpiName);
    });

    // Reemplazar valores de KPIs de ventas con valores calculados en tiempo real
    const updatedValues = await Promise.all(
      allValues.map(async (value) => {
        const kpi = salesKpis.find(k => k.id === value.kpiId);
        if (kpi) {
          const kpiName = kpi.name || '';
          const calculatedValue = await calculateSalesKpiValue(
            kpiName,
            value.companyId,
            value.year && value.month ? { year: value.year, month: parseInt(value.month) } : undefined
          );

          if (calculatedValue) {
            return {
              ...value,
              value: calculatedValue.value.toString() + (calculatedValue.unit ? ` ${calculatedValue.unit}` : ''),
              comments: value.comments || 'Valor calculado en tiempo real desde sales_data'
            };
          }
        }
        return value;
      })
    );

    console.log(`[GET /api/kpi-values] Retornando ${updatedValues.length} valores para companyId=${companyIdParam ?? 'ALL'} (${salesKpis.length} KPIs de ventas calculados en tiempo real)`);
    res.json(updatedValues);
  } catch (error) {
    console.error("[GET /api/kpi-values] Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Helper function: Calcular fecha de inicio del período anterior según frecuencia
const getPreviousPeriodStart = (frequency: string | null, referenceDate: Date = new Date()): Date => {
  const date = new Date(referenceDate);
  switch (frequency?.toLowerCase()) {
    case 'daily':
      date.setDate(date.getDate() - 1);
      date.setHours(0, 0, 0, 0);
      return date;
    case 'weekly':
      date.setDate(date.getDate() - 7);
      date.setHours(0, 0, 0, 0);
      return date;
    case 'monthly':
      date.setMonth(date.getMonth() - 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date;
    default:
      // Default a monthly si no se especifica
      date.setMonth(date.getMonth() - 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date;
  }
};

// Helper function: Obtener texto del período de comparación
const getPeriodText = (frequency: string | null): string => {
  switch (frequency?.toLowerCase()) {
    case 'daily':
      return 'vs día anterior';
    case 'weekly':
      return 'vs semana pasada';
    case 'monthly':
      return 'vs mes anterior';
    default:
      return 'vs período anterior';
  }
};

// Helper function: Calcular score para un conjunto de KPIs
const calculateScore = (kpisWithData: any[]): number => {
  const totalKpis = kpisWithData.length;
  const kpisWithValues = kpisWithData.filter(k => k.latestValue);
  const compliantKpis = kpisWithData.filter(k => k.status === 'complies').length;

  const averageCompliance = kpisWithValues.length > 0
    ? kpisWithData.reduce((sum, k) => sum + k.compliance, 0) / kpisWithValues.length
    : 0;

  const compliantPercentage = totalKpis > 0 ? (compliantKpis / totalKpis) * 100 : 0;
  const updateScore = totalKpis > 0 ? (kpisWithValues.length / totalKpis) * 100 : 0;

  return (averageCompliance * 0.5) + (compliantPercentage * 0.3) + (updateScore * 0.2);
};

// Helper function: Rellenar meses faltantes con valores null
const fillMissingMonths = (data: Array<{ month: string; compliance: number | null }>, monthsCount: number = 12): Array<{ month: string; compliance: number | null }> => {
  const today = new Date();
  const allMonths: Array<{ month: string; compliance: number | null }> = [];

  // Generar array de los últimos N meses
  for (let i = monthsCount - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = date.toISOString().substring(0, 7); // YYYY-MM

    // Buscar si existe data para este mes
    const existing = data.find(d => d.month === monthStr);
    allMonths.push({
      month: monthStr,
      compliance: existing?.compliance ?? null
    });
  }

  return allMonths;
};

// Helper function: Calcular tendencia avanzada con regresión lineal
const calculateAdvancedTrend = (data: Array<{ month: string; compliance: number | null }>): {
  direction: 'up' | 'down' | 'stable' | null;
  strength: number; // 0-100, qué tan fuerte es la tendencia
  slope: number; // pendiente de la regresión
  r2: number; // coeficiente de determinación (0-1)
} => {
  // Filtrar solo valores no nulos
  const validData = data
    .map((d, idx) => ({ x: idx, y: d.compliance }))
    .filter(d => d.y !== null) as Array<{ x: number; y: number }>;

  if (validData.length < 3) {
    return { direction: null, strength: 0, slope: 0, r2: 0 };
  }

  // Calcular regresión lineal (y = mx + b)
  const n = validData.length;
  const sumX = validData.reduce((sum, d) => sum + d.x, 0);
  const sumY = validData.reduce((sum, d) => sum + d.y, 0);
  const sumXY = validData.reduce((sum, d) => sum + d.x * d.y, 0);
  const sumX2 = validData.reduce((sum, d) => sum + d.x * d.x, 0);
  const sumY2 = validData.reduce((sum, d) => sum + d.y * d.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calcular R² (coeficiente de determinación)
  const yMean = sumY / n;
  const ssTotal = validData.reduce((sum, d) => sum + Math.pow(d.y - yMean, 2), 0);
  const ssResidual = validData.reduce((sum, d) => {
    const predicted = slope * d.x + intercept;
    return sum + Math.pow(d.y - predicted, 2);
  }, 0);
  const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

  // Determinar dirección y fuerza
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(slope) > 0.5) { // Umbral: cambio > 0.5% por mes
    direction = slope > 0 ? 'up' : 'down';
  }

  // Strength: combinación de pendiente absoluta y R²
  // Normalizar slope a un rango 0-100 (asumiendo max cambio razonable de ±10% por mes)
  const normalizedSlope = Math.min(Math.abs(slope) / 10 * 100, 100);
  const strength = Math.round(normalizedSlope * r2); // Ajustar por qué tan bien se ajusta a la línea

  return {
    direction,
    strength,
    slope: Math.round(slope * 100) / 100,
    r2: Math.round(r2 * 100) / 100
  };
};

// ==============================
// GET /api/collaborators-performance - Obtener rendimiento agrupado por colaborador
// ==============================
router.get("/api/collaborators-performance", jwtAuthMiddleware, async (req, res) => {
  try {
    const companyIdParam = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
    if (companyIdParam !== undefined && companyIdParam !== 1 && companyIdParam !== 2) {
      return res.status(400).json({ error: "companyId query param inválido (1=Dura, 2=Orsega)" });
    }

    console.log(`🔵 [GET /api/collaborators-performance] Endpoint llamado para companyId=${companyIdParam ?? 'ALL'}`);

    // 🚀 OPTIMIZATION: Check cache first
    const cacheKey = `collaborators-performance-${companyIdParam ?? 'ALL'}`;
    const cachedData = collaboratorPerformanceCache.get(cacheKey);
    if (cachedData) {
      console.log(`⚡ [GET /api/collaborators-performance] Retornando datos desde cache`);
      return res.json(cachedData);
    }

    // Obtener KPIs y valores
    const [kpis, kpiValues] = await Promise.all([
      storage.getKpis(companyIdParam),
      storage.getKpiValues(companyIdParam)
    ]);

    // Agrupar KPIs por responsable
    const collaboratorsMap = new Map<string, {
      name: string;
      kpis: any[];
      kpiValues: any[];
    }>();

    // Agrupar KPIs por responsable (solo si está definido y no vacío)
    kpis.forEach((kpi: any) => {
      const responsible = kpi.responsible?.trim();
      if (!responsible || responsible === '') return; // Validación estricta: debe estar definido y no vacío

      if (!collaboratorsMap.has(responsible)) {
        collaboratorsMap.set(responsible, {
          name: responsible,
          kpis: [],
          kpiValues: []
        });
      }

      collaboratorsMap.get(responsible)!.kpis.push(kpi);
    });

    // Incluir usuarios del sistema (collaborator/manager) aunque no tengan KPIs asignados
    const allUsers = await storage.getUsers();
    allUsers.forEach((user: any) => {
      if (user.role !== 'collaborator' && user.role !== 'manager') return;
      // Filtrar por empresa si se especificó (null = todas las empresas)
      if (companyIdParam !== undefined && user.companyId !== null && user.companyId !== companyIdParam) return;
      const userName = user.name?.trim();
      if (!userName) return;
      if (!collaboratorsMap.has(userName)) {
        collaboratorsMap.set(userName, {
          name: userName,
          kpis: [],
          kpiValues: []
        });
      }
    });

    // Agrupar valores por KPI para acceso rápido
    const valuesByKpiId = new Map<number, any[]>();
    kpiValues.forEach((value: any) => {
      if (!valuesByKpiId.has(value.kpiId)) {
        valuesByKpiId.set(value.kpiId, []);
      }
      valuesByKpiId.get(value.kpiId)!.push(value);
    });

    // Ordenar valores por fecha (más reciente primero) para cada KPI
    valuesByKpiId.forEach((values) => {
      values.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
    });

    // Calcular métricas para cada colaborador
    const collaborators = await Promise.all(Array.from(collaboratorsMap.values()).map(async (collab) => {
      const kpisWithData = await Promise.all(collab.kpis.map(async (kpi: any) => {
        const values = valuesByKpiId.get(kpi.id) || [];
        let latestValue = values[0] || null;

        // Si es un KPI de ventas, calcular valor en tiempo real desde sales_data
        const kpiName = kpi.name || kpi.kpiName || '';
        if (storage.isSalesKpi(kpiName) && kpi.companyId) {
          try {
            const now = new Date();
            const calculatedValue = await calculateSalesKpiValue(kpiName, kpi.companyId, { year: now.getFullYear(), month: now.getMonth() + 1 });
            if (calculatedValue) {
              const targetRef = kpi.target || kpi.goal;
              const dynStatus = targetRef ? calculateKpiStatus(calculatedValue.value, targetRef, kpiName) : 'not_compliant';
              const dynCompliance = targetRef ? calculateCompliance(calculatedValue.value, targetRef, kpiName) : '0%';
              latestValue = {
                ...latestValue,
                value: calculatedValue.value.toString() + (calculatedValue.unit ? ` ${calculatedValue.unit}` : ''),
                status: dynStatus,
                compliancePercentage: dynCompliance,
                date: now,
                comments: 'Calculado en tiempo real desde sales_data',
              };
            }
          } catch (err) {
            console.error(`[collaborators-performance] Error calculando KPI dinámico "${kpiName}":`, err);
          }
        }

        // Obtener valor del período anterior
        const frequency = kpi.frequency || 'monthly';
        const previousPeriodStart = getPreviousPeriodStart(frequency, latestValue?.date ? new Date(latestValue.date) : new Date());

        // Buscar el último valor del período anterior
        let previousValue = null;
        if (latestValue?.date) {
          const latestDate = new Date(latestValue.date);
          previousValue = values.find((v: any) => {
            if (!v.date) return false;
            const vDate = new Date(v.date);
            return vDate < latestDate && vDate >= previousPeriodStart;
          });
        }

        // Calcular compliance usando funciones centralizadas de @shared/kpi-utils
        let compliance = latestValue
          ? parseFloat(latestValue.compliancePercentage?.toString().replace('%', '') || '0')
          : 0;

        // Si no hay compliancePercentage o es 0, calcularlo con funciones centralizadas
        if (compliance === 0 && latestValue && (kpi.target || kpi.goal)) {
          const targetReference = kpi.target || kpi.goal;
          const complianceStr = calculateCompliance(latestValue.value, targetReference, kpi.name || "");
          compliance = parseFloat(complianceStr.replace('%', '')) || 0;
        }

        // Determinar status usando funciones centralizadas
        let status = latestValue?.status || 'not_compliant';
        if (!latestValue?.status || latestValue.status === 'null' || latestValue.status === null) {
          if (latestValue && (kpi.target || kpi.goal)) {
            const targetReference = kpi.target || kpi.goal;
            status = calculateKpiStatus(latestValue.value, targetReference, kpi.name || "");
          }
        }

        let previousCompliance = previousValue
          ? parseFloat(previousValue.compliancePercentage?.toString().replace('%', '') || '0')
          : null;

        // Si previousCompliance es 0, calcularlo con funciones centralizadas
        if (previousCompliance === 0 && previousValue && (kpi.target || kpi.goal)) {
          const targetReference = kpi.target || kpi.goal;
          const prevCompStr = calculateCompliance(previousValue.value, targetReference, kpi.name || "");
          previousCompliance = parseFloat(prevCompStr.replace('%', '')) || 0;
        }

        // Calcular tendencia de compliance
        let complianceChange: number | null = null;
        let trendDirection: 'up' | 'down' | 'stable' | null = null;

        if (previousCompliance !== null && previousCompliance !== 0) {
          complianceChange = Math.round((compliance - previousCompliance) * 10) / 10;
          if (complianceChange > 0.5) trendDirection = 'up';
          else if (complianceChange < -0.5) trendDirection = 'down';
          else trendDirection = 'stable';
        }

        return {
          ...kpi,
          id: kpi.id,
          companyId: kpi.companyId, // Asegurar que companyId se incluya explícitamente
          latestValue,
          previousValue,
          compliance,
          complianceChange,
          trendDirection,
          status,
          lastUpdate: latestValue?.date || null
        };
      }));

      const totalKpis = kpisWithData.length;
      const kpisWithValues = kpisWithData.filter(k => k.latestValue);
      const compliantKpis = kpisWithData.filter(k => k.status === 'complies').length;
      const alertKpis = kpisWithData.filter(k => k.status === 'alert').length;
      const notCompliantKpis = kpisWithData.filter(k => k.status === 'not_compliant').length;

      // Promedio de compliance (solo KPIs con valores)
      const averageCompliance = kpisWithValues.length > 0
        ? kpisWithValues.reduce((sum, k) => sum + k.compliance, 0) / kpisWithValues.length
        : 0;

      // Porcentaje de KPIs cumplidos
      const compliantPercentage = totalKpis > 0 ? (compliantKpis / totalKpis) * 100 : 0;

      // Score: 50% promedio compliance + 30% % cumplidos + 20% actualizaciones
      const updateScore = totalKpis > 0 ? (kpisWithValues.length / totalKpis) * 100 : 0;
      const score = (averageCompliance * 0.5) + (compliantPercentage * 0.3) + (updateScore * 0.2);

      // Calcular score del período anterior para comparación
      // Usar la frecuencia más común de los KPIs del colaborador, o default a monthly
      const frequencies = kpisWithData.map(k => k.frequency || 'monthly');
      const mostCommonFrequency = frequencies.length > 0
        ? frequencies.sort((a, b) =>
            frequencies.filter(v => v === a).length - frequencies.filter(v => v === b).length
          ).pop() || 'monthly'
        : 'monthly';

      const previousPeriodStart = getPreviousPeriodStart(mostCommonFrequency);
      const previousPeriodText = getPeriodText(mostCommonFrequency);

      // Calcular score del período anterior
      const previousKpisWithData = kpisWithData.map((kpi: any) => {
        const values = valuesByKpiId.get(kpi.id) || [];
        const latestDate = kpi.latestValue?.date ? new Date(kpi.latestValue.date) : new Date();

        // Buscar el último valor del período anterior para este KPI
        const previousValue = values.find((v: any) => {
          if (!v.date) return false;
          const vDate = new Date(v.date);
          return vDate < latestDate && vDate >= previousPeriodStart;
        });

        if (!previousValue) return null;

        const compliance = parseFloat(previousValue.compliancePercentage?.toString().replace('%', '') || '0');
        const status = previousValue.status || 'not_compliant';

        return {
          ...kpi,
          latestValue: previousValue,
          compliance,
          status,
          lastUpdate: previousValue.date || null
        };
      }).filter(k => k !== null);

      const previousScore = previousKpisWithData.length > 0
        ? calculateScore(previousKpisWithData)
        : null;

      // Calcular cambio de score
      let scoreChange: number | null = null;
      let scoreTrendDirection: 'up' | 'down' | 'stable' | null = null;

      if (previousScore !== null) {
        scoreChange = Math.round(score) - Math.round(previousScore);
        if (scoreChange > 0) scoreTrendDirection = 'up';
        else if (scoreChange < 0) scoreTrendDirection = 'down';
        else scoreTrendDirection = 'stable';
      }

      // Clasificación del estado del colaborador (basado en score promedio)
      // Umbrales alineados con kpi-utils.ts: 100% cumple, 90% alerta, <90% no cumple
      let status: 'excellent' | 'good' | 'regular' | 'critical';
      if (score >= 100) status = 'excellent';
      else if (score >= 90) status = 'good';
      else if (score >= 70) status = 'regular';
      else status = 'critical';

      // Última actualización (más reciente de todos los KPIs)
      const lastUpdate = kpisWithData
        .map(k => k.lastUpdate)
        .filter(d => d !== null)
        .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null;

      return {
        name: collab.name,
        score: Math.round(score),
        status,
        averageCompliance: Math.round(averageCompliance * 10) / 10,
        compliantKpis,
        alertKpis,
        notCompliantKpis,
        totalKpis,
        lastUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
        scoreChange,
        scoreChangePeriod: previousPeriodText,
        trendDirection: scoreTrendDirection,
        kpis: kpisWithData
      };
    }));
    collaborators.sort((a, b) => b.score - a.score); // Ordenar por score descendente

    // Calcular promedio del equipo y tendencia
    const teamScores = collaborators.map(c => c.score);
    const teamAverage = teamScores.length > 0
      ? Math.round(teamScores.reduce((sum, s) => sum + s, 0) / teamScores.length)
      : 0;

    // Calcular tendencia promedio del equipo
    const teamScoreChanges = collaborators
      .map(c => c.scoreChange)
      .filter((change): change is number => change !== null);

    const teamTrend = teamScoreChanges.length > 0
      ? Math.round((teamScoreChanges.reduce((sum, c) => sum + c, 0) / teamScoreChanges.length) * 10) / 10
      : null;

    const teamTrendDirection: 'up' | 'down' | 'stable' | null = teamTrend !== null
      ? (teamTrend > 0 ? 'up' : teamTrend < 0 ? 'down' : 'stable')
      : null;

    // Determinar período de comparación del equipo (usar el más común)
    const periods = collaborators
      .map(c => c.scoreChangePeriod)
      .filter((p): p is string => p !== null);
    const mostCommonPeriod = periods.length > 0
      ? periods.sort((a, b) =>
          periods.filter(p => p === a).length - periods.filter(p => p === b).length
        ).pop() || null
      : null;

    console.log(`✅ [GET /api/collaborators-performance] Retornando ${collaborators.length} colaboradores`);

    // 📊 FEATURE: Agregar datos históricos (12 meses) para cada colaborador
    const collaboratorsWithHistory = await Promise.all(collaborators.map(async (collaborator) => {
      try {
        // Obtener KPI IDs de este colaborador
        const kpiIds = collaborator.kpis.map(k => k.id);

        if (kpiIds.length === 0) {
          return {
            ...collaborator,
            historicalCompliance: fillMissingMonths([]),
            advancedTrend: { direction: null, strength: 0, slope: 0, r2: 0 }
          };
        }

        // Query SQL optimizada para obtener 12 meses de datos históricos
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const minYear = twelveMonthsAgo.getFullYear();

        // Determinar tabla correcta basada en el companyId del KPI (whitelist)
        const KPI_TABLE_MAP: Record<number, string> = { 1: 'kpi_values_dura', 2: 'kpi_values_orsega' };
        const kpiCompanyId = collaborator.kpis[0]?.companyId;
        const tableName = KPI_TABLE_MAP[kpiCompanyId as number];
        if (!tableName) {
          throw new Error(`Invalid companyId for KPI table: ${kpiCompanyId}`);
        }

        // Construir query con placeholders seguros
        const placeholders = kpiIds.map((_: number, idx: number) => `$${idx + 2}`).join(', ');
        const monthCase = `CASE UPPER(month)
            WHEN 'ENERO' THEN '01' WHEN 'FEBRERO' THEN '02' WHEN 'MARZO' THEN '03'
            WHEN 'ABRIL' THEN '04' WHEN 'MAYO' THEN '05' WHEN 'JUNIO' THEN '06'
            WHEN 'JULIO' THEN '07' WHEN 'AGOSTO' THEN '08' WHEN 'SEPTIEMBRE' THEN '09'
            WHEN 'OCTUBRE' THEN '10' WHEN 'NOVIEMBRE' THEN '11' WHEN 'DICIEMBRE' THEN '12'
            ELSE '00'
          END`;
        const query = `
          SELECT
            year::text || '-' || (${monthCase}) as month_key,
            AVG(
              CASE
                WHEN compliance_percentage IS NOT NULL
                THEN CAST(REPLACE(compliance_percentage, '%', '') AS DECIMAL)
                ELSE NULL
              END
            ) as avg_compliance
          FROM ${tableName}
          WHERE kpi_id IN (${placeholders})
            AND year >= $1
          GROUP BY year, UPPER(month)
          ORDER BY month_key ASC
        `;

        const params = [minYear, ...kpiIds];

        const historicalData = await sql(query, params);

        // Transformar y rellenar meses faltantes
        const transformedData = historicalData.map((row: any) => ({
          month: row.month_key,
          compliance: row.avg_compliance ? parseFloat(row.avg_compliance) : null
        }));

        const completeHistory = fillMissingMonths(transformedData, 12);
        const advancedTrend = calculateAdvancedTrend(completeHistory);

        return {
          ...collaborator,
          historicalCompliance: completeHistory,
          advancedTrend
        };
      } catch (error: any) {
        console.error(`❌ Error fetching historical data for ${collaborator.name}:`, error);
        // ✅ FIX CRÍTICO: Agregar flags de error para notificar al frontend
        return {
          ...collaborator,
          historicalCompliance: fillMissingMonths([]),
          advancedTrend: { direction: null, strength: 0, slope: 0, r2: 0 },
          hasHistoryError: true,
          historyErrorMessage: error.message || 'Error desconocido al cargar historial'
        };
      }
    }));

    // Preparar respuesta
    const responseData = {
      collaborators: collaboratorsWithHistory || [],
      teamAverage,
      teamTrend,
      teamTrendDirection,
      teamTrendPeriod: mostCommonPeriod
    };

    // 🚀 OPTIMIZATION: Cache the result
    collaboratorPerformanceCache.set(cacheKey, responseData);
    console.log(`💾 [GET /api/collaborators-performance] Datos almacenados en cache`);

    // Retornar con metadata del equipo
    res.json(responseData);
  } catch (error: any) {
    console.error("❌ [GET /api/collaborators-performance] Error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// ==============================
// POST /api/kpi-values
// ==============================
router.post("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const validatedData = insertKpiValueSchema.parse(req.body);
    let companyId = validatedData.companyId;

    if (!companyId) {
      const allKpis = await storage.getKpis();
      const match = allKpis.find((item: any) => item.id === validatedData.kpiId);
      companyId = match?.companyId ?? undefined;
    }

    if (!companyId) {
      return res.status(400).json({ message: "Debe especificarse companyId (1=Dura, 2=Orsega)" });
    }

    const kpi = await storage.getKpi(validatedData.kpiId, companyId);
    if (!kpi) {
      console.error(`[POST /api/kpi-values] KPI ${validatedData.kpiId} no encontrado para companyId=${companyId}`);
      return res.status(404).json({ message: "KPI not found" });
    }

    const [previous] = await storage.getLatestKpiValues(validatedData.kpiId, 1, companyId);
    let status = validatedData.status ?? null;
    let compliancePercentage = validatedData.compliancePercentage ?? null;

    const targetReference = kpi.target ?? kpi.goal;
    const kpiName = kpi.name || "";
    console.log(`[KPI Update] Calculando estado para KPI ${kpi.id} (${kpiName})`);
    console.log(`[KPI Update] Valor: "${validatedData.value}", Target/Goal: "${targetReference}"`);

    // ✅ Usar funciones centralizadas de @shared/kpi-utils
    // Esto garantiza consistencia entre backend y frontend
    if (targetReference) {
      const numericCurrentValue = parseNumericValue(validatedData.value);
      const numericTarget = parseNumericValue(targetReference);

      console.log(`[KPI Update] Valores numéricos - Actual: ${numericCurrentValue}, Target: ${numericTarget}`);
      console.log(`[KPI Update] ¿Métrica invertida (lower is better)? ${isLowerBetterKPI(kpiName)}`);

      if (!isNaN(numericCurrentValue) && !isNaN(numericTarget)) {
        // Calcular estado y compliance usando funciones centralizadas
        status = calculateKpiStatus(validatedData.value, targetReference, kpiName);
        compliancePercentage = calculateCompliance(validatedData.value, targetReference, kpiName).replace('%', '');

        console.log(`[KPI Update] Estado calculado: ${status}, Compliance: ${compliancePercentage}%`);
      } else {
        console.warn(`[KPI Update] No se pudieron convertir valores a números. Actual: ${numericCurrentValue}, Target: ${numericTarget}`);
        status = status || "alert";
        compliancePercentage = compliancePercentage || "0.0";
      }
    } else {
      console.warn(`[KPI Update] No hay target ni goal definido para KPI ${kpi.id}`);
      status = status || "alert";
      compliancePercentage = compliancePercentage || "0.0";
    }

    // Asegurar que siempre haya valores asignados
    status = status || "alert";
    compliancePercentage = compliancePercentage || "0.0";

    const payload = {
      ...validatedData,
      companyId,
      status,
      compliancePercentage,
      updatedBy: user.id,
    };

    console.log('[POST /api/kpi-values] Creando KPI value con payload:', JSON.stringify(payload, null, 2));
    const kpiValue = await storage.createKpiValue(payload);
    console.log('[POST /api/kpi-values] ✅ KPI value creado exitosamente:', kpiValue.id);
    collaboratorPerformanceCache.flushAll();

    // Intentar crear notificación de cambio de estado (si aplica)
    if (previous?.status && kpiValue.status && previous.status !== kpiValue.status) {
      try {
        console.log(`[POST /api/kpi-values] Creando notificación de cambio de estado: ${previous.status} → ${kpiValue.status}`);
        await createKPIStatusChangeNotification(kpi, user, previous.status, kpiValue.status, storage);
        console.log('[POST /api/kpi-values] ✅ Notificación creada exitosamente');
      } catch (notifError) {
        // No fallar si la notificación falla, solo loguear
        console.error('[POST /api/kpi-values] ⚠️  Error al crear notificación (no crítico):', notifError);
      }
    }

    res.status(201).json(kpiValue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[POST /api/kpi-values] Validation error:', error.errors);
      return res.status(400).json({ message: error.errors });
    }
    // Log detallado del error para debugging
    console.error('[POST /api/kpi-values] ❌ ERROR CRÍTICO:');
    console.error('[POST /api/kpi-values] Error object:', error);
    console.error('[POST /api/kpi-values] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[POST /api/kpi-values] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[POST /api/kpi-values] Request body:', JSON.stringify(req.body, null, 2));

    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// ==============================
// Bulk update KPI values endpoint - Para editar historial completo del año
// ==============================
router.put("/api/kpi-values/bulk", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const { kpiId, companyId, values } = req.body;

    console.log(`[PUT /api/kpi-values/bulk] Iniciando bulk update para KPI ${kpiId}, companyId: ${companyId}`);
    console.log(`[PUT /api/kpi-values/bulk] Usuario: ${user.id}, Valores recibidos: ${values?.length || 0}`);

    // Validación de entrada
    if (!kpiId || !companyId) {
      console.error(`[PUT /api/kpi-values/bulk] ❌ Faltan parámetros requeridos: kpiId=${kpiId}, companyId=${companyId}`);
      return res.status(400).json({
        message: "Se requiere kpiId y companyId"
      });
    }

    if (!Array.isArray(values)) {
      console.error(`[PUT /api/kpi-values/bulk] ❌ 'values' no es un array:`, typeof values);
      return res.status(400).json({
        message: "Se requiere un array de values"
      });
    }

    if (values.length === 0) {
      console.warn(`[PUT /api/kpi-values/bulk] ⚠️ Array de values está vacío`);
      return res.status(400).json({
        message: "El array de values no puede estar vacío"
      });
    }

    // Obtener KPI
    const kpi = await storage.getKpi(kpiId, companyId);
    if (!kpi) {
      console.error(`[PUT /api/kpi-values/bulk] ❌ KPI ${kpiId} no encontrado para companyId ${companyId}`);
      return res.status(404).json({ message: "KPI not found" });
    }

    console.log(`[PUT /api/kpi-values/bulk] KPI encontrado: "${kpi.name}", target: ${kpi.target || kpi.goal}`);

    const targetReference = kpi.target ?? kpi.goal;
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Procesar cada valor
    for (const item of values) {
      const { month, year, value, comments } = item;

      // Validar item
      if (!month || !year || value === undefined || value === null) {
        console.warn(`[PUT /api/kpi-values/bulk] ⚠️ Item inválido, saltando:`, { month, year, value });
        errorCount++;
        results.push({
          month: month || 'N/A',
          year: year || 'N/A',
          success: false,
          error: "Datos incompletos: falta month, year o value"
        });
        continue;
      }

      // Validar que year sea un número
      const yearNum = typeof year === 'number' ? year : parseInt(String(year), 10);
      if (isNaN(yearNum)) {
        console.warn(`[PUT /api/kpi-values/bulk] ⚠️ Año inválido: ${year}`);
        errorCount++;
        results.push({ month, year, success: false, error: `Año inválido: ${year}` });
        continue;
      }

      let status: string | null = null;
      let compliancePercentage: string | null = null;

      // Calcular status y compliancePercentage usando funciones centralizadas de @shared/kpi-utils
      if (targetReference) {
        try {
          const kpiName = kpi.name || "";
          status = calculateKpiStatus(value, targetReference, kpiName);
          compliancePercentage = calculateCompliance(value, targetReference, kpiName).replace('%', '');
        } catch (calcError: any) {
          console.error(`[PUT /api/kpi-values/bulk] ❌ Error calculando status para ${month} ${year}:`, calcError);
          status = "alert";
          compliancePercentage = "0.0";
        }
      } else {
        console.warn(`[PUT /api/kpi-values/bulk] ⚠️ KPI ${kpiId} no tiene target/goal definido`);
        status = "alert";
        compliancePercentage = "0.0";
      }

      // Guardar valor
      try {
        console.log(`[PUT /api/kpi-values/bulk] Guardando ${month} ${yearNum}: value="${value}", status=${status}, compliance=${compliancePercentage}`);
        console.log(`[PUT /api/kpi-values/bulk] Datos completos:`, {
          kpiId,
          companyId,
          month,
          year: yearNum,
          value: value.toString(),
          period: `${month} ${yearNum}`
        });

        const kpiValue = await storage.createKpiValue({
          kpiId,
          companyId, // ✅ Asegurar que companyId se pasa explícitamente
          value: value.toString(),
          month,
          year: yearNum,
          period: `${month} ${yearNum}`,
          status,
          compliancePercentage,
          comments: comments || null,
          updatedBy: user.id,
        });

        successCount++;
        results.push({ month, year: yearNum, success: true, kpiValue });
        console.log(`[PUT /api/kpi-values/bulk] ✅ Guardado exitoso: ${month} ${yearNum} (ID: ${kpiValue.id})`);
      } catch (error: any) {
        errorCount++;
        console.error(`[PUT /api/kpi-values/bulk] ❌ Error guardando ${month} ${yearNum}:`, error);
        console.error(`[PUT /api/kpi-values/bulk] Detalles del error:`, {
          message: error.message,
          stack: error.stack,
          code: error.code,
          detail: error.detail,
          hint: error.hint
        });
        results.push({
          month,
          year: yearNum,
          success: false,
          error: error.message || "Error desconocido al guardar"
        });
      }
    }

    const summary = {
      success: true,
      total: values.length,
      successful: successCount,
      failed: errorCount,
      message: `Se actualizaron ${successCount} de ${values.length} valores${errorCount > 0 ? ` (${errorCount} fallaron)` : ''}`,
      results
    };

    console.log(`[PUT /api/kpi-values/bulk] ✅ Bulk update completado:`, summary);

    if (successCount > 0) {
      collaboratorPerformanceCache.flushAll();
    }
    res.json(summary);
  } catch (error: any) {
    console.error('[PUT /api/kpi-values/bulk] ❌ Error general en bulk update:', error);
    console.error('[PUT /api/kpi-values/bulk] Stack trace:', error.stack);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

export default router;
