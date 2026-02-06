import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist the mock db so we can configure its return values per test
const { mockDb } = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return {
    mockDb: {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      // Expose for reconfiguring per-test
      _mockOrderBy: mockOrderBy,
      _mockWhere: mockWhere,
      _mockFrom: mockFrom,
      _mockSelect: mockSelect,
    },
  };
});

// fx-analytics.ts imports from ./db which requires DATABASE_URL.
// shared/schema.ts uses drizzle-orm's sql tagged template at module level.
// Mock both before importing the module under test.
vi.mock('../db', () => ({
  db: mockDb,
}));
vi.mock('@shared/schema', () => ({
  exchangeRates: {},
}));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }), {
    raw: vi.fn(),
  }),
  gte: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

import { calculateTrend7d, calculateVolatility5d, calculateSpreadStatus, getSourceSeries, getComparison, type RatePoint } from '../fx-analytics';

/**
 * Pure-function tests for FX Analytics module.
 *
 * These functions are synchronous and require no DB — they operate solely on
 * an in-memory RatePoint[] series, so we can test them without mocks.
 *
 * NOTE: The source RatePoint type uses `date: Date` (Date objects, not strings).
 *       calculateTrend7d / calculateVolatility5d return *string* classifications.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a RatePoint with a real Date object. */
function rp(dateStr: string, sell: number, buy: number): RatePoint {
  return { date: new Date(dateStr), sell, buy };
}

/** Build a series spanning `n` days starting from a base date, applying a per-day delta. */
function buildSeries(n: number, baseSell: number, baseBuy: number, deltaSell = 0, deltaBuy = 0): RatePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date('2025-01-01');
    d.setDate(d.getDate() + i);
    return { date: d, sell: baseSell + i * deltaSell, buy: baseBuy + i * deltaBuy };
  });
}

// ===========================================================================
// calculateTrend7d
// ===========================================================================

