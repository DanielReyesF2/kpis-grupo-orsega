import { describe, it, expect, vi } from 'vitest';

// Mock Neon and WebSocket before importing the module under test.
// sales-metrics.ts calls neon(process.env.DATABASE_URL!) at the top level,
// so we must intercept before module evaluation.
vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
}));
vi.mock('ws', () => ({ default: class {} }));

import { calculatePeriodDates } from '../sales-metrics';

describe('calculatePeriodDates', () => {
  // =======================================================================
  // month period
  // =======================================================================

  it('should calculate month period dates for June 2025', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2025, month: 6 });
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.start.getFullYear()).toBe(2025);
    expect(result.start.getMonth()).toBe(5); // June is 0-indexed as 5
    expect(result.start.getDate()).toBe(1);
    // End should be the last day of June
    expect(result.end.getMonth()).toBe(5);
    expect(result.end.getDate()).toBe(30);
  });

  it('should handle January correctly (month boundary)', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2025, month: 1 });
    expect(result.start.getMonth()).toBe(0); // January
    expect(result.start.getDate()).toBe(1);
    expect(result.end.getMonth()).toBe(0);
    expect(result.end.getDate()).toBe(31);
  });

  it('should handle December correctly', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2025, month: 12 });
    expect(result.start.getMonth()).toBe(11); // December
    expect(result.start.getDate()).toBe(1);
    expect(result.end.getMonth()).toBe(11);
    expect(result.end.getDate()).toBe(31);
  });

  it('should handle February in a non-leap year', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2025, month: 2 });
    expect(result.start.getMonth()).toBe(1);
    expect(result.end.getDate()).toBe(28);
  });

  it('should handle February in a leap year', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2024, month: 2 });
    expect(result.end.getDate()).toBe(29);
  });

  it('should default to current month when year/month not provided', () => {
    const result = calculatePeriodDates({ type: 'month' });
    const now = new Date();
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.start.getDate()).toBe(1);
    expect(result.start.getMonth()).toBe(now.getMonth());
  });

  it('should ensure start is before end for month period', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2025, month: 1 });
    expect(result.start.getTime()).toBeLessThan(result.end.getTime());
  });

  // =======================================================================
  // 3months period
  // =======================================================================

  it('should calculate 3months period as last 90 days', () => {
    const result = calculatePeriodDates({ type: '3months', year: 2025, month: 6 });
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    // Start should be about 90 days before end
    const diffMs = result.end.getTime() - result.start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Allow some tolerance since hours are set differently
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(91);
  });

  it('should ensure start < end for 3months period', () => {
    const result = calculatePeriodDates({ type: '3months' });
    expect(result.start.getTime()).toBeLessThan(result.end.getTime());
  });

  // =======================================================================
  // year period
  // =======================================================================

  it('should calculate year period dates', () => {
    const result = calculatePeriodDates({ type: 'year', year: 2025 });
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.start.getFullYear()).toBe(2025);
    expect(result.start.getMonth()).toBe(0); // January
    expect(result.start.getDate()).toBe(1);
    expect(result.end.getFullYear()).toBe(2025);
    expect(result.end.getMonth()).toBe(11); // December
    expect(result.end.getDate()).toBe(31);
  });

  it('should default to current year when year not provided', () => {
    const result = calculatePeriodDates({ type: 'year' });
    const now = new Date();
    expect(result.start.getFullYear()).toBe(now.getFullYear());
    expect(result.start.getMonth()).toBe(0);
  });

  it('should ensure start < end for year period', () => {
    const result = calculatePeriodDates({ type: 'year', year: 2025 });
    expect(result.start.getTime()).toBeLessThan(result.end.getTime());
  });

  // =======================================================================
  // custom period
  // =======================================================================

  it('should calculate custom period with Date objects', () => {
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-06-30');
    const result = calculatePeriodDates({ type: 'custom', startDate, endDate });
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
  });

  it('should throw for custom period without dates', () => {
    expect(() => calculatePeriodDates({ type: 'custom' })).toThrow('Custom period requires startDate and endDate');
  });

  it('should throw for unknown period type', () => {
    expect(() => calculatePeriodDates({ type: 'weekly' as any })).toThrow('Unknown period type');
  });

  // =======================================================================
  // Time components
  // =======================================================================

  it('should set start time to midnight (00:00:00.000)', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2025, month: 6 });
    expect(result.start.getHours()).toBe(0);
    expect(result.start.getMinutes()).toBe(0);
    expect(result.start.getSeconds()).toBe(0);
    expect(result.start.getMilliseconds()).toBe(0);
  });

  it('should set end time to end of day (23:59:59.999)', () => {
    const result = calculatePeriodDates({ type: 'month', year: 2025, month: 6 });
    expect(result.end.getHours()).toBe(23);
    expect(result.end.getMinutes()).toBe(59);
    expect(result.end.getSeconds()).toBe(59);
    expect(result.end.getMilliseconds()).toBe(999);
  });
});
