import type { VercelRequest, VercelResponse } from '@vercel/node';

function hasBearerToken(req: VercelRequest, secret: string | undefined): boolean {
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

export function requireCronSecret(req: VercelRequest, res: VercelResponse): boolean {
  if (hasBearerToken(req, process.env.CRON_SECRET)) {
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
