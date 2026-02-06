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
    // In tests, jwtAdminMiddleware may be used alone (e.g. DELETE /api/users/:id), so set user first
    if (!req.user) {
      req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
  },
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
  verifyToken: vi.fn(),
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

import router from '../../routes/users';
import { storage } from '../../storage';

const app = createTestApp(router);

const mockUserRecord = {
  id: 1,
  name: 'Test Admin',
  email: 'admin@test.com',
  password: 'hashed-password',
  role: 'admin',
  companyId: 1,
  areaId: 1,
  username: 'admin',
  lastLogin: null,
};

const mockUserRecord2 = {
  id: 2,
  name: 'Test Viewer',
  email: 'viewer@test.com',
  password: 'hashed-password-2',
  role: 'viewer',
  companyId: 1,
  areaId: 2,
  username: 'viewer',
  lastLogin: null,
};

describe('Users Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/user -- current user
  // =========================================================================
  describe('GET /api/user', () => {
    it('should return the current authenticated user without password', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUserRecord as any);

      const res = await request(app).get('/api/user');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('email', 'admin@test.com');
      expect(res.body).not.toHaveProperty('password');
      expect(storage.getUser).toHaveBeenCalledWith(1);
    });

    it('should return 404 when user is not found in database', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(undefined as any);

      const res = await request(app).get('/api/user');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'User not found');
    });
  });

  // =========================================================================
  // GET /api/users -- list all users
  // =========================================================================
  describe('GET /api/users', () => {
    it('should return sanitized user list (no passwords)', async () => {
      vi.mocked(storage.getUsers).mockResolvedValue([mockUserRecord, mockUserRecord2] as any);

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      for (const user of res.body) {
        expect(user).not.toHaveProperty('password');
      }
    });

    it('should return empty array when no users exist', async () => {
      vi.mocked(storage.getUsers).mockResolvedValue([]);

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // =========================================================================
  // POST /api/users -- create user
  // =========================================================================
  describe('POST /api/users', () => {
    it('should create a user and return 201', async () => {
      const newUser = {
        name: 'New User',
        email: 'new@test.com',
        password: 'securepassword123',
        role: 'viewer',
      };
      vi.mocked(storage.createUser).mockResolvedValue({
        id: 3, ...newUser, companyId: null, areaId: null, username: 'newuser', lastLogin: null,
      } as any);

      const res = await request(app).post('/api/users').send(newUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 3);
      expect(res.body).not.toHaveProperty('password');
      expect(storage.createUser).toHaveBeenCalled();
    });

    it('should return 400 for validation error (missing name)', async () => {
      const res = await request(app).post('/api/users').send({
        email: 'bad@test.com',
        password: 'securepassword123',
        role: 'viewer',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });

    it('should return 400 for validation error (short password)', async () => {
      const res = await request(app).post('/api/users').send({
        name: 'Short Pass',
        email: 'short@test.com',
        password: 'abc',
        role: 'viewer',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });
  });

  // =========================================================================
  // PUT /api/users/:id -- update user
  // =========================================================================
  describe('PUT /api/users/:id', () => {
    it('should allow self-update (user updating their own profile)', async () => {
      vi.mocked(storage.updateUser).mockResolvedValue({ ...mockUserRecord, name: 'Updated Name' } as any);

      const res = await request(app).put('/api/users/1').send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated Name');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should allow admin to update another user', async () => {
      vi.mocked(storage.updateUser).mockResolvedValue({ ...mockUserRecord2, name: 'Admin Changed' } as any);

      const res = await request(app).put('/api/users/2').send({ name: 'Admin Changed' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Admin Changed');
    });

    it('should return 404 when user to update is not found', async () => {
      vi.mocked(storage.updateUser).mockResolvedValue(undefined as any);

      const res = await request(app).put('/api/users/999').send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'User not found');
    });
  });

  // =========================================================================
  // DELETE /api/users/:id -- delete user (admin only via jwtAdminMiddleware)
  // =========================================================================
  describe('DELETE /api/users/:id', () => {
    it('should delete a user successfully', async () => {
      vi.mocked(storage.deleteUser).mockResolvedValue(true);

      const res = await request(app).delete('/api/users/2');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'User deleted successfully');
      expect(storage.deleteUser).toHaveBeenCalledWith(2);
    });

    it('should return 404 when user to delete is not found', async () => {
      vi.mocked(storage.deleteUser).mockResolvedValue(false);

      const res = await request(app).delete('/api/users/999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'User not found');
    });
  });
});
