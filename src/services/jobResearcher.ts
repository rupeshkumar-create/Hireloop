/**
 * jobResearcher.ts
 *
 * Strict Apify-only job discovery for Daily Jobs.
 *
 * Uses 'fantastic-jobs/career-site-job-listing-api' with enriched AI data.
 */

import { normalizeApifyItem, requireApifyToken, runCareerSiteActor } from './jobSources/apifyCareerSite.js';
import { normalizeLinkedInItem, runLinkedInActor } from './jobSources/apifyLinkedIn.js';
import type { ApifyCareerSiteInput } from './jobSources/apifyCareerSite.js';

export type JobWorkType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type JobSource = string;

export interface DiscoveredJob {
  fingerprint: string;
  jobId?: string;
  title: string;
  company: string;
  location: string;
  workType: JobWorkType;
  salary: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  logoUrl?: string;
  description: string;
  aiDescriptionEnriched?: string;
  requirements: string[];
  source: JobSource;
  applyUrl?: string;
  postedAt: string;
  daysOld: number;
  matchedCareerPath?: string;
}

export interface ResearchOptions {
  careerPaths: string[];
  resumeText: string;
  jobType?: string;
  location?: string;
  targetCount?: number;
}

export interface ResearchResult {
  jobs: DiscoveredJob[];
  sources: Record<JobSource, number>;
  totalFound: number;
  deduplicated: number;
}

export type CallAIFn = (
  messages: { role: string; content: string }[],
  model: string
) => Promise<string>;

const SKILL_LIST = [
  'python', 'javascript', 'typescript', 'react', 'next.js', 'vue', 'angular',
  'node.js', 'golang', 'java', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'c++',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'linux',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'rest api',
  'machine learning', 'deep learning', 'data science', 'llm', 'ai', 'nlp',
  'tensorflow', 'pytorch', 'scikit-learn', 'spark', 'kafka', 'airflow',
  'devops', 'ci/cd', 'git', 'agile', 'scrum',
  'product management', 'product strategy', 'roadmap', 'figma', 'ux',
  'cybersecurity', 'penetration testing', 'blockchain', 'solidity',
  'scala', 'elixir', 'clojure', 'haskell', 'cloud', 'microservices',
];

export function jobFingerprint(title: string, company: string): string {
  return `${title.toLowerCase().trim()}::${company.toLowerCase().trim()}`;
}

