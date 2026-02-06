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

const { mockSql } = vi.hoisted(() => ({
  mockSql: vi.fn(),
}));

vi.mock('../../routes/_helpers', () => ({
  sql: (...args: any[]) => mockSql(...args),
  getAuthUser: (req: any) => req.user,
  AuthRequest: {},
}));

vi.mock('../../storage', () => ({
  storage: {
    getKpis: vi.fn(),
    getKpiValuesByKpi: vi.fn(),
  },
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    // Only set user if not already set (allows test to inject non-admin users)
    if (!req.user) {
      req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    }
    next();
  },
  jwtAdminMiddleware: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  },
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
}));

vi.mock('../../sales-metrics', () => ({
  getSalesMetrics: vi.fn().mockResolvedValue({
    activeClients: 10,
    currentVolume: 5000,
    unit: 'KG',
    growth: 12.5,
  }),
}));

vi.mock('../../sales-analyst', () => ({
  generateSalesAnalystInsights: vi.fn().mockResolvedValue({
    summary: 'Test insights',
    recommendations: [],
  }),
}));

vi.mock('../../profitability-metrics', () => ({
  calculateRealProfitability: vi.fn().mockResolvedValue({
    totalRevenue: 100000,
    totalCost: 80000,
    margin: 20,
  }),
}));

vi.mock('../../annual-summary', () => ({
  getAnnualSummary: vi.fn().mockResolvedValue({ year: 2025, totalRevenue: 500000 }),
  getAvailableYears: vi.fn().mockResolvedValue([2024, 2025]),
}));

vi.mock('../../email-service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
  },
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

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('zod', async () => {
  const actual = await vi.importActual('zod');
  return actual;
});

// ---- Import Router ----

import salesAnalyticsRouter from '../../routes/sales-analytics';

