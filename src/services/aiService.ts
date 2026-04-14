import { SerperJob, searchRemoteJobs, jobFingerprint } from './serperService';

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
    'node.js',
    'typescript',
    'javascript',
    'react',
    'python',
    'aws',
    'postgresql',
    'docker',
    'kubernetes',
    'graphql',
    'firebase',
    'java',
    'golang',
    'next.js',
  ];

  const lowerResume = resumeText.toLowerCase();
  const matched = skillCandidates.filter((skill) => lowerResume.includes(skill));
  return matched.slice(0, 4);
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

function buildDeterministicQueries(careerPaths: string[], resumeText: string, minSalary: number | null): string[] {
  const skills = extractSkills(resumeText);
  const primarySkill = skills[0] || 'typescript';
  const secondarySkill = skills[1] || 'react';
  const salaryClause = minSalary ? ` salary ${minSalary}` : '';
  const atsClause = '(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workable.com OR site:jobs.workday.com)';

  return careerPaths.slice(0, 5).map((path) =>
    `remote "${path}" "${primarySkill}" "${secondarySkill}" ${atsClause}${salaryClause}`.trim()
  );
}

function buildExpansionQueries(careerPaths: string[], resumeText: string): string[] {
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
  for (const title of [...titleSeeds, ...synonyms]) {
    for (const domain of domains) {
      generated.push(`remote "${title}" "${primarySkill}" "${secondarySkill}" ${domain}`);
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
  };
}

function buildFallbackRankedJobs(jobs: SerperJob[], limit: number): RankedJob[] {
  return jobs
    .map((job) => {
      const freshnessScore = getFreshnessScore(job.daysOld || 0);
      const atsQualityScore = getAtsQualityScore(job.applyLink);
      const finalScore = freshnessScore * 0.6 + atsQualityScore * 0.4;

      return {
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary || 'Competitive',
        description: job.description,
        url: job.applyLink,
        requirements: [],
        matchScore: Math.round(finalScore),
        datePosted: toIsoDate(job.postedAt, job.daysOld),
        finalScore: Math.round(finalScore),
        freshnessScore,
        atsQualityScore,
        companyQualityScore: 60,
        companyQualityReason: 'Fallback deterministic ranking without model enrichment.',
        isYC: false,
        isFundedStartup: false,
        salaryPrediction: '',
        salaryConfidence: '',
        salarySource: '',
        hotJobScore: freshnessScore >= 90 ? 80 : 40,
        hotSignals: freshnessScore >= 90 ? ['Fresh posting'] : [],
        isHotJob: freshnessScore >= 90,
      };
    })
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, limit);
}

