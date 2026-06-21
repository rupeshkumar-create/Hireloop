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
import {
  apifyLocationSearchForUser,
  resolveTargetMarkets,
  type TargetMarket,
} from '../lib/targetMarkets.js';
import type { UserCountry } from '../services/remoteEligibility.js';
import {
  apifyTitleExclusionsForCareer,
  apifyTitleSynonyms,
} from '../lib/matchQuality.js';
import {
  buildApifySkillDiscoveryQueries,
  extractRequirementsFromDescription,
  type ProfileSkillInput,
} from '../lib/skillsDatabase/index.js';

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
  /** US/EU discovery bias — defaults to us, eu, uk when omitted. */
  targetMarkets?: TargetMarket[];
  structuredProfile?: ProfileSkillInput['structuredProfile'];
  /** User country for worldwide/APAC discovery extension (e.g. India). */
  userCountry?: UserCountry;
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
  return extractRequirementsFromDescription(description, 8);
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

function apifyTitleSearch(careerPaths: string[], supplemental: string[] = []): string[] {
  const searches = new Set<string>();
  for (const value of [...careerPaths, ...apifyTitleSynonyms(careerPaths), ...supplemental]) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    searches.add(trimmed);
    const core = trimmed.split(/\s[-–|]\s/)[0]?.trim();
    if (core && core.length >= 3) searches.add(core);
  }
  return [...searches].slice(0, 12);
}

function normalizeApifyJobs(items: any[] | undefined | null): DiscoveredJob[] {
  return (items ?? [])
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
  const targetMarkets = resolveTargetMarkets({ targetMarkets: opts.targetMarkets });
  const locationSearch = apifyLocationSearchForUser(targetMarkets, opts.userCountry);
  const skillQueries = buildApifySkillDiscoveryQueries({
    careerPaths: searchPaths,
    resumeText: opts.resumeText,
    structuredProfile: opts.structuredProfile,
  });

  let token = '';
  try {
    token = requireApifyToken(getEnvValue('APIFY_API_TOKEN'));
  } catch (err) {
    console.error('[jobResearcher] Critical Error: Missing Apify Token');
    throw err;
  }

  let allJobs: DiscoveredJob[] = [];
  const titleExclusionSearch = apifyTitleExclusionsForCareer(searchPaths);
  const baseInput = {
    limit: Math.max(10, Math.min(100, Math.ceil(target / searchPaths.length) + 10)),
    includeAi: true,
    descriptionType: 'text' as const,
    includeLinkedIn: false,
    aiHasSalary: false,
    aiVisaSponsorshipFilter: false,
    populateAiRemoteLocation: true,
    populateAiRemoteLocationDerived: true,
    removeAgency: false,
    remoteOnly: true,
    locationSearch,
    aiWorkArrangementFilter: ['Remote OK', 'Remote Solely'] as ('Remote OK' | 'Remote Solely')[],
    ...(titleExclusionSearch.length > 0 ? { titleExclusionSearch } : {}),
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
          titleSearch: apifyTitleSearch([path], skillQueries.supplementalTitleSearch),
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
    const combinedTitles = apifyTitleSearch(searchPaths, skillQueries.supplementalTitleSearch);
    for (const timeRange of ['14d', '30d'] as const) {
      if (allJobs.length >= target) break;
      try {
        console.log(`[jobResearcher] Titled fallback (${timeRange}, ${combinedTitles.length} title terms)`);
        const items = await runCareerSiteActor(
          {
            ...baseInput,
            timeRange,
            titleSearch: combinedTitles,
          },
          token
        );
        successfulAttempts += 1;
        addJobs(normalizeApifyJobs(items), `Titled fallback ${timeRange}`);
      } catch (err) {
        console.warn(`[jobResearcher] Titled fallback ${timeRange} failed:`, err);
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (allJobs.length < target && skillQueries.descriptionSearch.length > 0) {
    for (const timeRange of ['7d', '14d'] as const) {
      if (allJobs.length >= target) break;
      try {
        console.log(
          `[jobResearcher] Skill-targeted search (${timeRange}, ${skillQueries.descriptionSearch.length} description terms)`
        );
        const items = await runCareerSiteActor(
          {
            ...baseInput,
            timeRange,
            titleSearch: apifyTitleSearch(searchPaths, skillQueries.supplementalTitleSearch),
            descriptionSearch: skillQueries.descriptionSearch,
          },
          token
        );
        successfulAttempts += 1;
        addJobs(normalizeApifyJobs(items), `Skill-targeted ${timeRange}`);
      } catch (err) {
        console.warn(`[jobResearcher] Skill-targeted ${timeRange} failed:`, err);
        errors.push(err instanceof Error ? err.message : String(err));
      }
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
