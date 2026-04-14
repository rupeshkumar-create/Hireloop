# Real Job Pipeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI-hallucinated job fallback with a real-search-only pipeline that validates ATS links, expands queries intelligently, and ranks jobs with richer scoring.

**Architecture:** Keep retrieval validation in `src/services/serperService.ts` and orchestration in `src/services/aiService.ts`. Use deterministic helpers for freshness, ATS quality, and fallback ranking while letting the LLM handle semantic scoring and enrichment.

**Tech Stack:** TypeScript, Firebase client app, Serper proxy, OpenRouter-backed model proxy

---

### Task 1: Harden Serper Retrieval

**Files:**
- Modify: `src/services/serperService.ts`

- [ ] **Step 1: Add ATS validation helpers**

```ts
const VALID_ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'workable.com',
  'ashbyhq.com',
  'workday.com',
  'jobs.',
];

export async function validateJobLink(url: string): Promise<boolean> {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (res.status === 405) {
      res = await fetch(url, { method: 'GET', redirect: 'follow' });
    }
    if (!res.ok) return false;
    const finalUrl = res.url.toLowerCase();
    return VALID_ATS_DOMAINS.some((domain) => finalUrl.includes(domain));
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add strict job validation**

```ts
function isValidJob(job: SerperJob): boolean {
  return (
    job.title.trim().length > 3 &&
    job.company.trim().length > 2 &&
    job.applyLink.startsWith('http') &&
    job.location.toLowerCase().includes('remote') &&
    job.description.trim().length > 0
  );
}
```

- [ ] **Step 3: Apply both checks inside the Serper loop**

```ts
const isValid = await validateJobLink(finalLink);
if (!isValid) continue;

const candidateJob: SerperJob = { ... };
if (!isValidJob(candidateJob)) continue;
allJobs.push(candidateJob);
```

### Task 2: Replace Query Generation

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Update the query model**

```ts
export async function callOpenAI(messages: any[], response_format?: any, model: string = 'google/gemini-2.0-flash') {
```

- [ ] **Step 2: Replace the query prompt with the approved ATS-only version**

```ts
const queryPrompt = `
You are a top 0.1% technical recruiter.

Your job is NOT to generate broad queries.
Your job is to find REAL, ACTIVE job postings.

- MUST include "remote"
- MUST include 1 job title
- MUST include 2 core skills
- MUST use ATS domains only:
(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workable.com OR site:jobs.workday.com)
- MUST avoid linkedin.com, indeed.com, naukri.com

Resume:
${resumeText.substring(0, 1000)}

Career Paths:
${careerPaths.join(', ')}

Return JSON array of 5 queries.
`;
```

### Task 3: Remove AI Job Fallback

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Delete `searchJobsWithAI()` and the fallback prompt block**

```ts
// Remove the entire searchJobsWithAI helper and the Step 2b fallback prompt path.
```

- [ ] **Step 2: Replace it with deterministic expansion helpers**

```ts
function buildExpansionQueries(careerPaths: string[], resumeText: string): string[] {
  return [
    'remote backend engineer node.js aws site:greenhouse.io',
    'remote full stack engineer react typescript site:lever.co',
    'remote software engineer typescript postgresql site:ashbyhq.com',
  ];
}
```

- [ ] **Step 3: Loop through additional real-search query batches until the limit or query pool is exhausted**

```ts
while (realJobs.length < limit && extraQueries.length > 0) {
  const nextBatch = extraQueries.splice(0, 5);
  const moreJobs = await searchRemoteJobs(nextBatch);
  realJobs = mergeDedup(realJobs, moreJobs);
}
```

### Task 4: Add Ranking Helpers

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Add deterministic scoring helpers**

```ts
function getFreshnessScore(daysOld: number) {
  return daysOld === 0 ? 100 : Math.max(20, 80 - daysOld * 10);
}

function getAtsQualityScore(link: string) {
  const url = link.toLowerCase();
  if (url.includes('greenhouse') || url.includes('lever.co') || url.includes('ashbyhq')) return 100;
  if (url.includes('workable') || url.includes('workday')) return 85;
  return 75;
}
```

- [ ] **Step 2: Update the scoring model to `openai/gpt-4o-mini`**

```ts
const response = await callOpenAI([{ role: 'user', content: scoringPrompt }], undefined, 'openai/gpt-4o-mini');
```

- [ ] **Step 3: Extend scoring output fields**

```ts
- companyQualityScore (number)
- companyQualityReason (string)
- isYC (boolean)
- isFundedStartup (boolean)
- salaryPrediction (string)
- salaryConfidence (string)
- salarySource (string)
- hotJobScore (number)
- hotSignals (string[])
```

- [ ] **Step 4: Compute `finalScore` in code**

```ts
const finalScore =
  matchScore * 0.45 +
  freshnessScore * 0.15 +
  atsQualityScore * 0.15 +
  companyQualityScore * 0.15 +
  hotJobScore * 0.10;
```

### Task 5: Add Logging And Conservative Fallback Ranking

**Files:**
- Modify: `src/services/aiService.ts`

- [ ] **Step 1: Log each pipeline stage**

```ts
console.log('Queries:', optimizedQueries);
console.log('Serper Jobs:', realJobs.length);
console.log('After Validation:', filteredJobs.length);
console.log('After Seen Filter:', unseenJobs.length);
```

- [ ] **Step 2: If LLM scoring fails, sort validated jobs by deterministic scores instead of returning fake jobs**

```ts
const fallbackRankedJobs = validatedJobs
  .map((job) => ({
    ...job,
    finalScore: getFreshnessScore(job.daysOld) * 0.5 + getAtsQualityScore(job.applyLink) * 0.5,
  }))
  .sort((a, b) => b.finalScore - a.finalScore)
  .slice(0, limit);
```

### Task 6: Verify

**Files:**
- Modify: `src/services/aiService.ts`
- Modify: `src/services/serperService.ts`

- [ ] **Step 1: Run diagnostics**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Run build**

```bash
npm run build
```
