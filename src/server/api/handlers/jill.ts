import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken } from '../../adminAuth.js';
import { verifyAuthToken } from '../../apiAuth.js';
import { getProfile } from '../../db/profiles.js';
import {
  createRecruiterJob,
  getRecruiterJob,
  getRecruiterProfile,
  listRecruiterJobs,
  updateRecruiterJob,
  upsertRecruiterProfile,
} from '../../db/recruiterJobs.js';
import {
  getConnectionRequest,
  listRecruiterIntros,
  updateIntroThread,
} from '../../db/connectionRequests.js';
import {
  buildRecruiterIntroAcceptedEmailHtml,
  sendTransactionalEmail,
} from '../../emailService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  let decoded;
  try {
    decoded = await verifyAuthToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }

  const route = String(req.query.route || '').trim();
  const profile = (await getProfile(decoded.uid)) ?? ({} as import('../../../lib/profileMapper.js').UserProfile);

  if (route === 'profile') {
    if (req.method === 'GET') {
      const rp = await getRecruiterProfile(decoded.uid);
      return res.status(200).json({ profile: rp, user: { email: profile.email, displayName: profile.displayName } });
    }
    if (req.method === 'POST') {
      const companyName = String(req.body?.companyName || '').trim();
      if (!companyName) return res.status(400).json({ error: 'companyName is required' });
      await upsertRecruiterProfile(decoded.uid, {
        companyName,
        companyWebsite: String(req.body?.companyWebsite || '').trim() || undefined,
        title: String(req.body?.title || '').trim() || undefined,
        bio: String(req.body?.bio || '').trim() || undefined,
      });
      await getProfile(decoded.uid);
      const rp = await getRecruiterProfile(decoded.uid);
      return res.status(200).json({ profile: rp });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (route === 'jobs') {
    if (req.method === 'GET') {
      const jobs = await listRecruiterJobs(decoded.uid);
      return res.status(200).json({ jobs });
    }
    if (req.method === 'POST') {
      const title = String(req.body?.title || '').trim();
      const company = String(req.body?.company || profile.displayName || 'Company').trim();
      const description = String(req.body?.description || '').trim();
      if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
      }
      const job = await createRecruiterJob(decoded.uid, {
        title,
        company,
        location: String(req.body?.location || 'Remote').trim(),
        salaryRange: String(req.body?.salaryRange || '').trim() || undefined,
        description,
        requirements: Array.isArray(req.body?.requirements)
          ? req.body.requirements.map(String)
          : String(req.body?.requirements || '')
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean),
        status: 'open',
      });
      return res.status(201).json({ job });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const jobMatch = route.match(/^jobs\/([^/]+)$/);
  if (jobMatch) {
    const jobId = jobMatch[1];
    if (req.method === 'PATCH') {
      const job = await updateRecruiterJob(decoded.uid, jobId, {
        title: req.body?.title ? String(req.body.title) : undefined,
        company: req.body?.company ? String(req.body.company) : undefined,
        location: req.body?.location ? String(req.body.location) : undefined,
        salaryRange: req.body?.salaryRange !== undefined ? String(req.body.salaryRange) : undefined,
        description: req.body?.description ? String(req.body.description) : undefined,
        status: req.body?.status as 'open' | 'closed' | 'filled' | undefined,
      });
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.status(200).json({ job });
    }
    if (req.method === 'GET') {
      const job = await getRecruiterJob(jobId);
      if (!job || job.recruiterUserId !== decoded.uid) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.status(200).json({ job });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (route === 'intros') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const intros = await listRecruiterIntros(decoded.uid);
    return res.status(200).json({ intros });
  }

  const introMatch = route.match(/^intros\/([^/]+)\/respond$/);
  if (introMatch) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const introId = introMatch[1];
    const action = String(req.body?.action || '').trim() as 'accept' | 'decline' | 'schedule';
    if (!['accept', 'decline', 'schedule'].includes(action)) {
      return res.status(400).json({ error: 'action must be accept, decline, or schedule' });
    }

    const existing = await getConnectionRequest(introId);
    if (!existing || existing.recruiterUserId !== decoded.uid) {
      return res.status(404).json({ error: 'Introduction not found' });
    }

    const intro = await updateIntroThread(introId, {
      threadStatus:
        action === 'accept' ? 'recruiter_accepted' : action === 'schedule' ? 'scheduled' : 'recruiter_declined',
      status: action === 'decline' ? 'declined' : 'accepted',
      jackNarration:
        action === 'accept'
          ? `Great news — ${existing.recruiterName} accepted your introduction for ${existing.jobTitle}. I'll help you prep for the conversation.`
          : action === 'schedule'
            ? 'Your intro is scheduled. Check your email for next steps.'
            : 'They passed on this intro for now. I will keep searching for better fits.',
    });

    if (!intro) {
      return res.status(404).json({ error: 'Introduction not found' });
    }

    if (action === 'accept' || action === 'schedule') {
      try {
        await sendTransactionalEmail({
          to: intro.candidateEmail,
          subject: `${intro.recruiterName} accepted your introduction — ${intro.jobTitle}`,
          html: buildRecruiterIntroAcceptedEmailHtml({
            candidateName: intro.candidateName,
            recruiterName: intro.recruiterName,
            company: intro.company,
            jobTitle: intro.jobTitle,
          }),
        });
      } catch {
        /* non-fatal */
      }
    }

    return res.status(200).json({ intro });
  }

  return res.status(404).json({ error: `Unknown jill route: ${route}` });
}
