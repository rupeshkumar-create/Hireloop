# Pro Job Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the job-matching pipeline so Pro users reliably receive up to 10 real jobs per day through staged search fallback, smarter validation, and clearer dashboard messaging.

**Architecture:** Keep `generateDailyJobs()` as the orchestration entry point, but widen the retrieval pipeline in explicit stages. `serperService.ts` owns validation and retrieval diagnostics, `aiService.ts` owns staged search and ranking, and `useDashboardJobs.ts` owns user-facing messaging plus caching.

**Tech Stack:** React, TypeScript, Vite, Firebase/Firestore, Serper search API, OpenAI-backed ranking

---

### Task 1: Add Retrieval Options And Diagnostics

**Files:**
- Modify: `src/services/serperService.ts`
- Test: `npm run build`

- [ ] **Step 1: Add typed retrieval options and diagnostics containers**

Insert these types near the top of `src/services/serperService.ts` so later stages can request strict ATS-only validation or broader trusted company-career validation without changing callers again:

```ts
export interface SearchRemoteJobsOptions {
  allowedDomains?: string[];
  allowCompanyCareerPages?: boolean;
  maxQueries?: number;
}

export interface SearchRemoteJobsStats {
  queriesRun: number;
  jobsSeen: number;
  removedByDuplicate: number;
  removedByRemoteFilter: number;
  removedByFreshnessFilter: number;
  removedByMissingLink: number;
  removedByLinkValidation: number;
  removedByShapeValidation: number;
}

export interface SearchRemoteJobsResult {
  jobs: SerperJob[];
  stats: SearchRemoteJobsStats;
}
```

- [ ] **Step 2: Expand link validation so it can accept trusted company career pages**

Replace the single ATS-only allowlist with a richer set of trusted patterns while keeping noisy job boards blocked:

```ts
const VALID_ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'workable.com',
  'ashbyhq.com',
  'workday.com',
];

const BLOCKED_JOB_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'google.com',
];
```

Then update `validateJobLink()` to return validation metadata instead of a bare boolean:

```ts
export interface JobLinkValidationResult {
  valid: boolean;
  finalUrl: string;
}

export async function validateJobLink(
  url: string,
  allowedDomains: string[],
  allowCompanyCareerPages: boolean
): Promise<JobLinkValidationResult> {
  const response = await fetch('/api/validate-job-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowedDomains, allowCompanyCareerPages, blockedDomains: BLOCKED_JOB_DOMAINS }),
  });

  if (!response.ok) {
    return { valid: false, finalUrl: url };
  }

  const data = await response.json();
  return {
    valid: data.valid === true,
    finalUrl: typeof data.finalUrl === 'string' ? data.finalUrl : url,
  };
}
```

- [ ] **Step 3: Make `searchRemoteJobs()` return both jobs and stage diagnostics**

Update the function signature and track why jobs are rejected during retrieval:

```ts
export async function searchRemoteJobs(
  queries: string[],
  options: SearchRemoteJobsOptions = {}
): Promise<SearchRemoteJobsResult> {
  const stats: SearchRemoteJobsStats = {
    queriesRun: 0,
    jobsSeen: 0,
    removedByDuplicate: 0,
    removedByRemoteFilter: 0,
    removedByFreshnessFilter: 0,
    removedByMissingLink: 0,
    removedByLinkValidation: 0,
    removedByShapeValidation: 0,
  };

  const allJobs: SerperJob[] = [];
  const seen = new Set<string>();
  const allowedDomains = options.allowedDomains || VALID_ATS_DOMAINS;
  const queriesToSearch = queries.slice(0, options.maxQueries ?? queries.length);

  for (const query of queriesToSearch) {
    stats.queriesRun += 1;
    const response = await fetch('/api/serper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num: 30 }),
    });

    if (!response.ok) continue;

    const data = await response.json();
    const jobs: any[] = data.jobs || [];

    for (const job of jobs) {
      stats.jobsSeen += 1;
      const fp = jobFingerprint(job.title || '', job.company_name || '');
      if (seen.has(fp)) {
        stats.removedByDuplicate += 1;
        continue;
      }
      seen.add(fp);
    }
  }

  return { jobs: allJobs, stats };
}
```

Inside the loop, increment:

