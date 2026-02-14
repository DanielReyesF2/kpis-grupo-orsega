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

const { mockSql, mockStorage } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockStorage: {
    getKpi: vi.fn(),
    getKpis: vi.fn(),
    getKpiValues: vi.fn(),
    getKpiValuesByKpi: vi.fn(),
    getLatestKpiValues: vi.fn(),
    createKpiValue: vi.fn(),
    isSalesKpi: vi.fn(),
    getUsers: vi.fn(),
  },
}));

vi.mock('../../routes/_helpers', () => ({
  sql: (...args: any[]) => mockSql(...args),
  getAuthUser: (req: any) => req.user,
  collaboratorPerformanceCache: { get: vi.fn().mockReturnValue(null), set: vi.fn(), flushAll: vi.fn() },
  createKPIStatusChangeNotification: vi.fn().mockResolvedValue(undefined),
  AuthRequest: {},
}));

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    next();
  },
  jwtAdminMiddleware: (req: any, res: any, next: any) => next(),
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
}));

vi.mock('../../sales-kpi-calculator', () => ({
  calculateSalesKpiValue: vi.fn().mockResolvedValue(null),
  calculateSalesKpiHistory: vi.fn().mockResolvedValue({ supported: false, data: [] }),
  identifySalesKpiType: vi.fn().mockReturnValue(null),
}));

vi.mock('@shared/kpi-utils', () => ({
  calculateKpiStatus: vi.fn().mockReturnValue('complies'),
  calculateCompliance: vi.fn().mockReturnValue('100%'),
  parseNumericValue: vi.fn((v: any) => parseFloat(v) || 0),
  isLowerBetterKPI: vi.fn().mockReturnValue(false),
}));

vi.mock('@shared/schema', () => ({
  insertKpiValueSchema: { parse: vi.fn((data: any) => data) },
  Kpi: {},
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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

import kpiValuesRouter from '../../routes/kpi-values';

describe('KPI Values Routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(kpiValuesRouter);
    mockStorage.isSalesKpi.mockReturnValue(false);
  });

  // =====================
  // GET /api/kpi-values
  // =====================
  describe('GET /api/kpi-values', () => {
    it('should return all kpi values', async () => {
      mockStorage.getKpiValues.mockResolvedValueOnce([
        { id: 1, kpiId: 1, value: '100', companyId: 1 },
      ]);
      mockStorage.getKpis.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/kpi-values');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by companyId', async () => {
      mockStorage.getKpiValues.mockResolvedValueOnce([]);
      mockStorage.getKpis.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/kpi-values?companyId=1');

      expect(res.status).toBe(200);
      expect(mockStorage.getKpiValues).toHaveBeenCalledWith(1);
    });

    it('should return 400 for invalid companyId', async () => {
      const res = await request(app).get('/api/kpi-values?companyId=999');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('companyId');
    });

    it('should return values for specific kpiId', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 5, companyId: 1, name: 'Test KPI', target: '100' },
      ]);
      mockStorage.getKpiValuesByKpi.mockResolvedValueOnce([
        { id: 1, kpiId: 5, value: '85', companyId: 1 },
      ]);

      const res = await request(app).get('/api/kpi-values?kpiId=5');

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent kpiId', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/kpi-values?kpiId=999');

      expect(res.status).toBe(404);
    });

    it('should handle server errors', async () => {
      mockStorage.getKpiValues.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/kpi-values');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/collaborators-performance
  // =====================
  describe('GET /api/collaborators-performance', () => {
    it('should return collaborator performance data', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([
        { id: 1, name: 'KPI 1', responsible: 'John Doe', companyId: 1, target: '100', frequency: 'monthly' },
      ]);
      mockStorage.getKpiValues.mockResolvedValueOnce([
        { kpiId: 1, value: '95', companyId: 1, compliancePercentage: '95%', status: 'alert', date: new Date() },
      ]);
      mockStorage.getUsers.mockResolvedValueOnce([]);
      mockSql.mockResolvedValueOnce([]); // historical data query

      const res = await request(app).get('/api/collaborators-performance');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('collaborators');
      expect(res.body).toHaveProperty('teamAverage');
    });

    it('should return 400 for invalid companyId', async () => {
      const res = await request(app).get('/api/collaborators-performance?companyId=999');

      expect(res.status).toBe(400);
    });
  });

  // =====================
  // POST /api/kpi-values
  // =====================
  describe('POST /api/kpi-values', () => {
    it('should create a new KPI value', async () => {
      const body = { kpiId: 1, companyId: 1, value: '85', period: 'Enero 2025', month: 'Enero', year: 2025 };
      mockStorage.getKpi.mockResolvedValueOnce({ id: 1, name: 'Test KPI', companyId: 1, target: '100' });
      mockStorage.getLatestKpiValues.mockResolvedValueOnce([]);
      mockStorage.createKpiValue.mockResolvedValueOnce({ id: 1, ...body, status: 'alert', compliancePercentage: '85' });

      const res = await request(app)
        .post('/api/kpi-values')
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('should return 404 when KPI not found', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);
      mockStorage.getKpi.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/kpi-values')
        .send({ kpiId: 999, companyId: 1, value: '85', period: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should return 400 for missing companyId when it cannot be resolved', async () => {
      mockStorage.getKpis.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/kpi-values')
        .send({ kpiId: 1, value: '85', period: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should handle server errors gracefully', async () => {
      mockStorage.getKpi.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/api/kpi-values')
        .send({ kpiId: 1, companyId: 1, value: '85', period: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // PUT /api/kpi-values/bulk
  // =====================
  describe('PUT /api/kpi-values/bulk', () => {
    it('should bulk update KPI values', async () => {
      mockStorage.getKpi.mockResolvedValueOnce({ id: 1, name: 'Test KPI', target: '100' });
      mockStorage.createKpiValue.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .put('/api/kpi-values/bulk')
        .send({
          kpiId: 1,
          companyId: 1,
          values: [
            { month: 'Enero', year: 2025, value: '85' },
            { month: 'Febrero', year: 2025, value: '90' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.successful).toBe(2);
    });

    it('should return 400 when kpiId or companyId is missing', async () => {
      const res = await request(app)
        .put('/api/kpi-values/bulk')
        .send({ values: [] });

      expect(res.status).toBe(400);
    });

    it('should return 400 when values is not an array', async () => {
      const res = await request(app)
        .put('/api/kpi-values/bulk')
        .send({ kpiId: 1, companyId: 1, values: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when values array is empty', async () => {
      const res = await request(app)
        .put('/api/kpi-values/bulk')
        .send({ kpiId: 1, companyId: 1, values: [] });

      expect(res.status).toBe(400);
    });

    it('should return 404 when KPI not found', async () => {
      mockStorage.getKpi.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/kpi-values/bulk')
        .send({
          kpiId: 999,
          companyId: 1,
          values: [{ month: 'Enero', year: 2025, value: '85' }],
        });

      expect(res.status).toBe(404);
    });
  });
});
