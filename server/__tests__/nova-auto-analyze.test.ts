import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so variables are available in the hoisted vi.mock factories
// ---------------------------------------------------------------------------

const { mockChat, mockIsConfigured, mockAnalysisStore } = vi.hoisted(() => ({
  mockChat: vi.fn(),
  mockIsConfigured: vi.fn(),
  mockAnalysisStore: new Map<string, { result: any; timestamp: number; userId?: string }>(),
}));

vi.mock('../nova/nova-client', () => ({
  novaAIClient: {
    chat: (...args: any[]) => mockChat(...args),
    isConfigured: () => mockIsConfigured(),
  },
}));

vi.mock('../nova/nova-routes', () => ({
  analysisStore: mockAnalysisStore,
}));

import { autoAnalyzeSalesUpload } from '../nova/nova-auto-analyze';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Nova Auto-Analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalysisStore.clear();
    mockIsConfigured.mockReturnValue(true);
    mockChat.mockResolvedValue({
      answer: 'Analysis complete',
      toolsUsed: ['sql_query'],
      source: 'nova-ai-2.0',
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleData = {
    summary: 'Top 5 clients: Acme, Beta, Gamma. Total sales: $500K.',
    rowCount: 1000,
    companies: ['Dura International'],
  };

  it('should return an analysisId', async () => {
    const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-1');
    expect(result.analysisId).toBeDefined();
    expect(result.analysisId.length).toBeGreaterThan(0);
    expect(result.analysisId).toMatch(/^nova-/);
  });

  it('should not return an error when successful', async () => {
    const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-1');
    expect(result.error).toBeUndefined();
  });

  it('should store a result in analysisStore with correct userId', async () => {
    // The async IIFE may complete before we can check "processing",
    // so we verify the entry exists and has the correct userId.
    const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-1');
    // Wait a tick for the async work
    await vi.waitFor(() => {
      const stored = mockAnalysisStore.get(result.analysisId);
      expect(stored).toBeDefined();
    }, { timeout: 2000 });
    const stored = mockAnalysisStore.get(result.analysisId);
    expect(stored!.userId).toBe('user-1');
    // Status should be either 'processing' or 'completed' depending on timing
    expect(['processing', 'completed']).toContain(stored!.result.status);
  });

  it('should store completed result after chat resolves', async () => {
    const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-1');

    // Wait for the background async task to complete
    await vi.waitFor(() => {
      const stored = mockAnalysisStore.get(result.analysisId);
      expect(stored!.result.status).toBe('completed');
    }, { timeout: 2000 });

    const stored = mockAnalysisStore.get(result.analysisId);
    expect(stored!.result.answer).toBe('Analysis complete');
    expect(stored!.result.toolsUsed).toEqual(['sql_query']);
  });

  it('should store error result when Nova AI is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);

    const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-1');

    await vi.waitFor(() => {
      const stored = mockAnalysisStore.get(result.analysisId);
      expect(stored!.result.status).toBe('error');
    }, { timeout: 2000 });
  });

  it('should store error result when chat throws', async () => {
    mockChat.mockRejectedValue(new Error('API timeout'));

    const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-1');

    await vi.waitFor(() => {
      const stored = mockAnalysisStore.get(result.analysisId);
      expect(stored!.result.status).toBe('error');
    }, { timeout: 2000 });

    const stored = mockAnalysisStore.get(result.analysisId);
    expect(stored!.result.error).toBeDefined();
  });

  it('should handle undefined userId', async () => {
    const result = await autoAnalyzeSalesUpload(sampleData, 1, undefined);
    expect(result.analysisId).toBeDefined();
    const stored = mockAnalysisStore.get(result.analysisId);
    expect(stored!.userId).toBeUndefined();
  });

  it('should handle undefined companyId', async () => {
    const result = await autoAnalyzeSalesUpload(sampleData, undefined, 'user-1');
    expect(result.analysisId).toBeDefined();
  });

  it('should handle empty summary', async () => {
    const result = await autoAnalyzeSalesUpload(
      { summary: '', rowCount: 0 },
      1,
      'user-1'
    );
    expect(result.analysisId).toBeDefined();
  });

  it('should generate unique analysisIds for multiple calls', async () => {
    const result1 = await autoAnalyzeSalesUpload(sampleData, 1, 'user-1');
    const result2 = await autoAnalyzeSalesUpload(sampleData, 1, 'user-2');
    expect(result1.analysisId).not.toBe(result2.analysisId);
  });

  // =========================================================================
  // Concurrency guard
  // =========================================================================
  describe('concurrency guard', () => {
    it('should reject when MAX_CONCURRENT_ANALYSES (10) is reached', async () => {
      // Create a long-running mock that doesn't resolve immediately
      let resolvers: (() => void)[] = [];
      mockChat.mockImplementation(() => new Promise<any>((resolve) => {
        resolvers.push(() => resolve({ answer: 'done', toolsUsed: [], source: '' }));
      }));

      // Fire 10 concurrent analyses (they will be pending)
      const promises: Promise<{ analysisId: string; error?: string }>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(autoAnalyzeSalesUpload(sampleData, 1, `user-${i}`));
      }
      // All 10 should succeed
      const results = await Promise.all(promises);
      results.forEach(r => {
        expect(r.analysisId).toBeTruthy();
        expect(r.error).toBeUndefined();
      });

      // The 11th should be rejected because all 10 slots are busy
      const rejected = await autoAnalyzeSalesUpload(sampleData, 1, 'user-overflow');
      expect(rejected.analysisId).toBe('');
      expect(rejected.error).toContain('Demasiados analisis en curso');

      // Now resolve all pending analyses to clean up
      resolvers.forEach(r => r());
      // Wait for all background tasks to complete
      await vi.waitFor(() => {
        // All entries should be completed
        expect(mockAnalysisStore.size).toBeGreaterThanOrEqual(10);
      }, { timeout: 2000 });
    });

    it('should release concurrency slot after successful completion', async () => {
      // Fast-resolving mock
      mockChat.mockResolvedValue({ answer: 'fast', toolsUsed: [], source: '' });

      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-fast');
      expect(result.analysisId).toBeTruthy();

      // Wait for completion
      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      // Should be able to start another analysis (slot released)
      const result2 = await autoAnalyzeSalesUpload(sampleData, 1, 'user-fast-2');
      expect(result2.analysisId).toBeTruthy();
      expect(result2.error).toBeUndefined();
    });

    it('should release concurrency slot after error', async () => {
      mockChat.mockRejectedValue(new Error('Boom'));

      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-err');
      expect(result.analysisId).toBeTruthy();

      // Wait for error to be stored
      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('error');
      }, { timeout: 2000 });

      // Slot should be released, can start another
      mockChat.mockResolvedValue({ answer: 'recovered', toolsUsed: [], source: '' });
      const result2 = await autoAnalyzeSalesUpload(sampleData, 1, 'user-recovered');
      expect(result2.error).toBeUndefined();
    });
  });

  // =========================================================================
  // Store eviction
  // =========================================================================
  describe('store eviction', () => {
    it('should evict the oldest entry when store reaches MAX_ANALYSIS_STORE_SIZE', async () => {
      // Fill the store to capacity (1000)
      for (let i = 0; i < 1000; i++) {
        mockAnalysisStore.set(`old-${i}`, {
          result: { status: 'completed' },
          timestamp: 1000 + i, // Oldest is old-0 with timestamp 1000
          userId: 'bulk',
        });
      }
      expect(mockAnalysisStore.size).toBe(1000);

      // New analysis should trigger eviction of the oldest entry
      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-new');
      expect(result.analysisId).toBeTruthy();

      // old-0 (timestamp=1000) should have been evicted
      expect(mockAnalysisStore.has('old-0')).toBe(false);
      // The new entry should exist
      expect(mockAnalysisStore.has(result.analysisId)).toBe(true);
    });

    it('should not evict when store is below capacity', async () => {
      mockAnalysisStore.set('existing-1', {
        result: { status: 'completed' },
        timestamp: Date.now(),
        userId: 'user-1',
      });

      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-2');
      expect(result.analysisId).toBeTruthy();

      // existing-1 should still be there
      expect(mockAnalysisStore.has('existing-1')).toBe(true);
      expect(mockAnalysisStore.has(result.analysisId)).toBe(true);
    });
  });

  // =========================================================================
  // Result truncation
  // =========================================================================
  describe('result truncation', () => {
    it('should truncate very large analysis results', async () => {
      const largeAnswer = 'x'.repeat(600 * 1024); // 600KB > MAX_RESULT_SIZE (500KB)
      mockChat.mockResolvedValue({ answer: largeAnswer, toolsUsed: [], source: '' });

      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-large');

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      const stored = mockAnalysisStore.get(result.analysisId);
      // Answer should be truncated and contain truncation notice
      expect(stored!.result.answer.length).toBeLessThan(largeAnswer.length);
      expect(stored!.result.answer).toContain('[Respuesta truncada por limite de tamaño]');
    });

    it('should not truncate results within size limit', async () => {
      const normalAnswer = 'Normal sized answer with reasonable content.';
      mockChat.mockResolvedValue({ answer: normalAnswer, toolsUsed: ['tool1'], source: '' });

      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-normal');

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      const stored = mockAnalysisStore.get(result.analysisId);
      expect(stored!.result.answer).toBe(normalAnswer);
    });
  });

  // =========================================================================
  // Summary sanitization
  // =========================================================================
  describe('summary sanitization', () => {
    it('should truncate very long summaries to 5000 chars', async () => {
      const longSummary = 'S'.repeat(10_000);
      const data = { summary: longSummary, rowCount: 1, companies: ['DURA'] };

      const result = await autoAnalyzeSalesUpload(data, 1, 'user-long-summary');
      expect(result.analysisId).toBeTruthy();

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      // Verify the chat was called with truncated prompt
      const chatPrompt = mockChat.mock.calls[0][0] as string;
      expect(chatPrompt.length).toBeLessThan(longSummary.length);
    });

    it('should handle null/undefined summary gracefully', async () => {
      const data = { summary: undefined as any, rowCount: 0 };

      const result = await autoAnalyzeSalesUpload(data, 1, 'user-null-summary');
      expect(result.analysisId).toBeTruthy();

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(['completed', 'error']).toContain(stored!.result.status);
      }, { timeout: 2000 });
    });
  });

  // =========================================================================
  // Analysis status lifecycle
  // =========================================================================
  describe('analysis status lifecycle', () => {
    it('should set initial status to processing before completion', async () => {
      let capturedStatus: string | undefined;
      mockChat.mockImplementation(() => {
        // Check what is stored while the analysis is "in progress"
        for (const [, entry] of mockAnalysisStore) {
          if (entry.result.status === 'processing') {
            capturedStatus = entry.result.status;
          }
        }
        return Promise.resolve({ answer: 'done', toolsUsed: [], source: '' });
      });

      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-lifecycle');

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      expect(capturedStatus).toBe('processing');
    });

    it('should include analysisId in both processing and completed entries', async () => {
      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-id-check');

      // Check processing state
      const processingEntry = mockAnalysisStore.get(result.analysisId);
      expect(processingEntry!.result.analysisId).toBe(result.analysisId);

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      const completedEntry = mockAnalysisStore.get(result.analysisId);
      expect(completedEntry!.result.analysisId).toBe(result.analysisId);
    });

    it('should update timestamp when status changes to completed', async () => {
      const beforeTime = Date.now();

      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-timestamp');

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      const stored = mockAnalysisStore.get(result.analysisId);
      expect(stored!.timestamp).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should preserve userId through status transitions', async () => {
      const result = await autoAnalyzeSalesUpload(sampleData, 1, 'user-preserve');

      await vi.waitFor(() => {
        const stored = mockAnalysisStore.get(result.analysisId);
        expect(stored!.result.status).toBe('completed');
      }, { timeout: 2000 });

      const stored = mockAnalysisStore.get(result.analysisId);
      expect(stored!.userId).toBe('user-preserve');
    });
  });

  // =========================================================================
  // Prompt construction
  // =========================================================================
  describe('prompt construction', () => {
    it('should include companies in the prompt when provided', async () => {
      const data = { summary: 'Test summary', rowCount: 50, companies: ['DURA', 'ORSEGA'] };

      await autoAnalyzeSalesUpload(data, 1, 'user-prompt');

      await vi.waitFor(() => {
        expect(mockChat).toHaveBeenCalled();
      }, { timeout: 2000 });

      const prompt = mockChat.mock.calls[0][0] as string;
      expect(prompt).toContain('DURA, ORSEGA');
      expect(prompt).toContain('50');
    });

    it('should not include companies line when companies not provided', async () => {
      const data = { summary: 'Test', rowCount: 10 };

      await autoAnalyzeSalesUpload(data, 1, 'user-no-companies');

      await vi.waitFor(() => {
        expect(mockChat).toHaveBeenCalled();
      }, { timeout: 2000 });

      const prompt = mockChat.mock.calls[0][0] as string;
      expect(prompt).not.toContain('Empresas:');
    });

    it('should pass correct context to novaAIClient.chat', async () => {
      await autoAnalyzeSalesUpload(sampleData, 2, 'user-ctx');

      await vi.waitFor(() => {
        expect(mockChat).toHaveBeenCalled();
      }, { timeout: 2000 });

      const context = mockChat.mock.calls[0][1];
      expect(context.userId).toBe('user-ctx');
      expect(context.companyId).toBe(2);
      expect(context.pageContext).toBe('sales');
    });
  });
});
