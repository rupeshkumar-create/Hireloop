import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken } from '../../adminAuth.js';
import { verifyAuthToken } from '../../apiAuth.js';
import { getProfile } from '../../db/profiles.js';
import {
  getConnectionRequest,
  listCandidateIntros,
  setConnectionRequest,
  updateIntroThread,
} from '../../db/connectionRequests.js';
import { findJillJobMatch, getRecruiterJob } from '../../db/recruiterJobs.js';
import { findRecruiterViaApify } from '../../../services/jobSources/apifyPeople.js';
import { isRecruiterReachable, type RecruiterContact } from '../../../types/recruiter.js';
import { jackIntroNarration } from '../../../types/jill.js';
import {
  buildConnectionRequestEmailHtml,
  buildJillRecruiterIntroEmailHtml,
  sendTransactionalEmail,
} from '../../emailService.js';

function connectionId(candidateUserId: string, company: string, jobTitle: string): string {
  const slug = `${company}::${jobTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
  return `${candidateUserId}_${slug}_${Date.now()}`;
}

async function resolveRecruiter(
  company: string,
  jobTitle: string,
  recruiterJobId?: string,
  bodyRecruiter?: RecruiterContact
): Promise<{
  recruiter: RecruiterContact;
  recruiterUserId?: string;
  jillJobId?: string;
  source: 'jill' | 'apify' | 'provided';
}> {
  if (bodyRecruiter && isRecruiterReachable(bodyRecruiter)) {
    return { recruiter: bodyRecruiter, source: 'provided' };
  }

  if (recruiterJobId) {
    const job = await getRecruiterJob(recruiterJobId);
    if (job) {
      return {
        recruiter: {
          name: job.recruiterName || 'Hiring manager',
          title: 'Hiring team',
          email: job.recruiterEmail,
          linkedinUrl: undefined,
          source: 'jill',
        },
        recruiterUserId: job.recruiterUserId,
        jillJobId: job.id,
        source: 'jill',
      };
    }
  }

  const jillMatch = await findJillJobMatch(company, jobTitle);
  if (jillMatch) {
    return {
      recruiter: {
        name: jillMatch.recruiterName || 'Hiring manager',
        title: 'Hiring team',
        email: jillMatch.recruiterEmail,
        source: 'jill',
      },
      recruiterUserId: jillMatch.recruiterUserId,
      jillJobId: jillMatch.id,
      source: 'jill',
    };
  }

  const found = await findRecruiterViaApify({ company, jobTitle });
  if (!found) throw Object.assign(new Error('Could not find a hiring contact for this company.'), { status: 404 });
  return { recruiter: found, source: 'apify' };
}

export async function handleConnectionPreview(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  let decoded;
  try {
    decoded = await verifyAuthToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }

  const company = String(req.body?.company || '').trim();
  const jobTitle = String(req.body?.jobTitle || '').trim();
  const recruiterJobId = String(req.body?.recruiterJobId || '').trim() || undefined;

  if (!company || !jobTitle) {
    return res.status(400).json({ error: 'company and jobTitle are required.' });
  }

  try {
    const { recruiter, source, recruiterUserId, jillJobId } = await resolveRecruiter(
      company,
      jobTitle,
      recruiterJobId,
      req.body?.recruiter as RecruiterContact | undefined
    );

    const narration = jackIntroNarration({
      recruiterName: recruiter.name,
      recruiterTitle: recruiter.title,
      company,
      jobTitle,
      highlight: source === 'jill' ? 'profile match on Jill' : 'relevant experience',
    });

    return res.status(200).json({
      recruiter,
      source,
      recruiterUserId,
      recruiterJobId: jillJobId,
      narration,
      warmIntro: source === 'jill',
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    return res.status(status).json({ error: message });
  }
}

export async function handleConnectionList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  let decoded;
  try {
    decoded = await verifyAuthToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }

  const intros = await listCandidateIntros(decoded.uid);
  return res.status(200).json({ intros });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleConnectionList(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  let decoded;
  try {
    decoded = await verifyAuthToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }

  const company = String(req.body?.company || '').trim();
  const jobTitle = String(req.body?.jobTitle || '').trim();
  const jobUrl = String(req.body?.jobUrl || '').trim() || undefined;
  const trackedJobId = String(req.body?.trackedJobId || '').trim() || undefined;
  const introMessage = String(req.body?.introMessage || '').trim() || undefined;
  const recruiterJobId = String(req.body?.recruiterJobId || '').trim() || undefined;
  const candidateAccepted = req.body?.candidateAccepted !== false;

  if (!company || !jobTitle) {
    return res.status(400).json({ error: 'company and jobTitle are required.' });
  }

  const userData = (await getProfile(decoded.uid)) ?? ({} as import('../../../lib/profileMapper.js').UserProfile);
  const candidateName =
    userData.displayName || userData.structuredProfile?.contact?.fullName || 'A candidate';
  const candidateEmail = userData.email || decoded.email || '';
  const candidateLinkedin = userData.structuredProfile?.contact?.linkedin;

  if (!candidateEmail) {
    return res.status(400).json({ error: 'Your account must have an email to send connection requests.' });
  }

  let resolved;
  try {
    resolved = await resolveRecruiter(
      company,
      jobTitle,
      recruiterJobId,
      req.body?.recruiter as RecruiterContact | undefined
    );
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    return res.status(status).json({ error: message });
  }

  const { recruiter, source, recruiterUserId, jillJobId } = resolved;
  const recruiterName = String(recruiter.name || 'Hiring contact');
  const recruiterTitle = String(recruiter.title || 'Recruiter');
  const recruiterEmail = recruiter.email ? String(recruiter.email) : undefined;
  const recruiterLinkedin = recruiter.linkedinUrl ? String(recruiter.linkedinUrl) : undefined;

  if (!recruiterEmail && !recruiterLinkedin) {
    return res.status(404).json({ error: 'Found a contact but no email or LinkedIn URL.' });
  }

  const now = new Date().toISOString();
  const id = connectionId(decoded.uid, company, jobTitle);
  const narration = jackIntroNarration({
    recruiterName,
    recruiterTitle,
    company,
    jobTitle,
    highlight: source === 'jill' ? 'profile match on Jill' : undefined,
  });

  const record = {
    id,
    candidateUserId: decoded.uid,
    candidateName,
    candidateEmail,
    candidateLinkedin: candidateLinkedin || null,
    jobTitle,
    company,
    jobUrl: jobUrl || null,
    trackedJobId: trackedJobId || null,
    recruiterUserId: recruiterUserId || null,
    recruiterJobId: jillJobId || null,
    recruiterName,
    recruiterTitle,
    recruiterEmail: recruiterEmail || null,
    recruiterLinkedin: recruiterLinkedin || null,
    introMessage: introMessage || null,
    status: 'pending' as const,
    threadStatus: candidateAccepted ? 'sent_to_recruiter' : 'candidate_review',
    jackNarration: narration,
    warmIntro: source === 'jill',
    introSource: source,
    emailSent: false,
    createdAt: now,
    updatedAt: now,
  };

  await setConnectionRequest(id, decoded.uid, record, {
    recruiterUserId: recruiterUserId || null,
    recruiterJobId: jillJobId || null,
  });

  if (!candidateAccepted) {
    return res.status(200).json({
      connection: record,
      recruiter: { name: recruiterName, title: recruiterTitle, email: recruiterEmail, linkedinUrl: recruiterLinkedin, source },
      emailSent: false,
      narration,
    });
  }

  let emailSent = false;
  let emailError: string | undefined;
  const jillDashboardUrl =
    process.env.JILL_DASHBOARD_URL?.trim() || 'http://localhost:3000/jill';

  if (recruiterEmail) {
    try {
      const html =
        source === 'jill' && recruiterUserId
          ? buildJillRecruiterIntroEmailHtml({
              recruiterName,
              candidateName,
              candidateEmail,
              candidateLinkedin,
              jobTitle,
              company,
              introMessage,
              jillDashboardUrl,
              narration,
            })
          : buildConnectionRequestEmailHtml({
              recruiterName,
              candidateName,
              candidateEmail,
              candidateLinkedin,
              jobTitle,
              company,
              introMessage,
              dashboardUrl: jillDashboardUrl,
            });

      await sendTransactionalEmail({
        to: recruiterEmail,
        subject:
          source === 'jill'
            ? `Jack intro: ${candidateName} for ${jobTitle}`
            : `${candidateName} — introduction for ${jobTitle} at ${company}`,
        replyTo: candidateEmail,
        html,
      });
      emailSent = true;
      await updateIntroThread(id, { emailSent: true, threadStatus: 'sent_to_recruiter' });
    } catch (error: unknown) {
      emailError = error instanceof Error ? error.message : String(error);
    }
  }

  return res.status(200).json({
    connection: { ...record, emailSent },
    recruiter: {
      name: recruiterName,
      title: recruiterTitle,
      email: recruiterEmail,
      linkedinUrl: recruiterLinkedin,
      source,
    },
    emailSent,
    emailError,
    narration,
    warmIntro: source === 'jill',
  });
}

export async function handleConnectionStatus(req: VercelRequest, res: VercelResponse, introId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  let decoded;
  try {
    decoded = await verifyAuthToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }

  const intro = await getConnectionRequest(introId);
  if (!intro || intro.candidateUserId !== decoded.uid) {
    return res.status(404).json({ error: 'Introduction not found' });
  }
  return res.status(200).json({ intro });
}
