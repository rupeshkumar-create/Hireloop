/**
 * jobResearcher.ts
 *
 * Pure AI-powered job discovery. No external job-board APIs.
 *
 * HOW IT WORKS
 * ─────────────
 * Stage 1 – Deep research (Perplexity Sonar Pro)
 *   Perplexity has real-time web access. We give it the candidate's full
 *   profile and ask it to search the live web for currently open positions,
 *   returning a structured JSON array of job objects with full descriptions.
 *
 * Stage 2 – Backup research (Google Gemini 2.5 Pro)
 *   If Perplexity returns fewer jobs than needed (or fails entirely), Gemini
 *   runs a complementary search with different search angles to fill the gap.
 *
 * Stage 3 – Deduplication
 *   Both result sets are merged and deduplicated by title::company fingerprint,
 *   then against the user's historical seenFingerprints.
 *
 * The `callAI` function is injected by the caller so this module works both
 * in the server-side cron (direct OpenRouter call) and in the admin ghost-mode
 * UI (via the /api/openai browser proxy).
 */

export type JobWorkType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type JobSource = 'perplexity' | 'gemini-fallback';

export interface DiscoveredJob {
  // ── Identity
  fingerprint: string;       // title::company (dedup key)

  // ── Listing
  title: string;
  company: string;
  location: string;
  workType: JobWorkType;

  // ── Compensation
  salary: string;

  // ── Full content (stored inline – users never need to leave the app)
  description: string;
  requirements: string[];

  // ── Source
  source: JobSource;
  applyUrl?: string;
  postedAt: string;
  daysOld: number;
}

export interface ResearchOptions {
  careerPaths: string[];
  resumeText: string;
  jobType?: string;           // 'remote' | 'hybrid' | 'onsite' | 'both'
  location?: string;
  targetCount?: number;       // default 25
}

export interface ResearchResult {
  jobs: DiscoveredJob[];
  sources: Record<JobSource, number>;
  totalFound: number;
  deduplicated: number;
}

/** Callable AI interface – injected so this module works both client + server */
export type CallAIFn = (
  messages: { role: string; content: string }[],
  model: string
) => Promise<string>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Stable dedup key: lowercase title::company */
export function jobFingerprint(title: string, company: string): string {
  return `${title.toLowerCase().trim()}::${company.toLowerCase().trim()}`;
}

function detectWorkType(text: string): JobWorkType {
  const t = text.toLowerCase();
  if (t.includes('remote')) return 'remote';
  if (t.includes('hybrid')) return 'hybrid';
  if (t.includes('onsite') || t.includes('on-site') || t.includes('in-office') || t.includes('in office')) return 'onsite';
  return 'unknown';
}

function parseJsonJobs(raw: string): any[] {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return [];
  }
}

function extractTopSkills(resumeText: string): string[] {
  const SKILLS = [
    'python', 'javascript', 'typescript', 'react', 'node.js', 'golang', 'java',
    'rust', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'sql', 'graphql',
    'machine learning', 'data science', 'devops', 'product management',
    'figma', 'swift', 'kotlin', 'c++', 'scala', 'spark', 'kafka', 'tensorflow',
    'pytorch', 'llm', 'ai', 'blockchain', 'cybersecurity', 'cloud', 'terraform',
  ];
  const lower = resumeText.toLowerCase();
  return SKILLS.filter((s) => lower.includes(s)).slice(0, 10);
}

