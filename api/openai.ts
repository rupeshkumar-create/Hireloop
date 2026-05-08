import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://hireschema.com',
    'X-Title': 'Hireschema',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
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
