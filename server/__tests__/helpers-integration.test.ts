import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSql, mockStorage } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockStorage: {
    getKpis: vi.fn(),
    createKpiValue: vi.fn(),
    createNotification: vi.fn(),
  },
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
  neonConfig: { webSocketConstructor: null },
}));
vi.mock('ws', () => ({ default: class {} }));

vi.mock('../storage', () => ({
  storage: mockStorage,
}));

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock kpi-utils
vi.mock('@shared/kpi-utils', () => ({
  calculateKpiStatus: vi.fn().mockReturnValue('complies'),
}));

import { createKPIStatusChangeNotification, updateLogisticsKPIs } from '../routes/_helpers';

describe('Integration Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('createKPIStatusChangeNotification', () => {
    const mockKpi = { id: 1, name: 'Ventas Mensuales', companyId: 1 as 1 | 2, areaId: 1 };
    const mockUser = { id: 1, name: 'Test User', email: 'test@test.com' };

    it('should create notification for critical change: complies → not_compliant', async () => {
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'complies', 'not_compliant', mockStorage as any
      );
      expect(mockStorage.createNotification).toHaveBeenCalledTimes(1);
      expect(mockStorage.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUserId: 1,
          toUserId: 1,
          type: 'warning',
        })
      );
    });

    it('should create notification for critical change: alert → not_compliant', async () => {
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'alert', 'not_compliant', mockStorage as any
      );
      expect(mockStorage.createNotification).toHaveBeenCalledTimes(1);
    });

    it('should create notification for critical change: not_compliant → complies', async () => {
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'not_compliant', 'complies', mockStorage as any
      );
      expect(mockStorage.createNotification).toHaveBeenCalledTimes(1);
      expect(mockStorage.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
        })
      );
    });

    it('should NOT create notification for non-critical change: complies → alert', async () => {
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'complies', 'alert', mockStorage as any
      );
      expect(mockStorage.createNotification).not.toHaveBeenCalled();
    });

    it('should NOT create notification for same status', async () => {
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'complies', 'complies', mockStorage as any
      );
      expect(mockStorage.createNotification).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.createNotification.mockRejectedValue(new Error('DB error'));
      // Should not throw
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'complies', 'not_compliant', mockStorage as any
      );
    });

    it('should include KPI name in notification title', async () => {
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'not_compliant', 'complies', mockStorage as any
      );
      const callArgs = mockStorage.createNotification.mock.calls[0][0];
      expect(callArgs.title).toContain('Ventas Mensuales');
    });

    it('should include company and area in notification', async () => {
      await createKPIStatusChangeNotification(
        mockKpi, mockUser, 'complies', 'not_compliant', mockStorage as any
      );
      const callArgs = mockStorage.createNotification.mock.calls[0][0];
      expect(callArgs.companyId).toBe(1);
      expect(callArgs.areaId).toBe(1);
    });
  });

  describe('updateLogisticsKPIs', () => {
    it('should handle no deliveries gracefully', async () => {
      mockSql.mockResolvedValue([]);
      mockStorage.getKpis.mockResolvedValue([]);

      await updateLogisticsKPIs(1);
      // Should not throw and should handle empty data
    });

    it('should calculate averages from delivered shipments', async () => {
      const now = new Date();
      mockSql.mockResolvedValue([
        {
          id: 1,
          transportCost: '5000',
          createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
          inRouteAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          deliveredAt: now.toISOString(),
        },
      ]);
      mockStorage.getKpis.mockResolvedValue([
        { id: 1, name: 'Costo de Transporte', goal: '5000' },
        { id: 2, name: 'Tiempo de Preparación', goal: '24' },
        { id: 3, name: 'Tiempo de Entrega', goal: '48' },
      ]);
      mockStorage.createKpiValue.mockResolvedValue({});

      await updateLogisticsKPIs(1);
      expect(mockStorage.createKpiValue).toHaveBeenCalled();
    });

    it('should skip KPIs that are not found', async () => {
      mockSql.mockResolvedValue([]);
      mockStorage.getKpis.mockResolvedValue([]); // No matching KPIs

      await updateLogisticsKPIs(1);
      expect(mockStorage.createKpiValue).not.toHaveBeenCalled();
    });

    it('should handle errors and rethrow', async () => {
      mockSql.mockRejectedValue(new Error('SQL error'));
      await expect(updateLogisticsKPIs(1)).rejects.toThrow('SQL error');
    });
  });
});
