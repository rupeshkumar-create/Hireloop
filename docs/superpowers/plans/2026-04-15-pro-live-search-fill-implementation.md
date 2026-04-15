# Pro Live Search Fill (10 Jobs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro users consistently receive up to 10 relevant remote jobs with apply links by adding a Pro-only job-board fill stage and improving link/remote validation while keeping Free behavior strict.

**Architecture:** Keep the existing ATS-first pipeline, then add a Pro-only fallback stage that allows selected job boards (LinkedIn/Indeed + optional others) and skips network link validation for those domains to avoid bot-block false negatives. Expand Pro freshness window to 14 days.

**Tech Stack:** Vite + React + TypeScript, Vercel serverless functions (`api/*`), Serper-based search (`/api/serper`), Firestore for persistence.

---

## Files Overview

**Modify**
- [serperService.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/serperService.ts)
- [validate-job-link.ts (API)](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/validate-job-link.ts)
- [aiService.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/aiService.ts)

**No new dependencies** (validate via `npm run lint`).

---

### Task 1: Extend link validation to support Pro job boards (skip network fetch)

**Files:**
- Modify: [validate-job-link.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/validate-job-link.ts)
- Modify: [serperService.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/serperService.ts)

- [ ] **Step 1: Update API contract to accept skip-network domains**

Update handler parsing to include:
- `skipNetworkFetchForDomains?: string[]`

Implementation sketch (exact code to apply inside the handler):

```ts
const skipNetworkFetchForDomains = Array.isArray(req.body?.skipNetworkFetchForDomains)
  ? req.body.skipNetworkFetchForDomains.filter((value: unknown): value is string => typeof value === 'string')
  : [];
```

- [ ] **Step 2: Implement “skip fetch” path**

If `skipNetworkFetchForDomains` contains a domain included in the request URL, do not call `fetch()` and instead:
- use `finalUrl = url.toLowerCase()`
- compute `valid` using existing blocked/allowed/looksLikeCareerPage logic

Expected behavior:
- LinkedIn/Indeed links can pass validation if included in `allowedDomains` and not in `blockedDomains`, even when bot-blocked to `HEAD/GET`.

- [ ] **Step 3: Update client validateJobLink() to forward new options**

Update `validateJobLink()` signature to accept:
- `blockedDomains?: string[]`
- `skipNetworkFetchForDomains?: string[]`

Update POST body accordingly.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: exit code 0.

---

### Task 2: Improve Serper job extraction (better apply link choice + remote shape fix + configurable freshness)

**Files:**
- Modify: [serperService.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/serperService.ts)

- [ ] **Step 1: Add configurable freshness window**

Extend `SearchRemoteJobsOptions`:
- `maxDaysOld?: number`

Replace the hard-coded `> 7` filter with:

```ts
const maxDaysOld = options.maxDaysOld ?? 7;
if (daysOld > maxDaysOld) { ... }
```

- [ ] **Step 2: Allow overriding blocked domains and skip-network domains**

Extend `SearchRemoteJobsOptions`:
- `blockedDomains?: string[]`
- `skipNetworkFetchForDomains?: string[]`

Thread these through to `validateJobLink()`.

- [ ] **Step 3: Choose the best apply link (prefer external apply)**

Replace the “apply_options[0] only” behavior with:
- Collect candidate URLs from:
  - `job.apply_options[].link` (all)
  - `job.apply_link`
  - `job.link`
- Prefer URLs in this order:
  1. ATS domains
  2. Careers-looking links (when allowed)
  3. Allowlisted job boards (when configured for Pro)

Implementation should be local to `serperService.ts` and return one chosen URL for validation.

- [ ] **Step 4: Fix remote “shape validation” false negatives**

Ensure that when Serper indicates the job is remote (via `schedule_type` or `work_from_home`), the stored `location` string contains `Remote` so it passes existing UI and downstream logic.

Example:
- If `loc` does not include `remote`, store `location: 'Remote'` (or `Remote (${loc})`).

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run lint
```

Expected: exit code 0.

---

### Task 3: Add Pro-only board fill stage + Pro freshness = 14 days

**Files:**
- Modify: [aiService.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/aiService.ts)

- [ ] **Step 1: Add deterministic job-board queries**

Add a helper near the other query builders:
- `buildBoardQueries(careerPaths, resumeText)`

It should generate queries like:
`remote "<title>" "<skill1>" "<skill2>" site:linkedin.com/jobs`
and similarly for Indeed (+ optionally Glassdoor/ZipRecruiter).

- [ ] **Step 2: Make freshness window Pro-aware**

Use:
- `maxDaysOld = 7` for Free
- `maxDaysOld = 14` for Pro

Apply this to:
- trusted career-pages stage
- Pro board stage

- [ ] **Step 3: Add Pro board stage**

When `limit > 1` and `realJobs.length < limit`, run `searchRemoteJobs()` using board queries with options:
- `allowedDomains`: ATS + job board domains
- `blockedDomains`: exclude job board domains (keep google blocked)
- `skipNetworkFetchForDomains`: job board domains
- `allowCompanyCareerPages: true`
- `maxDaysOld: 14`

Merge results with existing `mergeDedupJobs()` flow.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: exit code 0.

---

### Task 4: Manual end-to-end verification (dev server)

**Files:**
- No code changes required (verification only)

- [ ] **Step 1: Start dev server**

Run:

```bash
npm install
npm run dev
```

Expected: Vite server starts on port 3000.

- [ ] **Step 2: Verify Pro path**

In app:
- Ensure a Pro user profile exists with:
  - `plan: "pro"`
  - valid `careerPaths`
  - non-empty `resumeText`
- Trigger job fetch.

Expected:
- Returned jobs list length is typically 10 (or fewer with an info toast).
- Links include ATS/careers when available; otherwise can include LinkedIn/Indeed.
- The previous hard error toast appears only if results are truly 0.

---

## Spec Coverage Self-Check

- Pro-only board stage: Task 3
- Prefer external apply links: Task 2 (Step 3)
- Skip network validation for boards: Task 1
- Pro freshness = 14 days: Task 2 + Task 3
- Remote shape false negatives fixed: Task 2 (Step 4)

