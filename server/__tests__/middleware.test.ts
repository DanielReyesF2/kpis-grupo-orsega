import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockStorage } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-key';
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
vi.mock('../db', () => ({
  db: { execute: vi.fn() },
  pool: { query: vi.fn() },
}));
vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
  Pool: vi.fn(),
}));
vi.mock('ws', () => ({ default: class {} }));

import { jwtAuthMiddleware, jwtAdminMiddleware, generateToken } from '../auth';
import { validateTenantAccess, validateTenantFromBody, validateTenantFromQuery, validateTenantFromParams } from '../middleware/tenant-validation';

describe('Middleware Tests', () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: NextFunction;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    mockRequest = { headers: {}, body: {}, params: {}, query: {}, user: undefined };
    mockResponse = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    nextFunction = vi.fn();
  });

  describe('jwtAuthMiddleware', () => {
    it('should allow access with valid JWT token', () => {
      const user = { id: 1, name: 'Test User', email: 'test@example.com', role: 'admin', companyId: 1 };
      const token = generateToken(user);
      mockRequest.headers = { authorization: `Bearer ${token}` };
      jwtAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user.id).toBe(user.id);
    });

    it('should reject requests without token', () => {
      mockRequest.headers = {};
      jwtAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid.token.here' };
      jwtAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject token without Bearer prefix', () => {
      const user = { id: 1, name: 'Test User', email: 'test@example.com', role: 'admin', companyId: 1 };
      const token = generateToken(user);
      mockRequest.headers = { authorization: token };
      jwtAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('jwtAdminMiddleware', () => {
    it('should allow access for admin users', () => {
      mockRequest.user = { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', companyId: 1 };
      jwtAdminMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject non-admin users', () => {
      mockRequest.user = { id: 2, name: 'Viewer', email: 'viewer@test.com', role: 'viewer', companyId: 1 };
      jwtAdminMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      mockRequest.user = undefined;
      jwtAdminMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Validation', () => {
    describe('validateTenantAccess', () => {
      it('should allow admin access to any company', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'admin', email: 'a@a.com', name: 'A' };
        expect(() => validateTenantAccess(mockRequest, 2)).not.toThrow();
      });

      it('should allow cross-company access for companies 1 and 2', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'viewer', email: 'v@v.com', name: 'V' };
        expect(() => validateTenantAccess(mockRequest, 2)).not.toThrow();
      });

      it('should allow access to company 1 for any group user', () => {
        mockRequest.user = { id: 1, companyId: 2, role: 'viewer', email: 'v@v.com', name: 'V' };
        expect(() => validateTenantAccess(mockRequest, 1)).not.toThrow();
      });

      it('should throw for non-admin accessing null companyId', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'viewer', email: 'v@v.com', name: 'V' };
        expect(() => validateTenantAccess(mockRequest, null)).toThrow('Forbidden');
      });

      it('should allow admin accessing null companyId', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'admin', email: 'a@a.com', name: 'A' };
        expect(() => validateTenantAccess(mockRequest, null)).not.toThrow();
      });

      it('should throw when user is not authenticated', () => {
        mockRequest.user = undefined;
        expect(() => validateTenantAccess(mockRequest, 1)).toThrow('Unauthorized');
      });

      it('should block non-group company access for user without matching companyId', () => {
        mockRequest.user = { id: 1, companyId: 3, role: 'viewer', email: 'v@v.com', name: 'V' };
        expect(() => validateTenantAccess(mockRequest, 5)).toThrow('Forbidden');
      });

      it('should allow access when user companyId matches resource companyId (non-group)', () => {
        mockRequest.user = { id: 1, companyId: 5, role: 'viewer', email: 'v@v.com', name: 'V' };
        expect(() => validateTenantAccess(mockRequest, 5)).not.toThrow();
      });
    });

    describe('validateTenantFromBody', () => {
      it('should call next for valid access', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'admin', email: 'a@a.com', name: 'A' };
        mockRequest.body = { companyId: 1 };
        const middleware = validateTenantFromBody();
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
      });

      it('should return 403 for unauthorized access to non-group company', () => {
        mockRequest.user = { id: 1, companyId: 3, role: 'viewer', email: 'v@v.com', name: 'V' };
        mockRequest.body = { companyId: 5 };
        const middleware = validateTenantFromBody();
        middleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should parse string companyId from body', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'admin', email: 'a@a.com', name: 'A' };
        mockRequest.body = { companyId: '1' };
        const middleware = validateTenantFromBody();
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
      });
    });

    describe('validateTenantFromQuery', () => {
      it('should validate companyId from query', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'admin', email: 'a@a.com', name: 'A' };
        mockRequest.query = { companyId: '1' };
        const middleware = validateTenantFromQuery();
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
      });
    });

    describe('validateTenantFromParams', () => {
      it('should validate companyId from params', () => {
        mockRequest.user = { id: 1, companyId: 1, role: 'admin', email: 'a@a.com', name: 'A' };
        mockRequest.params = { companyId: '1' };
        const middleware = validateTenantFromParams();
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
      });

      it('should handle invalid params', () => {
        mockRequest.user = { id: 1, companyId: null, role: 'viewer', email: 'v@v.com', name: 'V' };
        mockRequest.params = { companyId: 'invalid' };
        const middleware = validateTenantFromParams();
        middleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(403);
      });
    });
  });
});
