import { db } from "./db";
import { exchangeRates } from "@shared/schema";
import { gte, eq, and, desc } from "drizzle-orm";

export interface RatePoint {
  date: Date;
  buy: number;
  sell: number;
}

interface SourceSeries {
  source: string;
  series: Array<{ date: string; buy: number; sell: number }>;
  last_update: string | null;
}

type TrendClassification = "Alcista" | "Bajista" | "Estable" | "N/D";
type VolatilityClassification = "Alta" | "Media" | "Baja" | "N/D";

export async function getSourceSeries(
  source: string,
  days: number = 30
): Promise<SourceSeries> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  // Ajustar a medianoche para evitar problemas de timezone
  cutoffDate.setHours(0, 0, 0, 0);

  // 🔍 DIAGNÓSTICO: Log de fecha de corte
  console.log(`[getSourceSeries] 🔍 DIAGNÓSTICO - ${source}:`, {
    days,
    cutoffDateISO: cutoffDate.toISOString(),
    cutoffDateLocal: cutoffDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
    fechaActual: new Date().toISOString(),
    fechaActualLocal: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
  });

  const rates = await db
    .select({
      date: exchangeRates.date,
      buy: exchangeRates.buyRate,
      sell: exchangeRates.sellRate,
    })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.source, source),
        gte(exchangeRates.date, cutoffDate)
      )
    )
    .orderBy(desc(exchangeRates.date)); // Más reciente primero

  console.log(`[getSourceSeries] ${source}: ${rates.length} registros encontrados`);
  if (rates.length > 0) {
    const firstRate = rates[0];
    console.log(`[getSourceSeries] ${source} - Más reciente (RAW):`, {
      dateType: typeof firstRate.date,
      dateValue: firstRate.date,
      dateString: String(firstRate.date),
      dateISO: firstRate.date instanceof Date ? firstRate.date.toISOString() : 'NOT A DATE',
      dateLocal: firstRate.date instanceof Date ? firstRate.date.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'NOT A DATE',
      buy: firstRate.buy,
      sell: firstRate.sell
    });
  }

  // Mantener la fecha y hora completa para que el frontend pueda mostrar la hora exacta
  const series = rates.map((r: { date: Date; buy: number; sell: number }) => {
    // Asegurar que la fecha sea un objeto Date válido
    let dateObj: Date;
    if (r.date instanceof Date) {
      dateObj = r.date;
    } else if (typeof r.date === 'string') {
      dateObj = new Date(r.date);
    } else {
      // Si es un objeto de fecha de PostgreSQL (que puede venir como string o Date)
      dateObj = new Date(r.date);
    }
    
    return {
      date: dateObj.toISOString(), // Mantener fecha y hora completa
      buy: r.buy,
      sell: r.sell,
    };
  });

  // Calcular lastUpdate con manejo seguro de fechas
  let lastUpdate: string | null = null;
  if (rates.length > 0) {
    const firstDate = rates[0].date;
    if (firstDate instanceof Date) {
      lastUpdate = firstDate.toISOString();
    } else {
      const dateObj = new Date(firstDate);
      lastUpdate = dateObj.toISOString();
    }
  }

  return {
    source,
    series,
    last_update: lastUpdate,
  };
}

export function calculateTrend7d(series: RatePoint[], useField: "sell" | "buy" = "sell"): TrendClassification {
  if (series.length < 2) return "N/D";

  const t0 = series[series.length - 1];
  
  const t7Date = new Date(t0.date);
  t7Date.setDate(t7Date.getDate() - 7);
  
  let closestPoint: RatePoint | null = null;
  let closestDiff = Infinity;
  
  for (const point of series) {
    const diff = Math.abs(point.date.getTime() - t7Date.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closestPoint = point;
    }
  }
  
  if (!closestPoint || closestPoint === t0) return "N/D";
  
  const pct = ((t0[useField] - closestPoint[useField]) / closestPoint[useField]) * 100;
  
  if (pct >= 0.5) return "Alcista";
  if (pct <= -0.5) return "Bajista";
  return "Estable";
}

export function calculateVolatility5d(series: RatePoint[], useField: "sell" | "buy" = "sell"): VolatilityClassification {
  if (series.length < 3) return "N/D";
  
  const last6 = series.slice(-6);
  if (last6.length < 3) return "N/D";
  
  const diffs: number[] = [];
  for (let i = 1; i < last6.length; i++) {
    const prev = last6[i - 1][useField];
    const curr = last6[i][useField];
    if (prev !== 0) {
      const pctChange = Math.abs((curr - prev) / prev) * 100;
      diffs.push(pctChange);
    }
  }
  
  if (diffs.length < 3) return "N/D";
  
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  
  if (mean > 1.0) return "Alta";
  if (mean >= 0.5) return "Media";
  return "Baja";
}

