import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateTenantAccess,
  validateTenantFromBody,
  validateTenantFromQuery,
  validateTenantFromParams,
} from '../middleware/tenant-validation';

describe('Tenant Validation', () => {
  let mockReq: any;
  let mockRes: any;
  let next: any;

  beforeEach(() => {
    mockReq = { user: undefined, body: {}, query: {}, params: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    // Silence console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ===========================================================================
  // validateTenantAccess — direct function
  // ===========================================================================

  describe('validateTenantAccess', () => {
    it('should throw when user is not authenticated', () => {
      mockReq.user = undefined;
      expect(() => validateTenantAccess(mockReq, 1)).toThrow('Unauthorized');
    });

    it('should allow admin to access any company', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      expect(() => validateTenantAccess(mockReq, 2)).not.toThrow();
      expect(() => validateTenantAccess(mockReq, 99)).not.toThrow();
    });

    it('should allow admin to access null companyId', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      expect(() => validateTenantAccess(mockReq, null)).not.toThrow();
      expect(() => validateTenantAccess(mockReq, undefined)).not.toThrow();
    });

    it('should throw Forbidden for non-admin accessing null companyId', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 1 };
      expect(() => validateTenantAccess(mockReq, null)).toThrow('Forbidden');
    });

    it('should throw Forbidden for non-admin accessing undefined companyId', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 1 };
      expect(() => validateTenantAccess(mockReq, undefined)).toThrow('Forbidden');
    });

    it('should allow cross-company access from company 1 to company 2', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 1 };
      expect(() => validateTenantAccess(mockReq, 2)).not.toThrow();
    });

    it('should allow cross-company access from company 2 to company 1', () => {
      mockReq.user = { id: 2, role: 'viewer', email: 'v2@v.com', name: 'V2', companyId: 2 };
      expect(() => validateTenantAccess(mockReq, 1)).not.toThrow();
    });

    it('should allow any user to access company 1 (group company)', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 5 };
      expect(() => validateTenantAccess(mockReq, 1)).not.toThrow();
    });

    it('should allow any user to access company 2 (group company)', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 5 };
      expect(() => validateTenantAccess(mockReq, 2)).not.toThrow();
    });

    it('should block non-admin accessing non-group company with different companyId', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 3 };
      expect(() => validateTenantAccess(mockReq, 5)).toThrow('Forbidden');
    });

    it('should allow user accessing own company (non-group)', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 5 };
      expect(() => validateTenantAccess(mockReq, 5)).not.toThrow();
    });

    it('should block user with null companyId accessing non-group company', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: null };
      expect(() => validateTenantAccess(mockReq, 5)).toThrow('Forbidden');
    });

    it('should block user with no companyId property accessing non-group company', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V' };
      expect(() => validateTenantAccess(mockReq, 5)).toThrow('Forbidden');
    });
  });

  // ===========================================================================
  // validateTenantFromBody — middleware
  // ===========================================================================

  describe('validateTenantFromBody', () => {
    it('should call next for admin with valid companyId in body', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.body = { companyId: 1 };
      validateTenantFromBody()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for unauthorized access', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 3 };
      mockReq.body = { companyId: 5 };
      validateTenantFromBody()(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should parse string companyId to number', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.body = { companyId: '2' };
      validateTenantFromBody()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should use custom field name', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.body = { empresa: 1 };
      validateTenantFromBody('empresa')(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle undefined companyId in body (admin)', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.body = {};
      validateTenantFromBody()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for viewer with undefined companyId in body', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 3 };
      mockReq.body = {};
      validateTenantFromBody()(mockReq, mockRes, next);
      // undefined resourceCompanyId → non-admin → Forbidden
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle empty string companyId as undefined', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.body = { companyId: '' };
      validateTenantFromBody()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle NaN companyId as undefined', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.body = { companyId: 'invalid' };
      validateTenantFromBody()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should include TENANT_ACCESS_DENIED code in 403 response', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 3 };
      mockReq.body = { companyId: 5 };
      validateTenantFromBody()(mockReq, mockRes, next);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TENANT_ACCESS_DENIED' })
      );
    });
  });

  // ===========================================================================
  // validateTenantFromQuery — middleware
  // ===========================================================================

  describe('validateTenantFromQuery', () => {
    it('should validate from query params for admin', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.query = { companyId: '1' };
      validateTenantFromQuery()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing query param (admin)', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.query = {};
      validateTenantFromQuery()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for unauthorized query param access', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 3 };
      mockReq.query = { companyId: '5' };
      validateTenantFromQuery()(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow cross-company access via query for group companies', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 1 };
      mockReq.query = { companyId: '2' };
      validateTenantFromQuery()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should use custom field name in query', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.query = { empresa: '1' };
      validateTenantFromQuery('empresa')(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // validateTenantFromParams — middleware
  // ===========================================================================

  describe('validateTenantFromParams', () => {
    it('should validate from path params for admin', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.params = { companyId: '2' };
      validateTenantFromParams()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for unauthorized path param access', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: 3 };
      mockReq.params = { companyId: '5' };
      validateTenantFromParams()(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle NaN param as undefined (admin allowed)', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.params = { companyId: 'invalid' };
      validateTenantFromParams()(mockReq, mockRes, next);
      // parseInt('invalid') = NaN → treated as undefined → admin allowed
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for viewer with NaN param (treated as undefined)', () => {
      mockReq.user = { id: 1, role: 'viewer', email: 'v@v.com', name: 'V', companyId: null };
      mockReq.params = { companyId: 'invalid' };
      validateTenantFromParams()(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle missing param (admin)', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.params = {};
      validateTenantFromParams()(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should use custom field name in params', () => {
      mockReq.user = { id: 1, role: 'admin', email: 'a@a.com', name: 'A', companyId: 1 };
      mockReq.params = { empresa: '1' };
      validateTenantFromParams('empresa')(mockReq, mockRes, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
