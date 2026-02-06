import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---- Helper ----
function createTestApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ---- Mocks (must be before route import) ----

vi.mock('../../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getUsers: vi.fn(),
  },
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    next();
  },
  jwtAdminMiddleware: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
  },
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
  verifyToken: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
  Pool: vi.fn(),
}));
vi.mock('ws', () => ({ default: class {} }));
vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: { query: vi.fn() },
}));

const { mockIsConfigured, mockStreamChat, mockChat, mockHealthCheck } = vi.hoisted(() => ({
  mockIsConfigured: vi.fn().mockReturnValue(true),
  mockStreamChat: vi.fn(),
  mockChat: vi.fn(),
  mockHealthCheck: vi.fn(),
}));

vi.mock('../../nova/nova-client', () => ({
  novaAIClient: {
    isConfigured: mockIsConfigured,
    streamChat: mockStreamChat,
    chat: mockChat,
    healthCheck: mockHealthCheck,
  },
}));
vi.mock('../../nova/sse-utils', () => ({
  sanitizeSSE: vi.fn((s: string) => s),
}));
vi.mock('express-rate-limit', () => ({
  default: () => (req: any, res: any, next: any) => next(),
}));
vi.mock('multer', () => {
  const multer = () => ({
    array: () => (req: any, res: any, next: any) => { req.files = []; next(); },
    single: () => (req: any, res: any, next: any) => next(),
  });
  multer.memoryStorage = () => ({});
  return { default: multer };
});
vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('node-cache', () => ({
  default: class FakeNodeCache { flushAll() {} get() {} set() {} },
}));

import { novaRouter, analysisStore } from '../../nova/nova-routes';

const app = createTestApp(novaRouter);

