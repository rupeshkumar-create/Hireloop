/**
 * aiService.ts
 *
 * AI-powered asset generation agents (email, resume, interview, analysis).
 * Job generation has been moved to jobResearcher.ts + jobMatchingEngine.ts.
 *
 * All LLM calls are proxied through /api/openai (OpenRouter) so API keys
 * stay server-side.
 */

import {
  validateAssetForgeEmail,
  validateStructuredProfile,
  validateTailoredResumeOutput,
} from './validator';
import { registerGuardrailTask, runWithGuardrails } from './systemEngine';
import { fetchRecruiterFromApollo, type RecruiterContact } from './apolloService';
import {
  enrichResumeTextWithHyperlinks,
  normalizeLinkedInUrl,
  pickLinkedInFromUrls,
} from '../lib/resumeHyperlinks.js';
import { getAiAuthToken } from './aiAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Shared OpenRouter proxy caller
// ─────────────────────────────────────────────────────────────────────────────

export async function callOpenAI(
  messages: any[],
  response_format?: any,
  model: string = 'openai/gpt-4o-mini'
) {
  const authToken = await getAiAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch('/api/openai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, response_format, model }),
  });

  const text = await response.text();
  if (!text) {
    throw new Error('API returned an empty response. This might be a timeout.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'AI service route not found. Deploy the latest build — the /api/openai handler must be live.'
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse AI response:', text.slice(0, 200));
    throw new Error('API returned an invalid response format.');
  }

  if (!response.ok) {
    const error = data;
    if (response.status === 401) {
      throw new Error('Please sign in again to use AI Copilot.');
    }
    if (response.status === 403 || error.error?.toLowerCase?.().includes('pro plan')) {
      throw new Error('AI_PRO_REQUIRED');
    }
    if (
      error.status === 402 ||
      error.status === 429 ||
      (error.error &&
        typeof error.error === 'string' &&
        (error.error.toLowerCase().includes('credit') ||
          error.error.toLowerCase().includes('balance') ||
          error.error.toLowerCase().includes('quota')))
    ) {
      throw new Error('AI_QUOTA_EXCEEDED');
    }
    throw new Error(error.error || 'Failed to call OpenAI proxy');
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-slop writing filter (used in all user-facing text generation)
// ─────────────────────────────────────────────────────────────────────────────

export const ANTI_SLOP_PROMPT = `
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
- Be specific. Replace vague claims with concrete facts.
- Use contractions naturally: "I've", "I'm", "we're", "it's". Avoid stiff, formal constructions.

--- FORMATTING RULES ---
- No corporate buzzword soup in bullet points.
- Resume bullets must lead with a strong verb in past tense.
- Quantify where the original resume has data. Never fabricate numbers.
- Cold emails: 150–200 words max. Three short paragraphs: hook → value → CTA.
- CTA must be direct and low-friction: "Free for a 20-min call Wednesday?"

=== END OF ANTI-SLOP FILTER ===
`;

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail task registrations
// ─────────────────────────────────────────────────────────────────────────────

interface EmailGenerationInput {
  jobTitle: string;
  company: string;
  antiSlopEnabled: boolean;
  writingStyleContext: string;
  resumeText?: string;
  resumeSummary?: string;
  recruiter?: RecruiterContact;
}

registerGuardrailTask<EmailGenerationInput, string>('email_generation', {
  validateOutput: (output, input) =>
    validateAssetForgeEmail(output, { company: input.company, jobTitle: input.jobTitle }),
  selfFix: async (output, input, validation) =>
    improveTextWithAI(
      output,
      `Fix this email. Reason: ${validation.reason}. Keep it under 200 words. Include ${input.company}. Include ${input.jobTitle}. Remove generic language.`,
      input.writingStyleContext
    ),
});

registerGuardrailTask<
  { jobTitle: string; jobDescription: string; resumeText: string; antiSlopEnabled: boolean; writingStyleContext: string },
  string
>('resume_tailoring', {
  validateOutput: (output, input) =>
    validateTailoredResumeOutput(output, { jobDescription: input.jobDescription }),
  selfFix: async (output, input, validation) =>
    improveTextWithAI(
      output,
      `Fix this tailored resume. Reason: ${validation.reason}. Keep all claims grounded in the original resume and align more clearly with the job description keywords.`,
      input.writingStyleContext
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent 1: Career Path Suggestion
// ─────────────────────────────────────────────────────────────────────────────

export async function suggestCareerPaths(
  resumeText: string,
  antiSlopEnabled: boolean = true
): Promise<string[]> {
  const prompt = `You are an expert career counselor specializing in remote work opportunities.
Based on the following resume, suggest 4 highly relevant career paths (job titles) that:
1. This person is genuinely well-suited for, based on their actual skills and experience.
2. Are commonly available as fully remote positions.

Keep titles concise (e.g. "Senior Frontend Engineer", "Remote Product Manager").

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume Text:
${resumeText.substring(0, 3000)}

Return a JSON array of exactly 4 strings. Respond ONLY with the JSON array.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], { type: 'json_object' });
    if (response.choices?.[0]?.message?.content) {
      const parsed = JSON.parse(response.choices[0].message.content);
      return Array.isArray(parsed)
        ? parsed
        : parsed.careerPaths || parsed.paths || Object.values(parsed)[0] || [];
    }
    return [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 2: Resume Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface ResumeAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  summary: string;
  remoteReadiness?: { score: number; tips: string[] };
}

export async function analyzeResume(
  resumeText: string,
  careerPaths: string[]
): Promise<ResumeAnalysis | null> {
  const prompt = `You are an expert career coach and technical recruiter specializing in remote work.
Analyze the following resume in the context of the user's target remote career paths: ${careerPaths.join(', ')}.

Provide:
1. strengths - what stands out for these roles.
2. weaknesses - gaps or red flags.
3. improvements - specific, actionable steps.
4. summary - overall effectiveness (2-3 sentences).
5. remoteReadiness - score 0-100 and 3 tips.

Resume Text:
${resumeText.substring(0, 3000)}

Return a JSON object:
{
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "summary": "",
  "remoteReadiness": { "score": 0, "tips": [] }
}

Respond ONLY with the JSON object.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], { type: 'json_object' });
    if (response.choices?.[0]?.message?.content) {
      return JSON.parse(response.choices[0].message.content);
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 3: Job Preferences Extraction
// ─────────────────────────────────────────────────────────────────────────────

export interface JobPreferences {
  jobType: 'remote' | 'hybrid' | 'onsite' | 'both';
  minSalary: number | null;
  location?: string;
}

export async function extractJobPreferences(resumeText: string): Promise<JobPreferences> {
  const prompt = `You are an expert technical recruiter. Based on the following resume, infer a realistic minimum expected salary (in USD) and current location.

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
        jobType: 'both',
        minSalary: typeof parsed.minSalary === 'number' ? parsed.minSalary : null,
        location: typeof parsed.location === 'string' ? parsed.location : '',
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
  }
  return { jobType: 'both', minSalary: null, location: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 4: Structured Profile Extraction
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedContact {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface ExtractedExperience {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  highlights?: string[];
}

export interface ExtractedEducation {
  id: string;
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
}

export interface ExtractedResumeProfile {
  fullName: string;
  skills: string[];
  techStack: string[];
  seniority: string;
  roles: string[];
  industries: string[];
  contact?: ExtractedContact;
  experience?: ExtractedExperience[];
  education?: ExtractedEducation[];
  certifications?: string[];
  languages?: string[];
}

function shortId(seed: string): string {
  // Stable, sufficient-for-UI id from the seed string.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

/**
 * Deterministic regex-based contact extractor. Used to backfill any contact
 * fields the AI didn't return. Patterns work across resume layouts because
 * email/phone/linkedin/github have very consistent shapes.
 */
export function extractContactFromText(text: string, hyperlinkUrls: string[] = []): ExtractedContact {
  const out: ExtractedContact = {};
  const enriched = enrichResumeTextWithHyperlinks(text, hyperlinkUrls);
  const cleaned = enriched.replace(/\s+/g, ' ');

  // Hyperlink targets win — resumes often show "LinkedIn" with the real URL only in the link.
  const linkedinFromLinks = pickLinkedInFromUrls(hyperlinkUrls);
  if (linkedinFromLinks) out.linkedin = linkedinFromLinks;

  // Email — first plausible address wins.
  const emailMatch = cleaned.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (emailMatch) out.email = emailMatch[0];

  // Phone — international or 10+ digit run. Avoid matching years like "2024".
  const phoneMatch =
    cleaned.match(/\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/) ||
    cleaned.match(/\(\d{3}\)\s?\d{3}[\s.-]?\d{4}/) ||
    cleaned.match(/(?:^|\s)\d{3}[\s.-]\d{3}[\s.-]\d{4}(?:\s|$)/) ||
    cleaned.match(/(?:^|[^\d])\d{10}(?!\d)/);
  if (phoneMatch) out.phone = phoneMatch[0].trim();

  // LinkedIn — full URL or linkedin.com/in/… in text (including enriched hyperlink block).
  if (!out.linkedin) {
    const linkedinMatch = cleaned.match(
      /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?linkedin\.com\/(?:in|pub)\/[\w%-]+(?:\/[\w%-]+)*/i
    );
    if (linkedinMatch) {
      out.linkedin = normalizeLinkedInUrl(linkedinMatch[0]);
    }
  }

  // GitHub — github.com/handle.
  const githubMatch = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i);
  if (githubMatch) out.github = githubMatch[0].replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  // Personal website — any URL that isn't linkedin/github/the user's email
  // domain. Strip the email substring first so its domain doesn't pollute
  // the URL search.
  const emailDomain = out.email?.split('@')[1]?.toLowerCase();
  const withoutEmail = out.email ? cleaned.split(out.email).join(' ') : cleaned;
  const urlMatches = withoutEmail.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,]*)?/gi) || [];
  const personal = urlMatches.find((u) => {
    const low = u.toLowerCase();
    if (low.includes('linkedin.') || low.includes('github.')) return false;
    if (emailDomain && low.includes(emailDomain)) return false;
    return true;
  });
  if (personal) out.website = personal.replace(/^https?:\/\//i, '');

  return out;
}

function mergeContact(primary: ExtractedContact, fallback: ExtractedContact): ExtractedContact {
  const out: ExtractedContact = { ...primary };
  (Object.keys(fallback) as (keyof ExtractedContact)[]).forEach((k) => {
    if (!out[k] && fallback[k]) out[k] = fallback[k];
  });
  return out;
}

/**
 * Omits keys whose value is undefined. Firestore rejects undefined anywhere
 * in the document tree (it accepts `null` or omitted keys), so the
 * extractor's output should never carry undefined-valued fields.
 *
 * Defence layered with stripUndefinedDeep at the AuthContext.updateProfile
 * boundary — either one would prevent the regression, both is cheap.
 */
function omitUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}

const EXTRACT_RESUME_SCHEMA = `Required JSON schema (all fields must be present in your output; arrays may be empty only if the resume genuinely has no entries):

{
  "fullName": string,                                              // full legal name as it appears on the resume
  "contact": {
    "email": string,                                               // primary email
    "phone": string,                                               // phone number with country code if present
    "location": string,                                            // "City, State, Country" if present
    "linkedin": string,                                            // linkedin URL or handle path
    "github": string,                                              // github URL or handle path
    "website": string                                              // personal site / portfolio URL
  },
  "skills": string[],                                              // soft + domain skills (e.g. "Strategic Planning")
  "techStack": string[],                                           // tools, languages, platforms (e.g. "SQL", "Figma", "Tableau")
  "seniority": string,                                             // e.g. "Senior", "Lead", "Manager"
  "roles": string[],                                               // role categories the candidate could pursue
  "industries": string[],                                          // industries the candidate has worked in
  "experience": [                                                  // EVERY job/role on the resume — never omit any
    {
      "title": string,
      "company": string,
      "location": string,                                          // "" if not stated
      "startDate": string,                                         // "YYYY-MM" or "YYYY" — "" if not stated
      "endDate": string,                                           // "YYYY-MM"/"YYYY"/"Present" — "" if not stated
      "current": boolean,                                          // true if endDate is "Present" or implied current
      "highlights": string[]                                       // 2–5 short outcome-focused bullets, paraphrased
    }
  ],
  "education": [                                                   // EVERY degree/diploma on the resume — never omit
    {
      "school": string,
      "degree": string,                                            // e.g. "B.S.", "MBA", "Diploma"
      "field": string,                                             // e.g. "Computer Science"
      "startDate": string,
      "endDate": string
    }
  ],
  "certifications": string[],                                      // every cert mentioned
  "languages": string[]                                            // every language mentioned (with proficiency if given)
}`;

async function runExtractResumeCall(resumeText: string): Promise<any> {
  const prompt = `You are extracting structured data from a candidate's resume.

CRITICAL RULES:
1. Extract EVERY job in the resume into "experience" — do not skip any.
2. Extract EVERY degree/diploma/certification — do not skip any.
3. Use the candidate's actual text verbatim; do not invent or paraphrase facts.
4. Empty arrays/strings are only acceptable when the resume genuinely lacks the information.
5. Never return a placeholder object with empty fields if real data exists in the resume.

${EXTRACT_RESUME_SCHEMA}

Resume text follows. Read it carefully and output ONLY the JSON object.

RESUME:
${resumeText.substring(0, 12000)}`;

  const response = await callOpenAI(
    [{ role: 'user', content: prompt }],
    { type: 'json_object' },
    'openai/gpt-4o'
  );
  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content);
}

async function runExperienceEducationRetry(resumeText: string): Promise<{
  experience?: any[];
  education?: any[];
}> {
  const prompt = `Extract EVERY work experience entry and EVERY education entry from this resume.

Output strictly this JSON shape (no preamble, no commentary):
{
  "experience": [ { "title": "", "company": "", "location": "", "startDate": "", "endDate": "", "current": false, "highlights": [] } ],
  "education":  [ { "school": "", "degree": "", "field": "", "startDate": "", "endDate": "" } ]
}

Each array must contain ONE entry per role/degree in the resume — never combine, never skip. If a date is unknown, use "". For ongoing roles set "current": true and "endDate": "Present".

RESUME:
${resumeText.substring(0, 12000)}`;
  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { type: 'json_object' },
      'openai/gpt-4o'
    );
    const content = response.choices?.[0]?.message?.content;
    if (!content) return {};
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function extractResume(
  resumeText: string,
  hyperlinkUrls: string[] = []
): Promise<ExtractedResumeProfile | null> {
  try {
    const parsed = await runExtractResumeCall(resumeText);
    if (!parsed) return null;
    const validation = validateStructuredProfile(parsed);
    if (!validation.passed) throw new Error(validation.reason || 'Invalid structured profile');

    const fullName = typeof parsed.fullName === 'string' ? parsed.fullName : '';
    const contactRaw = parsed.contact && typeof parsed.contact === 'object' ? parsed.contact : {};
    // Build the contact object with omitUndefined so the returned shape has
    // no `phone: undefined`-style keys — Firestore rejects undefined anywhere
    // in the tree, and prior versions of this function emitted them.
    const aiContact: ExtractedContact = omitUndefined({
      fullName: fullName || undefined,
      email: typeof contactRaw.email === 'string' && contactRaw.email ? contactRaw.email : undefined,
      phone: typeof contactRaw.phone === 'string' && contactRaw.phone ? contactRaw.phone : undefined,
      location: typeof contactRaw.location === 'string' && contactRaw.location ? contactRaw.location : undefined,
      linkedin: typeof contactRaw.linkedin === 'string' && contactRaw.linkedin ? contactRaw.linkedin : undefined,
      github: typeof contactRaw.github === 'string' && contactRaw.github ? contactRaw.github : undefined,
      website: typeof contactRaw.website === 'string' && contactRaw.website ? contactRaw.website : undefined,
    });
    // Regex backfill — every contact field the AI dropped gets retried against
    // the raw resume text. Deterministic, free, never wrong about email shape.
    const contact = omitUndefined(mergeContact(aiContact, extractContactFromText(resumeText, hyperlinkUrls)));

    const mapExperience = (arr: any[]): ExtractedExperience[] =>
      arr
        .filter((e: any) => e && (e.title || e.company))
        .map((e: any, i: number) => omitUndefined({
          id: shortId(`${e.company || ''}::${e.title || ''}::${i}`),
          title: String(e.title || '').trim(),
          company: String(e.company || '').trim(),
          location: e.location ? String(e.location).trim() : undefined,
          startDate: e.startDate ? String(e.startDate).trim() : undefined,
          endDate: e.endDate ? String(e.endDate).trim() : undefined,
          current: Boolean(e.current),
          highlights: Array.isArray(e.highlights)
            ? e.highlights.map((h: any) => String(h).trim()).filter(Boolean)
            : undefined,
        }) as ExtractedExperience);

    const mapEducation = (arr: any[]): ExtractedEducation[] =>
      arr
        .filter((e: any) => e && e.school)
        .map((e: any, i: number) => omitUndefined({
          id: shortId(`${e.school || ''}::${e.degree || ''}::${i}`),
          school: String(e.school || '').trim(),
          degree: e.degree ? String(e.degree).trim() : undefined,
          field: e.field ? String(e.field).trim() : undefined,
          startDate: e.startDate ? String(e.startDate).trim() : undefined,
          endDate: e.endDate ? String(e.endDate).trim() : undefined,
        }) as ExtractedEducation);

    let experience: ExtractedExperience[] = Array.isArray(parsed.experience)
      ? mapExperience(parsed.experience)
      : [];
    let education: ExtractedEducation[] = Array.isArray(parsed.education)
      ? mapEducation(parsed.education)
      : [];

    // Heuristic: if the first pass missed experience/education but the resume
    // clearly mentions them, fire a focused second call. Cheap insurance.
    const resumeLower = resumeText.toLowerCase();
    const hasExperienceKeywords =
      /\b(experience|employment|work history|professional history)\b/.test(resumeLower);
    const hasEducationKeywords =
      /\b(education|degree|university|college|bachelor|master|diploma|polytechnic|institute|school)\b/.test(
        resumeLower
      );

    if (
      (experience.length === 0 && hasExperienceKeywords) ||
      (education.length === 0 && hasEducationKeywords)
    ) {
      try {
        const retry = await runExperienceEducationRetry(resumeText);
        if (experience.length === 0 && Array.isArray(retry.experience)) {
          experience = mapExperience(retry.experience);
        }
        if (education.length === 0 && Array.isArray(retry.education)) {
          education = mapEducation(retry.education);
        }
      } catch {
        // Retry is best-effort — first-pass results stand if the retry fails.
      }
    }

    return {
      fullName,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      seniority: typeof parsed.seniority === 'string' ? parsed.seniority : '',
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
      contact,
      experience,
      education,
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return null;
  }
}

export async function summarizeResume(resumeText: string): Promise<string> {
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
      'openai/gpt-4o-mini'
    );
    return response.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') throw error;
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 5: Text improvement
// ─────────────────────────────────────────────────────────────────────────────

export async function improveTextWithAI(
  originalText: string,
  instruction: string,
  context: string = ''
): Promise<string> {
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
      'openai/gpt-4o'
    );
    return response.choices?.[0]?.message?.content?.trim() || originalText;
  } catch {
    return originalText;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 6: Cold Email Generation
// ─────────────────────────────────────────────────────────────────────────────

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
  return { status: 'skipped', reason };
}

async function generateAssetForgeEmail(input: AssetForgeEmailInput): Promise<string> {
  return runWithGuardrails(
    'email_generation',
    async () => {
      const prompt = `You are an expert career coach specializing in concise recruiter outreach.
Write a cold email to ${input.recruiter.name} at ${input.job.company} about the ${input.job.title} role.

Rules:
- Mention ${input.job.company}
- Mention ${input.job.title}
- Under 200 words
- Ground the message in this resume summary only
- Do not invent background or recruiter facts

${input.antiSlopEnabled !== false ? ANTI_SLOP_PROMPT : ''}

Resume Summary:
${input.resumeSummary}

Return ONLY the email body.`;

      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'openai/gpt-4o'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) throw new Error('Empty cold email generated');
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
    if (!recruiter) return buildAssetForgeSkipResult('recruiter_not_found');

    const email = await generateAssetForgeEmail({
      job: input.job,
      recruiter,
      resumeSummary: input.resumeSummary,
      antiSlopEnabled: input.antiSlopEnabled,
      writingStyleContext: input.writingStyleContext,
    });
    return { status: 'generated', recruiter, email };
  } catch {
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
Write a highly personalized, professional, and concise cold email to a hiring manager or recruiter at ${company} for the ${jobTitle} position.

User's specific writing style preferences learned from past edits: ${writingStyleContext}

Rules:
- Under 200 words.
- Mention ${jobTitle} and ${company} explicitly.
- Highlight the 1-2 most relevant skills from the resume for this specific role.
- Mention one genuine, specific thing about ${company} that shows real interest.
- End with a direct, low-friction CTA (e.g., "Happy to jump on a 20-min call this week.").

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume Text:
${resumeText}

Return ONLY the email body. No subject line.`;

      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'openai/gpt-4o'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) throw new Error('Empty cold email generated');
      return content.trim();
    },
    { jobTitle, company, resumeText, antiSlopEnabled, writingStyleContext }
  );
}

/**
 * Polite follow-up email for an application that has gone quiet. Used by
 * the pipeline view to nudge stalled-applied jobs (>7d, no response). Pulls
 * tone from the user's writing style if available, references the original
 * outreach so it doesn't read like a generic reminder, and stays well under
 * inbox-anxiety length.
 */
export async function generateFollowUpEmail(
  jobTitle: string,
  company: string,
  daysSinceApply: number,
  resumeSummary: string,
  originalEmail: string = '',
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = '',
) {
  const prompt = `Write a polite, low-pressure follow-up email for a job application that's gone quiet.

CONTEXT:
- Role: ${jobTitle} at ${company}
- ${daysSinceApply} days since the application
${originalEmail ? `- Original outreach summary: ${originalEmail.slice(0, 600)}` : '- (No prior email on file — this is a follow-up on a portal application.)'}
${writingStyleContext ? `- Writing style notes: ${writingStyleContext}` : ''}

CANDIDATE STRENGTHS (from resume):
${resumeSummary.slice(0, 1500)}

RULES:
- Under 120 words total. Three short paragraphs max.
- Open by referencing the application or prior email — never "just checking in".
- Re-state ONE concrete strength relevant to the role (don't restate the whole resume).
- Close with a specific, low-friction CTA — e.g., "Happy to share work samples or jump on a 15-min call this week." NOT "Looking forward to hearing from you."
- Subject-line tone: respectful, not pushy. The reader should not feel guilt-tripped.
- Do NOT use phrases: "circling back", "just wanted to follow up", "any update", "still interested".

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Return ONLY the email body (no subject line).`;

  const response = await callOpenAI([{ role: 'user', content: prompt }], undefined, 'openai/gpt-4o');
  const content = response.choices?.[0]?.message?.content || '';
  if (!content.trim()) throw new Error('Empty follow-up email generated');
  return content.trim();
}

export async function extractRecruiterEmail(
  jobDescription: string,
  companyName: string
): Promise<string> {
  const prompt = `You are a helpful assistant trying to find the contact email for a job application.
Scan the following job description for ANY email addresses.
If you find none, return a best guess based on the company name.

Job Description:
${jobDescription.substring(0, 3000)}

Company: ${companyName}

Return ONLY the email address as a raw string. No other text.`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      undefined,
      'openai/gpt-4o-mini'
    );
    const email = response.choices?.[0]?.message?.content?.trim() || '';
    if (email.includes('@') && email.includes('.')) return email.split(' ')[0];
  } catch {
    // ignore
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 7: Interview Question Generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateInterviewQuestions(
  jobTitle: string,
  company: string,
  antiSlopEnabled: boolean = true,
  resumeText: string = '',
  jobDescription: string = ''
) {
  const prompt = `You are a senior hiring manager and interview coach. Build an advanced interview prep pack for a ${jobTitle} role at ${company}.

${resumeText.trim() ? `Candidate resume (ground answers here — no fabrication):\n${resumeText.slice(0, 3500)}\n` : ''}
${jobDescription.trim() ? `Job description excerpt:\n${jobDescription.slice(0, 2500)}\n` : ''}

Produce exactly 8 sections in Markdown:

## Round 1 — Recruiter screen (2 questions)
For each: **Q:** question · **Strong answer:** 3–5 bullet points · **Trap to avoid:** one line

## Round 2 — Hiring manager (2 questions)
Same format — focus on scope, ownership, and metrics.

## Round 3 — Technical / craft depth (2 questions)
Role-specific depth. Include **Follow-up probe** the interviewer might ask.

## Behavioral — STAR story bank
Two prompts with **Situation / Task / Action / Result** outlines tied to the resume.

## Questions to ask them
Three sharp questions the candidate should ask (culture, success metrics, team structure).

## 48-hour prep checklist
5 bullet action items before the interview.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Return ONLY clean Markdown. No preamble.`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      undefined,
      'openai/gpt-4o'
    );
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content.trim();
    }
    throw new Error('Empty interview questions generated');
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to generate interview questions');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 8: Salary Insights
// ─────────────────────────────────────────────────────────────────────────────

export async function generateSalaryInsights(
  jobTitle: string,
  location: string,
  antiSlopEnabled: boolean = true
) {
  const prompt = `You are an expert compensation analyst specializing in remote tech roles.
Provide realistic salary insights for a REMOTE "${jobTitle}" position.

Include:
1. **Remote salary range** - low, median, and high (in USD annually).
2. **On-site equivalent** in "${location}" - for comparison.
3. **Remote premium/discount** - brief explanation.
4. **3 key salary factors** - e.g. years of experience, specific stack, company stage.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Format in clean Markdown. Under 200 words. No fluff.`;

  try {
    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      undefined,
      'openai/gpt-4o'
    );
    return response.choices?.[0]?.message?.content || 'Could not generate salary insights.';
  } catch {
    return 'Error generating salary insights. Please try again.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 9: Resume Tailoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull the most ATS-significant terms out of a job description. We hand these
 * to the tailoring prompt explicitly so the model doesn't have to guess what
 * to weave into bullets — and so the user gets a deterministic, predictable
 * set of keywords inserted on every run.
 *
 * Heuristic: pick alphanumeric tokens 3+ chars long, drop generic English
 * stopwords + boilerplate, rank by frequency, keep the top 20.
 */
export function extractJobKeywords(jobDescription: string, max: number = 20): string[] {
  if (!jobDescription) return [];
  const NOISE = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'are', 'our',
    'you', 'your', 'their', 'they', 'have', 'has', 'had', 'been', 'being',
    'role', 'team', 'work', 'about', 'who', 'into', 'across', 'within',
    'over', 'years', 'experience', 'looking', 'seeking', 'must', 'should',
    'company', 'job', 'position', 'opportunity', 'candidate', 'qualified',
    'strong', 'excellent', 'great', 'good', 'best', 'plus', 'preferred',
    'required', 'requirements', 'qualifications', 'responsibilities',
    'including', 'such', 'other', 'more', 'than', 'one', 'two', 'three',
    'all', 'any', 'some', 'where', 'when', 'what', 'how', 'why', 'remote',
    'hybrid', 'office', 'full', 'time', 'part', 'month', 'year', 'day',
    'week', 'team', 'teams', 'us', 'we', 'or', 'a', 'an', 'is', 'be',
    'as', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'do', 'it', 'so',
  ]);
  const counts = new Map<string, number>();
  const tokens = jobDescription.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  for (const tok of tokens) {
    if (NOISE.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  // Boost terms that look like proper nouns or tech (capitalised in original).
  const properNouns = (jobDescription.match(/\b[A-Z][a-zA-Z0-9+#.-]{2,}\b/g) || [])
    .map((t) => t.toLowerCase());
  for (const pn of properNouns) {
    if (NOISE.has(pn)) continue;
    counts.set(pn, (counts.get(pn) || 0) + 2);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

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
      // Pre-extract the keywords. The AI uses these instead of guessing.
      const keywords = extractJobKeywords(jobDescription, 20);
      const keywordBlock = keywords.length > 0
        ? `\nKEYWORDS TO WEAVE NATURALLY INTO BULLETS + SUMMARY (use ≥8 of these, do not stuff):\n${keywords.join(', ')}\n`
        : '';

      const prompt = `You are an expert resume writer and ATS specialist.
Rewrite the candidate's resume to be tailored for the "${jobTitle}" role described below.

${writingStyleContext ? `Writing style notes: ${writingStyleContext}\n` : ''}
${keywordBlock}
════════════════════════════════════════
MANDATORY OUTPUT FORMAT (strict Markdown)
════════════════════════════════════════

# Full Name

Email | Phone | City, Country | linkedin.com/in/handle

## SUMMARY
2–3 sentences targeting this specific role. Lead with seniority and the strongest relevant skill from the candidate's actual background. No filler phrases ("results-driven", "passionate", "team-player").

## EXPERIENCE

### Company Name — Job Title
*Month Year – Month Year (or Present)*

- Strong past-tense verb + concrete deliverable + measurable result. Each bullet uses at least one keyword from the job description when it can be made truthful.
- 3–5 bullets per recent role, 2–3 for older roles, all on their own line.

### Next Company — Previous Role
*Month Year – Month Year*

- [Bullets]

## EDUCATION

### Degree in Field of Study
*Institution | Graduation Year*

## SKILLS

**Technical:** skill1, skill2, skill3, skill4
**Tools & Platforms:** tool1, tool2, tool3
**Soft Skills:** skill1, skill2

════════════════════════════════════════
GROUNDEDNESS RULES (treat as non-negotiable)
════════════════════════════════════════
1. NEVER invent experience, companies, degrees, certifications, or metrics that are not in the original resume.
2. Company names, job titles, and dates from the original resume must be preserved EXACTLY. If a date isn't in the original, leave it blank — do not guess.
3. The candidate's name in the H1 must match the original resume verbatim.
4. Numbers and percentages may only be included if they appear in the original. If the original says "improved X", do NOT invent a "+30%" — keep it qualitative.
5. Keyword injection is allowed only when the underlying claim is true. "Worked with Python" stays. "Built distributed systems in Rust" is invented and forbidden.

════════════════════════════════════════
QUALITY RULES
════════════════════════════════════════
6. Strengthen weak bullets: "worked on X" → "Rebuilt X using <true tech>, owning <true scope>".
7. Drop entire experience entries that add zero signal for this role (e.g. unrelated internships from 8 years ago when targeting a senior role).
8. Reorder bullets within each role so the most-relevant-to-this-job line appears first.
9. Dates must be "Mon Year" format (e.g. "Jan 2022 – Mar 2024" or "Mar 2024 – Present").
10. Contact line is a single line using "|" as separator. Skills section uses comma-separated lists, NOT bullets.
11. Output the resume ONLY. No preamble, no commentary, no "Here is the resume:".

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

────────────────────────────────────────
JOB DESCRIPTION
────────────────────────────────────────
${jobDescription.slice(0, 3500)}

────────────────────────────────────────
ORIGINAL RESUME (the only source of truth for the candidate's facts)
────────────────────────────────────────
${resumeText}

Return ONLY the tailored resume in the exact Markdown format above.`;

      const response = await callOpenAI(
        [{ role: 'user', content: prompt }],
        undefined,
        'openai/gpt-4o'
      );
      const content = response.choices?.[0]?.message?.content || '';
      if (!content.trim()) throw new Error('Empty tailored resume generated');
      return normalizeTailoredResume(content.trim());
    },
    { jobTitle, jobDescription, resumeText, antiSlopEnabled, writingStyleContext }
  );
}

/**
 * Post-processes raw AI output so the ResumeMarkdown renderer always has
 * structure to style. Most calls already return clean markdown; this is a
 * safety net for runs where the model drops `#`, `##`, or `###` prefixes.
 */
function normalizeTailoredResume(raw: string): string {
  const SECTION_NAMES = new Set([
    'SUMMARY',
    'OBJECTIVE',
    'PROFILE',
    'EXPERIENCE',
    'WORK EXPERIENCE',
    'PROFESSIONAL EXPERIENCE',
    'EMPLOYMENT',
    'EDUCATION',
    'SKILLS',
    'TECHNICAL SKILLS',
    'PROJECTS',
    'CERTIFICATIONS',
    'AWARDS',
    'PUBLICATIONS',
    'LANGUAGES',
    'INTERESTS',
  ]);

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let firstNonEmptySeen = false;
  let nameWrittenAsH1 = false;

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const trimmed = original.trim();

    if (!trimmed) {
      out.push('');
      continue;
    }

    // Already a markdown heading — keep as-is.
    if (/^#{1,3}\s/.test(trimmed)) {
      if (/^#\s/.test(trimmed)) nameWrittenAsH1 = true;
      out.push(trimmed);
      firstNonEmptySeen = true;
      continue;
    }

    // First content line — if it looks like a personal name (1–4 capitalised
    // words, no email/phone/punctuation typical of contact lines), promote to H1.
    if (!firstNonEmptySeen) {
      firstNonEmptySeen = true;
      const looksLikeName =
        !nameWrittenAsH1 &&
        trimmed.length < 80 &&
        !/[@|•]/.test(trimmed) &&
        !/\d/.test(trimmed) &&
        /^[A-Z][a-zA-Z'’\-]+(\s+[A-Z][a-zA-Z'’\-]+){0,4}$/.test(trimmed);
      if (looksLikeName) {
        out.push(`# ${trimmed}`);
        nameWrittenAsH1 = true;
        continue;
      }
    }

    // All-caps section label on its own line → ## SECTION
    const upper = trimmed.toUpperCase();
    if (
      trimmed === upper &&
      trimmed.length <= 40 &&
      /^[A-Z][A-Z\s&/-]+$/.test(trimmed) &&
      SECTION_NAMES.has(upper.replace(/[^A-Z\s]/g, '').trim())
    ) {
      out.push(`## ${upper}`);
      continue;
    }

    out.push(original);
  }

  return out.join('\n').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 10: Cover Letter Generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCoverLetter(
  jobTitle: string,
  company: string,
  resumeText: string,
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = '',
  jobDescription: string = ''
): Promise<string> {
  const prompt = `You are an executive career strategist. Write an advanced cover letter for the ${jobTitle} role at ${company}.

${writingStyleContext ? `Writing style notes: ${writingStyleContext}\n` : ''}
${jobDescription.trim() ? `Job description (mirror their language):\n${jobDescription.slice(0, 3000)}\n` : ''}

Structure (4 paragraphs, 280–380 words total):
1. **Hook** — One specific reason this role at ${company} (product, mission, or stack) — not "I am excited."
2. **Proof** — Two quantified achievements from the resume mapped to job requirements.
3. **Fit** — How your working style matches remote/async expectations for this role.
4. **Close** — Direct CTA (conversation, portfolio link placeholder if relevant). One sentence.

Rules:
- Mention ${jobTitle} and ${company} at least twice.
- No fabrication — only resume-backed claims.
- No salutation or sign-off (UI adds those).

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume:
${resumeText.slice(0, 4000)}

Return ONLY the letter body paragraphs.`;

  const response = await callOpenAI(
    [{ role: 'user', content: prompt }],
    undefined,
    'openai/gpt-4o'
  );
  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty cover letter generated');
  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 11: Learning Profile Update
// ─────────────────────────────────────────────────────────────────────────────

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
  } catch {
    return currentContext;
  }
}