describe('Sales Analytics Routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(salesAnalyticsRouter);
  });

  // =====================
  // POST /api/test-email
  // =====================
  describe('POST /api/test-email', () => {
    it('should send a test email for admin users', async () => {
      const res = await request(app)
        .post('/api/test-email')
        .send({ to: 'test@example.com', department: 'treasury' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when no email destination provided', async () => {
      const res = await request(app)
        .post('/api/test-email')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      // Override middleware for this test
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      nonAdminApp.use((req: any, _res: any, next: any) => {
        req.user = { id: 2, role: 'viewer', email: 'viewer@test.com', name: 'Viewer', companyId: 1, areaId: 1 };
        next();
      });
      nonAdminApp.use(salesAnalyticsRouter);

      const res = await request(nonAdminApp)
        .post('/api/test-email')
        .send({ to: 'test@example.com' });

      expect(res.status).toBe(403);
    });
  });

  // =====================
  // GET /api/sales-stats
  // =====================
  describe('GET /api/sales-stats', () => {
    it('should return sales metrics for authenticated users', async () => {
      const res = await request(app).get('/api/sales-stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activeClients');
      expect(res.body).toHaveProperty('currentVolume');
    });

    it('should accept companyId query parameter', async () => {
      const res = await request(app).get('/api/sales-stats?companyId=2');

      expect(res.status).toBe(200);
    });
  });

  // =====================
  // GET /api/sales-comparison
  // =====================
  describe('GET /api/sales-comparison', () => {
    it('should return comparison data', async () => {
      mockSql.mockResolvedValueOnce([
        { client_id: 1, client_name: 'Client A', current_year_total: 100, previous_year_total: 80, differential: 20, percent_change: 25, unit: 'KG' },
      ]);

      const res = await request(app).get('/api/sales-comparison');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should accept year and month query parameters', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/sales-comparison?year=2024&month=6');

      expect(res.status).toBe(200);
    });
  });

  // =====================
  // GET /api/sales-alerts
  // =====================
  describe('GET /api/sales-alerts', () => {
    it('should return active alerts', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, alert_type: 'volume_drop', severity: 'high', title: 'Alert 1', is_active: true },
      ]);

      const res = await request(app).get('/api/sales-alerts');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter alerts by type', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/sales-alerts?type=volume_drop');

      expect(res.status).toBe(200);
    });
  });

  // =====================
  // POST /api/sales-alerts/:id/read
  // =====================
  describe('POST /api/sales-alerts/:id/read', () => {
    it('should mark an alert as read', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).post('/api/sales-alerts/1/read');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =====================
  // GET /api/sales-monthly-trends
  // =====================
  describe('GET /api/sales-monthly-trends', () => {
    it('should return monthly trend data with year filter', async () => {
      mockSql.mockResolvedValueOnce([
        { sale_year: '2025', sale_month: '1', total_volume: '1000', total_amount: '5000', active_clients: '5', unit: 'KG' },
      ]);

      const res = await request(app).get('/api/sales-monthly-trends?year=2025');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return monthly trend data without year (uses latest year)', async () => {
      // First call: get max year
      mockSql.mockResolvedValueOnce([{ max_year: '2025' }]);
      // Second call: get data for latest year (1 row < 12 months, triggers previous year fetch)
      mockSql.mockResolvedValueOnce([
        { sale_year: '2025', sale_month: '1', total_volume: '1000', total_amount: '5000', active_clients: '5', unit: 'KG' },
      ]);
      // Third call: get previous year data (since 1 < 12 months)
      mockSql.mockResolvedValueOnce([
        { sale_year: '2024', sale_month: '12', total_volume: '900', total_amount: '4500', active_clients: '4', unit: 'KG' },
      ]);

      const res = await request(app).get('/api/sales-monthly-trends');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =====================
  // GET /api/sales-yearly-comparison
  // =====================
  describe('GET /api/sales-yearly-comparison', () => {
    it('should return yearly comparison data', async () => {
      // Available years check
      mockSql.mockResolvedValueOnce([{ sale_year: '2025', count: '10' }, { sale_year: '2024', count: '12' }]);
      // 2026 check
      mockSql.mockResolvedValueOnce([{ count: '0' }]);
      // Monthly data
      mockSql.mockResolvedValueOnce([
        { sale_month: '1', sale_year: '2024', total_quantity: '100', total_amount: '500', unique_clients: '5', unit: 'KG' },
        { sale_month: '1', sale_year: '2025', total_quantity: '120', total_amount: '600', unique_clients: '6', unit: 'KG' },
      ]);
      // Available years for selector
      mockSql.mockResolvedValueOnce([{ sale_year: '2025' }, { sale_year: '2024' }]);

      const res = await request(app).get('/api/sales-yearly-comparison');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('availableYears');
    });
  });

  // =====================
  // GET /api/sales-multi-year-trend
  // =====================
  describe('GET /api/sales-multi-year-trend', () => {
    it('should return multi-year trend data', async () => {
      mockSql.mockResolvedValueOnce([
        { sale_year: '2024', sale_month: '1', total_quantity: '100', total_amount: '500', unique_clients: '5', unit: 'KG' },
        { sale_year: '2025', sale_month: '1', total_quantity: '120', total_amount: '600', unique_clients: '6', unit: 'KG' },
      ]);

      const res = await request(app).get('/api/sales-multi-year-trend');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('years');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('yearTotals');
    });
  });

  // =====================
  // GET /api/sales-churn-risk
  // =====================
  describe('GET /api/sales-churn-risk', () => {
    it('should return churn risk analysis', async () => {
      mockSql.mockResolvedValueOnce([
        {
          client_name: 'Client A', last_purchase: '2025-01-01', qty_current_year: '100',
          qty_last_year: '80', amt_current_year: '500', amt_last_year: '400',
          years_active: '2', unit: 'KG', days_since_purchase: '10', yoy_change: '25'
        },
      ]);

      const res = await request(app).get('/api/sales-churn-risk');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('clients');
      expect(res.body.summary).toHaveProperty('totalClients');
    });
  });

  // =====================
  // GET /api/sales-client-trends
  // =====================
  describe('GET /api/sales-client-trends', () => {
    it('should return top client trends', async () => {
      mockSql.mockResolvedValueOnce([
        { client_name: 'Client A', qty_current: '100', qty_previous: '80', amt_current: '500', amt_previous: '400', unit: 'KG' },
      ]);

      const res = await request(app).get('/api/sales-client-trends');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clients');
      expect(Array.isArray(res.body.clients)).toBe(true);
    });
  });

  // =====================
  // GET /api/sales-top-clients
  // =====================
  describe('GET /api/sales-top-clients', () => {
    it('should return top clients by volume', async () => {
      mockSql.mockResolvedValueOnce([
        { client_name: 'Client A', total_volume: '1000', total_revenue: '5000', transactions: '10', unit: 'KG' },
      ]);

      const res = await request(app).get('/api/sales-top-clients');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('volume');
      }
    });
  });

  // =====================
  // GET /api/sales-top-products
  // =====================
  describe('GET /api/sales-top-products', () => {
    it('should return top products by volume', async () => {
      mockSql.mockResolvedValueOnce([
        { product_name: 'Product A', total_volume: '500', total_revenue: '2500', unique_clients: '3', transactions: '5', unit: 'KG' },
      ]);

      const res = await request(app).get('/api/sales-top-products');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =====================
  // GET /api/sales-analyst/insights
  // =====================
  describe('GET /api/sales-analyst/insights', () => {
    it('should return analyst insights', async () => {
      const res = await request(app).get('/api/sales-analyst/insights');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
    });
  });

  // =====================
  // POST /api/sales-alerts/:id/resolve
  // =====================
  describe('POST /api/sales-alerts/:id/resolve', () => {
    it('should resolve an alert', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).post('/api/sales-alerts/1/resolve');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =====================
  // GET /api/profitability-metrics
  // =====================
  describe('GET /api/profitability-metrics', () => {
    it('should return profitability metrics', async () => {
      const res = await request(app).get('/api/profitability-metrics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalRevenue');
    });
  });

  // =====================
  // GET /api/annual-summary
  // =====================
  describe('GET /api/annual-summary', () => {
    it('should return annual summary when year is provided', async () => {
      const res = await request(app).get('/api/annual-summary?year=2025');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('year');
    });

    it('should return 400 when year is not provided', async () => {
      const res = await request(app).get('/api/annual-summary');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // =====================
  // GET /api/annual-summary/years
  // =====================
  describe('GET /api/annual-summary/years', () => {
    it('should return available years', async () => {
      const res = await request(app).get('/api/annual-summary/years');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
