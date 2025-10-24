import { db } from "./db";
import { exchangeRates } from "@shared/schema";
import { gte, eq, and } from "drizzle-orm";

interface RatePoint {
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

  const series = rates.map((r: { date: Date; buy: number; sell: number }) => ({
    date: r.date.toISOString().split("T")[0],
    buy: r.buy,
    sell: r.sell,
  }));

  const lastUpdate = rates.length > 0 ? rates[rates.length - 1].date.toISOString().split("T")[0] : null;

  return {
    source,
    series,
    last_update: lastUpdate,
  };
}

function calculateTrend7d(series: RatePoint[], useField: "sell" | "buy" = "sell"): TrendClassification {
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

function calculateVolatility5d(series: RatePoint[], useField: "sell" | "buy" = "sell"): VolatilityClassification {
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

function calculateSpreadStatus(series: RatePoint[]): string {
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
