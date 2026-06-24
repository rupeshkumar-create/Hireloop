import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken } from '../../adminAuth.js';
import { verifyAiAccess } from '../../apiAuth.js';
import OpenAI from 'openai';

function resolveOpenRouterApiKey(): string | undefined {
  const serverKey = process.env.OPENROUTER_API_KEY?.trim();
  if (serverKey) return serverKey;
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) return undefined;
  return process.env.VITE_OPENROUTER_API_KEY?.trim() || undefined;
}

const MODE_PROMPTS: Record<string, string> = {
  default: `You are Jack — an AI career agent (Jack & Jill style). Warm, direct, first-person.
You help job seekers find roles, prepare for interviews, negotiate salary, and land introductions.
Never invent job listings. Reference only jobs the user has been shown or saved.
Keep replies concise (2–4 short paragraphs max unless doing mock interview).`,
  mock_interview: `You are Jack running a mock interview. Ask ONE question at a time.
After the user answers, give brief feedback: Confidence (Strong/Improve), what worked, one improvement.
Then ask the next question. Stay grounded in their resume and target role.`,
  salary_benchmark: `You are Jack showing salary benchmarks. Use realistic USD ranges for the role/location.
Format: Market P50, P90, and whether their target is below/at/above market. Suggest a counter range.`,
  negotiation: `You are Jack coaching salary negotiation. Role-play the employer's offer.
Give the user exact counter language. Explain when to push vs accept. Stay supportive and data-backed.`,
  career_clarity: `You are Jack as a career coach. Help clarify Staff vs IC, management vs tech, next role fit.
Ask one reflective question at a time. No generic platitudes.`,
  onboarding: `You are Jack onboarding a new user in ~10 minutes. Ask one question at a time.
Learn: target role, location/remote preference, salary expectations, LinkedIn or resume status.
Be encouraging. Keep messages short.`,
};

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: resolveOpenRouterApiKey() || 'not-configured',
  defaultHeaders: {
    'HTTP-Referer': 'https://hireschema.com',
    'X-Title': 'Hireschema',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  try {
    await verifyAiAccess(token);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 401;
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return res.status(status).json({ error: message });
  }

  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'AI Configuration Error: API key is missing' });
  }

  const messages = req.body?.messages;
  const systemContext = String(req.body?.systemContext || '').trim();
  const mode = String(req.body?.mode || 'default');

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const basePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.default;

  const systemMessage = {
    role: 'system' as const,
    content: `${basePrompt}
Never use "I am excited" or corporate filler. Be specific.
${systemContext ? `\nUser context:\n${systemContext}` : ''}`,
  };

  try {
    const response = await openai.chat.completions.create({
      model: req.body?.model || 'anthropic/claude-3.5-sonnet',
      messages: [systemMessage, ...messages],
      temperature: mode === 'mock_interview' ? 0.5 : 0.4,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || '';
    return res.status(200).json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
