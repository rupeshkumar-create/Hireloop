import { SerperJob, SearchRemoteJobsStats, searchRemoteJobs, jobFingerprint } from './serperService';
import {
  validateAssetForgeEmail,
  validateGeneratedEmail,
  validateJobScoringOutput,
  validateJobValidationBatchOutput,
  validateJobsBeforeAI,
  validateQueryGenerationOutput,
  validateStructuredProfile,
  validateTailoredResumeOutput,
  type GuardrailJobInput,
  type GuardrailUserContext,
  type JobValidationBatchResult,
} from './validator';
import { registerGuardrailTask, runWithGuardrails } from './systemEngine';
import {
  fetchRecruiterFromApollo,
  type RecruiterContact,
} from './apolloService';
import {
  rewriteScoutQueriesWithLearning,
  type ScoutLearningContext,
} from './learningSignals';
import {
  buildRejectionCodeCounts,
  mapRejectedJobsWithCodes,
  splitJobsBySeenFingerprints,
} from './dailyJobsEngine';
import type { DailyJobsDebugResult, GhostModeJob } from '../types/adminGhostMode';

interface RankedJob {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  url: string;
  requirements: string[];
  matchScore: number;
  datePosted: string;
  finalScore?: number;
  freshnessScore?: number;
  atsQualityScore?: number;
  companyQualityScore?: number;
  companyQualityReason?: string;
  isYC?: boolean;
  isFundedStartup?: boolean;
  salaryPrediction?: string;
  salaryConfidence?: string;
  salarySource?: string;
  hotJobScore?: number;
  hotSignals?: string[];
  isHotJob?: boolean;
  requiresRelocation?: boolean;
}

export interface GenerateDailyJobsResult {
  jobs: GhostModeJob[];
  requestedLimit: number;
  usedBackfill: boolean;
  totalValidatedJobs: number;
  unseenCount: number;
  seenCount: number;
}

interface JobScoringTaskInput {
  jobsToScore: SerperJob[];
  careerPaths: string[];
  resumeText: string;
}

interface EmailGenerationInput {
  jobTitle: string;
  company: string;
  antiSlopEnabled: boolean;
  writingStyleContext: string;
  resumeText?: string;
  resumeSummary?: string;
  recruiter?: RecruiterContact;
}

interface ScoutContext {
  careerPaths: string[];
  resumeText: string;
  resumeSummary?: string;
  jobType?: string;
  structuredProfile?: {
    skills: string[];
    techStack: string[];
    seniority: string;
    roles: string[];
    industries: string[];
  };
  preferences?: {
    remoteOnly: boolean;
    salaryFloor: number | null;
    locations: string[];
  };
  learningContext?: string;
  learningSignals?: ScoutLearningContext;
  location?: string;
}

function parseJsonArray(content: string): any[] {
  const trimmed = content.trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  }
}

function extractSkills(resumeText: string): string[] {
  const skillCandidates = [
    // Languages
    'python', 'java', 'golang', 'go', 'ruby', 'rust', 'c++', 'c#', 'c', 'php', 'swift', 'kotlin', 'objective-c', 'scala', 'dart', 'typescript', 'javascript', 'sql', 'html', 'css', 'bash', 'shell', 'perl', 'haskell', 'lua', 'clojure', 'elixir', 'solidity',
    // Frontend
    'react', 'angular', 'vue', 'svelte', 'next.js', 'nuxt', 'gatsby', 'remix', 'ember', 'bootstrap', 'tailwind', 'sass', 'less', 'jquery', 'redux', 'mobx', 'zustand', 'webpack', 'vite', 'rollup', 'babel',
    // Backend & Frameworks
    'node.js', 'express', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'spring boot', 'laravel', 'symfony', 'asp.net', 'rails', 'phoenix', 'fiber', 'actix', 'gin', 'echo', 'fastify',
    // Databases
    'postgresql', 'mysql', 'mongodb', 'sqlite', 'mariadb', 'oracle', 'redis', 'memcached', 'cassandra', 'elasticsearch', 'couchbase', 'dynamodb', 'neo4j', 'firestore', 'supabase', 'firebase', 'clickhouse', 'snowflake', 'bigquery', 'redshift', 'cockroachdb',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'pulumi', 'jenkins', 'circleci', 'github actions', 'gitlab ci', 'datadog', 'new relic', 'grafana', 'prometheus', 'splunk', 'kafka',
    // Other
    'graphql', 'grpc', 'rest', 'rabbitmq', 'activemq', 'celery', 'airflow', 'spark', 'hadoop', 'flink', 'dbt', 'tableau', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras', 'linux', 'ubuntu', 'agile', 'scrum', 'jira', 'figma'
  ];

  const lowerResume = resumeText.toLowerCase();
  const matched = skillCandidates.filter((skill) => {
    if (skill === 'c++') return lowerResume.includes('c++');
    if (skill === 'c#') return lowerResume.includes('c#');
    
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
    return regex.test(lowerResume);
  });
  
  return matched.slice(0, 8);
}

function normalizeQueries(rawValue: unknown): string[] {
  if (Array.isArray(rawValue)) {
    return rawValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }

  if (rawValue && typeof rawValue === 'object') {
    for (const value of Object.values(rawValue)) {
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      }
    }
  }

  return [];
}

export function normalizeGeneratedQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const query of queries) {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
    if (normalized.length === 10) break;
  }

  return normalized;
}

function buildDeterministicQueries(careerPaths: string[], resumeText: string, minSalary: number | null, jobType: string, location: string): string[] {
  const skills = extractSkills(resumeText);
  const primarySkill = skills[0] || 'typescript';
  const secondarySkill = skills[1] || 'react';
  const salaryClause = minSalary ? ` salary ${minSalary}` : '';
  const atsClause = '(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workable.com OR site:jobs.workday.com)';

  return careerPaths.slice(0, 5).map((path, idx) => {
    let locModifier = 'remote';
    if (jobType === 'onsite' || (jobType === 'both' && idx % 2 !== 0 && location)) {
      locModifier = `"${location}"`;
    }
    return `${locModifier} "${path}" "${primarySkill}" "${secondarySkill}" ${atsClause}${salaryClause}`.trim();
  });
}

