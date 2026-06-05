/**
 * Shared OpenRouter client for all server-side AI (blog, content growth, crons).
 * Uses OPENROUTER_API_KEY — same key as api/openai.ts proxy.
 */
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://hireschema.com',
    'X-Title': 'Hireschema',
  },
});

export async function chat(model: string, system: string, user: string): Promise<string> {
  const res = await openrouter.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}

export async function chatJSON<T>(model: string, system: string, user: string): Promise<T> {
  const res = await openrouter.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: system + '\n\nRespond ONLY with valid JSON. No markdown fences, no explanation.',
      },
      { role: 'user', content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content?.trim() ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned) as T;
}

/**
 * Minimal-call model routing — best model per task, no redundant calls.
 *
 * Daily blog publish uses exactly 2 calls:
 *   1. research  → perplexity/sonar-pro   (live web data)
 *   2. writing   → anthropic/claude-opus-4-6 (article + SEO metadata in one shot)
 *
 * Weekly/monthly crons add 1–2 calls each (not daily).
 * Cover images: deterministic SVG — zero AI calls.
 */
export const MODELS = {
  research: 'perplexity/sonar-pro',
  writing: 'anthropic/claude-opus-4-6',
  strategy: 'anthropic/claude-opus-4-6',
} as const;
