import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  securityMonitorMiddleware,
  loginMonitorMiddleware,
  uploadMonitorMiddleware,
  apiAccessMonitorMiddleware,
} from '../security-monitor';

describe('Security Monitor', () => {
  let mockReq: any;
  let mockRes: any;
  let next: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: undefined,
      query: {},
      body: {},
      params: {},
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent'),
      file: undefined,
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ===========================================================================
  // securityMonitorMiddleware
  // ===========================================================================

  describe('securityMonitorMiddleware', () => {
    it('should always call next() for unauthenticated requests', () => {
      mockReq.user = undefined;
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should always call next() for authenticated requests', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin', companyId: 1 };
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should log cross-company access attempts (query)', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'viewer', companyId: 1 };
      mockReq.query = { companyId: '2' };
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should log cross-company access attempts (body)', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'viewer', companyId: 1 };
      mockReq.query = {};
      mockReq.body = { companyId: 2 };
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should log admin access to specific company', () => {
      mockReq.user = { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', companyId: 1 };
      mockReq.query = { companyId: '2' };
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should log normal access when user accesses own company', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'viewer', companyId: 1 };
      mockReq.query = { companyId: '1' };
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle null user gracefully', () => {
      mockReq.user = null;
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing user gracefully', () => {
      delete mockReq.user;
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next even when an error occurs in monitoring logic', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin', companyId: 1 };
      // Force an error by making query getter throw
      Object.defineProperty(mockReq, 'query', {
        get() { throw new Error('mock error'); }
      });
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should not block any request regardless of company mismatch', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'viewer', companyId: 3 };
      mockReq.query = { companyId: '99' };
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
      // Verify no status code was set (no blocking)
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle user without companyId', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'viewer' };
      mockReq.query = { companyId: '1' };
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle request with no companyId in query or body', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'viewer', companyId: 1 };
      mockReq.query = {};
      mockReq.body = {};
      securityMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // loginMonitorMiddleware
  // ===========================================================================

  describe('loginMonitorMiddleware', () => {
    it('should always call next()', () => {
      mockReq.body = { email: 'test@test.com' };
      loginMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing email in body', () => {
      mockReq.body = {};
      loginMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should log the login attempt', () => {
      mockReq.body = { email: 'user@test.com' };
      loginMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(console.log).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // uploadMonitorMiddleware
  // ===========================================================================

  describe('uploadMonitorMiddleware', () => {
    it('should always call next() without a file', () => {
      uploadMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should log when file is present', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin' };
      mockReq.file = { originalname: 'test.xlsx', size: 1024 };
      uploadMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle missing user with file', () => {
      mockReq.user = undefined;
      mockReq.file = { originalname: 'data.csv', size: 2048 };
      uploadMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // apiAccessMonitorMiddleware
  // ===========================================================================

  describe('apiAccessMonitorMiddleware', () => {
    it('should always call next()', () => {
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should log access to /api/users endpoint', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin' };
      mockReq.path = '/api/users';
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should log access to /api/companies endpoint', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin' };
      mockReq.path = '/api/companies';
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(console.log).toHaveBeenCalled();
    });

    it('should log access to /api/kpis endpoint', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin' };
      mockReq.path = '/api/kpis';
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(console.log).toHaveBeenCalled();
    });

    it('should log access to /api/shipments endpoint', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin' };
      mockReq.path = '/api/shipments/123';
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(console.log).toHaveBeenCalled();
    });

    it('should log access to /api/clients endpoint', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin' };
      mockReq.path = '/api/clients';
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(console.log).toHaveBeenCalled();
    });

    it('should not log access to non-sensitive endpoints', () => {
      mockReq.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'admin' };
      mockReq.path = '/api/health';
      const logSpy = vi.spyOn(console, 'log');
      const callCountBefore = logSpy.mock.calls.length;
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
      // Should NOT have additional [API ACCESS] log calls for non-sensitive endpoint
      const sensitiveLogCalls = logSpy.mock.calls.slice(callCountBefore).filter(
        call => String(call[0]).includes('[API ACCESS]')
      );
      expect(sensitiveLogCalls).toHaveLength(0);
    });

    it('should handle missing user for sensitive endpoints', () => {
      mockReq.user = undefined;
      mockReq.path = '/api/users';
      apiAccessMonitorMiddleware(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
