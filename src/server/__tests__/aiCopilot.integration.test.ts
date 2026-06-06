import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../../src/server/apiAuth.js', () => ({
  verifyAiAccess: vi.fn(async () => ({ decoded: { uid: 'test' }, plan: 'pro' as const })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: 'Hello from mock AI' } }],
        })),
      },
    },
  })),
}));

function mockRes() {
  const res: Partial<VercelResponse> & { statusCode?: number; body?: unknown } = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this as VercelResponse;
    },
    json(payload: unknown) {
      this.body = payload;
      return this as VercelResponse;
    },
  };
  return res as VercelResponse & { statusCode?: number; body?: unknown };
}

describe('openai API handler', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    const aiCatchAll = (await import('../../../api/ai/[[...route]].ts')).default;
    const req = {
      method: 'POST',
      headers: {},
      query: { route: 'openai' },
      body: { messages: [{ role: 'user', content: 'hi' }] },
    } as VercelRequest;
    const res = mockRes();

    await aiCatchAll(req, res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { error?: string }).error).toMatch(/authorization/i);
  });
});

describe('AI copilot client actions', () => {
  const mockAiContent =
    'Applying for the Engineer role at Acme. React TypeScript Node.js experience. Happy to connect this week.';

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: mockAiContent } }],
          }),
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generateColdEmail hits /api/openai and returns content', async () => {
    const { generateColdEmail } = await import('../../services/aiService.js');
    const result = await generateColdEmail('Engineer', 'Acme', 'Resume with React and Node.', true);
    expect(result).toContain('Acme');
    expect(fetch).toHaveBeenCalledWith('/api/openai', expect.any(Object));
  });

  it('tailorResume hits /api/openai and returns content', async () => {
    const { tailorResume } = await import('../../services/aiService.js');
    const result = await tailorResume(
      'Engineer',
      'Looking for React, TypeScript, and Node.js experience.',
      '# Jane\n\n## Experience\n- Built React apps with TypeScript and Node.js',
      true
    );
    expect(result).toContain('React');
  });

  it('generateInterviewQuestions hits /api/openai', async () => {
    const { generateInterviewQuestions } = await import('../../services/aiService.js');
    const result = await generateInterviewQuestions('Engineer', 'Acme', true);
    expect(result).toContain('Acme');
  });

  it('generateSalaryInsights hits /api/openai', async () => {
    const { generateSalaryInsights } = await import('../../services/aiService.js');
    const result = await generateSalaryInsights('Engineer', 'Remote', true);
    expect(result).toContain('Acme');
  });
});