```ts
stats.jobsSeen += 1;
stats.removedByDuplicate += 1;
stats.removedByRemoteFilter += 1;
stats.removedByFreshnessFilter += 1;
stats.removedByMissingLink += 1;
stats.removedByLinkValidation += 1;
stats.removedByShapeValidation += 1;
```

when each corresponding branch skips a candidate.

- [ ] **Step 4: Update the validation API contract to support broader trusted destinations**

Modify `api/validate-job-link.ts` so the request body accepts `allowCompanyCareerPages` and `blockedDomains`, then computes `valid` from the resolved URL:

```ts
const allowCompanyCareerPages = req.body?.allowCompanyCareerPages === true;
const blockedDomains = Array.isArray(req.body?.blockedDomains)
  ? req.body.blockedDomains.filter((value: unknown): value is string => typeof value === 'string')
  : [];

const finalUrl = (response.url || url).toLowerCase();
const blocked = blockedDomains.some((domain) => finalUrl.includes(domain.toLowerCase()));
const allowed = allowedDomains.some((domain) => finalUrl.includes(domain.toLowerCase()));
const looksLikeCareerPage =
  allowCompanyCareerPages &&
  /careers|jobs|job-application|job\/|apply/.test(finalUrl) &&
  !blocked;

return res.status(200).json({ valid: !blocked && (allowed || looksLikeCareerPage), finalUrl });
```

- [ ] **Step 5: Run a build to catch type mismatches introduced by the new signatures**

Run: `npm run build`
Expected: build fails at first because callers still expect `searchRemoteJobs()` and `validateJobLink()` to return the old shapes.

- [ ] **Step 6: Commit the retrieval-layer changes**

```bash
git add src/services/serperService.ts api/validate-job-link.ts
git commit -m "feat(jobs): add retrieval diagnostics and flexible validation"
```

### Task 2: Add Staged Search And Pro Backfill

**Files:**
- Modify: `src/services/aiService.ts`
- Test: `npm run build`

- [ ] **Step 1: Add result metadata for the job generator**

Define a structured return shape so the dashboard can distinguish empty inventory from a partial fill or a Pro backfill:

```ts
export interface GenerateDailyJobsResult {
  jobs: RankedJob[];
  requestedLimit: number;
  usedBackfill: boolean;
  totalValidatedJobs: number;
  unseenCount: number;
  seenCount: number;
}
```

- [ ] **Step 2: Add helpers for stage execution and stat merging**

Insert focused helpers above `generateDailyJobs()`:

```ts
function mergeSearchStats(base: SearchRemoteJobsStats, next: SearchRemoteJobsStats): SearchRemoteJobsStats {
  return {
    queriesRun: base.queriesRun + next.queriesRun,
    jobsSeen: base.jobsSeen + next.jobsSeen,
    removedByDuplicate: base.removedByDuplicate + next.removedByDuplicate,
    removedByRemoteFilter: base.removedByRemoteFilter + next.removedByRemoteFilter,
    removedByFreshnessFilter: base.removedByFreshnessFilter + next.removedByFreshnessFilter,
    removedByMissingLink: base.removedByMissingLink + next.removedByMissingLink,
    removedByLinkValidation: base.removedByLinkValidation + next.removedByLinkValidation,
    removedByShapeValidation: base.removedByShapeValidation + next.removedByShapeValidation,
  };
}

async function runSearchStage(
  queries: string[],
  options: SearchRemoteJobsOptions
): Promise<SearchRemoteJobsResult> {
  return searchRemoteJobs(queries, options);
}
```

- [ ] **Step 3: Replace the single-pass retrieval flow with explicit stages**

Inside `generateDailyJobs()`, replace:

```ts
let realJobs: Awaited<ReturnType<typeof searchRemoteJobs>> = [];
realJobs = await searchRemoteJobs(optimizedQueries);
```

with staged retrieval:

