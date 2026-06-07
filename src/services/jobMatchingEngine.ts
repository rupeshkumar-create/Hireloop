import type { DiscoveredJob, CallAIFn } from './jobResearcher.js';
import type { DailyJob } from '../types/dailyJob.js';
import { jobMatchesUserPreferences, normalizeUserPreferences } from './validator.js';
import { inferUserCountry, type UserCountry } from './remoteEligibility.js';

// Genuine noise — articles, auxiliary verbs, generic role-page chrome. We
// deliberately KEEP role-defining nouns like "engineer", "manager", "senior",
// "lead" because those are exactly the tokens we want career-path matching
// to hit on (e.g. "Senior Frontend Engineer" → "Senior Frontend Engineer").
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'or', 'but', 'the', 'for', 'with', 'from', 'that', 'this',
  'these', 'those', 'your', 'you', 'are', 'our', 'will', 'have', 'has', 'had',
  'is', 'be', 'been', 'being', 'we', 'us', 'their', 'they', 'who', 'whom',
  'role', 'job', 'work', 'team', 'company', 'looking', 'seeking', 'about',
  'remote', 'hybrid', 'onsite', 'office', 'full', 'part', 'time',
]);

const SENIORITY_LEVELS: Record<string, number> = {
  intern: 0, internship: 0,
  junior: 1, entry: 1, associate: 1, grad: 1,
  mid: 2, midlevel: 2,
  senior: 3, sr: 3,
  lead: 4, principal: 4, staff: 4,
  manager: 4, head: 5, director: 5, vp: 6, cxo: 6, chief: 6, ceo: 6, cto: 6, cfo: 6,
};

/** Maps title tokens to a coarse role function so we can reject cross-function noise. */
const ROLE_FUNCTION_KEYWORDS: Record<string, string[]> = {
  software: [
    'engineer', 'developer', 'programmer', 'architect', 'software', 'frontend', 'backend',
    'fullstack', 'full-stack', 'devops', 'sre', 'platform', 'infra', 'infrastructure',
    'mobile', 'ios', 'android', 'embedded', 'firmware', 'qa', 'sdet', 'security',
  ],
  product: ['product', 'pm', 'owner', 'program'],
  design: ['design', 'designer', 'ux', 'ui', 'creative', 'visual', 'brand'],
  data: ['data', 'analyst', 'analytics', 'scientist', 'ml', 'machine', 'learning', 'research'],
  marketing: ['marketing', 'growth', 'seo', 'content', 'communications', 'demand'],
  sales: ['sales', 'account', 'revenue', 'sdr', 'bdr'],
  operations: ['operations', 'ops', 'supply', 'logistics', 'facilities'],
  finance: ['finance', 'financial', 'accounting', 'accountant', 'controller', 'treasury'],
  hr: ['recruiter', 'recruiting', 'talent', 'people', 'hr'],
  legal: ['legal', 'counsel', 'attorney', 'paralegal', 'compliance'],
  support: ['support', 'customer', 'success', 'cx', 'service'],
};

const DEFAULT_MIN_MATCH_SCORE = 78;
const MIN_DETERMINISTIC_FOR_POOL = 38;
const MIN_DETERMINISTIC_WITHOUT_AI = 52;

type AiVerdict = 'perfect' | 'strong' | 'reasonable' | 'stretch' | 'wrong';

function inferRoleFunctions(text: string): Set<string> {
  const tokens = tokenize(text);
  const haystack = normalizePhrase(text);
  const found = new Set<string>();
  for (const [fn, keywords] of Object.entries(ROLE_FUNCTION_KEYWORDS)) {
    if (keywords.some((kw) => tokens.includes(kw) || haystack.includes(kw))) {
      found.add(fn);
    }
  }
  return found;
}

function titlePhraseScore(jobTitle: string, careerPaths: string[]): number {
  const titleNorm = normalizePhrase(jobTitle);
  const titleTokens = tokenize(jobTitle);
  let best = 0;

  for (const path of careerPaths.map(normalizePhrase).filter(Boolean)) {
    if (titleNorm === path) {
      best = Math.max(best, 35);
      continue;
    }
    if (titleNorm.includes(path) || path.includes(titleNorm)) {
      best = Math.max(best, 28);
      continue;
    }
    const pathTokens = tokenize(path);
    const overlap = pathTokens.filter((t) => titleTokens.includes(t)).length;
    if (pathTokens.length > 0) {
      best = Math.max(best, Math.round((overlap / pathTokens.length) * 22));
    }
  }
  return best;
}

