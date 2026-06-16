// Tracked-job model + pure helpers.
//
// Centralises the schema, asset-completeness checks, time-since helpers,
// follow-up heuristics, CSV and ICS exports. Everything here is pure and
// unit-testable so the UI layer can stay thin.

export type TrackedJobStatus =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'rejected';

export interface TrackedJobContact {
  recruiterName?: string;
  recruiterEmail?: string;
  hiringManagerName?: string;
  hiringManagerEmail?: string;
  referrerName?: string;
  notes?: string;
}

export interface TrackedJob {
  id: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  status: TrackedJobStatus;
  url: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
  // Stage timestamps — auto-stamped on status transitions.
  statusChangedAt?: string;
  appliedAt?: string;
  interviewAt?: string;
  offerDeadline?: string;
  // Generated assets — persisted to the doc, surfaced as completeness signals.
  coldEmail?: string;
  tailoredResume?: string;
  coverLetter?: string;
  interviewQuestions?: string | string[];
  followUpEmail?: string;
  // Contact details — formerly just contactEmail; expanded to a structured object.
  contactEmail?: string;
  contact?: TrackedJobContact;
  // Free-text observation log — recruiter conversations, take-home links, etc.
  journal?: string;
  // Match score persisted at save-time so the card can still rank later.
  matchScore?: number;
  finalScore?: number;
}

// ─── Time-aware helpers ──────────────────────────────────────────────────────

export function daysBetween(fromIso?: string, now: Date = new Date()): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return null;
  return Math.floor((now.getTime() - from.getTime()) / 86_400_000);
}

export interface TimeAwareLabel {
  label: string;
  tone: 'green' | 'amber' | 'red' | 'muted';
}

/** Produces the "what's getting old?" headline shown on each card. */
export function timeAwareLabel(job: TrackedJob, now: Date = new Date()): TimeAwareLabel {
  if (job.status === 'rejected') {
    const d = daysBetween(job.statusChangedAt || job.updatedAt, now);
    return { label: d == null ? 'Rejected' : `Rejected ${d}d ago`, tone: 'muted' };
  }
  if (job.status === 'offered') {
    const deadlineDays = daysBetween(new Date().toISOString(), new Date(job.offerDeadline || ''));
    // Negative days = future deadline
    if (job.offerDeadline) {
      const remaining = Math.ceil(
        (new Date(job.offerDeadline).getTime() - now.getTime()) / 86_400_000,
      );
      if (remaining < 0) return { label: 'Decision past due', tone: 'red' };
      if (remaining <= 2) return { label: `Decide in ${remaining}d`, tone: 'red' };
      if (remaining <= 7) return { label: `Decide in ${remaining}d`, tone: 'amber' };
      return { label: `Decide in ${remaining}d`, tone: 'green' };
    }
    return { label: 'Offer received', tone: 'green' };
  }
  if (job.status === 'interviewing') {
    if (job.interviewAt) {
      const ms = new Date(job.interviewAt).getTime() - now.getTime();
      const hours = ms / 3_600_000;
      if (hours < 0) return { label: 'Interview passed — log outcome', tone: 'amber' };
      if (hours <= 24) return { label: `Interview in ${Math.max(1, Math.round(hours))}h`, tone: 'red' };
      const days = Math.ceil(hours / 24);
      return { label: `Interview in ${days}d`, tone: 'amber' };
    }
    const d = daysBetween(job.statusChangedAt, now);
    return { label: d == null ? 'Interviewing' : `Interviewing — added ${d}d ago`, tone: 'amber' };
  }
  if (job.status === 'applied') {
    const d = daysBetween(job.appliedAt || job.statusChangedAt, now);
    if (d == null) return { label: 'Applied', tone: 'green' };
    if (d <= 6) return { label: `Applied ${d}d ago`, tone: 'green' };
    if (d <= 13) return { label: `Applied ${d}d ago · follow up?`, tone: 'amber' };
    return { label: `Applied ${d}d ago · stalled`, tone: 'red' };
  }
  // saved
  const d = daysBetween(job.createdAt, now);
  if (d == null) return { label: 'Saved', tone: 'muted' };
  if (d <= 2) return { label: `Saved ${d}d ago`, tone: 'green' };
  if (d <= 6) return { label: `Saved ${d}d ago — apply?`, tone: 'amber' };
  return { label: `Saved ${d}d ago — apply or drop?`, tone: 'red' };
}

