# Enhance Job Search with AI Semantic Matching

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow AI to generate optimized search queries based on the user's resume, instead of just using rigid predefined "career paths," to find much better, broader, and more accurate job matches from Serper.

**Architecture:** 
Currently, the app relies on the user typing in exact `careerPaths` (e.g., "Frontend Developer"), which are then passed directly into Serper as rigid text queries (`remote Frontend Developer`). This misses a lot of jobs.
We will:
1. Update `generateDailyJobs` to first use the AI (Worker Model) to generate 3 highly optimized, semantic Google search queries based on the user's resume and their stated career paths.
2. Pass those AI-generated queries to Serper instead of the raw career paths.
3. This creates a "Semantic Search" pipeline where the AI acts as an expert Boolean sourcer before scraping Google Jobs.

**Tech Stack:** React, TypeScript, OpenRouter.

---

### Task 1: Update `searchRemoteJobs` to accept arbitrary queries

**Files:**
- Modify: `src/services/serperService.ts`

- [ ] **Step 1: Change `searchRemoteJobs` signature and logic**
Instead of taking `careerPaths` and building the query internally, make it take an array of `queries` directly.

```typescript
export async function searchRemoteJobs(
  queries: string[]
): Promise<SerperJob[]> {
  const allJobs: SerperJob[] = [];
  const seen = new Set<string>();

  // Ensure we don't spam the API if the array is huge
  const queriesToSearch = queries.slice(0, 3);

  for (const query of queriesToSearch) {
    try {
      const response = await fetch('/api/serper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num: 10 }),
      });
// ... rest of the existing code (parsing, deduplication, etc) remains the same
```

### Task 2: Generate Optimized Queries in `generateDailyJobs`

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Add a prompt to generate Serper queries before searching**
Inside `generateDailyJobs`, before calling `searchRemoteJobs`, ask the AI to generate the queries.

```typescript
export async function generateDailyJobs(
  careerPaths: string[],
  _jobType: string,
  minSalary: number | null,
  resumeText: string,
  limit: number = 1,
  seenFingerprints: string[] = []
) {
  // ---- NEW: Generate Optimized Search Queries ----
  const queryPrompt = `You are an expert technical sourcer. Based on the candidate's resume and target career paths, generate 3 highly effective Google Jobs search queries.
  
Rules:
1. ALL queries MUST include the word "remote".
2. If a minimum salary is provided (${minSalary ? '$' + minSalary : 'none'}), try to append it logically (e.g. "salary $100k+").
3. Use variations of the target titles and core skills found in the resume to maximize results.
4. Keep them concise, like a human typing into Google.

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

  // Fallback to basic string concatenation if AI fails
  if (!optimizedQueries || optimizedQueries.length === 0) {
    const salaryPart = minSalary ? \` salary $\${minSalary.toLocaleString()}+\` : '';
    optimizedQueries = careerPaths.slice(0, 3).map(path => \`remote \${path}\${salaryPart}\`);
  }

  // ---- Step 1: fetch real jobs from Serper using optimized queries ----
  let realJobs: Awaited<ReturnType<typeof searchRemoteJobs>> = [];
  try {
    realJobs = await searchRemoteJobs(optimizedQueries);
  } catch (err) {
// ... rest of the existing code
```
