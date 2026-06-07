import type { CallAIFn } from './jobResearcher.js';

/**
 * Server-side OpenRouter caller for job matching AI scoring.
 * Returns undefined when OPENROUTER_API_KEY is not configured so callers
 * can fall back to deterministic-only matching.
 */
export function createOpenRouterCaller(): CallAIFn | undefined {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return undefined;

  return async (messages, model) => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hireschema.com',
        'X-Title': 'Hireschema',
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || '';
  };
}