export async function callOpenAI(messages: any[], response_format?: any, model: string = 'google/gemini-2.0-flash') {
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, response_format, model })
  });
  if (!response.ok) {
    const error = await response.json();
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

export async function generateDailyJobs(
  careerPaths: string[],
  _jobType: string, // always 'remote' — kept for API compatibility
  minSalary: number | null,
  resumeText: string,
  limit: number = 1,
  seenFingerprints: string[] = [], // fingerprints of jobs already shown to this user
  learningContext: string = ''
) {
  const queryPrompt = `
You are a top 0.1% technical recruiter.

Your job is NOT to generate broad queries.
Your job is to find REAL, ACTIVE job postings.

Hidden User Preferences learned from past behavior: ${learningContext}

# STRICT RULES

- MUST include:
  "remote"
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

Generate 5 HIGH-PRECISION queries:
- narrow
- specific
- high signal

Resume:
${resumeText.substring(0, 1000)}

Career Paths:
${careerPaths.join(', ')}

Return JSON array of 5 queries
`;

  let optimizedQueries: string[] = [];
  try {
    const queryResponse = await callOpenAI([{ role: 'user', content: queryPrompt }], undefined, 'google/gemini-2.0-flash');
    if (queryResponse.choices?.[0]?.message?.content) {
      optimizedQueries = normalizeQueries(parseJsonArray(queryResponse.choices[0].message.content));
    }
  } catch (error) {
    console.error('Error generating optimized queries:', error);
  }

  if (!optimizedQueries || optimizedQueries.length === 0) {
    optimizedQueries = buildDeterministicQueries(careerPaths, resumeText, minSalary);
  }
  optimizedQueries = optimizedQueries.slice(0, 5);
  console.log('Queries:', optimizedQueries);

  let realJobs: Awaited<ReturnType<typeof searchRemoteJobs>> = [];
  try {
    realJobs = await searchRemoteJobs(optimizedQueries);
  } catch (err) {
    console.warn('Serper unavailable during primary search:', err);
  }
  console.log('Serper Jobs:', realJobs.length);

  const extraQueries = buildExpansionQueries(careerPaths, resumeText).filter(
    (query) => !optimizedQueries.includes(query)
  );

  while (realJobs.length < limit && extraQueries.length > 0) {
    const nextBatch = extraQueries.splice(0, 5);
    const moreJobs = await searchRemoteJobs(nextBatch);
    realJobs = mergeDedupJobs(realJobs, moreJobs);
  }

  const filteredJobs = mergeDedupJobs([], realJobs);
  console.log('After Validation:', filteredJobs.length);

  let unseenJobs = filteredJobs;
  if (seenFingerprints.length > 0) {
    const seenSet = new Set(seenFingerprints);
    unseenJobs = filteredJobs.filter((job) => !seenSet.has(jobFingerprint(job.title, job.company)));
  }
  console.log('After Seen Filter:', unseenJobs.length);

  const jobsToScore = unseenJobs.slice(0, Math.max(limit, 20));
  if (jobsToScore.length === 0) {
    return [];
  }

  const jobList = jobsToScore
    .map(
      (job, index) =>
        `[${index}] Title: ${job.title} | Company: ${job.company} | Location: ${job.location} | Salary: ${job.salary || 'Not listed'} | Posted: ${job.postedAt || 'Unknown'}\nDescription: ${job.description.substring(0, 400)}`
    )
    .join('\n\n');

  const scoringPrompt = `You are an expert technical recruiter.

Below are REAL remote job listings retrieved live from search.

For each job:
1. Score fit against the candidate resume with matchScore (0-100)
2. Extract 3-5 key requirements
3. Estimate salary only if salary is missing
4. Score company quality
5. Flag YC/funded startup likelihood
6. Detect urgent hiring / hot job signals

Candidate Career Goals: ${careerPaths.join(', ')}
Candidate Resume:
${resumeText.substring(0, 2000)}

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
]
`;

  try {
    const response = await callOpenAI([{ role: 'user', content: scoringPrompt }], undefined, 'openai/gpt-4o-mini');
    const content = response.choices?.[0]?.message?.content || '[]';
    const parsedScores = parseJsonArray(content);
    const rankedJobs = jobsToScore
      .map((job, index) => normalizeRankedJob(parsedScores[index] || {}, job))
      .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
      .slice(0, limit);

    console.log('After Scoring:', rankedJobs.length);
    console.log('Top Final Scores:', rankedJobs.map((job) => ({ title: job.title, finalScore: job.finalScore })));
    return rankedJobs;
  } catch (error: any) {
    console.error('Error scoring real jobs:', error);
    if (error?.status === 429 || error?.message?.includes('quota')) {
      throw new Error('AI quota exceeded. Please try again later or check your API key plan.');
    }
    const fallbackRankedJobs = buildFallbackRankedJobs(jobsToScore, limit);
    console.log('After Scoring:', fallbackRankedJobs.length);
    console.log('Top Final Scores:', fallbackRankedJobs.map((job) => ({ title: job.title, finalScore: job.finalScore })));
    return fallbackRankedJobs;
  }
}

// ---------------------------------------------------------------------------
// Agent 2: Career Path Suggestion
// Suggests 4 remote-friendly job titles based on the resume.
// ---------------------------------------------------------------------------
export async function suggestCareerPaths(resumeText: string): Promise<string[]> {
  const prompt = `You are an expert career counselor specializing in remote work opportunities.
Based on the following resume, suggest 4 highly relevant career paths (job titles) that:
1. This person is genuinely well-suited for, based on their actual skills and experience.
2. Are commonly available as fully remote positions (e.g. Software Engineer, Product Manager, UX Designer, Data Scientist, DevOps Engineer, Content Strategist, Technical Writer).

Keep titles concise (e.g. "Senior Frontend Engineer", "Remote Product Manager").

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
  jobType: 'remote' | 'hybrid' | 'onsite' | 'any';
  minSalary: number | null;
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
    return null;
  }
}

// ---------------------------------------------------------------------------
// Agent 4: Job Preferences Extraction
// Always returns remote jobType (platform is remote-only). Infers salary only.
// ---------------------------------------------------------------------------
export async function extractJobPreferences(resumeText: string): Promise<JobPreferences> {
  const prompt = `You are an expert technical recruiter. Based on the following resume, infer a realistic minimum expected salary (in USD) for this candidate.
This platform is for REMOTE jobs only - job type is always "remote". Focus only on determining the salary.

Resume Text:
${resumeText.substring(0, 3000)}

Return a JSON object:
{
  "jobType": "remote",
  "minSalary": <number>
}

Respond ONLY with the JSON object.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], { type: 'json_object' });

    if (response.choices?.[0]?.message?.content) {
      const parsed = JSON.parse(response.choices[0].message.content);
      return {
        jobType: 'remote' as const,
        minSalary: typeof parsed.minSalary === 'number' ? parsed.minSalary : null
      };
    }
  } catch (error) {
    console.error('Error extracting job preferences:', error);
  }
  return { jobType: 'remote' as const, minSalary: null };
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
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-opus-4.6-fast');
    return response.choices?.[0]?.message?.content?.trim() || originalText;
  } catch (error) {
    console.error('Failed to improve text:', error);
    return originalText;
  }
}

