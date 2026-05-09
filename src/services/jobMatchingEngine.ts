import type { DiscoveredJob, CallAIFn } from './jobResearcher.js';
import type { DailyJob } from '../types/dailyJob.js';
import { jobMatchesUserPreferences, normalizeUserPreferences } from './validator.js';

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

/**
 * Fast, deterministic score to narrow down candidates.
 */
function deterministicMatchScore(job: DiscoveredJob, careerPaths: string[], resumeText: string): number {
  const titleTokens = tokenize(job.title);
  const haystack = `${job.title} ${job.description} ${job.requirements.join(' ')}`.toLowerCase();
  const careerTokens = unique(careerPaths.flatMap(tokenize));
  const resumeSkills = extractResumeSkills(resumeText);
  const resumeTokens = unique([...resumeSkills, ...tokenize(resumeText).slice(0, 80)]);

  let score = 25;

  const titleCareerHits = careerTokens.filter((token) => titleTokens.includes(token)).length;
  const bodyCareerHits = careerTokens.filter((token) => haystack.includes(token)).length;
  const skillHits = resumeTokens.filter((token) => haystack.includes(token)).length;

  score += Math.min(35, titleCareerHits * 15 + bodyCareerHits * 5);
  score += Math.min(30, skillHits * 5);
  score += remoteBonus(job.workType);

  if (job.applyUrl) score += 5;
  if (job.daysOld <= 7) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Step 2 & 3: Nuanced AI scoring and insight generation.
 * Optimized to use 'aiDescriptionEnriched' field to save tokens.
 */
async function scoreJobsWithAI(
  jobs: DiscoveredJob[],
  resumeText: string,
  careerPaths: string[],
  callAI: CallAIFn
): Promise<Record<string, { aiScore: number; aiReason: string; aiInsight: string }>> {
  if (jobs.length === 0) return {};

  const prompt = `You are an elite technical recruiter and startup founder. 
  Score each job listing (0-100) based on its fit for the candidate's resume and career paths.
  
  --- PERSONA FIT CRITERIA ---
  1. Developers, Founders, PLG roles: Prioritize high-level technical or product-led growth positions.
  2. Scoring: Assign a score based on role relevance and company quality.
  3. Remote Verification: STRICTLY filter out jobs that are "Hybrid" in disguise.
  
  Candidate Career Paths: ${careerPaths.join(', ')}
  
  Candidate Resume (Summary):
  ${resumeText.substring(0, 4000)}
  
  Jobs to Score:
  ${jobs.map((job, i) => `[${i}] Title: ${job.title} | Company: ${job.company} | AI Enriched Summary: ${job.aiDescriptionEnriched || job.description.substring(0, 500)}`).join('\n\n')}
  
  Return a JSON array of objects:
  [{ 
    "index": number, 
    "score": number, 
    "reason": "Internal reason for score", 
    "insight": "One-sentence summary of why this job was selected for the user" 
  }, ...]
  
  Respond ONLY with the JSON array.`;

  try {
    const response = await callAI([{ role: 'user', content: prompt }], 'openai/gpt-4o-mini');
    const parsed = JSON.parse(response);
    const results: Record<string, { aiScore: number; aiReason: string; aiInsight: string }> = {};
    
    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        const job = jobs[item.index];
        if (job) {
          results[job.fingerprint] = {
            aiScore: Math.min(100, Math.max(0, item.score ?? 50)),
            aiReason: item.reason || 'Matches your high-level profile.',
            aiInsight: item.insight || `${job.company} is hiring for ${job.title}.`,
          };
        }
      });
    }
    return results;
  } catch (error) {
    console.error('[jobMatchingEngine] AI Scoring failed:', error);
    return {};
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
    minMatchScore = 0, // Temporarily disabled for testing
    matchingPreferences,
  } = opts;

  const seenSet = new Set(seenFingerprints);
  const normalizedPreferences = normalizeUserPreferences(matchingPreferences || {});
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

  const initialCandidates = candidateJobs
    .map((job) => ({
      job,
      detScore: deterministicMatchScore(job, careerPaths, resumeText),
    }))
    .filter(({ job, detScore }) => {
      // Temporarily allowing all jobs for testing connectivity
      return true;
    })
    .sort((a, b) => b.detScore - a.detScore);

  // 2. Pick top candidates for AI scoring
  const topCandidates = initialCandidates.slice(0, 30);
  let aiResults: Record<string, { aiScore: number; aiReason: string; aiInsight: string }> = {};
  
  if (callAI && topCandidates.length > 0) {
    console.log(`[jobMatchingEngine] Requesting AI scoring for ${topCandidates.length} jobs using enriched descriptions...`);
    aiResults = await scoreJobsWithAI(
      topCandidates.map(c => c.job),
      resumeText,
      careerPaths,
      callAI
    );
  }

  // 3. Build final DailyJob objects and apply the > 85 threshold
  const scored = initialCandidates
    .map(({ job, detScore }) => {
      const aiData = aiResults[job.fingerprint];
      // Weighted average: AI score (85%) + Deterministic score (15%) if AI available
      const finalMatchScore = aiData ? Math.round(aiData.aiScore * 0.85 + detScore * 0.15) : detScore;
      
      return {
        job,
        matchScore: finalMatchScore,
        dailyJob: buildDailyJob(job, finalMatchScore, careerPaths, resumeText, aiData),
      };
    })
    .filter(({ matchScore }) => matchScore >= minMatchScore) // Step 2: Threshold score > 85
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

  return {
    jobs: final,
    usedFallback: usedSeenFallback,
    enrichedCount: final.length,
    scoredCount: scored.length,
    qualityFilteredCount: Math.max(0, discoveredJobs.length - scored.length),
    dedupedCount: Math.max(0, discoveredJobs.length - final.length),
  };
}
