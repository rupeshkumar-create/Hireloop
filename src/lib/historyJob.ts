import type { DailyJob } from '../types/dailyJob';
import type { Job } from '../types/dashboard';
import { jobFingerprint } from '../services/jobResearcher';

type HistoryJobInput = Partial<DailyJob> & {
  title?: string;
  company?: string;
  saved?: boolean;
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n|•|;/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

/** Ensure history rows have the fields JobDetailsPanel expects. */
export function normalizeHistoryJobToDashboardJob(job: HistoryJobInput): Job {
  const title = (job.title || 'Untitled role').trim();
  const company = (job.company || 'Unknown company').trim();
  const fp = job.fingerprint || job.id || jobFingerprint(title, company);
  const summary = job.aiSummary || job.aiInsight || '';
  const description =
    (typeof job.description === 'string' && job.description.trim()) ||
    summary ||
    `${company} is hiring for ${title}.`;

  return {
    id: job.id || fp,
    fingerprint: fp,
    title,
    company,
    location: job.location || 'Remote',
    workType: job.workType || 'remote',
    salary: job.salary || '',
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    logoUrl: job.logoUrl,
    description,
    requirements: asStringArray(job.requirements),
    source: job.source || 'scout_history',
    applyUrl: job.applyUrl,
    postedAt: job.postedAt || new Date().toISOString(),
    daysOld: job.daysOld,
    matchScore:
      typeof job.matchScore === 'number'
        ? job.matchScore
        : typeof job.finalScore === 'number'
          ? job.finalScore
          : 0,
    finalScore:
      typeof job.finalScore === 'number'
        ? job.finalScore
        : typeof job.matchScore === 'number'
          ? job.matchScore
          : 0,
    matchReasons: asStringArray(job.matchReasons),
    skillGaps: asStringArray(job.skillGaps),
    aiSummary: summary || description.slice(0, 280),
    aiInsight: job.aiInsight,
    isHotJob: Boolean(job.isHotJob),
    hotSignals: asStringArray(job.hotSignals),
    companyStage: job.companyStage,
    estimatedSalary: job.estimatedSalary,
    matchedCareerPath: job.matchedCareerPath,
  };
}
