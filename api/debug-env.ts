import type { VercelRequest, VercelResponse } from '@vercel/node';
export default function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  res.json({
    has_firebase_key: !!key,
    firebase_key_length: key?.length ?? 0,
    firebase_key_start: key?.slice(0, 20) ?? 'MISSING',
    has_apify_token: !!process.env.APIFY_API_TOKEN,
    has_openrouter_key: !!process.env.OPENROUTER_API_KEY,
    node_env: process.env.NODE_ENV,
  });
}
