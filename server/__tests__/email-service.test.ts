import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so mockSend is available inside hoisted vi.mock factories
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
    constructor(_apiKey?: string) {}
  },
}));

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// We need to reset modules to test constructor behavior with different env vars
const originalEnv = { ...process.env };

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.CLIENT_DOMAIN = 'testdomain.com';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  // =========================================================================
  // Constructor / Initialization (4 tests)
  // =========================================================================

  describe('EmailService constructor', () => {
    it('should initialize with valid API key', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      const { emailService } = await import('../email-service');
      expect(emailService.isEmailConfigured()).toBe(true);
    });

    it('should not initialize with placeholder API key', async () => {
      process.env.RESEND_API_KEY = 'your-resend-api-key-here';
      vi.resetModules();
      const { emailService } = await import('../email-service');
      expect(emailService.isEmailConfigured()).toBe(false);
    });

    it('should not initialize without API key', async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();
      const { emailService } = await import('../email-service');
      expect(emailService.isEmailConfigured()).toBe(false);
    });

    it('should not initialize with empty string API key', async () => {
      process.env.RESEND_API_KEY = '';
      vi.resetModules();
      const { emailService } = await import('../email-service');
      expect(emailService.isEmailConfigured()).toBe(false);
    });
  });

  // =========================================================================
  // sendEmail — core behavior (10 tests)
  // =========================================================================

  describe('sendEmail', () => {
    it('should send email when configured', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-123' } });

      const { emailService } = await import('../email-service');
      const result = await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should simulate sending when not configured', async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();

      const { emailService } = await import('../email-service');
      const result = await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('simulated');
    });

    it('should include simulation warning in error field when not configured', async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();

      const { emailService } = await import('../email-service');
      const result = await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('modo simula');
    });

    it('should handle send errors', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockRejectedValue(new Error('Network error'));

      const { emailService } = await import('../email-service');
      const result = await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle domain verification errors', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockRejectedValue(new Error('Domain not verified'));

      const { emailService } = await import('../email-service');
      const result = await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('dominio');
    });

    it('should handle unauthorized errors as domain errors', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockRejectedValue(new Error('Unauthorized sender'));

      const { emailService } = await import('../email-service');
      const result = await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Error de dominio');
    });

    it('should use test email when USE_RESEND_TEST_EMAIL is true', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      process.env.USE_RESEND_TEST_EMAIL = 'true';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-test' } });

      const { emailService } = await import('../email-service');
      await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('resend.dev'),
        })
      );
    });

    it('should use custom from email when specified', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-custom' } });

      const { emailService } = await import('../email-service');
      await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
        from: 'custom@example.com',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@example.com',
        })
      );
    });

    it('should use treasury department email by default', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      delete process.env.USE_RESEND_TEST_EMAIL;
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-treasury' } });

      const { emailService } = await import('../email-service');
      await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }, 'treasury');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('dolores'),
        })
      );
    });

    it('should use logistics department email when specified', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      delete process.env.USE_RESEND_TEST_EMAIL;
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-logistics' } });

      const { emailService } = await import('../email-service');
      await emailService.sendEmail({
        to: 'test@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }, 'logistics');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('jesusmarquez'),
        })
      );
    });
  });

  // =========================================================================
  // Convenience methods (4 tests)
  // =========================================================================

  describe('sendPaymentReminder', () => {
    it('should send payment reminder email with correct subject and recipient', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-reminder' } });

      const { emailService } = await import('../email-service');
      const result = await emailService.sendPaymentReminder(
        'client@test.com', 'Client Name', 5000, '2025-06-30'
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@test.com',
          subject: expect.stringContaining('Recordatorio de Pago'),
        })
      );
    });
  });

  describe('sendComplementRequest', () => {
    it('should send complement request email with voucher ID in body', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-complement' } });

      const { emailService } = await import('../email-service');
      const result = await emailService.sendComplementRequest(
        'client@test.com', 'Client Name', 'VOUCHER-001'
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@test.com',
          subject: expect.stringContaining('Complemento'),
          html: expect.stringContaining('VOUCHER-001'),
        })
      );
    });
  });

  describe('sendPaymentConfirmation', () => {
    it('should send payment confirmation email with reference', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-confirm' } });

      const { emailService } = await import('../email-service');
      const result = await emailService.sendPaymentConfirmation(
        'client@test.com', 'Client Name', 10000, 'REF-001'
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('REF-001'),
        })
      );
    });
  });

  describe('sendShipmentUpdate', () => {
    it('should send shipment update email with tracking number', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-shipment' } });

      const { emailService } = await import('../email-service');
      const result = await emailService.sendShipmentUpdate(
        'client@test.com', 'Client Name', 'SHIP-001', 'En tránsito', 'TRACK-123'
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('TRACK-123'),
        })
      );
    });
  });

  describe('sendDeliveryNotification', () => {
    it('should send delivery notification with date and time slot', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      mockSend.mockResolvedValue({ data: { id: 'msg-delivery' } });

      const { emailService } = await import('../email-service');
      const result = await emailService.sendDeliveryNotification(
        'client@test.com', 'Client Name', '2025-07-15', '10:00-12:00'
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('2025-07-15'),
        })
      );
    });
  });

  // =========================================================================
  // isEmailConfigured (2 tests)
  // =========================================================================

  describe('isEmailConfigured', () => {
    it('should return true when configured', async () => {
      process.env.RESEND_API_KEY = 'valid-key';
      vi.resetModules();
      const { emailService } = await import('../email-service');
      expect(emailService.isEmailConfigured()).toBe(true);
    });

    it('should return false when not configured', async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();
      const { emailService } = await import('../email-service');
      expect(emailService.isEmailConfigured()).toBe(false);
    });
  });
});