function buildExpansionQueries(careerPaths: string[], resumeText: string, jobType: string, location: string): string[] {
  const titleSeeds = careerPaths.length > 0 ? careerPaths : ['software engineer', 'backend engineer'];
  const synonyms = ['software engineer', 'developer', 'backend engineer', 'full stack engineer', 'platform engineer'];
  const skills = extractSkills(resumeText);
  const primarySkill = skills[0] || 'typescript';
  const secondarySkill = skills[1] || 'aws';
  const domains = [
    'site:greenhouse.io',
    'site:lever.co',
    'site:ashbyhq.com',
    'site:workable.com',
    'site:jobs.workday.com',
  ];

  const generated: string[] = [];
  let idx = 0;
  for (const title of [...titleSeeds, ...synonyms]) {
    for (const domain of domains) {
      let locModifier = 'remote';
      if (jobType === 'onsite' || (jobType === 'both' && idx % 2 !== 0 && location)) {
        locModifier = `"${location}"`;
      }
      generated.push(`${locModifier} "${title}" "${primarySkill}" "${secondarySkill}" ${domain}`);
      idx++;
    }
  }

  return Array.from(new Set(generated));
}

function buildBoardQueries(careerPaths: string[], resumeText: string, jobType: string, location: string): string[] {
  const titleSeeds = careerPaths.length > 0 ? careerPaths : ['software engineer', 'backend engineer'];
  const skills = extractSkills(resumeText);
  const primarySkill = skills[0] || 'typescript';
  const secondarySkill = skills[1] || 'react';
  const domains = [
    'site:linkedin.com/jobs',
    'site:indeed.com/viewjob',
    'site:glassdoor.com/job-listing',
    'site:ziprecruiter.com/jobs',
  ];

  const generated: string[] = [];
  let idx = 0;
  for (const title of titleSeeds.slice(0, 6)) {
    for (const domain of domains) {
      let locModifier = 'remote';
      if (jobType === 'onsite' || (jobType === 'both' && idx % 2 !== 0 && location)) {
        locModifier = `"${location}"`;
      }
      generated.push(`${locModifier} "${title}" "${primarySkill}" "${secondarySkill}" ${domain}`);
      idx++;
    }
  }

  return Array.from(new Set(generated));
}

function mergeDedupJobs(existingJobs: SerperJob[], incomingJobs: SerperJob[]): SerperJob[] {
  const seen = new Set(existingJobs.map((job) => jobFingerprint(job.title, job.company)));
  const merged = [...existingJobs];

  for (const job of incomingJobs) {
    const fingerprint = jobFingerprint(job.title, job.company);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    merged.push(job);
  }

  return merged;
}

export function dedupeJobsByFingerprint(jobs: SerperJob[]): SerperJob[] {
  return mergeDedupJobs([], jobs);
}

function getFreshnessScore(daysOld: number): number {
  return daysOld === 0 ? 100 : Math.max(20, 80 - daysOld * 10);
}

function getAtsQualityScore(link: string): number {
  const normalizedLink = link.toLowerCase();
  if (
    normalizedLink.includes('greenhouse.io') ||
    normalizedLink.includes('lever.co') ||
    normalizedLink.includes('ashbyhq.com')
  ) {
    return 100;
  }
  if (normalizedLink.includes('workable.com') || normalizedLink.includes('workday.com')) {
    return 85;
  }
  return 75;
}

function toIsoDate(postedAt: string, daysOld: number | undefined): string {
  if (!postedAt) {
    return new Date().toISOString();
  }

  const parsedDate = new Date(postedAt);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString();
  }

  const safeDaysOld = typeof daysOld === 'number' ? daysOld : 0;
  return new Date(Date.now() - safeDaysOld * 24 * 60 * 60 * 1000).toISOString();
}

function toGuardrailJob(job: SerperJob): GuardrailJobInput {
  const normalizedLocation = job.location.toLowerCase();
  const descriptionText = job.description.toLowerCase();
  const isRemote =
    normalizedLocation.includes('remote') ||
    descriptionText.includes('remote') ||
    descriptionText.includes('work from home');

  return {
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    url: job.applyLink,
    postedAt: toIsoDate(job.postedAt, job.daysOld),
    isRemote,
    salary: job.salary,
  };
}

function normalizeRankedJob(rawJob: any, sourceJob: SerperJob): RankedJob {
  const matchScore = typeof rawJob.matchScore === 'number' ? rawJob.matchScore : 0;
  const companyQualityScore = typeof rawJob.companyQualityScore === 'number' ? rawJob.companyQualityScore : 60;
  const hotJobScore = typeof rawJob.hotJobScore === 'number' ? rawJob.hotJobScore : 40;
  const freshnessScore = getFreshnessScore(sourceJob.daysOld || 0);
  const atsQualityScore = getAtsQualityScore(sourceJob.applyLink);
  const finalScore =
    matchScore * 0.45 +
    freshnessScore * 0.15 +
    atsQualityScore * 0.15 +
    companyQualityScore * 0.15 +
    hotJobScore * 0.10;

  return {
    title: sourceJob.title,
    company: sourceJob.company,
    location: sourceJob.location,
    salary: sourceJob.salary || rawJob.salaryPrediction || 'Competitive',
    description: sourceJob.description,
    url: sourceJob.applyLink,
    requirements: Array.isArray(rawJob.requirements) ? rawJob.requirements.filter((value: unknown): value is string => typeof value === 'string') : [],
    matchScore,
    datePosted: toIsoDate(sourceJob.postedAt, sourceJob.daysOld),
    finalScore: Math.round(finalScore),
    freshnessScore,
    atsQualityScore,
    companyQualityScore,
    companyQualityReason: typeof rawJob.companyQualityReason === 'string' ? rawJob.companyQualityReason : 'No company-quality rationale returned.',
    isYC: rawJob.isYC === true,
    isFundedStartup: rawJob.isFundedStartup === true,
    salaryPrediction: typeof rawJob.salaryPrediction === 'string' ? rawJob.salaryPrediction : '',
    salaryConfidence: typeof rawJob.salaryConfidence === 'string' ? rawJob.salaryConfidence : '',
    salarySource: typeof rawJob.salarySource === 'string' ? rawJob.salarySource : '',
    hotJobScore,
    hotSignals: Array.isArray(rawJob.hotSignals) ? rawJob.hotSignals.filter((value: unknown): value is string => typeof value === 'string') : [],
    isHotJob: hotJobScore >= 70,
    requiresRelocation: sourceJob.requiresRelocation === true,
  };
}

