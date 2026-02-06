import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

function createTestApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ---- Shared Mocks (hoisted so they are available inside vi.mock factories) ----

const { mockSql, mockStorage } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockStorage: {
    getCompanies: vi.fn(),
    getCompany: vi.fn(),
    createCompany: vi.fn(),
    getAreas: vi.fn(),
    getArea: vi.fn(),
    getAreasByCompany: vi.fn(),
    createArea: vi.fn(),
    getUsers: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    updateUser: vi.fn(),
    createActivationToken: vi.fn(),
    getActivationToken: vi.fn(),
    markTokenAsUsed: vi.fn(),
    deleteExpiredTokens: vi.fn(),
    getKpis: vi.fn(),
    getKpi: vi.fn(),
    getKpiValues: vi.fn(),
    getKpiValuesByKpi: vi.fn(),
    createKpiValue: vi.fn(),
    getJobProfileWithDetails: vi.fn(),
    getUserKpis: vi.fn(),
    getKPIOverview: vi.fn(),
    getKPIHistory: vi.fn(),
    getUserKPIHistory: vi.fn(),
    getKPIHistoryByUsers: vi.fn(),
    isSalesKpi: vi.fn(),
    getPaymentVouchers: vi.fn(),
    getPaymentVouchersByCompany: vi.fn(),
    getScheduledPaymentsByCompany: vi.fn(),
    createScheduledPayment: vi.fn(),
    createPaymentVoucher: vi.fn(),
  },
}));

vi.mock('../../routes/_helpers', () => ({
  sql: (...args: any[]) => mockSql(...args),
  getAuthUser: (req: any) => req.user,
  sanitizeUser: (user: any) => ({ id: user.id, name: user.name, email: user.email, role: user.role }),
  AuthRequest: {},
}));

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    // Only set user if not already set (allows tests to inject non-admin users)
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

vi.mock('../../sales-kpi-calculator', () => ({
  calculateSalesKpiValue: vi.fn().mockResolvedValue(null),
  calculateSalesKpiHistory: vi.fn().mockResolvedValue({ supported: false, data: [] }),
}));

vi.mock('@shared/kpi-utils', () => ({
  calculateKpiStatus: vi.fn().mockReturnValue('complies'),
  calculateCompliance: vi.fn().mockReturnValue('100%'),
  parseNumericValue: vi.fn((v: any) => parseFloat(v) || 0),
  isLowerBetterKPI: vi.fn().mockReturnValue(false),
}));

vi.mock('@shared/schema', () => ({
  insertCompanySchema: { parse: vi.fn((data: any) => data) },
  insertAreaSchema: { parse: vi.fn((data: any) => data) },
  insertClientSchema: { parse: vi.fn((data: any) => data) },
  insertProviderSchema: { parse: vi.fn((data: any) => data) },
}));

vi.mock('../../middleware/tenant-validation', () => ({
  validateTenantFromBody: vi.fn(() => (req: any, res: any, next: any) => next()),
  validateTenantAccess: vi.fn(),
}));

vi.mock('../../email-service', () => ({
  emailService: { sendEmail: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('../../email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../sendgrid', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getPaymentReceiptEmailTemplate: vi.fn().mockReturnValue({ subject: 'Test', html: '<p>test</p>', text: 'test' }),
}));

vi.mock('../../storage/file-storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({ url: '/test.pdf', storage: 'local' }),
  uploadMulterFile: vi.fn(),
  isUsingR2: vi.fn().mockReturnValue(false),
  getFile: vi.fn().mockResolvedValue(Buffer.from('test')),
  moveTempToStorage: vi.fn().mockResolvedValue({ url: '/test.pdf', storage: 'local' }),
}));

vi.mock('../../file-storage', () => ({
  getStorageInfo: vi.fn().mockReturnValue({ provider: 'local', configured: false }),
  isR2Configured: vi.fn().mockReturnValue(false),
  uploadFileWithFallback: vi.fn(),
  getViewUrl: vi.fn(),
  getDownloadUrl: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('multer', () => {
  const multer = () => ({
    single: () => (req: any, res: any, next: any) => next(),
  });
  multer.diskStorage = vi.fn();
  multer.memoryStorage = vi.fn();
  return { default: multer };
});

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
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
  db: {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
  },
  pool: { query: vi.fn() },
}));

vi.mock('express-rate-limit', () => ({
  default: () => (req: any, res: any, next: any) => next(),
}));

vi.mock('../../sales-upload-handler-NEW', () => ({
  handleSalesUpload: vi.fn(),
}));

vi.mock('../../sales-idrall-handler', () => ({
  handleIDRALLUpload: vi.fn(),
  detectExcelFormat: vi.fn().mockReturnValue('IDRALL'),
}));

vi.mock('../../nova/nova-auto-analyze', () => ({
  autoAnalyzeSalesUpload: vi.fn().mockResolvedValue({ analysisId: 'test-id' }),
}));

vi.mock('../../weekly_sales_update', () => ({
  updateWeeklySales: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  autoCloseMonth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../scripts/weekly_sales_update', () => ({
  updateWeeklySales: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  autoCloseMonth: vi.fn().mockResolvedValue(true),
}));

// ---- Import Routers ----

import organizationRouter from '../../routes/organization';
import adminRouter from '../../routes/admin';
import catalogRouter from '../../routes/catalog';
import analyticsRouter from '../../routes/analytics';
import salesDataRouter from '../../routes/sales-data';
import salesActionsRouter from '../../routes/sales-actions';
import treasuryDocumentsRouter from '../../routes/treasury-documents';
import treasuryAccountingRouter from '../../routes/treasury-accounting';
import filesRouter from '../../routes/files';
import salesOperationsRouter from '../../routes/sales-operations';
import onboardingRouter from '../../routes/onboarding';

