/**
 * Central schedule for Hireschema background jobs.
 * Production runs on Vercel Hobby — Scout uses GitHub Actions:
 *   `.github/workflows/generate-jobs.yml`
 * Blog content is updated manually (no automated publish cron).
 * `/api/cron/tick` remains for manual batch runs with CRON_SECRET (60s cap on Vercel).
 */

export type CronJobId = 'daily-alerts';

export interface CronJobSchedule {
  id: CronJobId;
  label: string;
  /** Hour in UTC (0–23) when this job should run. */
  hourUtc: number;
  /** Minute in UTC (0–59). */
  minuteUtc: number;
  /** If set, only run on this weekday (0=Sun … 6=Sat). */
  dayOfWeekUtc?: number;
  /** If set, only run on this calendar day of month (1–31). */
  dayOfMonthUtc?: number;
}

/** Scheduled jobs — Scout runs via GitHub Actions. */
export const CRON_JOBS: CronJobSchedule[] = [
  {
    id: 'daily-alerts',
    label: 'Daily Scout dispatch (legacy API — Scout uses GitHub Actions)',
    hourUtc: 8,
    minuteUtc: 0,
  },
];

const WINDOW_MINUTES = 24 * 60;

function matchesDayOfWeek(now: Date, dayOfWeek?: number): boolean {
  if (dayOfWeek === undefined) return true;
  return now.getUTCDay() === dayOfWeek;
}

function matchesDayOfMonth(now: Date, dayOfMonth?: number): boolean {
  if (dayOfMonth === undefined) return true;
  return now.getUTCDate() === dayOfMonth;
}

function minutesSinceScheduled(now: Date, hourUtc: number, minuteUtc: number): number {
  const elapsedMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const scheduledMinutes = hourUtc * 60 + minuteUtc;
  return elapsedMinutes - scheduledMinutes;
}

export function isCronJobDue(schedule: CronJobSchedule, now: Date = new Date()): boolean {
  if (!matchesDayOfWeek(now, schedule.dayOfWeekUtc)) return false;
  if (!matchesDayOfMonth(now, schedule.dayOfMonthUtc)) return false;

  const delta = minutesSinceScheduled(now, schedule.hourUtc, schedule.minuteUtc);
  return delta >= 0 && delta < WINDOW_MINUTES;
}

export function getDueCronJobs(
  now: Date = new Date(),
  options?: { force?: CronJobId | 'all' }
): CronJobSchedule[] {
  if (options?.force === 'all') return [...CRON_JOBS];
  if (options?.force) {
    const match = CRON_JOBS.find((job) => job.id === options.force);
    return match ? [match] : [];
  }
  return CRON_JOBS.filter((job) => isCronJobDue(job, now));
}

export function describeCronScheduleForDocs(): string {
  return CRON_JOBS.map(
    (job) =>
      `- **${job.id}** — ${job.label} (${formatSchedule(job)})`
  ).join('\n');
}

function formatSchedule(job: CronJobSchedule): string {
  const time = `${String(job.hourUtc).padStart(2, '0')}:${String(job.minuteUtc).padStart(2, '0')} UTC`;
  if (job.dayOfMonthUtc !== undefined) return `day ${job.dayOfMonthUtc} of month at ${time}`;
  if (job.dayOfWeekUtc !== undefined) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[job.dayOfWeekUtc]} at ${time}`;
  }
  return `daily at ${time}`;
}

/** Vercel Hobby serverless function budget (deploy root). */
export const VERCEL_FUNCTION_MANIFEST = [
  { path: 'api/cron/[job].ts', purpose: 'All cron routes incl. /api/cron/tick' },
  { path: 'api/jobs/index.ts', purpose: 'User-triggered Scout runs' },
  { path: 'api/ai/[[...route]].ts', purpose: 'OpenAI + Apollo proxies' },
  { path: 'api/blog/[[...route]].ts', purpose: 'Blog API + RSS + covers' },
  { path: 'api/admin/[[...route]].ts', purpose: 'Super Admin API' },
  { path: 'api/public/[[...route]].ts', purpose: 'Sitemap + analytics' },
  { path: 'api/webhook/dodo.ts', purpose: 'Billing webhooks' },
] as const;

export const VERCEL_FUNCTION_COUNT = VERCEL_FUNCTION_MANIFEST.length;
export const VERCEL_FUNCTION_LIMIT = 12;