describe('Nova Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analysisStore.clear();
    mockIsConfigured.mockReturnValue(true);
  });

  // =========================================================================
  // POST /api/nova/chat
  // =========================================================================
  describe('POST /api/nova/chat', () => {
    it('should set SSE headers on the response', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'Hello!', toolsUsed: [], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Hello Nova' });

      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.headers['cache-control']).toContain('no-cache');
    });

    it('should return SSE error event when message is missing', async () => {
      const res = await request(app)
        .post('/api/nova/chat')
        .send({});

      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Mensaje requerido');
    });

    it('should return SSE error event when message is not a string', async () => {
      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 12345 });

      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Mensaje requerido');
    });

    it('should return SSE error when Nova AI is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Hello' });

      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Nova AI no esta configurado');
    });

    it('should call streamChat and return done event with the response', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'Response!', toolsUsed: ['smart_query'], source: 'db' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'What are the sales KPIs?' });

      expect(res.text).toContain('event: done');
      expect(res.text).toContain('Response!');
      expect(mockStreamChat).toHaveBeenCalledTimes(1);

      const callArgs = mockStreamChat.mock.calls[0];
      expect(callArgs[0]).toBe('What are the sales KPIs?');
    });

    it('should send SSE error event when streamChat throws', async () => {
      mockStreamChat.mockRejectedValue(new Error('Connection failed'));

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Hello' });

      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Error interno del servidor');
    });
  });

  // =========================================================================
  // GET /api/nova/analysis/:id
  // =========================================================================
  describe('GET /api/nova/analysis/:id', () => {
    it('should return 404 when analysis id does not exist', async () => {
      const res = await request(app).get('/api/nova/analysis/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Analisis no encontrado o aun en proceso');
    });

    it('should return analysis result when it exists and belongs to the user', async () => {
      const analysisResult = { summary: 'KPI analysis results', data: [1, 2, 3] };
      analysisStore.set('test-analysis-1', {
        result: analysisResult,
        timestamp: Date.now(),
        userId: '1',
      });

      const res = await request(app).get('/api/nova/analysis/test-analysis-1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(analysisResult);
    });

    it('should return 403 when analysis belongs to a different user', async () => {
      analysisStore.set('other-user-analysis', {
        result: { summary: 'Private data' },
        timestamp: Date.now(),
        userId: '999', // Different from auth user id=1
      });

      const res = await request(app).get('/api/nova/analysis/other-user-analysis');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'No autorizado para acceder a este analisis');
    });

    it('should allow access when analysis has no userId (legacy/broadcast)', async () => {
      analysisStore.set('legacy-analysis', {
        result: { summary: 'Legacy analysis result' },
        timestamp: Date.now(),
        userId: undefined,
      });

      const res = await request(app).get('/api/nova/analysis/legacy-analysis');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary', 'Legacy analysis result');
    });

    it('should return the correct result data structure', async () => {
      const fullResult = {
        status: 'completed',
        analysisId: 'test-full',
        answer: 'Full analysis answer',
        toolsUsed: ['sql_query', 'chart'],
      };
      analysisStore.set('test-full', {
        result: fullResult,
        timestamp: Date.now(),
        userId: '1',
      });

      const res = await request(app).get('/api/nova/analysis/test-full');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(fullResult);
      expect(res.body.toolsUsed).toHaveLength(2);
    });
  });

  // =========================================================================
  // POST /api/nova/chat — SSE streaming edge cases
  // =========================================================================
  describe('POST /api/nova/chat — SSE streaming edge cases', () => {
    it('should reject messages exceeding MAX_MESSAGE_LENGTH (10000 chars)', async () => {
      const longMessage = 'a'.repeat(10_001);

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: longMessage });

      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Mensaje muy largo');
    });

    it('should accept messages exactly at MAX_MESSAGE_LENGTH', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'OK', toolsUsed: [], source: '' });
        }
      );

      const exactMessage = 'a'.repeat(10_000);

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: exactMessage });

      expect(res.text).toContain('event: done');
      expect(mockStreamChat).toHaveBeenCalledTimes(1);
    });

    it('should parse conversationHistory from JSON string', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'with history', toolsUsed: [], source: '' });
        }
      );

      const history = JSON.stringify([
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ]);

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Follow up', conversationHistory: history });

      expect(res.text).toContain('event: done');
      // Verify the history was passed correctly (sliced to last 10)
      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.conversationHistory).toHaveLength(2);
      expect(callOpts.conversationHistory[0].role).toBe('user');
    });

    it('should handle invalid JSON in conversationHistory gracefully', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'Still works', toolsUsed: [], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Hello', conversationHistory: 'not-valid-json' });

      expect(res.text).toContain('event: done');
      // Should proceed with empty history
      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.conversationHistory).toEqual([]);
    });

    it('should filter invalid entries from conversationHistory', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'filtered', toolsUsed: [], source: '' });
        }
      );

      const history = JSON.stringify([
        { role: 'user', content: 'Valid' },
        { role: 'system', content: 'Invalid role' },
        { role: 'user', content: 123 },            // Invalid content type
        { role: 'assistant', content: 'Valid too' },
        null,                                         // null entry
        'string-entry',                               // wrong shape
      ]);

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Test', conversationHistory: history });

      expect(res.text).toContain('event: done');
      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.conversationHistory).toHaveLength(2);
    });

    it('should truncate pageContext to 100 chars', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'ctx', toolsUsed: [], source: '' });
        }
      );

      const longContext = 'x'.repeat(200);

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Hi', pageContext: longContext });

      expect(res.text).toContain('event: done');
      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.pageContext).toHaveLength(100);
    });

    it('should handle non-string pageContext by defaulting to empty string', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'ok', toolsUsed: [], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Hi', pageContext: 12345 });

      expect(res.text).toContain('event: done');
      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.pageContext).toBe('');
    });

    it('should emit token events during streaming', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onToken('Hello ');
          callbacks.onToken('world!');
          callbacks.onDone({ answer: 'Hello world!', toolsUsed: [], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Stream test' });

      expect(res.text).toContain('event: token');
      expect(res.text).toContain('"text":"Hello "');
      expect(res.text).toContain('"text":"world!"');
      expect(res.text).toContain('event: done');
    });

    it('should emit tool_start and tool_result events', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onToolStart('smart_query');
          callbacks.onToolResult('smart_query', true);
          callbacks.onDone({ answer: 'Done', toolsUsed: ['smart_query'], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Tool test' });

      expect(res.text).toContain('event: tool_start');
      expect(res.text).toContain('"tool":"smart_query"');
      expect(res.text).toContain('event: tool_result');
      expect(res.text).toContain('"success":true');
    });

    it('should handle onError callback from streamChat', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onError(new Error('Nova service unavailable'));
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Error callback test' });

      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Nova service unavailable');
    });

    it('should handle onError with missing message', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onError({});
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Error no message' });

      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Error procesando solicitud');
    });

    it('should pass userId and companyId to streamChat options', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'ok', toolsUsed: [], source: '' });
        }
      );

      await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Param check' });

      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.userId).toBe('1');
      expect(callOpts.companyId).toBe(1);
    });

    it('should pass empty files array when no files are uploaded', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'no files', toolsUsed: [], source: '' });
        }
      );

      await request(app)
        .post('/api/nova/chat')
        .send({ message: 'No files' });

      const filesArg = mockStreamChat.mock.calls[0][1];
      expect(filesArg).toEqual([]);
    });

    it('should limit conversationHistory to last 10 entries', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'sliced', toolsUsed: [], source: '' });
        }
      );

      const history = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      await request(app)
        .post('/api/nova/chat')
        .send({ message: 'History limit', conversationHistory: JSON.stringify(history) });

      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.conversationHistory).toHaveLength(10);
      // Should be the LAST 10 entries
      expect(callOpts.conversationHistory[0].content).toBe('Message 10');
    });

    it('should handle non-Error throw from streamChat', async () => {
      mockStreamChat.mockRejectedValue('string error');

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Non-error throw' });

      expect(res.text).toContain('event: error');
      expect(res.text).toContain('Error interno del servidor');
    });

    it('should filter out conversation history entries exceeding MAX_MESSAGE_LENGTH', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'filtered long', toolsUsed: [], source: '' });
        }
      );

      const history = JSON.stringify([
        { role: 'user', content: 'Short valid message' },
        { role: 'assistant', content: 'x'.repeat(10_001) }, // Exceeds MAX_MESSAGE_LENGTH
        { role: 'user', content: 'Another valid' },
      ]);

      await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Test', conversationHistory: history });

      const callOpts = mockStreamChat.mock.calls[0][2];
      expect(callOpts.conversationHistory).toHaveLength(2);
    });

    it('should handle tool_start/tool_result with very long tool names (>200 chars) by skipping', async () => {
      const longTool = 't'.repeat(201);
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onToolStart(longTool);
          callbacks.onToolResult(longTool, true);
          callbacks.onDone({ answer: 'done', toolsUsed: [], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Long tool' });

      // Should have done event but no tool_start/tool_result since tool name > 200
      expect(res.text).toContain('event: done');
      expect(res.text).not.toContain('event: tool_start');
      expect(res.text).not.toContain('event: tool_result');
    });

    it('should not emit token event for very large tokens (>50000 chars)', async () => {
      const hugeToken = 'x'.repeat(50_001);
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onToken(hugeToken);
          callbacks.onDone({ answer: 'done', toolsUsed: [], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Huge token' });

      expect(res.text).toContain('event: done');
      // The huge token should NOT appear since it exceeds 50000
      expect(res.text).not.toContain('event: token');
    });

    it('should sanitize the done event response', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({
            answer: 'Sanitized answer',
            toolsUsed: ['tool1', 'tool2'],
            source: 'test-source',
          });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Sanitize test' });

      expect(res.text).toContain('event: done');
      const doneLines = res.text.split('\n').filter((l: string) => l.startsWith('data:'));
      const doneData = doneLines.find((l: string) => l.includes('Sanitized answer'));
      expect(doneData).toBeDefined();
    });

    it('should limit toolsUsed to 50 items in done event', async () => {
      const manyTools = Array.from({ length: 60 }, (_, i) => `tool_${i}`);
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'done', toolsUsed: manyTools, source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Many tools' });

      const doneEvent = res.text.split('\n').find((l: string) => l.includes('"toolsUsed"'));
      expect(doneEvent).toBeDefined();
      const parsed = JSON.parse(doneEvent!.replace('data: ', ''));
      expect(parsed.toolsUsed).toHaveLength(50);
    });

    it('should filter non-string items from toolsUsed', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'done', toolsUsed: ['valid', 123, null, 'also_valid'], source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'Filter tools' });

      const doneEvent = res.text.split('\n').find((l: string) => l.includes('"toolsUsed"'));
      const parsed = JSON.parse(doneEvent!.replace('data: ', ''));
      expect(parsed.toolsUsed).toEqual(['valid', 'also_valid']);
    });

    it('should handle toolsUsed being undefined/non-array in done event', async () => {
      mockStreamChat.mockImplementation(
        async (_msg: any, _files: any, _opts: any, callbacks: any) => {
          callbacks.onDone({ answer: 'done', toolsUsed: undefined, source: '' });
        }
      );

      const res = await request(app)
        .post('/api/nova/chat')
        .send({ message: 'No tools' });

      const doneEvent = res.text.split('\n').find((l: string) => l.includes('"toolsUsed"'));
      const parsed = JSON.parse(doneEvent!.replace('data: ', ''));
      expect(parsed.toolsUsed).toEqual([]);
    });
  });

  // =========================================================================
  // analysisStore behavior
  // =========================================================================
  describe('analysisStore management', () => {
    it('should handle analysis entries with expired timestamps', async () => {
      // Add an entry and verify it is retrievable regardless of age
      // (cleanup is handled by setInterval, not on read)
      analysisStore.set('old-analysis', {
        result: { summary: 'Old' },
        timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
        userId: '1',
      });

      const res = await request(app).get('/api/nova/analysis/old-analysis');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary', 'Old');
    });

    it('should return 404 for completely empty analysis store', async () => {
      analysisStore.clear();
      const res = await request(app).get('/api/nova/analysis/anything');
      expect(res.status).toBe(404);
    });
  });
});
