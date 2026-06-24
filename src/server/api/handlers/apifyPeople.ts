import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken } from '../../adminAuth.js';
import { verifyAiAccess } from '../../apiAuth.js';
import { normalizeLinkedInProfileUrl } from '../../../lib/linkedinUrl.js';
import {
  findRecruiterViaApify,
  scrapeLinkedInProfileViaApify,
} from '../../../services/jobSources/apifyPeople.js';

async function requireAuth(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return null;
  }
  try {
    return await verifyAiAccess(token);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 401;
    const message = err instanceof Error ? err.message : 'Unauthorized';
    res.status(status).json({ error: message });
    return null;
  }
}

export async function handleRecruiterLookup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const company = String(req.body?.company || '').trim();
  const jobTitle = String(req.body?.jobTitle || '').trim();
  if (!company) return res.status(400).json({ error: 'company is required' });

  try {
    const recruiter = await findRecruiterViaApify({ company, jobTitle });
    if (!recruiter) {
      return res.status(404).json({ error: 'No recruiter found for this company.' });
    }
    return res.status(200).json({ recruiter });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}

export async function handleLinkedInProfile(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const normalized = normalizeLinkedInProfileUrl(String(req.body?.url || ''));
  if (!normalized) {
    return res.status(400).json({ error: 'A valid LinkedIn profile URL is required (linkedin.com/in/...).' });
  }

  try {
    const profile = await scrapeLinkedInProfileViaApify(normalized);
    if (!profile) {
      return res.status(404).json({ error: 'Could not load this LinkedIn profile.' });
    }
    return res.status(200).json({ profile, linkedinUrl: normalized });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(404).json({ error: 'Use /api/apify/recruiter or /api/apify/linkedin-profile' });
}
