/**
 * jobMatchingEngine.ts
 *
 * AI-powered job matching pipeline:
 *
 *  STAGE 1 – Batch scoring (Google Gemini 2.5 Pro)
 *    Sends all 50–80 harvested jobs + user profile in one call.
 *    Returns matchScore (0–100) for each job.
 *    Gemini is chosen for its long-context capability and accuracy on
 *    structured JSON tasks.
 *
 *  STAGE 2 – Enrichment (Anthropic Claude claude-sonnet-4-6 via OpenRouter)
 *    For the top-ranked 15 candidates, generate per-job insights:
 *    matchReasons, skillGaps, aiSummary, isHotJob, hotSignals, companyStage.
 *    Claude is chosen for nuanced language understanding and precise output.
 *
 *  STAGE 3 – Final ranking + selection
 *    Composite score: matchScore × 0.50 + freshnessScore × 0.20 +
 *    qualityScore × 0.20 + hotJobBonus × 0.10
 *    Pick top 10 (or fewer if the user is on free plan).
 *
 * Falls back to pure keyword scoring if any AI call fails.
 */

import type { RawJob } from './jobHarvester';
import type { DailyJob } from '../types/dailyJob';

// ─────────────────────────────────────────────────────────────────────────────
// Shared AI caller (proxied through /api/openai which routes via OpenRouter)
// ─────────────────────────────────────────────────────────────────────────────

async function callAI(
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `AI call failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring helpers (used as fallback and in composite score)
// ─────────────────────────────────────────────────────────────────────────────

function freshnessScore(daysOld: number): number {
  if (daysOld === 0) return 100;
  if (daysOld <= 3) return 90;
  if (daysOld <= 7) return 75;
  if (daysOld <= 14) return 55;
  return 30;
}

function sourceQualityScore(source: string): number {
  switch (source) {
    case 'jsearch':   return 95;
    case 'remotive':  return 85;
    case 'jobicy':    return 80;
    case 'arbeitnow': return 75;
    default:          return 70;
  }
}

function keywordMatchScore(job: RawJob, careerPaths: string[], resumeText: string): number {
  const haystack = `${job.title} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
  const pathKeywords = careerPaths.flatMap((p) => p.toLowerCase().split(/\s+/));
  const skillKeywords = (resumeText.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).slice(0, 40);

  let score = 40;
  const titleMatch = pathKeywords.some((kw) => job.title.toLowerCase().includes(kw));
  if (titleMatch) score += 35;
  let skillHits = 0;
  for (const kw of skillKeywords) {
    if (haystack.includes(kw)) skillHits++;
  }
  score += Math.min(25, skillHits * 3);
  return Math.min(100, score);
}

