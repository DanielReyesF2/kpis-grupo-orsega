import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (required for vi.mock factory functions)
// ---------------------------------------------------------------------------
const { mockSql, mockGetActiveClients, mockGetRetentionRate, mockGetNewClients, mockGetClientChurn, mockGetSalesMetrics } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockGetActiveClients: vi.fn(),
  mockGetRetentionRate: vi.fn(),
  mockGetNewClients: vi.fn(),
  mockGetClientChurn: vi.fn(),
  mockGetSalesMetrics: vi.fn(),
}));

// Mock neon/ws before any imports
vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
  neonConfig: { webSocketConstructor: null },
}));
vi.mock('ws', () => ({ default: class {} }));

// Mock the sales-metrics module
vi.mock('../sales-metrics', () => ({
  getActiveClients: mockGetActiveClients,
  getRetentionRate: mockGetRetentionRate,
  getNewClients: mockGetNewClients,
  getClientChurn: mockGetClientChurn,
  getSalesMetrics: mockGetSalesMetrics,
}));

import {
  identifySalesKpiType,
  calculateSalesKpiValue,
  calculateSalesKpiHistory,
} from '../sales-kpi-calculator';

// ===========================================================================
// identifySalesKpiType
// ===========================================================================
describe('Sales KPI Calculator', () => {
  describe('identifySalesKpiType', () => {
    it('should identify "Volumen de Ventas" as volume', () => {
      expect(identifySalesKpiType('Volumen de Ventas')).toBe('volume');
    });

    it('should identify "volumen ventas" as volume (case insensitive)', () => {
      expect(identifySalesKpiType('volumen ventas')).toBe('volume');
    });

    it('should identify "Sales Volume" as volume', () => {
      expect(identifySalesKpiType('Sales Volume')).toBe('volume');
    });

    it('should identify "volumen de venta" (singular) as volume', () => {
      expect(identifySalesKpiType('volumen de venta')).toBe('volume');
    });

    it('should identify "Clientes Activos" as active_clients', () => {
      expect(identifySalesKpiType('Clientes Activos')).toBe('active_clients');
    });

    it('should identify "active clients" as active_clients', () => {
      expect(identifySalesKpiType('active clients')).toBe('active_clients');
    });

    it('should identify "Crecimiento" as growth', () => {
      expect(identifySalesKpiType('Crecimiento')).toBe('growth');
    });

    it('should identify "Growth" as growth', () => {
      expect(identifySalesKpiType('Growth')).toBe('growth');
    });

    it('should identify "Incremento" as growth', () => {
      expect(identifySalesKpiType('Incremento')).toBe('growth');
    });

    it('should identify "Churn" as churn', () => {
      expect(identifySalesKpiType('Churn')).toBe('churn');
    });

    it('should identify "Abandono" as churn', () => {
      expect(identifySalesKpiType('Abandono de clientes')).toBe('churn');
    });

    it('should identify "Retención" as retention', () => {
      expect(identifySalesKpiType('Retención de clientes')).toBe('retention');
    });

    it('should identify "Retention" as retention', () => {
      expect(identifySalesKpiType('Client Retention')).toBe('retention');
    });

    it('should identify "Retencion" (no accent) as retention', () => {
      expect(identifySalesKpiType('Tasa de Retencion')).toBe('retention');
    });

    it('should identify "Nuevos Clientes" as new_clients', () => {
      expect(identifySalesKpiType('Nuevos Clientes')).toBe('new_clients');
    });

    it('should identify "New Clients" as new_clients', () => {
      expect(identifySalesKpiType('New Clients')).toBe('new_clients');
    });

    it('should identify "Valor Promedio" as avg_order_value', () => {
      expect(identifySalesKpiType('Valor Promedio por Orden')).toBe('avg_order_value');
    });

    it('should identify "Average Order" as avg_order_value', () => {
      expect(identifySalesKpiType('Average Order Value')).toBe('avg_order_value');
    });

    it('should identify "Ticket Promedio" as avg_order_value', () => {
      expect(identifySalesKpiType('Ticket Promedio')).toBe('avg_order_value');
    });

    it('should identify "Avg Order" as avg_order_value', () => {
      expect(identifySalesKpiType('Avg Order')).toBe('avg_order_value');
    });

    it('should return unknown for unrecognized KPI names', () => {
      expect(identifySalesKpiType('Margen Bruto')).toBe('unknown');
      expect(identifySalesKpiType('ROI')).toBe('unknown');
      expect(identifySalesKpiType('')).toBe('unknown');
    });

    it('should handle leading/trailing whitespace', () => {
      expect(identifySalesKpiType('  Volumen de Ventas  ')).toBe('volume');
    });

    it('should handle mixed case', () => {
      expect(identifySalesKpiType('CLIENTES ACTIVOS')).toBe('active_clients');
      expect(identifySalesKpiType('crecimiento YoY')).toBe('growth');
    });
  });

  // ===========================================================================
  // calculateSalesKpiValue
  // ===========================================================================
  describe('calculateSalesKpiValue', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return null for unknown KPI type', async () => {
      const result = await calculateSalesKpiValue('Unknown KPI', 1);
      expect(result).toBeNull();
    });

    // --- volume ---
    describe('volume KPI', () => {
      it('should calculate volume for a specific year and month', async () => {
        mockSql.mockResolvedValueOnce([{ total_volume: '5000' }]);

        const result = await calculateSalesKpiValue('Volumen de Ventas', 1, { year: 2025, month: 1 });

        expect(result).not.toBeNull();
        expect(result!.value).toBe(5000);
        expect(result!.unit).toBe('KG'); // company_id 1 = Dura
      });

      it('should use KG unit for company 1 and unidades for company 2', async () => {
        mockSql.mockResolvedValueOnce([{ total_volume: '100' }]);

        const result = await calculateSalesKpiValue('Volumen de Ventas', 2, { year: 2025, month: 1 });

        expect(result!.unit).toBe('unidades');
      });

      it('should calculate volume for year-only period', async () => {
        mockSql.mockResolvedValueOnce([{ total_volume: '50000' }]);

        const result = await calculateSalesKpiValue('Volumen de Ventas', 1, { year: 2025 });

        expect(result!.value).toBe(50000);
      });

      it('should calculate volume for latest month when no period specified', async () => {
        // First call: get latest period
        mockSql.mockResolvedValueOnce([{ anio: '2025', mes: '3' }]);
        // Second call: get volume for that period
        mockSql.mockResolvedValueOnce([{ total_volume: '7500' }]);

        const result = await calculateSalesKpiValue('Volumen de Ventas', 1);

        expect(result!.value).toBe(7500);
      });

      it('should return 0 when no data exists for latest period query', async () => {
        mockSql.mockResolvedValueOnce([]); // No latest data

        const result = await calculateSalesKpiValue('Volumen de Ventas', 1);

        expect(result!.value).toBe(0);
      });

      it('should return 0 when volume query returns null', async () => {
        mockSql.mockResolvedValueOnce([{ total_volume: null }]);

        const result = await calculateSalesKpiValue('Volumen de Ventas', 1, { year: 2025, month: 1 });

        expect(result!.value).toBe(0);
      });
    });

    // --- active_clients ---
    describe('active_clients KPI', () => {
      it('should return active clients count', async () => {
        mockGetActiveClients.mockResolvedValueOnce({ count: 42, thisMonth: 42, last3Months: 55 });

        const result = await calculateSalesKpiValue('Clientes Activos', 1);

        expect(result).not.toBeNull();
        expect(result!.value).toBe(42);
        expect(result!.unit).toBe('clientes');
        expect(mockGetActiveClients).toHaveBeenCalledWith(1, 'month');
      });
    });

    // --- growth ---
    describe('growth KPI', () => {
      it('should return growth percentage', async () => {
        mockGetSalesMetrics.mockResolvedValueOnce({ growth: 15.5 });

        const result = await calculateSalesKpiValue('Crecimiento', 1);

        expect(result).not.toBeNull();
        expect(result!.value).toBe(15.5);
        expect(result!.unit).toBe('%');
      });

      it('should return 0 when growth is undefined', async () => {
        mockGetSalesMetrics.mockResolvedValueOnce({});

        const result = await calculateSalesKpiValue('Crecimiento', 1);

        expect(result!.value).toBe(0);
      });
    });

    // --- churn ---
    describe('churn KPI', () => {
      it('should calculate churn rate', async () => {
        mockGetClientChurn.mockResolvedValueOnce({ rate: 5.2, count: 3, clients: [] });

        const result = await calculateSalesKpiValue('Churn', 1, { year: 2025, month: 6 });

        expect(result).not.toBeNull();
        expect(result!.value).toBe(5.2);
        expect(result!.unit).toBe('%');
        // Should be called with current and previous period
        expect(mockGetClientChurn).toHaveBeenCalledWith(
          1,
          { type: 'month', year: 2025, month: 6 },
          { type: 'month', year: 2025, month: 5 }
        );
      });

      it('should handle January -> December year wrap', async () => {
        mockGetClientChurn.mockResolvedValueOnce({ rate: 2.0, count: 1, clients: [] });

        const result = await calculateSalesKpiValue('Churn', 1, { year: 2025, month: 1 });

        expect(result!.value).toBe(2.0);
        // Previous month of Jan 2025 is Dec 2024
        expect(mockGetClientChurn).toHaveBeenCalledWith(
          1,
          { type: 'month', year: 2025, month: 1 },
          { type: 'month', year: 2024, month: 12 }
        );
      });
    });

    // --- retention ---
    describe('retention KPI', () => {
      it('should calculate retention rate', async () => {
        mockGetRetentionRate.mockResolvedValueOnce({
          rate: 95.0, currentPeriodClients: 20, previousPeriodClients: 21, retainedClients: 20,
        });

        const result = await calculateSalesKpiValue('Retención', 1, { year: 2025, month: 3 });

        expect(result).not.toBeNull();
        expect(result!.value).toBe(95.0);
        expect(result!.unit).toBe('%');
        expect(mockGetRetentionRate).toHaveBeenCalledWith(
          1,
          { type: 'month', year: 2025, month: 3 },
          { type: 'month', year: 2025, month: 2 }
        );
      });

      it('should handle January -> December year wrap for retention', async () => {
        mockGetRetentionRate.mockResolvedValueOnce({
          rate: 90.0, currentPeriodClients: 18, previousPeriodClients: 20, retainedClients: 18,
        });

        await calculateSalesKpiValue('Retention', 1, { year: 2025, month: 1 });

        expect(mockGetRetentionRate).toHaveBeenCalledWith(
          1,
          { type: 'month', year: 2025, month: 1 },
          { type: 'month', year: 2024, month: 12 }
        );
      });
    });

    // --- new_clients ---
    describe('new_clients KPI', () => {
      it('should calculate new clients count', async () => {
        mockGetNewClients.mockResolvedValueOnce({ count: 5, clients: [] });

        const result = await calculateSalesKpiValue('Nuevos Clientes', 1, { year: 2025, month: 4 });

        expect(result).not.toBeNull();
        expect(result!.value).toBe(5);
        expect(result!.unit).toBe('clientes');
        expect(mockGetNewClients).toHaveBeenCalledWith(
          1,
          { type: 'month', year: 2025, month: 4 }
        );
      });
    });

    // --- avg_order_value ---
    describe('avg_order_value KPI', () => {
      it('should calculate average order value', async () => {
        mockSql.mockResolvedValueOnce([{ avg_value: '1250.50' }]);

        const result = await calculateSalesKpiValue('Valor Promedio', 1, { year: 2025, month: 2 });

        expect(result).not.toBeNull();
        expect(result!.value).toBe(1250.50);
        expect(result!.unit).toBe('MXN');
      });

      it('should return 0 when no orders exist', async () => {
        mockSql.mockResolvedValueOnce([{ avg_value: null }]);

        const result = await calculateSalesKpiValue('Ticket Promedio', 1, { year: 2025, month: 2 });

        expect(result!.value).toBe(0);
      });
    });

    // --- error handling ---
    describe('error handling', () => {
      it('should return null when a DB error occurs', async () => {
        mockSql.mockRejectedValueOnce(new Error('DB connection failed'));

        const result = await calculateSalesKpiValue('Volumen de Ventas', 1, { year: 2025, month: 1 });

        expect(result).toBeNull();
      });

      it('should return null when a metrics function throws', async () => {
        mockGetActiveClients.mockRejectedValueOnce(new Error('Metrics error'));

        const result = await calculateSalesKpiValue('Clientes Activos', 1);

        expect(result).toBeNull();
      });
    });

    // --- defaults for period ---
    describe('period defaults', () => {
      it('should use current date when no period provided for churn', async () => {
        mockGetClientChurn.mockResolvedValueOnce({ rate: 3.0, count: 2, clients: [] });

        const result = await calculateSalesKpiValue('Churn', 1);

        expect(result).not.toBeNull();
        expect(result!.value).toBe(3.0);
        // Should have been called with current month/year
        const callArgs = mockGetClientChurn.mock.calls[0];
        expect(callArgs[1].type).toBe('month');
        expect(callArgs[1].year).toBeGreaterThanOrEqual(2025);
        expect(callArgs[1].month).toBeGreaterThanOrEqual(1);
        expect(callArgs[1].month).toBeLessThanOrEqual(12);
      });

      it('should use current date when no period provided for new_clients', async () => {
        mockGetNewClients.mockResolvedValueOnce({ count: 0, clients: [] });

        const result = await calculateSalesKpiValue('Nuevos Clientes', 2);

        expect(result!.value).toBe(0);
        const callArgs = mockGetNewClients.mock.calls[0];
        expect(callArgs[1].type).toBe('month');
      });
    });
  });

  // ===========================================================================
  // calculateSalesKpiHistory
  // ===========================================================================
  describe('calculateSalesKpiHistory', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return unsupported for non-volume KPI types', async () => {
      const result = await calculateSalesKpiHistory('Clientes Activos', 1);

      expect(result.supported).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.message).toContain('active_clients');
    });

    it('should return unsupported for unknown KPI types', async () => {
      const result = await calculateSalesKpiHistory('Unknown KPI', 1);

      expect(result.supported).toBe(false);
      expect(result.data).toEqual([]);
    });

    it('should return volume history sorted by date ascending', async () => {
      mockSql.mockResolvedValueOnce([
        { anio: '2025', mes: '3', total_volume: '3000' },
        { anio: '2025', mes: '2', total_volume: '2500' },
        { anio: '2025', mes: '1', total_volume: '2000' },
      ]);

      const result = await calculateSalesKpiHistory('Volumen de Ventas', 1, 3);

      expect(result.supported).toBe(true);
      expect(result.data).toHaveLength(3);
      // Should be sorted ascending by date
      expect(result.data[0].period).toBe('Ene 2025');
      expect(result.data[0].value).toBe(2000);
      expect(result.data[1].period).toBe('Feb 2025');
      expect(result.data[1].value).toBe(2500);
      expect(result.data[2].period).toBe('Mar 2025');
      expect(result.data[2].value).toBe(3000);
    });

    it('should default to 12 months', async () => {
      mockSql.mockResolvedValueOnce([]);

      await calculateSalesKpiHistory('Volumen de Ventas', 1);

      // Check that the SQL was called with limit 12
      expect(mockSql).toHaveBeenCalledTimes(1);
      const callArgs = mockSql.mock.calls[0];
      expect(callArgs[1]).toContain(12);
    });

    it('should handle empty results', async () => {
      mockSql.mockResolvedValueOnce([]);

      const result = await calculateSalesKpiHistory('Volumen de Ventas', 1, 6);

      expect(result.supported).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should use correct month names in Spanish', async () => {
      mockSql.mockResolvedValueOnce([
        { anio: '2025', mes: '12', total_volume: '1000' },
        { anio: '2025', mes: '6', total_volume: '500' },
      ]);

      const result = await calculateSalesKpiHistory('Volumen de Ventas', 1, 12);

      expect(result.data).toHaveLength(2);
      // Jun comes before Dec when sorted
      expect(result.data[0].period).toBe('Jun 2025');
      expect(result.data[1].period).toBe('Dic 2025');
    });

    it('should include date field as Date object in each entry', async () => {
      mockSql.mockResolvedValueOnce([
        { anio: '2025', mes: '1', total_volume: '100' },
      ]);

      const result = await calculateSalesKpiHistory('Volumen de Ventas', 1, 1);

      expect(result.data[0].date).toBeInstanceOf(Date);
      expect(result.data[0].date.getFullYear()).toBe(2025);
      expect(result.data[0].date.getMonth()).toBe(0); // January
    });

    it('should handle DB error gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('DB timeout'));

      const result = await calculateSalesKpiHistory('Volumen de Ventas', 1);

      expect(result.supported).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle null volume by treating as 0', async () => {
      mockSql.mockResolvedValueOnce([
        { anio: '2025', mes: '1', total_volume: null },
      ]);

      const result = await calculateSalesKpiHistory('Volumen de Ventas', 1, 1);

      expect(result.data[0].value).toBe(0);
    });

    it('should pass companyId correctly to SQL query', async () => {
      mockSql.mockResolvedValueOnce([]);

      await calculateSalesKpiHistory('Volumen de Ventas', 2, 6);

      expect(mockSql).toHaveBeenCalledTimes(1);
      const callArgs = mockSql.mock.calls[0];
      // First param should be company_id = 2
      expect(callArgs[1][0]).toBe(2);
    });
  });
});
