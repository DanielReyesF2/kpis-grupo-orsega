/**
 * Tests unitarios para auth.ts
 * Prueba las funciones de autenticación, hash de passwords, tokens JWT
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, loginUser } from '../../server/auth';

// Mock del storage
const mockStorage = {
  getUserByUsername: jest.fn(),
  updateUser: jest.fn(),
};

jest.mock('../../server/storage', () => ({
  storage: mockStorage
}));

describe('auth.ts', () => {
  const TEST_JWT_SECRET = 'test-secret-key-for-unit-tests';

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('debe generar un token JWT válido', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        companyId: 1
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Verificar que el token puede ser decodificado
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.id).toBe(user.id);
      expect(decoded.name).toBe(user.name);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
      expect(decoded.companyId).toBe(user.companyId);
    });

    it('debe incluir fecha de expiración en el token', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'viewer',
        companyId: 1
      };

      const token = generateToken(user);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('debe generar tokens diferentes para cada llamada', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        companyId: 1
      };

      const token1 = generateToken(user);
      // Esperar 1ms para asegurar timestamp diferente
      const token2 = generateToken(user);

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('debe verificar un token válido correctamente', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        companyId: 1
      };

      const token = generateToken(user);
      const payload = verifyToken(token);

      expect(payload).toBeDefined();
      expect(payload?.id).toBe(user.id);
      expect(payload?.name).toBe(user.name);
      expect(payload?.email).toBe(user.email);
      expect(payload?.role).toBe(user.role);
      expect(payload?.companyId).toBe(user.companyId);
    });

    it('debe retornar null para token inválido', () => {
      const invalidToken = 'invalid.token.here';
      const payload = verifyToken(invalidToken);

      expect(payload).toBeNull();
    });

    it('debe retornar null para token expirado', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        companyId: 1
      };

      // Crear token expirado
      const expiredToken = jwt.sign(user, TEST_JWT_SECRET, { expiresIn: '0s' });

      // Esperar un momento para que expire
      setTimeout(() => {
        const payload = verifyToken(expiredToken);
        expect(payload).toBeNull();
      }, 100);
    });

    it('debe retornar null para token vacío', () => {
      const payload = verifyToken('');
      expect(payload).toBeNull();
    });

    it('debe retornar null para token con firma incorrecta', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        companyId: 1
      };

      // Token firmado con secreto diferente
      const tokenWithWrongSecret = jwt.sign(user, 'wrong-secret', { expiresIn: '1h' });
      const payload = verifyToken(tokenWithWrongSecret);

      expect(payload).toBeNull();
    });
  });

  describe('loginUser', () => {
    it('debe retornar token y usuario para credenciales válidas', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'admin',
        companyId: 1,
        areaId: null,
        lastLogin: null
      };

      mockStorage.getUserByUsername.mockResolvedValue(mockUser);
      mockStorage.updateUser.mockResolvedValue(mockUser);

      const result = await loginUser('test@example.com', 'password123');

      expect(result).not.toBeNull();
      expect(result?.token).toBeDefined();
      expect(result?.user).toBeDefined();
      expect(result?.user.password).toBeUndefined(); // Password no debe retornarse
      expect(result?.user.id).toBe(mockUser.id);
      expect(result?.user.email).toBe(mockUser.email);

      // Verificar que se actualizó lastLogin
      expect(mockStorage.updateUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ lastLogin: expect.any(Date) })
      );
    });

    it('debe retornar null para usuario inexistente', async () => {
      mockStorage.getUserByUsername.mockResolvedValue(null);

      const result = await loginUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
      expect(mockStorage.updateUser).not.toHaveBeenCalled();
    });

    it('debe retornar null para contraseña incorrecta', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'admin',
        companyId: 1,
        areaId: null,
        lastLogin: null
      };

      mockStorage.getUserByUsername.mockResolvedValue(mockUser);

      const result = await loginUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
      expect(mockStorage.updateUser).not.toHaveBeenCalled();
    });

    it('debe rechazar passwords no hasheadas con bcrypt (seguridad)', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password: 'plaintext-password', // NO hasheada
        role: 'admin',
        companyId: 1,
        areaId: null,
        lastLogin: null
      };

      mockStorage.getUserByUsername.mockResolvedValue(mockUser);

      const result = await loginUser('test@example.com', 'plaintext-password');

      expect(result).toBeNull();
      expect(mockStorage.updateUser).not.toHaveBeenCalled();
    });

    it('debe manejar errores de base de datos correctamente', async () => {
      mockStorage.getUserByUsername.mockRejectedValue(new Error('Database error'));

      const result = await loginUser('test@example.com', 'password123');

      expect(result).toBeNull();
    });
  });

  describe('bcrypt password hashing', () => {
    it('debe hashear passwords correctamente', async () => {
      const password = 'testPassword123!';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    });

    it('debe verificar passwords hasheadas correctamente', async () => {
      const password = 'testPassword123!';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('debe generar hashes diferentes para la misma password (salt)', async () => {
      const password = 'testPassword123!';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);

      expect(hash1).not.toBe(hash2);

      // Pero ambos deben validar correctamente
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });
});
