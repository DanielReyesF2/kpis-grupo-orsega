import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for nova-voucher-analyze.ts background analysis.
 * Tests concurrency guard, configuration check, error handling, and prompt construction.
 */

// Mock the nova-client module before importing
vi.mock('../nova/nova-client', () => ({
  novaAIClient: {
    isConfigured: vi.fn(),
    chat: vi.fn(),
  },
}));

import { analyzeVoucherBackground } from '../nova/nova-voucher-analyze';
import { novaAIClient } from '../nova/nova-client';

const mockedIsConfigured = vi.mocked(novaAIClient.isConfigured);
const mockedChat = vi.mocked(novaAIClient.chat);

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsConfigured.mockReturnValue(true);
  mockedChat.mockResolvedValue({ answer: 'ok', toolsUsed: [], source: 'nova-ai-2.0' });
});

describe('analyzeVoucherBackground', () => {
  it('should call novaAIClient.chat with correct prompt', async () => {
    analyzeVoucherBackground({
      voucherId: 123,
      scheduledPaymentId: 456,
      fileName: 'comprobante.pdf',
      fileUrl: '/uploads/comprobantes/2026/01/comprobante.pdf',
      companyId: 1,
      userId: '10',
    });

    // Wait for the async IIFE to complete
    await vi.waitFor(() => {
      expect(mockedChat).toHaveBeenCalledTimes(1);
    });

    const [prompt, context] = mockedChat.mock.calls[0];
    expect(prompt).toContain('voucher ID: 123');
    expect(prompt).toContain('comprobante.pdf');
    expect(prompt).toContain('pago programado ID: 456');
    expect(prompt).toContain('Empresa ID: 1');
    expect(context.userId).toBe('10');
    expect(context.companyId).toBe(1);
    expect(context.pageContext).toBe('treasury');
  });

  it('should not include scheduledPaymentId line when not provided', async () => {
    analyzeVoucherBackground({
      voucherId: 789,
      fileName: 'recibo.png',
      fileUrl: '/uploads/recibo.png',
      companyId: 2,
    });

    await vi.waitFor(() => {
      expect(mockedChat).toHaveBeenCalledTimes(1);
    });

    const [prompt] = mockedChat.mock.calls[0];
    expect(prompt).not.toContain('pago programado ID');
  });

  it('should not fire if Nova AI is not configured', () => {
    mockedIsConfigured.mockReturnValue(false);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    analyzeVoucherBackground({
      voucherId: 1,
      fileName: 'test.pdf',
      fileUrl: '/test',
      companyId: 1,
    });

    expect(mockedChat).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('not configured')
    );

    consoleSpy.mockRestore();
  });

  it('should log errors but not propagate them', async () => {
    mockedChat.mockRejectedValue(new Error('Network timeout'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    analyzeVoucherBackground({
      voucherId: 999,
      fileName: 'bad.pdf',
      fileUrl: '/bad',
      companyId: 1,
    });

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Voucher 999 analysis error'),
        'Network timeout'
      );
    });

    consoleSpy.mockRestore();
  });
});
