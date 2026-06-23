import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Bing Webmaster Tools ownership verification — must match downloaded BingSiteAuth.xml exactly. */
const BING_SITE_AUTH_XML = `<?xml version="1.0"?>
<users>
\t<user>5B9E1D4A05B225E68DA41C14CBF46752</user>
</users>`;

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', String(Buffer.byteLength(BING_SITE_AUTH_XML, 'utf8')));
    return res.status(200).end();
  }

  return res.status(200).send(BING_SITE_AUTH_XML);
}