/**
 * Hard gate: job title must align with the user's chosen career path(s).
 * Blocks cross-function noise (e.g. PM roles for SWE paths) and weak token overlap.
 */
export function passesCareerPathGate(input: {
  job: DiscoveredJob;
  careerPaths: string[];
  structuredProfile?: DeterministicScoreInputs['structuredProfile'];
}): boolean {
  const { job, careerPaths, structuredProfile } = input;
  if (careerPaths.length === 0) return true;

  const phraseScore = titlePhraseScore(job.title, careerPaths);
  if (phraseScore >= 22) return true;

  const careerFunctions = new Set<string>();
  for (const path of careerPaths) inferRoleFunctions(path).forEach((fn) => careerFunctions.add(fn));
  for (const role of structuredProfile?.roles || []) {
    inferRoleFunctions(role).forEach((fn) => careerFunctions.add(fn));
  }

  const jobFunctions = inferRoleFunctions(job.title);
  const sharedFunctions = [...jobFunctions].filter((fn) => careerFunctions.has(fn));
  if (sharedFunctions.length === 0) return false;

  const careerTokens = unique(careerPaths.flatMap(tokenize));
  const titleTokens = tokenize(job.title);
  const tokenOverlap = careerTokens.filter((t) => titleTokens.includes(t)).length;

  // Same function family + at least two meaningful title tokens from career paths.
  return tokenOverlap >= 2 && phraseScore >= 10;
}

/** Reject entry-level listings for senior+ candidates targeting advanced roles. */
export function passesSeniorityGate(input: {
  job: DiscoveredJob;
  careerPaths: string[];
  structuredProfile?: DeterministicScoreInputs['structuredProfile'];
}): boolean {
  const { job, careerPaths, structuredProfile } = input;
  const userLevel = Math.max(
    detectSeniorityLevel(structuredProfile?.seniority || ''),
    ...careerPaths.map((path) => detectSeniorityLevel(path)),
  );
  if (userLevel < 0) return true;

  const jobLevel = detectSeniorityLevel(job.title);
  if (jobLevel < 0) return true;

  // Senior+ candidates should not see intern/junior/entry roles.
  if (userLevel >= 3 && jobLevel <= 1) return false;
  // Staff/principal+ should not see mid-level or below.
  if (userLevel >= 4 && jobLevel <= 2) return false;
  // More than two levels below is almost always noise.
  if (userLevel - jobLevel >= 3) return false;

  return true;
}

