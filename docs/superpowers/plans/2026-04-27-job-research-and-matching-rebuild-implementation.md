# Job Research And Matching Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the full AI-powered job research and matching system so HireSchema can fetch, rank, store, and deliver real jobs from server-side pipeline runs.

**Architecture:** Keep one orchestrated server-side pipeline, but split the work into focused units: profile/readiness, source collection, normalization/validation, ranking/enrichment, delivery/storage, and dashboard loading. Reuse existing entry points such as `api/jobs/index.ts`, `api/cron/daily-alerts.ts`, `api/cron/process-user.ts`, `src/services/cronEngine.ts`, and `src/hooks/useDashboardJobs.ts`, but replace the old remote-only implementation with the new contracts from the rebuild spec.

**Tech Stack:** TypeScript, React 19, Firebase Firestore, Vercel serverless routes, Vitest, OpenRouter-backed LLM calls through `api/openai.ts`-compatible server helpers

---

## File Structure

### Create

- `src/services/jobProfileEngine.ts`
  - Build `JobPipelineProfile`, refresh career paths from resume text, and compute readiness snapshot for each run.
- `src/services/jobSourceAdapters.ts`
  - Define adapter contracts and structured-source fetch orchestration.
- `src/services/jobSearchFallback.ts`
  - Generate live-search queries and parse fallback search results.
- `src/services/jobNormalizer.ts`
  - Convert provider-specific raw items into the shared `DailyJobCandidate` shape and fingerprint them.
- `src/services/jobValidator.ts`
  - Apply deterministic hard filters before ranking.
- `src/services/jobDeliveryEngine.ts`
  - Persist daily batch + latest snapshot and update delivery metadata.
- `src/services/__tests__/jobProfileEngine.test.ts`
- `src/services/__tests__/jobSourceAdapters.test.ts`
- `src/services/__tests__/jobValidator.test.ts`
- `src/services/__tests__/jobDeliveryEngine.test.ts`
- `src/services/__tests__/jobPipelineIntegration.test.ts`

### Modify

- `src/types/dailyJob.ts`
  - Replace the legacy remote-first shape with the rebuild contract.
- `src/types/dashboard.ts`
  - Align dashboard-facing types with the rebuilt `DailyJob` shape and metadata.
- `src/services/jobMatchingEngine.ts`
  - Refactor to score validated candidates and enrich the selected jobs.
- `src/services/jobResearcher.ts`
  - Reduce this file to a thin compatibility wrapper or remove it after callers migrate to the new source pipeline.
- `src/services/cronEngine.ts`
  - Make it orchestrate the new pipeline stages and log degraded-mode outcomes.
- `src/services/emailService.ts`
  - Add a dedicated daily-match email payload builder/sender interface for the new snapshot metadata.
- `src/hooks/useDashboardJobs.ts`
  - Load `latestJobs`, `latestJobsMeta`, and `daily_matches` history instead of relying on same-day-only cache logic.
- `src/components/dashboard/MatchesTab.tsx`
  - Render latest snapshot status, manual refresh state, historical batches, and degraded-mode messaging.
- `src/components/dashboard/JobDetailsPanel.tsx`
  - Display source, match reasons, skill gaps, run metadata, and apply URL from the rebuilt job shape.
- `api/jobs/index.ts`
  - Use the new pipeline and return the rebuild response contract.
- `api/cron/daily-alerts.ts`
  - Queue per-user runs using the rebuilt orchestration and due-user selection.
- `api/cron/process-user.ts`
  - Run one user pipeline with internal auth and run logging.
- `src/services/__tests__/cronEngine.test.ts`
  - Update expectations to cover `success | partial | blocked | failed`.
- `src/components/dashboard/__tests__/MatchesTab.test.ts`
  - Replace placeholder assertions with rebuilt dashboard expectations.

### Existing Files To Read Before Coding

- `docs/superpowers/specs/2026-04-27-job-research-and-matching-rebuild-design.md`
- `src/services/aiService.ts`
- `src/services/jobDeliveryProfile.ts`
- `src/services/cronEngine.ts`
- `api/jobs/index.ts`
- `src/hooks/useDashboardJobs.ts`
- `src/types/dailyJob.ts`

### Shared Contracts To Use

