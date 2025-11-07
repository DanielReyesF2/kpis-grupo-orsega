/**
 * Tests unitarios para middleware
 * Prueba tenant validation, autenticación JWT, y autorización de roles
 */

import { Request, Response, NextFunction } from 'express';
import { jwtAuthMiddleware, jwtAdminMiddleware, generateToken } from '../../server/auth';
import { validateTenantAccess, validateTenantFromBody, validateTenantFromParams } from '../../server/middleware/tenant-validation';

describe('Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {},
      params: {},
      user: undefined
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    process.env.JWT_SECRET = 'test-secret-key';
  });

  describe('jwtAuthMiddleware', () => {
    it('debe permitir acceso con token JWT válido', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        companyId: 1
      };

      const token = generateToken(user);
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      jwtAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeDefined();
      expect((mockRequest as any).user.id).toBe(user.id);
      expect((mockRequest as any).user.email).toBe(user.email);
    });

    it('debe rechazar requests sin token', () => {
      mockRequest.headers = {};

      jwtAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorized',
          details: 'No authentication token provided'
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('debe rechazar token inválido', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token.here'
      };

      jwtAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorized',
          details: 'Invalid or expired token'
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('debe rechazar token sin formato Bearer', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        companyId: 1
      };

      const token = generateToken(user);
      mockRequest.headers = {
        authorization: token // Sin "Bearer "
      };

      jwtAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('jwtAdminMiddleware', () => {
    it('debe permitir acceso a usuarios admin', () => {
      (mockRequest as any).user = {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        companyId: 1
      };

      jwtAdminMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('debe rechazar acceso a usuarios no-admin', () => {
      (mockRequest as any).user = {
        id: 2,
        name: 'Regular User',
        email: 'user@example.com',
        role: 'viewer',
        companyId: 1
      };

      jwtAdminMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Forbidden: Admin access required'
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('debe rechazar requests sin usuario autenticado', () => {
      mockRequest.user = undefined;

      jwtAdminMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Validation Middleware', () => {
    describe('validateTenantAccess', () => {
      it('debe permitir acceso cuando companyId coincide', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'admin'
        };

        const resourceCompanyId = 1;

        validateTenantAccess(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
          resourceCompanyId
        );

        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });

      it('debe rechazar acceso cuando companyId no coincide', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'viewer'
        };

        const resourceCompanyId = 2; // Diferente company

        validateTenantAccess(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
          resourceCompanyId
        );

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('access denied')
          })
        );
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('debe permitir acceso a admin independientemente de companyId', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'admin'
        };

        const resourceCompanyId = 2; // Diferente company pero es admin

        validateTenantAccess(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
          resourceCompanyId
        );

        // Admins pueden acceder a cualquier company
        expect(nextFunction).toHaveBeenCalled();
      });
    });

    describe('validateTenantFromBody', () => {
      it('debe validar companyId desde request body', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'viewer'
        };
        mockRequest.body = {
          companyId: 1
        };

        validateTenantFromBody(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction
        );

        expect(nextFunction).toHaveBeenCalled();
      });

      it('debe rechazar cuando companyId en body no coincide', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'viewer'
        };
        mockRequest.body = {
          companyId: 2 // Diferente
        };

        validateTenantFromBody(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction
        );

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });

    describe('validateTenantFromParams', () => {
      it('debe validar companyId desde request params', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'viewer'
        };
        mockRequest.params = {
          companyId: '1'
        };

        validateTenantFromParams(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction
        );

        expect(nextFunction).toHaveBeenCalled();
      });

      it('debe rechazar cuando companyId en params no coincide', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'viewer'
        };
        mockRequest.params = {
          companyId: '2' // Diferente
        };

        validateTenantFromParams(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction
        );

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('debe manejar params no numéricos', () => {
        (mockRequest as any).user = {
          id: 1,
          companyId: 1,
          role: 'viewer'
        };
        mockRequest.params = {
          companyId: 'invalid'
        };

        validateTenantFromParams(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction
        );

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });
  });
});
