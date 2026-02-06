import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

function createTestApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ---- Mocks (hoisted so they are available inside vi.mock factories) ----

const { mockSql, mockStorage, mockUpdateLogisticsKPIs, mockSendShipmentStatusNotification, mockInsertShipmentSchemaParse, mockUpdateShipmentStatusSchemaParse, mockValidateTenantAccess } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockStorage: {
    getShipments: vi.fn(),
    getShipmentsByCompany: vi.fn(),
    getShipment: vi.fn(),
    getShipmentByTrackingCode: vi.fn(),
    createShipment: vi.fn(),
    updateShipment: vi.fn(),
    getShipmentItems: vi.fn(),
    createShipmentItem: vi.fn(),
    createShipmentItems: vi.fn(),
    deleteShipmentItem: vi.fn(),
    updateShipmentItem: vi.fn(),
    getShipmentUpdates: vi.fn(),
    createShipmentUpdate: vi.fn(),
    getActionPlansByKpi: vi.fn(),
    getActionPlan: vi.fn(),
    getShipmentNotificationsByShipment: vi.fn(),
    createShipmentNotification: vi.fn(),
    recalculateShipmentCycleTime: vi.fn(),
    getAggregateCycleTimes: vi.fn(),
  },
  mockUpdateLogisticsKPIs: vi.fn().mockResolvedValue(undefined),
  mockSendShipmentStatusNotification: vi.fn().mockResolvedValue({ provider: 'mock' }),
  mockInsertShipmentSchemaParse: vi.fn((data: any) => data),
  mockUpdateShipmentStatusSchemaParse: vi.fn((data: any) => data),
  mockValidateTenantAccess: vi.fn(),
}));

