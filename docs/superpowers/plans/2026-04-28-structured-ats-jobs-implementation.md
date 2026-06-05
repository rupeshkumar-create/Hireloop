# Structured-First ATS Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured-first job discovery using a Firestore ATS allowlist (Greenhouse + Lever) with strict remote-only filtering, URL verification, and AI top-up fallback to hit plan caps.

**Architecture:** Introduce ATS source adapters that normalize Greenhouse/Lever postings into the existing `DiscoveredJob` shape, then orchestrate ATS-first discovery inside `/api/jobs` before calling the existing AI discovery to fill remaining slots.

**Tech Stack:** TypeScript, Vercel serverless functions, Firebase Admin/Firestore, existing job pipeline (jobResearcher + jobMatchingEngine), Vitest.

---

## File Map

**Create**
- `src/services/jobSources/atsAllowlist.ts` — loads Firestore allowlist and returns enabled sources
- `src/services/jobSources/greenhouse.ts` — Greenhouse adapter (fetch + normalize)
- `src/services/jobSources/lever.ts` — Lever adapter (fetch + normalize)
- `src/services/jobSources/atsOrchestrator.ts` — bounded concurrency, remote-only filter, dedupe, verification
- `scripts/seed-job-sources.ts` — upsert ~50 companies into `job_sources`
- `src/services/jobSources/__tests__/atsAllowlist.test.ts` — token parsing + allowlist filtering
- `src/services/jobSources/__tests__/greenhouse.test.ts` — adapter normalization from sample payload
- `src/services/jobSources/__tests__/lever.test.ts` — adapter normalization from sample payload

**Modify**
- `api/jobs/index.ts` — ATS-first discovery, AI top-up fallback

---

### Task 1: Add ATS allowlist model + loader

**Files:**
- Create: `src/services/jobSources/atsAllowlist.ts`
- Test: `src/services/jobSources/__tests__/atsAllowlist.test.ts`

- [ ] **Step 1: Create allowlist loader (implementation skeleton)**

Create `src/services/jobSources/atsAllowlist.ts`:

```ts
export type AtsProvider = 'greenhouse' | 'lever';

export type AtsSource = {
  id: string;
  companyName: string;
  ats: AtsProvider;
  boardUrl: string;
  enabled: boolean;
  remoteOnly: boolean;
  tags: string[];
};

export function extractGreenhouseToken(boardUrl: string): string | null {
  try {
    const url = new URL(boardUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname !== 'boards.greenhouse.io') return null;
    const token = parts[0];
    return token ? token.trim() : null;
  } catch {
    return null;
  }
}

export function extractLeverToken(boardUrl: string): string | null {
  try {
    const url = new URL(boardUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname !== 'jobs.lever.co') return null;
    const token = parts[0];
    return token ? token.trim() : null;
  } catch {
    return null;
  }
}

export async function loadAtsAllowlist(getAdminDb: () => FirebaseFirestore.Firestore): Promise<AtsSource[]> {
  const db = getAdminDb();
  const snap = await db.collection('job_sources').where('enabled', '==', true).get();
  const sources: AtsSource[] = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const companyName = typeof data.companyName === 'string' ? data.companyName.trim() : '';
    const ats = data.ats === 'greenhouse' || data.ats === 'lever' ? data.ats : null;
    const boardUrl = typeof data.boardUrl === 'string' ? data.boardUrl.trim() : '';
    const enabled = data.enabled === true;
    const remoteOnly = data.remoteOnly !== false;
    const tags = Array.isArray(data.tags) ? data.tags.filter((t: any) => typeof t === 'string') : [];

    if (!companyName || !ats || !boardUrl || !enabled) return;
    sources.push({ id: doc.id, companyName, ats, boardUrl, enabled, remoteOnly, tags });
  });

  return sources;
}
```

- [ ] **Step 2: Write token parsing tests**

