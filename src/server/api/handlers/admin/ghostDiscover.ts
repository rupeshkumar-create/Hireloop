/**
 * Super Admin — Ghost Mode Discovery
 *
 * Runs Apify discovery server-side so the admin browser doesn't need
 * access to APIFY_API_TOKEN (which must never leak into the client bundle).
 *
 * Auth: Firebase ID token (Authorization: Bearer <token>) with superAdmin
 *       custom claim OR allow-listed admin email.
 *
 * POST /api/admin/ghost-discover
 * Body: {
 *   careerPaths: string[],
 *   resumeText: string,
 *   jobType?: string,
 *   location?: string,
 *   targetCount?: number,
 * }
 * Returns: { jobs, sources, totalFound, deduplicated }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth } from '../../../firebaseAdmin.js';
import { researchJobs } from '../../../../services/jobResearcher.js';

const ADMIN_EMAILS = ['rupesh7126@gmail.com', 'kv3244@gmail.com'];

function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

async function verifySuperAdmin(token: string) {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(token);
  const userEmail = decoded.email?.toLowerCase();
  if (decoded.superAdmin !== true && !ADMIN_EMAILS.includes(userEmail || '')) {
    throw Object.assign(new Error('Not authorized as super admin.'), { status: 403 });
  }
  return decoded;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  try {
    await verifySuperAdmin(token);
  } catch (err: any) {
    return res.status(err.status || 401).json({ error: err.message || 'Auth failed' });
  }

  try {
    const {
      careerPaths,
      resumeText,
      jobType,
      location,
      targetCount,
    } = (req.body || {}) as {
      careerPaths?: string[];
      resumeText?: string;
      jobType?: string;
      location?: string;
      targetCount?: number;
    };

    if (!Array.isArray(careerPaths) || careerPaths.length === 0) {
      return res.status(400).json({ error: 'careerPaths is required and must be non-empty.' });
    }
    if (typeof resumeText !== 'string') {
      return res.status(400).json({ error: 'resumeText is required.' });
    }

    const result = await researchJobs({
      careerPaths,
      resumeText,
      jobType: jobType || 'remote',
      location: location || '',
      targetCount: typeof targetCount === 'number' ? targetCount : 30,
    });

    return res.status(200).json({
      jobs: result.jobs,
      sources: result.sources,
      totalFound: result.totalFound,
      deduplicated: result.deduplicated,
    });
  } catch (err: any) {
    console.error('[api/admin/ghost-discover] failed:', err);
    return res.status(500).json({ error: err.message || 'Ghost discovery failed' });
  }
}