```ts
let aggregatedStats: SearchRemoteJobsStats = {
  queriesRun: 0,
  jobsSeen: 0,
  removedByDuplicate: 0,
  removedByRemoteFilter: 0,
  removedByFreshnessFilter: 0,
  removedByMissingLink: 0,
  removedByLinkValidation: 0,
  removedByShapeValidation: 0,
};

let realJobs: SerperJob[] = [];

const strictStage = await runSearchStage(optimizedQueries, {
  allowedDomains: ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com', 'workday.com'],
  allowCompanyCareerPages: false,
  maxQueries: 5,
});
realJobs = mergeDedupJobs(realJobs, strictStage.jobs);
aggregatedStats = mergeSearchStats(aggregatedStats, strictStage.stats);

if (realJobs.length < limit) {
  const broaderStage = await runSearchStage(buildExpansionQueries(careerPaths, resumeText), {
    allowedDomains: ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com', 'workday.com'],
    allowCompanyCareerPages: false,
    maxQueries: 15,
  });
  realJobs = mergeDedupJobs(realJobs, broaderStage.jobs);
  aggregatedStats = mergeSearchStats(aggregatedStats, broaderStage.stats);
}

if (realJobs.length < limit) {
  const trustedCareerStage = await runSearchStage(buildExpansionQueries(careerPaths, resumeText), {
    allowedDomains: ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com', 'workday.com'],
    allowCompanyCareerPages: true,
    maxQueries: 20,
  });
  realJobs = mergeDedupJobs(realJobs, trustedCareerStage.jobs);
  aggregatedStats = mergeSearchStats(aggregatedStats, trustedCareerStage.stats);
}
```

- [ ] **Step 4: Split unseen and seen jobs, then add Pro-only backfill**

Replace the current single `unseenJobs` branch with separate pools:

```ts
const seenSet = new Set(seenFingerprints);
const unseenJobs = filteredJobs.filter((job) => !seenSet.has(jobFingerprint(job.title, job.company)));
const seenJobs = filteredJobs.filter((job) => seenSet.has(jobFingerprint(job.title, job.company)));

const unseenRankedJobs = await scoreAndRankJobs(unseenJobs, careerPaths, resumeText, limit);
let finalJobs = unseenRankedJobs.slice(0, limit);
let usedBackfill = false;

if (finalJobs.length < limit && limit > 1 && seenJobs.length > 0) {
  const backfillRankedJobs = await scoreAndRankJobs(seenJobs, careerPaths, resumeText, limit - finalJobs.length);
  finalJobs = [...finalJobs, ...backfillRankedJobs.slice(0, limit - finalJobs.length)];
  usedBackfill = backfillRankedJobs.length > 0;
}
```

Add a new helper so scoring logic is not duplicated:

```ts
async function scoreAndRankJobs(
  jobs: SerperJob[],
  careerPaths: string[],
  resumeText: string,
  limit: number
): Promise<RankedJob[]> {
  const jobsToScore = jobs.slice(0, Math.max(limit, 20));
  if (jobsToScore.length === 0) return [];

  const jobList = jobsToScore
    .map(
      (job, index) =>
        `[${index}] Title: ${job.title} | Company: ${job.company} | Location: ${job.location} | Salary: ${job.salary || 'Not listed'} | Posted: ${job.postedAt || 'Unknown'}\nDescription: ${job.description.substring(0, 400)}`
    )
    .join('\n\n');

  const scoringPrompt = `You are an expert technical recruiter.
Candidate Career Goals: ${careerPaths.join(', ')}
Candidate Resume:
${resumeText.substring(0, 2000)}

Jobs:
${jobList}`;

  try {
    const response = await callOpenAI([{ role: 'user', content: scoringPrompt }], undefined, 'openai/gpt-4o-mini');
    const parsedScores = parseJsonArray(response.choices?.[0]?.message?.content || '[]');
    return jobsToScore
      .map((job, index) => normalizeRankedJob(parsedScores[index] || {}, job))
      .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
      .slice(0, limit);
  } catch {
    return buildFallbackRankedJobs(jobsToScore, limit);
  }
}
```

- [ ] **Step 5: Add explicit logging for why the pool under-fills**

After the staged retrieval and before returning, log the final diagnostics:

```ts
console.log('Job retrieval stats:', aggregatedStats);
console.log('Validated jobs:', filteredJobs.length);
console.log('Unseen jobs:', unseenJobs.length);
console.log('Seen jobs:', seenJobs.length);
console.log('Used Pro backfill:', usedBackfill);
console.log('Final returned jobs:', finalJobs.length);
```

- [ ] **Step 6: Return structured metadata instead of a bare array**

End `generateDailyJobs()` with:

```ts
return {
  jobs: finalJobs,
  requestedLimit: limit,
  usedBackfill,
  totalValidatedJobs: filteredJobs.length,
  unseenCount: unseenJobs.length,
  seenCount: seenJobs.length,
};
```