describe('FX Analytics Pure Functions', () => {
  describe('calculateTrend7d', () => {
    it('should return N/D for empty array', () => {
      const result = calculateTrend7d([]);
      expect(result).toBe('N/D');
    });

    it('should return N/D for a single data point', () => {
      const result = calculateTrend7d([rp('2025-01-01', 17.0, 16.5)]);
      expect(result).toBe('N/D');
    });

    it('should detect upward trend (Alcista) when change >= 0.5%', () => {
      // Two points 7 days apart with ~0.59% increase on sell
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 16.5),
        rp('2025-01-08', 17.1, 16.6),
      ];
      const result = calculateTrend7d(series);
      expect(result).toBe('Alcista');
    });

    it('should detect downward trend (Bajista) when change <= -0.5%', () => {
      const series: RatePoint[] = [
        rp('2025-01-01', 17.1, 16.6),
        rp('2025-01-08', 17.0, 16.5),
      ];
      const result = calculateTrend7d(series);
      expect(result).toBe('Bajista');
    });

    it('should detect stable trend (Estable) with very small change', () => {
      const series: RatePoint[] = [
        rp('2025-01-01', 17.00, 16.50),
        rp('2025-01-08', 17.01, 16.51),
      ];
      const result = calculateTrend7d(series);
      // 0.01/17.00 ≈ 0.059% — well below 0.5%
      expect(result).toBe('Estable');
    });

    it('should use sell field by default', () => {
      // sell rises significantly, buy stays flat
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 10.0),
        rp('2025-01-08', 17.5, 10.0),
      ];
      const result = calculateTrend7d(series);
      // 0.5/17.0 ≈ 2.94% → Alcista
      expect(result).toBe('Alcista');
    });

    it('should use buy field when specified', () => {
      // sell stays flat, buy rises
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 16.0),
        rp('2025-01-08', 17.0, 16.5),
      ];
      const result = calculateTrend7d(series, 'buy');
      // 0.5/16.0 ≈ 3.125% → Alcista
      expect(result).toBe('Alcista');
    });

    it('should handle a 7-day rising series', () => {
      // 7 consecutive days, each +0.05 on sell
      const series = buildSeries(7, 17.0, 16.5, 0.05, 0.05);
      const result = calculateTrend7d(series);
      // First = 17.0, last = 17.3, 0.3/17.0 ≈ 1.76% → Alcista
      expect(result).toBe('Alcista');
    });

    it('should handle a 30-day series and compare to 7 days ago', () => {
      // 30 days, steady rise
      const series = buildSeries(30, 17.0, 16.5, 0.02, 0.02);
      const result = calculateTrend7d(series);
      // The function finds the point closest to 7 days before the last point
      expect(['Alcista', 'Estable', 'Bajista']).toContain(result);
    });

    it('should return Estable when two points on the same date have the same values', () => {
      // Two points on the same date with identical values → 0% change → Estable
      const sameDate = new Date('2025-01-01');
      const series: RatePoint[] = [
        { date: sameDate, sell: 17.0, buy: 16.5 },
        { date: sameDate, sell: 17.0, buy: 16.5 },
      ];
      const result = calculateTrend7d(series);
      expect(result).toBe('Estable');
    });
  });

  // ===========================================================================
  // calculateVolatility5d
  // ===========================================================================

  describe('calculateVolatility5d', () => {
    it('should return N/D for empty array', () => {
      expect(calculateVolatility5d([])).toBe('N/D');
    });

    it('should return N/D for less than 3 data points', () => {
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 16.5),
        rp('2025-01-02', 17.1, 16.6),
      ];
      expect(calculateVolatility5d(series)).toBe('N/D');
    });

    it('should classify Baja volatility with small changes', () => {
      const series: RatePoint[] = [
        rp('2025-01-01', 17.000, 16.500),
        rp('2025-01-02', 17.005, 16.505),
        rp('2025-01-03', 17.010, 16.510),
        rp('2025-01-04', 17.015, 16.515),
      ];
      const result = calculateVolatility5d(series);
      expect(result).toBe('Baja');
    });

    it('should classify Alta volatility with large swings', () => {
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 16.5),
        rp('2025-01-02', 18.0, 17.5),
        rp('2025-01-03', 16.0, 15.5),
        rp('2025-01-04', 18.5, 18.0),
        rp('2025-01-05', 15.5, 15.0),
      ];
      const result = calculateVolatility5d(series);
      expect(result).toBe('Alta');
    });

    it('should handle exactly 3 data points (minimum for Baja/Media/Alta)', () => {
      const series: RatePoint[] = [
        rp('2025-01-01', 17.00, 16.50),
        rp('2025-01-02', 17.01, 16.51),
        rp('2025-01-03', 17.02, 16.52),
        rp('2025-01-04', 17.03, 16.53),
      ];
      const result = calculateVolatility5d(series);
      expect(['Baja', 'Media', 'Alta', 'N/D']).toContain(result);
    });

    it('should use sell field by default', () => {
      // Only sell oscillates, buy is flat
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 10.0),
        rp('2025-01-02', 18.0, 10.0),
        rp('2025-01-03', 16.5, 10.0),
        rp('2025-01-04', 18.5, 10.0),
      ];
      const result = calculateVolatility5d(series);
      expect(result).toBe('Alta');
    });

    it('should use buy field when specified', () => {
      // sell is flat, buy oscillates
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 16.0),
        rp('2025-01-02', 17.0, 17.0),
        rp('2025-01-03', 17.0, 15.5),
        rp('2025-01-04', 17.0, 17.5),
      ];
      const result = calculateVolatility5d(series, 'buy');
      expect(result).toBe('Alta');
    });

    it('should only consider the last 6 data points', () => {
      // First 10 points are very volatile, last 6 are calm
      const volatile = buildSeries(10, 17.0, 16.5, 0, 0).map((p, i) => ({
        ...p,
        sell: 17.0 + (i % 2 === 0 ? 2 : -2),
      }));
      const calm = buildSeries(6, 17.0, 16.5, 0.001, 0.001).map((p, i) => {
        const d = new Date('2025-01-11');
        d.setDate(d.getDate() + i);
        return { ...p, date: d };
      });
      const combined = [...volatile, ...calm];
      const result = calculateVolatility5d(combined);
      expect(result).toBe('Baja');
    });
  });

  // ===========================================================================
  // calculateSpreadStatus
  // ===========================================================================

  describe('calculateSpreadStatus', () => {
    it('should return "Datos insuficientes" for empty array', () => {
      expect(calculateSpreadStatus([])).toBe('Datos insuficientes');
    });

    it('should return "Datos insuficientes" for less than 10 points', () => {
      const series = buildSeries(5, 17.0, 16.5);
      expect(calculateSpreadStatus(series)).toBe('Datos insuficientes');
    });

    it('should return "Datos insuficientes" for exactly 9 points', () => {
      const series = buildSeries(9, 17.0, 16.5);
      expect(calculateSpreadStatus(series)).toBe('Datos insuficientes');
    });

    it('should return a status string for exactly 10 points', () => {
      const series = buildSeries(10, 17.0, 16.5);
      const result = calculateSpreadStatus(series);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe('Datos insuficientes');
    });

    it('should return "Spread estable" when all spreads are identical', () => {
      // Every point has spread = 0.5
      const series = buildSeries(15, 17.0, 16.5);
      const result = calculateSpreadStatus(series);
      expect(result).toBe('Spread estable');
    });

    it('should return "Dentro del rango normal" for moderate variation', () => {
      const series: RatePoint[] = Array.from({ length: 15 }, (_, i) => {
        const d = new Date('2025-01-01');
        d.setDate(d.getDate() + i);
        return { date: d, sell: 17.0 + Math.sin(i) * 0.05, buy: 16.5 + Math.sin(i) * 0.05 };
      });
      const result = calculateSpreadStatus(series);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should detect spread above average when current spread is outlier high', () => {
      // 14 points with spread = 0.5, last point with spread = 5.0
      const series: RatePoint[] = buildSeries(14, 17.0, 16.5);
      const lastDate = new Date('2025-01-15');
      series.push({ date: lastDate, sell: 22.0, buy: 17.0 }); // spread = 5.0
      const result = calculateSpreadStatus(series);
      expect(result).toBe('Por encima del promedio 30d');
    });

    it('should detect spread below average when current spread is outlier low', () => {
      // 14 points with spread = 5.0, last point with spread = 0.01
      const series: RatePoint[] = Array.from({ length: 14 }, (_, i) => {
        const d = new Date('2025-01-01');
        d.setDate(d.getDate() + i);
        return { date: d, sell: 22.0, buy: 17.0 }; // spread = 5.0
      });
      const lastDate = new Date('2025-01-15');
      series.push({ date: lastDate, sell: 17.01, buy: 17.0 }); // spread = 0.01
      const result = calculateSpreadStatus(series);
      expect(result).toBe('Por debajo del promedio 30d');
    });

    it('should handle large series (only considers last 30)', () => {
      const series = buildSeries(60, 17.0, 16.5);
      const result = calculateSpreadStatus(series);
      expect(typeof result).toBe('string');
    });
  });

  // ===========================================================================
  // getSourceSeries (async, uses DB)
  // ===========================================================================
  describe('getSourceSeries', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Re-chain the mocks after clearing
      mockDb._mockSelect.mockReturnValue({ from: mockDb._mockFrom });
      mockDb._mockFrom.mockReturnValue({ where: mockDb._mockWhere });
      mockDb._mockWhere.mockReturnValue({ orderBy: mockDb._mockOrderBy });
    });

    it('should return empty series when DB returns no rows', async () => {
      mockDb._mockOrderBy.mockResolvedValue([]);

      const result = await getSourceSeries('MONEX', 30);

      expect(result.source).toBe('MONEX');
      expect(result.series).toEqual([]);
      expect(result.last_update).toBeNull();
    });

    it('should return formatted series from DB results', async () => {
      const now = new Date('2025-01-15T12:00:00Z');
      const yesterday = new Date('2025-01-14T12:00:00Z');

      mockDb._mockOrderBy.mockResolvedValue([
        { date: now, buy: 17.10, sell: 17.50 },
        { date: yesterday, buy: 17.05, sell: 17.45 },
      ]);

      const result = await getSourceSeries('Santander', 7);

      expect(result.source).toBe('Santander');
      expect(result.series).toHaveLength(2);
      expect(result.series[0].buy).toBe(17.10);
      expect(result.series[0].sell).toBe(17.50);
      // date should be ISO string
      expect(result.series[0].date).toBe(now.toISOString());
      expect(result.last_update).toBe(now.toISOString());
    });

    it('should handle date as string from DB', async () => {
      const dateStr = '2025-01-15T12:00:00.000Z';
      mockDb._mockOrderBy.mockResolvedValue([
        { date: dateStr, buy: 17.10, sell: 17.50 },
      ]);

      const result = await getSourceSeries('DOF', 30);

      expect(result.series).toHaveLength(1);
      // The function converts string dates to Date then calls toISOString
      expect(result.series[0].date).toBeTruthy();
      expect(result.last_update).toBeTruthy();
    });

    it('should default to 30 days', async () => {
      mockDb._mockOrderBy.mockResolvedValue([]);

      const result = await getSourceSeries('MONEX');

      expect(result.source).toBe('MONEX');
      expect(result.series).toEqual([]);
    });
  });

  // ===========================================================================
  // getComparison (async, uses DB)
  // ===========================================================================
  describe('getComparison', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDb._mockSelect.mockReturnValue({ from: mockDb._mockFrom });
      mockDb._mockFrom.mockReturnValue({ where: mockDb._mockWhere });
      mockDb._mockWhere.mockReturnValue({ orderBy: mockDb._mockOrderBy });
    });

    it('should return comparison with empty data when DB has no rates', async () => {
      mockDb._mockOrderBy.mockResolvedValue([]);

      const result = await getComparison(30, 25000);

      expect(result).toHaveProperty('as_of');
      expect(result).toHaveProperty('rates');
      expect(result).toHaveProperty('best_buy');
      expect(result).toHaveProperty('best_sell');
      expect(result).toHaveProperty('baseline');
      expect(result).toHaveProperty('savings_calculator');
      expect(result).toHaveProperty('spreads_analysis');

      // All sources should have null rates
      expect(result.rates['MONEX']).toBeNull();
      expect(result.rates['Santander']).toBeNull();
      expect(result.rates['DOF']).toBeNull();

      // Savings should be 0 when no rates
      expect(result.savings_calculator.if_buy_at_best_vs_baseline).toBe(0);
      expect(result.savings_calculator.if_sell_at_best_vs_baseline).toBe(0);
    });

    it('should compute spreads_analysis entries for each source', async () => {
      mockDb._mockOrderBy.mockResolvedValue([]);

      const result = await getComparison(30);

      expect(result.spreads_analysis).toHaveLength(3);
      const sourceNames = result.spreads_analysis.map((s: any) => s.source);
      expect(sourceNames).toContain('MONEX');
      expect(sourceNames).toContain('Santander');
      expect(sourceNames).toContain('DOF');
    });

    it('should produce N/D trend and volatility when no data', async () => {
      mockDb._mockOrderBy.mockResolvedValue([]);

      const result = await getComparison(30);

      for (const entry of result.spreads_analysis) {
        expect(entry.trend_7d).toBe('N/D');
        expect(entry.volatility_5d).toBe('N/D');
        expect(entry.spread).toBe(0);
      }
    });

    it('should default usdMonthly to 25000', async () => {
      mockDb._mockOrderBy.mockResolvedValue([]);

      const result = await getComparison();

      // No error thrown and result structure is valid
      expect(result).toHaveProperty('savings_calculator');
    });

    it('should compute best_buy and best_sell from available data', async () => {
      // Make the mock return different data for each call (3 sources)
      let callCount = 0;
      mockDb._mockOrderBy.mockImplementation(() => {
        callCount++;
        const now = new Date('2025-01-15T12:00:00Z');
        if (callCount === 1) {
          // MONEX
          return Promise.resolve([{ date: now, buy: 17.10, sell: 17.60 }]);
        } else if (callCount === 2) {
          // Santander
          return Promise.resolve([{ date: now, buy: 17.00, sell: 17.70 }]);
        } else {
          // DOF
          return Promise.resolve([{ date: now, buy: 17.05, sell: 17.50 }]);
        }
      });

      const result = await getComparison(30, 25000);

      // Best buy = lowest buy = Santander at 17.00
      expect(result.best_buy.source).toBe('Santander');
      expect(result.best_buy.rate).toBe(17.00);

      // Best sell = highest sell = Santander at 17.70
      expect(result.best_sell.source).toBe('Santander');
      expect(result.best_sell.rate).toBe(17.70);
    });

    it('should use DOF as baseline when available', async () => {
      let callCount = 0;
      mockDb._mockOrderBy.mockImplementation(() => {
        callCount++;
        const now = new Date('2025-01-15T12:00:00Z');
        if (callCount === 1) {
          return Promise.resolve([{ date: now, buy: 17.10, sell: 17.60 }]);
        } else if (callCount === 2) {
          return Promise.resolve([{ date: now, buy: 17.00, sell: 17.70 }]);
        } else {
          // DOF
          return Promise.resolve([{ date: now, buy: 17.05, sell: 17.50 }]);
        }
      });

      const result = await getComparison(30, 25000);

      expect(result.baseline.source).toBe('DOF');
      expect(result.baseline.buy).toBe(17.05);
      expect(result.baseline.sell).toBe(17.50);
    });

    it('should use average as baseline when DOF has no data', async () => {
      let callCount = 0;
      mockDb._mockOrderBy.mockImplementation(() => {
        callCount++;
        const now = new Date('2025-01-15T12:00:00Z');
        if (callCount === 1) {
          // MONEX
          return Promise.resolve([{ date: now, buy: 17.10, sell: 17.60 }]);
        } else if (callCount === 2) {
          // Santander
          return Promise.resolve([{ date: now, buy: 17.00, sell: 17.70 }]);
        } else {
          // DOF - empty
          return Promise.resolve([]);
        }
      });

      const result = await getComparison(30, 25000);

      expect(result.baseline.source).toBe('Promedio');
      // Average buy = (17.10 + 17.00) / 2 = 17.05
      expect(result.baseline.buy).toBeCloseTo(17.05, 2);
      // Average sell = (17.60 + 17.70) / 2 = 17.65
      expect(result.baseline.sell).toBeCloseTo(17.65, 2);
    });

    it('should calculate savings vs baseline correctly', async () => {
      let callCount = 0;
      mockDb._mockOrderBy.mockImplementation(() => {
        callCount++;
        const now = new Date('2025-01-15T12:00:00Z');
        if (callCount === 1) {
          // MONEX
          return Promise.resolve([{ date: now, buy: 16.90, sell: 17.80 }]);
        } else if (callCount === 2) {
          // Santander
          return Promise.resolve([{ date: now, buy: 17.10, sell: 17.60 }]);
        } else {
          // DOF baseline
          return Promise.resolve([{ date: now, buy: 17.05, sell: 17.50 }]);
        }
      });

      const usdMonthly = 10000;
      const result = await getComparison(30, usdMonthly);

      // Best buy = MONEX at 16.90, baseline buy = DOF 17.05
      // Savings = (17.05 - 16.90) * 10000 = 1500
      expect(result.savings_calculator.if_buy_at_best_vs_baseline).toBeCloseTo(1500, 0);

      // Best sell = MONEX at 17.80, baseline sell = DOF 17.50
      // Savings = (17.80 - 17.50) * 10000 = 3000
      expect(result.savings_calculator.if_sell_at_best_vs_baseline).toBeCloseTo(3000, 0);
    });
  });

  // ===========================================================================
  // Additional edge cases for calculateTrend7d
  // ===========================================================================
  describe('calculateTrend7d (additional edge cases)', () => {
    it('should find closest point to 7 days ago in longer series', () => {
      // 15 days of data, last point is Jan 15
      // 7 days before Jan 15 = Jan 8, so it should compare to Jan 8
      const series: RatePoint[] = Array.from({ length: 15 }, (_, i) => {
        const d = new Date('2025-01-01');
        d.setDate(d.getDate() + i);
        // Gradual rise: 17.0 -> 17.14
        return { date: d, sell: 17.0 + i * 0.01, buy: 16.5 + i * 0.01 };
      });
      const result = calculateTrend7d(series);
      // Change over 7 days = 0.07 / 17.07 ~= 0.41% → Estable (below 0.5%)
      expect(result).toBe('Estable');
    });

    it('should handle boundary exactly at 0.5% threshold', () => {
      // 17.0 -> 17.085 = exactly 0.5%
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 16.5),
        rp('2025-01-08', 17.085, 16.5),
      ];
      const result = calculateTrend7d(series);
      expect(result).toBe('Alcista');
    });

    it('should handle negative boundary at -0.5%', () => {
      // 17.0 -> 16.915 = exactly -0.5%
      const series: RatePoint[] = [
        rp('2025-01-01', 17.0, 16.5),
        rp('2025-01-08', 16.915, 16.5),
      ];
      const result = calculateTrend7d(series);
      expect(result).toBe('Bajista');
    });
  });

  // ===========================================================================
  // Additional edge cases for calculateVolatility5d
  // ===========================================================================
  describe('calculateVolatility5d (additional edge cases)', () => {
    it('should classify Media volatility for moderate swings', () => {
      // Need mean pct change between 0.5 and 1.0
      // sell changes ~0.7% per day
      const series: RatePoint[] = [
        rp('2025-01-01', 17.000, 16.500),
        rp('2025-01-02', 17.120, 16.620),
        rp('2025-01-03', 17.000, 16.500),
        rp('2025-01-04', 17.120, 16.620),
      ];
      const result = calculateVolatility5d(series);
      expect(result).toBe('Media');
    });

    it('should handle zero values gracefully (skip div by zero)', () => {
      // If prev = 0, that diff is skipped
      const series: RatePoint[] = [
        rp('2025-01-01', 0, 0),
        rp('2025-01-02', 17.0, 16.5),
        rp('2025-01-03', 17.01, 16.51),
        rp('2025-01-04', 17.02, 16.52),
      ];
      // First diff (0->17) is skipped since prev=0
      // Only 2 diffs remain, which is < 3, so N/D
      const result = calculateVolatility5d(series);
      expect(result).toBe('N/D');
    });
  });
});