function toGhostModeJob(job: SerperJob): GhostModeJob {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    salary: job.salary || 'Competitive',
    description: job.description,
    url: job.applyLink,
    requirements: [],
    datePosted: toIsoDate(job.postedAt, job.daysOld),
    requiresRelocation: job.requiresRelocation === true,
  };
}

function buildFallbackRankedJobs(jobs: SerperJob[], careerPaths: string[], resumeText: string, limit: number): RankedJob[] {
  const candidateSkills = extractSkills(resumeText).map(s => s.toLowerCase());
  const pathKeywords = careerPaths.flatMap(p => p.toLowerCase().split(' ')).filter(kw => kw.length > 3);

  return jobs
    .map((job) => {
      const freshnessScore = getFreshnessScore(job.daysOld || 0);
      const atsQualityScore = getAtsQualityScore(job.applyLink);
      
      const jobDescLower = job.description.toLowerCase();
      const jobTitleLower = job.title.toLowerCase();

      let relevanceScore = 40; // baseline
      
      // Title match
      const titleMatch = pathKeywords.some(kw => jobTitleLower.includes(kw));
      if (titleMatch) relevanceScore += 30;

      // Skill match
      let matchedSkills = 0;
      candidateSkills.forEach(skill => {
        if (jobDescLower.includes(skill)) matchedSkills++;
      });
      relevanceScore += Math.min(30, matchedSkills * 10);

      // Penalty if no title and no skills
      if (!titleMatch && matchedSkills === 0) relevanceScore = 10;

      const finalScore = (relevanceScore * 0.45) + (freshnessScore * 0.15) + (atsQualityScore * 0.15) + (60 * 0.25);

      return {
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary || 'Competitive',
        description: job.description,
        url: job.applyLink,
        requirements: [],
        matchScore: Math.round(relevanceScore),
        datePosted: toIsoDate(job.postedAt, job.daysOld),
        finalScore: Math.round(finalScore),
        freshnessScore,
        atsQualityScore,
        companyQualityScore: 60,
        companyQualityReason: 'Fallback deterministic ranking based on basic keyword matching.',
        isYC: false,
        isFundedStartup: false,
        salaryPrediction: '',
        salaryConfidence: '',
        salarySource: '',
        hotJobScore: freshnessScore >= 90 ? 80 : 40,
        hotSignals: freshnessScore >= 90 ? ['Fresh posting'] : [],
        isHotJob: freshnessScore >= 90,
        requiresRelocation: job.requiresRelocation === true,
      };
    })
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, limit);
}

function createEmptySearchStats(): SearchRemoteJobsStats {
  return {
    queriesRun: 0,
    jobsSeen: 0,
    removedByDuplicate: 0,
    removedByRemoteFilter: 0,
    removedByFreshnessFilter: 0,
    removedByMissingLink: 0,
    removedByLinkValidation: 0,
    removedByShapeValidation: 0,
  };
}

function mergeSearchStats(base: SearchRemoteJobsStats, next: SearchRemoteJobsStats): SearchRemoteJobsStats {
  return {
    queriesRun: base.queriesRun + next.queriesRun,
    jobsSeen: base.jobsSeen + next.jobsSeen,
    removedByDuplicate: base.removedByDuplicate + next.removedByDuplicate,
    removedByRemoteFilter: base.removedByRemoteFilter + next.removedByRemoteFilter,
    removedByFreshnessFilter: base.removedByFreshnessFilter + next.removedByFreshnessFilter,
    removedByMissingLink: base.removedByMissingLink + next.removedByMissingLink,
    removedByLinkValidation: base.removedByLinkValidation + next.removedByLinkValidation,
    removedByShapeValidation: base.removedByShapeValidation + next.removedByShapeValidation,
  };
}

function buildFallbackScoutQueries(
  context: ScoutContext,
  minSalary: number | null,
  jobType: string,
  location: string
): string[] {
  return normalizeGeneratedQueries([
    ...buildDeterministicQueries(
      context.careerPaths,
      context.resumeText,
      minSalary,
      jobType,
      location
    ),
    ...buildExpansionQueries(
      context.careerPaths,
      context.resumeText,
      jobType,
      location
    ),
    ...buildBoardQueries(
      context.careerPaths,
      context.resumeText,
      jobType,
      location
    ),
  ]);
}

async function buildQueries(context: ScoutContext): Promise<string[]> {
  const jobType = context.jobType || (context.preferences?.remoteOnly ? 'remote' : 'both');
  const minSalary = context.preferences?.salaryFloor ?? null;
  const location = context.preferences?.locations?.[0] || context.location || '';
  const isRemote = jobType === 'remote' || jobType === 'both';
  const isOnsite = jobType === 'onsite' || jobType === 'both';
  const locationClause =
    isOnsite && location
      ? `If generating an on-site or hybrid query, MUST include the location: "${location}"`
      : '';
  const remoteClause = isRemote
    ? 'MUST include "remote" if generating a remote query'
    : 'MUST NOT include "remote"';

  const prompt = `You are Scout, the job search query generator.

Your job is NOT to generate broad queries.
Your job is to find REAL, ACTIVE job postings.

Hidden User Preferences learned from past behavior: ${context.learningContext || ''}

# STRICT RULES
- Job Type Preference: ${jobType}
- ${remoteClause}
- ${locationClause}
- MUST include:
  1 job title
  2 core skills
- MUST include ATS domains ONLY:
(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workable.com OR site:jobs.workday.com)
- MUST avoid:
  linkedin.com
  indeed.com
  naukri.com

# GOAL
Generate exactly 10 HIGH-PRECISION queries:
- narrow
- specific
- high signal

Resume Summary:
${context.resumeSummary || ''}

Structured Profile:
${JSON.stringify(context.structuredProfile || {}, null, 2)}

Resume:
${context.resumeText.substring(0, 1200)}

Career Paths:
${context.careerPaths.join(', ')}

Return ONLY a JSON array of exactly 10 query strings.`;

  try {
    const queryResponse = await callOpenAI(
      [{ role: 'user', content: prompt }],
      undefined,
      'openai/gpt-4o-mini'
    );
    if (queryResponse.choices?.[0]?.message?.content) {
      const aiQueries = normalizeGeneratedQueries(
        normalizeQueries(parseJsonArray(queryResponse.choices[0].message.content))
      );
      if (aiQueries.length === 10) {
        return aiQueries;
      }
    }
  } catch (error) {
    console.error('Error generating scout queries:', error);
  }

  return buildFallbackScoutQueries(context, minSalary, jobType, location);
}

