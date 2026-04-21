/**
 * jobMatchingEngine.ts
 *
 * AI-powered job matching pipeline:
 *
 *  STAGE 1 – Batch scoring (Google Gemini 2.5 Pro)
 *    Sends all discovered jobs + user profile in one call.
 *    Returns matchScore (0–100) for each job.
 *    Remote jobs receive a +8 bonus to surface them higher.
 *
 *  STAGE 2 – Enrichment (Anthropic Claude claude-sonnet-4-6 via OpenRouter)
 *    For the top-ranked 15 candidates, generate per-job insights:
 *    matchReasons, skillGaps, aiSummary, isHotJob, hotSignals, companyStage.
 *
 *  STAGE 3 – Final ranking + selection
 *    Composite score: matchScore × 0.50 + freshnessScore × 0.20 +
 *    qualityScore × 0.20 + hotJobBonus × 0.10
 *    Remote jobs get an additional +8 applied before final sort.
 *    Pick top-N based on plan limit.
 */

import type { DiscoveredJob, CallAIFn } from './jobResearcher';
import type { DailyJob } from '../types/dailyJob';

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
// Scoring helpers
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
    case 'perplexity':      return 95;
    case 'gemini-fallback': return 80;
    default:                return 70;
  }
}

function remoteBonus(workType: string): number {
  return workType === 'remote' ? 8 : workType === 'hybrid' ? 3 : 0;
}

function keywordMatchScore(job: DiscoveredJob, careerPaths: string[], resumeText: string): number {
  const haystack = `${job.title} ${job.description} ${job.requirements.join(' ')}`.toLowerCase();
  const pathKeywords = careerPaths.flatMap((p) => p.toLowerCase().split(/\s+/));
  const skillKeywords = (resumeText.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).slice(0, 40);

  let score = 40;
  if (pathKeywords.some((kw) => job.title.toLowerCase().includes(kw))) score += 35;
  let skillHits = 0;
  for (const kw of skillKeywords) {
    if (haystack.includes(kw)) skillHits++;
  }
  score += Math.min(25, skillHits * 3);
  return Math.min(100, score);
}