export function calculateSpreadStatus(series: RatePoint[]): string {
  if (series.length < 10) return "Datos insuficientes";
  
  const last30 = series.slice(-30);
  const spreads = last30.map(p => p.sell - p.buy);
  
  const currentSpread = spreads[spreads.length - 1];
  const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  
  const squaredDiffs = spreads.map(s => Math.pow(s - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / spreads.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return "Spread estable";
  
  if (currentSpread > mean + 2 * stdDev) {
    return "Por encima del promedio 30d";
  } else if (currentSpread < mean - 2 * stdDev) {
    return "Por debajo del promedio 30d";
  }
  
  return "Dentro del rango normal";
}

export async function getComparison(
  days: number = 30,
  usdMonthly: number = 25000
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const sources = ["MONEX", "Santander", "DOF"];
  const ratesBySource: Record<string, RatePoint[]> = {};

  for (const source of sources) {
    const rates = await db
      .select({
        date: exchangeRates.date,
        buy: exchangeRates.buyRate,
        sell: exchangeRates.sellRate,
      })
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.source, source),
          gte(exchangeRates.date, cutoffDate)
        )
      )
      .orderBy(exchangeRates.date);

    ratesBySource[source] = rates.map((r: { date: Date; buy: number; sell: number }) => ({
      date: r.date,
      buy: r.buy,
      sell: r.sell,
    }));
  }

  const latestRates: Record<string, { buy: number; sell: number } | null> = {};
  let mostRecentDate: Date | null = null;

  for (const source of sources) {
    const series = ratesBySource[source];
    if (series.length > 0) {
      const latest = series[series.length - 1];
      latestRates[source] = { buy: latest.buy, sell: latest.sell };
      if (!mostRecentDate || latest.date > mostRecentDate) {
        mostRecentDate = latest.date;
      }
    } else {
      latestRates[source] = null;
    }
  }

  const validRates = Object.entries(latestRates).filter(([_, rate]) => rate !== null);
  
  let bestBuy = { source: "N/D", rate: 0 };
  let bestSell = { source: "N/D", rate: 0 };
  
  if (validRates.length > 0) {
    const buyRates = validRates.map(([source, rate]) => ({ source, rate: rate!.buy }));
    const sellRates = validRates.map(([source, rate]) => ({ source, rate: rate!.sell }));
    
    bestBuy = buyRates.reduce((min, curr) => curr.rate < min.rate ? curr : min);
    bestSell = sellRates.reduce((max, curr) => curr.rate > max.rate ? curr : max);
  }

  const dofRate = latestRates["DOF"];
  let baselineBuy = dofRate?.buy ?? 0;
  let baselineSell = dofRate?.sell ?? 0;
  
  if (!dofRate && validRates.length > 0) {
    const buyAvg = validRates.reduce((sum, [_, rate]) => sum + rate!.buy, 0) / validRates.length;
    const sellAvg = validRates.reduce((sum, [_, rate]) => sum + rate!.sell, 0) / validRates.length;
    baselineBuy = buyAvg;
    baselineSell = sellAvg;
  }

  const savingsIfBuyAtBest = baselineBuy > 0 ? (baselineBuy - bestBuy.rate) * usdMonthly : 0;
  const savingsIfSellAtBest = baselineSell > 0 ? (bestSell.rate - baselineSell) * usdMonthly : 0;

  const spreadsAnalysis = sources.map(source => {
    const series = ratesBySource[source];
    const latest = latestRates[source];
    
    if (!latest || series.length === 0) {
      return {
        source,
        buy: 0,
        sell: 0,
        spread: 0,
        spread_status: "Sin datos",
        trend_7d: "N/D" as TrendClassification,
        trend_pct: 0,
        volatility_5d: "N/D" as VolatilityClassification,
      };
    }

    const spread = latest.sell - latest.buy;
    const trend = calculateTrend7d(series);
    const volatility = calculateVolatility5d(series);
    const spreadStatus = calculateSpreadStatus(series);
    
    const trendPct = (() => {
      if (series.length < 2) return 0;
      const t0 = series[series.length - 1];
      const t7Date = new Date(t0.date);
      t7Date.setDate(t7Date.getDate() - 7);
      
      let closestPoint: RatePoint | null = null;
      let closestDiff = Infinity;
      
      for (const point of series) {
        const diff = Math.abs(point.date.getTime() - t7Date.getTime());
        if (diff < closestDiff) {
          closestDiff = diff;
          closestPoint = point;
        }
      }
      
      if (!closestPoint || closestPoint === t0) return 0;
      return ((t0.sell - closestPoint.sell) / closestPoint.sell) * 100;
    })();

    return {
      source,
      buy: latest.buy,
      sell: latest.sell,
      spread: parseFloat(spread.toFixed(4)),
      spread_status: spreadStatus,
      trend_7d: trend,
      trend_pct: parseFloat(trendPct.toFixed(2)),
      volatility_5d: volatility,
    };
  });

  return {
    as_of: mostRecentDate ? mostRecentDate.toISOString() : new Date().toISOString(),
    rates: latestRates,
    best_buy: bestBuy,
    best_sell: bestSell,
    baseline: {
      source: dofRate ? "DOF" : "Promedio",
      buy: parseFloat(baselineBuy.toFixed(4)),
      sell: parseFloat(baselineSell.toFixed(4)),
    },
    savings_calculator: {
      if_buy_at_best_vs_baseline: parseFloat(savingsIfBuyAtBest.toFixed(2)),
      if_sell_at_best_vs_baseline: parseFloat(savingsIfSellAtBest.toFixed(2)),
    },
    spreads_analysis: spreadsAnalysis,
  };
}