async function harvestJobs(
  queries: string[],
  options: {
    jobType: string;
    userLocation: string;
    minSalary: number | null;
  }
) {
  return searchRemoteJobs(queries, {
    allowedDomains: ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com', 'workday.com'],
    allowCompanyCareerPages: false,
    maxDaysOld: 7,
    maxQueries: 10,
    maxJobs: 40,
    jobType: options.jobType,
    userLocation: options.userLocation,
  });
}

async function scoreAndRankJobs(
  jobs: SerperJob[],
  careerPaths: string[],
  resumeText: string,
  limit: number
): Promise<RankedJob[]> {
  const jobsToScore = jobs.slice(0, Math.max(limit, 20));
  if (jobsToScore.length === 0) {
    return [];
  }

  const jobList = jobsToScore
    .map(
      (job, index) =>
        `[${index}] Title: ${job.title} | Company: ${job.company} | Location: ${job.location} | Salary: ${job.salary || 'Not listed'} | Posted: ${job.postedAt || 'Unknown'}\nDescription: ${job.description.substring(0, 3000)}`
    )
    .join('\n\n');

  const scoringPrompt = `You are an expert technical recruiter.

Below are REAL remote job listings retrieved live from search.

For each job, read the FULL description and evaluate it against the candidate's resume and goals.

# STRICT DISQUALIFICATION RULES (PENALIZE MATCH SCORE HEAVILY):
- Location mismatch: If the job requires "US Only", specific states, or specific timezones, and the candidate does not match or is unknown, the score must be low.
- Seniority mismatch: If the resume is Junior/Mid but the job requires Staff/Principal (or vice versa), the score must be low.
- Clearance/Citizenship: If the job requires security clearance or US Citizenship and the resume does not show it, the score must be low.

For each job:
1. Score fit against the candidate resume with matchScore (0-100) based on skills, seniority, and location constraints.
2. Extract 3-5 key requirements.
3. Estimate salary only if salary is missing.
4. Score company quality.
5. Flag YC/funded startup likelihood.
6. Detect urgent hiring / hot job signals.

Candidate Career Goals: ${careerPaths.join(', ')}
Candidate Resume:
${resumeText.substring(0, 3000)}

Jobs:
${jobList}

Return ONLY a JSON array with one object per job in the same order:
[
  {
    "matchScore": 0,
    "requirements": [],
    "salaryPrediction": "",
    "salaryConfidence": "",
    "salarySource": "estimated",
    "companyQualityScore": 0,
    "companyQualityReason": "",
    "isYC": false,
    "isFundedStartup": false,
    "hotJobScore": 0,
    "hotSignals": []
  }
]`;

  try {
    const parsedScores = await runWithGuardrails(
      'job_scoring',
      async (input: JobScoringTaskInput) => {
        const response = await callOpenAI(
          [{ role: 'user', content: scoringPrompt }],
          undefined,
          'google/gemini-3.1-pro'
        );
        const content = response.choices?.[0]?.message?.content || '[]';
        return parseJsonArray(content);
      },
      { jobsToScore, careerPaths, resumeText }
    );

    return jobsToScore
      .map((job, index) => normalizeRankedJob(parsedScores[index] || {}, job))
      .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
      .slice(0, limit);
  } catch (error: any) {
    console.error('Error scoring real jobs:', error);
    return buildFallbackRankedJobs(jobsToScore, careerPaths, resumeText, limit);
  }
}

export async function callOpenAI(messages: any[], response_format?: any, model: string = 'openai/gpt-4o-mini') {
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, response_format, model })
  });
  if (!response.ok) {
    const error = await response.json();
    if (error.status === 402 || error.status === 429 || (error.error && typeof error.error === 'string' && (error.error.toLowerCase().includes('credit') || error.error.toLowerCase().includes('balance') || error.error.toLowerCase().includes('quota')))) {
      throw new Error('AI_QUOTA_EXCEEDED');
    }
    throw new Error(error.error || 'Failed to call OpenAI proxy');
  }
  return response.json();
}

