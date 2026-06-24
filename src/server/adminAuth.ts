import type { VercelRequest } from '@vercel/node';
import { verifySuperAdmin } from './supabaseAuth.js';

export function getBearerToken(req: VercelRequest): string | null {
  const header =
    req.headers.authorization ??
    (req.headers as Record<string, string | undefined>).Authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export { verifySuperAdmin };
