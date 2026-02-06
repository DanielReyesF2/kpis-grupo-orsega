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

const { mockSql, mockStorage, mockDb } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockStorage: {
    createScheduledPayment: vi.fn(),
    createPaymentVoucher: vi.fn(),
  },
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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
    req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    next();
  },
  jwtAdminMiddleware: (req: any, res: any, next: any) => next(),
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
}));

vi.mock('../../storage/file-storage', () => ({
  moveTempToStorage: vi.fn().mockResolvedValue({ url: '/uploads/test.pdf', storage: 'local' }),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
  Pool: vi.fn(),
}));

vi.mock('ws', () => ({ default: class {} }));

vi.mock('../../db', () => ({
  db: mockDb,
  pool: { query: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: any, b: any) => ({ field: a, value: b })),
  isNotNull: vi.fn((a: any) => ({ field: a, op: 'isNotNull' })),
  isNull: vi.fn((a: any) => ({ field: a, op: 'isNull' })),
}));

vi.mock('@shared/schema', () => ({
  scheduledPayments: { id: 'id' },
  paymentVouchers: { id: 'id', scheduledPaymentId: 'scheduledPaymentId' },
  suppliers: { id: 'id' },
}));

vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(true) },
  existsSync: vi.fn().mockReturnValue(true),
}));

// ---- Import Router ----

import treasuryPaymentsRouter from '../../routes/treasury-payments';

