/**
 * jobResearcher.ts — Remote-First Job Discovery
 *
 * Strategy (rebuilt from scratch):
 *
 * 1. For each career path (up to 3), run a dedicated Perplexity Sonar Pro
 *    search targeting REMOTE positions for that specific role. Searches run
 *    in parallel so total wall-clock time ≈ one search.
 *
 * 2. Each discovered job is tagged with the `matchedCareerPath` that found it,
 *    so the UI can show "matched via: Senior Frontend Engineer" chips.
 *
 * 3. Merge + deduplicate by title::company fingerprint, then against the
 *    user's historical seenFingerprints.
 *
 * 4. If the total is still below 60% of target, Gemini 2.5 Pro fills the gap
 *    with a complementary remote-focused search.
 *
 * Default work type is "remote". Pass jobType="both" to include hybrid/onsite.
 */

export type JobWorkType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type JobSource = 'perplexity' | 'gemini-fallback';

export interface DiscoveredJob {
  fingerprint: string;
  title: string;
  company: string;
  location: string;
  workType: JobWorkType;
  salary: string;
  description: string;
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
  jobType?: string;     // 'remote' | 'hybrid' | 'onsite' | 'both' — defaults to 'remote'
  location?: string;
  targetCount?: number; // default 30
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function extractTopSkills(resumeText: string): string[] {
  const lower = resumeText.toLowerCase();
  return SKILL_LIST.filter((s) => lower.includes(s)).slice(0, 12);
}

function normaliseJob(raw: any, source: JobSource, matchedCareerPath?: string): DiscoveredJob | null {
  const title = (raw.title || '').trim();
  const company = (raw.company || '').trim();
  if (!title || !company) return null;

  const description = (raw.description || '').trim();
  if (description.length < 40) return null;

  const location = (raw.location || 'Remote').trim();
  const workTypeRaw = (raw.workType || raw.work_type || '').trim().toLowerCase();
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
    matchedCareerPath,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Work-type instruction builder
// ─────────────────────────────────────────────────────────────────────────────

function buildWorkInstruction(jobType: string, location?: string): string {
  switch (jobType) {
    case 'remote':
      return 'REMOTE ONLY. Every single result must be a fully remote position. Do not include hybrid or on-site roles under any circumstances.';
    case 'onsite':
      return `ON-SITE positions in or near ${location || 'the candidate\'s region'}. Do not include remote-only roles.`;
    case 'hybrid':
      return `HYBRID positions${location ? ` near ${location}` : ''}. Mix of remote and in-office acceptable.`;
    default:
      return `Prefer REMOTE positions first, then hybrid. For on-site, only include${location ? ` near ${location}` : ' major tech hubs'}.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1-A: Per-career-path Perplexity search
// ─────────────────────────────────────────────────────────────────────────────

function buildPerPathPerplexityPrompt(
  careerPath: string,
  opts: ResearchOptions,
  count: number,
  excludeCompanies: string[]
): string {
  const { resumeText, jobType = 'remote', location } = opts;
  const skills = extractTopSkills(resumeText);
  const workInstruction = buildWorkInstruction(jobType, location);
  const exclusion = excludeCompanies.length > 0
    ? `\nDo NOT include these companies (already found): ${excludeCompanies.slice(0, 20).join(', ')}`
    : '';

  return `You are an AI job-search agent with live real-time internet access.

RIGHT NOW, search the live internet for currently open job listings.

## TARGET ROLE
Career path: ${careerPath}
Key skills from resume: ${skills.join(', ')}
Work requirement: ${workInstruction}${exclusion}

Resume context (first 500 chars):
"""
${resumeText.slice(0, 500)}
"""

## YOUR TASK
Search LinkedIn Jobs, Greenhouse, Lever, Ashby, Workable, Indeed, Glassdoor, Wellfound (AngelList), We Work Remotely, Remote.co, company career pages, and any live job board.

Find exactly ${count} REAL, CURRENTLY OPEN "${careerPath}" positions. Each must be at a DIFFERENT company. Prioritise postings from the last 14 days.

## OUTPUT FORMAT
Return ONLY a JSON array with no preamble, no markdown, no explanation:
[
  {
    "title": "exact job title as listed",
    "company": "company name",
    "location": "Remote" or "Remote – US" or "Hybrid – city, country",
    "workType": "remote",
    "salary": "$X,000 – $Y,000/yr  (empty string if not listed)",
    "description": "4–6 paragraphs: what the company does, the role responsibilities, team context, growth opportunity. MINIMUM 200 words of real detail.",
    "requirements": ["6–8 specific technical or experience requirements taken directly from the listing"],
    "applyUrl": "direct URL to the job application page (not a search results page)"
  }
]

CRITICAL:
• Only include genuinely open positions.
• Each company must be unique.
• description must be 200+ words of real detail — not a stub or placeholder.
• Return ONLY the JSON array. No text before or after.`;
}

async function researchCareerPathWithPerplexity(
  careerPath: string,
  opts: ResearchOptions,
  callAI: CallAIFn,
  count: number,
  excludeCompanies: string[]
): Promise<DiscoveredJob[]> {
  const prompt = buildPerPathPerplexityPrompt(careerPath, opts, count, excludeCompanies);
  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'perplexity/sonar-pro'
    );
    const parsed = parseJsonJobs(raw);
    return parsed
      .map((j) => normaliseJob(j, 'perplexity', careerPath))
      .filter((j): j is DiscoveredJob => j !== null);
  } catch (err) {
    console.error(`[jobResearcher] Perplexity search failed for "${careerPath}":`, err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1-B: Single broad Perplexity search (fallback when no career paths set)
// ─────────────────────────────────────────────────────────────────────────────

function buildBroadPerplexityPrompt(opts: ResearchOptions, count: number): string {
  const { resumeText, jobType = 'remote', location } = opts;
  const skills = extractTopSkills(resumeText);
  const workInstruction = buildWorkInstruction(jobType, location);

  return `You are an AI job-search agent with live real-time internet access.

RIGHT NOW, search the live internet for currently open job listings.

## CANDIDATE PROFILE
Key skills: ${skills.join(', ')}
Work requirement: ${workInstruction}

Resume (first 600 chars):
"""
${resumeText.slice(0, 600)}
"""

## YOUR TASK
Search LinkedIn Jobs, Greenhouse, Lever, Ashby, Workable, Indeed, Glassdoor, Wellfound, We Work Remotely, Remote.co, and company career pages.

Find exactly ${count} REAL, CURRENTLY OPEN positions that match this candidate. Each must be at a DIFFERENT company. Prioritise postings from the last 14 days.

## OUTPUT FORMAT
Return ONLY a JSON array:
[
  {
    "title": "exact job title",
    "company": "company name",
    "location": "Remote" or "Remote – US" or city,
    "workType": "remote | hybrid | onsite",
    "salary": "$X,000 – $Y,000/yr or empty string",
    "description": "4–6 paragraphs of real detail, 200+ words minimum.",
    "requirements": ["6–8 specific requirements from the listing"],
    "applyUrl": "direct application URL"
  }
]

Return ONLY the JSON array.`;
}

async function researchBroadWithPerplexity(
  opts: ResearchOptions,
  callAI: CallAIFn,
  count: number
): Promise<DiscoveredJob[]> {
  const prompt = buildBroadPerplexityPrompt(opts, count);
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
    console.error('[jobResearcher] Broad Perplexity search failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Gemini 2.5 Pro gap-filler
// ─────────────────────────────────────────────────────────────────────────────

function buildGeminiFillPrompt(
  opts: ResearchOptions,
  count: number,
  alreadyFoundCompanies: string[]
): string {
  const { careerPaths, resumeText, jobType = 'remote', location } = opts;
  const skills = extractTopSkills(resumeText);
  const goals = careerPaths.slice(0, 4).join(', ') || 'software engineering';
  const workNote = jobType === 'remote'
    ? 'fully remote positions only'
    : jobType === 'onsite'
    ? `on-site positions near ${location || 'candidate location'}`
    : `remote-first, then hybrid${location ? ` near ${location}` : ''}`;
  const exclude = alreadyFoundCompanies.length > 0
    ? `\nDo NOT include: ${alreadyFoundCompanies.slice(0, 25).join(', ')}`
    : '';

  return `You are a senior technical recruiter with deep knowledge of current job market.

Generate a JSON array of ${count} high-quality job listings that genuinely exist right now for this candidate.

## CANDIDATE
Target roles: ${goals}
Skills: ${skills.join(', ')}
Work preference: ${workNote}${exclude}

Resume excerpt:
"""
${resumeText.slice(0, 500)}
"""

Base these on REAL companies actively hiring in this space. Use realistic titles, salaries, and detailed descriptions matching actual industry standards.

Return ONLY a JSON array:
[
  {
    "title": "job title",
    "company": "real company name that is known to hire remotely",
    "location": "Remote" or "Remote – US/EU",
    "workType": "remote",
    "salary": "$X,000 – $Y,000/yr or empty string",
    "description": "5–7 detailed paragraphs about the role, company, responsibilities, team. Must be 250+ words.",
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
  const prompt = buildGeminiFillPrompt(opts, count, alreadyFoundCompanies);
  try {
    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      'google/gemini-2.5-pro-preview-03-25'
    );
    const parsed = parseJsonJobs(raw);
    const careerPath = opts.careerPaths[0]; // best-guess path for Gemini results
    return parsed
      .map((j) => normaliseJob(j, 'gemini-fallback', careerPath))
      .filter((j): j is DiscoveredJob => j !== null);
  } catch (err) {
    console.error('[jobResearcher] Gemini gap-fill failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateJobs(jobs: DiscoveredJob[]): DiscoveredJob[] {
  const seen = new Set<string>();
  const result: DiscoveredJob[] = [];
  for (const job of jobs) {
    if (!seen.has(job.fingerprint)) {
      seen.add(job.fingerprint);
      result.push(job);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remote-first job discovery.
 *
 * - Runs one focused Perplexity search per career path (max 3) in parallel.
 * - Each job is tagged with `matchedCareerPath` for UI display.
 * - Gemini 2.5 Pro fills any gap if Perplexity returns < 60% of target.
 * - Default jobType is 'remote' — override via opts.jobType.
 */
export async function researchJobs(
  opts: ResearchOptions,
  callAI: CallAIFn
): Promise<ResearchResult> {
  const target = opts.targetCount ?? 30;
  const jobType = opts.jobType || 'remote';
  const effectiveOpts: ResearchOptions = { ...opts, jobType };

  const sources: Record<JobSource, number> = { perplexity: 0, 'gemini-fallback': 0 };
  let perplexityJobs: DiscoveredJob[] = [];

  const paths = (opts.careerPaths || []).filter(Boolean).slice(0, 3);

  if (paths.length === 0) {
    // No career paths — fall back to resume-only broad search
    perplexityJobs = await researchBroadWithPerplexity(effectiveOpts, callAI, target);
    console.log(`[jobResearcher] Broad search found ${perplexityJobs.length} jobs`);
  } else {
    // Parallel per-career-path searches
    const jobsPerPath = Math.ceil(target / paths.length);

    const searchResults = await Promise.allSettled(
      paths.map((path, idx) => {
        // Stagger start slightly to avoid rate-limit bursts (250ms apart)
        return new Promise<DiscoveredJob[]>((resolve) => {
          setTimeout(async () => {
            const excludeFromPriorPaths: string[] = [];
            resolve(await researchCareerPathWithPerplexity(path, effectiveOpts, callAI, jobsPerPath, excludeFromPriorPaths));
          }, idx * 250);
        });
      })
    );

    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        perplexityJobs.push(...result.value);
      }
    }

    console.log(`[jobResearcher] Per-path search (${paths.length} paths) found ${perplexityJobs.length} total jobs`);
  }

  // Deduplicate Perplexity results across paths
  perplexityJobs = deduplicateJobs(perplexityJobs);
  sources.perplexity = perplexityJobs.length;

  // Gap-fill with Gemini if needed
  let geminiJobs: DiscoveredJob[] = [];
  if (perplexityJobs.length < Math.max(target * 0.6, 8)) {
    const needed = target - perplexityJobs.length;
    const foundCompanies = perplexityJobs.map((j) => j.company);
    geminiJobs = await researchWithGemini(effectiveOpts, callAI, needed, foundCompanies);
    sources['gemini-fallback'] = geminiJobs.length;
    console.log(`[jobResearcher] Gemini gap-fill added ${geminiJobs.length} jobs`);
  }

  const all = [...perplexityJobs, ...geminiJobs];
  const deduped = deduplicateJobs(all);

  return {
    jobs: deduped,
    sources,
    totalFound: all.length,
    deduplicated: all.length - deduped.length,
  };
}