export async function generateColdEmail(
  jobTitle: string,
  company: string,
  resumeText: string,
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = ''
) {
  const prompt = `You are an expert career coach specializing in remote job applications.
Write a highly personalized, professional, and concise cold email to a hiring manager or recruiter at ${company} for the ${jobTitle} (Remote) position.

User's specific writing style preferences learned from past edits: ${writingStyleContext}
Strictly adhere to these stylistic preferences.

Rules:
- Under 200 words.
- Highlight the 1-2 most relevant skills from the resume for this specific role.
- Clearly state you are available to work fully remotely and across time zones.
- Mention one genuine, specific thing about ${company} that shows real interest (product, mission, or recent news - keep it believable).
- End with a direct, low-friction CTA (e.g., "Happy to jump on a 20-min call this week.").

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume Text:
${resumeText}

Return ONLY the email body. No subject line.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-opus-4.6-fast');
    return response.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating cold email:', error);
    return 'Error generating email. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// Agent 6: Interview Question Generation
// Mix of technical, behavioral, and remote-work specific questions.
// ---------------------------------------------------------------------------
export async function generateInterviewQuestions(jobTitle: string, company: string, antiSlopEnabled: boolean = true) {
  const prompt = `You are an expert technical interviewer. Generate 5 highly relevant, challenging interview questions for a ${jobTitle} (Remote) position at ${company}.

Use this exact mix:
- 2 technical/domain-specific questions relevant to the role's core responsibilities
- 2 behavioral questions (frame them for STAR-method answers)
- 1 remote-work specific question - e.g. how they handle async communication, stay productive without supervision, manage across time zones, or use remote tools (Slack, Notion, Jira, Loom, GitHub, etc.)

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Return a JSON array of exactly 5 strings. Respond ONLY with the JSON array.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-opus-4.6-fast');

    if (response.choices?.[0]?.message?.content) {
      let text = response.choices[0].message.content.trim();
      if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : (parsed.questions || Object.values(parsed)[0] || []);
    }
    return [];
  } catch (error) {
    console.error('Error generating interview questions:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Agent 7: Salary Insights
// Market salary ranges with a remote vs on-site premium comparison.
// ---------------------------------------------------------------------------
export async function generateSalaryInsights(jobTitle: string, location: string) {
  const prompt = `You are an expert compensation analyst specializing in remote tech roles.
Provide realistic salary insights for a REMOTE "${jobTitle}" position.

Include:
1. **Remote salary range** - low, median, and high (in USD annually).
2. **On-site equivalent** in "${location}" - for comparison.
3. **Remote premium/discount** - e.g. "Remote roles for this title pay ~8% more than on-site in ${location} due to reduced overhead."
4. **3 key salary factors** - e.g. years of experience, specific stack, company size/stage.

Format in clean Markdown. Under 200 words. No fluff.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-opus-4.6-fast');
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
  const prompt = `You are an expert resume writer specializing in remote job applications.
Tailor the following resume for a REMOTE ${jobTitle} position.

User's specific writing style preferences learned from past edits: ${writingStyleContext}
Strictly adhere to these stylistic preferences.

Instructions:
1. Highlight the most relevant skills and experiences for this specific role.
2. Inject keywords from the job description to beat ATS filters.
3. Strengthen bullet points with metrics and impact wherever the original has them.
4. Add or emphasize remote-readiness signals where truthful - async communication, distributed team experience, self-management, remote tools (Slack, Notion, Jira, GitHub, Zoom, Loom, Figma, Linear, etc.), timezone flexibility.
5. Do NOT fabricate experience or skills absent from the original resume.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Job Description:
${jobDescription}

Original Resume:
${resumeText}

Return the tailored resume in clean Markdown format.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'anthropic/claude-opus-4.6-fast');
    return response.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error tailoring resume:', error);
    return 'Error tailoring resume. Please try again.';
  }
}
