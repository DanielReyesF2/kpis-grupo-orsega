import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Save original env
const originalEnv = { ...process.env };

describe('Nova AI Client', () => {
  let mockFetch: any;

  beforeEach(() => {
    vi.resetModules();
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    process.env.NOVA_AI_URL = 'http://nova-test.local';
    process.env.NOVA_AI_API_KEY = 'test-key';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  // Helper to get a fresh copy of the module
  async function getClient() {
    const { novaAIClient } = await import('../nova/nova-client');
    return novaAIClient;
  }

  // ===========================================================================
  // isConfigured
  // ===========================================================================

  describe('isConfigured', () => {
    it('should return true when both NOVA_AI_URL and NOVA_AI_API_KEY are set', async () => {
      const client = await getClient();
      expect(client.isConfigured()).toBe(true);
    });

    it('should return false when NOVA_AI_URL is missing', async () => {
      delete process.env.NOVA_AI_URL;
      const client = await getClient();
      expect(client.isConfigured()).toBe(false);
    });

    it('should return false when NOVA_AI_API_KEY is missing', async () => {
      delete process.env.NOVA_AI_API_KEY;
      const client = await getClient();
      expect(client.isConfigured()).toBe(false);
    });

    it('should return false when both env vars are missing', async () => {
      delete process.env.NOVA_AI_URL;
      delete process.env.NOVA_AI_API_KEY;
      const client = await getClient();
      expect(client.isConfigured()).toBe(false);
    });
  });

  // ===========================================================================
  // healthCheck
  // ===========================================================================

  describe('healthCheck', () => {
    it('should return true on 200 response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const client = await getClient();
      const result = await client.healthCheck();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://nova-test.local/health',
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('should return false when not configured', async () => {
      delete process.env.NOVA_AI_URL;
      const client = await getClient();
      const result = await client.healthCheck();
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      const client = await getClient();
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const client = await getClient();
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // chat (non-streaming)
  // ===========================================================================

  describe('chat', () => {
    it('should send correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'test answer', tools_used: [], source: 'nova-ai-2.0' }),
      });

      const client = await getClient();
      await client.chat('Hello', { userId: 'user-1', companyId: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://nova-test.local/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );

      // Verify request body
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.message).toBe('Hello');
      expect(body.stream).toBe(false);
      expect(body.user_id).toBe('user-1');
      expect(body.company_id).toBe('1');
    });

    it('should parse response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: 'Analysis complete',
          toolsUsed: ['sql_query', 'chart_gen'],
          source: 'nova-ai-2.0',
        }),
      });

      const client = await getClient();
      const result = await client.chat('Analyze data', {});
      expect(result.answer).toBe('Analysis complete');
      expect(result.toolsUsed).toEqual(['sql_query', 'chart_gen']);
      expect(result.source).toBe('nova-ai-2.0');
    });

    it('should handle tools_used snake_case fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: 'Done',
          tools_used: ['tool_a'],
          source: 'nova-ai-2.0',
        }),
      });

      const client = await getClient();
      const result = await client.chat('test', {});
      expect(result.toolsUsed).toEqual(['tool_a']);
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const client = await getClient();
      await expect(client.chat('test', {})).rejects.toThrow('Nova AI 500');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const client = await getClient();
      await expect(client.chat('test', {})).rejects.toThrow('Network failure');
    });

    it('should handle missing fields with defaults', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const client = await getClient();
      const result = await client.chat('test', {});
      expect(result.answer).toBe('');
      expect(result.toolsUsed).toEqual([]);
      expect(result.source).toBe('nova-ai-2.0');
    });

    it('should include X-Tenant-ID header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: '' }),
      });

      const client = await getClient();
      await client.chat('test', {});

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Tenant-ID']).toBeDefined();
    });
  });

  // ===========================================================================
  // streamChat — SSE parsing
  // ===========================================================================

  describe('streamChat', () => {
    /**
     * Helper: Build a ReadableStream from SSE event strings.
     * Each call to reader.read() returns the next chunk.
     */
    function buildStream(chunks: string[]) {
      let i = 0;
      const encoder = new TextEncoder();
      return {
        getReader() {
          return {
            read: async () => {
              if (i < chunks.length) {
                return { done: false, value: encoder.encode(chunks[i++]) };
              }
              return { done: true, value: undefined };
            },
          };
        },
      };
    }

    it('should parse token events', async () => {
      const tokens: string[] = [];
      const callbacks = {
        onToken: (text: string) => tokens.push(text),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: buildStream([
          'event: token\ndata: {"text":"Hello"}\n\nevent: token\ndata: {"text":" World"}\n\n',
          'event: done\ndata: {"answer":"Hello World","toolsUsed":[],"source":"nova-ai-2.0"}\n\n',
        ]),
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(tokens).toEqual(['Hello', ' World']);
      expect(callbacks.onDone).toHaveBeenCalledWith(
        expect.objectContaining({ answer: 'Hello World' })
      );
    });

    it('should parse tool_start events', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: buildStream([
          'event: tool_start\ndata: {"tool":"sql_query"}\n\n',
          'event: done\ndata: {"answer":"","toolsUsed":["sql_query"],"source":"nova-ai-2.0"}\n\n',
        ]),
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(callbacks.onToolStart).toHaveBeenCalledWith('sql_query');
    });

    it('should parse tool_result events', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: buildStream([
          'event: tool_result\ndata: {"tool":"sql_query","success":true}\n\n',
          'event: done\ndata: {"answer":"","toolsUsed":[],"source":"nova-ai-2.0"}\n\n',
        ]),
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(callbacks.onToolResult).toHaveBeenCalledWith('sql_query', true);
    });

    it('should parse error events', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: buildStream([
          'event: error\ndata: {"message":"Something went wrong"}\n\n',
        ]),
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Something went wrong' })
      );
    });

    it('should synthesize done event when stream ends without one', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: buildStream([
          'event: token\ndata: {"text":"partial"}\n\n',
        ]),
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(callbacks.onDone).toHaveBeenCalledWith(
        expect.objectContaining({ answer: '', toolsUsed: [] })
      );
    });

    it('should call onError when fetch returns non-OK response', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('500') })
      );
    });

    it('should call onError when response has no body', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('no body') })
      );
    });

    it('should handle abort signal', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      const abortController = new AbortController();
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      mockFetch.mockRejectedValueOnce(abortError);

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks, abortController.signal);

      // AbortError should not trigger onError
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('should call onError on network errors during streaming', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockRejectedValueOnce(new Error('Connection reset'));

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Connection reset' })
      );
    });

    it('should ignore malformed JSON in SSE data', async () => {
      const tokens: string[] = [];
      const callbacks = {
        onToken: (text: string) => tokens.push(text),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: buildStream([
          'event: token\ndata: {broken json}\n\nevent: token\ndata: {"text":"valid"}\n\n',
          'event: done\ndata: {"answer":"valid","toolsUsed":[],"source":"nova-ai-2.0"}\n\n',
        ]),
      });

      const client = await getClient();
      await client.streamChat('test', [], {}, callbacks);

      // Malformed JSON should be silently skipped, valid token should be parsed
      expect(tokens).toEqual(['valid']);
    });
  });
});