// ─── Status transition side-effects ───────────────────────────────────────────

/**
 * Returns the patch to apply to Firestore when a job's status changes. Stamps
 * the right timestamp(s) on each transition. Idempotent — calling it with the
 * same status twice produces an empty patch (no-op write).
 */
export function statusTransitionPatch(
  prev: TrackedJob,
  nextStatus: TrackedJobStatus,
  now: Date = new Date(),
): Partial<TrackedJob> {
  if (prev.status === nextStatus) return {};
  const iso = now.toISOString();
  const patch: Partial<TrackedJob> = {
    status: nextStatus,
    statusChangedAt: iso,
    updatedAt: iso,
  };
  if (nextStatus === 'applied' && !prev.appliedAt) {
    patch.appliedAt = iso;
  }
  return patch;
}

// ─── Asset completeness ──────────────────────────────────────────────────────

export interface AssetCompleteness {
  resume: boolean;
  email: boolean;
  coverLetter: boolean;
  interview: boolean;
  followUp: boolean;
  /** 0–5 — number of assets generated. */
  completed: number;
  total: number;
}

export function assetCompleteness(job: TrackedJob): AssetCompleteness {
  const resume = !!(job.tailoredResume && job.tailoredResume.trim());
  const email = !!(job.coldEmail && job.coldEmail.trim());
  const coverLetter = !!(job.coverLetter && job.coverLetter.trim());
  const followUp = !!(job.followUpEmail && job.followUpEmail.trim());
  const interview = !!(
    (typeof job.interviewQuestions === 'string' && job.interviewQuestions.trim()) ||
    (Array.isArray(job.interviewQuestions) && job.interviewQuestions.length > 0)
  );
  const completed = [resume, email, coverLetter, interview, followUp].filter(Boolean).length;
  return { resume, email, coverLetter, interview, followUp, completed, total: 5 };
}

// ─── Follow-up surfacing ──────────────────────────────────────────────────────

export interface FollowUpHint {
  /** Whether the card should prompt for a follow-up right now. */
  shouldPrompt: boolean;
  /** Human-readable urgency reason. */
  reason?: string;
}

export function followUpHint(job: TrackedJob, now: Date = new Date()): FollowUpHint {
  if (job.status !== 'applied') return { shouldPrompt: false };
  // If a follow-up was already drafted+stored, don't keep nagging.
  if (job.followUpEmail && job.followUpEmail.trim()) return { shouldPrompt: false };
  const d = daysBetween(job.appliedAt || job.statusChangedAt, now);
  if (d == null || d < 7) return { shouldPrompt: false };
  if (d < 14) return { shouldPrompt: true, reason: `${d} days since you applied — polite follow-up?` };
  return { shouldPrompt: true, reason: `${d} days, no response — try one more time?` };
}

// ─── Pipeline funnel metrics ──────────────────────────────────────────────────