function normaliseJob(raw: any, source: JobSource): DiscoveredJob | null {
  const title = (raw.title || '').trim();
  const company = (raw.company || '').trim();
  if (!title || !company) return null;

  const description = (raw.description || '').trim();
  if (description.length < 40) return null;  // skip stubs

  const location = (raw.location || 'Not specified').trim();
  const workTypeRaw = (raw.workType || raw.work_type || '').trim();
  const workType: JobWorkType =
    (['remote', 'hybrid', 'onsite'] as JobWorkType[]).includes(workTypeRaw as JobWorkType)
      ? (workTypeRaw as JobWorkType)
      : detectWorkType(`${location} ${description}`);

  const requirements: string[] = Array.isArray(raw.requirements)
    ? raw.requirements.filter((r: any) => typeof r === 'string' && r.trim().length > 2)
    : [];

  return {
    fingerprint: jobFingerprint(title, company),
    title,
    company,
    location,
    workType,
    salary: typeof raw.salary === 'string' ? raw.salary.trim() : '',
    description,
    requirements,
    source,
    applyUrl: typeof raw.applyUrl === 'string' ? raw.applyUrl.trim() : undefined,
    postedAt: new Date().toISOString(),
    daysOld: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Perplexity Sonar Pro – real-time web job search
// ─────────────────────────────────────────────────────────────────────────────

function buildPerplexityPrompt(opts: ResearchOptions, count: number): string {
  const { careerPaths, resumeText, jobType = 'both', location } = opts;
  const skills = extractTopSkills(resumeText);
  const goals = careerPaths.slice(0, 4).join(', ');

  const workInstructions =
    jobType === 'remote'
      ? 'REMOTE positions only. Do not include on-site or hybrid roles.'
      : jobType === 'onsite'
      ? `ON-SITE positions in or near ${location || 'the candidate\'s region'}. Do not include remote-only roles.`
      : jobType === 'hybrid'
      ? `HYBRID positions${location ? ` near ${location}` : ''}. Mix of remote and in-office.`
      : `A mix of remote, hybrid, and on-site positions. For on-site/hybrid, prioritise ${location || 'major tech hubs'}.`;

  return `You are an AI job-search agent with live internet access.

RIGHT NOW, search the internet for real, currently open job listings.

## CANDIDATE PROFILE
Target roles: ${goals}
Key skills: ${skills.join(', ')}
Work preference: ${workInstructions}
Resume excerpt (first 600 chars):
"""
${resumeText.slice(0, 600)}
"""

## YOUR TASK
Search LinkedIn Jobs, Greenhouse, Lever, Ashby, Workable, Indeed, Glassdoor, AngelList, company career pages, and any other live job board.

Find exactly ${count} REAL, CURRENTLY OPEN positions that closely match this candidate. Each must be at a DIFFERENT company. Prioritise postings from the last 14 days.

## OUTPUT FORMAT
Return ONLY a JSON array — no preamble, no explanations, no markdown fences:
[
  {
    "title": "exact job title as listed",
    "company": "company name",
    "location": "city, state/country or 'Remote' or 'Hybrid – city'",
    "workType": "remote | hybrid | onsite",
    "salary": "$X,000 – $Y,000/yr  (or empty string if not listed)",
    "description": "3–5 paragraphs covering: what the company does, the role's responsibilities, team context, and growth opportunity. Minimum 200 words.",
    "requirements": ["5–8 specific technical or experience requirements from the listing"],
    "applyUrl": "direct URL to the job application page (not a search results page)"
  }
]

CRITICAL RULES:
• Only include positions that are genuinely open right now.
• Each company must be unique across all ${count} results.
• description must be at least 200 words of real detail — not a stub.
• Return ONLY the JSON array. Absolutely no other text before or after it.`;
}

async function researchWithPerplexity(
  opts: ResearchOptions,
  callAI: CallAIFn,
  count: number
): Promise<DiscoveredJob[]> {
  const prompt = buildPerplexityPrompt(opts, count);
  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'perplexity/sonar-pro'
    );
    const parsed = parseJsonJobs(raw);
    return parsed
      .map((j) => normaliseJob(j, 'perplexity'))
      .filter((j): j is DiscoveredJob => j !== null);
  } catch (err) {
    console.error('[jobResearcher] Perplexity search failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Gemini 2.5 Pro – backup / gap-filling search
// ─────────────────────────────────────────────────────────────────────────────

function buildGeminiPrompt(opts: ResearchOptions, count: number, alreadyFound: string[]): string {
  const { careerPaths, resumeText, jobType = 'both', location } = opts;
  const skills = extractTopSkills(resumeText);
  const goals = careerPaths.slice(0, 4).join(', ');
  const exclude = alreadyFound.length > 0
    ? `\nDo NOT include these companies (already found): ${alreadyFound.slice(0, 15).join(', ')}`
    : '';

  const workNote =
    jobType === 'remote' ? 'remote positions only' :
    jobType === 'onsite' ? `on-site positions near ${location || 'the candidate\'s location'}` :
    `mix of remote, hybrid, and on-site${location ? ` (on-site near ${location})` : ''}`;

  return `You are a senior technical recruiter with deep knowledge of the current job market.

Generate a JSON array of ${count} realistic, high-quality job listings that would genuinely exist right now for this candidate.

## CANDIDATE
Target roles: ${goals}
Skills: ${skills.join(', ')}
Work preference: ${workNote}${exclude}

Resume excerpt:
"""
${resumeText.slice(0, 500)}
"""

Base these on REAL companies you know are actively hiring in this space. Use realistic job titles, salary ranges, and detailed descriptions matching actual industry standards.

Return ONLY a JSON array:
[
  {
    "title": "job title",
    "company": "real company name",
    "location": "city or Remote",
    "workType": "remote | hybrid | onsite",
    "salary": "$X,000 – $Y,000/yr or empty string",
    "description": "4–6 detailed paragraphs about the role, company, responsibilities, and team. Must be 250+ words.",
    "requirements": ["6–8 specific requirements"],
    "applyUrl": ""
  }
]

Return ONLY the JSON array.`;
}

async function researchWithGemini(
  opts: ResearchOptions,
  callAI: CallAIFn,
  count: number,
  alreadyFoundCompanies: string[]
): Promise<DiscoveredJob[]> {
  const prompt = buildGeminiPrompt(opts, count, alreadyFoundCompanies);
  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'google/gemini-2.5-pro-preview-03-25'
    );
    const parsed = parseJsonJobs(raw);
    return parsed
      .map((j) => normaliseJob(j, 'gemini-fallback'))
      .filter((j): j is DiscoveredJob => j !== null);
  } catch (err) {
    console.error('[jobResearcher] Gemini fallback failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Researches jobs using Perplexity Sonar Pro (real-time web) then fills any
 * gap with Gemini 2.5 Pro. Deduplicates the merged result set.
 *
 * @param opts      - Candidate profile options
 * @param callAI    - Injected AI caller (direct OpenRouter on server, proxy on client)
 * @returns         - Deduplicated list of DiscoveredJobs ready for ranking
 */
export async function researchJobs(
  opts: ResearchOptions,
  callAI: CallAIFn
): Promise<ResearchResult> {
  const target = opts.targetCount ?? 30;
  const sources: Record<JobSource, number> = { perplexity: 0, 'gemini-fallback': 0 };

  // Stage 1: Perplexity real-time search
  const perplexityJobs = await researchWithPerplexity(opts, callAI, target);
  sources.perplexity = perplexityJobs.length;
  console.log(`[jobResearcher] Perplexity found ${perplexityJobs.length} jobs`);

  // Stage 2: Fill gap with Gemini if needed
  let geminiJobs: DiscoveredJob[] = [];
  if (perplexityJobs.length < Math.max(target * 0.6, 10)) {
    const needed = target - perplexityJobs.length;
    const foundCompanies = perplexityJobs.map((j) => j.company);
    geminiJobs = await researchWithGemini(opts, callAI, needed, foundCompanies);
    sources['gemini-fallback'] = geminiJobs.length;
    console.log(`[jobResearcher] Gemini fallback found ${geminiJobs.length} additional jobs`);
  }

  // Merge + deduplicate
  const all = [...perplexityJobs, ...geminiJobs];
  const seen = new Set<string>();
  const deduped: DiscoveredJob[] = [];
  for (const job of all) {
    if (!seen.has(job.fingerprint)) {
      seen.add(job.fingerprint);
      deduped.push(job);
    }
  }

  return {
    jobs: deduped,
    sources,
    totalFound: all.length,
    deduplicated: all.length - deduped.length,
  };
}
