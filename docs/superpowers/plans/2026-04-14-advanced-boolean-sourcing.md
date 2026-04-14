# Enhance Job Search with Advanced Perplexity/Claude Web Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Currently, the system uses the fast/cheap model to generate a Google Jobs query. We will upgrade this by incorporating a more intelligent model (Claude) combined with internet search (Perplexity-style or advanced OpenRouter models with web access, or heavily optimized Boolean search strings for Serper) to deeply scour the web for perfect remote jobs, rather than just relying on generic job board scraping.

**Architecture:** 
1. We will update the prompt inside `generateDailyJobs` to force the AI to act as a **Senior Technical Sourcer**.
2. The AI will analyze the resume to extract the core tech stack (e.g., "React, TypeScript, Node.js, GraphQL").
3. Instead of simple titles, it will construct advanced Boolean search queries (e.g., `"remote" AND ("React" OR "Next.js") AND "TypeScript" AND ("Senior" OR "Lead") site:greenhouse.io OR site:lever.co OR site:workable.com`).
4. These advanced queries will be fed into Serper to scrape ATS systems directly, bypassing the noise of generic job boards and finding hidden remote gems.

**Tech Stack:** TypeScript, Serper API, OpenRouter (Gemini Flash for fast extraction).

---

### Task 1: Update the AI Query Generation Prompt

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Rewrite the `queryPrompt` in `generateDailyJobs`**
We will update the prompt to generate advanced Boolean strings targeting common ATS platforms (Greenhouse, Lever, Workable, Ashby) to find hidden remote jobs.

```typescript
// Replace the existing queryPrompt in generateDailyJobs with:
  const queryPrompt = `You are an elite Executive Technical Sourcer. Your goal is to find highly relevant, hidden remote jobs for this candidate by bypassing generic job boards and searching ATS (Applicant Tracking System) platforms directly.
  
Based on the candidate's resume and target career paths, generate 3 highly optimized Boolean search queries for Google.

Rules:
1. Every query MUST include the word "remote".
2. Extract the 2-3 most important technical skills or domain expertise from the resume and include them in the query (e.g., "React" AND "TypeScript").
3. Append ATS site operators to find direct company listings. Use this exact string at the end of every query: (site:greenhouse.io OR site:lever.co OR site:workable.com OR site:jobs.ashbyhq.com)
4. If a minimum salary is provided (${minSalary ? '$' + minSalary : 'none'}), try to append it logically.

Example Output format:
"remote" AND ("Frontend" OR "Full Stack") AND "TypeScript" AND "React" (site:greenhouse.io OR site:lever.co OR site:workable.com)

Target Paths: ${careerPaths.join(', ')}
Resume Snippet: ${resumeText.substring(0, 1000)}

Return a JSON array of exactly 3 strings. Respond ONLY with the JSON array.`;
```

### Task 2: Update Landing Page Copy to Highlight the AI Sourcer

**Files:**
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1: Expand the description of the Live Web Grounding section**
Make the copy sound much bigger and more advanced to reflect the new ATS-bypassing Boolean search capability.

```tsx
// Find the "Live Web Grounding" section (around line 225)
// Change the text to:
                <h3 className="text-3xl font-bold mb-4">Deep Web Sourcing</h3>
                <p className="text-lg text-zinc-500 leading-relaxed mb-6">
                  The AI acts as an elite executive sourcer. It deeply analyzes your specific tech stack and generates highly optimized Boolean search queries. Instead of scraping noisy job boards, it scours the internet and directly searches Applicant Tracking Systems (Greenhouse, Lever, Workable) to find hidden remote gems perfectly matched to your resume.
                </p>
// Update the bullet points below it:
                <ul className="space-y-3 text-zinc-600 font-medium">
                  <li className="flex items-center gap-2"><Globe className="h-5 w-5 text-zinc-900" /> Bypasses noisy job boards to find direct listings</li>
                  <li className="flex items-center gap-2"><Terminal className="h-5 w-5 text-zinc-900" /> Generates complex Boolean ATS queries based on your skills</li>
                  <li className="flex items-center gap-2"><Star className="h-5 w-5 text-zinc-900" /> Scores and ranks the hidden matches against your resume</li>
                </ul>

// Also update the fake terminal UI to reflect this (around line 208):
                    <p><TypewriterText text="> Initializing Deep Web Sourcing protocols..." delay={200} /></p>
                    <p><TypewriterText text='> Generating Boolean: "remote" AND "React" AND "TypeScript" (site:greenhouse.io OR site:lever.co)' delay={1200} /></p>
                    <p><TypewriterText text="> Bypassing job boards. Scraping direct ATS listings..." delay={2200} /></p>
```