vi.mock('../../routes/_helpers', () => ({
  sql: (...args: any[]) => mockSql(...args),
  getAuthUser: (req: any) => req.user,
  updateLogisticsKPIs: mockUpdateLogisticsKPIs,
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

vi.mock('../../sendgrid', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getShipmentStatusEmailTemplate: vi.fn().mockReturnValue({ subject: 'Test', html: '<p>Test</p>', text: 'Test' }),
}));

vi.mock('../../middleware/tenant-validation', () => ({
  validateTenantAccess: mockValidateTenantAccess,
  validateTenantFromBody: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

vi.mock('@shared/schema', () => ({
  insertShipmentSchema: { parse: mockInsertShipmentSchemaParse },
  updateShipmentStatusSchema: { parse: mockUpdateShipmentStatusSchemaParse },
}));

vi.mock('../../email-logistics.js', () => ({
  sendShipmentStatusNotification: mockSendShipmentStatusNotification,
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

import shipmentsRouter from '../../routes/shipments';

describe('Shipments Routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(shipmentsRouter);
  });

  // =====================
  // GET /api/shipments
  // =====================
  describe('GET /api/shipments', () => {
    it('should return paginated shipments', async () => {
      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'in_transit', createdAt: new Date() },
        { id: 2, status: 'delivered', createdAt: new Date() },
      ]);

      const res = await request(app).get('/api/shipments');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('shipments');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('total', 2);
    });

    it('should filter by companyId', async () => {
      mockStorage.getShipmentsByCompany.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/shipments?companyId=1');

      expect(res.status).toBe(200);
      expect(mockStorage.getShipmentsByCompany).toHaveBeenCalledWith(1);
    });

    it('should filter by status', async () => {
      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'in_transit', createdAt: new Date() },
        { id: 2, status: 'delivered', createdAt: new Date() },
      ]);

      const res = await request(app).get('/api/shipments?status=in_transit');

      expect(res.status).toBe(200);
      expect(res.body.shipments.every((s: any) => s.status === 'in_transit')).toBe(true);
    });

    it('should handle pagination parameters', async () => {
      mockStorage.getShipments.mockResolvedValueOnce(
        Array(10).fill(null).map((_, i) => ({ id: i + 1, status: 'in_transit', createdAt: new Date() }))
      );

      const res = await request(app).get('/api/shipments?limit=5&page=2');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(5);
    });
  });

  // =====================
  // GET /api/shipments/products
  // =====================
  describe('GET /api/shipments/products', () => {
    it('should return unique products', async () => {
      mockSql.mockResolvedValueOnce([{ product: 'Steel' }, { product: 'Copper' }]);

      const res = await request(app).get('/api/shipments/products');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('Steel');
    });
  });

  // =====================
  // GET /api/shipments/:id
  // =====================
  describe('GET /api/shipments/:id', () => {
    it('should return a shipment with items', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'in_transit' });
      mockStorage.getShipmentItems.mockResolvedValueOnce([{ id: 1, product: 'Steel' }]);

      const res = await request(app).get('/api/shipments/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    it('should return 404 for non-existent shipment', async () => {
      mockStorage.getShipment.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/shipments/999');

      expect(res.status).toBe(404);
    });
  });

  // =====================
  // GET /api/shipments/tracking/:trackingCode
  // =====================
  describe('GET /api/shipments/tracking/:trackingCode', () => {
    it('should return shipment by tracking code', async () => {
      mockStorage.getShipmentByTrackingCode.mockResolvedValueOnce({ id: 1, trackingCode: 'TRK-001' });

      const res = await request(app).get('/api/shipments/tracking/TRK-001');

      expect(res.status).toBe(200);
      expect(res.body.trackingCode).toBe('TRK-001');
    });

    it('should return 404 for unknown tracking code', async () => {
      mockStorage.getShipmentByTrackingCode.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/shipments/tracking/UNKNOWN');

      expect(res.status).toBe(404);
    });
  });

  // =====================
  // POST /api/shipments
  // =====================
  describe('POST /api/shipments', () => {
    it('should create a new shipment', async () => {
      const newShipment = { id: 1, containerNumber: 'CONT-001', companyId: 1, status: 'pending' };
      mockStorage.createShipment.mockResolvedValueOnce(newShipment);
      mockStorage.getShipmentItems.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/shipments')
        .send({ containerNumber: 'CONT-001', companyId: 1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  // =====================
  // PATCH /api/shipments/:id
  // =====================
  describe('PATCH /api/shipments/:id', () => {
    it('should update a shipment', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.updateShipment.mockResolvedValueOnce({ id: 1, status: 'in_transit' });

      const res = await request(app)
        .patch('/api/shipments/1')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent shipment', async () => {
      mockStorage.getShipment.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/shipments/999')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(404);
    });
  });

  // =====================
  // GET /api/shipments/:id/items
  // =====================
  describe('GET /api/shipments/:id/items', () => {
    it('should return items for a shipment', async () => {
      mockStorage.getShipmentItems.mockResolvedValueOnce([
        { id: 1, product: 'Steel', quantity: 100, unit: 'KG' },
      ]);

      const res = await request(app).get('/api/shipments/1/items');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =====================
  // GET /api/shipments/:id/updates
  // =====================
  describe('GET /api/shipments/:id/updates', () => {
    it('should return update history for a shipment', async () => {
      mockStorage.getShipmentUpdates.mockResolvedValueOnce([
        { id: 1, status: 'in_transit', location: 'Shanghai' },
      ]);

      const res = await request(app).get('/api/shipments/1/updates');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =====================
  // GET /api/action-plans
  // =====================
  describe('GET /api/action-plans', () => {
    it('should return action plans for a kpiId', async () => {
      mockStorage.getActionPlansByKpi.mockResolvedValueOnce([{ id: 1, kpiId: 5 }]);

      const res = await request(app).get('/api/action-plans?kpiId=5');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return empty array when no kpiId', async () => {
      const res = await request(app).get('/api/action-plans');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // =====================
  // GET /api/shipments/:id/cycle-times
  // =====================
  describe('GET /api/shipments/:id/cycle-times', () => {
    it('should return cycle time data', async () => {
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({ totalDays: 30, phases: {} });

      const res = await request(app).get('/api/shipments/1/cycle-times');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalDays');
    });

    it('should return 404 if shipment not found', async () => {
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/shipments/999/cycle-times');

      expect(res.status).toBe(404);
    });

    it('should return 500 when recalculateShipmentCycleTime throws', async () => {
      mockStorage.recalculateShipmentCycleTime.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/shipments/1/cycle-times');

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/error/i);
    });
  });

  // =====================================================
  // ADDITIONAL COVERAGE TESTS
  // =====================================================

  // =====================
  // GET /api/shipments - Error & edge cases
  // =====================
  describe('GET /api/shipments - error handling', () => {
    it('should return 500 when storage.getShipments throws', async () => {
      mockStorage.getShipments.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await request(app).get('/api/shipments');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });

    it('should return 500 when storage.getShipmentsByCompany throws', async () => {
      mockStorage.getShipmentsByCompany.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/shipments?companyId=1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });

    it('should filter by since parameter using days format (e.g. 30d)', async () => {
      const now = new Date();
      const recent = new Date(now);
      recent.setDate(recent.getDate() - 5);
      const old = new Date(now);
      old.setDate(old.getDate() - 60);

      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'delivered', createdAt: recent.toISOString() },
        { id: 2, status: 'delivered', createdAt: old.toISOString() },
      ]);

      const res = await request(app).get('/api/shipments?since=30d');

      expect(res.status).toBe(200);
      expect(res.body.shipments).toHaveLength(1);
      expect(res.body.shipments[0].id).toBe(1);
    });

    it('should filter by since parameter using date format (YYYY-MM-DD)', async () => {
      const now = new Date();
      const recent = new Date(now);
      recent.setDate(recent.getDate() - 5);
      const old = new Date('2020-01-01');

      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'delivered', createdAt: recent.toISOString() },
        { id: 2, status: 'delivered', createdAt: old.toISOString() },
      ]);

      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 30);
      const sinceDateStr = sinceDate.toISOString().split('T')[0];

      const res = await request(app).get(`/api/shipments?since=${sinceDateStr}`);

      expect(res.status).toBe(200);
      expect(res.body.shipments).toHaveLength(1);
      expect(res.body.shipments[0].id).toBe(1);
    });

    it('should sort shipments by date descending (newest first)', async () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2025-06-15');

      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'delivered', createdAt: older.toISOString() },
        { id: 2, status: 'delivered', createdAt: newer.toISOString() },
      ]);

      const res = await request(app).get('/api/shipments');

      expect(res.status).toBe(200);
      expect(res.body.shipments[0].id).toBe(2);
      expect(res.body.shipments[1].id).toBe(1);
    });

    it('should correctly compute hasMore and totalPages', async () => {
      mockStorage.getShipments.mockResolvedValueOnce(
        Array(12).fill(null).map((_, i) => ({ id: i + 1, status: 'pending', createdAt: new Date().toISOString() }))
      );

      const res = await request(app).get('/api/shipments?limit=5&page=1');

      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(12);
      expect(res.body.pagination.totalPages).toBe(3);
      expect(res.body.pagination.hasMore).toBe(true);
      expect(res.body.shipments).toHaveLength(5);
    });

    it('should return no shipments on out-of-range page', async () => {
      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'pending', createdAt: new Date().toISOString() },
      ]);

      const res = await request(app).get('/api/shipments?limit=5&page=100');

      expect(res.status).toBe(200);
      expect(res.body.shipments).toHaveLength(0);
      expect(res.body.pagination.hasMore).toBe(false);
    });

    it('should use actualDeliveryDate for sorting when present', async () => {
      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'delivered', actualDeliveryDate: '2025-12-01', createdAt: '2025-01-01' },
        { id: 2, status: 'delivered', actualDeliveryDate: '2025-06-01', createdAt: '2025-02-01' },
      ]);

      const res = await request(app).get('/api/shipments');

      expect(res.status).toBe(200);
      // id 1 has the later actualDeliveryDate, so should be first
      expect(res.body.shipments[0].id).toBe(1);
    });

    it('should use updatedAt as fallback for sorting when no actualDeliveryDate', async () => {
      mockStorage.getShipments.mockResolvedValueOnce([
        { id: 1, status: 'pending', updatedAt: '2025-03-01', createdAt: '2025-01-01' },
        { id: 2, status: 'pending', updatedAt: '2025-09-01', createdAt: '2025-02-01' },
      ]);

      const res = await request(app).get('/api/shipments');

      expect(res.status).toBe(200);
      expect(res.body.shipments[0].id).toBe(2);
    });

    it('should combine companyId and status filters', async () => {
      mockStorage.getShipmentsByCompany.mockResolvedValueOnce([
        { id: 1, status: 'in_transit', createdAt: new Date().toISOString() },
        { id: 2, status: 'delivered', createdAt: new Date().toISOString() },
        { id: 3, status: 'in_transit', createdAt: new Date().toISOString() },
      ]);

      const res = await request(app).get('/api/shipments?companyId=2&status=in_transit');

      expect(res.status).toBe(200);
      expect(mockStorage.getShipmentsByCompany).toHaveBeenCalledWith(2);
      expect(res.body.shipments).toHaveLength(2);
      expect(res.body.shipments.every((s: any) => s.status === 'in_transit')).toBe(true);
    });
  });

  // =====================
  // GET /api/shipments/products - error handling
  // =====================
  describe('GET /api/shipments/products - error handling', () => {
    it('should return 500 when sql query throws', async () => {
      mockSql.mockRejectedValueOnce(new Error('SQL error'));

      const res = await request(app).get('/api/shipments/products');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });

    it('should return empty array when no products found', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/shipments/products');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // =====================
  // GET /api/shipments/:id - error handling
  // =====================
  describe('GET /api/shipments/:id - error handling', () => {
    it('should return 500 when getShipment throws', async () => {
      mockStorage.getShipment.mockRejectedValueOnce(new Error('DB failure'));

      const res = await request(app).get('/api/shipments/1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });

    it('should return 500 when getShipmentItems throws after finding shipment', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.getShipmentItems.mockRejectedValueOnce(new Error('Items query failed'));

      const res = await request(app).get('/api/shipments/1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });
  });

  // =====================
  // GET /api/shipments/tracking/:trackingCode - error handling
  // =====================
  describe('GET /api/shipments/tracking/:trackingCode - error handling', () => {
    it('should return 500 when getShipmentByTrackingCode throws', async () => {
      mockStorage.getShipmentByTrackingCode.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/shipments/tracking/TRK-ERR');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });
  });

  // =====================
  // POST /api/shipments - error & edge cases
  // =====================
  describe('POST /api/shipments - error handling & edge cases', () => {
    it('should return 400 when Zod validation fails', async () => {
      const zodError = new z.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['containerNumber'],
          message: 'Required',
        },
      ]);
      mockInsertShipmentSchemaParse.mockImplementationOnce(() => { throw zodError; });

      const res = await request(app)
        .post('/api/shipments')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.errors).toBeDefined();
      expect(res.body.details).toBeDefined();
      expect(res.body.details[0].field).toBe('containerNumber');
    });

    it('should return 500 when createShipment throws a generic error', async () => {
      mockStorage.createShipment.mockRejectedValueOnce(new Error('Insert failed'));

      const res = await request(app)
        .post('/api/shipments')
        .send({ containerNumber: 'CONT-001', companyId: 1 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(res.body.message).toBe('Insert failed');
    });

    it('should return 500 with DB error code details', async () => {
      const dbError: any = new Error('unique violation');
      dbError.code = '23505';
      dbError.detail = 'Key (tracking_code) already exists';
      mockStorage.createShipment.mockRejectedValueOnce(dbError);

      const res = await request(app)
        .post('/api/shipments')
        .send({ containerNumber: 'CONT-DUP', companyId: 1 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });

    it('should create shipment with items', async () => {
      const newShipment = { id: 5, containerNumber: 'CONT-ITEMS', companyId: 1, status: 'pending' };
      mockStorage.createShipment.mockResolvedValueOnce(newShipment);
      mockStorage.createShipmentItems.mockResolvedValueOnce(undefined);
      mockStorage.getShipmentItems.mockResolvedValueOnce([
        { id: 10, shipmentId: 5, product: 'Steel', quantity: 100, unit: 'KG', description: null },
      ]);

      const res = await request(app)
        .post('/api/shipments')
        .send({
          containerNumber: 'CONT-ITEMS',
          companyId: 1,
          items: [{ product: 'Steel', quantity: 100, unit: 'KG' }],
        });

      expect(res.status).toBe(201);
      expect(mockStorage.createShipmentItems).toHaveBeenCalledTimes(1);
      expect(res.body.items).toHaveLength(1);
    });

    it('should skip item creation when items array is empty', async () => {
      const newShipment = { id: 6, containerNumber: 'CONT-EMPTY', companyId: 1, status: 'pending' };
      mockStorage.createShipment.mockResolvedValueOnce(newShipment);
      mockStorage.getShipmentItems.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/shipments')
        .send({ containerNumber: 'CONT-EMPTY', companyId: 1, items: [] });

      expect(res.status).toBe(201);
      expect(mockStorage.createShipmentItems).not.toHaveBeenCalled();
    });

    it('should transform date strings to Date objects', async () => {
      const newShipment = { id: 7, containerNumber: 'CONT-DATE', companyId: 1, status: 'pending' };
      mockStorage.createShipment.mockResolvedValueOnce(newShipment);
      mockStorage.getShipmentItems.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/shipments')
        .send({
          containerNumber: 'CONT-DATE',
          companyId: 1,
          estimatedDeliveryDate: '2025-12-25',
          departureDate: '2025-12-01',
          actualDeliveryDate: '2025-12-24',
        });

      expect(res.status).toBe(201);
      // Verify the parse was called with Date objects
      expect(mockInsertShipmentSchemaParse).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedDeliveryDate: expect.any(Date),
          departureDate: expect.any(Date),
          actualDeliveryDate: expect.any(Date),
        })
      );
    });

    it('should handle null date fields gracefully', async () => {
      const newShipment = { id: 8, containerNumber: 'CONT-NULL', companyId: 1, status: 'pending' };
      mockStorage.createShipment.mockResolvedValueOnce(newShipment);
      mockStorage.getShipmentItems.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/shipments')
        .send({
          containerNumber: 'CONT-NULL',
          companyId: 1,
          estimatedDeliveryDate: null,
          departureDate: null,
          actualDeliveryDate: null,
        });

      expect(res.status).toBe(201);
      expect(mockInsertShipmentSchemaParse).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedDeliveryDate: null,
          departureDate: null,
          actualDeliveryDate: null,
        })
      );
    });

    it('should call validateTenantAccess when companyId is present', async () => {
      const newShipment = { id: 9, containerNumber: 'CONT-TENANT', companyId: 2, status: 'pending' };
      mockStorage.createShipment.mockResolvedValueOnce(newShipment);
      mockStorage.getShipmentItems.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/shipments')
        .send({ containerNumber: 'CONT-TENANT', companyId: 2 });

      expect(res.status).toBe(201);
      expect(mockValidateTenantAccess).toHaveBeenCalledWith(expect.anything(), 2);
    });

    it('should return 500 with default message when error has no message', async () => {
      mockStorage.createShipment.mockRejectedValueOnce({});

      const res = await request(app)
        .post('/api/shipments')
        .send({ containerNumber: 'CONT-X', companyId: 1 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });
  });

  // =====================
  // PATCH /api/shipments/:id - additional edge cases
  // =====================
  describe('PATCH /api/shipments/:id - additional edge cases', () => {
    it('should return 500 when updateShipment returns null', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.updateShipment.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/shipments/1')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to update shipment');
    });

    it('should return 500 when updateShipment throws', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.updateShipment.mockRejectedValueOnce(new Error('Update failed'));

      const res = await request(app)
        .patch('/api/shipments/1')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
    });

    it('should normalize string dates to Date objects', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.updateShipment.mockResolvedValueOnce({ id: 1, status: 'pending', estimatedDeliveryDate: new Date('2025-12-25') });

      const res = await request(app)
        .patch('/api/shipments/1')
        .send({
          estimatedDeliveryDate: '2025-12-25',
          departureDate: '2025-12-01',
          actualDeliveryDate: '2025-12-24',
        });

      expect(res.status).toBe(200);
      expect(mockStorage.updateShipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          estimatedDeliveryDate: expect.any(Date),
          departureDate: expect.any(Date),
          actualDeliveryDate: expect.any(Date),
        })
      );
    });

    it('should set date to null when empty string is provided', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.updateShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });

      const res = await request(app)
        .patch('/api/shipments/1')
        .send({
          estimatedDeliveryDate: '',
          departureDate: '',
          actualDeliveryDate: '',
        });

      expect(res.status).toBe(200);
      expect(mockStorage.updateShipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          estimatedDeliveryDate: null,
          departureDate: null,
          actualDeliveryDate: null,
        })
      );
    });

    it('should pass through non-date fields without transformation', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.updateShipment.mockResolvedValueOnce({ id: 1, status: 'pending', origin: 'Shanghai' });

      const res = await request(app)
        .patch('/api/shipments/1')
        .send({ origin: 'Shanghai', destination: 'LA' });

      expect(res.status).toBe(200);
      expect(mockStorage.updateShipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ origin: 'Shanghai', destination: 'LA' })
      );
    });
  });

  // =====================
  // GET /api/shipments/:id/items - error handling
  // =====================
  describe('GET /api/shipments/:id/items - error handling', () => {
    it('should return 500 when getShipmentItems throws', async () => {
      mockStorage.getShipmentItems.mockRejectedValueOnce(new Error('Items query failed'));

      const res = await request(app).get('/api/shipments/1/items');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });

    it('should return empty array when shipment has no items', async () => {
      mockStorage.getShipmentItems.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/shipments/1/items');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // =====================
  // POST /api/shipments/:id/items
  // =====================
  describe('POST /api/shipments/:id/items', () => {
    it('should create a new shipment item', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.createShipmentItem.mockResolvedValueOnce({ id: 10, shipmentId: 1, product: 'Copper', quantity: 50, unit: 'KG' });

      const res = await request(app)
        .post('/api/shipments/1/items')
        .send({ product: 'Copper', quantity: 50, unit: 'KG' });

      expect(res.status).toBe(201);
      expect(res.body.product).toBe('Copper');
    });

    it('should return 404 when shipment does not exist', async () => {
      mockStorage.getShipment.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/shipments/999/items')
        .send({ product: 'Copper', quantity: 50, unit: 'KG' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Shipment not found');
    });

    it('should return 400 when required fields are missing (no product)', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });

      const res = await request(app)
        .post('/api/shipments/1/items')
        .send({ quantity: 50, unit: 'KG' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when required fields are missing (no quantity)', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });

      const res = await request(app)
        .post('/api/shipments/1/items')
        .send({ product: 'Steel', unit: 'KG' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when required fields are missing (no unit)', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });

      const res = await request(app)
        .post('/api/shipments/1/items')
        .send({ product: 'Steel', quantity: 50 });

      expect(res.status).toBe(400);
    });

    it('should return 500 when createShipmentItem throws', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.createShipmentItem.mockRejectedValueOnce(new Error('Item creation failed'));

      const res = await request(app)
        .post('/api/shipments/1/items')
        .send({ product: 'Steel', quantity: 100, unit: 'KG' });

      expect(res.status).toBe(500);
    });

    it('should include description when provided', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.createShipmentItem.mockResolvedValueOnce({
        id: 11, shipmentId: 1, product: 'Steel', quantity: 100, unit: 'KG', description: 'High-grade steel'
      });

      const res = await request(app)
        .post('/api/shipments/1/items')
        .send({ product: 'Steel', quantity: 100, unit: 'KG', description: 'High-grade steel' });

      expect(res.status).toBe(201);
      expect(mockStorage.createShipmentItem).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'High-grade steel' })
      );
    });
  });

  // =====================
  // DELETE /api/shipments/:id/items/:itemId
  // =====================
  describe('DELETE /api/shipments/:id/items/:itemId', () => {
    it('should delete a shipment item successfully', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.deleteShipmentItem.mockResolvedValueOnce(true);

      const res = await request(app).delete('/api/shipments/1/items/10');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('should return 404 when shipment does not exist', async () => {
      mockStorage.getShipment.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/shipments/999/items/10');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Shipment not found');
    });

    it('should return 404 when item does not exist', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.deleteShipmentItem.mockResolvedValueOnce(false);

      const res = await request(app).delete('/api/shipments/1/items/999');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Item not found');
    });

    it('should return 500 when deleteShipmentItem throws', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ id: 1, status: 'pending' });
      mockStorage.deleteShipmentItem.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await request(app).delete('/api/shipments/1/items/10');

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
    });
  });

  // =====================
  // PATCH /api/shipments/:id/items/:itemId
  // =====================
  describe('PATCH /api/shipments/:id/items/:itemId', () => {
    it('should update a shipment item', async () => {
      mockStorage.getShipmentItems.mockResolvedValueOnce([
        { id: 10, shipmentId: 1, product: 'Steel', quantity: 100, unit: 'KG' },
      ]);
      mockStorage.updateShipmentItem.mockResolvedValueOnce({
        id: 10, shipmentId: 1, product: 'Steel', quantity: 200, unit: 'KG',
      });

      const res = await request(app)
        .patch('/api/shipments/1/items/10')
        .send({ quantity: 200 });

      expect(res.status).toBe(200);
      expect(res.body.quantity).toBe(200);
    });

    it('should return 404 when item is not found in shipment', async () => {
      mockStorage.getShipmentItems.mockResolvedValueOnce([
        { id: 10, shipmentId: 1, product: 'Steel', quantity: 100, unit: 'KG' },
      ]);

      const res = await request(app)
        .patch('/api/shipments/1/items/999')
        .send({ quantity: 200 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Item not found in this shipment');
    });

    it('should return 500 when updateShipmentItem returns null', async () => {
      mockStorage.getShipmentItems.mockResolvedValueOnce([
        { id: 10, shipmentId: 1, product: 'Steel', quantity: 100, unit: 'KG' },
      ]);
      mockStorage.updateShipmentItem.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/shipments/1/items/10')
        .send({ quantity: 200 });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Error updating item');
    });

    it('should return 500 when updateShipmentItem throws', async () => {
      mockStorage.getShipmentItems.mockResolvedValueOnce([
        { id: 10, shipmentId: 1, product: 'Steel', quantity: 100, unit: 'KG' },
      ]);
      mockStorage.updateShipmentItem.mockRejectedValueOnce(new Error('Update exploded'));

      const res = await request(app)
        .patch('/api/shipments/1/items/10')
        .send({ quantity: 200 });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Update exploded');
    });

    it('should return 500 when getShipmentItems throws', async () => {
      mockStorage.getShipmentItems.mockRejectedValueOnce(new Error('Items query failed'));

      const res = await request(app)
        .patch('/api/shipments/1/items/10')
        .send({ quantity: 200 });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Items query failed');
    });
  });

  // =====================
  // GET /api/shipments/:id/updates - error handling
  // =====================
  describe('GET /api/shipments/:id/updates - error handling', () => {
    it('should return 500 when getShipmentUpdates throws', async () => {
      mockStorage.getShipmentUpdates.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/shipments/1/updates');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });

    it('should return empty array when no updates exist', async () => {
      mockStorage.getShipmentUpdates.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/shipments/1/updates');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // =====================
  // GET /api/action-plans/:id
  // =====================
  describe('GET /api/action-plans/:id', () => {
    it('should return an action plan by id', async () => {
      mockStorage.getActionPlan.mockResolvedValueOnce({ id: 1, title: 'Plan A', kpiId: 5 });

      const res = await request(app).get('/api/action-plans/1');

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Plan A');
    });

    it('should return 404 for non-existent action plan', async () => {
      mockStorage.getActionPlan.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/action-plans/999');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Action plan not found');
    });

    it('should return 500 when getActionPlan throws', async () => {
      mockStorage.getActionPlan.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/action-plans/1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });
  });

  // =====================
  // GET /api/action-plans - error handling
  // =====================
  describe('GET /api/action-plans - error handling', () => {
    it('should return 500 when getActionPlansByKpi throws', async () => {
      mockStorage.getActionPlansByKpi.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/action-plans?kpiId=5');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });
  });

  // =====================
  // PATCH /api/shipments/:id/status - comprehensive tests
  // =====================
  describe('PATCH /api/shipments/:id/status', () => {
    const baseShipment = {
      id: 1,
      status: 'pending',
      companyId: 1,
      customerId: null,
      customerEmail: null,
      invoiceNumber: null,
      inRouteAt: null,
      deliveredAt: null,
    };

    it('should update shipment status successfully', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed', comments: 'Weather delay' });

      expect(res.status).toBe(200);
      expect(res.body.shipment.status).toBe('delayed');
      expect(res.body.update).toBeDefined();
    });

    it('should return 404 when shipment does not exist', async () => {
      mockStorage.getShipment.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/shipments/999/status')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no encontrado/i);
    });

    it('should return 400 when in_transit status has no invoice number', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, invoiceNumber: null });

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(400);
      expect(res.body.requiresInvoiceNumber).toBe(true);
    });

    it('should allow in_transit when invoice number is provided in request', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, invoiceNumber: null });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit', invoiceNumber: 'INV-001' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'in_transit', invoiceNumber: 'INV-001' });

      expect(res.status).toBe(200);
      expect(mockStorage.updateShipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ invoiceNumber: 'INV-001' })
      );
    });

    it('should allow in_transit when shipment already has invoice number', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, invoiceNumber: 'INV-EXISTING' });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit', invoiceNumber: 'INV-EXISTING' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(200);
    });

    it('should set inRouteAt when transitioning to in_transit and not already set', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, invoiceNumber: 'INV-001', inRouteAt: null });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(200);
      expect(mockStorage.updateShipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ inRouteAt: expect.any(Date) })
      );
    });

    it('should NOT override existing inRouteAt', async () => {
      const existingDate = new Date('2025-01-01');
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, invoiceNumber: 'INV-001', inRouteAt: existingDate });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'in_transit' });

      const updateCall = mockStorage.updateShipment.mock.calls[0][1];
      expect(updateCall.inRouteAt).toBeUndefined();
    });

    it('should set deliveredAt and actualDeliveryDate when transitioning to delivered', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit', invoiceNumber: 'INV-001', deliveredAt: null });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delivered', companyId: 1 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delivered' });

      expect(res.status).toBe(200);
      expect(mockStorage.updateShipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          deliveredAt: expect.any(Date),
          actualDeliveryDate: expect.any(Date),
        })
      );
    });

    it('should NOT override existing deliveredAt', async () => {
      const existingDate = new Date('2025-06-01');
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit', deliveredAt: existingDate });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delivered', companyId: 1 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delivered' });

      const updateCall = mockStorage.updateShipment.mock.calls[0][1];
      expect(updateCall.deliveredAt).toBeUndefined();
      expect(updateCall.actualDeliveryDate).toBeUndefined();
    });

    it('should return 404 when updateShipment returns null', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment });
      mockStorage.updateShipment.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/error al actualizar/i);
    });

    it('should recalculate cycle times after status update', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(mockStorage.recalculateShipmentCycleTime).toHaveBeenCalledWith(1);
    });

    it('should not fail status update when cycle time recalculation throws', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockRejectedValueOnce(new Error('Cycle time calc failed'));

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(200);
    });

    it('should call updateLogisticsKPIs when delivered and status changed', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit', deliveredAt: null });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delivered', companyId: 1 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delivered', sendNotification: false });

      expect(mockUpdateLogisticsKPIs).toHaveBeenCalledWith(1);
    });

    it('should NOT call updateLogisticsKPIs when status did not change (idempotent)', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delivered', deliveredAt: new Date() });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delivered', companyId: 1 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delivered', sendNotification: false });

      expect(mockUpdateLogisticsKPIs).not.toHaveBeenCalled();
    });

    it('should not fail when updateLogisticsKPIs throws', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit', deliveredAt: null });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delivered', companyId: 1 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});
      mockUpdateLogisticsKPIs.mockRejectedValueOnce(new Error('KPI update failed'));

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delivered', sendNotification: false });

      expect(res.status).toBe(200);
    });

    it('should return 400 when updateShipmentStatusSchema validation fails (ZodError)', async () => {
      const zodError = new z.ZodError([
        {
          code: 'invalid_enum_value',
          options: ['pending', 'in_transit', 'delayed', 'delivered', 'cancelled'],
          received: 'unknown_status',
          path: ['status'],
          message: 'Invalid enum value',
        },
      ]);
      mockUpdateShipmentStatusSchemaParse.mockImplementationOnce(() => { throw zodError; });

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'unknown_status' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should return 500 when a generic error is thrown', async () => {
      mockStorage.getShipment.mockRejectedValueOnce(new Error('Database down'));

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'in_transit' });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/error interno/i);
    });

    it('should include location and comments in shipment update record', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'in_transit', invoiceNumber: 'INV-X' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'in_transit', invoiceNumber: 'INV-X', location: 'Shanghai Port', comments: 'Departed port' });

      expect(mockStorage.createShipmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          shipmentId: 1,
          status: 'in_transit',
          location: 'Shanghai Port',
          comments: 'Departed port',
          updatedBy: 1,
        })
      );
    });

    it('should set emailNotificationSent to false when sendNotification is false', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed' });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed', sendNotification: false });

      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(false);
    });

    it('should report emailWarning when no customer email is configured', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, customerId: null, customerEmail: null });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed', customerId: null, customerEmail: null });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(false);
      expect(res.body.emailWarning).toMatch(/no hay email/i);
    });

    it('should send email notification when customer has customerId and email', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, customerId: 10 });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed', customerId: 10 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});
      mockSql
        .mockResolvedValueOnce([{ id: 10, email: 'client@example.com', email_notifications: true }]) // client query
        .mockResolvedValueOnce([]); // no existing notification
      mockStorage.createShipmentNotification.mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(true);
      expect(mockSendShipmentStatusNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          status: 'delayed',
        })
      );
      expect(mockStorage.createShipmentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          shipmentId: 1,
          emailTo: 'client@example.com',
          status: 'sent',
        })
      );
    });

    it('should use customerEmail as fallback when customerId has no client record', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, customerId: null });
      mockStorage.updateShipment.mockResolvedValueOnce({
        ...baseShipment, status: 'delayed', customerId: null, customerEmail: 'legacy@example.com'
      });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});
      mockSql.mockResolvedValueOnce([]); // no existing notification
      mockStorage.createShipmentNotification.mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(true);
      expect(mockSendShipmentStatusNotification).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'legacy@example.com' })
      );
    });

    it('should skip duplicate notification (idempotency)', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, customerId: 10 });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed', customerId: 10 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});
      mockSql
        .mockResolvedValueOnce([{ id: 10, email: 'client@example.com', email_notifications: true }]) // client query
        .mockResolvedValueOnce([{ id: 99 }]); // existing notification found

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(false);
      expect(res.body.emailWarning).toMatch(/ya enviada/i);
      expect(mockSendShipmentStatusNotification).not.toHaveBeenCalled();
    });

    it('should skip notification when client has notifications disabled', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, customerId: 10 });
      mockStorage.updateShipment.mockResolvedValueOnce({ ...baseShipment, status: 'delayed', customerId: 10 });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});
      mockSql.mockResolvedValueOnce([{ id: 10, email: 'client@example.com', email_notifications: false }]);

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(false);
      expect(res.body.emailWarning).toMatch(/deshabilitadas/i);
    });

    it('should handle email sending failure gracefully and log it', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, customerId: 10 });
      mockStorage.updateShipment.mockResolvedValueOnce({
        ...baseShipment, status: 'delayed', customerId: 10, customerEmail: 'client@example.com'
      });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});
      mockSql
        .mockResolvedValueOnce([{ id: 10, email: 'client@example.com', email_notifications: true }])
        .mockResolvedValueOnce([]); // no existing notification
      mockSendShipmentStatusNotification.mockRejectedValueOnce(new Error('SMTP timeout'));
      mockStorage.createShipmentNotification.mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(false);
      expect(res.body.emailWarning).toBe('SMTP timeout');
      expect(mockStorage.createShipmentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'SMTP timeout',
        })
      );
    });

    it('should handle email failure logging error without crashing', async () => {
      mockStorage.getShipment.mockResolvedValueOnce({ ...baseShipment, customerId: 10 });
      mockStorage.updateShipment.mockResolvedValueOnce({
        ...baseShipment, status: 'delayed', customerId: 10, customerEmail: 'client@example.com'
      });
      mockStorage.createShipmentUpdate.mockResolvedValueOnce({ id: 1 });
      mockStorage.recalculateShipmentCycleTime.mockResolvedValueOnce({});
      mockSql
        .mockResolvedValueOnce([{ id: 10, email: 'client@example.com', email_notifications: true }])
        .mockResolvedValueOnce([]); // no existing notification
      mockSendShipmentStatusNotification.mockRejectedValueOnce(new Error('SMTP timeout'));
      // The notification logging itself also fails
      mockStorage.createShipmentNotification.mockRejectedValueOnce(new Error('Notification log failed'));

      const res = await request(app)
        .patch('/api/shipments/1/status')
        .send({ status: 'delayed' });

      // Should still respond 200 despite double failure
      expect(res.status).toBe(200);
      expect(res.body.emailNotificationSent).toBe(false);
    });
  });

  // =====================
  // GET /api/shipments/:id/notifications
  // =====================
  describe('GET /api/shipments/:id/notifications', () => {
    it('should return notification history for a shipment', async () => {
      mockStorage.getShipmentNotificationsByShipment.mockResolvedValueOnce([
        { id: 1, shipmentId: 1, emailTo: 'client@test.com', status: 'sent' },
      ]);

      const res = await request(app).get('/api/shipments/1/notifications');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].emailTo).toBe('client@test.com');
    });

    it('should return empty array when no notifications exist', async () => {
      mockStorage.getShipmentNotificationsByShipment.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/shipments/1/notifications');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 500 when getShipmentNotificationsByShipment throws', async () => {
      mockStorage.getShipmentNotificationsByShipment.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/shipments/1/notifications');

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/error/i);
    });
  });

  // =====================
  // GET /api/metrics/cycle-times
  // =====================
  describe('GET /api/metrics/cycle-times', () => {
    it('should return aggregate cycle time metrics', async () => {
      mockStorage.getAggregateCycleTimes.mockResolvedValueOnce({
        averageDays: 15,
        totalShipments: 100,
      });

      const res = await request(app).get('/api/metrics/cycle-times');

      expect(res.status).toBe(200);
      expect(res.body.averageDays).toBe(15);
    });

    it('should pass companyId filter', async () => {
      mockStorage.getAggregateCycleTimes.mockResolvedValueOnce({ averageDays: 12 });

      const res = await request(app).get('/api/metrics/cycle-times?companyId=2');

      expect(res.status).toBe(200);
      expect(mockStorage.getAggregateCycleTimes).toHaveBeenCalledWith(2, undefined, undefined);
    });

    it('should pass date range filters', async () => {
      mockStorage.getAggregateCycleTimes.mockResolvedValueOnce({ averageDays: 10 });

      const res = await request(app).get('/api/metrics/cycle-times?startDate=2025-01-01&endDate=2025-06-30');

      expect(res.status).toBe(200);
      expect(mockStorage.getAggregateCycleTimes).toHaveBeenCalledWith(undefined, '2025-01-01', '2025-06-30');
    });

    it('should pass all filters together', async () => {
      mockStorage.getAggregateCycleTimes.mockResolvedValueOnce({ averageDays: 8 });

      const res = await request(app).get('/api/metrics/cycle-times?companyId=1&startDate=2025-01-01&endDate=2025-06-30');

      expect(res.status).toBe(200);
      expect(mockStorage.getAggregateCycleTimes).toHaveBeenCalledWith(1, '2025-01-01', '2025-06-30');
    });

    it('should return 500 when getAggregateCycleTimes throws', async () => {
      mockStorage.getAggregateCycleTimes.mockRejectedValueOnce(new Error('Aggregate query failed'));

      const res = await request(app).get('/api/metrics/cycle-times');

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/error/i);
    });
  });
});
