import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---- Helper ----
function createTestApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ---- Mocks (must be before route import) ----

vi.mock('../../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getUsers: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    next();
  },
  jwtAdminMiddleware: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
  },
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
  verifyToken: vi.fn(),
}));

vi.mock('express-rate-limit', () => ({
  default: () => (req: any, res: any, next: any) => next(),
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('node-cache', () => ({
  default: class FakeNodeCache { flushAll() {} get() {} set() {} },
}));

import router from '../../routes/auth';
import { storage } from '../../storage';
import { loginUser } from '../../auth';

const app = createTestApp(router);

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // POST /api/login
  // =========================================================================
  describe('POST /api/login', () => {
    it('should return 400 when username is missing', async () => {
      const res = await request(app).post('/api/login').send({ password: 'somepass' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Username and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app).post('/api/login').send({ username: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Username and password are required');
    });

    it('should return 400 when both username and password are missing', async () => {
      const res = await request(app).post('/api/login').send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Username and password are required');
    });

    it('should return 401 for invalid credentials', async () => {
      vi.mocked(loginUser).mockResolvedValue(null);

      const res = await request(app).post('/api/login').send({ username: 'bad', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'Invalid username or password');
    });

    it('should return 200 with token for valid credentials', async () => {
      const mockLoginResult = {
        token: 'jwt-token-123',
        user: { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', companyId: 1 },
      };
      vi.mocked(loginUser).mockResolvedValue(mockLoginResult);

      const res = await request(app).post('/api/login').send({ username: 'admin', password: 'correct' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token', 'jwt-token-123');
      expect(res.body).toHaveProperty('user');
      expect(loginUser).toHaveBeenCalledWith('admin', 'correct');
    });
  });

  // =========================================================================
  // POST /api/register
  // =========================================================================
  describe('POST /api/register', () => {
    it('should return 400 for validation error (missing required fields)', async () => {
      const res = await request(app).post('/api/register').send({
        email: 'test@test.com',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app).post('/api/register').send({
        name: 'Test',
        email: 'not-an-email',
        password: 'securepassword123',
        role: 'collaborator',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const res = await request(app).post('/api/register').send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'abc',
        role: 'collaborator',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should register a user successfully and return 201', async () => {
      const newUser = {
        name: 'New User',
        email: 'newuser@test.com',
        password: 'securepassword123',
        role: 'collaborator',
      };
      vi.mocked(storage.createUser).mockResolvedValue({
        id: 10,
        name: 'New User',
        email: 'newuser@test.com',
        password: 'hashed',
        role: 'collaborator',
        companyId: null,
        areaId: null,
        username: 'newuser',
        lastLogin: null,
      } as any);

      const res = await request(app).post('/api/register').send(newUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Usuario registrado exitosamente');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('password');
      expect(storage.createUser).toHaveBeenCalled();
    });

    it('should return 409 when email already exists (duplicate key)', async () => {
      vi.mocked(storage.createUser).mockRejectedValue(
        new Error('duplicate key value violates unique constraint')
      );

      const res = await request(app).post('/api/register').send({
        name: 'Duplicate',
        email: 'existing@test.com',
        password: 'securepassword123',
        role: 'collaborator',
      });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('code', 'EMAIL_EXISTS');
    });
  });
});
