import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const apiKey = process.env.SERPER_API_KEY || process.env.VITE_SERPER_API_KEY;
    const response = await fetch('https://google.serper.dev/jobs', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