Create `src/services/jobSources/__tests__/atsAllowlist.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractGreenhouseToken, extractLeverToken } from '../atsAllowlist';

describe('atsAllowlist token parsing', () => {
  it('extracts greenhouse token', () => {
    expect(extractGreenhouseToken('https://boards.greenhouse.io/stripe')).toBe('stripe');
    expect(extractGreenhouseToken('https://boards.greenhouse.io/stripe/')).toBe('stripe');
  });

  it('rejects non-greenhouse urls', () => {
    expect(extractGreenhouseToken('https://example.com/stripe')).toBeNull();
  });

  it('extracts lever token', () => {
    expect(extractLeverToken('https://jobs.lever.co/notion')).toBe('notion');
    expect(extractLeverToken('https://jobs.lever.co/notion/')).toBe('notion');
  });

  it('rejects non-lever urls', () => {
    expect(extractLeverToken('https://example.com/notion')).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS (new test file included).

- [ ] **Step 4: Commit**

```bash
git add src/services/jobSources/atsAllowlist.ts src/services/jobSources/__tests__/atsAllowlist.test.ts
git commit -m "feat(jobs): add ats allowlist loader and token parsing"
```

---

### Task 2: Implement Greenhouse adapter (fetch + normalize)

**Files:**
- Create: `src/services/jobSources/greenhouse.ts`
- Test: `src/services/jobSources/__tests__/greenhouse.test.ts`

- [ ] **Step 1: Create adapter**

Create `src/services/jobSources/greenhouse.ts`:

```ts
import type { DiscoveredJob } from '../jobResearcher';
import { jobFingerprint } from '../jobResearcher';
import { extractGreenhouseToken } from './atsAllowlist';