export interface PipelineMetrics {
  total: number;
  saved: number;
  applied: number;
  interviewing: number;
  offered: number;
  rejected: number;
  /** Of saved jobs (lifetime), what fraction reached "applied" or later. */
  saveToApplyRate: number;
  /** Of applied jobs (lifetime), what fraction reached "interviewing" or later. */
  applyToInterviewRate: number;
  /** Of interviewing jobs, what fraction reached "offered". */
  interviewToOfferRate: number;
  /** Median days from createdAt → appliedAt across applied jobs. */
  medianTimeToApplyDays: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function pipelineMetrics(jobs: TrackedJob[]): PipelineMetrics {
  const byStatus = {
    saved: 0, applied: 0, interviewing: 0, offered: 0, rejected: 0,
  } as Record<TrackedJobStatus, number>;
  for (const j of jobs) {
    if (j.status in byStatus) byStatus[j.status]++;
  }
  // Lifetime-stage counts: any job whose status is "applied" or later counts as applied at some point.
  // We use status alone here as an approximation; richer histories would require event logs.
  const advancedToApplied = byStatus.applied + byStatus.interviewing + byStatus.offered + byStatus.rejected;
  const advancedToInterview = byStatus.interviewing + byStatus.offered;
  const total = jobs.length;

  const applyDeltas = jobs
    .filter((j) => j.appliedAt && j.createdAt)
    .map((j) => daysBetween(j.createdAt, new Date(j.appliedAt!)))
    .filter((d): d is number => d !== null && d >= 0);

  return {
    total,
    saved:        byStatus.saved,
    applied:      byStatus.applied,
    interviewing: byStatus.interviewing,
    offered:      byStatus.offered,
    rejected:     byStatus.rejected,
    saveToApplyRate:      total > 0 ? advancedToApplied / total : 0,
    applyToInterviewRate: advancedToApplied > 0 ? advancedToInterview / advancedToApplied : 0,
    interviewToOfferRate: advancedToInterview > 0 ? byStatus.offered / advancedToInterview : 0,
    medianTimeToApplyDays: median(applyDeltas),
  };
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function searchTrackedJobs(jobs: TrackedJob[], query: string): TrackedJob[] {
  const q = query.trim().toLowerCase();
  if (!q) return jobs;
  return jobs.filter((j) => {
    const haystack = [
      j.title, j.company, j.location, j.notes, j.journal,
      j.contact?.recruiterName, j.contact?.hiringManagerName,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function trackedJobsToCsv(jobs: TrackedJob[]): string {
  const header = [
    'Title', 'Company', 'Location', 'Status', 'Salary', 'URL',
    'Created', 'Applied', 'Status changed', 'Interview at', 'Offer deadline',
    'Resume tailored', 'Email drafted', 'Cover letter', 'Interview prep', 'Follow-up drafted',
    'Recruiter', 'Hiring manager', 'Notes', 'Journal',
  ];
  const rows = jobs.map((j) => {
    const a = assetCompleteness(j);
    return [
      j.title, j.company, j.location, j.status, j.salary, j.url,
      j.createdAt, j.appliedAt || '', j.statusChangedAt || '',
      j.interviewAt || '', j.offerDeadline || '',
      a.resume ? 'yes' : 'no',
      a.email ? 'yes' : 'no',
      a.coverLetter ? 'yes' : 'no',
      a.interview ? 'yes' : 'no',
      a.followUp ? 'yes' : 'no',
      j.contact?.recruiterName || '',
      j.contact?.hiringManagerName || '',
      j.notes || '',
      j.journal || '',
    ].map(csvEscape).join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

// ─── Calendar (.ics) export for interviews ───────────────────────────────────

function icsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // UTC basic format, e.g. 20260515T130000Z
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

/** Generates a single combined .ics with one VEVENT per scheduled interview. */
export function trackedJobsToIcs(jobs: TrackedJob[]): string {
  const events = jobs
    .filter((j) => j.interviewAt)
    .map((j) => {
      const start = icsDate(j.interviewAt!);
      // Default 1-hour interview block when end time unknown.
      const startDate = new Date(j.interviewAt!);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const end = icsDate(endDate.toISOString());
      const dtstamp = icsDate(new Date().toISOString());
      return [
        'BEGIN:VEVENT',
        `UID:${j.id}@hireschema.com`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${icsEscape(`Interview · ${j.title} @ ${j.company}`)}`,
        j.url ? `URL:${icsEscape(j.url)}` : '',
        `DESCRIPTION:${icsEscape(`Tracked via Hireschema. Status: ${j.status}.`)}`,
        'END:VEVENT',
      ].filter(Boolean).join('\r\n');
    });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hireschema//Pipeline//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
