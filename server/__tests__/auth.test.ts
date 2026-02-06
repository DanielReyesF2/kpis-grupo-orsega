import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const { mockStorage } = vi.hoisted(() => {
  // Must set JWT_SECRET before auth.ts module loads (top-level check)
  process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
  return {
    mockStorage: {
      getUserByUsername: vi.fn(),
      updateUser: vi.fn(),
    },
  };
});

vi.mock('../storage', () => ({
  storage: mockStorage,
}));
vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
  Pool: vi.fn(),
}));
vi.mock('ws', () => ({ default: class {} }));

import { generateToken, verifyToken, loginUser } from '../auth';

describe('auth.ts', () => {
  const TEST_JWT_SECRET = 'test-secret-key-for-unit-tests';

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const user = { id: 1, name: 'Test User', email: 'test@example.com', role: 'admin', companyId: 1 };
      const token = generateToken(user);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    it('should include expiration in token', () => {
      const user = { id: 1, name: 'Test User', email: 'test@example.com', role: 'viewer', companyId: 1 };
      const token = generateToken(user);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should generate different tokens for different users', () => {
      const user1 = { id: 1, name: 'User One', email: 'one@example.com', role: 'admin', companyId: 1 };
      const user2 = { id: 2, name: 'User Two', email: 'two@example.com', role: 'viewer', companyId: 2 };
      const token1 = generateToken(user1);
      const token2 = generateToken(user2);
      expect(token1).not.toBe(token2);
    });

    it('should include companyId in token payload', () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin', companyId: 2 };
      const token = generateToken(user);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.companyId).toBe(2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const user = { id: 1, name: 'Test User', email: 'test@example.com', role: 'admin', companyId: 1 };
      const token = generateToken(user);
      const payload = verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload?.id).toBe(user.id);
      expect(payload?.email).toBe(user.email);
    });

    it('should return null for invalid token', () => {
      expect(verifyToken('invalid.token.here')).toBeNull();
    });

    it('should return null for empty token', () => {
      expect(verifyToken('')).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin', companyId: 1 };
      const tokenWithWrongSecret = jwt.sign(user, 'wrong-secret', { expiresIn: '1h' });
      expect(verifyToken(tokenWithWrongSecret)).toBeNull();
    });

    it('should return null for expired token', () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin', companyId: 1 };
      const expiredToken = jwt.sign(user, TEST_JWT_SECRET, { expiresIn: '-1s' });
      expect(verifyToken(expiredToken)).toBeNull();
    });
  });

  describe('loginUser', () => {
    it('should return token and user for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const dbUser = {
        id: 1, name: 'Test User', email: 'test@example.com',
        password: hashedPassword, role: 'admin', companyId: 1,
        areaId: null, lastLogin: null, isActive: true,
      };
      mockStorage.getUserByUsername.mockResolvedValue(dbUser);
      mockStorage.updateUser.mockResolvedValue(dbUser);

      const result = await loginUser('test@example.com', 'password123');
      expect(result).not.toBeNull();
      expect(result?.token).toBeDefined();
      expect(result?.user).toBeDefined();
      expect(result?.user.password).toBeUndefined();
    });

    it('should return null for non-existent user', async () => {
      mockStorage.getUserByUsername.mockResolvedValue(null);
      const result = await loginUser('nonexistent@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('should return null for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const dbUser = {
        id: 1, name: 'Test User', email: 'test@example.com',
        password: hashedPassword, role: 'admin', companyId: 1,
        areaId: null, lastLogin: null, isActive: true,
      };
      mockStorage.getUserByUsername.mockResolvedValue(dbUser);
      const result = await loginUser('test@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });

    it('should reject plaintext (non-bcrypt) passwords', async () => {
      const dbUser = {
        id: 1, name: 'Test User', email: 'test@example.com',
        password: 'plaintext-password', role: 'admin', companyId: 1,
        areaId: null, lastLogin: null, isActive: true,
      };
      mockStorage.getUserByUsername.mockResolvedValue(dbUser);
      const result = await loginUser('test@example.com', 'plaintext-password');
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockStorage.getUserByUsername.mockRejectedValue(new Error('Database error'));
      const result = await loginUser('test@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('should update lastLogin on successful login', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const dbUser = {
        id: 1, name: 'Test User', email: 'test@example.com',
        password: hashedPassword, role: 'admin', companyId: 1,
        areaId: null, lastLogin: null, isActive: true,
      };
      mockStorage.getUserByUsername.mockResolvedValue(dbUser);
      mockStorage.updateUser.mockResolvedValue(dbUser);
      await loginUser('test@example.com', 'password123');
      expect(mockStorage.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ lastLogin: expect.any(Date) }));
    });
  });

  describe('bcrypt password hashing', () => {
    it('should hash passwords correctly', async () => {
      const password = 'testPassword123!';
      const hash = await bcrypt.hash(password, 10);
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    });

    it('should verify hashed passwords', async () => {
      const password = 'testPassword123!';
      const hash = await bcrypt.hash(password, 10);
      expect(await bcrypt.compare(password, hash)).toBe(true);
      expect(await bcrypt.compare('wrongPassword', hash)).toBe(false);
    });

    it('should generate different hashes for same password (salt)', async () => {
      const password = 'testPassword123!';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);
      expect(hash1).not.toBe(hash2);
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });
});