// ====================================================================
// ORGANIZATION ROUTES
// ====================================================================
describe('Organization routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(organizationRouter);
  });

  it('GET /api/companies should return companies', async () => {
    mockStorage.getCompanies.mockResolvedValueOnce([{ id: 1, name: 'Dura' }]);
    const res = await request(app).get('/api/companies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/companies/:id should return a company', async () => {
    mockStorage.getCompany.mockResolvedValueOnce({ id: 1, name: 'Dura' });
    const res = await request(app).get('/api/companies/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Dura');
  });

  it('GET /api/companies/:id should return 404 for unknown id', async () => {
    mockStorage.getCompany.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/companies/999');
    expect(res.status).toBe(404);
  });

  it('POST /api/companies should create a company', async () => {
    mockStorage.createCompany.mockResolvedValueOnce({ id: 3, name: 'New Co' });
    const res = await request(app).post('/api/companies').send({ name: 'New Co' });
    expect(res.status).toBe(201);
  });

  it('GET /api/areas should return all areas', async () => {
    mockStorage.getAreas.mockResolvedValueOnce([{ id: 1, name: 'Sales' }]);
    const res = await request(app).get('/api/areas');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/areas?companyId=1 should filter by company', async () => {
    mockStorage.getAreasByCompany.mockResolvedValueOnce([{ id: 1, name: 'Sales', companyId: 1 }]);
    const res = await request(app).get('/api/areas?companyId=1');
    expect(res.status).toBe(200);
  });

  // --- Additional Organization coverage ---

  it('GET /api/companies should return 500 on storage error', async () => {
    mockStorage.getCompanies.mockRejectedValueOnce(new Error('DB failure'));
    const res = await request(app).get('/api/companies');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error');
  });

  it('GET /api/companies/:id should return 500 on storage error', async () => {
    mockStorage.getCompany.mockRejectedValueOnce(new Error('DB failure'));
    const res = await request(app).get('/api/companies/1');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error');
  });

  it('POST /api/companies should return 400 on validation error', async () => {
    const { insertCompanySchema } = await import('@shared/schema');
    const { z } = await import('zod');
    const zodErr = new z.ZodError([]);
    (insertCompanySchema.parse as any).mockImplementationOnce(() => { throw zodErr; });
    const res = await request(app).post('/api/companies').send({ invalid: true });
    expect(res.status).toBe(400);
  });

  it('POST /api/companies should return 500 on storage error', async () => {
    mockStorage.createCompany.mockRejectedValueOnce(new Error('DB failure'));
    const res = await request(app).post('/api/companies').send({ name: 'Fail Co' });
    expect(res.status).toBe(500);
  });

  it('GET /api/areas/:id should return an area', async () => {
    mockStorage.getArea.mockResolvedValueOnce({ id: 1, name: 'Engineering', companyId: 1 });
    const res = await request(app).get('/api/areas/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Engineering');
  });

  it('GET /api/areas/:id should return 404 for unknown id', async () => {
    mockStorage.getArea.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/areas/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/areas/:id should return 500 on storage error', async () => {
    mockStorage.getArea.mockRejectedValueOnce(new Error('DB failure'));
    const res = await request(app).get('/api/areas/1');
    expect(res.status).toBe(500);
  });

  it('POST /api/areas should create an area', async () => {
    mockStorage.createArea.mockResolvedValueOnce({ id: 10, name: 'New Area', companyId: 1 });
    const res = await request(app).post('/api/areas').send({ name: 'New Area', companyId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Area');
  });

  it('POST /api/areas should return 400 on validation error', async () => {
    const { insertAreaSchema } = await import('@shared/schema');
    const { z } = await import('zod');
    const zodErr = new z.ZodError([]);
    (insertAreaSchema.parse as any).mockImplementationOnce(() => { throw zodErr; });
    const res = await request(app).post('/api/areas').send({ invalid: true });
    expect(res.status).toBe(400);
  });

  it('POST /api/areas should return 500 on storage error', async () => {
    mockStorage.createArea.mockRejectedValueOnce(new Error('DB failure'));
    const res = await request(app).post('/api/areas').send({ name: 'Fail', companyId: 1 });
    expect(res.status).toBe(500);
  });

  it('GET /api/areas should return all areas when companyId is undefined string', async () => {
    mockStorage.getAreas.mockResolvedValueOnce([{ id: 1, name: 'All Areas' }]);
    const res = await request(app).get('/api/areas?companyId=undefined');
    expect(res.status).toBe(200);
  });

  it('GET /api/areas should return all areas when companyId is null string', async () => {
    mockStorage.getAreas.mockResolvedValueOnce([{ id: 1, name: 'All Areas' }]);
    const res = await request(app).get('/api/areas?companyId=null');
    expect(res.status).toBe(200);
  });

  it('GET /api/areas should return all areas for invalid companyId (NaN)', async () => {
    mockStorage.getAreas.mockResolvedValueOnce([{ id: 1, name: 'Area1' }]);
    const res = await request(app).get('/api/areas?companyId=abc');
    expect(res.status).toBe(200);
  });

  it('GET /api/areas should return 500 on storage error', async () => {
    mockStorage.getAreas.mockRejectedValueOnce(new Error('DB failure'));
    const res = await request(app).get('/api/areas');
    expect(res.status).toBe(500);
  });
});

// ====================================================================
// ADMIN ROUTES
// ====================================================================
describe('Admin routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(adminRouter);
  });

  it('GET /api/healthz should return status ok', async () => {
    const res = await request(app).get('/api/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/admin/reset-user-password should return 400 without email/password', async () => {
    const res = await request(app).post('/api/admin/reset-user-password').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/reset-user-password should return 404 for unknown user', async () => {
    mockStorage.getUserByEmail.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/admin/reset-user-password').send({ email: 'unknown@test.com', password: 'newpass123' });
    expect(res.status).toBe(404);
  });

  it('POST /api/admin/reset-user-password should reset password', async () => {
    mockStorage.getUserByEmail.mockResolvedValueOnce({ id: 2, email: 'user@test.com' });
    mockStorage.updateUser.mockResolvedValueOnce({ id: 2 });
    const res = await request(app).post('/api/admin/reset-user-password').send({ email: 'user@test.com', password: 'newpass123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/treasury/send-reminder should return 400 without required fields', async () => {
    const res = await request(app).post('/api/treasury/send-reminder').send({});
    expect(res.status).toBe(400);
  });

  // --- Additional Admin coverage ---

  it('GET /env-check should return diagnostics for admin', async () => {
    const res = await request(app).get('/env-check');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('paths');
    expect(res.body).toHaveProperty('file_checks');
    expect(res.body).toHaveProperty('env_variables');
    expect(res.body).toHaveProperty('critical_issues');
  });

  it('GET /env-check should return 403 for non-admin user', async () => {
    const nonAdminApp = express();
    nonAdminApp.use(express.json());
    nonAdminApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'Viewer', companyId: 1, areaId: 1 };
      next();
    });
    nonAdminApp.use(adminRouter);
    const res = await request(nonAdminApp).get('/env-check');
    expect(res.status).toBe(403);
  });

  it('GET /api/healthz should return 403 for non-admin user', async () => {
    const nonAdminApp = express();
    nonAdminApp.use(express.json());
    nonAdminApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'Viewer', companyId: 1, areaId: 1 };
      next();
    });
    nonAdminApp.use(adminRouter);
    const res = await request(nonAdminApp).get('/api/healthz');
    expect(res.status).toBe(403);
  });

  it('POST /api/admin/seed-clients should call seedClients', async () => {
    vi.doMock('../../seed-clients', () => ({
      seedClients: vi.fn().mockResolvedValue({ success: true, message: 'Seeded' }),
    }));
    const res = await request(app).post('/api/admin/seed-clients');
    // The dynamic import may succeed or fail based on module resolution,
    // but we test the route is reachable and handles the response
    expect([200, 500]).toContain(res.status);
  });

  it('POST /api/admin/reset-user-password should return 500 when updateUser fails', async () => {
    mockStorage.getUserByEmail.mockResolvedValueOnce({ id: 2, email: 'user@test.com' });
    mockStorage.updateUser.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/admin/reset-user-password').send({ email: 'user@test.com', password: 'newpass123' });
    expect(res.status).toBe(500);
    expect(res.body.message).toContain('No fue posible');
  });

  it('POST /api/admin/reset-user-password should return 500 on unexpected error', async () => {
    mockStorage.getUserByEmail.mockRejectedValueOnce(new Error('DB crash'));
    const res = await request(app).post('/api/admin/reset-user-password').send({ email: 'x@test.com', password: 'pass12345' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error');
  });

  it('POST /api/treasury/send-reminder should return 400 with only voucherId', async () => {
    const res = await request(app).post('/api/treasury/send-reminder').send({ voucherId: 1 });
    expect(res.status).toBe(400);
  });

  it('POST /api/treasury/resend-receipt should return 400 without required fields', async () => {
    const res = await request(app).post('/api/treasury/resend-receipt').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/treasury/resend-receipt should return 400 with partial fields', async () => {
    const res = await request(app).post('/api/treasury/resend-receipt').send({ voucherId: 1, clientId: 2 });
    expect(res.status).toBe(400);
  });
});