const ANTI_SLOP_PROMPT = `
=== AI HUMANIZER ENGINE - ANTI-SLOP FILTER (STRICT) ===

You are writing on behalf of a real human professional. Every word must sound like it came from a person, not a language model. Apply ALL of the following rules without exception.

--- BANNED WORDS & PHRASES (never use these) ---
Single words: delve, robust, tapestry, embark, synergize, seamless, testament, elevate, leverage, utilize, spearhead, cultivate, foster, facilitate, navigate, pivotal, transformative, groundbreaking, cutting-edge, game-changer, holistic, comprehensive, dynamic, innovative, proactive, actionable, scalable, impactful, bespoke, curated, disruptive, revolutionize, reimagine, empower, align, streamline, paramount, crucial, vital, invaluable, multifaceted, nuanced, intricate, meticulous, unwavering, dedicated, passionate, enthusiastic, keen, eager, excited.

Banned phrases: "in today's fast-paced digital landscape", "as an AI language model", "I cannot help with that", "the world of", "the realm of", "in the ever-evolving", "it's worth noting that", "it's important to note that", "I'd be happy to", "certainly!", "absolutely!", "of course!", "I hope this finds you well", "I am writing to express my keen interest", "I am excited to apply", "I would be thrilled", "I am passionate about", "my experience has equipped me with", "I would love the opportunity to", "please do not hesitate to contact me", "I look forward to hearing from you at your earliest convenience", "thank you for considering my application", "I believe I would be a perfect fit", "results-driven professional", "team player", "self-starter", "detail-oriented", "go-getter", "I wear many hats", "synergy between", "move the needle", "circle back", "deep dive", "touch base", "low-hanging fruit", "paradigm shift", "value-add".

--- SENTENCE & STRUCTURE RULES ---
- Write SHORT sentences. 10–15 words max per sentence, ideally.
- Never start two consecutive sentences with "I".
- Vary sentence length - mix short punchy lines with medium ones. Never write three long sentences in a row.
- Use active voice throughout. "I built X" not "X was built by me."
- Cut every word that adds no meaning. "In order to" → "to". "Due to the fact that" → "because".
- No filler intros or outros. Start the output immediately. No "Here is your email:" or "I hope this helps!"
- No bullet-point padding. Each bullet must carry real, specific information. No vague "collaborated with cross-functional teams."

--- TONE & VOICE RULES ---
- Sound like a smart, busy professional writing a Slack message - not a cover letter template.
- Be direct and confident. Skip hedging language ("I think", "perhaps", "it seems like", "might").
- Be specific. Replace vague claims with concrete facts: instead of "strong communication skills," write "I've led async standups for a 12-person distributed team."
- Use contractions naturally: "I've", "I'm", "we're", "it's". Avoid stiff, formal constructions.
- Personality is allowed - dry wit, confidence, brevity. But never try-hard or cringey.
- If the job or resume has technical details, use them. Don't genericize.

--- FORMATTING RULES ---
- No corporate buzzword soup in bullet points.
- Resume bullets must lead with a strong verb in past tense: Built, Shipped, Reduced, Grew, Debugged, Automated, Designed, Led, Cut, Improved.
- Quantify where the original resume has data. Never fabricate numbers.
- Cold emails: 150–200 words max. Three short paragraphs: hook → value → CTA.
- CTA must be direct and low-friction: "Free for a 20-min call Wednesday?" not "I look forward to exploring potential synergies."

--- WHAT HUMAN WRITING LOOKS LIKE ---
Bad (AI slop): "I am writing to express my keen interest in the Senior Engineer role at Acme Corp. I am a passionate, results-driven professional with a robust background in delivering seamless, scalable solutions..."
Good (human): "Saw the Senior Engineer opening at Acme. I've spent the last 3 years doing exactly this - building the data pipeline at [Company] that processes 2M events/day. Wanted to reach out directly."

=== END OF ANTI-SLOP FILTER ===
`;

registerGuardrailTask<
  { expectedCount: number },
  JobValidationBatchResult<GuardrailJobInput>
>('validation', {
  validateOutput: (output, input) =>
    validateJobValidationBatchOutput(output, { expectedCount: input.expectedCount }),
});

registerGuardrailTask<ScoutContext, string[]>('query_generation', {
  validateOutput: (output) =>
    validateQueryGenerationOutput(output, { expectedCount: 10 }),
});

registerGuardrailTask<JobScoringTaskInput, any[]>('job_scoring', {
  validateOutput: (output, input) =>
    validateJobScoringOutput(output, { jobCount: input.jobsToScore.length }),
});

registerGuardrailTask<
  EmailGenerationInput,
  string
>('email_generation', {
  validateOutput: (output, input) =>
    validateAssetForgeEmail(output, {
      company: input.company,
      jobTitle: input.jobTitle,
    }),
  selfFix: async (output, input, validation) =>
    improveTextWithAI(
      output,
      `Fix this email. Reason: ${validation.reason}. Keep it under 120 words. Include ${input.company}. Include ${input.jobTitle}. Remove generic language.`,
      input.writingStyleContext
    ),
});

registerGuardrailTask<
  {
    jobTitle: string;
    jobDescription: string;
    resumeText: string;
    antiSlopEnabled: boolean;
    writingStyleContext: string;
  },
  string
>('resume_tailoring', {
  validateOutput: (output, input) =>
    validateTailoredResumeOutput(output, {
      jobDescription: input.jobDescription,
    }),
  selfFix: async (output, input, validation) =>
    improveTextWithAI(
      output,
      `Fix this tailored resume. Reason: ${validation.reason}. Keep all claims grounded in the original resume and align more clearly with the job description keywords.`,
      input.writingStyleContext
    ),
});