```ts
type JobRunStatus = 'success' | 'partial' | 'blocked' | 'failed';

interface DailyJob {
  id: string;
  fingerprint: string;
  source: string;
  sourceType: 'api' | 'search';
  title: string;
  company: string;
  location?: string;
  workType?: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  salary?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  description: string;
  requirements: string[];
  applyUrl: string;
  canonicalUrl?: string;
  postedAt?: string;
  matchedCareerPath?: string;
  matchScore?: number;
  finalScore?: number;
  matchReasons?: string[];
  skillGaps?: string[];
  aiSummary?: string;
  qualitySignals?: string[];
}

interface LatestJobsMeta {
  runId: string;
  generatedAt: string;
  status: JobRunStatus;
  selectedCount: number;
  sourceCounts: Record<string, number>;
  degradedReasons: string[];
}
```

### Delivery Rule

```ts
const shouldSendDailyEmail = (status: JobRunStatus, jobs: DailyJob[]) =>
  (status === 'success' || status === 'partial') && jobs.length > 0;
```

## Tasks

### Task 1: Lock The Shared Contracts

**Files:**
- Modify: `src/types/dailyJob.ts`
- Modify: `src/types/dashboard.ts`
- Test: `src/services/__tests__/jobPipelineContracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest';
import type { DailyJob, DailyMatchesDocument, LatestJobsMeta } from '../../types/dailyJob';

describe('job pipeline contracts', () => {
  it('accepts the rebuild daily job shape', () => {
    const job: DailyJob = {
      id: 'acme-frontend-engineer',
      fingerprint: 'frontend engineer::acme',
      source: 'greenhouse',
      sourceType: 'api',
      title: 'Frontend Engineer',
      company: 'Acme',
      location: 'Remote - US',
      workType: 'remote',
      salary: '$140k-$165k',
      salaryMin: 140000,
      salaryMax: 165000,
      description: 'Build the product UI for enterprise customers.',
      requirements: ['React', 'TypeScript'],
      applyUrl: 'https://jobs.example.com/acme/frontend',
      canonicalUrl: 'https://jobs.example.com/acme/frontend',
      postedAt: '2026-04-27T00:00:00.000Z',
      matchedCareerPath: 'Frontend Engineer',
      matchScore: 92,
      finalScore: 94,
      matchReasons: ['Strong React overlap'],
      skillGaps: ['GraphQL'],
      aiSummary: 'A strong frontend role for a React-heavy profile.',
      qualitySignals: ['Recent posting'],
    };

    const meta: LatestJobsMeta = {
      runId: 'user_123_2026-04-27',
      generatedAt: '2026-04-27T03:00:00.000Z',
      status: 'success',
      selectedCount: 1,
      sourceCounts: { greenhouse: 1 },
      degradedReasons: [],
    };

    const batch: DailyMatchesDocument = {
      userId: 'user_123',
      dateKey: '2026-04-27',
      generatedAt: '2026-04-27T03:00:00.000Z',
      runId: 'user_123_2026-04-27',
      status: 'success',
      jobs: [job],
      meta: {
        sourceCounts: { greenhouse: 1 },
        validatedCount: 1,
        rankedCount: 1,
        selectedCount: 1,
        degradedReasons: [],
      },
    };

    expect(batch.jobs[0].sourceType).toBe('api');
    expect(meta.status).toBe('success');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/jobPipelineContracts.test.ts`
Expected: FAIL with missing exported types or incompatible fields in `src/types/dailyJob.ts`

- [ ] **Step 3: Write the minimal implementation**

```ts
export type JobRunStatus = 'success' | 'partial' | 'blocked' | 'failed';
export type JobSourceType = 'api' | 'search';
export type JobWorkType = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export interface DailyJob {
  id: string;
  fingerprint: string;
  source: string;
  sourceType: JobSourceType;
  title: string;
  company: string;
  location?: string;
  workType?: JobWorkType;
  salary?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  description: string;
  requirements: string[];
  applyUrl: string;
  canonicalUrl?: string;
  postedAt?: string;
  matchedCareerPath?: string;
  matchScore?: number;
  finalScore?: number;
  matchReasons?: string[];
  skillGaps?: string[];
  aiSummary?: string;
  qualitySignals?: string[];
}

export interface LatestJobsMeta {
  runId: string;
  generatedAt: string;
  status: JobRunStatus;
  selectedCount: number;
  sourceCounts: Record<string, number>;
  degradedReasons: string[];
}

export interface DailyMatchesDocument {
  userId: string;
  dateKey: string;
  generatedAt: string;
  runId: string;
  status: JobRunStatus;
  jobs: DailyJob[];
  meta: {
    sourceCounts: Record<string, number>;
    validatedCount: number;
    rankedCount: number;
    selectedCount: number;
    degradedReasons: string[];
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/__tests__/jobPipelineContracts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/dailyJob.ts src/types/dashboard.ts src/services/__tests__/jobPipelineContracts.test.ts
git commit -m "feat: lock rebuilt job pipeline contracts"
```