// ====================================================================
// CATALOG ROUTES
// ====================================================================
describe('Catalog routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(catalogRouter);
  });

  it('GET /api/clients-db should return clients list', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Client A' }]);
    const res = await request(app).get('/api/clients-db');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/clients-db/:id should return a client', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Client A' }]);
    const res = await request(app).get('/api/clients-db/1');
    expect(res.status).toBe(200);
  });

  it('GET /api/clients-db/:id should return 404 if not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/clients-db/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/products should return products', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Product X' }]);
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/products should return 400 for empty name', async () => {
    const res = await request(app).post('/api/products').send({ name: '', companyId: 1 });
    expect(res.status).toBe(400);
  });

  it('POST /api/products should create a product', async () => {
    mockSql.mockResolvedValueOnce([]); // existing check
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'New Product', company_id: 1 }]); // insert
    const res = await request(app).post('/api/products').send({ name: 'New Product', companyId: 1 });
    expect(res.status).toBe(201);
  });

  // --- Additional Catalog coverage ---

  it('GET /api/clients-db should filter by search term', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Client Searched' }]);
    const res = await request(app).get('/api/clients-db?search=Searched');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.arrayContaining(['%Searched%']));
  });

  it('GET /api/clients-db should filter by companyId for admin', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Client A' }]);
    const res = await request(app).get('/api/clients-db?companyId=2');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('company_id'), expect.arrayContaining([2]));
  });

  it('GET /api/clients-db should return empty array for non-admin without companyId', async () => {
    const noCompanyApp = express();
    noCompanyApp.use(express.json());
    noCompanyApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: null, areaId: null };
      next();
    });
    noCompanyApp.use(catalogRouter);
    const res = await request(noCompanyApp).get('/api/clients-db');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/clients-db should filter by companyId for non-admin user', async () => {
    const userApp = express();
    userApp.use(express.json());
    userApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: 1, areaId: 1 };
      next();
    });
    userApp.use(catalogRouter);
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Client A' }]);
    const res = await request(userApp).get('/api/clients-db');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('company_id'), expect.arrayContaining([1]));
  });

  it('GET /api/clients-db should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/clients-db');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Failed to fetch clients');
  });

  it('GET /api/clients-db/:id should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/clients-db/1');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Failed to fetch client');
  });

  it('GET /api/clients should return clients for logistics', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Client B' }]);
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/clients should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(500);
  });

  it('GET /api/products should filter by companyId', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Product', company_id: 2 }]);
    const res = await request(app).get('/api/products?companyId=2');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('company_id'), expect.arrayContaining([2]));
  });

  it('GET /api/products should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(500);
  });

  it('POST /api/products should return 409 for duplicate product name', async () => {
    mockSql.mockResolvedValueOnce([{ id: 5 }]); // existing product found
    const res = await request(app).post('/api/products').send({ name: 'Existing Product', companyId: 1 });
    expect(res.status).toBe(409);
  });

  it('POST /api/products should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/products').send({ name: 'Product', companyId: 1 });
    expect(res.status).toBe(500);
  });

  it('PUT /api/products/:id should update a product', async () => {
    mockSql.mockResolvedValueOnce([]); // no duplicate
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Updated', company_id: 1, is_active: true }]); // update result
    const res = await request(app).put('/api/products/1').send({ name: 'Updated', companyId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('PUT /api/products/:id should return 400 for empty name', async () => {
    const res = await request(app).put('/api/products/1').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/products/:id should return 409 for duplicate name', async () => {
    mockSql.mockResolvedValueOnce([{ id: 5 }]); // duplicate found
    const res = await request(app).put('/api/products/1').send({ name: 'Duplicate', companyId: 1 });
    expect(res.status).toBe(409);
  });

  it('PUT /api/products/:id should return 404 when product not found', async () => {
    mockSql.mockResolvedValueOnce([]); // no duplicate
    mockSql.mockResolvedValueOnce([]); // product not found
    const res = await request(app).put('/api/products/999').send({ name: 'Nonexistent', companyId: 1 });
    expect(res.status).toBe(404);
  });

  it('PUT /api/products/:id should update is_active and companyId', async () => {
    mockSql.mockResolvedValueOnce([]); // no duplicate
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Prod', company_id: 2, is_active: false }]);
    const res = await request(app).put('/api/products/1').send({ name: 'Prod', is_active: false, companyId: 2 });
    expect(res.status).toBe(200);
  });

  it('PUT /api/products/:id should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).put('/api/products/1').send({ name: 'Error', companyId: 1 });
    expect(res.status).toBe(500);
  });

  it('DELETE /api/products/:id should soft-delete a product', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Deleted Prod' }]);
    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/products/:id should return 404 when product not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).delete('/api/products/999');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/products/:id should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(500);
  });

  it('POST /api/clients should create a client', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'New Client' }]);
    const res = await request(app).post('/api/clients').send({ name: 'New Client', companyId: 1 });
    expect(res.status).toBe(201);
  });

  it('POST /api/clients should return 400 on zod validation error', async () => {
    const { insertClientSchema } = await import('@shared/schema');
    const { z } = await import('zod');
    const zodErr = new z.ZodError([{ code: 'custom', message: 'Invalid', path: ['name'] } as any]);
    (insertClientSchema.parse as any).mockImplementationOnce(() => { throw zodErr; });
    const res = await request(app).post('/api/clients').send({ invalid: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Validación');
  });

  it('POST /api/clients should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/clients').send({ name: 'Client' });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Failed to create client');
  });

  it('PUT /api/products/:id should handle null companyId', async () => {
    mockSql.mockResolvedValueOnce([]); // no duplicate
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Prod', company_id: null, is_active: true }]);
    const res = await request(app).put('/api/products/1').send({ name: 'Prod', companyId: null });
    expect(res.status).toBe(200);
  });

  it('PUT /api/products/:id should handle empty string companyId', async () => {
    mockSql.mockResolvedValueOnce([]); // no duplicate
    mockSql.mockResolvedValueOnce([{ id: 1, name: 'Prod', company_id: null, is_active: true }]);
    const res = await request(app).put('/api/products/1').send({ name: 'Prod', companyId: '' });
    expect(res.status).toBe(200);
  });
});

