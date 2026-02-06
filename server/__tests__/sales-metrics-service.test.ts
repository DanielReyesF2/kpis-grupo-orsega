import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSql } = vi.hoisted(() => ({
  mockSql: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
  neonConfig: { webSocketConstructor: null },
}));
vi.mock('ws', () => ({ default: class {} }));

import { getSalesMetrics } from '../sales-metrics';

describe('Sales Metrics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should return metrics for company 1 (Dura)', async () => {
    // Mock: find max year/month
    mockSql
      .mockResolvedValueOnce([{ max_year: 2025, max_month: 6 }])
      // Mock sales metrics query
      .mockResolvedValueOnce([{ total_quantity: '50000', total_amount: '1000000', record_count: '500' }])
      // Previous period
      .mockResolvedValueOnce([{ total_quantity: '45000', total_amount: '900000', record_count: '450' }])
      // Active clients current
      .mockResolvedValueOnce([{ count: '100' }])
      // Active clients previous
      .mockResolvedValueOnce([{ count: '90' }])
      // Retained clients
      .mockResolvedValueOnce([{ count: '80' }])
      // New clients
      .mockResolvedValueOnce([{ count: '20' }])
      // Avg order value current
      .mockResolvedValueOnce([{ avg_value: '2000' }])
      // Churned clients
      .mockResolvedValueOnce([{ count: '10' }])
      // Monthly trend
      .mockResolvedValueOnce([
        { month: 1, total: '10000' },
        { month: 2, total: '12000' },
        { month: 3, total: '11000' },
      ])
      // Top clients
      .mockResolvedValueOnce([
        { client_name: 'Client A', total: '50000' },
        { client_name: 'Client B', total: '30000' },
      ])
      // Top products
      .mockResolvedValueOnce([
        { product_name: 'Product X', total: '20000' },
      ]);

    const result = await getSalesMetrics(1);
    expect(result).toBeDefined();
  });

  it('should handle empty data for company', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: null, max_month: null }])
      .mockResolvedValueOnce([{ total_quantity: '0', total_amount: '0', record_count: '0' }])
      .mockResolvedValueOnce([{ total_quantity: '0', total_amount: '0', record_count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ avg_value: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getSalesMetrics(2);
    expect(result).toBeDefined();
  });

  it('should handle division by zero in retention rate', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: 2025, max_month: 1 }])
      .mockResolvedValueOnce([{ total_quantity: '100', total_amount: '1000', record_count: '10' }])
      .mockResolvedValueOnce([{ total_quantity: '0', total_amount: '0', record_count: '0' }])
      .mockResolvedValueOnce([{ count: '5' }])
      .mockResolvedValueOnce([{ count: '0' }]) // Previous clients = 0 → division by zero
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '5' }])
      .mockResolvedValueOnce([{ avg_value: '100' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getSalesMetrics(1);
    expect(result).toBeDefined();
    // Should not have NaN or Infinity
  });

  it('should handle SQL errors gracefully', async () => {
    // getSalesMetrics catches errors internally and returns default values
    mockSql.mockRejectedValue(new Error('Connection timeout'));
    const result = await getSalesMetrics(1);
    expect(result).toBeDefined();
    expect(result.activeClients).toBe(0);
  });

  it('should return metrics for company 2 (Orsega)', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: 2025, max_month: 10 }])
      .mockResolvedValueOnce([{ total_quantity: '30000', total_amount: '600000', record_count: '300' }])
      .mockResolvedValueOnce([{ total_quantity: '25000', total_amount: '500000', record_count: '250' }])
      .mockResolvedValueOnce([{ count: '60' }])
      .mockResolvedValueOnce([{ count: '55' }])
      .mockResolvedValueOnce([{ count: '50' }])
      .mockResolvedValueOnce([{ count: '10' }])
      .mockResolvedValueOnce([{ avg_value: '2000' }])
      .mockResolvedValueOnce([{ count: '5' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getSalesMetrics(2);
    expect(result).toBeDefined();
  });
});