function compositeScore(
  matchScore: number,
  days: number,
  source: string,
  isHot: boolean
): number {
  return (
    matchScore           * 0.50 +
    freshnessScore(days) * 0.20 +
    sourceQualityScore(source) * 0.20 +
    (isHot ? 10 : 0)   * 0.10
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Batch scoring with Gemini 2.5 Pro
// ─────────────────────────────────────────────────────────────────────────────

interface ScoredJob {
  index: number;
  matchScore: number;
}

async function batchScoreJobs(
  jobs: RawJob[],
  careerPaths: string[],
  resumeText: string,
  jobType: string
): Promise<ScoredJob[]> {
  const jobList = jobs
    .map(
      (j, i) =>
        `[${i}] ${j.title} @ ${j.company} | ${j.location} | ${j.workType}\n` +
        `Tags: ${(j.tags || []).join(', ')}\n` +
        `Description (first 400 chars): ${j.description.slice(0, 400)}`
    )
    .join('\n\n---\n\n');

  const prompt = `You are an expert technical recruiter performing rapid bulk screening.

## Candidate Profile
Career goals: ${careerPaths.join(', ')}
Preferred work type: ${jobType}
Resume (first 1500 chars):
${resumeText.slice(0, 1500)}

## Jobs to Score (${jobs.length} total)
${jobList}

## Task
For each job [index], assign a matchScore (0–100) measuring how well the job fits the candidate.

Scoring rules:
- 90–100: Exceptional fit – title matches career goal, core skills align, correct work type
- 70–89 : Good fit – strong overlap, minor gaps
- 50–69 : Partial fit – some relevant overlap
- 30–49 : Weak fit – role adjacent but key gaps
- 0–29  : Poor fit – wrong domain, seniority, or work type

Penalize heavily for:
- Wrong work type (e.g. on-site only when candidate wants remote)
- Large seniority mismatch (intern vs staff, etc.)
- Completely unrelated domain

Return ONLY a JSON array:
[{"index": 0, "matchScore": 85}, {"index": 1, "matchScore": 72}, ...]

Include ALL ${jobs.length} entries in the same order. No explanation.`;

  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'google/gemini-2.5-pro-preview-03-25'
    );
    const parsed = parseJson<ScoredJob[]>(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('[jobMatchingEngine] Batch scoring failed:', err);
  }

  // Fallback: keyword scoring
  return jobs.map((job, index) => ({
    index,
    matchScore: keywordMatchScore(job, careerPaths, resumeText),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Per-job enrichment with Claude claude-sonnet-4-6
// ─────────────────────────────────────────────────────────────────────────────

interface JobInsights {
  matchReasons: string[];
  skillGaps: string[];
  aiSummary: string;
  isHotJob: boolean;
  hotSignals: string[];
  companyStage?: string;
  estimatedSalary?: string;
}

async function enrichJob(
  job: RawJob,
  matchScore: number,
  careerPaths: string[],
  resumeText: string
): Promise<JobInsights> {
  const prompt = `You are a concise career advisor. Analyze this job listing for the candidate.

## Job
Title: ${job.title}
Company: ${job.company}
Location: ${job.location} (${job.workType})
Salary: ${job.salary || 'Not listed'}
Tags: ${(job.tags || []).join(', ')}
Description:
${job.description.slice(0, 2000)}

## Candidate
Career goals: ${careerPaths.join(', ')}
Resume summary (first 800 chars):
${resumeText.slice(0, 800)}

## Return JSON only:
{
  "matchReasons": ["3-5 specific reasons why this fits the candidate (cite real evidence)"],
  "skillGaps": ["2-4 skills/requirements in the job not evident in the resume"],
  "aiSummary": "2-sentence plain-English summary of the role and why it is relevant",
  "isHotJob": true,
  "hotSignals": ["evidence of fast growth or urgency, if any"],
  "companyStage": "Startup | Scale-up | Enterprise | Unknown",
  "estimatedSalary": "$X–$Y/yr (only if not listed above, else omit)"
}

Be specific and evidence-based. No generic filler.`;

  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'anthropic/claude-sonnet-4-5'
    );
    const parsed = parseJson<JobInsights>(raw);
    if (parsed && Array.isArray(parsed.matchReasons)) {
      return {
        matchReasons: parsed.matchReasons.slice(0, 5),
        skillGaps: (parsed.skillGaps || []).slice(0, 4),
        aiSummary: parsed.aiSummary || '',
        isHotJob: parsed.isHotJob === true,
        hotSignals: parsed.hotSignals || [],
        companyStage: parsed.companyStage,
        estimatedSalary: parsed.estimatedSalary,
      };
    }
  } catch (err) {
    console.error(`[jobMatchingEngine] Enrichment failed for ${job.title} @ ${job.company}:`, err);
  }

  // Fallback: minimal insights
  return {
    matchReasons: [
      careerPaths[0]
        ? `Related to your ${careerPaths[0]} career goal`
        : 'Matches your resume keywords',
    ],
    skillGaps: [],
    aiSummary: `${job.title} at ${job.company}. ${job.description.slice(0, 120)}...`,
    isHotJob: false,
    hotSignals: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3: Final ranking
// ─────────────────────────────────────────────────────────────────────────────

function buildDailyJob(
  raw: RawJob,
  matchScore: number,
  insights: JobInsights
): DailyJob {
  const fScore = Math.round(
    compositeScore(matchScore, raw.daysOld ?? 0, raw.source, insights.isHotJob)
  );

  return {
    id: raw.fingerprint,
    fingerprint: raw.fingerprint,
    title: raw.title,
    company: raw.company,
    companyLogo: raw.companyLogo,
    location: raw.location,
    workType: raw.workType,
    salary: raw.salary,
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    salaryCurrency: raw.salaryCurrency,
    description: raw.description,
    requirements: raw.tags || [],
    source: raw.source,
    applyUrl: raw.applyUrl,
    postedAt: raw.postedAt,
    daysOld: raw.daysOld,
    // AI enrichment
    matchScore,
    finalScore: fScore,
    matchReasons: insights.matchReasons,
    skillGaps: insights.skillGaps,
    aiSummary: insights.aiSummary,
    isHotJob: insights.isHotJob,
    hotSignals: insights.hotSignals,
    companyStage: insights.companyStage,
    estimatedSalary: insights.estimatedSalary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchOptions {
  careerPaths: string[];
  resumeText: string;
  jobType?: string;
  seenFingerprints?: string[];
  limit?: number;         // defaults to 10 (pro), 1 (free)
}

export interface MatchResult {
  jobs: DailyJob[];
  usedFallback: boolean;
  enrichedCount: number;
  scoredCount: number;
}

/**
 * Full pipeline: score → filter seen → enrich top-N → rank → slice.
 *
 * Called from the server-side cron only.
 */
export async function matchAndRankJobs(
  rawJobs: RawJob[],
  opts: MatchOptions
): Promise<MatchResult> {
  const {
    careerPaths,
    resumeText,
    jobType = 'both',
    seenFingerprints = [],
    limit = 10,
  } = opts;

  const seenSet = new Set(seenFingerprints);
  let usedFallback = false;

  // Remove already-seen jobs from this batch
  const unseenJobs = rawJobs.filter((j) => !seenSet.has(j.fingerprint));

  // Stage 1: Batch score all unseen jobs
  const scores = await batchScoreJobs(unseenJobs, careerPaths, resumeText, jobType);

  // Map scores back to jobs and pre-sort by matchScore descending
  const scored = unseenJobs
    .map((job, idx) => ({
      job,
      matchScore: scores[idx]?.matchScore ?? keywordMatchScore(job, careerPaths, resumeText),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);

  // Backfill from seen jobs if we don't have enough
  let backfillJobs: typeof scored = [];
  if (scored.length < limit) {
    const seenJobs = rawJobs.filter((j) => seenSet.has(j.fingerprint));
    const seenScores = await batchScoreJobs(seenJobs, careerPaths, resumeText, jobType);
    backfillJobs = seenJobs
      .map((job, idx) => ({
        job,
        matchScore: seenScores[idx]?.matchScore ?? keywordMatchScore(job, careerPaths, resumeText),
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
    if (backfillJobs.length > 0) usedFallback = true;
  }

  const candidates = [...scored, ...backfillJobs].slice(0, Math.max(limit, 15));

  // Stage 2: Enrich top candidates (run in parallel, max 5 concurrent)
  const enriched: DailyJob[] = [];
  const batchSize = 5;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(({ job, matchScore }) =>
        enrichJob(job, matchScore, careerPaths, resumeText).then((insights) =>
          buildDailyJob(job, matchScore, insights)
        )
      )
    );
    for (const res of results) {
      if (res.status === 'fulfilled') enriched.push(res.value);
    }
  }

  // Stage 3: Final sort by composite finalScore, take top `limit`
  const final = enriched
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);

  return {
    jobs: final,
    usedFallback,
    enrichedCount: enriched.length,
    scoredCount: scored.length,
  };
}