function tokenize(value: string): string[] {
  return (value.toLowerCase().match(/[a-z][a-z0-9.+#-]{1,}/g) || [])
    .filter((token) => !STOP_WORDS.has(token) && token.length >= 2);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function freshnessScore(daysOld: number): number {
  if (daysOld <= 1) return 100;
  if (daysOld <= 3) return 90;
  if (daysOld <= 7) return 75;
  if (daysOld <= 14) return 55;
  return 30;
}

function remoteBonus(workType: string): number {
  return workType === 'remote' ? 8 : workType === 'hybrid' ? 3 : 0;
}

function inferMatchedCareerPath(job: DiscoveredJob, careerPaths: string[]): string | undefined {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return careerPaths.find((path) => {
    const tokens = tokenize(path);
    return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
  });
}

/** Detect seniority level from a title or path. Returns -1 if no signal. */
function detectSeniorityLevel(text: string): number {
  const lower = text.toLowerCase();
  let level = -1;
  for (const [key, value] of Object.entries(SENIORITY_LEVELS)) {
    if (new RegExp(`\\b${key}\\b`).test(lower)) {
      level = Math.max(level, value);
    }
  }
  return level;
}

export interface DeterministicScoreInputs {
  job: DiscoveredJob;
  careerPaths: string[];
  resumeText: string;
  // Optional — when available, provides a much stronger signal than re-parsing
  // the raw resume text. Comes from extractResume's structured output.
  structuredProfile?: {
    skills?: string[];
    techStack?: string[];
    seniority?: string;
    roles?: string[];
    industries?: string[];
  };
}

/**
 * Deterministic relevance score. Weights, roughly:
 *   - Title phrase match against a career path:  up to 35
 *   - Title-token overlap with career paths:     up to 15
 *   - Structured-skill / tech-stack overlap:     up to 25
 *   - Seniority alignment (penalty when off):    ±10
 *   - Hygiene (recent posting, apply URL):       up to 10
 *   - Remote bonus:                              up to 8
 *
 * Base 0. Clamped to [0, 100].
 */
export function deterministicMatchScore(input: DeterministicScoreInputs): number {
  const { job, careerPaths, resumeText, structuredProfile } = input;

  const titleNorm = normalizePhrase(job.title);
  const titleTokens = tokenize(job.title);
  const haystack = `${job.title} ${job.description} ${(job.requirements || []).join(' ')}`.toLowerCase();
  const careerPathsNorm = careerPaths.map(normalizePhrase).filter(Boolean);
  const careerTokens = unique(careerPaths.flatMap(tokenize));

  // ── Title phrase match — strongest signal ──────────────────────────────
  // "Senior Frontend Engineer" career path → exact-match title earns the
  // full 35; a substring match (e.g. "Senior Frontend Engineer II") earns
  // partial credit.
  let titlePhrase = 0;
  for (const path of careerPathsNorm) {
    if (!path) continue;
    if (titleNorm === path) {
      titlePhrase = Math.max(titlePhrase, 35);
    } else if (titleNorm.includes(path) || path.includes(titleNorm)) {
      titlePhrase = Math.max(titlePhrase, 28);
    } else {
      // Fall back to per-token overlap inside title.
      const pathTokens = tokenize(path);
      const overlap = pathTokens.filter((t) => titleTokens.includes(t)).length;
      if (pathTokens.length > 0) {
        const ratio = overlap / pathTokens.length;
        titlePhrase = Math.max(titlePhrase, Math.round(ratio * 22));
      }
    }
  }

  // ── Title-token overlap (broader catch-net) ────────────────────────────
  const titleTokenOverlap = careerTokens.filter((t) => titleTokens.includes(t)).length;
  const titleTokenScore = Math.min(15, titleTokenOverlap * 5);

  // ── Skill / tech-stack overlap ─────────────────────────────────────────
  // Strongly prefer the structured profile (already AI-extracted, accurate).
  // Fall back to coarse resume-text scanning when missing.
  const profileSkills = unique([
    ...(structuredProfile?.skills || []),
    ...(structuredProfile?.techStack || []),
  ]);
  const skillPool: string[] = profileSkills.length > 0
    ? profileSkills
    : unique(tokenize(resumeText).slice(0, 200));

  let skillHits = 0;
  for (const skill of skillPool) {
    const needle = normalizePhrase(skill);
    if (needle.length < 2) continue;
    // Word-boundary contains: catches "react" inside "React, Redux".
    if (new RegExp(`\\b${needle.replace(/[+#.]/g, '\\$&')}\\b`).test(haystack)) {
      skillHits++;
    }
  }
  const skillScore = Math.min(25, skillHits * 3);

  // ── Seniority alignment ───────────────────────────────────────────────
  // Compare job-title seniority against the user's seniority (from profile
  // or any career path). One level apart is fine. Two-plus is a real
  // mismatch — could be a senior staring at intern roles, or vice versa.
  const userSeniority = Math.max(
    detectSeniorityLevel(structuredProfile?.seniority || ''),
    ...careerPaths.map((p) => detectSeniorityLevel(p)),
  );
  const jobSeniority = detectSeniorityLevel(job.title);
  let seniorityScore = 0;
  if (userSeniority >= 0 && jobSeniority >= 0) {
    const gap = Math.abs(userSeniority - jobSeniority);
    if (gap === 0) seniorityScore = 10;
    else if (gap === 1) seniorityScore = 4;
    else if (gap === 2) seniorityScore = -6;
    else seniorityScore = -10;
  }

  // ── Hygiene + remote bonus ─────────────────────────────────────────────
  const recencyBonus = job.daysOld <= 3 ? 5 : job.daysOld <= 7 ? 3 : 0;
  const applyBonus = job.applyUrl ? 3 : 0;

  const total =
    titlePhrase +
    titleTokenScore +
    skillScore +
    seniorityScore +
    recencyBonus +
    applyBonus +
    remoteBonus(job.workType);

  return Math.max(0, Math.min(100, Math.round(total)));
}

/**
 * Step 2 & 3: Nuanced AI scoring and insight generation.
 * Optimized to use 'aiDescriptionEnriched' field to save tokens.
 */
async function scoreJobsWithAI(
  jobs: DiscoveredJob[],
  resumeText: string,
  careerPaths: string[],
  callAI: CallAIFn,
  structuredProfile?: DeterministicScoreInputs['structuredProfile'],
): Promise<Record<string, { aiScore: number; aiReason: string; aiInsight: string; verdict?: AiVerdict }>> {
  if (jobs.length === 0) return {};

  // Structured profile summary — gives the AI verified, dense signal instead
  // of forcing it to re-parse the raw resume each time.
  const profileBlock = structuredProfile
    ? [
        structuredProfile.seniority ? `Seniority: ${structuredProfile.seniority}` : '',
        structuredProfile.roles?.length ? `Roles: ${structuredProfile.roles.join(', ')}` : '',
        structuredProfile.industries?.length ? `Industries: ${structuredProfile.industries.join(', ')}` : '',
        structuredProfile.skills?.length ? `Skills: ${structuredProfile.skills.slice(0, 25).join(', ')}` : '',
        structuredProfile.techStack?.length ? `Tech stack: ${structuredProfile.techStack.slice(0, 25).join(', ')}` : '',
      ].filter(Boolean).join('\n')
    : '';

  const prompt = `You are a senior technical recruiter. Score each job 0-100 against the
specific candidate below. Use the FULL range — most jobs are not 70-90 fits.

ANCHORED RUBRIC (use these as reference points):
  95-100  Perfect fit. Exact title match, every required skill present, right seniority.
  80-94   Strong fit. Title is in the candidate's career paths, most skills overlap, seniority aligns.
  60-79   Reasonable fit. Adjacent role or some skill gaps, but candidate could land it with prep.
  40-59   Stretch. Real gaps in seniority, industry, or skills — would need to upskill or pivot.
  20-39   Wrong direction. Different function, wrong seniority, irrelevant industry.
  0-19    Mismatch. Should not have been surfaced.

EVALUATE EACH JOB ON FOUR AXES:
  1. Role match — does the title align with the candidate's target career paths?
  2. Skill fit — what fraction of the job's required skills does the candidate have?
  3. Seniority alignment — is the candidate the right level, or over/under-qualified?
  4. Quality signals — well-known company, clear job description, recent posting.

ANTI-PATTERNS TO PENALIZE HARD:
  - Hybrid jobs disguised as "remote" → cap at 40 if explicitly hybrid.
  - Role that requires a license/credential the candidate doesn't have (medical, legal, finance) → cap at 30.
  - Seniority more than one level off from the candidate → cap at 60.

CANDIDATE PROFILE
-----------------
Career paths: ${careerPaths.join(', ') || '(none specified)'}
${profileBlock || `Resume summary:\n${resumeText.substring(0, 3500)}`}

JOBS TO SCORE
-------------
${jobs.map((job, i) => `[${i}]
  Title: ${job.title}
  Company: ${job.company}
  Location: ${job.location || 'Unspecified'}
  Summary: ${job.aiDescriptionEnriched || job.description.substring(0, 700)}`).join('\n\n')}

Return a JSON array of objects, one per job, in the same order:
[{
  "index": number,
  "score": number,           // 0-100, using the rubric above
  "verdict": "perfect" | "strong" | "reasonable" | "stretch" | "wrong",
  "reason": "1-sentence internal note: WHY this score (cite the specific gap or strength)",
  "insight": "1-sentence candidate-facing pitch: why this role might excite or fit them"
}]

Respond ONLY with the raw JSON array. No markdown fences, no commentary.`;

  try {
    // gpt-4o gives noticeably better judgment than gpt-4o-mini on this task
    // (less compression toward 70-85, sharper rejections). The marginal cost
    // is worth it — scoring runs at most a few times per user per day.
    const response = await callAI([{ role: 'user', content: prompt }], 'openai/gpt-4o');
    const parsed = parseAiJsonArray(response);
    const results: Record<string, { aiScore: number; aiReason: string; aiInsight: string; verdict?: AiVerdict }> = {};

    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        const job = jobs[item.index];
        if (job) {
          const verdict = item.verdict as AiVerdict | undefined;
          results[job.fingerprint] = {
            aiScore: Math.min(100, Math.max(0, item.score ?? 50)),
            aiReason: item.reason || 'Matches your high-level profile.',
            aiInsight: item.insight || `${job.company} is hiring for ${job.title}.`,
            verdict,
          };
        }
      });
    } else {
      console.warn('[jobMatchingEngine] AI response did not parse to an array; falling back to deterministic only.');
    }
    return results;
  } catch (error) {
    console.error('[jobMatchingEngine] AI Scoring failed:', error);
    return {};
  }
}

/**
 * Robust JSON-array parser for LLM output.
 * gpt-4o-mini frequently wraps responses in ```json ... ``` despite being
 * told not to. Strip fences, then fall back to slicing the first [...]
 * substring so a leading/trailing sentence doesn't kill the whole response.
 */
function parseAiJsonArray(raw: string): unknown {
  if (!raw) return null;
  let text = raw.trim();

  // Strip surrounding code fences: ```json\n...\n``` or ```\n...\n```
  const fenceMatch = text.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(text);
  } catch {
    // Fall back to extracting the first [...] block
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildDailyJob(
  raw: DiscoveredJob, 
  matchScore: number, 
  careerPaths: string[], 
  resumeText: string,
  aiData?: { aiReason: string; aiInsight: string }
): DailyJob {
  const matchedCareerPath = raw.matchedCareerPath || inferMatchedCareerPath(raw, careerPaths);

  return {
    id: raw.fingerprint,
    fingerprint: raw.fingerprint,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    workType: raw.workType,
    salary: raw.salary,
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    logoUrl: raw.logoUrl,
    description: raw.description,
    requirements: raw.requirements,
    source: raw.source,
    applyUrl: raw.applyUrl,
    postedAt: raw.postedAt,
    daysOld: raw.daysOld,
    matchScore,
    finalScore: Math.round(matchScore * 0.7 + freshnessScore(raw.daysOld ?? 0) * 0.3),
    matchReasons: aiData?.aiReason ? [aiData.aiReason] : ['Relevant match based on profile overlap.'],
    skillGaps: [],
    aiSummary: aiData?.aiInsight || `${raw.company} is hiring for ${raw.title}.`,
    aiInsight: aiData?.aiInsight,
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
  deliveryTimezone?: string;
  userCountry?: UserCountry;
  // Structured profile from extractResume — supplies skills, seniority,
  // industries to BOTH the deterministic scorer and the AI scoring prompt.
  // When omitted, scoring falls back to coarse resume-text parsing.
  structuredProfile?: DeterministicScoreInputs['structuredProfile'];
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
  callAI?: CallAIFn
): Promise<MatchResult> {
  const {
    careerPaths,
    resumeText,
    seenFingerprints = [],
    limit = 10,
    minMatchScore = DEFAULT_MIN_MATCH_SCORE,
    matchingPreferences,
    deliveryTimezone,
    userCountry: explicitCountry,
    structuredProfile,
  } = opts;

  const seenSet = new Set(seenFingerprints);
  const normalizedPreferences = normalizeUserPreferences(matchingPreferences || {});
  const userCountry =
    explicitCountry ||
    inferUserCountry({
      deliveryTimezone,
      locations: normalizedPreferences.locations,
    });
  let usedSeenFallback = false;

  // 1. Initial Filtering & Deterministic Scoring
  // Prefer unseen jobs (variety across days), but if Apify keeps returning
  // listings the user has already seen, fall back to including them so we
  // never starve a forced re-run with 0 results. Unseen are sorted ahead
  // of seen so they win every available slot before we dip into seen.
  const unseenJobs = discoveredJobs.filter((job) => !seenSet.has(job.fingerprint));
  const seenJobs = discoveredJobs.filter((job) => seenSet.has(job.fingerprint));
  const candidateJobs =
    unseenJobs.length >= limit ? unseenJobs : [...unseenJobs, ...seenJobs];
  usedSeenFallback = unseenJobs.length < limit && seenJobs.length > 0;

  let preferenceFilteredCount = 0;
  let careerPathFilteredCount = 0;
  let seniorityFilteredCount = 0;
  const initialCandidates = candidateJobs
    .map((job) => ({
      job,
      detScore: deterministicMatchScore({ job, careerPaths, resumeText, structuredProfile }),
    }))
    .filter(({ job, detScore }) => {
      if (!passesCareerPathGate({ job, careerPaths, structuredProfile })) {
        careerPathFilteredCount++;
        return false;
      }
      if (!passesSeniorityGate({ job, careerPaths, structuredProfile })) {
        seniorityFilteredCount++;
        return false;
      }
      if (detScore < MIN_DETERMINISTIC_FOR_POOL) {
        return false;
      }
      const result = jobMatchesUserPreferences(
        {
          isRemote: job.workType === 'remote',
          salary: job.salary,
          location: job.location,
          description: job.description,
        },
        normalizedPreferences,
        userCountry
      );
      if (!result.passed) {
        preferenceFilteredCount++;
        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `[jobMatchingEngine] Filtered "${job.title}" @ ${job.company} (${job.location}) — ${result.code}`
          );
        }
      }
      return result.passed;
    })
    .sort((a, b) => b.detScore - a.detScore);

  // 2. Pick top candidates for AI scoring
  const topCandidates = initialCandidates.slice(0, 30);
  let aiResults: Record<string, { aiScore: number; aiReason: string; aiInsight: string; verdict?: AiVerdict }> = {};
  
  if (callAI && topCandidates.length > 0) {
    console.log(`[jobMatchingEngine] Requesting AI scoring for ${topCandidates.length} jobs using enriched descriptions...`);
    aiResults = await scoreJobsWithAI(
      topCandidates.map(c => c.job),
      resumeText,
      careerPaths,
      callAI,
      structuredProfile,
    );
  }

  const effectiveMinScore = callAI ? minMatchScore : Math.max(minMatchScore, MIN_DETERMINISTIC_WITHOUT_AI);

  // 3. Build final DailyJob objects and apply quality threshold
  const scored = initialCandidates
    .map(({ job, detScore }) => {
      const aiData = aiResults[job.fingerprint];
      if (aiData?.verdict === 'stretch' || aiData?.verdict === 'wrong') {
        return null;
      }
      // Weighted average: AI score (85%) + Deterministic score (15%) if AI available
      const finalMatchScore = aiData ? Math.round(aiData.aiScore * 0.85 + detScore * 0.15) : detScore;
      
      return {
        job,
        matchScore: finalMatchScore,
        dailyJob: buildDailyJob(job, finalMatchScore, careerPaths, resumeText, aiData),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter(({ matchScore }) => matchScore >= effectiveMinScore)
    .sort((a, b) => b.dailyJob.finalScore - a.dailyJob.finalScore);

  // 4. Company-level Deduplication & Selection
  // Ensure each company only appears once in the daily match set.
  const seenCompanies = new Set<string>();
  const final: DailyJob[] = [];

  for (const item of scored) {
    if (final.length >= limit) break;
    
    const companyKey = item.job.company.toLowerCase().trim();
    if (!seenCompanies.has(companyKey)) {
      seenCompanies.add(companyKey);
      final.push(item.dailyJob);
    }
  }

  if (careerPathFilteredCount > 0 || seniorityFilteredCount > 0) {
    console.log(
      `[jobMatchingEngine] Career-path gate removed ${careerPathFilteredCount} jobs; ` +
      `seniority gate removed ${seniorityFilteredCount} jobs.`
    );
  }

  return {
    jobs: final,
    usedFallback: usedSeenFallback,
    enrichedCount: final.length,
    scoredCount: scored.length,
    qualityFilteredCount: Math.max(0, discoveredJobs.length - scored.length),
    dedupedCount: Math.max(0, discoveredJobs.length - final.length),
  };
}
