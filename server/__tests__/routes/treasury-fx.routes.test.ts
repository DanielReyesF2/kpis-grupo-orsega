import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

function createTestApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ---- Mocks ----

const mockSql = vi.fn();

vi.mock('../../routes/_helpers', () => ({
  sql: (...args: any[]) => mockSql(...args),
  getAuthUser: (req: any) => req.user,
  AuthRequest: {},
}));

vi.mock('../../storage', () => ({
  storage: {},
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
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

vi.mock('../../fx-analytics', () => ({
  getSourceSeries: vi.fn().mockResolvedValue({ source: 'MONEX', data: [] }),
  getComparison: vi.fn().mockResolvedValue({ comparison: [] }),
}));

vi.mock('../../email-service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
  },
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

import treasuryFxRouter from '../../routes/treasury-fx';

describe('Treasury FX Routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(treasuryFxRouter);
  });

  // =====================
  // GET /api/treasury/exchange-rates
  // =====================
  describe('GET /api/treasury/exchange-rates', () => {
    it('should return exchange rates', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, buy_rate: '17.50', sell_rate: '18.00', source: 'Monex', date: '2025-01-15T10:00:00Z', notes: null },
      ]);

      const res = await request(app).get('/api/treasury/exchange-rates');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should accept limit query parameter', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/treasury/exchange-rates?limit=10');

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalled();
    });

    it('should handle server errors gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await request(app).get('/api/treasury/exchange-rates');

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });

  // =====================
  // GET /api/treasury/exchange-rates/daily
  // =====================
  describe('GET /api/treasury/exchange-rates/daily', () => {
    it('should return daily exchange rate data', async () => {
      mockSql.mockResolvedValueOnce([
        { buy_rate: '17.50', sell_rate: '18.00', source: 'monex', date: '2025-01-15T10:00:00Z' },
      ]);

      const res = await request(app).get('/api/treasury/exchange-rates/daily');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should accept rateType, days and sources parameters', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/treasury/exchange-rates/daily?rateType=sell&days=3&sources=monex');

      expect(res.status).toBe(200);
    });

    it('should reject invalid sources', async () => {
      const res = await request(app).get('/api/treasury/exchange-rates/daily?sources=invalid_source');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invlidas');
    });
  });

  // =====================
  // GET /api/treasury/exchange-rates/monthly
  // =====================
  describe('GET /api/treasury/exchange-rates/monthly', () => {
    it('should return monthly exchange rate averages', async () => {
      mockSql.mockResolvedValueOnce([
        { buy_rate: '17.50', sell_rate: '18.00', source: 'monex', date: '2025-01-15T10:00:00Z' },
      ]);

      const res = await request(app).get('/api/treasury/exchange-rates/monthly?year=2025&month=1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =====================
  // GET /api/treasury/exchange-rates/range
  // =====================
  describe('GET /api/treasury/exchange-rates/range', () => {
    it('should return exchange rates for a date range', async () => {
      mockSql.mockResolvedValueOnce([
        { buy_rate: '17.50', sell_rate: '18.00', source: 'monex', date: '2025-01-15T10:00:00Z' },
      ]);

      const res = await request(app).get('/api/treasury/exchange-rates/range?startDate=2025-01-01&endDate=2025-01-31');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 400 when dates are missing', async () => {
      const res = await request(app).get('/api/treasury/exchange-rates/range');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('requeridos');
    });

    it('should return 400 when range exceeds 365 days', async () => {
      const res = await request(app).get('/api/treasury/exchange-rates/range?startDate=2024-01-01&endDate=2025-06-01');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('365');
    });

    it('should return 400 when endDate is before startDate', async () => {
      const res = await request(app).get('/api/treasury/exchange-rates/range?startDate=2025-06-01&endDate=2025-01-01');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('posterior');
    });
  });

  // =====================
  // GET /api/treasury/exchange-rates/stats
  // =====================
  describe('GET /api/treasury/exchange-rates/stats', () => {
    it('should return statistics for a date range', async () => {
      mockSql.mockResolvedValueOnce([
        { buy_rate: '17.50', sell_rate: '18.00', source: 'monex', date: '2025-01-15T10:00:00Z' },
        { buy_rate: '17.60', sell_rate: '18.10', source: 'monex', date: '2025-01-16T10:00:00Z' },
      ]);

      const res = await request(app).get('/api/treasury/exchange-rates/stats?startDate=2025-01-01&endDate=2025-01-31');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 400 when dates are missing', async () => {
      const res = await request(app).get('/api/treasury/exchange-rates/stats');

      expect(res.status).toBe(400);
    });
  });

  // =====================
  // POST /api/treasury/exchange-rates
  // =====================
  describe('POST /api/treasury/exchange-rates', () => {
    it('should create a new exchange rate entry', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, buy_rate: '17.50', sell_rate: '18.00', source: 'Monex', date: '2025-01-15T10:00:00', notes: null, created_by: 1 },
      ]);

      const res = await request(app)
        .post('/api/treasury/exchange-rates')
        .send({ buyRate: 17.50, sellRate: 18.00, source: 'Monex', notes: 'test' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('should reject DOF rates where buy and sell differ', async () => {
      const res = await request(app)
        .post('/api/treasury/exchange-rates')
        .send({ buyRate: 17.50, sellRate: 18.00, source: 'DOF' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('DOF');
    });
  });

  // =====================
  // POST /api/treasury/request-purchase
  // =====================
  describe('POST /api/treasury/request-purchase', () => {
    it('should send a purchase request email', async () => {
      const res = await request(app)
        .post('/api/treasury/request-purchase')
        .send({ source: 'Monex', amountUsd: 1000, amountMxn: 17500, rate: 17.50 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/treasury/request-purchase')
        .send({ source: 'Monex' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // =====================
  // GET /api/fx/source-series
  // =====================
  describe('GET /api/fx/source-series', () => {
    it('should return source series data', async () => {
      const res = await request(app).get('/api/fx/source-series?source=MONEX&days=30');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('source');
    });
  });

  // =====================
  // GET /api/fx/compare
  // =====================
  describe('GET /api/fx/compare', () => {
    it('should return comparison data between sources', async () => {
      const res = await request(app).get('/api/fx/compare?days=30&usd_monthly=25000');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('comparison');
    });
  });
});
