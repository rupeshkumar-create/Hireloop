/**
 * Shared match-quality thresholds and helpers.
 */
import type { DiscoveredJob } from '../services/jobResearcher.js';

/** Production pipeline minimum — prefer fewer strong jobs over filling 10 slots. */
export const PIPELINE_MIN_MATCH_SCORE = 68;

/** Support-focused users — slightly lower floor when strict pipeline returns zero. */
export const SUPPORT_BACKFILL_MIN_MATCH_SCORE = 58;

/** Max posting age before hard rejection (matches validator.ts). */
export const MAX_JOB_AGE_DAYS = 7;

/** Deterministic pool entry — raised from 38 to cut weak candidates early. */
export const MIN_DETERMINISTIC_POOL_SCORE = 45;

/** Quality backfill floor when strict threshold yields zero jobs. */
export const BACKFILL_MIN_DETERMINISTIC = 52;

/** Emergency backfill floor — never surface near-random listings. */
export const EMERGENCY_MIN_DETERMINISTIC = 38;

const HYBRID_RE =
  /\b(hybrid|(\d+\s*days?\s+in[- ]office)|partially\s+remote|remote[- ]first\s+hybrid|on[- ]site\s+required)\b/i;

const SUPPORT_CAREER_RE =
  /\b(customer\s+support|technical\s+support|help\s*desk|support\s+specialist|support\s+agent|support\s+representative|client\s+support|cx\s+specialist|customer\s+care)\b/i;

export const SUPPORT_TITLE_RE =
  /\b(customer\s+support|technical\s+support|help\s*desk|support\s+specialist|support\s+agent|support\s+representative|client\s+support|customer\s+care|client\s+care|cx\s+specialist|support\s+engineer|it\s+support)\b/i;

const ENGINEERING_TITLE_RE =
  /\b(software\s+engineer|frontend\s+engineer|backend\s+engineer|full[\s-]?stack|devops|sre|platform\s+engineer|data\s+engineer|machine\s+learning\s+engineer|mobile\s+developer)\b/i;

export function isHybridOrOnsiteJob(job: DiscoveredJob): boolean {
  if (job.workType === 'hybrid' || job.workType === 'onsite') return true;
  const blob = `${job.title} ${job.location} ${job.description} ${job.aiDescriptionEnriched || ''}`;
  if (HYBRID_RE.test(blob)) return true;
  if (/\bon[- ]?site\b/i.test(blob) && !/\bfully\s+remote\b/i.test(blob)) return true;
  return false;
}

export function isSupportFocusedCareer(careerPaths: string[], roles: string[] = []): boolean {
  const haystack = [...careerPaths, ...roles].join(' ').toLowerCase();
  if (SUPPORT_CAREER_RE.test(haystack)) return true;
  return careerPaths.some((p) => {
    const lower = p.toLowerCase();
    return lower.includes('support') && !lower.includes('customer success');
  });
}

/** Block engineering/sales/etc. noise for customer-support-focused users. */
export function passesSupportCompatibilityGate(
  job: DiscoveredJob,
  careerPaths: string[],
  roles: string[] = []
): boolean {
  if (!isSupportFocusedCareer(careerPaths, roles)) return true;

  const title = job.title.toLowerCase();
  if (SUPPORT_TITLE_RE.test(title)) return true;

  if (ENGINEERING_TITLE_RE.test(title)) return false;

  const titleTokens = title.split(/\s+/);
  const noiseTitles = ['account manager', 'business development', 'recruiter', 'product manager'];
  if (noiseTitles.some((n) => title.includes(n))) return false;

  // Generic "customer success" without support path — only allow if user path mentions success
  if (/\bcustomer\s+success\b/i.test(title) && !careerPaths.some((p) => /success/i.test(p))) {
    return false;
  }

  // Single token "customer" or "service" in title is not enough for support users
  if (titleTokens.length <= 2 && /\b(customer|service)\b/.test(title) && !/\bsupport\b/.test(title)) {
    return false;
  }

  return true;
}

export function apifyTitleExclusionsForCareer(careerPaths: string[]): string[] {
  if (!isSupportFocusedCareer(careerPaths)) return [];
  return [
    'Software Engineer',
    'Frontend Engineer',
    'Backend Engineer',
    'Product Manager',
    'Data Scientist',
    'Marketing Manager',
    'Sales Development Representative',
    'Account Executive',
  ];
}

export function apifyTitleSynonyms(careerPaths: string[]): string[] {
  const extra = new Set<string>();
  for (const path of careerPaths) {
    const lower = path.toLowerCase();
    if (SUPPORT_CAREER_RE.test(lower) || (lower.includes('support') && !lower.includes('success'))) {
      extra.add('Customer Support');
      extra.add('Technical Support');
      extra.add('Customer Service');
      extra.add('Help Desk');
      extra.add('Client Support');
    }
  }
  return [...extra];
}
