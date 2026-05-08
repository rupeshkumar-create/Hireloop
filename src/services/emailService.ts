import type { DailyJob } from '../types/dailyJob.js';

const sendResendEmail = async (payload: any) => {
  try {
    const response = await fetch('/api/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error response:', data);
      throw new Error(data.error || 'Failed to send email');
    }
    return data;
  } catch (error) {
    console.error('Error in sendResendEmail:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Welcome email
// ─────────────────────────────────────────────────────────────────────────────

export const sendSignupEmail = async (userEmail: string, userName: string) => {
  return sendResendEmail({
    from: 'Hireschema <onboarding@hireschema.com>',
    to: [userEmail],
    subject: 'Welcome to Hireschema',
    html: `
      <div style="font-family: sans-serif; color: #18181b;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome to Hireschema.</h1>
        <p style="font-size: 16px; margin-bottom: 24px;">Your AI recruiting agent is ready. Upload your resume to start getting daily job matches curated just for you.</p>
        <a href="https://hireschema.com/dashboard" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">Go to Dashboard</a>
      </div>
    `,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Daily job digest – rich card-based email
// ─────────────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a'; // green
  if (score >= 60) return '#ca8a04'; // amber
  return '#6b7280';                  // grey
}

function workTypePill(workType?: string): string {
  if (!workType || workType === 'unknown') return '';
  const colors: Record<string, string> = {
    remote:  'background:#dcfce7;color:#166534',
    hybrid:  'background:#dbeafe;color:#1e40af',
    onsite:  'background:#ffedd5;color:#9a3412',
  };
  const style = colors[workType] || 'background:#f3f4f6;color:#374151';
  const label = workType.charAt(0).toUpperCase() + workType.slice(1);
  return `<span style="display:inline-block;${style};border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:600;">${label}</span>`;
}

function jobCard(job: DailyJob, index: number): string {
  const matchReasons = (job.matchReasons || []).slice(0, 3)
    .map((r) => `<li style="margin:0 0 4px 0;font-size:12px;color:#374151;">✓ ${r}</li>`)
    .join('');

  const skillGaps = (job.skillGaps || []).slice(0, 2)
    .map((g) => `<li style="margin:0 0 4px 0;font-size:12px;color:#92400e;">⚠ ${g}</li>`)
    .join('');

  const hotBadge = job.isHotJob
    ? `<span style="background:#fef2f2;color:#b91c1c;border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:700;margin-left:6px;">⚡ Hot</span>`
    : '';

  const salary = job.salary || job.estimatedSalary
    ? `<span style="color:#6b7280;font-size:13px;">💰 ${job.salary || job.estimatedSalary}${!job.salary && job.estimatedSalary ? ' (est.)' : ''}</span>`
    : '';

  return `
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
    <!-- Rank + match score -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
      <div>
        <span style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">#${index + 1}</span>
        <h2 style="margin:4px 0 2px;font-size:17px;font-weight:700;color:#111827;">${job.title}${hotBadge}</h2>
        <p style="margin:0;font-size:14px;font-weight:500;color:#374151;">${job.company}</p>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:12px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 12px;">
          <span style="font-size:20px;font-weight:800;color:${scoreColor(job.matchScore)};">${job.matchScore}%</span>
          <p style="margin:0;font-size:10px;color:#6b7280;">match</p>
        </div>
      </div>
    </div>

    <!-- Meta -->
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;">
      <span style="color:#6b7280;font-size:13px;">📍 ${job.location}</span>
      ${salary}
      ${workTypePill(job.workType)}
      ${job.companyStage && job.companyStage !== 'Unknown' ? `<span style="color:#6b7280;font-size:13px;">📈 ${job.companyStage}</span>` : ''}
    </div>

    <!-- AI Summary -->
    ${job.aiSummary ? `<p style="font-size:13px;color:#4b5563;line-height:1.5;margin-bottom:12px;border-left:3px solid #e5e7eb;padding-left:10px;">${job.aiSummary}</p>` : ''}

    <!-- Why you match -->
    ${matchReasons ? `
    <div style="background:#f0fdf4;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Why you match</p>
      <ul style="margin:0;padding:0;list-style:none;">${matchReasons}</ul>
    </div>` : ''}

    <!-- Skill gaps -->
    ${skillGaps ? `
    <div style="background:#fffbeb;border-radius:8px;padding:10px 14px;margin-bottom:12px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">Skill gaps</p>
      <ul style="margin:0;padding:0;list-style:none;">${skillGaps}</ul>
    </div>` : ''}

    <!-- CTA -->
    <a href="https://hireschema.com/dashboard" style="display:inline-block;background:#18181b;color:#ffffff;padding:10px 20px;text-decoration:none;font-weight:600;font-size:13px;border-radius:8px;">
      View &amp; Save in Dashboard →
    </a>
  </div>`;
}

export function buildDailyJobAlertsEmailPayload(userEmail: string, jobs: DailyJob[]) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const topMatchScore = jobs[0]?.matchScore ?? 0;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;color:#111827;">Hireschema</h1>
    <p style="margin:0;font-size:13px;color:#6b7280;">Your AI recruiting agent · ${today}</p>
  </div>

  <!-- Summary banner -->
  <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);border-radius:12px;padding:20px 24px;margin-bottom:24px;color:#fff;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;opacity:0.85;">TODAY'S MATCHES</p>
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;">${jobs.length} jobs curated for you</h2>
    <p style="margin:0;font-size:13px;opacity:0.85;">Top match score: <strong>${topMatchScore}%</strong> · All details are inside — no external browsing needed.</p>
  </div>

  <!-- Job cards -->
  ${jobs.map((job, i) => jobCard(job, i)).join('')}

  <!-- Footer CTA -->
  <div style="text-align:center;margin-top:24px;padding:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;">
    <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600;">Save jobs, generate cold emails &amp; tailor your resume — all in one place.</p>
    <a href="https://hireschema.com/dashboard" style="display:inline-block;background:#18181b;color:#fff;padding:12px 28px;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;">Open Dashboard</a>
  </div>

  <!-- Unsubscribe footer -->
  <p style="text-align:center;margin-top:16px;font-size:11px;color:#9ca3af;">
    Hireschema · You're receiving this because you opted in to daily alerts.<br>
    <a href="https://hireschema.com/settings" style="color:#9ca3af;">Manage email preferences</a>
  </p>

</div>
</body>
</html>`;

  return {
    from: 'Hireschema Alerts <alerts@hireschema.com>',
    to: [userEmail],
    subject: `Your ${jobs.length} Daily Job Matches — Top: ${topMatchScore}% fit`,
    html,
  };
}

export const sendDailyJobAlertsEmail = async (userEmail: string, jobs: DailyJob[]) => {
  if (!jobs || jobs.length === 0) return null;
  return sendResendEmail(buildDailyJobAlertsEmailPayload(userEmail, jobs));
};
