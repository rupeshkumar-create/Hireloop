import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { messages, response_format, model } = req.body;
    const response = await openai.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages,
      ...(response_format && { response_format })
    });
    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
