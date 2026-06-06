import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('AI API route wiring', () => {
  it('exports explicit /api/openai handler', async () => {
    const mod = await import('../../../api/openai.ts');
    expect(typeof mod.default).toBe('function');
  });

  it('exports explicit /api/apollo handler', async () => {
    const mod = await import('../../../api/apollo.ts');
    expect(typeof mod.default).toBe('function');
  });

  it('ai catch-all resolves openai and apollo sub-routes', async () => {
    const mod = await import('../../../api/ai/[[...route]].ts');
    expect(typeof mod.default).toBe('function');
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
