import type { VercelRequest, VercelResponse } from '@vercel/node';

function hasBearerToken(req: VercelRequest, secret: string | undefined): boolean {
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

/** True when the request is from Vercel Cron Jobs (Pro). */
function isVercelCronRequest(req: VercelRequest): boolean {
  const header = req.headers['x-vercel-cron'];
  return process.env.VERCEL === '1' && header === '1';
}

export function requireCronSecret(req: VercelRequest, res: VercelResponse): boolean {
  if (hasBearerToken(req, process.env.CRON_SECRET)) {
    return true;
  }

  // Vercel Pro Cron Jobs invoke routes with this header (GET, no manual Bearer needed).
  if (isVercelCronRequest(req)) {
    return true;
  }

  res.status(401).end('Unauthorized');
  return false;
}

export function requireInternalCronSecret(req: VercelRequest, res: VercelResponse): boolean {
  if (hasBearerToken(req, process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET)) {
    return true;
  }

  res.status(401).end('Unauthorized');
  return false;
}