type GreenhouseApiJob = {
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  created_at?: string;
  location?: { name?: string };
  content?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isRemoteLocationStrict(location: string): boolean {
  return /\bremote\b/i.test(location);
}

export function normaliseGreenhouseJob(companyName: string, raw: GreenhouseApiJob): DiscoveredJob | null {
  const title = (raw.title || '').trim();
  const location = (raw.location?.name || '').trim();
  const applyUrl = (raw.absolute_url || '').trim();
  const postedAt = (raw.updated_at || raw.created_at || new Date().toISOString()).toString();
  const description = stripHtml(String(raw.content || '')).slice(0, 4000);

  if (!title || !companyName || !applyUrl) return null;
  if (!location || !isRemoteLocationStrict(location)) return null;
  if (description.length < 80) return null;

  return {
    fingerprint: jobFingerprint(title, companyName),
    title,
    company: companyName,
    location,
    workType: 'remote',
    salary: '',
    description,
    requirements: [],
    source: 'ats-greenhouse' as any,
    applyUrl,
    postedAt,
    daysOld: 0,
  };
}

export async function fetchGreenhouseJobs(boardUrl: string, companyName: string, fetchFn: typeof fetch): Promise<DiscoveredJob[]> {
  const token = extractGreenhouseToken(boardUrl);
  if (!token) return [];
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  const res = await fetchFn(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray((data as any).jobs) ? (data as any).jobs : [];
  return jobs
    .map((j: any) => normaliseGreenhouseJob(companyName, j))
    .filter((j): j is DiscoveredJob => Boolean(j));
}
```

- [ ] **Step 2: Write adapter tests**

Create `src/services/jobSources/__tests__/greenhouse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normaliseGreenhouseJob } from '../greenhouse';

describe('greenhouse adapter', () => {
  it('normalizes a remote greenhouse job', () => {
    const job = normaliseGreenhouseJob('Stripe', {
      title: 'Software Engineer',
      absolute_url: 'https://boards.greenhouse.io/stripe/jobs/123',
      location: { name: 'Remote - US' },
      content: '<p>Build APIs for payments.</p>',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(job?.company).toBe('Stripe');
    expect(job?.workType).toBe('remote');
    expect(job?.applyUrl).toContain('greenhouse.io');
  });

  it('rejects non-remote locations', () => {
    const job = normaliseGreenhouseJob('Stripe', {
      title: 'Software Engineer',
      absolute_url: 'https://boards.greenhouse.io/stripe/jobs/123',
      location: { name: 'San Francisco, CA' },
      content: '<p>Build APIs</p>',
    });
    expect(job).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/jobSources/greenhouse.ts src/services/jobSources/__tests__/greenhouse.test.ts
git commit -m "feat(jobs): add greenhouse ats job adapter"
```

---

### Task 3: Implement Lever adapter (fetch + normalize)

**Files:**
- Create: `src/services/jobSources/lever.ts`
- Test: `src/services/jobSources/__tests__/lever.test.ts`

- [ ] **Step 1: Create adapter**

Create `src/services/jobSources/lever.ts`:

```ts
import type { DiscoveredJob } from '../jobResearcher';
import { jobFingerprint } from '../jobResearcher';
import { extractLeverToken } from './atsAllowlist';
import { isRemoteLocationStrict } from './greenhouse';

type LeverPosting = {
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  categories?: { location?: string };
  descriptionPlain?: string;
  description?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseLeverPosting(companyName: string, raw: LeverPosting): DiscoveredJob | null {
  const title = (raw.text || '').trim();
  const location = (raw.categories?.location || '').trim();
  const applyUrl = (raw.hostedUrl || '').trim();
  const postedAt = raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
  const descriptionSource = typeof raw.descriptionPlain === 'string' && raw.descriptionPlain.trim().length > 0
    ? raw.descriptionPlain
    : stripHtml(String(raw.description || ''));
  const description = descriptionSource.trim().slice(0, 4000);

  if (!title || !companyName || !applyUrl) return null;
  if (!location || !isRemoteLocationStrict(location)) return null;
  if (description.length < 80) return null;

  return {
    fingerprint: jobFingerprint(title, companyName),
    title,
    company: companyName,
    location,
    workType: 'remote',
    salary: '',
    description,
    requirements: [],
    source: 'ats-lever' as any,
    applyUrl,
    postedAt,
    daysOld: 0,
  };
}

export async function fetchLeverJobs(boardUrl: string, companyName: string, fetchFn: typeof fetch): Promise<DiscoveredJob[]> {
  const token = extractLeverToken(boardUrl);
  if (!token) return [];
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
  const res = await fetchFn(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  const postings = Array.isArray(data) ? data : [];
  return postings
    .map((p: any) => normaliseLeverPosting(companyName, p))
    .filter((j): j is DiscoveredJob => Boolean(j));
}
```

- [ ] **Step 2: Write adapter tests**

Create `src/services/jobSources/__tests__/lever.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normaliseLeverPosting } from '../lever';

describe('lever adapter', () => {
  it('normalizes a remote lever job', () => {
    const job = normaliseLeverPosting('Notion', {
      text: 'Backend Engineer',
      hostedUrl: 'https://jobs.lever.co/notion/abc',
      categories: { location: 'Remote - US' },
      descriptionPlain: 'Build backend systems for collaboration.',
      createdAt: Date.now(),
    });
    expect(job?.company).toBe('Notion');
    expect(job?.workType).toBe('remote');
    expect(job?.applyUrl).toContain('lever.co');
  });

  it('rejects non-remote locations', () => {
    const job = normaliseLeverPosting('Notion', {
      text: 'Backend Engineer',
      hostedUrl: 'https://jobs.lever.co/notion/abc',
      categories: { location: 'New York, NY' },
      descriptionPlain: 'Build backend systems.',
      createdAt: Date.now(),
    });
    expect(job).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/jobSources/lever.ts src/services/jobSources/__tests__/lever.test.ts
git commit -m "feat(jobs): add lever ats job adapter"
```

---

### Task 4: ATS orchestrator (bounded concurrency, dedupe, verify)

**Files:**
- Create: `src/services/jobSources/atsOrchestrator.ts`
- Modify (if needed): `src/services/linkVerifier.ts` or reuse existing
- Test: `src/services/jobSources/__tests__/atsOrchestrator.test.ts` (optional, keep minimal)

- [ ] **Step 1: Create orchestrator**

Create `src/services/jobSources/atsOrchestrator.ts`:

```ts
import type { DiscoveredJob } from '../jobResearcher';
import type { AtsSource } from './atsAllowlist';
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs } from './lever';

export type VerifyUrlFn = (url: string) => Promise<boolean>;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => ctrl.signal.addEventListener('abort', () => resolve(null))),
    ]);
  } finally {
    clearTimeout(t);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchAtsJobs(
  sources: AtsSource[],
  opts: {
    fetchFn: typeof fetch;
    verifyUrl: VerifyUrlFn;
    perSourceTimeoutMs?: number;
    concurrency?: number;
    maxJobs?: number;
    seenFingerprints?: string[];
  }
): Promise<DiscoveredJob[]> {
  const perSourceTimeoutMs = opts.perSourceTimeoutMs ?? 8000;
  const concurrency = opts.concurrency ?? 6;
  const maxJobs = opts.maxJobs ?? 60;
  const seen = new Set((opts.seenFingerprints || []).map((v) => String(v)));

  const batches = await mapWithConcurrency(sources, concurrency, async (source) => {
    const run = async () => {
      if (source.ats === 'greenhouse') return await fetchGreenhouseJobs(source.boardUrl, source.companyName, opts.fetchFn);
      if (source.ats === 'lever') return await fetchLeverJobs(source.boardUrl, source.companyName, opts.fetchFn);
      return [];
    };
    const result = await withTimeout(run(), perSourceTimeoutMs);
    return result || [];
  });

  const flattened = batches.flat();
  const deduped: DiscoveredJob[] = [];
  const batchSeen = new Set<string>();

  for (const job of flattened) {
    if (!job || !job.fingerprint) continue;
    if (seen.has(job.fingerprint)) continue;
    if (batchSeen.has(job.fingerprint)) continue;
    batchSeen.add(job.fingerprint);
    deduped.push(job);
    if (deduped.length >= maxJobs) break;
  }

  const verified: DiscoveredJob[] = [];
  for (const job of deduped) {
    if (!job.applyUrl) continue;
    const ok = await opts.verifyUrl(job.applyUrl);
    if (ok) verified.push(job);
    if (verified.length >= maxJobs) break;
  }

  return verified;
}
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS (no new tests required yet).

- [ ] **Step 3: Commit**

```bash
git add src/services/jobSources/atsOrchestrator.ts
git commit -m "feat(jobs): add ats orchestrator with verification"
```

---

### Task 5: Wire ATS-first discovery into `/api/jobs`

**Files:**
- Modify: `api/jobs/index.ts`

- [ ] **Step 1: Add ATS-first discovery inside generateJobs**

In `api/jobs/index.ts`, update `generateJobs` to:
1) Load allowlist via `loadAtsAllowlist(() => db)`
2) Fetch ATS jobs via `fetchAtsJobs(...)` with URL verification
3) If ATS count < target, call existing `researchJobs` for the missing count (AI fallback)

Implementation sketch (drop into `generateJobs`):

```ts
import { loadAtsAllowlist } from '../../src/services/jobSources/atsAllowlist';
import { fetchAtsJobs } from '../../src/services/jobSources/atsOrchestrator';
import { verifyHttpUrl } from '../../src/services/linkVerifier';

// inside generateJobs:
const atsSources = await loadAtsAllowlist(() => db);
const atsJobs = await fetchAtsJobs(atsSources, {
  fetchFn: fetch,
  verifyUrl: async (url) => {
    const result = await verifyHttpUrl(url);
    return result.ok;
  },
  seenFingerprints,
  maxJobs: 60,
});

const target = Math.max(0, limit);
let discovered = atsJobs.slice(0, target);
if (discovered.length < target) {
  const remaining = target - discovered.length;
  const aiResult = await researchJobs(
    { careerPaths, resumeText, jobType, location, targetCount: Math.max(20, remaining * 2) },
    callAI
  );
  const extra = aiResult.jobs.filter((j) => !new Set(discovered.map((d) => d.fingerprint)).has(j.fingerprint));
  discovered = [...discovered, ...extra].slice(0, target);
}
```

- [ ] **Step 2: Run typecheck + tests**

Run:
- `npm run lint`
- `npm test`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/jobs/index.ts
git commit -m "feat(jobs): prefer ats allowlist sources before ai discovery"
```

---

### Task 6: Seed script for 50 companies

**Files:**
- Create: `scripts/seed-job-sources.ts`

- [ ] **Step 1: Create seed list**

Create `scripts/seed-job-sources.ts` that:
- Initializes Firebase Admin (reuse patterns from existing scripts)
- Upserts documents into `job_sources`
- Uses deterministic IDs (e.g. slug of companyName)

Seed entries should be a mix of:
- Greenhouse companies (`https://boards.greenhouse.io/<token>`)
- Lever companies (`https://jobs.lever.co/<token>`)

- [ ] **Step 2: Run seed script locally**

Run (example):
`node --loader tsx scripts/seed-job-sources.ts`

Expected: logs of upserted docs.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-job-sources.ts
git commit -m "chore(jobs): add firestore seed for ats allowlist sources"
```

---

### Task 7: Update docs + push

**Files:**
- Modify: `SYSTEM_FLOW.md` (optional summary)
- Modify: `JOB_ENGINE_FLOW.md` (optional summary)
- Ensure spec and plan are committed

- [ ] **Step 1: Commit spec + plan**

```bash
git add docs/superpowers/specs/2026-04-28-structured-ats-jobs-design.md docs/superpowers/plans/2026-04-28-structured-ats-jobs-implementation.md
git commit -m "docs(jobs): add structured ats allowlist design and plan"
```

- [ ] **Step 2: Push**

```bash
git push origin main
```

---