// ---------------------------------------------------------------------------
// Agent 1: Daily Job Generation
// Real jobs sourced from Serper (Google Jobs), validated and then ranked.
// ---------------------------------------------------------------------------
export async function updateLearningProfile(
  actionType: 'save_job' | 'edit_email' | 'edit_resume',
  actionData: string,
  currentContext: string = ''
): Promise<string> {
  const prompt = `You are a hidden AI background processor analyzing user behavior to improve future generations.
Current learned context: "${currentContext}"
New user action: ${actionType}
Action details: ${actionData}

Update the learned context. Keep it under 50 words. Be highly concise. Focus only on what this tells us about their job preferences (if save_job) or writing style preferences (if edit_email or edit_resume).
Respond ONLY with the updated context string.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }]);
    return response.choices?.[0]?.message?.content?.trim() || currentContext;
  } catch (e) {
    return currentContext;
  }
}

export function toGenerateDailyJobsResult(
  debug: DailyJobsDebugResult,
  requestedLimit: number
): GenerateDailyJobsResult {
  return {
    jobs: debug.finalJobs,
    requestedLimit,
    usedBackfill: debug.usedBackfill,
    totalValidatedJobs: debug.validatedCount,
    unseenCount: debug.unseenCount,
    seenCount: debug.seenCount,
  };
}

export async function generateDailyJobsDebug(
  careerPaths: string[],
  jobType: string,
  minSalary: number | null,
  resumeText: string,
  limit: number = 1,
  seenFingerprints: string[] = [],
  learningContext: string = '',
  location: string = '',
  learningSignals?: ScoutLearningContext
): Promise<DailyJobsDebugResult> {
  const scoutContext: ScoutContext = {
    careerPaths,
    resumeText,
    jobType,
    preferences: {
      remoteOnly: jobType === 'remote',
      salaryFloor: minSalary,
      locations: location ? [location] : [],
    },
    learningContext,
    learningSignals,
    location,
  };

  const generatedQueries = await runWithGuardrails(
    'query_generation',
    buildQueries,
    scoutContext
  );
  const queries = normalizeGeneratedQueries(
    rewriteScoutQueriesWithLearning(generatedQueries, scoutContext.learningSignals)
  );
  console.log('Scout Queries:', queries);

  const { jobs: harvestedJobs, stats: harvestedStats } = await harvestJobs(queries, {
    jobType,
    userLocation: location,
    minSalary,
  });
  console.log('Harvester Raw Jobs:', harvestedJobs.length);

  const dedupedJobs = dedupeJobsByFingerprint(harvestedJobs);
  console.log('After Dedupe:', dedupedJobs.length);

  const guardrailJobs = dedupedJobs.map(toGuardrailJob);
  const guardrailUser: GuardrailUserContext = {
    preferences: {
      remoteOnly: jobType === 'remote',
      salaryFloor: minSalary,
      locations: location ? [location] : [],
    },
  };

  const jobValidation = await runWithGuardrails(
    'validation',
    async () => validateJobsBeforeAI(guardrailJobs, guardrailUser, 7),
    { expectedCount: guardrailJobs.length }
  );

  const acceptedFingerprints = new Set(
    jobValidation.accepted.map((job) => jobFingerprint(job.title, job.company))
  );

  const acceptedRawJobs = dedupedJobs.filter((job) =>
    acceptedFingerprints.has(jobFingerprint(job.title, job.company))
  );
  console.log('After Validation:', acceptedRawJobs.length);
  console.log('Rejected Before AI:', jobValidation.rejected.length);

  const acceptedJobs = acceptedRawJobs.map(toGhostModeJob);
  const rejectedJobs = mapRejectedJobsWithCodes(
    jobValidation.rejected.map(({ job, validation }) => ({
      job: toGhostModeJob({
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        applyLink: job.url,
        salary: job.salary || '',
        postedAt: job.postedAt,
      }),
      validation,
    }))
  );

  const { unseenJobs, seenJobs } = splitJobsBySeenFingerprints(
    acceptedRawJobs,
    seenFingerprints
  );
  console.log('After Seen Filter:', unseenJobs.length);

  const unseenRankedJobs = await scoreAndRankJobs(unseenJobs, careerPaths, resumeText, limit);
  let finalJobs = unseenRankedJobs.slice(0, limit);
  let usedBackfill = false;

  if (finalJobs.length < limit && limit > 1 && seenJobs.length > 0) {
    const backfillRankedJobs = await scoreAndRankJobs(
      seenJobs,
      careerPaths,
      resumeText,
      limit - finalJobs.length
    );
    finalJobs = [...finalJobs, ...backfillRankedJobs.slice(0, limit - finalJobs.length)];
    usedBackfill = backfillRankedJobs.length > 0;
  }

  console.log('Job retrieval stats:', harvestedStats);
  console.log('Validated jobs:', acceptedRawJobs.length);
  console.log('Unseen jobs:', unseenJobs.length);
  console.log('Seen jobs:', seenJobs.length);
  console.log('Used Pro backfill:', usedBackfill);
  console.log('After Scoring:', finalJobs.length);
  console.log('Top Final Scores:', finalJobs.map((job) => ({ title: job.title, finalScore: job.finalScore })));

  return {
    queries,
    harvestedCount: harvestedJobs.length,
    dedupedCount: dedupedJobs.length,
    validatedCount: acceptedRawJobs.length,
    unseenCount: unseenJobs.length,
    seenCount: seenJobs.length,
    usedBackfill,
    acceptedJobs,
    rejectedJobs,
    rejectionCodeCounts: buildRejectionCodeCounts(rejectedJobs),
    finalJobs,
  };
}

export async function generateDailyJobs(
  careerPaths: string[],
  jobType: string,
  minSalary: number | null,
  resumeText: string,
  limit: number = 1,
  seenFingerprints: string[] = [],
  learningContext: string = '',
  location: string = '',
  learningSignals?: ScoutLearningContext
): Promise<GenerateDailyJobsResult> {
  const debug = await generateDailyJobsDebug(
    careerPaths,
    jobType,
    minSalary,
    resumeText,
    limit,
    seenFingerprints,
    learningContext,
    location,
    learningSignals
  );

  return toGenerateDailyJobsResult(debug, limit);
}

// ---------------------------------------------------------------------------
// Agent 2: Career Path Suggestion
// Suggests 4 remote-friendly job titles based on the resume.
// ---------------------------------------------------------------------------
export async function suggestCareerPaths(resumeText: string, antiSlopEnabled: boolean = true): Promise<string[]> {
  const prompt = `You are an expert career counselor specializing in remote work opportunities.
Based on the following resume, suggest 4 highly relevant career paths (job titles) that:
1. This person is genuinely well-suited for, based on their actual skills and experience.
2. Are commonly available as fully remote positions (e.g. Software Engineer, Product Manager, UX Designer, Data Scientist, DevOps Engineer, Content Strategist, Technical Writer).

Keep titles concise (e.g. "Senior Frontend Engineer", "Remote Product Manager").

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume Text:
${resumeText.substring(0, 3000)}

Return a JSON array of exactly 4 strings. Respond ONLY with the JSON array.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], { type: 'json_object' });

    if (response.choices?.[0]?.message?.content) {
      const parsed = JSON.parse(response.choices[0].message.content);
      return Array.isArray(parsed) ? parsed : (parsed.careerPaths || parsed.paths || Object.values(parsed)[0] || []);
    }
    return [];
  } catch (error) {
    console.error('Error suggesting career paths:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Agent 3: Resume Analysis
// Analyzes resume against career paths and includes a remote-readiness score.
// ---------------------------------------------------------------------------
export interface ResumeAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  summary: string;
  remoteReadiness?: {
    score: number; // 0-100
    tips: string[];
  };
}

export interface JobPreferences {
  jobType: 'remote' | 'hybrid' | 'onsite' | 'both';
  minSalary: number | null;
  location?: string;
}

export interface ExtractedResumeProfile {
  skills: string[];
  techStack: string[];
  seniority: string;
  roles: string[];
  industries: string[];
}

export async function analyzeResume(resumeText: string, careerPaths: string[]): Promise<ResumeAnalysis | null> {
  const prompt = `You are an expert career coach and technical recruiter specializing in remote work.
Analyze the following resume in the context of the user's target remote career paths: ${careerPaths.join(', ')}.

Provide:
1. strengths - what stands out for these roles.
2. weaknesses - gaps or red flags.
3. improvements - specific, actionable steps to strengthen the resume for remote roles.
4. summary - overall effectiveness for remote job applications (2-3 sentences).
5. remoteReadiness - how prepared this candidate is for remote work specifically.
   Evaluate based on: async communication tools (Slack, Notion, Jira, Linear), self-management evidence, distributed team experience, timezone flexibility, results-driven bullet points.

Resume Text:
${resumeText.substring(0, 3000)}

Return a JSON object:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "improvements": ["..."],
  "summary": "...",
  "remoteReadiness": {
    "score": <number 0-100>,
    "tips": ["specific tip 1", "specific tip 2", "specific tip 3"]
  }
}

Respond ONLY with the JSON object.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], { type: 'json_object' });

    if (response.choices?.[0]?.message?.content) {
      return JSON.parse(response.choices[0].message.content);
    }
    return null;
  } catch (error) {
    console.error('Error analyzing resume:', error);
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Agent 4: Job Preferences Extraction
// Infers salary and location from resume.
// ---------------------------------------------------------------------------
export async function extractJobPreferences(resumeText: string): Promise<JobPreferences> {
  const prompt = `You are an expert technical recruiter. Based on the following resume, infer a realistic minimum expected salary (in USD) for this candidate and their current location (City, State/Country).
If no location is found, leave it blank.

Resume Text:
${resumeText.substring(0, 3000)}

Return a JSON object:
{
  "jobType": "both",
  "minSalary": <number>,
  "location": "<City, State/Country>"
}

Respond ONLY with the JSON object.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], { type: 'json_object' });

    if (response.choices?.[0]?.message?.content) {
      const parsed = JSON.parse(response.choices[0].message.content);
      return {
        jobType: 'both' as const,
        minSalary: typeof parsed.minSalary === 'number' ? parsed.minSalary : null,
        location: typeof parsed.location === 'string' ? parsed.location : ''
      };
    }
  } catch (error) {
    console.error('Error extracting job preferences:', error);
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
  }
  return { jobType: 'both' as const, minSalary: null, location: '' };
}

