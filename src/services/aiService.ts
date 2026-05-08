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

// ─────────────────────────────────────────────────────────────────────────────
// Shared OpenRouter proxy caller
// ─────────────────────────────────────────────────────────────────────────────

export async function callOpenAI(
  messages: any[],
  response_format?: any,
  model: string = 'openai/gpt-4o-mini'
) {
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, response_format, model }),
  });

  const text = await response.text();
  if (!text) {
    throw new Error('API returned an empty response. This might be a timeout.');
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse AI response:', text);
    throw new Error('API returned an invalid response format.');
  }

  if (!response.ok) {
    const error = data;
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

export interface ExtractedResumeProfile {
  fullName: string;
  skills: string[];
  techStack: string[];
  seniority: string;
  roles: string[];
  industries: string[];
}

export async function extractResume(resumeText: string): Promise<ExtractedResumeProfile | null> {
  const prompt = `Extract a structured candidate profile from this resume.

Return a JSON object:
{
  "fullName": "",
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
      'openai/gpt-4o'
    );
    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    const validation = validateStructuredProfile(parsed);
    if (!validation.passed) throw new Error(validation.reason || 'Invalid structured profile');

    return {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      seniority: typeof parsed.seniority === 'string' ? parsed.seniority : '',
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
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
  antiSlopEnabled: boolean = true
) {
  const prompt = `You are an expert technical interviewer and Y Combinator founder. Generate 5 highly relevant, intense, and deeply thought-provoking interview questions with suggested answers for a ${jobTitle} position at ${company}.

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
      const prompt = `You are an expert resume writer and ATS specialist.
Rewrite the provided resume, fully tailored for the "${jobTitle}" role described below.

${writingStyleContext ? `Writing style notes: ${writingStyleContext}\n` : ''}

════════════════════════════════════════
MANDATORY OUTPUT FORMAT (strict Markdown)
════════════════════════════════════════

# Full Name

Email | Phone | City, Country | linkedin.com/in/handle

## SUMMARY
2–3 sentence professional summary targeting this specific role and company context. Lead with seniority and strongest relevant skill. No filler phrases.

## EXPERIENCE

### Company Name — Job Title
*Month Year – Month Year (or Present)*

- Strong past-tense verb + what you did + measurable result (if original has numbers, keep them)
- [2–5 bullets per role, each on its own line]

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
RULES
════════════════════════════════════════
1. NEVER invent experience, companies, degrees, or metrics absent from the original resume.
2. Inject relevant keywords from the job description naturally into bullets and summary.
3. Strengthen weak bullets: "worked on X" → "Rebuilt X, reducing load time by Y%".
4. Remove irrelevant experience sections entirely if they add zero signal for this role.
5. Dates must be in "Mon Year" format (e.g. "Jan 2022 – Mar 2024").
6. Contact line must be a single line using "|" as separator.
7. Do NOT include any preamble, explanation, or commentary — output the resume only.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

────────────────────────────────────────
JOB DESCRIPTION
────────────────────────────────────────
${jobDescription.slice(0, 3000)}

────────────────────────────────────────
ORIGINAL RESUME
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
      return content.trim();
    },
    { jobTitle, jobDescription, resumeText, antiSlopEnabled, writingStyleContext }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 10: Cover Letter Generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCoverLetter(
  jobTitle: string,
  company: string,
  resumeText: string,
  antiSlopEnabled: boolean = true,
  writingStyleContext: string = ''
): Promise<string> {
  const prompt = `You are an expert career coach. Write a cover letter for the ${jobTitle} role at ${company}.

${writingStyleContext ? `Writing style notes: ${writingStyleContext}\n` : ''}

Rules:
- 3 paragraphs, 200–300 words total.
- Paragraph 1: Hook — specific connection to ${company} and the role. No generic opening.
- Paragraph 2: Value — 2 concrete achievements or skills from the resume that directly match the job.
- Paragraph 3: Close — direct, confident CTA. One sentence.
- Mention ${jobTitle} and ${company} explicitly.
- Do not fabricate experience. Ground everything in the resume text below.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume:
${resumeText.slice(0, 4000)}

Return ONLY the cover letter body. No "Dear Hiring Manager" salutation and no sign-off — the UI adds those.`;

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