function compositeScore(matchScore: number, days: number, source: string, isHot: boolean, workType: string): number {
  return (
    matchScore                  * 0.50 +
    freshnessScore(days)        * 0.20 +
    sourceQualityScore(source)  * 0.20 +
    (isHot ? 10 : 0)            * 0.10 +
    remoteBonus(workType)
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
  jobs: DiscoveredJob[],
  careerPaths: string[],
  resumeText: string,
  jobType: string,
  callAI: CallAIFn
): Promise<ScoredJob[]> {
  const jobList = jobs
    .map(
      (j, i) =>
        `[${i}] ${j.title} @ ${j.company} | ${j.location} | ${j.workType}` +
        (j.matchedCareerPath ? ` | Target: ${j.matchedCareerPath}` : '') +
        `\nRequirements: ${j.requirements.slice(0, 5).join(', ')}\n` +
        `Description (first 350 chars): ${j.description.slice(0, 350)}`
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
For each job [index], assign a matchScore (0–100) measuring fit for this candidate.

Scoring rules:
- 90–100: Exceptional fit — title matches career goal, core skills align, correct work type
- 70–89 : Good fit — strong overlap, minor gaps
- 50–69 : Partial fit — some relevant overlap
- 30–49 : Weak fit — role adjacent but key gaps
- 0–29  : Poor fit — wrong domain, seniority, or work type

Return ONLY a JSON array:
[{"index": 0, "matchScore": 85}, {"index": 1, "matchScore": 72}, ...]

Include ALL ${jobs.length} entries. No explanation.`;

  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'google/gemini-2.5-pro-preview-03-25'
    );
    const parsed = parseJson<ScoredJob[]>(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.error('[jobMatchingEngine] Batch scoring failed:', err);
  }

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
  job: DiscoveredJob,
  matchScore: number,
  careerPaths: string[],
  resumeText: string,
  callAI: CallAIFn
): Promise<JobInsights> {
  const careerPathContext = job.matchedCareerPath
    ? `Specifically matched against career path: "${job.matchedCareerPath}"`
    : `Career goals: ${careerPaths.join(', ')}`;

  const prompt = `You are a concise career advisor. Analyze this remote job listing for the candidate.

## Job
Title: ${job.title}
Company: ${job.company}
Location: ${job.location} (${job.workType})
Salary: ${job.salary || 'Not listed'}
Requirements: ${job.requirements.join(', ')}
Description:
${job.description.slice(0, 2000)}

## Candidate
${careerPathContext}
Resume summary (first 800 chars):
${resumeText.slice(0, 800)}

## Return JSON only (no other text):
{
  "matchReasons": ["3–5 specific reasons why this fits the candidate — cite real evidence from job and resume"],
  "skillGaps": ["2–4 skills required by the job not evident in the resume"],
  "aiSummary": "2-sentence plain-English summary of the role and why it's relevant to this candidate",
  "isHotJob": true or false,
  "hotSignals": ["evidence of fast growth, urgency, or notable company momentum — omit if none"],
  "companyStage": "Startup | Scale-up | Enterprise | Unknown",
  "estimatedSalary": "$X–$Y/yr (only if not already listed above, else omit this field)"
}

Be specific and evidence-based. No generic filler. No invented data.`;

  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'anthropic/claude-sonnet-4-6'
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

  return {
    matchReasons: [
      job.matchedCareerPath
        ? `Related to your "${job.matchedCareerPath}" career goal`
        : careerPaths[0]
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

function buildDailyJob(raw: DiscoveredJob, matchScore: number, insights: JobInsights): DailyJob {
  const fScore = Math.round(
    compositeScore(matchScore, raw.daysOld ?? 0, raw.source, insights.isHotJob, raw.workType)
  );

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
    finalScore: fScore,
    matchReasons: insights.matchReasons,
    skillGaps: insights.skillGaps,
    aiSummary: insights.aiSummary,
    isHotJob: insights.isHotJob,
    hotSignals: insights.hotSignals,
    companyStage: insights.companyStage,
    estimatedSalary: insights.estimatedSalary,
    matchedCareerPath: raw.matchedCareerPath,
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
  limit?: number;
  minMatchScore?: number;
}

export interface MatchResult {
  jobs: DailyJob[];
  usedFallback: boolean;
  enrichedCount: number;
  scoredCount: number;
}

/**
 * Full pipeline: score → filter seen → enrich top-N → rank → slice.
 * Remote jobs receive a scoring bonus so they surface above equivalent non-remote matches.
 */
export async function matchAndRankJobs(
  discoveredJobs: DiscoveredJob[],
  opts: MatchOptions,
  callAI: CallAIFn
): Promise<MatchResult> {
  const {
    careerPaths,
    resumeText,
    jobType = 'remote',
    seenFingerprints = [],
    limit = 10,
    minMatchScore = 25,
  } = opts;

  const seenSet = new Set(seenFingerprints);
  let usedFallback = false;

  const unseenJobs = discoveredJobs.filter((j) => !seenSet.has(j.fingerprint));

  // Stage 1: Batch score all unseen jobs
  const scores = await batchScoreJobs(unseenJobs, careerPaths, resumeText, jobType, callAI);

  const scored = unseenJobs
    .map((job, idx) => ({
      job,
      matchScore: scores[idx]?.matchScore ?? keywordMatchScore(job, careerPaths, resumeText),
    }))
    .filter(({ matchScore }) => matchScore >= minMatchScore)
    .sort((a, b) => b.matchScore - a.matchScore);

  // Backfill from seen jobs if not enough
  let backfillJobs: typeof scored = [];
  if (scored.length < limit) {
    const seenJobs = discoveredJobs.filter((j) => seenSet.has(j.fingerprint));
    if (seenJobs.length > 0) {
      const seenScores = await batchScoreJobs(seenJobs, careerPaths, resumeText, jobType, callAI);
      backfillJobs = seenJobs
        .map((job, idx) => ({
          job,
          matchScore: seenScores[idx]?.matchScore ?? keywordMatchScore(job, careerPaths, resumeText),
        }))
        .sort((a, b) => b.matchScore - a.matchScore);
      if (backfillJobs.length > 0) usedFallback = true;
    }
  }

  const candidates = [...scored, ...backfillJobs].slice(0, Math.min(Math.max(limit, 10), 15));

  // Stage 2: Enrich top candidates — all in parallel to minimize wall-clock time
  const enriched: DailyJob[] = [];
  const enrichResults = await Promise.allSettled(
    candidates.map(({ job, matchScore }) =>
      enrichJob(job, matchScore, careerPaths, resumeText, callAI).then((insights) =>
        buildDailyJob(job, matchScore, insights)
      )
    )
  );
  for (const res of enrichResults) {
    if (res.status === 'fulfilled') enriched.push(res.value);
  }

  // Stage 3: Final sort by composite finalScore (remote bonus already baked in)
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
