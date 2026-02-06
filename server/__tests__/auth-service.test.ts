import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import bcrypt from 'bcrypt';

const { mockStorage } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-for-auth-service';
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

import { loginUser } from '../auth';

describe('Auth Service - loginUser', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-auth-service';
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate valid user with correct password', async () => {
    const hashedPassword = await bcrypt.hash('correct-password', 10);
    const dbUser = {
      id: 1, name: 'Test User', email: 'test@test.com',
      password: hashedPassword, role: 'admin', companyId: 1,
      areaId: 1, lastLogin: null, isActive: true,
    };
    mockStorage.getUserByUsername.mockResolvedValue(dbUser);
    mockStorage.updateUser.mockResolvedValue(dbUser);

    const result = await loginUser('test@test.com', 'correct-password');
    expect(result).not.toBeNull();
    expect(result?.token).toBeDefined();
    expect(typeof result?.token).toBe('string');
    expect(result?.user).toBeDefined();
  });

  it('should return null for non-existent user', async () => {
    mockStorage.getUserByUsername.mockResolvedValue(null);
    const result = await loginUser('nobody@test.com', 'password');
    expect(result).toBeNull();
  });

  it('should return null for wrong password', async () => {
    const hashedPassword = await bcrypt.hash('correct-password', 10);
    mockStorage.getUserByUsername.mockResolvedValue({
      id: 1, name: 'Test', email: 'test@test.com',
      password: hashedPassword, role: 'admin', companyId: 1,
    });

    const result = await loginUser('test@test.com', 'wrong-password');
    expect(result).toBeNull();
  });

  it('should reject plaintext passwords (non-bcrypt hashed)', async () => {
    mockStorage.getUserByUsername.mockResolvedValue({
      id: 1, name: 'Test', email: 'test@test.com',
      password: 'not-hashed', role: 'admin', companyId: 1,
    });

    const result = await loginUser('test@test.com', 'not-hashed');
    expect(result).toBeNull();
  });

  it('should not return password in user object', async () => {
    const hashedPassword = await bcrypt.hash('password', 10);
    mockStorage.getUserByUsername.mockResolvedValue({
      id: 1, name: 'Test', email: 'test@test.com',
      password: hashedPassword, role: 'admin', companyId: 1,
      areaId: null, lastLogin: null, isActive: true,
    });
    mockStorage.updateUser.mockResolvedValue({});

    const result = await loginUser('test@test.com', 'password');
    if (result) {
      expect(result.user.password).toBeUndefined();
    }
  });

  it('should handle database errors', async () => {
    mockStorage.getUserByUsername.mockRejectedValue(new Error('DB connection lost'));
    const result = await loginUser('test@test.com', 'password');
    expect(result).toBeNull();
  });

  it('should update lastLogin timestamp', async () => {
    const hashedPassword = await bcrypt.hash('password', 10);
    mockStorage.getUserByUsername.mockResolvedValue({
      id: 5, name: 'Test', email: 'test@test.com',
      password: hashedPassword, role: 'viewer', companyId: 2,
      areaId: null, lastLogin: null, isActive: true,
    });
    mockStorage.updateUser.mockResolvedValue({});

    await loginUser('test@test.com', 'password');
    expect(mockStorage.updateUser).toHaveBeenCalledWith(5, expect.objectContaining({
      lastLogin: expect.any(Date),
    }));
  });

  it('should look up user by username (email)', async () => {
    mockStorage.getUserByUsername.mockResolvedValue(null);
    await loginUser('specific@email.com', 'password');
    expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('specific@email.com');
  });
});
