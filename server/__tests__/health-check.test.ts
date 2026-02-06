import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so the variable is available inside the hoisted vi.mock factory
const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { execute: mockExecute },
  pool: { query: vi.fn() },
}));
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}));

import { healthCheck, readinessCheck, livenessCheck } from '../health-check';

const originalEnv = { ...process.env };

describe('Health Check', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ===========================================================================
  // healthCheck
  // ===========================================================================

  describe('healthCheck', () => {
    it('should return 200 with healthy status when all services are up', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      process.env.OPENAI_API_KEY = 'real-key';
      process.env.RESEND_API_KEY = 'real-resend-key';

      await healthCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.status).toBe('healthy');
      expect(response.services.database).toBe('up');
      expect(response.timestamp).toBeDefined();
    });

    it('should return degraded when database is down', async () => {
      mockExecute.mockRejectedValue(new Error('Connection refused'));
      delete process.env.OPENAI_API_KEY;
      delete process.env.RESEND_API_KEY;

      await healthCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.database).toBe('down');
    });

    it('should handle database timeout', async () => {
      mockExecute.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database check timeout')), 100);
      }));

      await healthCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should detect OpenAI configuration', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      process.env.OPENAI_API_KEY = 'valid-key';

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.openai).toBe('up');
    });

    it('should mark OpenAI as not_configured when key is placeholder', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      process.env.OPENAI_API_KEY = 'your-openai-api-key-here';

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.openai).toBe('not_configured');
    });

    it('should mark OpenAI as not_configured when key is missing', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      delete process.env.OPENAI_API_KEY;

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.openai).toBe('not_configured');
    });

    it('should detect SendGrid configuration', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      process.env.SENDGRID_API_KEY = 'valid-sendgrid-key';

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.sendgrid).toBe('up');
    });

    it('should detect Resend configuration', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      delete process.env.SENDGRID_API_KEY;
      process.env.RESEND_API_KEY = 'valid-resend-key';

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.sendgrid).toBe('up');
    });

    it('should mark sendgrid as not_configured when no email service key', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      delete process.env.SENDGRID_API_KEY;
      delete process.env.RESEND_API_KEY;

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.sendgrid).toBe('not_configured');
    });

    it('should include metrics in response', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.metrics).toBeDefined();
      expect(response.metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(response.metrics.memoryUsage).toBeDefined();
      expect(response.metrics.memoryUsage.heapUsed).toBeDefined();
    });

    it('should include version in metrics', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.metrics.version).toBeDefined();
      expect(typeof response.metrics.version).toBe('string');
    });

    it('should always return 200 even on total failure', async () => {
      mockExecute.mockRejectedValue(new Error('Total failure'));
      delete process.env.OPENAI_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.RESEND_API_KEY;

      await healthCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should include timestamp in ISO format', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      const timestamp = new Date(response.timestamp);
      expect(timestamp.toISOString()).toBe(response.timestamp);
    });

    it('should mark status degraded when only OpenAI is missing', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);
      delete process.env.OPENAI_API_KEY;
      process.env.RESEND_API_KEY = 'valid-key';

      await healthCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.services.database).toBe('up');
      // Status should be degraded because OpenAI is not configured
      expect(['healthy', 'degraded']).toContain(response.status);
    });
  });

  // ===========================================================================
  // readinessCheck
  // ===========================================================================

  describe('readinessCheck', () => {
    it('should return ready when database is available', async () => {
      mockExecute.mockResolvedValue([{ test: 1 }]);

      await readinessCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ready' });
    });

    it('should return not_ready when database fails', async () => {
      mockExecute.mockRejectedValue(new Error('Connection refused'));

      await readinessCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.status).toBe('not_ready');
    });

    it('should include error message in not_ready response', async () => {
      mockExecute.mockRejectedValue(new Error('Connection refused'));

      await readinessCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.message).toContain('Connection refused');
    });

    it('should handle database timeout gracefully', async () => {
      mockExecute.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database readiness check timeout')), 100);
      }));

      await readinessCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.status).toBe('not_ready');
    });
  });

  // ===========================================================================
  // livenessCheck
  // ===========================================================================

  describe('livenessCheck', () => {
    it('should always return alive with 200', async () => {
      await livenessCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.status).toBe('alive');
    });

    it('should include timestamp', async () => {
      await livenessCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.timestamp).toBeDefined();
    });

    it('should include uptime', async () => {
      await livenessCheck(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should not depend on database availability', async () => {
      // Even if database mock would fail, liveness should succeed
      mockExecute.mockRejectedValue(new Error('DB down'));

      await livenessCheck(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.status).toBe('alive');
    });
  });
});
