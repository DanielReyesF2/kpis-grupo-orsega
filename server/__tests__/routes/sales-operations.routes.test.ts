import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

function createTestApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ---- Mocks (hoisted so they are available inside vi.mock factories) ----

const { mockSql, mockStorage, mockUpdateWeeklySales, mockAutoCloseMonth } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockStorage: {
    getKpis: vi.fn(),
    getKpiValuesByKpi: vi.fn(),
    createKpiValue: vi.fn(),
  },
  mockUpdateWeeklySales: vi.fn(),
  mockAutoCloseMonth: vi.fn(),
}));

vi.mock('../../routes/_helpers', () => ({
  sql: (...args: any[]) => mockSql(...args),
  getAuthUser: (req: any) => req.user,
  AuthRequest: {},
}));

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    if (!req.user) {
      req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    }
    next();
  },
  jwtAdminMiddleware: (req: any, res: any, next: any) => next(),
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
}));

vi.mock('../../../scripts/weekly_sales_update', () => ({
  updateWeeklySales: (...args: any[]) => mockUpdateWeeklySales(...args),
  autoCloseMonth: (...args: any[]) => mockAutoCloseMonth(...args),
}));

vi.mock('@shared/kpi-utils', () => ({
  parseNumericValue: vi.fn((v: any) => parseFloat(v) || 0),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
  Pool: vi.fn(),
}));

vi.mock('ws', () => ({ default: class {} }));

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: { query: vi.fn() },
}));

// ---- Import Router ----

import salesOperationsRouter from '../../routes/sales-operations';

