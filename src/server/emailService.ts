const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'HireSchema <noreply@hireschema.com>';

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string }).message ||
      (data as { error?: string }).error ||
      `Resend API error (${response.status})`;
    throw new Error(message);
  }

  return data as { id?: string };
}

export function buildConnectionRequestEmailHtml(input: {
  recruiterName: string;
  candidateName: string;
  candidateEmail: string;
  candidateLinkedin?: string;
  jobTitle: string;
  company: string;
  introMessage?: string;
  dashboardUrl: string;
}): string {
  const linkedinLine = input.candidateLinkedin
    ? `<p><strong>LinkedIn:</strong> <a href="${input.candidateLinkedin}">${input.candidateLinkedin}</a></p>`
    : '';

  const intro = input.introMessage
    ? `<blockquote style="border-left:3px solid #e5e7eb;margin:16px 0;padding-left:12px;color:#374151;">${escapeHtml(input.introMessage)}</blockquote>`
    : '';

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:560px;">
      <p>Hi ${escapeHtml(input.recruiterName)},</p>
      <p>
        <strong>${escapeHtml(input.candidateName)}</strong> is interested in the
        <strong> ${escapeHtml(input.jobTitle)}</strong> role at <strong>${escapeHtml(input.company)}</strong> —
        introduced by Jack based on strong profile fit.
      </p>
      ${intro}
      <p><strong>Candidate email:</strong> ${escapeHtml(input.candidateEmail)}</p>
      ${linkedinLine}
      <p style="margin-top:24px;">
        <a href="${input.dashboardUrl}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
          View connection request
        </a>
      </p>
      <p style="margin-top:24px;font-size:13px;color:#6b7280;">
        Sent via HireSchema Jack — AI career agent for job seekers.
      </p>
    </div>
  `;
}

export function buildRecruiterIntroAcceptedEmailHtml(input: {
  candidateName: string;
  recruiterName: string;
  company: string;
  jobTitle: string;
}): string {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:560px;">
      <p>Hi ${escapeHtml(input.candidateName)},</p>
      <p>
        <strong>${escapeHtml(input.recruiterName)}</strong> at <strong>${escapeHtml(input.company)}</strong>
        accepted Jack's introduction for the <strong>${escapeHtml(input.jobTitle)}</strong> role.
      </p>
      <p>They want to move forward — check Jack in your dashboard for mock interview prep and next steps.</p>
      <p style="margin-top:24px;font-size:13px;color:#6b7280;">Sent via HireSchema Jack</p>
    </div>
  `;
}

export function buildJillRecruiterIntroEmailHtml(input: {
  recruiterName: string;
  candidateName: string;
  candidateEmail: string;
  candidateLinkedin?: string;
  jobTitle: string;
  company: string;
  introMessage?: string;
  jillDashboardUrl: string;
  narration: string;
}): string {
  const linkedinLine = input.candidateLinkedin
    ? `<p><strong>LinkedIn:</strong> <a href="${input.candidateLinkedin}">${input.candidateLinkedin}</a></p>`
    : '';
  const intro = input.introMessage
    ? `<blockquote style="border-left:3px solid #e5e7eb;margin:16px 0;padding-left:12px;color:#374151;">${escapeHtml(input.introMessage)}</blockquote>`
    : '';

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:560px;">
      <p>Hi ${escapeHtml(input.recruiterName)},</p>
      <p style="background:#f3f4f6;padding:12px 16px;border-radius:8px;font-size:14px;">
        <strong>Jack made an introduction</strong><br/>
        ${escapeHtml(input.narration)}
      </p>
      <p><strong>${escapeHtml(input.candidateName)}</strong> accepted the intro and wants to connect on <strong>${escapeHtml(input.jobTitle)}</strong>.</p>
      ${intro}
      <p><strong>Email:</strong> ${escapeHtml(input.candidateEmail)}</p>
      ${linkedinLine}
      <p style="margin-top:24px;">
        <a href="${input.jillDashboardUrl}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
          Review in Jill
        </a>
      </p>
      <p style="margin-top:24px;font-size:13px;color:#6b7280;">Jill — AI recruiting agent · HireSchema</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