Retain the existing fallback ranking inside `scoreAndRankJobs()` so no stage fabricates jobs.

- [ ] **Step 7: Run the build and verify the next failure shifts to the dashboard hook**

Run: `npm run build`
Expected: build fails because `useDashboardJobs.ts` still expects `generateDailyJobs()` to return `Job[]`.

- [ ] **Step 8: Commit the staged-retrieval changes**

```bash
git add src/services/aiService.ts
git commit -m "feat(jobs): add staged pro job retrieval and backfill"
```

### Task 3: Update Dashboard Messaging And Persistence

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`
- Test: `npm run build`

- [ ] **Step 1: Read the structured generator result in `fetchJobs()`**

Replace the current direct assignment:

```ts
const results = await generateDailyJobs(
  profile.careerPaths,
  'remote',
  profile.minSalary || null,
  profile.resumeText || '',
  limit,
  seenFingerprints,
  profile.learningProfile?.jobPreferences || ''
);
setJobs(results);
```

with:

```ts
const result = await generateDailyJobs(
  profile.careerPaths,
  'remote',
  profile.minSalary || null,
  profile.resumeText || '',
  limit,
  seenFingerprints,
  profile.learningProfile?.jobPreferences || ''
);

const results = result.jobs;
setJobs(results);
```

- [ ] **Step 2: Keep persistence compatible with the existing profile shape**

Continue saving only the jobs array to Firestore:

```ts
await setDoc(doc(db, 'users', user.uid), {
  dailyJobs: results,
  lastJobFetchTime: fetchTime,
  seenJobFingerprints: updatedSeen,
}, { merge: true });
```

No schema migration is needed for this pass.

- [ ] **Step 3: Replace the generic toast with outcome-specific messaging**

Update the toast branch at the end of `fetchJobs()`:

```ts
if (results.length === 0) {
  toast.error('Live search did not return enough valid remote matches right now. Please try again later.');
} else if (result.usedBackfill) {
  toast.success(`Found ${results.length} jobs. Today was light, so we included some strong repeat matches to fill your Pro list.`);
} else if (results.length < limit) {
  toast.info(`Found ${results.length} real matches. Live inventory was lighter than usual, so we returned the best available jobs.`);
} else {
  toast.success(`Found ${results.length} new jobs matching your profile!`);
}
```

- [ ] **Step 4: Keep the Pro daily target explicit in the hook**

Retain the current limit logic and add a small helper comment above it:

```ts
// Free stays at 1/day. Pro targets 10/day, with staged retrieval filling as much real inventory as possible.
const limit = profile?.plan?.toLowerCase() === 'pro' ? 10 : 1;
```

- [ ] **Step 5: Run the build until it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Check diagnostics on edited files**

Run the editor diagnostics for:

- `src/services/serperService.ts`
- `src/services/aiService.ts`
- `src/hooks/useDashboardJobs.ts`
- `api/validate-job-link.ts`

Expected: no new TypeScript errors in edited files.

- [ ] **Step 7: Commit the dashboard integration**

```bash
git add src/hooks/useDashboardJobs.ts
git commit -m "feat(dashboard): clarify partial and backfill job results"
```

### Task 4: Final Verification And Delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-04-15-pro-job-fill-implementation.md`
- Test: `git status --short`

- [ ] **Step 1: Re-run the production build one last time**

Run: `npm run build`
Expected: PASS with Vite output in `dist/`

- [ ] **Step 2: Inspect the final diff for only intended files**

Run: `git status --short`
Expected:

```text
M api/validate-job-link.ts
M src/hooks/useDashboardJobs.ts
M src/services/aiService.ts
M src/services/serperService.ts
```

plus this plan file while it is still being edited for checkbox progress.

- [ ] **Step 3: Mark completed steps in this plan**

Update this plan file so completed boxes reflect actual execution progress:

```md
- [x] **Step N: ...**
```

- [ ] **Step 4: Create the final implementation commit**

```bash
git add api/validate-job-link.ts src/hooks/useDashboardJobs.ts src/services/aiService.ts src/services/serperService.ts docs/superpowers/plans/2026-04-15-pro-job-fill-implementation.md
git commit -m "fix(jobs): fill pro daily matches with staged retrieval"
```

- [ ] **Step 5: Push once the user confirms remote delivery**

```bash
git push origin main
```

Expected: push succeeds and the branch contains the staged-retrieval fix.