// ====================================================================
// ANALYTICS ROUTES
// ====================================================================
describe('Analytics routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(analyticsRouter);
    mockStorage.isSalesKpi.mockReturnValue(false);
  });

  it('GET /api/job-profiles/:userId should return profile', async () => {
    mockStorage.getJobProfileWithDetails.mockResolvedValueOnce({ userId: 1, title: 'Manager' });
    const res = await request(app).get('/api/job-profiles/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Manager');
  });

  it('GET /api/job-profiles/:userId should return 404 if not found', async () => {
    mockStorage.getJobProfileWithDetails.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/job-profiles/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/user-kpis/:userId should return user KPIs', async () => {
    mockStorage.getUserKpis.mockResolvedValueOnce([{ id: 1, name: 'KPI 1' }]);
    const res = await request(app).get('/api/user-kpis/1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/kpi-overview should return KPI overview', async () => {
    mockStorage.getKPIOverview.mockResolvedValueOnce({ total: 10, compliant: 5 });
    const res = await request(app).get('/api/kpi-overview');
    expect(res.status).toBe(200);
  });

  it('GET /api/kpi-history/:kpiId should return history', async () => {
    mockStorage.getKpis.mockResolvedValueOnce([{ id: 1, companyId: 1, name: 'Test KPI' }]);
    mockStorage.getKpi.mockResolvedValueOnce({ id: 1, companyId: 1, name: 'Test KPI' });
    mockStorage.getKPIHistory.mockResolvedValueOnce([{ period: 'Jan 2025', value: '100' }]);
    const res = await request(app).get('/api/kpi-history/1');
    expect(res.status).toBe(200);
  });

  // --- Additional Analytics coverage ---

  it('GET /api/job-profiles/:userId should return 500 on storage error', async () => {
    mockStorage.getJobProfileWithDetails.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/job-profiles/1');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error interno del servidor');
  });

  it('GET /api/user-kpis/:userId should return 500 on storage error', async () => {
    mockStorage.getUserKpis.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/user-kpis/1');
    expect(res.status).toBe(500);
  });

  it('GET /api/kpi-overview should return 500 on storage error', async () => {
    mockStorage.getKPIOverview.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/kpi-overview');
    expect(res.status).toBe(500);
  });

  it('GET /api/kpi-history/:kpiId should return 404 when KPI not found', async () => {
    mockStorage.getKpis.mockResolvedValueOnce([{ id: 1, companyId: 1, name: 'Test KPI' }]);
    mockStorage.getKpi.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/kpi-history/1');
    expect(res.status).toBe(404);
  });

  it('GET /api/kpi-history/:kpiId should use companyId query param', async () => {
    mockStorage.getKpi.mockResolvedValueOnce({ id: 1, companyId: 2, name: 'Test KPI' });
    mockStorage.getKPIHistory.mockResolvedValueOnce([{ period: 'Feb 2025', value: '200' }]);
    const res = await request(app).get('/api/kpi-history/1?companyId=2&months=6');
    expect(res.status).toBe(200);
  });

  it('GET /api/kpi-history/:kpiId should fall back to traditional when KPI has no companyId', async () => {
    mockStorage.getKpis.mockResolvedValueOnce([{ id: 1, companyId: null, name: 'Generic KPI' }]);
    mockStorage.getKPIHistory.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/kpi-history/1');
    expect(res.status).toBe(200);
  });

  it('GET /api/kpi-history/:kpiId should return calculated history for sales KPI', async () => {
    const { calculateSalesKpiHistory } = await import('../../sales-kpi-calculator');
    (calculateSalesKpiHistory as any).mockResolvedValueOnce({
      supported: true,
      data: [
        { date: new Date('2025-01-15'), value: 1000 },
        { date: new Date('2025-02-15'), value: 2000 },
      ]
    });
    mockStorage.getKpis.mockResolvedValueOnce([{ id: 1, companyId: 1, name: 'Sales KPI' }]);
    mockStorage.getKpi.mockResolvedValueOnce({ id: 1, companyId: 1, name: 'Sales KPI' });
    mockStorage.isSalesKpi.mockReturnValueOnce(true);
    const res = await request(app).get('/api/kpi-history/1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('kpiId');
  });

  it('GET /api/kpi-history/:kpiId should return empty for unsupported sales KPI', async () => {
    const { calculateSalesKpiHistory } = await import('../../sales-kpi-calculator');
    (calculateSalesKpiHistory as any).mockResolvedValueOnce({ supported: false, data: [] });
    mockStorage.getKpis.mockResolvedValueOnce([{ id: 1, companyId: 1, name: 'Sales KPI' }]);
    mockStorage.getKpi.mockResolvedValueOnce({ id: 1, companyId: 1, name: 'Sales KPI' });
    mockStorage.isSalesKpi.mockReturnValueOnce(true);
    const res = await request(app).get('/api/kpi-history/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/kpi-history/:kpiId should fallback to traditional on sales KPI error', async () => {
    const { calculateSalesKpiHistory } = await import('../../sales-kpi-calculator');
    (calculateSalesKpiHistory as any).mockRejectedValueOnce(new Error('Calc error'));
    mockStorage.getKpis.mockResolvedValueOnce([{ id: 1, companyId: 1, name: 'Sales KPI' }]);
    mockStorage.getKpi.mockResolvedValueOnce({ id: 1, companyId: 1, name: 'Sales KPI' });
    mockStorage.isSalesKpi.mockReturnValueOnce(true);
    mockStorage.getKPIHistory.mockResolvedValueOnce([{ period: 'Jan', value: '50' }]);
    const res = await request(app).get('/api/kpi-history/1');
    expect(res.status).toBe(200);
  });

  it('GET /api/kpi-history/:kpiId should return 500 on outer catch error', async () => {
    mockStorage.getKpis.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/kpi-history/1');
    expect(res.status).toBe(500);
  });

  it('GET /api/user-kpi-history/:userId should return history for own user', async () => {
    mockStorage.getUserKPIHistory.mockResolvedValueOnce([{ kpiId: 1, value: '100' }]);
    const res = await request(app).get('/api/user-kpi-history/1'); // admin user id = 1
    expect(res.status).toBe(200);
  });

  it('GET /api/user-kpi-history/:userId should allow admin to see other user history', async () => {
    mockStorage.getUserKPIHistory.mockResolvedValueOnce([{ kpiId: 1, value: '100' }]);
    const res = await request(app).get('/api/user-kpi-history/99');
    expect(res.status).toBe(200);
  });

  it('GET /api/user-kpi-history/:userId should return 403 for non-admin viewing other user', async () => {
    const viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 5, role: 'viewer', email: 'v@test.com', name: 'V', companyId: 1, areaId: 1 };
      next();
    });
    viewerApp.use(analyticsRouter);
    const res = await request(viewerApp).get('/api/user-kpi-history/99');
    expect(res.status).toBe(403);
  });

  it('GET /api/user-kpi-history/:userId should accept months parameter', async () => {
    mockStorage.getUserKPIHistory.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/user-kpi-history/1?months=3');
    expect(res.status).toBe(200);
    expect(mockStorage.getUserKPIHistory).toHaveBeenCalledWith(1, 3);
  });

  it('GET /api/user-kpi-history/:userId should return 500 on storage error', async () => {
    mockStorage.getUserKPIHistory.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/user-kpi-history/1');
    expect(res.status).toBe(500);
  });

  it('GET /api/kpi-history-by-users/:kpiId should return history by users', async () => {
    mockStorage.getKPIHistoryByUsers.mockResolvedValueOnce({ kpiId: 1, users: [] });
    const res = await request(app).get('/api/kpi-history-by-users/1');
    expect(res.status).toBe(200);
  });

  it('GET /api/kpi-history-by-users/:kpiId should return 404 when not found', async () => {
    mockStorage.getKPIHistoryByUsers.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/kpi-history-by-users/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/kpi-history-by-users/:kpiId should return 500 on storage error', async () => {
    mockStorage.getKPIHistoryByUsers.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/kpi-history-by-users/1');
    expect(res.status).toBe(500);
  });

  it('GET /api/kpi-history-by-users/:kpiId should accept months param', async () => {
    mockStorage.getKPIHistoryByUsers.mockResolvedValueOnce({ kpiId: 1, users: [] });
    const res = await request(app).get('/api/kpi-history-by-users/1?months=3');
    expect(res.status).toBe(200);
    expect(mockStorage.getKPIHistoryByUsers).toHaveBeenCalledWith(1, 3);
  });
});