function getEnvValue(name: string): string {
  if (typeof process === 'undefined') return '';
  return typeof process.env?.[name] === 'string' ? (process.env[name] as string) : '';
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value: unknown): string {
  if (typeof value === 'number') {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  return new Date().toISOString();
}

function daysOld(postedAt: string): number {
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

function detectWorkType(text: string): JobWorkType {
  const lower = text.toLowerCase();
  if (/\bremote\b|work from anywhere|distributed|anywhere/i.test(lower)) return 'remote';
  if (/\bhybrid\b/i.test(lower)) return 'hybrid';
  if (/on-?site|in office|in-office/i.test(lower)) return 'onsite';
  return 'remote';
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+\bat\s+.+$/i, '')
    .replace(/\s[-–|]\s[^-|–]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRequirements(description: string): string[] {
  const lower = description.toLowerCase();
  const skills = SKILL_LIST.filter((skill) => lower.includes(skill));
  if (skills.length > 0) return skills.slice(0, 8);

  return description
    .split(/[.;]\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20 && part.length <= 140)
    .slice(0, 6);
}

function deduplicateJobs(jobs: DiscoveredJob[]): { jobs: DiscoveredJob[]; deduplicated: number } {
  const seen = new Set<string>();
  const result: DiscoveredJob[] = [];

  for (const job of jobs) {
    const key = job.jobId || `${job.fingerprint}::${job.applyUrl || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(job);
  }

  return { jobs: result, deduplicated: jobs.length - result.length };
}

function mapAtsAllowlistToApifyAts(profileAts: Array<'greenhouse' | 'lever'>): string[] {
  const mapped = profileAts.map((ats) => (ats === 'lever' ? 'lever.co' : 'greenhouse'));
  return Array.from(new Set(mapped));
}

function apifyTitleSearch(careerPaths: string[]): string[] {
  const searches = new Set<string>();
  for (const value of careerPaths) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    searches.add(trimmed);
    // Also search the core role before industry suffixes, e.g.
    // "Category Manager - Fashion E-commerce" → "Category Manager"
    const core = trimmed.split(/\s[-–|]\s/)[0]?.trim();
    if (core && core.length >= 3) searches.add(core);
  }
  return [...searches].slice(0, 10);
}

function normalizeApifyJobs(items: any[]): DiscoveredJob[] {
  return items
    .map(normalizeApifyItem)
    .filter((job): job is NonNullable<typeof job> => job !== null)
    .map((job) => {
      const postedAt = parseDate(job.postedAt);
      const workType = detectWorkType(`${job.workTypeHint} ${job.location} ${job.title} ${job.description}`);
      const normalized: DiscoveredJob = {
        fingerprint: jobFingerprint(cleanTitle(job.title), job.company),
        jobId: job.jobId,
        title: cleanTitle(job.title),
        company: job.company,
        location: job.location,
        workType,
        salary: job.salary,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        logoUrl: job.logoUrl,
        description: stripHtml(job.description),
        aiDescriptionEnriched: job.aiDescriptionEnriched,
        requirements: job.requirements.length ? job.requirements.slice(0, 8) : extractRequirements(job.description),
        source: 'apifyCareerSite',
        applyUrl: job.applyUrl,
        postedAt,
        daysOld: daysOld(postedAt),
      };
      return normalized;
    });
}

export async function researchJobs(
  opts: ResearchOptions,
  _callAI?: CallAIFn
): Promise<ResearchResult> {
  const target = Math.max(10, opts.targetCount ?? 60);
  const priorityPaths = (opts.careerPaths || []).filter(Boolean).slice(0, 3);
  const searchPaths = priorityPaths.length > 0 ? priorityPaths : ['remote software engineer'];

  let token = '';
  try {
    token = requireApifyToken(getEnvValue('APIFY_API_TOKEN'));
  } catch (err) {
    console.error('[jobResearcher] Critical Error: Missing Apify Token');
    throw err;
  }

  let allJobs: DiscoveredJob[] = [];
  const baseInput = {
    limit: Math.max(10, Math.min(100, Math.ceil(target / searchPaths.length) + 10)),
    includeAi: true,
    descriptionType: 'text' as const,
    includeLinkedIn: false,
    aiHasSalary: false,
    aiVisaSponsorshipFilter: false,
    populateAiRemoteLocation: false,
    populateAiRemoteLocationDerived: false,
    removeAgency: false,
    remoteOnly: true,
    aiWorkArrangementFilter: ['Remote OK', 'Remote Solely'] as ('Remote OK' | 'Remote Solely')[],
  };
  const errors: string[] = [];
  let successfulAttempts = 0;
  const seenFingerprints = new Set<string>();

  const addJobs = (jobs: DiscoveredJob[], label: string) => {
    let added = 0;
    for (const job of jobs) {
      if (seenFingerprints.has(job.fingerprint)) continue;
      seenFingerprints.add(job.fingerprint);
      allJobs.push(job);
      added += 1;
    }
    console.log(`[jobResearcher] ${label} added ${added} new jobs (total ${allJobs.length}).`);
  };

  // Priority 1 → 2 → 3: strict title search per path before broad fallback.
  for (let i = 0; i < searchPaths.length; i++) {
    const path = searchPaths[i]!;
    if (allJobs.length >= target * 2) break;

    try {
      console.log(`[jobResearcher] Priority ${i + 1} strict search: "${path}"`);
      const items = await runCareerSiteActor(
        {
          ...baseInput,
          timeRange: '7d' as const,
          titleSearch: apifyTitleSearch([path]),
        },
        token
      );
      successfulAttempts += 1;
      addJobs(normalizeApifyJobs(items), `Priority ${i + 1} strict`);
    } catch (err) {
      console.warn(`[jobResearcher] Priority ${i + 1} strict search failed:`, err);
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (allJobs.length < target) {
    try {
      console.log('[jobResearcher] Broad fallback (no title filter)');
      const items = await runCareerSiteActor(
        {
          ...baseInput,
          timeRange: '6m' as const,
        },
        token
      );
      successfulAttempts += 1;
      addJobs(normalizeApifyJobs(items), 'Broad fallback');
    } catch (err) {
      console.warn('[jobResearcher] Broad fallback failed:', err);
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (successfulAttempts === 0) {
    throw new Error(`Apify job discovery failed: ${errors.join(' | ') || 'No actor attempts completed.'}`);
  }

  // Belt-and-suspenders remote filter — defends against any onsite / hybrid
  // listings Apify's filters fail to catch (some career sites mislabel work
  // arrangement). A job qualifies as remote if its workType is 'remote' OR
  // its location text contains 'remote', 'anywhere', or 'work from home'.
  const REMOTE_LOC_RE = /remote|anywhere|work\s*from\s*home|wfh/i;
  const remoteOnly = allJobs.filter((j) => {
    if (j.workType === 'remote') return true;
    if (REMOTE_LOC_RE.test(j.location || '')) return true;
    return false;
  });
  console.log(`[jobResearcher] Remote-only filter: ${allJobs.length} -> ${remoteOnly.length} jobs.`);

  const { jobs, deduplicated } = deduplicateJobs(remoteOnly);
  const selected = jobs.sort((a, b) => a.daysOld - b.daysOld).slice(0, target);

  const sourceCounts: Record<string, number> = {};
  for (const job of selected) {
    sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
  }

  return {
    jobs: selected,
    sources: sourceCounts,
    totalFound: allJobs.length,
    deduplicated,
  };
}
