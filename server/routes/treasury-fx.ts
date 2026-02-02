import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { getSourceSeries, getComparison } from '../fx-analytics';
import { emailService } from '../email-service';
import { logger } from '../logger';

const router = Router();

// GET /api/treasury/exchange-rates
router.get("/api/treasury/exchange-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      // Para el histrico 24h necesitamos ms registros, aumentar a 100 por defecto
      const { limit = 100 } = req.query;

      const result = await sql(`
        SELECT
          er.id,
          er.buy_rate,
          er.sell_rate,
          er.source,
          -- Interpretar fecha como CDMX y convertir a UTC para enviar al frontend
          (er.date AT TIME ZONE 'America/Mexico_City')::text as date,
          er.notes,
          u.name as created_by_name,
          u.email as created_by_email
        FROM exchange_rates er
        LEFT JOIN users u ON er.created_by = u.id
        ORDER BY er.date DESC
        LIMIT $1
      `, [parseInt(limit as string)]);

      // Las fechas ya vienen con timezone correcto desde PostgreSQL
      const formattedResult = result.map((row: any) => ({
        ...row,
        date: row.date.endsWith('Z') ? row.date : row.date + 'Z'
      }));

      res.json(formattedResult);
    } catch (error) {
      logger.error('Error fetching exchange rates', error);
      res.status(500).json({ error: 'Failed to fetch exchange rates' });
    }
  });

  // GET /api/treasury/exchange-rates/daily - Historial diario (ltimas 24 horas por defecto)
  // Compatible hacia atrs: sin parmetros nuevos = comportamiento actual (ltimas 24 horas)
  router.get("/api/treasury/exchange-rates/daily", jwtAuthMiddleware, async (req, res) => {
    try {
      const rateType = (req.query.rateType as string) || 'buy'; // 'buy' o 'sell'
      const daysParam = req.query.days ? parseInt(req.query.days as string) : undefined;
      const days = daysParam && daysParam > 0 && daysParam <= 7 ? daysParam : 1; // Default: 1 da (24 horas), mximo: 7 das
      const sourcesParam = req.query.sources;

      // Calcular fecha de inicio segn das
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - (days * 24));
      startDate.setMinutes(0, 0, 0);

      // Procesar fuentes filtradas (opcional)
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam)
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());

        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({
            error: `Fuentes invlidas: ${invalidSources.join(', ')}. Fuentes vlidas: ${validSources.join(', ')}`
          });
        }
      }

      logger.debug(`[Daily Exchange Rates] Request - rateType: ${rateType}, days: ${days}`, { rateType, days, sources, since: startDate.toISOString() });

      // Construir query SQL con filtro de fuentes (opcional)
      let query = `
        SELECT
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1
      `;

      const params: any[] = [startDate.toISOString()];

      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 2}`).join(', ')})`;
        params.push(...sources);
      }

      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Daily Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar por hora y fuente - tomar el ltimo valor de cada fuente por hora
      const hourMap = new Map<string, {
        hour: string;
        timestamp: string;
        santander?: number;
        monex?: number;
        dof?: number;
      }>();

      // Primero, agrupar todos los registros por hora y fuente, guardando el ms reciente de cada combinacin
      const recordsByHourSource = new Map<string, { timestamp: Date; rate: number }>();

      result.forEach((row: any) => {
        const date = new Date(row.date);
        // Formatear hora en formato HH:mm
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const hourKey = `${hours}:${minutes}`;
        const source = (row.source || '').toLowerCase().trim();
        const sourceKey = `${hourKey}_${source}`;

        const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);

        // Guardar el registro ms reciente para cada combinacin hora-fuente
        if (!recordsByHourSource.has(sourceKey) || date > recordsByHourSource.get(sourceKey)!.timestamp) {
          recordsByHourSource.set(sourceKey, { timestamp: date, rate: rateValue });
        }
      });

      // Ahora construir el mapa final agrupado por hora
      recordsByHourSource.forEach((record, sourceKey) => {
        const [hourKey, source] = sourceKey.split('_');

        if (!hourMap.has(hourKey)) {
          hourMap.set(hourKey, {
            hour: hourKey,
            timestamp: record.timestamp.toISOString(),
            santander: undefined,
            monex: undefined,
            dof: undefined,
          });
        }

        const hourData = hourMap.get(hourKey)!;
        // Actualizar timestamp si es ms reciente
        if (new Date(record.timestamp) > new Date(hourData.timestamp)) {
          hourData.timestamp = record.timestamp.toISOString();
        }

        if (source === 'santander') hourData.santander = record.rate;
        else if (source === 'monex') hourData.monex = record.rate;
        else if (source === 'dof') hourData.dof = record.rate;
      });

      // Convertir a array y ordenar por timestamp
      const formattedResult = Array.from(hourMap.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      logger.debug(`[Daily Exchange Rates] Resultado formateado: ${formattedResult.length} puntos de datos`, {
        count: formattedResult.length,
        firstPoint: formattedResult[0] || null,
        lastPoint: formattedResult[formattedResult.length - 1] || null
      });

      res.json(formattedResult);
    } catch (error) {
      logger.error('[Daily Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to fetch daily exchange rates' });
    }
  });

  // GET /api/treasury/exchange-rates/monthly - Promedios mensuales por da
  // Compatible hacia atrs: sin parmetros nuevos = comportamiento actual (1 mes)
  router.get("/api/treasury/exchange-rates/monthly", jwtAuthMiddleware, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const rateType = (req.query.rateType as string) || 'buy'; // 'buy' o 'sell'
      const monthsParam = req.query.months ? parseInt(req.query.months as string) : undefined;
      const months = monthsParam && monthsParam > 0 && monthsParam <= 12 ? monthsParam : 1; // Default: 1 mes, mximo: 12 meses
      const sourcesParam = req.query.sources;

      // Calcular inicio y fin segn meses
      const startDate = new Date(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(year, month - 1 + months, 0, 23, 59, 59);

      // Procesar fuentes filtradas (opcional)
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam)
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());

        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({
            error: `Fuentes invlidas: ${invalidSources.join(', ')}. Fuentes vlidas: ${validSources.join(', ')}`
          });
        }
      }

      logger.debug(`[Monthly Exchange Rates] Request`, { year, month, months, rateType, sources, startDate: startDate.toISOString(), endDate: endDate.toISOString() });

      // Construir query SQL con filtro de fuentes (opcional)
      let query = `
        SELECT
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1 AND er.date <= $2
      `;

      const params: any[] = [startDate.toISOString(), endDate.toISOString()];

      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 3}`).join(', ')})`;
        params.push(...sources);
      }

      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Monthly Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar por da y fuente, calcular promedio
      const dayMap = new Map<number, {
        day: number;
        date: string;
        santander?: { sum: number; count: number };
        monex?: { sum: number; count: number };
        dof?: { sum: number; count: number };
      }>();

      result.forEach((row: any) => {
        const date = new Date(row.date);
        const day = date.getDate();
        const dateKey = date.toISOString().split('T')[0];

        const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
        const source = (row.source || '').toLowerCase().trim();

        if (!dayMap.has(day)) {
          dayMap.set(day, {
            day,
            date: dateKey,
            santander: undefined,
            monex: undefined,
            dof: undefined,
          });
        }

        const dayData = dayMap.get(day)!;
        if (source === 'santander') {
          if (!dayData.santander) dayData.santander = { sum: 0, count: 0 };
          dayData.santander.sum += rateValue;
          dayData.santander.count += 1;
        } else if (source === 'monex') {
          if (!dayData.monex) dayData.monex = { sum: 0, count: 0 };
          dayData.monex.sum += rateValue;
          dayData.monex.count += 1;
        } else if (source === 'dof') {
          if (!dayData.dof) dayData.dof = { sum: 0, count: 0 };
          dayData.dof.sum += rateValue;
          dayData.dof.count += 1;
        }
      });

      // Calcular promedios y formatear
      const formattedResult = Array.from(dayMap.values())
        .map(dayData => ({
          day: dayData.day,
          date: dayData.date,
          santander: dayData.santander ? dayData.santander.sum / dayData.santander.count : undefined,
          monex: dayData.monex ? dayData.monex.sum / dayData.monex.count : undefined,
          dof: dayData.dof ? dayData.dof.sum / dayData.dof.count : undefined,
        }))
        .sort((a, b) => a.day - b.day);

      logger.debug(`[Monthly Exchange Rates] Resultado formateado: ${formattedResult.length} das con datos`, {
        count: formattedResult.length,
        firstDay: formattedResult[0] || null,
        lastDay: formattedResult[formattedResult.length - 1] || null
      });

      res.json(formattedResult);
    } catch (error) {
      logger.error('[Monthly Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to fetch monthly exchange rates' });
    }
  });

  // GET /api/treasury/exchange-rates/range - Historial para rango de fechas personalizado
  router.get("/api/treasury/exchange-rates/range", jwtAuthMiddleware, async (req, res) => {
    try {
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      const rateType = (req.query.rateType as string) || 'buy';
      const sourcesParam = req.query.sources;
      const interval = (req.query.interval as string) || 'day'; // 'hour' | 'day' | 'month'

      // Validar fechas requeridas
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({
          error: 'startDate y endDate son requeridos',
          example: '/api/treasury/exchange-rates/range?startDate=2025-01-01&endDate=2025-01-07'
        });
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      // Validar fechas vlidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Fechas invlidas. Use formato ISO 8601 (YYYY-MM-DD)' });
      }

      // Validar rango mximo (1 ao)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return res.status(400).json({ error: 'El rango mximo es de 365 das (1 ao)' });
      }

      if (endDate < startDate) {
        return res.status(400).json({ error: 'endDate debe ser posterior a startDate' });
      }

      // Procesar fuentes filtradas
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam)
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());

        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({
            error: `Fuentes invlidas: ${invalidSources.join(', ')}. Fuentes vlidas: ${validSources.join(', ')}`
          });
        }
      }

      logger.debug(`[Range Exchange Rates] Request`, {
        startDate: startDateStr,
        endDate: endDateStr,
        rateType,
        sources,
        interval,
        daysDiff
      });

      // Ajustar fechas para incluir todo el da
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // Construir query SQL con filtro de fuentes
      let query = `
        SELECT
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1 AND er.date <= $2
      `;

      const params: any[] = [startDate.toISOString(), endDate.toISOString()];

      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 3}`).join(', ')})`;
        params.push(...sources);
      }

      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Range Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar segn intervalo
      let formattedResult: any[] = [];

      if (interval === 'hour') {
        // Agrupar por hora
        const hourMap = new Map<string, {
          date: string;
          hour: string;
          timestamp: string;
          santander?: number;
          monex?: number;
          dof?: number;
        }>();

        result.forEach((row: any) => {
          const date = new Date(row.date);
          const hourKey = `${date.toISOString().split('T')[0]}T${String(date.getHours()).padStart(2, '0')}:00:00Z`;

          if (!hourMap.has(hourKey)) {
            hourMap.set(hourKey, {
              date: date.toISOString().split('T')[0],
              hour: `${String(date.getHours()).padStart(2, '0')}:00`,
              timestamp: hourKey,
              santander: undefined,
              monex: undefined,
              dof: undefined,
            });
          }

          const hourData = hourMap.get(hourKey)!;
          const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
          const source = (row.source || '').toLowerCase().trim();

          if (source === 'santander') hourData.santander = rateValue;
          else if (source === 'monex') hourData.monex = rateValue;
          else if (source === 'dof') hourData.dof = rateValue;
        });

        formattedResult = Array.from(hourMap.values())
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      } else if (interval === 'day') {
        // Agrupar por da (promedio)
        const dayMap = new Map<string, {
          date: string;
          santander?: { sum: number; count: number };
          monex?: { sum: number; count: number };
          dof?: { sum: number; count: number };
        }>();

        result.forEach((row: any) => {
          const date = new Date(row.date);
          const dateKey = date.toISOString().split('T')[0];

          if (!dayMap.has(dateKey)) {
            dayMap.set(dateKey, {
              date: dateKey,
              santander: undefined,
              monex: undefined,
              dof: undefined,
            });
          }

          const dayData = dayMap.get(dateKey)!;
          const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
          const source = (row.source || '').toLowerCase().trim();

          if (source === 'santander') {
            if (!dayData.santander) dayData.santander = { sum: 0, count: 0 };
            dayData.santander.sum += rateValue;
            dayData.santander.count += 1;
          } else if (source === 'monex') {
            if (!dayData.monex) dayData.monex = { sum: 0, count: 0 };
            dayData.monex.sum += rateValue;
            dayData.monex.count += 1;
          } else if (source === 'dof') {
            if (!dayData.dof) dayData.dof = { sum: 0, count: 0 };
            dayData.dof.sum += rateValue;
            dayData.dof.count += 1;
          }
        });

        formattedResult = Array.from(dayMap.values())
          .map(dayData => ({
            date: dayData.date,
            santander: dayData.santander ? dayData.santander.sum / dayData.santander.count : undefined,
            monex: dayData.monex ? dayData.monex.sum / dayData.monex.count : undefined,
            dof: dayData.dof ? dayData.dof.sum / dayData.dof.count : undefined,
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      } else if (interval === 'month') {
        // Agrupar por mes (promedio)
        const monthMap = new Map<string, {
          year: number;
          month: number;
          date: string;
          santander?: { sum: number; count: number };
          monex?: { sum: number; count: number };
          dof?: { sum: number; count: number };
        }>();

        result.forEach((row: any) => {
          const date = new Date(row.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, {
              year: date.getFullYear(),
              month: date.getMonth() + 1,
              date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
              santander: undefined,
              monex: undefined,
              dof: undefined,
            });
          }

          const monthData = monthMap.get(monthKey)!;
          const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
          const source = (row.source || '').toLowerCase().trim();

          if (source === 'santander') {
            if (!monthData.santander) monthData.santander = { sum: 0, count: 0 };
            monthData.santander.sum += rateValue;
            monthData.santander.count += 1;
          } else if (source === 'monex') {
            if (!monthData.monex) monthData.monex = { sum: 0, count: 0 };
            monthData.monex.sum += rateValue;
            monthData.monex.count += 1;
          } else if (source === 'dof') {
            if (!monthData.dof) monthData.dof = { sum: 0, count: 0 };
            monthData.dof.sum += rateValue;
            monthData.dof.count += 1;
          }
        });

        formattedResult = Array.from(monthMap.values())
          .map(monthData => ({
            year: monthData.year,
            month: monthData.month,
            date: monthData.date,
            santander: monthData.santander ? monthData.santander.sum / monthData.santander.count : undefined,
            monex: monthData.monex ? monthData.monex.sum / monthData.monex.count : undefined,
            dof: monthData.dof ? monthData.dof.sum / monthData.dof.count : undefined,
          }))
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });
      }

      logger.debug(`[Range Exchange Rates] Resultado formateado: ${formattedResult.length} puntos`, {
        count: formattedResult.length,
        interval,
        firstPoint: formattedResult[0] || null,
        lastPoint: formattedResult[formattedResult.length - 1] || null
      });

      res.json(formattedResult);
    } catch (error) {
      logger.error('[Range Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to fetch exchange rates for range' });
    }
  });

  // GET /api/treasury/exchange-rates/stats - Estadsticas para un rango de fechas
  router.get("/api/treasury/exchange-rates/stats", jwtAuthMiddleware, async (req, res) => {
    try {
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      const rateType = (req.query.rateType as string) || 'buy';
      const sourcesParam = req.query.sources;

      // Validar fechas requeridas
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({
          error: 'startDate y endDate son requeridos',
          example: '/api/treasury/exchange-rates/stats?startDate=2025-01-01&endDate=2025-01-31'
        });
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      // Validar fechas vlidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Fechas invlidas. Use formato ISO 8601 (YYYY-MM-DD)' });
      }

      // Validar rango mximo (1 ao)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return res.status(400).json({ error: 'El rango mximo es de 365 das (1 ao)' });
      }

      if (endDate < startDate) {
        return res.status(400).json({ error: 'endDate debe ser posterior a startDate' });
      }

      // Procesar fuentes filtradas
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam)
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());

        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({
            error: `Fuentes invlidas: ${invalidSources.join(', ')}. Fuentes vlidas: ${validSources.join(', ')}`
          });
        }
      }

      logger.debug(`[Stats Exchange Rates] Request`, {
        startDate: startDateStr,
        endDate: endDateStr,
        rateType,
        sources
      });

      // Ajustar fechas para incluir todo el da
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // Construir query SQL con filtro de fuentes
      let query = `
        SELECT
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1 AND er.date <= $2
      `;

      const params: any[] = [startDate.toISOString(), endDate.toISOString()];

      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 3}`).join(', ')})`;
        params.push(...sources);
      }

      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Stats Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar por fuente y calcular estadsticas
      const sourceMap = new Map<string, number[]>();

      result.forEach((row: any) => {
        const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
        const source = (row.source || '').toLowerCase().trim();

        if (!sourceMap.has(source)) {
          sourceMap.set(source, []);
        }

        sourceMap.get(source)!.push(rateValue);
      });

      // Calcular estadsticas para cada fuente
      const stats = Array.from(sourceMap.entries()).map(([source, values]) => {
        if (values.length === 0) {
          return null;
        }

        // Ordenar valores para calcular min/max
        const sortedValues = [...values].sort((a, b) => a - b);
        const min = sortedValues[0];
        const max = sortedValues[sortedValues.length - 1];

        // Calcular promedio
        const sum = values.reduce((acc, val) => acc + val, 0);
        const average = sum / values.length;

        // Calcular volatilidad (desviacin estndar)
        const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
        const volatility = Math.sqrt(variance);

        // Calcular tendencia (comparar primeros y ltimos valores)
        const firstValue = values[0];
        const lastValue = values[values.length - 1];
        const trendThreshold = average * 0.001; // 0.1% del promedio como umbral

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (lastValue > firstValue + trendThreshold) {
          trend = 'up';
        } else if (lastValue < firstValue - trendThreshold) {
          trend = 'down';
        }

        return {
          source: source.charAt(0).toUpperCase() + source.slice(1), // Capitalizar primera letra
          average: Math.round(average * 10000) / 10000, // 4 decimales
          max: Math.round(max * 10000) / 10000,
          min: Math.round(min * 10000) / 10000,
          volatility: Math.round(volatility * 10000) / 10000,
          trend,
          count: values.length
        };
      }).filter((stat): stat is NonNullable<typeof stat> => stat !== null);

      // Ordenar por nombre de fuente
      stats.sort((a, b) => {
        const order = ['Monex', 'Santander', 'Dof'];
        const aIndex = order.indexOf(a.source);
        const bIndex = order.indexOf(b.source);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.source.localeCompare(b.source);
      });

      logger.debug(`[Stats Exchange Rates] Estadsticas calculadas: ${stats.length} fuentes`, {
        count: stats.length,
        sources: stats.map(s => s.source)
      });

      res.json(stats);
    } catch (error) {
      logger.error('[Stats Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to calculate exchange rate statistics' });
    }
  });

  // POST /api/treasury/exchange-rates/refresh-dof - Forzar actualizacin del DOF (admin)
  router.post("/api/treasury/exchange-rates/refresh-dof", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      console.log(`[Manual DOF Refresh] Solicitado por usuario ${user.id} (${user.email})`);

      const { fetchDOFExchangeRate } = await import("../dof-scheduler");
      await fetchDOFExchangeRate();

      res.json({
        success: true,
        message: "Actualizacin del DOF ejecutada correctamente",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error al actualizar DOF manualmente:', error);
      res.status(500).json({ error: 'Failed to refresh DOF exchange rate' });
    }
  });

  // POST /api/treasury/exchange-rates - Registrar tipo de cambio
  router.post("/api/treasury/exchange-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      let { buyRate, sellRate, source, notes } = req.body;

      // Validar que para DOF, buyRate === sellRate
      if (source?.toUpperCase() === 'DOF') {
        if (Math.abs(buyRate - sellRate) > 0.0001) {
          return res.status(400).json({
            error: 'Para DOF, el tipo de cambio de compra y venta deben ser iguales'
          });
        }
        // Normalizar: usar el mismo valor para ambos
        sellRate = buyRate;
      }

      // Usar NOW() con timezone explcito para asegurar que la fecha tenga la hora exacta
      const result = await sql(`
        INSERT INTO exchange_rates (buy_rate, sell_rate, source, notes, created_by, date)
        VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'America/Mexico_City')
        RETURNING id, buy_rate, sell_rate, source, date::text as date, notes, created_by
      `, [buyRate, sellRate, source || null, notes || null, user.id]);

      const inserted = result[0];
      const dateObj = new Date(inserted.date);
      const formattedResult = {
        ...inserted,
        date: dateObj.toISOString()
      };

      console.log(`[Exchange Rate POST] Registro creado:`, {
        id: inserted.id,
        source: source,
        buyRate: buyRate,
        sellRate: sellRate,
        rawDate: inserted.date,
        isoDate: formattedResult.date,
        timestamp: new Date().toISOString()
      });

      // Trigger webhook a N8N para notificacin de tipo de cambio
      const n8nWebhookUrl = process.env.N8N_EXCHANGE_RATE_WEBHOOK_URL;
      if (n8nWebhookUrl) {
        try {
          // Pre-formatear datos para que N8N no tenga que procesarlos
          const buyRateNum = parseFloat(buyRate);
          const sellRateNum = parseFloat(sellRate);

          // Usar hora actual para el email (el webhook se enva inmediatamente)
          // Esto evita problemas de timezone con la fecha de DB
          const now = new Date();
          const cdmxOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/Mexico_City' };
          const fechaCDMX = now.toLocaleDateString('sv-SE', cdmxOptions); // formato YYYY-MM-DD
          const horaCDMX = now.toLocaleTimeString('es-MX', { ...cdmxOptions, hour12: false });

          const webhookPayload = {
            event: 'exchange_rate_updated',
            // Datos crudos
            data: {
              id: inserted.id,
              buyRate: buyRateNum,
              sellRate: sellRateNum,
              source: source || 'manual',
              date: formattedResult.date,
              createdBy: user.name || user.email,
            },
            // Datos pre-formateados para el email (evita errores de JS en N8N)
            formatted: {
              asunto: `Tipo de Cambio Actualizado - ${(source || 'MANUAL').toUpperCase()} - $${buyRateNum.toFixed(4)}`,
              fecha: fechaCDMX,
              hora: horaCDMX,
              compra: buyRateNum.toFixed(4),
              venta: sellRateNum.toFixed(4),
              fuente: (source || 'manual').toUpperCase(),
              usuario: user.name || user.email || 'Sistema',
            },
            timestamp: new Date().toISOString()
          };

          console.log(`[N8N Webhook] Enviando payload:`, JSON.stringify(webhookPayload, null, 2));

          fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          }).then(response => {
            console.log(`[N8N Webhook] Tipo de cambio enviado a N8N: ${response.status}`);
          }).catch(err => {
            console.error(`[N8N Webhook] Error enviando a N8N:`, err.message);
          });
        } catch (webhookError) {
          console.error(`[N8N Webhook] Error:`, webhookError);
        }
      }

      res.status(201).json(formattedResult);
    } catch (error) {
      console.error('Error creating exchange rate:', error);
      res.status(500).json({ error: 'Failed to create exchange rate' });
    }
  });

  // POST /api/treasury/request-purchase - Solicitar compra de dlares a Lolita
  router.post("/api/treasury/request-purchase", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { source, amountUsd, amountMxn, rate, notes } = req.body;

      if (!source || !amountUsd || !amountMxn || !rate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Buscar el email de Lolita o usar un email por defecto
      const lolitaEmail = 'dolores@grupoorsega.com'; // Email de Lolita

      // Crear el mensaje de email
      const emailSubject = `Solicitud de Compra de Dolares - ${source}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
            Solicitud de Compra de Dolares
          </h2>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;"><strong>Hola Lolita,</strong></p>
            <p style="margin: 10px 0; font-size: 14px;">
              Por favor compra <strong style="color: #2563eb; font-size: 18px;">${parseFloat(amountUsd).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
              a precio de <strong style="color: #2563eb;">$${parseFloat(rate).toFixed(4)} MXN</strong> (${source}).
            </p>
            <p style="margin: 10px 0; font-size: 14px;">
              <strong>Total a pagar:</strong> <span style="color: #16a34a; font-size: 18px;">$${parseFloat(amountMxn).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
            </p>
            ${notes ? `<p style="margin: 10px 0; font-size: 14px;"><strong>Nota:</strong> ${notes}</p>` : ''}
          </div>

          <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
            <p style="margin: 0; font-size: 12px; color: #1e40af;">
              Esta solicitud fue enviada desde el sistema por ${user.name || user.email}
            </p>
          </div>

          <p style="margin-top: 20px; font-size: 14px;">
            Gracias,<br>
            <strong>${user.name || 'Emilio'}</strong>
          </p>
        </div>
      `;

      // Enviar email a Lolita
      const emailResult = await emailService.sendEmail({
        to: lolitaEmail,
        subject: emailSubject,
        html: emailBody,
      }, 'treasury');

      if (!emailResult.success) {
        console.error('Error sending email:', emailResult.error);
        // No fallar la solicitud si falla el email, pero loguear el error
      }

      res.status(200).json({
        success: true,
        message: 'Solicitud enviada exitosamente a Lolita',
        emailSent: emailResult.success,
        requestId: Date.now(),
      });
    } catch (error) {
      console.error('Error processing purchase request:', error);
      res.status(500).json({ error: 'Failed to process purchase request' });
    }
  });

  // GET /api/fx/source-series - Obtener serie de datos de una fuente
  router.get("/api/fx/source-series", jwtAuthMiddleware, async (req, res) => {
    try {
      const source = req.query.source as string || "MONEX";
      const days = parseInt(req.query.days as string) || 30;

      const result = await getSourceSeries(source, days);
      res.json(result);
    } catch (error) {
      console.error('Error fetching source series:', error);
      res.status(500).json({ error: 'Failed to fetch source series' });
    }
  });

  // GET /api/fx/compare - Obtener comparacin entre fuentes
  router.get("/api/fx/compare", jwtAuthMiddleware, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const usdMonthly = parseFloat(req.query.usd_monthly as string) || 25000;

      const result = await getComparison(days, usdMonthly);
      res.json(result);
    } catch (error) {
      console.error('Error fetching comparison:', error);
      res.status(500).json({ error: 'Failed to fetch comparison' });
    }
  });

  // POST /api/fx/import-historical - Importar datos histricos de Banxico
  router.post("/api/fx/import-historical", jwtAuthMiddleware, async (req, res) => {
    try {
      const { importBanxicoHistoricalData } = await import("../banxico-importer");

      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const result = await importBanxicoHistoricalData(startDate, endDate);
      res.json(result);
    } catch (error) {
      console.error('Error importing historical data:', error);
      res.status(500).json({ error: 'Failed to import historical data' });
    }
  });

  // POST /api/admin/seed-fx-rates - Importar tipos de cambio histricos de Banxico
  router.post("/api/admin/seed-fx-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);

      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores pueden ejecutar este endpoint' });
      }

      const { startDate, endDate } = req.body;
      // Default to last 3 months if no dates provided
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const start = startDate || threeMonthsAgo.toISOString().split('T')[0];
      const end = endDate || now.toISOString().split('T')[0];

      console.log(`Importando tipos de cambio de Banxico: ${start} a ${end}`);

      const { importBanxicoHistoricalData } = await import("../banxico-importer");
      const result = await importBanxicoHistoricalData(start, end);

      console.log(`Importacion completada: ${result.imported} registros nuevos`);

      res.json({
        message: `Importados ${result.imported} tipos de cambio (${result.skipped} ya existian)`,
        ...result
      });

    } catch (error) {
      console.error('Error al importar tipos de cambio:', error);
      res.status(500).json({
        error: 'Error al importar tipos de cambio',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

export default router;
