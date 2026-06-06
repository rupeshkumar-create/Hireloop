import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { getBearerToken } from '../../adminAuth.js';
import { verifyAiAccess } from '../../apiAuth.js';

function resolveOpenRouterApiKey(): string | undefined {
  const serverKey = process.env.OPENROUTER_API_KEY?.trim();
  if (serverKey) return serverKey;

  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) return undefined;

  return process.env.VITE_OPENROUTER_API_KEY?.trim() || undefined;
}

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
    console.error('OPENROUTER_API_KEY is missing');
    return res.status(500).json({ error: 'AI Configuration Error: API key is missing' });
  }
  
  try {
    const { messages, response_format, model } = req.body;
    
    // Fallback to a cheap model if none provided
    const selectedModel = model || 'openai/gpt-4o-mini';
    
    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages,
      ...(response_format && { response_format })
    });
    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message, status: error.status });
  }
}
