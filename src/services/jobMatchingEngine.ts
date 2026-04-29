import type { DiscoveredJob, CallAIFn } from './jobResearcher';
import type { DailyJob } from '../types/dailyJob';
import { jobMatchesUserPreferences, normalizeUserPreferences } from './validator';

const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are',
  'our', 'will', 'have', 'has', 'role', 'job', 'work', 'team', 'remote',
  'senior', 'junior', 'lead', 'manager', 'engineer', 'developer',
]);

const KNOWN_SKILLS = [
  'python', 'javascript', 'typescript', 'react', 'next.js', 'node.js', 'java',
  'golang', 'go', 'rust', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'linux',
  'machine learning', 'data science', 'llm', 'ai', 'nlp', 'graphql', 'rest',
  'product', 'design', 'figma', 'analytics', 'seo', 'marketing', 'sales',
];

function tokenize(value: string): string[] {
  return (value.toLowerCase().match(/[a-z][a-z0-9.+#-]{2,}/g) || [])
    .filter((token) => !STOP_WORDS.has(token));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractResumeSkills(resumeText: string): string[] {
  const lower = resumeText.toLowerCase();
  return KNOWN_SKILLS.filter((skill) => lower.includes(skill));
}

function freshnessScore(daysOld: number): number {
  if (daysOld <= 1) return 100;
  if (daysOld <= 3) return 90;
  if (daysOld <= 7) return 75;
  if (daysOld <= 14) return 55;
  return 30;
}

function sourceQualityScore(source: string): number {
  if (source.includes('himalayas')) return 92;
  if (source.includes('arbeitnow')) return 88;
  if (source.includes('ats-')) return 90;
  if (source.includes('rss')) return 82;
  return 75;
}

function remoteBonus(workType: string): number {
  return workType === 'remote' ? 8 : workType === 'hybrid' ? 3 : 0;
}

function inferMatchedCareerPath(job: DiscoveredJob, careerPaths: string[]): string | undefined {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return careerPaths.find((path) => {
    const tokens = tokenize(path);
    return tokens.length > 0 && tokens.some((token) => haystack.includes(token));
  });
}

function deterministicMatchScore(job: DiscoveredJob, careerPaths: string[], resumeText: string): number {
  const titleTokens = tokenize(job.title);
  const haystack = `${job.title} ${job.description} ${job.requirements.join(' ')}`.toLowerCase();
  const careerTokens = unique(careerPaths.flatMap(tokenize));
  const resumeSkills = extractResumeSkills(resumeText);
  const resumeTokens = unique([...resumeSkills, ...tokenize(resumeText).slice(0, 80)]);

  let score = 28;

  const titleCareerHits = careerTokens.filter((token) => titleTokens.includes(token)).length;
  const bodyCareerHits = careerTokens.filter((token) => haystack.includes(token)).length;
  const skillHits = resumeTokens.filter((token) => haystack.includes(token)).length;

  score += Math.min(34, titleCareerHits * 12 + bodyCareerHits * 5);
  score += Math.min(28, skillHits * 4);
  score += remoteBonus(job.workType);

  if (job.applyUrl) score += 4;
  if (job.daysOld <= 7) score += 4;
  if (job.description.length >= 300) score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildMatchReasons(job: DiscoveredJob, careerPaths: string[], resumeText: string): string[] {
  const haystack = `${job.title} ${job.description} ${job.requirements.join(' ')}`.toLowerCase();
  const matchedPath = inferMatchedCareerPath(job, careerPaths);
  const resumeSkills = extractResumeSkills(resumeText).filter((skill) => haystack.includes(skill));
  const reasons: string[] = [];

  if (matchedPath) reasons.push(`Matches your ${matchedPath} career path.`);
  if (resumeSkills.length > 0) reasons.push(`Uses resume-aligned skills: ${resumeSkills.slice(0, 4).join(', ')}.`);
  if (job.workType === 'remote') reasons.push('Remote-friendly listing.');
  if (job.daysOld <= 7) reasons.push('Fresh listing from the last week.');
  if (job.applyUrl) reasons.push('Includes a direct application link.');

  return reasons.length > 0 ? reasons.slice(0, 5) : ['Relevant keywords overlap with your profile.'];
}

function buildSkillGaps(job: DiscoveredJob, resumeText: string): string[] {
  const lowerResume = resumeText.toLowerCase();
  return job.requirements
    .filter((requirement) => requirement.length >= 3)
    .filter((requirement) => !lowerResume.includes(requirement.toLowerCase()))
    .slice(0, 4);
}

function buildSummary(job: DiscoveredJob, matchScore: number): string {
  const firstSentence = job.description.split(/[.!?]\s+/)[0]?.trim();
  const context = firstSentence && firstSentence.length > 20
    ? firstSentence
    : `${job.company} is hiring for ${job.title}.`;
  return `${context}. Deterministic match score: ${matchScore}/100 based on your resume, career paths, recency, and work preferences.`;
}

function compositeScore(matchScore: number, daysOld: number, source: string, workType: string): number {
  return Math.round(
    matchScore * 0.62 +
    freshnessScore(daysOld) * 0.18 +
    sourceQualityScore(source) * 0.14 +
    remoteBonus(workType)
  );
}

function buildDailyJob(raw: DiscoveredJob, matchScore: number, careerPaths: string[], resumeText: string): DailyJob {
  const matchedCareerPath = raw.matchedCareerPath || inferMatchedCareerPath(raw, careerPaths);

  return {
    id: raw.fingerprint,
    fingerprint: raw.fingerprint,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    workType: raw.workType,
    salary: raw.salary,
    description: raw.description,
    requirements: raw.requirements,
    source: raw.source,
    applyUrl: raw.applyUrl,
    postedAt: raw.postedAt,
    daysOld: raw.daysOld,
    matchScore,
    finalScore: compositeScore(matchScore, raw.daysOld ?? 0, raw.source, raw.workType),
    matchReasons: buildMatchReasons(raw, careerPaths, resumeText),
    skillGaps: buildSkillGaps(raw, resumeText),
    aiSummary: buildSummary(raw, matchScore),
    isHotJob: raw.daysOld <= 3,
    hotSignals: raw.daysOld <= 3 ? ['Fresh listing'] : [],
    companyStage: 'Unknown',
    matchedCareerPath,
  };
}

export interface MatchOptions {
  careerPaths: string[];
  resumeText: string;
  jobType?: string;
  seenFingerprints?: string[];
  limit?: number;
  minMatchScore?: number;
  matchingPreferences?: {
    remoteOnly?: boolean;
    salaryFloor?: number | null;
    locations?: string[];
  };
}

export interface MatchResult {
  jobs: DailyJob[];
  usedFallback: boolean;
  enrichedCount: number;
  scoredCount: number;
  qualityFilteredCount: number;
  dedupedCount: number;
}

export async function matchAndRankJobs(
  discoveredJobs: DiscoveredJob[],
  opts: MatchOptions,
  _callAI?: CallAIFn
): Promise<MatchResult> {
  const {
    careerPaths,
    resumeText,
    seenFingerprints = [],
    limit = 10,
    minMatchScore = 25,
    matchingPreferences,
  } = opts;

  const seenSet = new Set(seenFingerprints);
  const normalizedPreferences = normalizeUserPreferences(matchingPreferences || {});
  const unseenJobs = discoveredJobs.filter((job) => !seenSet.has(job.fingerprint));

  const scored = unseenJobs
    .map((job) => {
      const matchScore = deterministicMatchScore(job, careerPaths, resumeText);
      return {
        job,
        matchScore,
        dailyJob: buildDailyJob(job, matchScore, careerPaths, resumeText),
      };
    })
    .filter(({ job, matchScore }) => {
      if (matchScore < minMatchScore) return false;
      return jobMatchesUserPreferences(
        {
          isRemote: job.workType === 'remote' || job.location.toLowerCase().includes('remote'),
          salary: job.salary,
          location: job.location,
        },
        normalizedPreferences
      ).passed;
    })
    .sort((a, b) => b.dailyJob.finalScore - a.dailyJob.finalScore);

  const final = scored.slice(0, limit).map((item) => item.dailyJob);

  return {
    jobs: final,
    usedFallback: false,
    enrichedCount: final.length,
    scoredCount: scored.length,
    qualityFilteredCount: Math.max(0, unseenJobs.length - scored.length),
    dedupedCount: Math.max(0, discoveredJobs.length - unseenJobs.length),
  };
}
