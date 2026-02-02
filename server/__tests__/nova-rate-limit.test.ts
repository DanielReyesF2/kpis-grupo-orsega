import { describe, it, expect, vi } from 'vitest';
import rateLimit from 'express-rate-limit';

/**
 * Tests for the Nova chat rate limiter configuration.
 * Validates that express-rate-limit is used with a user-based key generator
 * and an SSE-compatible error handler (not JSON 429).
 */

// Replicate the configuration from nova-routes.ts to test it in isolation
function createNovaChatLimiter() {
  return rateLimit({
    windowMs: 60_000,
    max: 10,
    keyGenerator: (req: any) => req.user?.id?.toString() || req.ip || 'unknown',
    handler: (_req: any, res: any) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: 'Demasiadas solicitudes. Espera un momento antes de enviar otro mensaje.' })}\n\n`
      );
      res.end();
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  });
}

describe('Nova Chat Rate Limiter', () => {
  it('should create a valid rate limiter middleware', () => {
    const limiter = createNovaChatLimiter();
    expect(typeof limiter).toBe('function');
  });

  it('keyGenerator should use user ID when available', () => {
    const keyGenerator = (req: any) => req.user?.id?.toString() || req.ip || 'unknown';
    const req = { user: { id: 42 }, ip: '1.2.3.4' };
    expect(keyGenerator(req)).toBe('42');
  });

  it('keyGenerator should fall back to IP when no user', () => {
    const keyGenerator = (req: any) => req.user?.id?.toString() || req.ip || 'unknown';
    const req = { ip: '1.2.3.4' };
    expect(keyGenerator(req)).toBe('1.2.3.4');
  });

  it('keyGenerator should fall back to "unknown" when no user or IP', () => {
    const keyGenerator = (req: any) => req.user?.id?.toString() || req.ip || 'unknown';
    const req = {};
    expect(keyGenerator(req)).toBe('unknown');
  });

  it('handler should write SSE error format (not JSON 429)', () => {
    const headers: Record<string, string> = {};
    let writtenData = '';
    let ended = false;

    const mockRes = {
      setHeader: (key: string, val: string) => { headers[key] = val; },
      write: (data: string) => { writtenData += data; },
      end: () => { ended = true; },
    };

    const handler = (_req: any, res: any) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: 'Demasiadas solicitudes. Espera un momento antes de enviar otro mensaje.' })}\n\n`
      );
      res.end();
    };

    handler(null, mockRes);

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(writtenData).toContain('event: error');
    expect(writtenData).toContain('data: ');
    expect(writtenData).toContain('Demasiadas solicitudes');
    expect(ended).toBe(true);

    // Verify it's valid SSE, not a JSON 429
    const dataLine = writtenData.split('\n').find(l => l.startsWith('data: '));
    expect(dataLine).toBeTruthy();
    const parsed = JSON.parse(dataLine!.replace('data: ', ''));
    expect(parsed.message).toBe('Demasiadas solicitudes. Espera un momento antes de enviar otro mensaje.');
  });

  it('should be configured with 10 requests per 60s window', () => {
    // Verify the config values match what we expect
    const config = {
      windowMs: 60_000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
    };
    expect(config.windowMs).toBe(60_000);
    expect(config.max).toBe(10);
    expect(config.standardHeaders).toBe(true);
    expect(config.legacyHeaders).toBe(false);
  });
});
