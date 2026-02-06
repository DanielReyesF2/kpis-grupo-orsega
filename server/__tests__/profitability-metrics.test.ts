import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSql } = vi.hoisted(() => ({
  mockSql: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
  neonConfig: { webSocketConstructor: null },
}));
vi.mock('ws', () => ({ default: class {} }));

import { calculateRealProfitability } from '../profitability-metrics';

describe('Profitability Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should calculate profitability for a company and year', async () => {
    // Mock max year query
    mockSql
      .mockResolvedValueOnce([{ max_year: '2025' }])
      // Mock profitability query
      .mockResolvedValueOnce([{
        total_revenue: '1000000',
        total_transactions: '500',
        total_items: '2000',
        avg_transaction_value: '2000',
        avg_unit_price: '75',
      }])
      // Mock top products
      .mockResolvedValueOnce([
        { product_name: 'Product A', product_id: '1', total_revenue: '500000', total_quantity: '1000', avg_unit_price: '60', transaction_count: '200' },
      ])
      // Mock top clients
      .mockResolvedValueOnce([
        { client_name: 'Client A', client_id: '1', total_revenue: '300000', transaction_count: '100', avg_order_value: '3000', last_purchase_date: '2025-06-15' },
      ])
      // Mock top shipments
      .mockResolvedValueOnce([
        { invoice_number: 'INV-001', folio: 'F1', sale_date: '2025-06-15', client_name: 'Client A', total_amount: '50000', item_count: '10', products: 'Prod A, Prod B' },
      ]);

    const result = await calculateRealProfitability(1, 2025);

    expect(result.totalRevenue).toBe(1000000);
    expect(result.totalTransactions).toBe(500);
    expect(result.topProducts).toHaveLength(1);
    expect(result.topProducts[0].productName).toBe('Product A');
    expect(result.topClients).toHaveLength(1);
    expect(result.topClients[0].clientName).toBe('Client A');
    expect(result.topShipments).toHaveLength(1);
  });

  it('should use max year when year not specified', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: '2024' }])
      .mockResolvedValueOnce([{ total_revenue: '0', total_transactions: '0', total_items: '0', avg_transaction_value: '0', avg_unit_price: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await calculateRealProfitability(1);
    expect(result.totalRevenue).toBe(0);
    expect(result.topProducts).toHaveLength(0);
  });

  it('should set premium profitability for high avg unit price', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: '2025' }])
      .mockResolvedValueOnce([{ total_revenue: '500000', total_transactions: '100', total_items: '500', avg_transaction_value: '5000', avg_unit_price: '150' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await calculateRealProfitability(1, 2025);
    expect(result.overallProfitability).toBe(22.0); // Premium
  });

  it('should set medium profitability for mid-range avg unit price', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: '2025' }])
      .mockResolvedValueOnce([{ total_revenue: '500000', total_transactions: '100', total_items: '500', avg_transaction_value: '5000', avg_unit_price: '75' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await calculateRealProfitability(1, 2025);
    expect(result.overallProfitability).toBe(20.0); // Medium
  });

  it('should set standard profitability for low avg unit price', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: '2025' }])
      .mockResolvedValueOnce([{ total_revenue: '500000', total_transactions: '100', total_items: '500', avg_transaction_value: '5000', avg_unit_price: '30' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await calculateRealProfitability(1, 2025);
    expect(result.overallProfitability).toBe(18.0); // Standard
  });

  it('should handle empty data gracefully', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: null }])
      .mockResolvedValueOnce([{ total_revenue: null, total_transactions: null, total_items: null, avg_transaction_value: null, avg_unit_price: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await calculateRealProfitability(2);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalTransactions).toBe(0);
    expect(result.topProducts).toHaveLength(0);
  });

  it('should handle products with no product_id', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: '2025' }])
      .mockResolvedValueOnce([{ total_revenue: '1000', total_transactions: '1', total_items: '1', avg_transaction_value: '1000', avg_unit_price: '50' }])
      .mockResolvedValueOnce([{ product_name: 'Unknown', product_id: null, total_revenue: '1000', total_quantity: '10', avg_unit_price: '50', transaction_count: '1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await calculateRealProfitability(1, 2025);
    expect(result.topProducts[0].productId).toBeNull();
  });

  it('should limit products to top 3 for shipments', async () => {
    mockSql
      .mockResolvedValueOnce([{ max_year: '2025' }])
      .mockResolvedValueOnce([{ total_revenue: '1000', total_transactions: '1', total_items: '1', avg_transaction_value: '1000', avg_unit_price: '50' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { invoice_number: 'INV-1', folio: null, sale_date: '2025-01-01', client_name: 'C1', total_amount: '5000', item_count: '5', products: 'A, B, C, D, E' },
      ]);

    const result = await calculateRealProfitability(1, 2025);
    expect(result.topShipments[0].products).toHaveLength(3);
  });
});