export async function extractResume(
  resumeText: string
): Promise<ExtractedResumeProfile | null> {
  const prompt = `Extract a structured candidate profile from this resume.

Return a JSON object:
{
  "skills": [],
  "techStack": [],
  "seniority": "",
  "roles": [],
  "industries": []
}

Rules:
- Use only information present in the resume.
- Do not invent experience.
- Deduplicate repeated concepts.
- Keep arrays concise.

Resume:
${resumeText.substring(0, 6000)}`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { type: 'json_object' },
      'openai/gpt-5.4-pro'
    );

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    const validation = validateStructuredProfile(parsed);
    if (!validation.passed) {
      throw new Error(validation.reason || 'Invalid structured profile');
    }

    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      seniority: typeof parsed.seniority === 'string' ? parsed.seniority : '',
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
    };
  } catch (error) {
    console.error('Error extracting structured resume:', error);
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return null;
  }
}

export async function summarizeResume(
  resumeText: string
): Promise<string> {
  const prompt = `Summarize this resume in 80 words or fewer.

Rules:
- Keep it factual.
- Mention seniority, strongest skills, and role direction.
- Do not invent information.

Resume:
${resumeText.substring(0, 6000)}`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      undefined,
      'google/gemini-3.1-pro'
    );
    return response.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Error summarizing resume:', error);
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return '';
  }
}

// ---------------------------------------------------------------------------
// Agent 5: Cold Email Generation
// Personalized cold email that highlights remote work availability.
// ---------------------------------------------------------------------------
export async function improveTextWithAI(originalText: string, instruction: string, context: string = ''): Promise<string> {
  const prompt = `You are an expert AI writing assistant.
Here is the user's current text:
"""
${originalText}
"""

User instruction: "${instruction}"
User style context: "${context}"

Rewrite the text according to the instruction. Return ONLY the new text without any conversational filler.`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      undefined,
      'anthropic/claude-opus-4.6'
    );
    return response.choices?.[0]?.message?.content?.trim() || originalText;
  } catch (error) {
    console.error('Failed to improve text:', error);
    return originalText;
  }
}

export interface OutreachJobContext {
  title: string;
  company: string;
  description?: string;
  location?: string;
  url?: string;
}

export interface AssetForgeEmailInput {
  job: OutreachJobContext;
  recruiter: RecruiterContact;
  resumeSummary: string;
  antiSlopEnabled?: boolean;
  writingStyleContext?: string;
}

export interface AssetForgeEmailResult {
  status: 'generated' | 'skipped';
  reason?: 'recruiter_not_found' | 'apollo_error';
  recruiter?: RecruiterContact;
  email?: string;
}

export function buildAssetForgeSkipResult(
  reason: 'recruiter_not_found' | 'apollo_error'
): AssetForgeEmailResult {
  return {
    status: 'skipped',
    reason,
  };
}

async function generateAssetForgeEmail(
  input: AssetForgeEmailInput
): Promise<string> {
  return runWithGuardrails(
    'email_generation',
    async () => {
      const prompt = `You are an expert career coach specializing in concise recruiter outreach.
Write a cold email to ${input.recruiter.name} at ${input.job.company} about the ${input.job.title} role.

Rules:
- Mention ${input.job.company}
- Mention ${input.job.title}
- Under 120 words
- Ground the message in this resume summary only
- Do not invent background or recruiter facts

${input.antiSlopEnabled !== false ? ANTI_SLOP_PROMPT : ''}

Resume Summary:
${input.resumeSummary}

Return ONLY the email body.`;

      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'anthropic/claude-opus-4.6'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('Empty cold email generated');
      }
      return content.trim();
    },
    {
      company: input.job.company,
      jobTitle: input.job.title,
      resumeSummary: input.resumeSummary,
      recruiter: input.recruiter,
      antiSlopEnabled: input.antiSlopEnabled !== false,
      writingStyleContext: input.writingStyleContext || '',
    }
  );
}

export async function generateAssetForgeEmailForJob(input: {
  job: OutreachJobContext;
  resumeSummary: string;
  antiSlopEnabled?: boolean;
  writingStyleContext?: string;
}): Promise<AssetForgeEmailResult> {
  try {
    const recruiter = await fetchRecruiterFromApollo({
      company: input.job.company,
      jobTitle: input.job.title,
    });

    if (!recruiter) {
      return buildAssetForgeSkipResult('recruiter_not_found');
    }

    const email = await generateAssetForgeEmail({
      job: input.job,
      recruiter,
      resumeSummary: input.resumeSummary,
      antiSlopEnabled: input.antiSlopEnabled,
      writingStyleContext: input.writingStyleContext,
    });

    return {
      status: 'generated',
      recruiter,
      email,
    };
  } catch (error) {
    console.error('Asset Forge email generation failed:', error);
    return buildAssetForgeSkipResult('apollo_error');
  }
}