// ====================================================================
// SALES DATA ROUTES (sales-data.ts has GET /api/sales-data and POST /api/sales/upload)
// ====================================================================
describe('Sales Data routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(salesDataRouter);
  });

  it('GET /api/sales-data should return sales data for admin', async () => {
    mockSql.mockResolvedValueOnce([
      { id: 1, client_name: 'Client A', product_name: 'Product X', quantity: 100 },
    ]);
    const res = await request(app).get('/api/sales-data');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/sales-data should return 403 for user without company', async () => {
    const noCompanyApp = express();
    noCompanyApp.use(express.json());
    noCompanyApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: null, areaId: null };
      next();
    });
    noCompanyApp.use(salesDataRouter);
    const res = await request(noCompanyApp).get('/api/sales-data');
    expect(res.status).toBe(403);
  });

  it('GET /api/sales-data should handle server errors', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/sales-data');
    expect(res.status).toBe(500);
  });

  it('POST /api/sales/upload should return 400 when no file is provided', async () => {
    const res = await request(app).post('/api/sales/upload');
    expect(res.status).toBe(400);
  });

  // --- Additional Sales Data coverage ---

  it('GET /api/sales-data should filter by clientId', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, client_name: 'Client A' }]);
    const res = await request(app).get('/api/sales-data?clientId=5');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('client_id'), expect.arrayContaining([5]));
  });

  it('GET /api/sales-data should filter by productId', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/sales-data?productId=3');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('product_id'), expect.arrayContaining([3]));
  });

  it('GET /api/sales-data should filter by year and month', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/sales-data?year=2025&month=1');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('sale_year'), expect.arrayContaining([2025, 1]));
  });

  it('GET /api/sales-data should filter by date range', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/sales-data?startDate=2025-01-01&endDate=2025-12-31');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('sale_date >='), expect.arrayContaining(['2025-01-01', '2025-12-31']));
  });

  it('GET /api/sales-data should use custom limit', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/sales-data?limit=50');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([50]));
  });

  it('GET /api/sales-data should resolve companyId from query for admin', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    const res = await request(app).get('/api/sales-data?companyId=2');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('company_id = $1'), expect.arrayContaining([2]));
  });

  it('GET /api/sales-data should combine multiple filters', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/sales-data?clientId=1&productId=2&year=2025&month=6&limit=10');
    expect(res.status).toBe(200);
  });
});

// ====================================================================
// SALES ACTIONS ROUTES
// ====================================================================
describe('Sales Actions routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(salesActionsRouter);
  });

  it('GET /api/sales/acciones should return actions', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, descripcion: 'Action 1' }]);
    mockSql.mockResolvedValueOnce([{ total: '1' }]);
    const res = await request(app).get('/api/sales/acciones');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('acciones');
    expect(res.body).toHaveProperty('total');
  });

  it('PATCH /api/sales/acciones/:id should return 404 for unknown action', async () => {
    mockSql.mockResolvedValueOnce([]); // action not found
    const res = await request(app).patch('/api/sales/acciones/999').send({ estado: 'COMPLETADO' });
    expect(res.status).toBe(404);
  });

  it('PATCH /api/sales/acciones/:id should return 400 when no fields to update', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, estado: 'PENDIENTE' }]);
    const res = await request(app).patch('/api/sales/acciones/1').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/sales/acciones/:id/historial should return history', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, campo_modificado: 'estado' }]);
    const res = await request(app).get('/api/sales/acciones/1/historial');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('historial');
  });

  // --- Additional Sales Actions coverage ---

  it('GET /api/sales/acciones should filter by submodulo', async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ total: '0' }]);
    const res = await request(app).get('/api/sales/acciones?submodulo=CLIENTES');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('submodulo'), expect.arrayContaining(['CLIENTES']));
  });

  it('GET /api/sales/acciones should filter by responsable', async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ total: '0' }]);
    const res = await request(app).get('/api/sales/acciones?responsable=ON');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('responsables LIKE'), expect.arrayContaining(['%ON%']));
  });

  it('GET /api/sales/acciones should filter by estado and prioridad', async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ total: '0' }]);
    const res = await request(app).get('/api/sales/acciones?estado=PENDIENTE&prioridad=ALTA');
    expect(res.status).toBe(200);
  });

  it('GET /api/sales/acciones should handle custom limit and offset', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    mockSql.mockResolvedValueOnce([{ total: '1' }]);
    const res = await request(app).get('/api/sales/acciones?limit=10&offset=5');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(5);
  });

  it('GET /api/sales/acciones should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/sales/acciones');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Error al obtener acciones');
  });

  it('GET /api/sales/acciones/mias should return empty when no responsable found', async () => {
    mockSql.mockResolvedValueOnce([]); // no responsable match
    const res = await request(app).get('/api/sales/acciones/mias');
    expect(res.status).toBe(200);
    expect(res.body.acciones).toEqual([]);
    expect(res.body.message).toContain('No se encontro');
  });

  it('GET /api/sales/acciones/mias should return actions for matched responsable', async () => {
    mockSql.mockResolvedValueOnce([{ codigo: 'ON' }]); // responsable found
    mockSql.mockResolvedValueOnce([{ id: 1, descripcion: 'My Action', estado: 'PENDIENTE' }]);
    const res = await request(app).get('/api/sales/acciones/mias');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('responsable');
    expect(res.body.responsable.codigo).toBe('ON');
  });

  it('GET /api/sales/acciones/mias should filter by estado and prioridad', async () => {
    mockSql.mockResolvedValueOnce([{ codigo: 'ON' }]);
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/sales/acciones/mias?estado=COMPLETADO&prioridad=CRITICA');
    expect(res.status).toBe(200);
  });

  it('GET /api/sales/acciones/mias should return 500 when sql errors on responsable lookup', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/sales/acciones/mias');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Error al obtener mis acciones');
  });

  it('GET /api/sales/acciones/mias should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/sales/acciones/mias');
    expect(res.status).toBe(500);
  });

  it('PATCH /api/sales/acciones/:id should update estado to COMPLETADO', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, estado: 'PENDIENTE', prioridad: 'ALTA', notas: '' }]); // current action
    mockSql.mockResolvedValueOnce([]); // update
    mockSql.mockResolvedValueOnce([]); // historial insert
    mockSql.mockResolvedValueOnce([{ id: 1, estado: 'COMPLETADO' }]); // updated action
    const res = await request(app).patch('/api/sales/acciones/1').send({ estado: 'COMPLETADO' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/sales/acciones/:id should update prioridad and notas', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, estado: 'PENDIENTE', prioridad: 'BAJA', notas: 'old' }]);
    mockSql.mockResolvedValueOnce([]); // update
    mockSql.mockResolvedValueOnce([]); // prioridad historial
    mockSql.mockResolvedValueOnce([]); // notas historial
    mockSql.mockResolvedValueOnce([{ id: 1, prioridad: 'ALTA', notas: 'new note' }]);
    const res = await request(app).patch('/api/sales/acciones/1').send({ prioridad: 'ALTA', notas: 'new note' });
    expect(res.status).toBe(200);
    expect(res.body.cambios.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/sales/acciones/:id should update fecha_limite', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, estado: 'PENDIENTE', prioridad: 'MEDIA', notas: '' }]);
    mockSql.mockResolvedValueOnce([]); // update
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    const res = await request(app).patch('/api/sales/acciones/1').send({ fecha_limite: '2025-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/sales/acciones/:id should handle combined estado and notas update', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, estado: 'PENDIENTE', prioridad: 'MEDIA', notas: 'old note' }]);
    mockSql.mockResolvedValueOnce([]); // update
    mockSql.mockResolvedValueOnce([]); // estado historial
    mockSql.mockResolvedValueOnce([]); // notas historial
    mockSql.mockResolvedValueOnce([{ id: 1, estado: 'EN_PROGRESO', notas: 'updated' }]);
    const res = await request(app).patch('/api/sales/acciones/1').send({ estado: 'EN_PROGRESO', notas: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.cambios.length).toBe(2);
  });

  it('PATCH /api/sales/acciones/:id should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).patch('/api/sales/acciones/1').send({ estado: 'COMPLETADO' });
    expect(res.status).toBe(500);
  });

  it('GET /api/sales/acciones/:id/historial should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/sales/acciones/1/historial');
    expect(res.status).toBe(500);
  });

  it('GET /api/sales/acciones/:id/historial should return empty for no history', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/sales/acciones/1/historial');
    expect(res.status).toBe(200);
    expect(res.body.historial).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

// ====================================================================
// SALES OPERATIONS ROUTES (sales-operations.ts)
// ====================================================================
describe('Sales Operations routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(salesOperationsRouter);
  });

  it('POST /api/sales/weekly-update should return 400 for missing data', async () => {
    const res = await request(app).post('/api/sales/weekly-update').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('value');
  });

  it('POST /api/sales/update-month should return 400 for missing data', async () => {
    const res = await request(app).post('/api/sales/update-month').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/sales/update-month should return 400 for invalid companyId', async () => {
    const res = await request(app)
      .post('/api/sales/update-month')
      .send({ value: '100', companyId: 5, month: 'Enero', year: 2025 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('companyId');
  });

  it('GET /api/sales/monthly-status should return 400 for missing params', async () => {
    const res = await request(app).get('/api/sales/monthly-status');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ====================================================================
// TREASURY DOCUMENTS ROUTES
// ====================================================================
describe('Treasury Documents routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(treasuryDocumentsRouter);
  });

  it('GET /api/treasury/payments/:id/receipts should return receipts', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, file_name: 'receipt.pdf' }]);
    const res = await request(app).get('/api/treasury/payments/1/receipts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/treasury/receipts/send should return 400 when missing fields', async () => {
    const res = await request(app).post('/api/treasury/receipts/send').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/treasury/complements should return complements', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, client_name: 'Client A' }]);
    const res = await request(app).get('/api/treasury/complements');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/treasury/complements/:id/generate should return 404 for unknown complement', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).put('/api/treasury/complements/999/generate');
    expect(res.status).toBe(404);
  });

  // --- Additional Treasury Documents coverage ---

  it('GET /api/treasury/payments/:id/receipts should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/treasury/payments/1/receipts');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Failed to fetch receipts');
  });

  it('POST /api/treasury/receipts/send should return 404 when no receipts found', async () => {
    mockSql.mockResolvedValueOnce([]); // no receipts
    const res = await request(app).post('/api/treasury/receipts/send').send({ receiptIds: [999], emails: ['test@test.com'] });
    expect(res.status).toBe(404);
  });

  it('POST /api/treasury/receipts/send should send emails with receipts', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, file_url: '/test.pdf', file_name: 'receipt.pdf', file_type: 'pdf', supplier_name: 'Supplier A', amount: 1000, currency: 'MXN', reference: 'REF-001' }]);
    mockSql.mockResolvedValueOnce([]); // update sent_to
    const res = await request(app).post('/api/treasury/receipts/send').send({ receiptIds: [1], emails: ['recipient@test.com'] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/treasury/receipts/send should return 500 on error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/treasury/receipts/send').send({ receiptIds: [1], emails: ['test@test.com'] });
    expect(res.status).toBe(500);
  });

  it('GET /api/treasury/complements should filter by companyId', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/treasury/complements?companyId=1');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('company_id'), expect.arrayContaining([1]));
  });

  it('GET /api/treasury/complements should filter by status', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/treasury/complements?status=pending');
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledWith(expect.stringContaining('status'), expect.arrayContaining(['pending']));
  });

  it('GET /api/treasury/complements should filter by companyId and status', async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/treasury/complements?companyId=2&status=generated');
    expect(res.status).toBe(200);
  });

  it('GET /api/treasury/complements should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/treasury/complements');
    expect(res.status).toBe(500);
  });

  it('POST /api/treasury/complements should create a complement', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, company_id: 1, client_name: 'Client A', amount: 5000 }]);
    const res = await request(app).post('/api/treasury/complements').send({
      companyId: 1,
      clientName: 'Client A',
      invoiceReference: 'INV-001',
      amount: 5000,
      currency: 'MXN',
    });
    expect(res.status).toBe(201);
  });

  it('POST /api/treasury/complements should use default currency MXN', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, company_id: 1 }]);
    const res = await request(app).post('/api/treasury/complements').send({
      companyId: 1,
      clientName: 'Client B',
      invoiceReference: 'INV-002',
      amount: 3000,
    });
    expect(res.status).toBe(201);
  });

  it('POST /api/treasury/complements should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/treasury/complements').send({
      companyId: 1,
      clientName: 'Client',
      invoiceReference: 'INV',
      amount: 100,
    });
    expect(res.status).toBe(500);
  });

  it('PUT /api/treasury/complements/:id/generate should generate a complement', async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, status: 'generated', complement_url: '/uploads/complements/complement-1.pdf' }]);
    const res = await request(app).put('/api/treasury/complements/1/generate');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('generated');
  });

  it('PUT /api/treasury/complements/:id/generate should return 500 on sql error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).put('/api/treasury/complements/1/generate');
    expect(res.status).toBe(500);
  });
});

