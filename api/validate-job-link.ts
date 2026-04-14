import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = typeof req.body?.url === 'string' ? req.body.url : '';
  const allowedDomains = Array.isArray(req.body?.allowedDomains)
    ? req.body.allowedDomains.filter((value: unknown): value is string => typeof value === 'string')
    : [];

  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });

    if (response.status === 405) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
      });
    }

    if (!response.ok) {
      return res.status(200).json({ valid: false, finalUrl: response.url || url });
    }

    const finalUrl = (response.url || url).toLowerCase();
    const valid = allowedDomains.some((domain) => finalUrl.includes(domain.toLowerCase()));

    return res.status(200).json({ valid, finalUrl });
  } catch (error: any) {
    return res.status(200).json({ valid: false, error: error?.message || 'Validation failed' });
  }
}
