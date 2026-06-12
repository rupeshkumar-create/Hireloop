/**
 * Shared OpenRouter client for all server-side AI (blog, content growth, crons).
 * Uses OPENROUTER_API_KEY — same key as api/openai.ts proxy.
 */
import OpenAI from 'openai';

let openrouterClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (openrouterClient) return openrouterClient;
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }
  openrouterClient = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://hireschema.com',
      'X-Title': 'Hireschema',
    },
  });
  return openrouterClient;
}

export async function chat(model: string, system: string, user: string): Promise<string> {
  const openrouter = getOpenRouterClient();
  try {
    const res = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenRouter chat failed (${model}): ${message}`);
  }
}

export async function chatJSON<T>(model: string, system: string, user: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await chatJSONOnce<T>(model, system, user);
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
      console.warn(`[contentGrowth/ai] chatJSON retry ${attempt} for ${model}`);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(message);
}

async function chatJSONOnce<T>(model: string, system: string, user: string): Promise<T> {
  const openrouter = getOpenRouterClient();
  let raw = '{}';
  try {
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
    raw = res.choices[0]?.message?.content?.trim() ?? '{}';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenRouter chatJSON failed (${model}): ${message}`);
  }
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch (parseError) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error(
      `OpenRouter chatJSON parse failed (${model}): ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`
    );
  }
}

/**
 * Minimal-call model routing — best model per task, no redundant calls.
 *
 * Daily blog publish uses exactly 2 calls:
 *   1. research  → perplexity/sonar-pro   (live web data)
 *   2. writing   → anthropic/claude-opus-4.6 (article + SEO metadata in one shot)
 *
 * Weekly/monthly crons add 1–2 calls each (not daily).
 * Cover images: deterministic SVG — zero AI calls.
 */
export const MODELS = {
  research: 'perplexity/sonar-pro',
  outline: 'anthropic/claude-sonnet-4.6',
  writing: 'anthropic/claude-opus-4.6',
  humanizer: 'anthropic/claude-sonnet-4.6',
  copyCheck: 'anthropic/claude-sonnet-4.6',
  metadata: 'anthropic/claude-sonnet-4.6',
  strategy: 'anthropic/claude-opus-4.6',
} as const;
