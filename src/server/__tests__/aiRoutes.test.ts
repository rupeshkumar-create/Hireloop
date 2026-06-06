import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

describe('AI API route wiring', () => {
  it('exports openai handler from server module', async () => {
    const mod = await import('../api/handlers/openai.js');
    expect(typeof mod.default).toBe('function');
  });

  it('exports apollo handler from server module', async () => {
    const mod = await import('../api/handlers/apollo.js');
    expect(typeof mod.default).toBe('function');
  });

  it('ai catch-all resolves openai and apollo sub-routes', async () => {
    const mod = await import('../../../api/ai/[[...route]].ts');
    expect(typeof mod.default).toBe('function');
  });

  it('ai catch-all dispatches /api/ai/openai to openai handler', async () => {
    const aiCatchAll = (await import('../../../api/ai/[[...route]].ts')).default;
    const req = {
      method: 'POST',
      headers: {},
      query: { route: 'openai' },
      body: { messages: [{ role: 'user', content: 'hi' }] },
    } as VercelRequest;
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
      body: undefined as unknown,
    } as VercelResponse & { body?: unknown };

    await aiCatchAll(req, res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { error?: string }).error).toMatch(/authorization/i);
  });
});

describe('callOpenAI proxy errors', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces API error text instead of a generic failure', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ error: 'Unknown AI route: (empty)' }),
    } as Response);

    const { callOpenAI } = await import('../../services/aiService.js');

    await expect(callOpenAI([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'Unknown AI route: (empty)'
    );
    expect(fetch).toHaveBeenCalledWith(
      '/api/openai',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