export async function generateColdEmail(
  jobTitle: string,
  company: string,
  resumeText: string,
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = ''
) {
  return runWithGuardrails(
    'email_generation',
    async () => {
      const prompt = `You are an expert career coach specializing in remote job applications.
Write a highly personalized, professional, and concise cold email to a hiring manager or recruiter at ${company} for the ${jobTitle} (Remote) position.

User's specific writing style preferences learned from past edits: ${writingStyleContext}
Strictly adhere to these stylistic preferences.

Rules:
- Under 120 words.
- Highlight the 1-2 most relevant skills from the resume for this specific role.
- Clearly state you are available to work fully remotely and across time zones.
- Mention one genuine, specific thing about ${company} that shows real interest (product, mission, or recent news - keep it believable).
- End with a direct, low-friction CTA (e.g., "Happy to jump on a 20-min call this week.").

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume Text:
${resumeText}

Return ONLY the email body. No subject line.`;

      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'anthropic/claude-opus-4.6'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('Empty cold email generated');
      }
      return content.trim();
    },
    {
      jobTitle,
      company,
      resumeText,
      antiSlopEnabled,
      writingStyleContext,
    }
  );
}

export async function extractRecruiterEmail(jobDescription: string, companyName: string): Promise<string> {
  const prompt = `You are a helpful assistant trying to find the contact email for a job application.
Scan the following job description for ANY email addresses.
If you find a specific recruiter or hiring manager email, return it.
If you find a general careers email (e.g. careers@..., jobs@...), return it.
If you do not find any email, return a best guess based on the company name (e.g. careers@${companyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com).

Job Description:
${jobDescription.substring(0, 3000)}

Company: ${companyName}

Return ONLY the email address as a raw string. No other text.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'openai/gpt-4o-mini');
    const email = response.choices?.[0]?.message?.content?.trim() || '';
    // Basic validation
    if (email.includes('@') && email.includes('.')) {
      return email.split(' ')[0]; // ensure no extra text
    }
  } catch (error) {
    console.error('Error finding email:', error);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Agent 6: Interview Question Generation
// Mix of technical, behavioral, and remote-work specific questions.
// ---------------------------------------------------------------------------
export async function generateInterviewQuestions(jobTitle: string, company: string, antiSlopEnabled: boolean = true) {
  const prompt = `You are an expert technical interviewer and Y Combinator founder. Generate 5 highly relevant, intense, and deeply thought-provoking interview questions with suggested answers for a ${jobTitle} (Remote) position at ${company}.

Use a Y Combinator type of thinking:
- Focus on first principles, high-growth impact, and dealing with ambiguity.
- Ask questions that reveal how they think, not just what they know.
- Include a suggested answer or "what to look for" for each question.

Format each as a Markdown item:
**Q1: [Question]**
**Answer/What to look for:** [Brief guide on the ideal answer]

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Generate exactly 5 questions.
Return ONLY clean Markdown.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-3.5-sonnet');
    
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content.trim();
    }
    throw new Error('Empty interview questions generated');
  } catch (error) {
    console.error('Error generating interview questions:', error);
    throw error instanceof Error ? error : new Error('Failed to generate interview questions');
  }
}

// ---------------------------------------------------------------------------
// Agent 7: Salary Insights
// Market salary ranges with a remote vs on-site premium comparison.
// ---------------------------------------------------------------------------
export async function generateSalaryInsights(jobTitle: string, location: string, antiSlopEnabled: boolean = true) {
  const prompt = `You are an expert compensation analyst specializing in remote tech roles.
Provide realistic salary insights for a REMOTE "${jobTitle}" position.

Include:
1. **Remote salary range** - low, median, and high (in USD annually).
2. **On-site equivalent** in "${location}" - for comparison.
3. **Remote premium/discount** - e.g. "Remote roles for this title pay ~8% more than on-site in ${location} due to reduced overhead."
4. **3 key salary factors** - e.g. years of experience, specific stack, company size/stage.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Format in clean Markdown. Under 200 words. No fluff.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-3.5-sonnet');
    return response.choices?.[0]?.message?.content || 'Could not generate salary insights.';
  } catch (error) {
    console.error('Error generating salary insights:', error);
    return 'Error generating salary insights. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// Agent 8: Resume Tailoring
// Rewrites resume bullets for the specific role + injects remote-readiness keywords.
// ---------------------------------------------------------------------------
export async function tailorResume(
  jobTitle: string,
  jobDescription: string,
  resumeText: string,
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = ''
) {
  return runWithGuardrails(
    'resume_tailoring',
    async () => {
      const prompt = `You are an expert resume writer and technical recruiter.
Tailor the following resume for a ${jobTitle} position.

User's specific writing style preferences: ${writingStyleContext}

# STRICT ATS FORMATTING RULES
You MUST output the resume in clean, standard Markdown. Do NOT use weird angles, excessive emojis, or non-standard formatting.
Use this exact structure:
1. Header: Name as H1 (# Name), followed by Contact Info (Email | Phone | Location | LinkedIn/GitHub) on a single line.
2. Summary: A short 2-3 sentence professional summary tailored to the job description.
3. Skills: A grouped list of technical and soft skills relevant to the job description.
4. Experience: Use H3 (###) for "Company - Title", followed by the dates. Use standard bullet points (-) for achievements.
5. Education: Use H3 (###) for the Degree and University.

Instructions:
1. Highlight the most relevant skills and experiences for this specific role based on the Job Description.
2. Inject keywords from the job description naturally to pass ATS filters.
3. Strengthen bullet points with metrics and impact wherever the original has them.
4. If the job is remote, emphasize remote-readiness signals (async communication, self-management).
5. Do NOT fabricate experience or skills absent from the original resume.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Job Description:
${jobDescription}

Original Resume:
${resumeText}

Return ONLY the tailored resume in clean Markdown format.`;

      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'anthropic/claude-opus-4.6'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('Empty tailored resume generated');
      }
      return content.trim();
    },
    {
      jobTitle,
      jobDescription,
      resumeText,
      antiSlopEnabled,
      writingStyleContext,
    }
  );
}