// Helper to build mock db method chains
function setupDbSelect(rows: any[]) {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function setupDbSelectMultiple(calls: any[][]) {
  const fromMock = vi.fn();
  calls.forEach((rows) => {
    fromMock.mockReturnValueOnce({ where: vi.fn().mockResolvedValue(rows) });
  });
  mockDb.select.mockReturnValue({ from: fromMock });
}

function setupDbUpdate(rows: any[]) {
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

function setupDbUpdateNoReturning() {
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
}

describe('Treasury Payments Routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(treasuryPaymentsRouter);
    // Set default mock chains so routes that use dynamic imports don't blow up
    setupDbSelect([]);
    setupDbUpdate([]);
    mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  });

  // =====================
  // GET /api/treasury/payments
  // =====================
  describe('GET /api/treasury/payments', () => {
    it('should return all scheduled payments', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, supplier_name: 'Supplier A', amount: 5000, status: 'pending' },
      ]);

      const res = await request(app).get('/api/treasury/payments');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by companyId', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/treasury/payments?companyId=1');

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/treasury/payments?status=pending');

      expect(res.status).toBe(200);
    });

    it('should handle server errors', async () => {
      mockSql.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/treasury/payments');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // POST /api/treasury/payments
  // =====================
  describe('POST /api/treasury/payments', () => {
    it('should create a new scheduled payment', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, supplier_name: 'Supplier A', amount: 5000, status: 'pending' },
      ]);

      const res = await request(app)
        .post('/api/treasury/payments')
        .send({ companyId: 1, supplierName: 'Supplier A', amount: 5000, dueDate: '2025-03-01' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  // =====================
  // DELETE /api/treasury/payments/:id
  // =====================
  describe('DELETE /api/treasury/payments/:id', () => {
    it('should delete a payment', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1 }])  // existing check
        .mockResolvedValueOnce([]);           // delete

      const res = await request(app).delete('/api/treasury/payments/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent payment', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).delete('/api/treasury/payments/999');

      expect(res.status).toBe(404);
    });
  });

  // =====================
  // POST /api/treasury/payments/cleanup-duplicates
  // =====================
  describe('POST /api/treasury/payments/cleanup-duplicates', () => {
    it('should clean up duplicates', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, supplier_name: 'Dup', amount: 100, due_date: '2025-01-01', created_at: '2025-01-02' },
        { id: 2, supplier_name: 'Dup', amount: 100, due_date: '2025-01-01', created_at: '2025-01-01' },
      ]);
      mockSql.mockResolvedValueOnce([]); // delete

      const res = await request(app)
        .post('/api/treasury/payments/cleanup-duplicates')
        .send({ supplierName: 'Dup' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when supplierName is missing', async () => {
      const res = await request(app)
        .post('/api/treasury/payments/cleanup-duplicates')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should report no duplicates found', async () => {
      mockSql.mockResolvedValueOnce([{ id: 1 }]);

      const res = await request(app)
        .post('/api/treasury/payments/cleanup-duplicates')
        .send({ supplierName: 'Unique' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('No se encontraron');
    });
  });

  // =====================
  // PUT /api/treasury/payments/:id/pay
  // =====================
  describe('PUT /api/treasury/payments/:id/pay', () => {
    it('should mark a payment as paid', async () => {
      mockSql.mockResolvedValueOnce([{ id: 1, status: 'paid' }]);

      const res = await request(app).put('/api/treasury/payments/1/pay');

      expect(res.status).toBe(200);
    });

    it('should return 404 when payment not found', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).put('/api/treasury/payments/999/pay');

      expect(res.status).toBe(404);
    });

    it('should return 500 when sql rejects', async () => {
      mockSql.mockRejectedValueOnce(new Error('Connection refused'));

      const res = await request(app).put('/api/treasury/payments/1/pay');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to mark payment as paid');
    });

    it('should return the updated payment object', async () => {
      mockSql.mockResolvedValueOnce([{ id: 5, status: 'paid', paid_at: '2025-03-01', paid_by: 1 }]);

      const res = await request(app).put('/api/treasury/payments/5/pay');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(5);
      expect(res.body.status).toBe('paid');
      expect(res.body.paid_by).toBe(1);
    });
  });

  // =====================
  // GET /api/treasury/payments (additional edge cases)
  // =====================
  describe('GET /api/treasury/payments (additional edge cases)', () => {
    it('should return empty array when no payments exist', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/treasury/payments');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return multiple payments', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, supplier_name: 'A', amount: 100, status: 'pending' },
        { id: 2, supplier_name: 'B', amount: 200, status: 'paid' },
        { id: 3, supplier_name: 'C', amount: 300, status: 'pending' },
      ]);

      const res = await request(app).get('/api/treasury/payments');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('should filter by both companyId and status', async () => {
      mockSql.mockResolvedValueOnce([{ id: 1, status: 'pending' }]);

      const res = await request(app).get('/api/treasury/payments?companyId=2&status=pending');

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalled();
      // Verify the sql was called with params including companyId=2 and status='pending'
      const callArgs = mockSql.mock.calls[0];
      expect(callArgs[1]).toEqual([2, 'pending']);
    });

    it('should return 500 with proper error body', async () => {
      mockSql.mockRejectedValueOnce(new Error('timeout'));

      const res = await request(app).get('/api/treasury/payments');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch payments' });
    });
  });

  // =====================
  // POST /api/treasury/payments (additional cases)
  // =====================
  describe('POST /api/treasury/payments (additional cases)', () => {
    it('should return 500 when sql insert fails', async () => {
      mockSql.mockRejectedValueOnce(new Error('constraint violation'));

      const res = await request(app)
        .post('/api/treasury/payments')
        .send({ companyId: 1, supplierName: 'Supplier', amount: 500, dueDate: '2025-04-01' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create payment');
    });

    it('should use default currency MXN and status pending', async () => {
      mockSql.mockResolvedValueOnce([{ id: 2, currency: 'MXN', status: 'pending' }]);

      const res = await request(app)
        .post('/api/treasury/payments')
        .send({ companyId: 1, supplierName: 'Supplier', amount: 500, dueDate: '2025-04-01' });

      expect(res.status).toBe(201);
      // Verify the sql was called with default values
      const callArgs = mockSql.mock.calls[0];
      expect(callArgs[1][3]).toBe('MXN'); // currency defaults to MXN
      expect(callArgs[1][5]).toBe('pending'); // status defaults to pending
    });

    it('should accept custom currency and status', async () => {
      mockSql.mockResolvedValueOnce([{ id: 3, currency: 'USD', status: 'approved' }]);

      const res = await request(app)
        .post('/api/treasury/payments')
        .send({
          companyId: 1,
          supplierName: 'Supplier',
          amount: 1000,
          dueDate: '2025-04-01',
          currency: 'USD',
          status: 'approved',
          reference: 'INV-001',
          notes: 'Urgent payment',
        });

      expect(res.status).toBe(201);
      const callArgs = mockSql.mock.calls[0];
      expect(callArgs[1][3]).toBe('USD');
      expect(callArgs[1][5]).toBe('approved');
      expect(callArgs[1][6]).toBe('INV-001');
      expect(callArgs[1][7]).toBe('Urgent payment');
    });
  });

  // =====================
  // DELETE /api/treasury/payments/:id (additional cases)
  // =====================
  describe('DELETE /api/treasury/payments/:id (additional cases)', () => {
    it('should return 500 when existence check sql fails', async () => {
      mockSql.mockRejectedValueOnce(new Error('connection error'));

      const res = await request(app).delete('/api/treasury/payments/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete payment');
    });

    it('should return 500 when delete sql fails', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 1 }])  // exists
        .mockRejectedValueOnce(new Error('FK constraint')); // delete fails

      const res = await request(app).delete('/api/treasury/payments/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete payment');
    });

    it('should return success message with correct structure', async () => {
      mockSql
        .mockResolvedValueOnce([{ id: 5 }])
        .mockResolvedValueOnce([]);

      const res = await request(app).delete('/api/treasury/payments/5');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Pago eliminado correctamente' });
    });
  });

  // =====================
  // POST /api/treasury/payments/cleanup-duplicates (additional cases)
  // =====================
  describe('POST /api/treasury/payments/cleanup-duplicates (additional cases)', () => {
    it('should return 500 when sql rejects', async () => {
      mockSql.mockRejectedValueOnce(new Error('DB unavailable'));

      const res = await request(app)
        .post('/api/treasury/payments/cleanup-duplicates')
        .send({ supplierName: 'Test' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to cleanup duplicates');
    });

    it('should handle three or more duplicates, keeping only the most recent', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 3, supplier_name: 'Dup', amount: 100, due_date: '2025-01-01', created_at: '2025-01-03' },
        { id: 2, supplier_name: 'Dup', amount: 100, due_date: '2025-01-01', created_at: '2025-01-02' },
        { id: 1, supplier_name: 'Dup', amount: 100, due_date: '2025-01-01', created_at: '2025-01-01' },
      ]);
      mockSql.mockResolvedValueOnce([]); // delete id=2
      mockSql.mockResolvedValueOnce([]); // delete id=1

      const res = await request(app)
        .post('/api/treasury/payments/cleanup-duplicates')
        .send({ supplierName: 'Dup' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.kept.id).toBe(3);
      expect(res.body.deleted).toEqual([2, 1]);
    });

    it('should return no duplicates when only one record found', async () => {
      mockSql.mockResolvedValueOnce([
        { id: 1, supplier_name: 'Solo', amount: 500, due_date: '2025-01-01', created_at: '2025-01-01' },
      ]);

      const res = await request(app)
        .post('/api/treasury/payments/cleanup-duplicates')
        .send({ supplierName: 'Solo' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.message).toContain('No se encontraron');
    });

    it('should return no duplicates when no records found', async () => {
      mockSql.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/treasury/payments/cleanup-duplicates')
        .send({ supplierName: 'Ghost' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  // =====================
  // POST /api/treasury/payments/repair-voucher-links
  // =====================
  describe('POST /api/treasury/payments/repair-voucher-links', () => {
    it('should repair unlinked vouchers', async () => {
      // Setup: db.select returns vouchers with scheduledPaymentId
      const vouchersWithPayments = [
        { id: 10, scheduledPaymentId: 100 },
        { id: 20, scheduledPaymentId: 200 },
      ];

      // First call: select vouchers with scheduledPaymentId (isNotNull)
      const selectFromWhereMock = vi.fn()
        // First call for initial query of vouchers
        .mockResolvedValueOnce(vouchersWithPayments)
        // Second call: check payment 100 -> voucherId is null (needs repair)
        .mockResolvedValueOnce([{ id: 100, voucherId: null }])
        // Third call: check payment 200 -> voucherId already matches
        .mockResolvedValueOnce([{ id: 200, voucherId: 20 }]);

      const selectFromMock = vi.fn().mockReturnValue({ where: selectFromWhereMock });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      // Setup update for the repair
      const updateWhereMock = vi.fn().mockResolvedValue([]);
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      mockDb.update.mockReturnValue({ set: updateSetMock });

      const res = await request(app)
        .post('/api/treasury/payments/repair-voucher-links');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.totalVouchers).toBe(2);
      expect(res.body.stats.repaired).toBe(1);
      expect(res.body.stats.alreadyLinked).toBe(1);
    });

    it('should report when no vouchers have scheduledPaymentId', async () => {
      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app)
        .post('/api/treasury/payments/repair-voucher-links');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.totalVouchers).toBe(0);
      expect(res.body.stats.repaired).toBe(0);
    });

    it('should handle errors when payment not found for voucher', async () => {
      const vouchersWithPayments = [
        { id: 10, scheduledPaymentId: 999 },
      ];

      const selectFromWhereMock = vi.fn()
        .mockResolvedValueOnce(vouchersWithPayments)
        // Payment 999 not found
        .mockResolvedValueOnce([]);

      const selectFromMock = vi.fn().mockReturnValue({ where: selectFromWhereMock });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app)
        .post('/api/treasury/payments/repair-voucher-links');

      expect(res.status).toBe(200);
      expect(res.body.stats.errors).toBe(1);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]).toContain('999');
    });

    it('should return 500 when db query fails', async () => {
      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB crashed')),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app)
        .post('/api/treasury/payments/repair-voucher-links');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to repair voucher links');
    });
  });

  // =====================
  // POST /api/scheduled-payments/confirm
  // =====================
  describe('POST /api/scheduled-payments/confirm', () => {
    const validConfirmBody = {
      payerCompanyId: 1,
      supplierId: 5,
      supplierName: 'Proveedor ABC',
      amount: 15000,
      currency: 'MXN',
      dueDate: '2025-04-15',
      paymentDate: '2025-04-10',
      reference: 'INV-2025-001',
      notes: 'Monthly supply',
      invoiceFilePath: '/tmp/uploads/invoice.pdf',
      invoiceFileName: 'factura-abril.pdf',
    };

    it('should create a scheduled payment and voucher', async () => {
      const createdPayment = { id: 50, ...validConfirmBody, status: 'idrall_imported' };
      const createdVoucher = { id: 100, scheduledPaymentId: 50, status: 'pago_programado' };

      mockStorage.createScheduledPayment.mockResolvedValueOnce(createdPayment);
      mockStorage.createPaymentVoucher.mockResolvedValueOnce(createdVoucher);

      // db.update for setting hydralFileUrl
      const updateWhereMock = vi.fn().mockResolvedValue([]);
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      mockDb.update.mockReturnValue({ set: updateSetMock });

      // db.select for fetching updated payment
      const updatedPayment = { id: 50, supplierName: 'Proveedor ABC', amount: 15000, hydralFileUrl: '/uploads/test.pdf' };
      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([updatedPayment]),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(validConfirmBody);

      expect(res.status).toBe(201);
      expect(res.body.scheduledPayment).toBeDefined();
      expect(res.body.paymentVoucher).toBeDefined();
      expect(res.body.message).toContain('exitosamente');
      expect(mockStorage.createScheduledPayment).toHaveBeenCalled();
      expect(mockStorage.createPaymentVoucher).toHaveBeenCalled();
    });

    it('should return 400 when payerCompanyId is missing', async () => {
      const body = { ...validConfirmBody };
      delete (body as any).payerCompanyId;

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 400 when supplierName is empty', async () => {
      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send({ ...validConfirmBody, supplierName: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 400 when amount is negative', async () => {
      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send({ ...validConfirmBody, amount: -100 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 400 when amount is zero', async () => {
      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send({ ...validConfirmBody, amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 400 when invoiceFilePath is missing', async () => {
      const body = { ...validConfirmBody };
      delete (body as any).invoiceFilePath;

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 400 when invoiceFileName is missing', async () => {
      const body = { ...validConfirmBody };
      delete (body as any).invoiceFileName;

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 400 when dueDate is missing', async () => {
      const body = { ...validConfirmBody };
      delete (body as any).dueDate;

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 400 when paymentDate is missing', async () => {
      const body = { ...validConfirmBody };
      delete (body as any).paymentDate;

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 500 when storage.createScheduledPayment fails', async () => {
      mockStorage.createScheduledPayment.mockRejectedValueOnce(new Error('DB write failed'));

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(validConfirmBody);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error al confirmar cuenta por pagar');
    });

    it('should accept nullable supplierId', async () => {
      const body = { ...validConfirmBody, supplierId: null };
      const createdPayment = { id: 51, ...body, status: 'idrall_imported' };
      const createdVoucher = { id: 101, scheduledPaymentId: 51, status: 'pago_programado' };

      mockStorage.createScheduledPayment.mockResolvedValueOnce(createdPayment);
      mockStorage.createPaymentVoucher.mockResolvedValueOnce(createdVoucher);

      const updateWhereMock = vi.fn().mockResolvedValue([]);
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      mockDb.update.mockReturnValue({ set: updateSetMock });

      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 51, supplierName: 'Proveedor ABC' }]),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(body);

      expect(res.status).toBe(201);
    });

    it('should default currency to MXN when not provided', async () => {
      const body = { ...validConfirmBody };
      delete (body as any).currency;

      const createdPayment = { id: 52, status: 'idrall_imported' };
      const createdVoucher = { id: 102, status: 'pago_programado' };

      mockStorage.createScheduledPayment.mockResolvedValueOnce(createdPayment);
      mockStorage.createPaymentVoucher.mockResolvedValueOnce(createdVoucher);

      const updateWhereMock = vi.fn().mockResolvedValue([]);
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      mockDb.update.mockReturnValue({ set: updateSetMock });

      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 52 }]),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app)
        .post('/api/scheduled-payments/confirm')
        .send(body);

      expect(res.status).toBe(201);
      // Verify createScheduledPayment was called with currency: 'MXN'
      const callArgs = mockStorage.createScheduledPayment.mock.calls[0][0];
      expect(callArgs.currency).toBe('MXN');
    });
  });

  // =====================
  // GET /api/scheduled-payments/:id/documents
  // =====================
  describe('GET /api/scheduled-payments/:id/documents', () => {
    it('should return payment details and empty documents when no files', async () => {
      const payment = {
        id: 10,
        supplierName: 'Proveedor X',
        amount: 5000,
        currency: 'MXN',
        dueDate: '2025-04-01',
        paymentDate: '2025-04-01',
        status: 'pending',
        reference: 'REF-1',
        notes: null,
        sourceType: 'manual',
        createdAt: '2025-01-01',
        hydralFileUrl: null,
        hydralFileName: null,
        voucherId: null,
      };

      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([payment]),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app).get('/api/scheduled-payments/10/documents');

      expect(res.status).toBe(200);
      expect(res.body.scheduledPaymentId).toBe(10);
      expect(res.body.payment.supplierName).toBe('Proveedor X');
      expect(res.body.documents).toEqual([]);
    });

    it('should return 404 when payment not found', async () => {
      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app).get('/api/scheduled-payments/999/documents');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrada');
    });

    it('should return invoice document when hydralFileUrl exists', async () => {
      const payment = {
        id: 10,
        supplierName: 'Proveedor Y',
        amount: 3000,
        currency: 'MXN',
        dueDate: '2025-04-01',
        paymentDate: '2025-04-01',
        status: 'pending',
        reference: null,
        notes: null,
        sourceType: 'manual',
        createdAt: '2025-01-01',
        hydralFileUrl: '/uploads/factura.pdf',
        hydralFileName: 'factura.pdf',
        voucherId: null,
      };

      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([payment]),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app).get('/api/scheduled-payments/10/documents');

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].type).toBe('invoice');
      expect(res.body.documents[0].name).toBe('factura.pdf');
    });

    it('should return invoice and voucher documents when both exist', async () => {
      const payment = {
        id: 10,
        supplierName: 'Proveedor Z',
        amount: 8000,
        currency: 'MXN',
        dueDate: '2025-04-01',
        paymentDate: '2025-04-01',
        status: 'payment_completed',
        reference: null,
        notes: null,
        sourceType: 'manual',
        createdAt: '2025-01-01',
        hydralFileUrl: '/uploads/factura.pdf',
        hydralFileName: 'factura.pdf',
        voucherId: 20,
      };

      const voucher = {
        id: 20,
        voucherFileName: 'comprobante.pdf',
        voucherFileUrl: '/uploads/comprobante.pdf',
        createdAt: '2025-02-01',
        extractedAmount: 8000,
        extractedDate: '2025-01-15',
        extractedBank: 'BBVA',
        extractedReference: 'REF-XYZ',
        complementFileUrl: null,
        complementFileName: null,
        updatedAt: '2025-02-01',
      };

      const selectFromWhereMock = vi.fn()
        .mockResolvedValueOnce([payment])   // first select: payment
        .mockResolvedValueOnce([voucher]);  // second select: voucher

      const selectFromMock = vi.fn().mockReturnValue({ where: selectFromWhereMock });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app).get('/api/scheduled-payments/10/documents');

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(2);
      expect(res.body.documents[0].type).toBe('invoice');
      expect(res.body.documents[1].type).toBe('voucher');
      expect(res.body.documents[1].extractedAmount).toBe(8000);
    });

    it('should include REP document when voucher has complement', async () => {
      const payment = {
        id: 10,
        supplierName: 'Proveedor REP',
        amount: 12000,
        currency: 'MXN',
        dueDate: '2025-04-01',
        paymentDate: '2025-04-01',
        status: 'closed',
        reference: null,
        notes: null,
        sourceType: 'manual',
        createdAt: '2025-01-01',
        hydralFileUrl: '/uploads/factura.pdf',
        hydralFileName: 'factura.pdf',
        voucherId: 30,
      };

      const voucher = {
        id: 30,
        voucherFileName: 'comprobante.pdf',
        voucherFileUrl: '/uploads/comprobante.pdf',
        createdAt: '2025-02-01',
        extractedAmount: 12000,
        extractedDate: '2025-01-20',
        extractedBank: 'Santander',
        extractedReference: 'REF-ABC',
        complementFileUrl: '/uploads/rep.xml',
        complementFileName: 'complemento.xml',
        updatedAt: '2025-03-01',
      };

      const selectFromWhereMock = vi.fn()
        .mockResolvedValueOnce([payment])
        .mockResolvedValueOnce([voucher]);

      const selectFromMock = vi.fn().mockReturnValue({ where: selectFromWhereMock });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app).get('/api/scheduled-payments/10/documents');

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(3);
      expect(res.body.documents[0].type).toBe('invoice');
      expect(res.body.documents[1].type).toBe('voucher');
      expect(res.body.documents[2].type).toBe('rep');
      expect(res.body.documents[2].name).toBe('complemento.xml');
    });

    it('should return 500 when db query fails', async () => {
      const selectFromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB error')),
      });
      mockDb.select.mockReturnValue({ from: selectFromMock });

      const res = await request(app).get('/api/scheduled-payments/5/documents');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error al obtener documentos');
    });
  });

  // =====================
  // PUT /api/scheduled-payments/:id/status
  // =====================
  describe('PUT /api/scheduled-payments/:id/status', () => {
    it('should update status to approved', async () => {
      const updated = { id: 1, status: 'approved', updatedAt: new Date() };

      const returningMock = vi.fn().mockResolvedValue([updated]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      mockDb.update.mockReturnValue({ set: setMock });

      const res = await request(app)
        .put('/api/scheduled-payments/1/status')
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
    });

    it('should accept all valid status values', async () => {
      const validStatuses = [
        'idrall_imported',
        'pending_approval',
        'approved',
        'payment_scheduled',
        'payment_pending',
        'payment_completed',
        'voucher_uploaded',
        'closed',
      ];

      for (const status of validStatuses) {
        vi.clearAllMocks();
        const updated = { id: 1, status };

        const returningMock = vi.fn().mockResolvedValue([updated]);
        const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
        const setMock = vi.fn().mockReturnValue({ where: whereMock });
        mockDb.update.mockReturnValue({ set: setMock });

        const res = await request(app)
          .put('/api/scheduled-payments/1/status')
          .send({ status });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
    });

    it('should return 400 for invalid status value', async () => {
      const res = await request(app)
        .put('/api/scheduled-payments/1/status')
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
      expect(res.body.details).toBeDefined();
    });

    it('should return 400 when status field is missing', async () => {
      const res = await request(app)
        .put('/api/scheduled-payments/1/status')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validación fallida');
    });

    it('should return 404 when payment not found', async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      mockDb.update.mockReturnValue({ set: setMock });

      const res = await request(app)
        .put('/api/scheduled-payments/999/status')
        .send({ status: 'approved' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrada');
    });

    it('should return 500 when db update fails', async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('DB write error')),
        }),
      });
      mockDb.update.mockReturnValue({ set: setMock });

      const res = await request(app)
        .put('/api/scheduled-payments/1/status')
        .send({ status: 'approved' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error al actualizar estado');
    });
  });
});
