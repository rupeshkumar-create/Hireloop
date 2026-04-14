import { searchRemoteJobs, jobFingerprint } from './serperService';

async function callOpenAI(messages: any[], response_format?: any, model: string = 'google/gemini-3-flash-preview') {
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
// Real jobs sourced from Serper (Google Jobs), scored by OpenAI against resume.
// Falls back to pure AI generation if Serper is not configured or returns nothing.
// Always fetches 10 jobs for every user.
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
  // ---- Step 0: Generate Optimized Search Queries using Gemini ----
  const queryPrompt = `You are an elite Executive Technical Sourcer with 20 years of experience. Your goal is to find highly relevant, active remote jobs for this candidate by bypassing generic job boards and searching ATS (Applicant Tracking System) platforms directly.
  
Execute a 23-step internal verification process to analyze the candidate's core competencies, seniority, and domain expertise. Based on this deep analysis of the resume and target career paths, generate 3 highly optimized Boolean search queries for Google.

Hidden User Preferences learned from past behavior: ${learningContext}
Incorporate these preferences when generating the search queries.

Rules:
1. Every query MUST include the word "remote".
2. Extract the 2-3 most important technical skills or domain expertise from the resume and include them in the query (e.g., "React" AND "TypeScript").
3. Append ATS site operators to find direct company listings. Use this exact string at the end of every query: (site:greenhouse.io OR site:lever.co OR site:workable.com OR site:jobs.ashbyhq.com)
4. If a minimum salary is provided (${minSalary ? '$' + minSalary : 'none'}), try to append it logically.
5. Apply strict filters to exclude jobs older than 7 days if your boolean string permits.
6. EXPLICITLY TARGET these platforms in your boolean strings when possible: linkedin.com, indeed.com, flexjobs.com, weworkremotely.com, remote.co, builtin.com, wellfound.com, remoteok.com, weworkremotely.com, authenticjobs.com.

Example Output format:
"remote" AND ("Frontend" OR "Full Stack") AND "TypeScript" AND "React" (site:greenhouse.io OR site:lever.co OR site:workable.com OR site:weworkremotely.com OR site:remote.co)

Target Paths: ${careerPaths.join(', ')}
Resume Snippet: ${resumeText.substring(0, 1000)}

Return a JSON array of exactly 3 strings. Respond ONLY with the JSON array.`;

  let optimizedQueries: string[] = [];
  try {
    const queryResponse = await callOpenAI([{ role: 'user', content: queryPrompt }], { type: 'json_object' });
    if (queryResponse.choices?.[0]?.message?.content) {
      const parsed = JSON.parse(queryResponse.choices[0].message.content);
      optimizedQueries = Array.isArray(parsed) ? parsed : (parsed.queries || Object.values(parsed)[0] || []);
    }
  } catch (error) {
    console.error('Error generating optimized queries, falling back to basic paths:', error);
  }

  // Fallback to basic string concatenation if AI fails or returns empty
  if (!optimizedQueries || optimizedQueries.length === 0) {
    const salaryPart = minSalary ? ` salary $${minSalary.toLocaleString()}+` : '';
    optimizedQueries = careerPaths.slice(0, 3).map(path => `remote ${path}${salaryPart}`);
  }

  // ---- Step 1: fetch real jobs from Serper using optimized queries ----
  let realJobs: Awaited<ReturnType<typeof searchRemoteJobs>> = [];
  try {
    realJobs = await searchRemoteJobs(optimizedQueries);
  } catch (err) {
    console.warn('Serper unavailable, falling back to AI-generated jobs:', err);
  }

  // ---- Deduplicate: remove jobs this user has already seen ----
  if (seenFingerprints.length > 0) {
    const seenSet = new Set(seenFingerprints);
    realJobs = realJobs.filter(j => !seenSet.has(jobFingerprint(j.title, j.company)));
  }

  // ---- NEW STEP: Limit Daily Jobs to 'limit' (10 for Pro, 1 for Free) ----
  // Any extra jobs found are simply not processed today, saving them to be potentially found tomorrow 
  // since their fingerprints are not added to the seen list yet.
  if (realJobs.length > limit) {
    realJobs = realJobs.slice(0, limit);
  }

  // ---- Step 2a: real jobs found → use OpenAI to score & format ----
  if (realJobs.length > 0) {
    const jobsToScore = realJobs.slice(0, 20); // cap prompt size
    const jobList = jobsToScore
      .map(
        (j, i) =>
          `[${i}] Title: ${j.title} | Company: ${j.company} | Location: ${j.location} | Salary: ${j.salary || 'Not listed'} | Posted: ${j.postedAt || 'Unknown'}\nDescription: ${j.description.substring(0, 300)}`
      )
      .join('\n\n');

    const applyLinks = jobsToScore.map((j, i) => `[${i}] ${j.applyLink}`).join('\n');

    const scoringPrompt = `You are an expert technical recruiter. Below are ${jobsToScore.length} REAL remote job listings retrieved live from Google Jobs today.

Your tasks:
1. Score each job (0-100 matchScore) against the candidate's resume and career goals.
2. Extract 3-5 key requirements per job.
3. Return only the top ${limit} jobs sorted by matchScore descending.
4. Keep location and description as-is - this is real data. Do NOT fabricate.
5. If salary is missing, write "Competitive".

Candidate Career Goals: ${careerPaths.join(', ')}
Candidate Resume:
${resumeText.substring(0, 2000)}

Real Job Listings:
${jobList}

Apply Links (index matches job list):
${applyLinks}

Return a JSON array of exactly ${limit} objects (or fewer if fewer jobs are available):
- title (string)
- company (string)
- location (string)
- salary (string)
- description (string) - preserve original description
- url (string) - use the matching apply link from above
- requirements (array of 3-5 strings)
- matchScore (number 0-100)
- datePosted (string ISO format, e.g. "2026-04-10T00:00:00Z")

Respond ONLY with the JSON array. No markdown.`;

    try {
      const response = await callOpenAI([{ role: 'user', content: scoringPrompt }]);

      if (response.choices?.[0]?.message?.content) {
        let text = response.choices[0].message.content.trim();
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();

        try {
          return JSON.parse(text);
        } catch {
          const match = text.match(/\[[\s\S]*\]/);
          if (match) return JSON.parse(match[0]);
        }
      }
    } catch (error: any) {
      console.error('Error scoring real jobs:', error);
      if (error?.status === 429 || error?.message?.includes('quota')) {
        throw new Error('AI quota exceeded. Please try again later or check your API key plan.');
      }
    }
  }

  // ---- Step 2b: Serper unavailable or returned nothing - AI fallback ----
  const fallbackPrompt = `You are an expert technical recruiter specializing in REMOTE job opportunities.
Provide exactly ${limit} highly realistic REMOTE job postings based on current market trends.
Every job MUST be a fully remote position (work from home / work from anywhere). Never include hybrid or on-site roles.

Match against:
- Career Paths/Desired Titles: ${careerPaths.join(', ')}
- Work Type: REMOTE ONLY (100% remote, work from anywhere)
- Minimum Salary: ${minSalary ? '$' + minSalary : 'Any'}

Candidate Resume:
${resumeText.substring(0, 3000)}

STRICT RULES:
1. ALL ${limit} jobs MUST be fully remote. No hybrid or on-site.
2. Location must clearly say "Remote" or "Remote (Worldwide)" or "Remote (US)".
3. Calculate matchScore (0-100) for how well the job fits the resume.

Return a JSON array of EXACTLY ${limit} objects:
- title (string)
- company (string)
- location (string) - must contain "Remote"
- salary (string)
- description (string)
- url (string) - https://www.google.com/search?q=remote+job+[URL-encoded title]+at+[URL-encoded company]
- requirements (array of strings)
- matchScore (number)
- datePosted (string ISO format)

Respond ONLY with the JSON array. No markdown.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: fallbackPrompt }]);

    if (response.choices?.[0]?.message?.content) {
      let text = response.choices[0].message.content.trim();
      if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();

      try {
        return JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) return JSON.parse(match[0]);
        return [];
      }
    }
    return [];
  } catch (error: any) {
    console.error('Error generating jobs (fallback):', error);
    if (error?.status === 429 || error?.message?.includes('quota')) {
      throw new Error('AI quota exceeded. Please try again later or check your API key plan.');
    }
    return [];
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