describe('Sales Operations Routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(salesOperationsRouter);
  });

  // =====================
  // POST /api/sales/weekly-update
  // =====================
  describe('POST /api/sales/weekly-update', () => {
    it('should return 400 when value is missing', async () => {
      const res = await request(app)
        .post('/api/sales/weekly-update')
        .send({ companyId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('value');
    });

    it('should return 400 when companyId is missing', async () => {
      const res = await request(app)
        .post('/api/sales/weekly-update')
        .send({ value: '100' });

      expect(res.status).toBe(400);
    });

    it('should successfully update weekly sales', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);
      mockUpdateWeeklySales.mockResolvedValueOnce({
        success: true,
        message: 'Ventas actualizadas',
        weeklyRecord: { id: 1 },
        currentPeriod: { period: 'Semana 1 - Febrero 2026' },
        monthlyPreview: { formattedValue: '100' },
      });

      const res = await request(app)
        .post('/api/sales/weekly-update')
        .send({ value: '100', companyId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.weeklyRecord).toBeDefined();
      expect(res.body.currentPeriod).toBeDefined();
    });

    it('should return 400 when updateWeeklySales fails', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);
      mockUpdateWeeklySales.mockResolvedValueOnce({
        success: false,
        message: 'No weekly data to update',
      });

      const res = await request(app)
        .post('/api/sales/weekly-update')
        .send({ value: '100', companyId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should handle server errors', async () => {
      mockStorage.getKpis.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/api/sales/weekly-update')
        .send({ value: '100', companyId: 1 });

      expect(res.status).toBe(500);
    });

    it('should return 409 when month is already closed for non-admin-override', async () => {
      // Set up a non-admin user so the closure check runs
      const viewerApp = express();
      viewerApp.use(express.json());
      viewerApp.use((req: any, _res: any, next: any) => {
        req.user = { id: 2, role: 'viewer', email: 'viewer@test.com', name: 'Viewer', companyId: 1, areaId: 1 };
        next();
      });
      viewerApp.use(salesOperationsRouter);

      const today = new Date();
      const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];
      const currentMonth = monthNames[today.getMonth()];
      const currentYear = today.getFullYear();

      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([
        { id: 1, period: `${currentMonth} ${currentYear}`, value: '50000', date: '2026-01-31' },
      ]);

      const res = await request(viewerApp)
        .post('/api/sales/weekly-update')
        .send({ value: '100', companyId: 1 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.monthStatus).toBeDefined();
      expect(res.body.monthStatus.closed).toBe(true);
    });
  });

  // =====================
  // POST /api/sales/update-month
  // =====================
  describe('POST /api/sales/update-month', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/sales/update-month')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid companyId', async () => {
      const res = await request(app)
        .post('/api/sales/update-month')
        .send({ value: '100', companyId: 5, month: 'Enero', year: 2025 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('companyId');
    });

    it('should return 404 when sales KPI not found', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/sales/update-month')
        .send({ value: '100', companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('KPI de ventas no encontrado');
    });

    it('should successfully update monthly sales', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1, goal: '55620', annualGoal: null },
      ]);
      mockStorage.createKpiValue.mockResolvedValueOnce({ id: 1, value: '50000' });

      const res = await request(app)
        .post('/api/sales/update-month')
        .send({ value: '50000', companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('period', 'Enero 2025');
      expect(res.body.data).toHaveProperty('monthlyTarget');
      expect(res.body.data).toHaveProperty('compliance');
      expect(res.body.data).toHaveProperty('kpiId', 10);
      expect(res.body.data).toHaveProperty('companyId', 1);
    });

    it('should use annualGoal for monthlyTarget when available', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1, goal: '55620', annualGoal: '667440' },
      ]);
      mockStorage.createKpiValue.mockResolvedValueOnce({ id: 1, value: '55620' });

      const res = await request(app)
        .post('/api/sales/update-month')
        .send({ value: '55620', companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // monthlyTarget should be annualGoal / 12 = 667440 / 12 = 55620
      expect(res.body.data.monthlyTarget).toBe(55620);
      expect(res.body.data.compliance).toBe(100);
    });

    it('should handle server errors during update-month', async () => {
      mockStorage.getKpis.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await request(app)
        .post('/api/sales/update-month')
        .send({ value: '100', companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =====================
  // POST /api/sales/auto-close-month
  // =====================
  describe('POST /api/sales/auto-close-month', () => {
    it('should auto-close for both companies when no companyId specified', async () => {
      mockAutoCloseMonth.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/sales/auto-close-month')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.timestamp).toBeDefined();
    });

    it('should auto-close for a specific company', async () => {
      mockAutoCloseMonth.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/sales/auto-close-month')
        .send({ companyId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].companyId).toBe(1);
      expect(res.body.results[0].success).toBe(true);
    });

    it('should return 403 for non-admin users', async () => {
      const viewerApp = express();
      viewerApp.use(express.json());
      viewerApp.use((req: any, _res: any, next: any) => {
        req.user = { id: 2, role: 'viewer', email: 'viewer@test.com', name: 'Viewer', companyId: 1, areaId: 1 };
        next();
      });
      viewerApp.use(salesOperationsRouter);

      const res = await request(viewerApp)
        .post('/api/sales/auto-close-month')
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should handle partial failures when closing multiple companies', async () => {
      mockAutoCloseMonth
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Company 2 error'));

      const res = await request(app)
        .post('/api/sales/auto-close-month')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].success).toBe(true);
      expect(res.body.results[1].success).toBe(false);
    });
  });

  // =====================
  // POST /api/sales/monthly-close
  // =====================
  describe('POST /api/sales/monthly-close', () => {
    it('should return 400 when required params are missing', async () => {
      const res = await request(app)
        .post('/api/sales/monthly-close')
        .send({ companyId: 1, month: 'Enero' }); // missing year

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 for non-admin users', async () => {
      const viewerApp = express();
      viewerApp.use(express.json());
      viewerApp.use((req: any, _res: any, next: any) => {
        req.user = { id: 2, role: 'viewer', email: 'viewer@test.com', name: 'Viewer', companyId: 1, areaId: 1 };
        next();
      });
      viewerApp.use(salesOperationsRouter);

      const res = await request(viewerApp)
        .post('/api/sales/monthly-close')
        .send({ companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when volume KPI not found', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/sales/monthly-close')
        .send({ companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 409 when month is already closed without override', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([
        { id: 1, period: 'Enero 2025', value: '50000', date: '2025-02-01' },
      ]);

      const res = await request(app)
        .post('/api/sales/monthly-close')
        .send({ companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.existingRecord).toBeDefined();
    });

    it('should successfully close month when no prior record exists', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([]);
      mockAutoCloseMonth.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/sales/monthly-close')
        .send({ companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.period).toBe('Enero 2025');
      expect(res.body.companyId).toBe(1);
      expect(res.body.wasOverride).toBe(false);
    });

    it('should allow override when month is already closed and override=true', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([
        { id: 1, period: 'Enero 2025', value: '50000', date: '2025-02-01' },
      ]);
      mockAutoCloseMonth.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/sales/monthly-close')
        .send({ companyId: 1, month: 'Enero', year: 2025, override: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.wasOverride).toBe(true);
    });

    it('should return 500 when autoCloseMonth returns false', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([]);
      mockAutoCloseMonth.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/sales/monthly-close')
        .send({ companyId: 1, month: 'Enero', year: 2025 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =====================
  // GET /api/sales/monthly-status
  // =====================
  describe('GET /api/sales/monthly-status', () => {
    it('should return 400 when required query params are missing', async () => {
      const res = await request(app).get('/api/sales/monthly-status');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when only partial params provided', async () => {
      const res = await request(app).get('/api/sales/monthly-status?companyId=1&month=Enero');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when volume KPI not found', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/sales/monthly-status?companyId=1&month=Enero&year=2025');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return monthly status with closed=false when no record exists', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/sales/monthly-status?companyId=1&month=Enero&year=2025');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.closed).toBe(false);
      expect(res.body.period).toBe('Enero 2025');
      expect(res.body.monthlyRecord).toBeNull();
      expect(res.body.weeklyRecordsCount).toBe(0);
    });

    it('should return monthly status with closed=true when monthly record exists', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([
        { id: 1, period: 'Enero 2025', value: '50000', date: '2025-02-01' },
      ]);

      const res = await request(app).get('/api/sales/monthly-status?companyId=1&month=Enero&year=2025');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.closed).toBe(true);
      expect(res.body.monthlyRecord).toBeDefined();
    });

    it('should include weekly records in the response', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 10, name: 'Volumen de ventas', companyId: 1 },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([
        { id: 2, period: 'Semana 1 - Enero 2025', value: '12000', date: '2025-01-07' },
        { id: 3, period: 'Semana 2 - Enero 2025', value: '13000', date: '2025-01-14' },
      ]);

      const res = await request(app).get('/api/sales/monthly-status?companyId=1&month=Enero&year=2025');

      expect(res.status).toBe(200);
      expect(res.body.closed).toBe(false);
      expect(res.body.weeklyRecordsCount).toBe(2);
      expect(res.body.weeklyRecords).toHaveLength(2);
    });

    it('should handle server errors gracefully', async () => {
      mockStorage.getKpis.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/sales/monthly-status?companyId=1&month=Enero&year=2025');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