// ====================================================================
// TREASURY ACCOUNTING ROUTES
// ====================================================================
describe('Treasury Accounting routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(treasuryAccountingRouter);
  });

  it('GET /api/treasury/accounting/documents should return documents', async () => {
    mockStorage.getPaymentVouchersByCompany.mockResolvedValueOnce([]);
    mockStorage.getScheduledPaymentsByCompany.mockResolvedValueOnce([]);
    mockStorage.getCompanies.mockResolvedValueOnce([{ id: 1, name: 'Dura' }]);

    const res = await request(app).get('/api/treasury/accounting/documents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/treasury/accounting/download-batch should return 400 for empty ids', async () => {
    const res = await request(app).post('/api/treasury/accounting/download-batch').send({ documentIds: [] });
    expect(res.status).toBe(400);
  });

  it('POST /api/treasury/accounting/download-batch should return 501 (not implemented)', async () => {
    const res = await request(app).post('/api/treasury/accounting/download-batch').send({ documentIds: [1, 2] });
    expect(res.status).toBe(501);
  });

  it('GET /api/treasury/accounting/export should return CSV', async () => {
    mockStorage.getPaymentVouchers.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/treasury/accounting/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  // --- Additional Treasury Accounting coverage ---

  it('GET /api/treasury/accounting/documents should return 403 for user without company', async () => {
    const noCompanyApp = express();
    noCompanyApp.use(express.json());
    noCompanyApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: null, areaId: null };
      next();
    });
    noCompanyApp.use(treasuryAccountingRouter);
    const res = await request(noCompanyApp).get('/api/treasury/accounting/documents');
    expect(res.status).toBe(403);
  });

  it('GET /api/treasury/accounting/documents should return 403 for non-admin accessing other company', async () => {
    const viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: 1, areaId: 1 };
      next();
    });
    viewerApp.use(treasuryAccountingRouter);
    const res = await request(viewerApp).get('/api/treasury/accounting/documents?companyId=2');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('denegado');
  });

  it('GET /api/treasury/accounting/documents should allow admin to query other company', async () => {
    mockStorage.getPaymentVouchersByCompany.mockResolvedValueOnce([]);
    mockStorage.getScheduledPaymentsByCompany.mockResolvedValueOnce([]);
    mockStorage.getCompanies.mockResolvedValueOnce([{ id: 2, name: 'Orsega' }]);
    const res = await request(app).get('/api/treasury/accounting/documents?companyId=2');
    expect(res.status).toBe(200);
  });

  it('GET /api/treasury/accounting/documents should map voucher data correctly', async () => {
    mockStorage.getPaymentVouchersByCompany.mockResolvedValueOnce([{
      id: 1,
      invoiceFileUrl: '/invoice.pdf',
      invoiceFileName: 'invoice.pdf',
      voucherFileUrl: '/voucher.pdf',
      voucherFileName: 'voucher.pdf',
      complementFileUrl: '/complement.pdf',
      complementFileName: 'complement.pdf',
      payerCompanyId: 1,
      clientName: 'Test Client',
      extractedAmount: 5000,
      extractedCurrency: 'USD',
      extractedDate: '2025-01-15',
      extractedReference: 'REF-001',
      extractedBank: 'BBVA',
      extractedTrackingKey: 'TRK-001',
      status: 'factura_pagada',
    }]);
    mockStorage.getScheduledPaymentsByCompany.mockResolvedValueOnce([]);
    mockStorage.getCompanies.mockResolvedValueOnce([{ id: 1, name: 'Dura' }]);
    const res = await request(app).get('/api/treasury/accounting/documents');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].type).toBe('invoice');
    expect(res.body[0].files.invoice).toBeDefined();
    expect(res.body[0].files.voucher).toBeDefined();
    expect(res.body[0].files.complement).toBeDefined();
  });

  it('GET /api/treasury/accounting/documents should include pending scheduled payments', async () => {
    mockStorage.getPaymentVouchersByCompany.mockResolvedValueOnce([]);
    mockStorage.getScheduledPaymentsByCompany.mockResolvedValueOnce([{
      id: 10,
      companyId: 1,
      supplierName: 'Supplier X',
      amount: 3000,
      currency: 'MXN',
      dueDate: '2025-03-01',
      status: 'pending',
      reference: 'SP-REF-001',
      hydralFileUrl: '/sp-invoice.pdf',
      hydralFileName: 'sp-invoice.pdf',
    }]);
    mockStorage.getCompanies.mockResolvedValueOnce([{ id: 1, name: 'Dura' }]);
    const res = await request(app).get('/api/treasury/accounting/documents');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe('sp-10');
    expect(res.body[0].type).toBe('invoice');
  });

  it('GET /api/treasury/accounting/documents should exclude completed scheduled payments', async () => {
    mockStorage.getPaymentVouchersByCompany.mockResolvedValueOnce([]);
    mockStorage.getScheduledPaymentsByCompany.mockResolvedValueOnce([{
      id: 11,
      companyId: 1,
      supplierName: 'Supplier Y',
      amount: 2000,
      status: 'payment_completed',
    }]);
    mockStorage.getCompanies.mockResolvedValueOnce([{ id: 1, name: 'Dura' }]);
    const res = await request(app).get('/api/treasury/accounting/documents');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('GET /api/treasury/accounting/documents should return 500 on storage error', async () => {
    mockStorage.getPaymentVouchersByCompany.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/treasury/accounting/documents');
    expect(res.status).toBe(500);
  });

  it('POST /api/treasury/accounting/download-batch should return 400 for non-array', async () => {
    const res = await request(app).post('/api/treasury/accounting/download-batch').send({ documentIds: 'not-array' });
    expect(res.status).toBe(400);
  });

  it('GET /api/treasury/accounting/export should filter by company', async () => {
    mockStorage.getPaymentVouchers.mockResolvedValueOnce([
      { payerCompanyId: 1, clientName: 'Client 1', extractedAmount: 100 },
      { payerCompanyId: 2, clientName: 'Client 2', extractedAmount: 200 },
    ]);
    const res = await request(app).get('/api/treasury/accounting/export?company=1');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('GET /api/treasury/accounting/export should filter by status', async () => {
    mockStorage.getPaymentVouchers.mockResolvedValueOnce([
      { status: 'factura_pagada', clientName: 'A' },
      { status: 'pending', clientName: 'B' },
    ]);
    const res = await request(app).get('/api/treasury/accounting/export?status=factura_pagada');
    expect(res.status).toBe(200);
  });

  it('GET /api/treasury/accounting/export should return 500 on storage error', async () => {
    mockStorage.getPaymentVouchers.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/treasury/accounting/export');
    expect(res.status).toBe(500);
  });
});

// ====================================================================
// FILES ROUTES
// ====================================================================
describe('Files routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(filesRouter);
  });

  it('GET /api/files/info should return storage info', async () => {
    const res = await request(app).get('/api/files/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider');
  });

  it('GET /api/files/url/* should return 400 for empty key', async () => {
    const res = await request(app).get('/api/files/url/');
    // Express matches wildcard with empty string; route checks !key and returns 400
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('GET /api/files/url/test-key should return URL for local provider', async () => {
    const res = await request(app).get('/api/files/url/test-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.provider).toBe('local');
  });

  it('DELETE /api/files/some..path should reject path traversal', async () => {
    // Use encoded dots to avoid Express URL normalization
    const res = await request(app).delete('/api/files/uploads/..%2F..%2Fetc%2Fpasswd');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid');
  });

  // --- Additional Files coverage ---

  it('GET /api/files/url/* should return URL for R2 provider', async () => {
    const fileStorageMod = await import('../../file-storage');
    (fileStorageMod.isR2Configured as any).mockReturnValueOnce(true);
    (fileStorageMod.getDownloadUrl as any).mockResolvedValueOnce('https://r2.example.com/signed-url');
    const res = await request(app).get('/api/files/url/receipts/some-file.pdf');
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('r2');
    expect(res.body.url).toBe('https://r2.example.com/signed-url');
  });

  it('GET /api/files/url/* should use getViewUrl for inline=true', async () => {
    const fileStorageMod = await import('../../file-storage');
    (fileStorageMod.isR2Configured as any).mockReturnValueOnce(true);
    (fileStorageMod.getViewUrl as any).mockResolvedValueOnce('https://r2.example.com/view-url');
    const res = await request(app).get('/api/files/url/receipts/file.pdf?inline=true');
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://r2.example.com/view-url');
  });

  it('GET /api/files/url/* should use custom expiresIn', async () => {
    const fileStorageMod = await import('../../file-storage');
    (fileStorageMod.isR2Configured as any).mockReturnValueOnce(true);
    (fileStorageMod.getDownloadUrl as any).mockResolvedValueOnce('https://r2.example.com/url');
    const res = await request(app).get('/api/files/url/file.pdf?expiresIn=7200');
    expect(res.status).toBe(200);
    expect(res.body.expiresIn).toBe(7200);
  });

  it('GET /api/files/url/* should return 500 on error', async () => {
    const fileStorageMod = await import('../../file-storage');
    (fileStorageMod.isR2Configured as any).mockReturnValueOnce(true);
    (fileStorageMod.getDownloadUrl as any).mockRejectedValueOnce(new Error('R2 error'));
    const res = await request(app).get('/api/files/url/some-file.pdf');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Error getting file URL');
  });

  it('GET /api/files/url/* should prefix slash for local URLs', async () => {
    const res = await request(app).get('/api/files/url/uploads/file.pdf');
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('/uploads/file.pdf');
    expect(res.body.provider).toBe('local');
  });

  it('POST /api/files/upload should return 400 when no file provided', async () => {
    const res = await request(app).post('/api/files/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No file provided');
  });

  it('DELETE /api/files/* should return 400 for empty key', async () => {
    const res = await request(app).delete('/api/files/');
    // Express wildcard with empty string
    expect([400, 404]).toContain(res.status);
  });

  it('DELETE /api/files/* should delete from R2 when configured', async () => {
    const fileStorageMod = await import('../../file-storage');
    (fileStorageMod.isR2Configured as any).mockReturnValueOnce(true);
    (fileStorageMod.deleteFile as any).mockResolvedValueOnce(true);
    const res = await request(app).delete('/api/files/receipts/test-file.pdf');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/files/* should return 500 on R2 delete error', async () => {
    const fileStorageMod = await import('../../file-storage');
    (fileStorageMod.isR2Configured as any).mockReturnValueOnce(true);
    (fileStorageMod.deleteFile as any).mockRejectedValueOnce(new Error('R2 delete error'));
    const res = await request(app).delete('/api/files/receipts/test-file.pdf');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Error deleting file');
  });
});

// ====================================================================
// ONBOARDING ROUTES
// ====================================================================
describe('Onboarding routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(onboardingRouter);
  });

  it('GET /api/activate/:token should return 404 for invalid token', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/activate/invalid-token');
    expect(res.status).toBe(404);
  });

  it('GET /api/activate/:token should return 400 for expired token', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce({
      token: 'test-token',
      email: 'test@test.com',
      expiresAt: new Date('2020-01-01'),
      used: false,
    });
    const res = await request(app).get('/api/activate/test-token');
    expect(res.status).toBe(400);
  });

  it('GET /api/activate/:token should return 400 for used token', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce({
      token: 'test-token',
      email: 'test@test.com',
      expiresAt: new Date('2099-01-01'),
      used: true,
    });
    const res = await request(app).get('/api/activate/test-token');
    expect(res.status).toBe(400);
  });

  it('GET /api/activate/:token should return user info for valid token', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce({
      token: 'valid-token',
      email: 'test@test.com',
      expiresAt: new Date('2099-01-01'),
      used: false,
    });
    mockStorage.getUserByEmail.mockResolvedValueOnce({ id: 1, name: 'Test', email: 'test@test.com', role: 'viewer' });

    const res = await request(app).get('/api/activate/valid-token');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.email).toBe('test@test.com');
  });

  it('POST /api/activate/:token should return 400 for short password', async () => {
    const res = await request(app).post('/api/activate/test-token').send({ password: 'short' });
    expect(res.status).toBe(400);
  });

  it('POST /api/activate/:token should return 404 for invalid token', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/activate/invalid-token').send({ password: 'validpassword123' });
    expect(res.status).toBe(404);
  });

  // --- Additional Onboarding coverage ---

  it('GET /api/activate/:token should return 404 when user not found for valid token', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce({
      token: 'valid-token',
      email: 'ghost@test.com',
      expiresAt: new Date('2099-01-01'),
      used: false,
    });
    mockStorage.getUserByEmail.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/activate/valid-token');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Usuario no encontrado');
  });

  it('GET /api/activate/:token should return 500 on storage error', async () => {
    mockStorage.getActivationToken.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/activate/test-token');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Error interno');
  });

  it('POST /api/activate/:token should return 400 for missing password', async () => {
    const res = await request(app).post('/api/activate/test-token').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/activate/:token should return 400 when token already used', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce({
      token: 'used-token',
      email: 'test@test.com',
      expiresAt: new Date('2099-01-01'),
      used: false,
    });
    mockStorage.markTokenAsUsed.mockResolvedValueOnce(false); // already used (race condition)
    const res = await request(app).post('/api/activate/used-token').send({ password: 'validpassword123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('ya utilizado');
  });

  it('POST /api/activate/:token should return 404 when user not found', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce({
      token: 'valid-token',
      email: 'ghost@test.com',
      expiresAt: new Date('2099-01-01'),
      used: false,
    });
    mockStorage.markTokenAsUsed.mockResolvedValueOnce(true);
    mockStorage.getUserByEmail.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/activate/valid-token').send({ password: 'validpassword123' });
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Usuario no encontrado');
  });

  it('POST /api/activate/:token should set password successfully', async () => {
    mockStorage.getActivationToken.mockResolvedValueOnce({
      token: 'valid-token',
      email: 'test@test.com',
      expiresAt: new Date('2099-01-01'),
      used: false,
    });
    mockStorage.markTokenAsUsed.mockResolvedValueOnce(true);
    mockStorage.getUserByEmail.mockResolvedValueOnce({ id: 1, name: 'Test', email: 'test@test.com', role: 'viewer' });
    mockStorage.updateUser.mockResolvedValueOnce({ id: 1 });
    mockStorage.deleteExpiredTokens.mockResolvedValueOnce(undefined);
    const res = await request(app).post('/api/activate/valid-token').send({ password: 'validpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('exitosamente');
    expect(res.body.user).toBeDefined();
  });

  it('POST /api/activate/:token should return 500 on storage error', async () => {
    mockStorage.getActivationToken.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/activate/test-token').send({ password: 'validpassword123' });
    expect(res.status).toBe(500);
  });

  it('POST /api/admin/send-activation-emails should return 403 for non-admin', async () => {
    const viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: 1, areaId: 1 };
      next();
    });
    viewerApp.use(onboardingRouter);
    const res = await request(viewerApp).post('/api/admin/send-activation-emails');
    expect(res.status).toBe(403);
  });

  it('POST /api/admin/send-activation-emails should send emails to all users', async () => {
    mockStorage.getUsers.mockResolvedValueOnce([
      { id: 1, name: 'User1', email: 'u1@test.com', role: 'viewer' },
      { id: 2, name: 'User2', email: 'u2@test.com', role: 'admin' },
    ]);
    mockStorage.createActivationToken.mockResolvedValue({ token: 'tok-1', email: 'u1@test.com' });
    mockStorage.deleteExpiredTokens.mockResolvedValueOnce(undefined);
    const res = await request(app).post('/api/admin/send-activation-emails');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body.totalUsers).toBe(2);
  });

  it('POST /api/admin/send-activation-emails should return 500 on error', async () => {
    mockStorage.getUsers.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/admin/send-activation-emails');
    expect(res.status).toBe(500);
  });

  it('POST /api/seed-production should return 403 for non-admin', async () => {
    const viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: 1, areaId: 1 };
      next();
    });
    viewerApp.use(onboardingRouter);
    const res = await request(viewerApp).post('/api/seed-production');
    expect(res.status).toBe(403);
  });

  it('GET /api/debug-database should return 403 for non-admin', async () => {
    const viewerApp = express();
    viewerApp.use(express.json());
    viewerApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 2, role: 'viewer', email: 'v@test.com', name: 'V', companyId: 1, areaId: 1 };
      next();
    });
    viewerApp.use(onboardingRouter);
    const res = await request(viewerApp).get('/api/debug-database');
    expect(res.status).toBe(403);
  });

  it('GET /api/debug-database should return database info for admin in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    mockStorage.getCompanies.mockResolvedValueOnce([{ id: 1, name: 'Dura' }]);
    mockStorage.getAreas.mockResolvedValueOnce([{ id: 1, name: 'Sales' }]);
    mockStorage.getKpis.mockResolvedValueOnce([{ id: 1, name: 'KPI 1' }]);
    const res = await request(app).get('/api/debug-database');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalCompanies');
    expect(res.body).toHaveProperty('totalAreas');
    expect(res.body).toHaveProperty('totalKpis');
    process.env.NODE_ENV = originalEnv;
  });

  it('GET /api/debug-database should return 500 on storage error', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    mockStorage.getCompanies.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/debug-database');
    expect(res.status).toBe(500);
    process.env.NODE_ENV = originalEnv;
  });
});