### Task 2: Build Profile Readiness And Career-Path Refresh

**Files:**
- Create: `src/services/jobProfileEngine.ts`
- Test: `src/services/__tests__/jobProfileEngine.test.ts`
- Modify: `src/services/jobDeliveryProfile.ts`

- [ ] **Step 1: Write the failing profile-engine test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildJobPipelineProfile } from '../jobProfileEngine';

describe('buildJobPipelineProfile', () => {
  it('refreshes career paths from resume text and marks the profile ready', async () => {
    const result = await buildJobPipelineProfile(
      {
        uid: 'user_123',
        resumeText: 'Senior frontend engineer with React, TypeScript, design systems, and mentoring experience.',
        careerPaths: ['Old Path'],
        location: 'United States',
        jobType: 'remote',
      },
      async () =>
        JSON.stringify({
          careerPaths: ['Frontend Engineer', 'UI Engineer', 'Product Engineer'],
          summary: 'Frontend-focused profile',
          warnings: [],
        })
    );

    expect(result.careerPaths).toEqual(['Frontend Engineer', 'UI Engineer', 'Product Engineer']);
    expect(result.matchReadiness.status).toBe('ready');
  });

  it('returns blocked when resume text is missing', async () => {
    const result = await buildJobPipelineProfile(
      { uid: 'user_123', resumeText: '', careerPaths: [] },
      vi.fn()
    );

    expect(result.matchReadiness.status).toBe('blocked');
    expect(result.matchReadiness.blockingReason).toMatch(/resume/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/jobProfileEngine.test.ts`
Expected: FAIL with `buildJobPipelineProfile` missing

- [ ] **Step 3: Write the minimal implementation**

```ts
export interface JobPipelineProfile {
  uid: string;
  resumeText: string;
  careerPaths: string[];
  matchingSummary?: string;
  matchingWarnings: string[];
  location?: string;
  jobType: 'remote' | 'hybrid' | 'onsite' | 'both';
  matchReadiness: {
    status: 'ready' | 'partial' | 'blocked';
    blockingReason?: string;
    qualityWarnings: string[];
  };
}

export async function buildJobPipelineProfile(
  profile: Record<string, any>,
  callAI: (messages: { role: string; content: string }[], model?: string) => Promise<string>
): Promise<JobPipelineProfile> {
  const resumeText = typeof profile.resumeText === 'string' ? profile.resumeText.trim() : '';
  if (resumeText.length < 50) {
    return {
      uid: profile.uid || profile.id || '',
      resumeText,
      careerPaths: [],
      matchingWarnings: [],
      jobType: profile.jobType || 'remote',
      matchReadiness: {
        status: 'blocked',
        blockingReason: 'Profile missing usable resume text.',
        qualityWarnings: [],
      },
    };
  }

  const raw = await callAI(
    [
      {
        role: 'user',
        content:
          'Return JSON with careerPaths, summary, warnings for this resume:\n' + resumeText.slice(0, 4000),
      },
    ],
    'google/gemini-2.5-pro-preview-03-25'
  );

  const parsed = JSON.parse(raw);
  const careerPaths = Array.isArray(parsed.careerPaths)
    ? parsed.careerPaths.filter((value: unknown): value is string => typeof value === 'string').slice(0, 5)
    : [];

  return {
    uid: profile.uid || profile.id || '',
    resumeText,
    careerPaths,
    matchingSummary: typeof parsed.summary === 'string' ? parsed.summary : '',
    matchingWarnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    location: profile.location || '',
    jobType: profile.jobType || 'remote',
    matchReadiness: {
      status: careerPaths.length > 0 ? 'ready' : 'partial',
      qualityWarnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/__tests__/jobProfileEngine.test.ts src/services/__tests__/jobDeliveryProfile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/jobProfileEngine.ts src/services/jobDeliveryProfile.ts src/services/__tests__/jobProfileEngine.test.ts
git commit -m "feat: add job profile readiness and path refresh"
```

### Task 3: Add Structured Sources, Fallback Search, And Normalization

**Files:**
- Create: `src/services/jobSourceAdapters.ts`
- Create: `src/services/jobSearchFallback.ts`
- Create: `src/services/jobNormalizer.ts`
- Test: `src/services/__tests__/jobSourceAdapters.test.ts`
- Modify: `src/services/jobResearcher.ts`

- [ ] **Step 1: Write the failing source test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { collectJobCandidates } from '../jobSourceAdapters';

describe('collectJobCandidates', () => {
  it('uses API results first and triggers live-search fallback when coverage is weak', async () => {
    const result = await collectJobCandidates(
      {
        careerPaths: ['Frontend Engineer'],
        resumeText: 'React TypeScript accessibility',
        location: 'United States',
        jobType: 'remote',
      },
      {
        adapters: [
          {
            name: 'greenhouse',
            fetchJobs: vi.fn().mockResolvedValue([
              {
                title: 'Frontend Engineer',
                company: 'Acme',
                description: 'A long enough real description for normalization to accept.',
                applyUrl: 'https://acme.com/jobs/frontend',
                location: 'Remote - US',
              },
            ]),
          },
        ],
        searchFallback: vi.fn().mockResolvedValue([
          {
            title: 'UI Engineer',
            company: 'Orbit',
            description: 'Another long enough description for the fallback path.',
            applyUrl: 'https://orbit.com/jobs/ui',
            location: 'Remote',
          },
        ]),
      }
    );

    expect(result.jobs).toHaveLength(2);
    expect(result.sourceCounts.greenhouse).toBe(1);
    expect(result.sourceCounts.search).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/jobSourceAdapters.test.ts`
Expected: FAIL with missing `collectJobCandidates`

- [ ] **Step 3: Write the minimal implementation**

```ts
export interface RawJobCandidate {
  title?: string;
  company?: string;
  description?: string;
  applyUrl?: string;
  location?: string;
  source?: string;
  matchedCareerPath?: string;
}

export interface StructuredJobAdapter {
  name: string;
  fetchJobs: (profile: {
    careerPaths: string[];
    resumeText: string;
    location?: string;
    jobType: string;
  }) => Promise<RawJobCandidate[]>;
}

export async function collectJobCandidates(
  profile: {
    careerPaths: string[];
    resumeText: string;
    location?: string;
    jobType: string;
  },
  deps: {
    adapters: StructuredJobAdapter[];
    searchFallback: (profile: {
      careerPaths: string[];
      resumeText: string;
      location?: string;
      jobType: string;
    }) => Promise<RawJobCandidate[]>;
  }
) {
  const sourceCounts: Record<string, number> = {};
  const jobs: RawJobCandidate[] = [];

  for (const adapter of deps.adapters) {
    const items = await adapter.fetchJobs(profile);
    sourceCounts[adapter.name] = items.length;
    jobs.push(...items.map((item) => ({ ...item, source: adapter.name })));
  }

  if (jobs.length < 5) {
    const fallbackJobs = await deps.searchFallback(profile);
    sourceCounts.search = fallbackJobs.length;
    jobs.push(...fallbackJobs.map((item) => ({ ...item, source: item.source || 'search' })));
  }

  return { jobs, sourceCounts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/__tests__/jobSourceAdapters.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/jobSourceAdapters.ts src/services/jobSearchFallback.ts src/services/jobNormalizer.ts src/services/jobResearcher.ts src/services/__tests__/jobSourceAdapters.test.ts
git commit -m "feat: add job source collection and fallback search"
```

### Task 4: Add Deterministic Validation And Rebuild Ranking

**Files:**
- Create: `src/services/jobValidator.ts`
- Test: `src/services/__tests__/jobValidator.test.ts`
- Modify: `src/services/jobMatchingEngine.ts`

- [ ] **Step 1: Write the failing validator and ranking tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { validateJobCandidate } from '../jobValidator';
import { matchAndRankJobs } from '../jobMatchingEngine';

describe('validateJobCandidate', () => {
  it('rejects listings without an apply URL', () => {
    expect(
      validateJobCandidate(
        {
          title: 'Frontend Engineer',
          company: 'Acme',
          description: 'Long enough body to pass the length checks.',
          requirements: ['React'],
        },
        { location: 'United States', jobType: 'remote' }
      ).accepted
    ).toBe(false);
  });
});

describe('matchAndRankJobs', () => {
  it('returns ranked jobs with degraded reasons when enrichment fails', async () => {
    const result = await matchAndRankJobs(
      [
        {
          id: 'job-1',
          fingerprint: 'frontend engineer::acme',
          source: 'greenhouse',
          sourceType: 'api',
          title: 'Frontend Engineer',
          company: 'Acme',
          location: 'Remote - US',
          workType: 'remote',
          description: 'Long enough body to pass the length checks.',
          requirements: ['React', 'TypeScript'],
          applyUrl: 'https://acme.com/jobs/frontend',
        },
      ],
      {
        careerPaths: ['Frontend Engineer'],
        resumeText: 'React TypeScript accessibility systems',
        limit: 10,
      },
      async () => {
        throw new Error('quota');
      }
    );

    expect(result.jobs).toHaveLength(1);
    expect(result.status).toBe('partial');
    expect(result.degradedReasons).toContain('AI enrichment unavailable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/jobValidator.test.ts`
Expected: FAIL because validator result shape and ranking status are not implemented

- [ ] **Step 3: Write the minimal implementation**

```ts
export function validateJobCandidate(
  job: {
    title?: string;
    company?: string;
    description?: string;
    requirements?: string[];
    applyUrl?: string;
    location?: string;
    workType?: string;
  },
  profile: { location?: string; jobType: string }
) {
  if (!job.title || !job.company) return { accepted: false, reason: 'missing_identity' };
  if (!job.applyUrl) return { accepted: false, reason: 'missing_apply_url' };
  if (!job.description || job.description.trim().length < 80) {
    return { accepted: false, reason: 'low_content' };
  }
  if (profile.jobType === 'remote' && job.workType === 'onsite') {
    return { accepted: false, reason: 'wrong_work_type' };
  }
  return { accepted: true };
}
```

```ts
export async function matchAndRankJobs(
  jobs: DailyJob[],
  context: { careerPaths: string[]; resumeText: string; limit: number },
  callAI: (messages: { role: string; content: string }[], model?: string) => Promise<string>
) {
  const scored = jobs
    .map((job) => ({
      ...job,
      matchScore: job.title.toLowerCase().includes(context.careerPaths[0].toLowerCase()) ? 90 : 70,
      finalScore: job.title.toLowerCase().includes(context.careerPaths[0].toLowerCase()) ? 94 : 72,
    }))
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, context.limit);

  try {
    await callAI([{ role: 'user', content: 'enrich jobs' }], 'anthropic/claude-sonnet-4-6');
    return { status: 'success' as const, jobs: scored, degradedReasons: [], scoredCount: scored.length };
  } catch {
    return {
      status: 'partial' as const,
      jobs: scored.map((job) => ({
        ...job,
        matchReasons: job.matchReasons || ['Role aligns with your target path'],
        skillGaps: job.skillGaps || [],
        aiSummary: job.aiSummary || `${job.title} at ${job.company}`,
      })),
      degradedReasons: ['AI enrichment unavailable'],
      scoredCount: scored.length,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/__tests__/jobValidator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/jobValidator.ts src/services/jobMatchingEngine.ts src/services/__tests__/jobValidator.test.ts
git commit -m "feat: add deterministic validation and rebuilt ranking"
```

### Task 5: Rebuild Delivery, Orchestration, And API Routes

**Files:**
- Create: `src/services/jobDeliveryEngine.ts`
- Test: `src/services/__tests__/jobDeliveryEngine.test.ts`
- Test: `src/services/__tests__/jobPipelineIntegration.test.ts`
- Modify: `src/services/cronEngine.ts`
- Modify: `api/jobs/index.ts`
- Modify: `api/cron/daily-alerts.ts`
- Modify: `api/cron/process-user.ts`
- Modify: `src/services/emailService.ts`
- Modify: `src/services/__tests__/cronEngine.test.ts`

- [ ] **Step 1: Write the failing integration tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { processUserCronRun } from '../cronEngine';

describe('processUserCronRun', () => {
  it('stores both latest snapshot and dated batch before sending email', async () => {
    const events: string[] = [];
    const deps = {
      loadUser: vi.fn().mockResolvedValue({
        id: 'user_123',
        data: {
          uid: 'user_123',
          email: 'person@example.com',
          plan: 'pro',
          receiveDailyAlerts: true,
          resumeText: 'Frontend engineer with React and TypeScript across multiple teams and products.',
        },
      }),
      getExistingRun: vi.fn().mockResolvedValue(null),
      markRun: vi.fn().mockResolvedValue(undefined),
      buildProfile: vi.fn().mockResolvedValue({
        uid: 'user_123',
        resumeText: 'Frontend engineer with React and TypeScript across multiple teams and products.',
        careerPaths: ['Frontend Engineer'],
        matchingWarnings: [],
        jobType: 'remote',
        matchReadiness: { status: 'ready', qualityWarnings: [] },
      }),
      collectCandidates: vi.fn().mockResolvedValue({
        jobs: [
          {
            id: 'job-1',
            fingerprint: 'frontend engineer::acme',
            source: 'greenhouse',
            sourceType: 'api',
            title: 'Frontend Engineer',
            company: 'Acme',
            description: 'Long enough listing body for validation.',
            requirements: ['React'],
            applyUrl: 'https://acme.com/jobs/frontend',
          },
        ],
        sourceCounts: { greenhouse: 1 },
      }),
      rankJobs: vi.fn().mockResolvedValue({
        status: 'success',
        jobs: [
          {
            id: 'job-1',
            fingerprint: 'frontend engineer::acme',
            source: 'greenhouse',
            sourceType: 'api',
            title: 'Frontend Engineer',
            company: 'Acme',
            description: 'Long enough listing body for validation.',
            requirements: ['React'],
            applyUrl: 'https://acme.com/jobs/frontend',
            matchScore: 90,
            finalScore: 92,
          },
        ],
        degradedReasons: [],
        scoredCount: 1,
      }),
      storeDelivery: vi.fn().mockImplementation(async () => {
        events.push('store');
      }),
      sendDailyEmail: vi.fn().mockImplementation(async () => {
        events.push('email');
      }),
    };

    const result = await processUserCronRun(
      { userId: 'user_123', runDate: '2026-04-27' },
      deps as any
    );

    expect(result.status).toBe('success');
    expect(events).toEqual(['store', 'email']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/cronEngine.test.ts src/services/__tests__/jobPipelineIntegration.test.ts`
Expected: FAIL because `processUserCronRun` still depends on the old `generateJobs/storeJobs` pipeline shape

- [ ] **Step 3: Write the minimal implementation**

```ts
export async function storeJobDelivery(input: {
  userId: string;
  runId: string;
  runDate: string;
  status: 'success' | 'partial' | 'blocked' | 'failed';
  jobs: DailyJob[];
  sourceCounts: Record<string, number>;
  degradedReasons: string[];
  db: {
    setUser: (userId: string, patch: Record<string, unknown>) => Promise<void>;
    setDailyBatch: (userId: string, runDate: string, patch: Record<string, unknown>) => Promise<void>;
  };
}) {
  const generatedAt = new Date().toISOString();
  await input.db.setUser(input.userId, {
    latestJobs: input.jobs,
    latestJobsMeta: {
      runId: input.runId,
      generatedAt,
      status: input.status,
      selectedCount: input.jobs.length,
      sourceCounts: input.sourceCounts,
      degradedReasons: input.degradedReasons,
    },
    lastJobFetchTime: generatedAt,
  });

  await input.db.setDailyBatch(input.userId, input.runDate, {
    userId: input.userId,
    dateKey: input.runDate,
    generatedAt,
    runId: input.runId,
    status: input.status,
    jobs: input.jobs,
    meta: {
      sourceCounts: input.sourceCounts,
      validatedCount: input.jobs.length,
      rankedCount: input.jobs.length,
      selectedCount: input.jobs.length,
      degradedReasons: input.degradedReasons,
    },
  });
}
```

```ts
const runId = buildCronRunId(input.userId, input.runDate);
const pipelineProfile = await deps.buildProfile(loadedUser.data);
if (pipelineProfile.matchReadiness.status === 'blocked') {
  await deps.storeDelivery({ userId: input.userId, runId, runDate: input.runDate, status: 'blocked', jobs: [], sourceCounts: {}, degradedReasons: [pipelineProfile.matchReadiness.blockingReason || 'Profile blocked'] });
  return { runId, status: 'blocked' as const };
}

const collected = await deps.collectCandidates(pipelineProfile);
const ranked = await deps.rankJobs(collected.jobs, pipelineProfile);
await deps.storeDelivery({
  userId: input.userId,
  runId,
  runDate: input.runDate,
  status: ranked.status,
  jobs: ranked.jobs,
  sourceCounts: collected.sourceCounts,
  degradedReasons: ranked.degradedReasons,
});

if ((ranked.status === 'success' || ranked.status === 'partial') && ranked.jobs.length > 0 && loadedUser.data.email) {
  await deps.sendDailyEmail(loadedUser.data.email, ranked.jobs);
}

return { runId, status: ranked.status };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/__tests__/jobDeliveryEngine.test.ts src/services/__tests__/cronEngine.test.ts src/services/__tests__/jobPipelineIntegration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/jobDeliveryEngine.ts src/services/cronEngine.ts src/services/emailService.ts api/jobs/index.ts api/cron/daily-alerts.ts api/cron/process-user.ts src/services/__tests__/jobDeliveryEngine.test.ts src/services/__tests__/cronEngine.test.ts src/services/__tests__/jobPipelineIntegration.test.ts
git commit -m "feat: rebuild job delivery and server pipeline"
```

### Task 6: Rebuild Dashboard Loading And Jobs UI

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/components/dashboard/JobDetailsPanel.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Test: `src/components/dashboard/__tests__/MatchesTab.test.ts`

- [ ] **Step 1: Write the failing dashboard test**

```ts
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchesTab } from '../MatchesTab';

describe('MatchesTab', () => {
  it('renders rebuilt jobs, latest status, and degraded-mode messaging', () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchesTab, {
        plan: 'pro',
        jobs: [
          {
            id: 'job-1',
            fingerprint: 'frontend engineer::acme',
            title: 'Frontend Engineer',
            company: 'Acme',
            location: 'Remote - US',
            workType: 'remote',
            salary: '$140k-$165k',
            description: 'Build product UI',
            requirements: ['React'],
            source: 'greenhouse',
            sourceType: 'api',
            applyUrl: 'https://acme.com/jobs/frontend',
            matchScore: 91,
            finalScore: 93,
            matchReasons: ['Strong React overlap'],
            skillGaps: ['GraphQL'],
            aiSummary: 'A strong frontend role',
          },
        ],
        loadingJobs: false,
        generatingJobs: false,
        requestJobs: async () => ({ ok: true }),
        latestJobsMeta: {
          runId: 'user_123_2026-04-27',
          generatedAt: '2026-04-27T03:00:00.000Z',
          status: 'partial',
          selectedCount: 1,
          sourceCounts: { greenhouse: 1 },
          degradedReasons: ['AI enrichment unavailable'],
        },
        history: [{ dateKey: '2026-04-27', status: 'partial', count: 1 }],
      } as any)
    );

    expect(html).toContain('Frontend Engineer');
    expect(html).toContain('AI enrichment unavailable');
    expect(html).toContain('2026-04-27');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/__tests__/MatchesTab.test.ts`
Expected: FAIL because the component props and rendering still reflect the previous job UI contract

- [ ] **Step 3: Write the minimal implementation**

```ts
export function useDashboardJobs(user: any, profile: any) {
  const [jobs, setJobs] = useState<DailyJob[]>([]);
  const [latestJobsMeta, setLatestJobsMeta] = useState<LatestJobsMeta | null>(null);
  const [history, setHistory] = useState<Array<{ dateKey: string; status: string; count: number }>>([]);

  const loadJobs = async () => {
    if (!user || !profile) return;
    setJobs(profile.latestJobs || []);
    setLatestJobsMeta(profile.latestJobsMeta || null);
    const historyDocs = await getDocs(collection(db, 'users', user.uid, 'daily_matches'));
    setHistory(
      historyDocs.docs.map((docSnap) => ({
        dateKey: docSnap.id,
        status: docSnap.data().status || 'success',
        count: Array.isArray(docSnap.data().jobs) ? docSnap.data().jobs.length : 0,
      }))
    );
  };

  const requestJobs = async () => {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ mode: 'trigger' }),
    });
    return response.json();
  };

  return { jobs, latestJobsMeta, history, requestJobs, loadJobs };
}
```

```tsx
{latestJobsMeta?.degradedReasons?.length ? (
  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
    {latestJobsMeta.degradedReasons.join(', ')}
  </div>
) : null}

{history.map((entry) => (
  <button key={entry.dateKey} type="button" className="rounded-lg border px-3 py-2 text-left">
    <span>{entry.dateKey}</span>
    <span>{entry.status}</span>
    <span>{entry.count} jobs</span>
  </button>
))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/__tests__/MatchesTab.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardJobs.ts src/components/dashboard/MatchesTab.tsx src/components/dashboard/JobDetailsPanel.tsx src/pages/Dashboard.tsx src/components/dashboard/__tests__/MatchesTab.test.ts
git commit -m "feat: rebuild dashboard job loading and history"
```

### Task 7: Final Verification, Cleanup, And Docs

**Files:**
- Modify: `CRON_FLOW.md`
- Modify: `docs/superpowers/specs/2026-04-27-job-research-and-matching-rebuild-design.md` only if implementation forces a documented contract change
- Modify: any changed test snapshots or supporting comments discovered during verification

- [ ] **Step 1: Write the final acceptance checklist into the PR notes or local handoff**

```md
- Manual `POST /api/jobs` returns `success | partial | blocked | failed`
- `users/{uid}` stores `latestJobs` and `latestJobsMeta`
- `users/{uid}/daily_matches/{YYYY-MM-DD}` stores dated history
- Cron run stores before email send
- Dashboard renders latest results and history without client-side job generation
- Blocked profile shows explicit reason
```

- [ ] **Step 2: Run full verification**

Run: `npm run lint`
Expected: PASS

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Fix any issues from verification and update docs**

```md
## Active Cron Routes

- `/api/cron/daily-blog`
- `/api/cron/weekly-analysis`
- `/api/cron/daily-alerts`
- `/api/cron/process-user`

## Jobs Pipeline

The jobs system now stores both `latestJobs` on the user document and dated batches under
`users/{uid}/daily_matches/{YYYY-MM-DD}`. Email sends happen only after storage succeeds.
```

- [ ] **Step 4: Re-run verification**

Run: `npm run lint && npm test && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CRON_FLOW.md
git commit -m "docs: update cron flow for rebuilt jobs pipeline"
```

## Spec Coverage Check

- `readiness check`: Task 2
- `AI career-path refresh`: Task 2
- `structured source adapters`: Task 3
- `live-search fallback`: Task 3
- `normalize, dedupe, validate`: Tasks 3 and 4
- `score and enrich`: Task 4
- `dated batch + latest snapshot storage`: Task 5
- `manual trigger + cron`: Task 5
- `dashboard latest + history`: Task 6
- `email after storage`: Task 5
- `run logging and degraded status`: Task 5
- `acceptance verification`: Task 7

## Placeholder Scan

- Avoid reusing the existing `jobResearcher.ts` prompt-heavy code as the final architecture. Either turn it into a thin wrapper around `jobSourceAdapters.ts` + `jobSearchFallback.ts` or remove it after all callers migrate.
- Keep `processUserCronRun()` on the new dependency contract. Do not leave mixed old dependencies like `generateJobs/storeJobs` once `buildProfile/collectCandidates/rankJobs/storeDelivery` are introduced.
- Keep the dashboard storage-driven. Do not add any client-side source fetching or LLM calls.

## Type Consistency Check

- Use `JobRunStatus = 'success' | 'partial' | 'blocked' | 'failed'` everywhere.
- Use `DailyMatchesDocument` for `users/{uid}/daily_matches/{YYYY-MM-DD}`.
- Use `LatestJobsMeta` for the user-document snapshot metadata.
- Use `sourceType: 'api' | 'search'` on every stored job.

Plan complete and saved to `docs/superpowers/plans/2026-04-27-job-research-and-matching-rebuild-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
