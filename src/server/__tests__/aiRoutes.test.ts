import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeApiRequest } from '../api/router.js';

describe('AI API route wiring', () => {
  it('unified API router exports a handler', async () => {
    const mod = await import('../../../api/index.ts');
    expect(typeof mod.default).toBe('function');
  });

  it('dispatches /api/ai/openai via URL path', async () => {
    const req = {
      method: 'POST',
      headers: {},
      url: '/api/ai/openai',
      query: {},
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

    await routeApiRequest(req, res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { error?: string }).error).toMatch(/authorization/i);
  });

  it('vercel rewrite target /api/openai maps through unified router', async () => {
    const req = {
      method: 'POST',
      headers: {},
      url: '/api/openai',
      query: {},
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

    await routeApiRequest(req, res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { error?: string }).error).toMatch(/authorization/i);
  });
});

describe('Blog API route wiring', () => {
  it('dispatches /api/blog list handler', async () => {
    const req = {
      method: 'GET',
      headers: {},
      url: '/api/blog',
      query: {},
    } as VercelRequest;
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
      body: undefined as unknown,
    } as VercelResponse & { body?: unknown; headers: Record<string, string> };

    await routeApiRequest(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray((res.body as { posts?: unknown[] }).posts)).toBe(true);
  });

  it('dispatches blog cover sub-route from URL path', async () => {
    const req = {
      method: 'GET',
      headers: {},
      url: '/api/blog/cover?slug=test',
      query: { slug: 'test' },
    } as VercelRequest;
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
      send(payload: unknown) {
        this.body = payload;
        return this;
      },
      end(payload?: unknown) {
        this.body = payload;
        return this;
      },
      body: undefined as unknown,
    } as VercelResponse & { body?: unknown; headers: Record<string, string> };

    await routeApiRequest(req, res);
    expect(res.statusCode).toBe(200);
    expect(String(res.body || '')).toContain('<svg');
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
