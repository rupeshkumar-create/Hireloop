# Job Research And Matching Rebuild Design

## Goal

Rebuild the job research and matching system from scratch so HireSchema can:

- find real jobs for a user based on resume content and career direction
- refresh target career paths with AI on every run
- fetch from structured job sources first and fall back to live search when coverage is weak
- score and enrich jobs with AI
- store both a dated daily batch and a current latest snapshot
- deliver results to the dashboard and optional daily email flows

The rebuilt system must be production-safe, testable, and clearly separated from unrelated AI features like resume tailoring, cold email generation, and interview preparation.

## Product Decisions Captured

- Delivery model: full pipeline with manual trigger, cron, Firestore storage, dashboard loading, and email delivery
- Source strategy: structured job APIs first, live-search fallback second
- Storage model: keep both dated daily batches and a latest snapshot
- Career-path strategy: always refresh target career paths from the latest resume with AI on each run

## Scope

Included:

- user readiness checks for the jobs pipeline
- AI-driven career-path refresh from resume text
- query generation for source adapters and live search
- structured source ingestion
- live-search fallback and extraction
- normalization, deduplication, validation, ranking, enrichment, selection, storage, and delivery
- dashboard data loading for latest and historical daily matches
- manual trigger endpoint and scheduled cron pipeline
- run logging, degraded-mode handling, and verification coverage

Not included:

- building a queueing system outside the current Vercel/Firebase stack
- replacing tracked jobs in `trackedJobs`
- redesigning unrelated AI tools
- introducing direct provider SDKs that bypass `api/openai.ts`

## Recommended Approach

Use a staged pipeline with a single orchestrator.

Each stage has one job:

1. build user matching input
2. collect jobs from sources
3. normalize and validate jobs
4. score and enrich the survivors
5. store outputs and trigger delivery

This is recommended because it keeps the system debuggable. A failed source adapter, weak AI output, bad validation rule, or storage issue can be traced to one stage rather than one oversized engine.

## Architecture

### Runtime Entry Points

- `api/jobs/index.ts`
  - authenticated manual trigger
  - runs the pipeline for the signed-in user
  - returns summary metadata and the new latest snapshot
- `api/cron/daily-alerts.ts`
  - finds users eligible for a daily run
  - dispatches one per-user invocation
- `api/cron/process-user.ts`
  - runs the full pipeline for one user
  - used by cron and internal server-side dispatch paths only

### Core Services

- `src/services/jobProfileEngine.ts`
  - creates the pipeline input from profile, resume, preferences, and AI-refreshed career paths
- `src/services/jobSourceAdapters.ts`
  - fetches jobs from configured structured sources
  - exposes one normalized adapter interface per provider
- `src/services/jobSearchFallback.ts`
  - generates search queries with AI
  - performs live discovery when structured sources underperform
- `src/services/jobNormalizer.ts`
  - converts all raw source results into one internal job shape
- `src/services/jobValidator.ts`
  - applies deterministic hard rules before AI scoring
- `src/services/jobMatchingEngine.ts`
  - scores match quality
  - enriches top jobs with reasons, gaps, summaries, and quality signals
- `src/services/jobDeliveryEngine.ts`
  - writes the dated batch and latest snapshot
  - updates run metadata on the user profile
  - triggers email only after storage succeeds
- `src/services/cronEngine.ts`
  - orchestrates the end-to-end run
  - records telemetry and degraded-mode state

### Shared Principles

- Source collection is provider-specific, but everything after normalization is shared.
- Validation runs before enrichment.
- AI never invents jobs or repairs invalid jobs.
- Storage is the source of truth for dashboard display.

## Data Flow

The end-to-end flow is:

`User profile -> readiness check -> AI career-path refresh -> source fetch -> live-search fallback -> normalize -> dedupe -> validate -> score -> enrich top jobs -> plan cap -> store daily batch + latest snapshot -> send email -> dashboard reads stored results`

### Step 1: Readiness

The pipeline reads the user profile and determines whether the run may proceed.

Minimum requirements:

- usable `resumeText`
- authenticated user record
- stable delivery settings for cron-based runs

If the profile is not ready, the run stops early and writes a blocked readiness snapshot.

### Step 2: Career Path Refresh

Every run refreshes career paths from the latest resume.

The system writes:

- refreshed `careerPaths`
- a normalized matching summary
- warnings if the resume is too thin to support high-confidence matching

The user may still edit visible preferences elsewhere, but the pipeline uses the latest AI-refreshed career direction as the matching basis.

### Step 3: Source Fetch

Structured providers run first.

Each provider receives:

- target career paths
- user location preferences
- remote preference
- salary floor when supported

If structured sources return too few usable candidates, the fallback stage runs.

### Step 4: Live Search Fallback

Fallback activates when one or more of the following is true:

- too few raw jobs returned
- too few jobs survive validation
- source diversity is too narrow

The fallback stage:

- generates focused search queries from resume + refreshed career paths
- performs live web discovery
- extracts job listing content
- passes everything back through the same normalization pipeline

### Step 5: Normalize, Dedupe, Validate

All source results are transformed into a single internal `DailyJob` shape.

Deduplication key:

- primary: canonical job URL when available
- secondary: `title::company`

Validation rejects jobs that fail hard rules such as:

- unsupported work mode
- clearly incompatible location
- missing application URL
- stale posting date when detectable
- salary far below user floor when trustworthy salary data exists
- low-content or spam-like listings

### Step 6: Score And Enrich

The scoring stage uses resume context, refreshed career paths, preferences, and validated job content.

Outputs include:

- `matchScore`
- `finalScore`
- `matchReasons`
- `skillGaps`
- `aiSummary`
- optional quality and urgency signals

AI is allowed to explain and rank validated jobs. It is not allowed to generate new listings, override hard validation, or fill missing factual fields with guesses.

### Step 7: Selection And Delivery

After ranking:

- plan-based caps are applied
- the dated batch is stored under `users/{uid}/daily_matches/{YYYY-MM-DD}`
- the current snapshot is written to the user record
- run metadata is updated
- email is sent only after writes succeed

## Data Model

### User Profile Fields

The user document keeps active jobs-pipeline metadata such as:

- `careerPaths`
- `resumeText`
- `preferences`
- `matchingPreferences`
- `deliveryTimezone`
- `preferredDeliveryHour`
- `nextJobDeliveryAt`
- `lastSuccessfulJobRunLocalDate`
- `matchReadiness`
- `latestJobs`
- `latestJobsMeta`
- `lastJobFetchTime`

### Daily Batch Collection

`users/{uid}/daily_matches/{YYYY-MM-DD}`

Recommended document shape:

```ts
interface DailyMatchesDocument {
  userId: string;
  dateKey: string;
  generatedAt: string;
  runId: string;
  status: 'success' | 'partial' | 'blocked' | 'failed';
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

### Latest Snapshot

Stored on `users/{uid}` for fast dashboard reads:

```ts
interface LatestJobsMeta {
  runId: string;
  generatedAt: string;
  status: 'success' | 'partial' | 'blocked' | 'failed';
  selectedCount: number;
  sourceCounts: Record<string, number>;
  degradedReasons: string[];
}
```

### Run Logs

Use `job_runs/{runId}` for operational tracing.

It stores:

- stage timings
- source counts
- validation drops by reason
- degraded-mode flags
- error summaries safe for admin debugging

This log is not a dashboard data source.

## Type Design

### Daily Job Shape

The internal stored job shape should cover both source facts and AI enrichment.

```ts
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
  matchScore?: number;
  finalScore?: number;
  matchReasons?: string[];
  skillGaps?: string[];
  aiSummary?: string;
  qualitySignals?: string[];
}
```

## API Contracts

### Manual Trigger

`POST /api/jobs`

Behavior:

- requires authenticated user context
- runs the full pipeline for that user
- returns a safe summary

Recommended response:

```ts
interface TriggerJobsResponse {
  ok: boolean;
  runId: string;
  status: 'success' | 'partial' | 'blocked' | 'failed';
  message: string;
  selectedCount: number;
  degradedReasons: string[];
}
```

### Cron Dispatcher

`GET /api/cron/daily-alerts`

Behavior:

- verifies cron secret
- finds users due for delivery
- dispatches per-user runs

### Per-User Cron Endpoint

`POST /api/cron/process-user`

Behavior:

- verifies internal auth
- accepts `uid`
- runs one user job flow

## Frontend Design

### Dashboard Jobs Tab

The Jobs tab becomes active again, but it must stay storage-driven.

Required behavior:

- load the latest snapshot from stored data
- show run status, generation time, and degraded-mode reasons when present
- allow manual refresh via `POST /api/jobs`
- allow browsing historical daily batches
- never generate jobs directly in the client

### Hook Design

`src/hooks/useDashboardJobs.ts` should:

- load `latestJobs` and `latestJobsMeta`
- load dated `daily_matches` history for browsing past runs
- expose `requestJobs()`
- expose loading, error, and degraded-mode state
- avoid source-specific knowledge

### Dashboard Detail UI

The job detail panel may show:

- company
- title
- match reasons
- skill gaps
- AI summary
- apply link
- source badge
- run metadata

It should not attempt to repair missing backend data in the browser.

## Email Delivery

Daily email is optional at the user level but supported by the pipeline.

Rules:

- only send after Firestore writes succeed
- include only selected jobs
- degrade gracefully if enrichment is unavailable
- never send an email for a blocked run

`src/services/emailService.ts` should expose a dedicated daily-match email sender separate from the signup email helper.

## Error Handling

### Blocked

Used when the profile is not fit for matching.

Examples:

- missing resume text
- resume too short to extract useful paths
- missing user document

### Partial

Used when the run succeeds with degraded quality.

Examples:

- one provider fails
- fallback search is used because API coverage is weak
- enrichment is skipped due to quota or model error
- too few jobs survive validation

### Failed

Used when the system cannot safely produce a result set.

Examples:

- storage failure
- orchestrator exception before selection completes
- invalid auth for cron endpoints

The dashboard and logs must distinguish `partial` from `failed`.

## Security And Operational Rules

- Never call upstream LLM providers directly from the frontend.
- Route all AI requests through `api/openai.ts`.
- Protect cron endpoints with `CRON_SECRET` and internal secret checks.
- Keep manual trigger scoped to the authenticated user unless an admin-only path is explicitly added later.
- Avoid storing provider-specific secrets in client-visible config.

## Testing Strategy

### Unit Tests

- readiness calculation
- career-path refresh parsing
- normalization and deduplication
- validation rules
- plan-cap selection
- delivery metadata generation

### Integration Tests

- manual trigger end to end with mocked providers
- per-user cron processing with mocked storage and email
- dashboard hook reads latest snapshot and history correctly

### Failure Tests

- API adapter failure falls back to live search
- enrichment failure yields `partial` not `failed` when storage still succeeds
- storage failure prevents email send
- blocked readiness returns no batch creation

### Acceptance Criteria

- a user with a valid resume can trigger a run and receive stored matches
- a scheduled run stores a dated batch and latest snapshot
- the dashboard renders stored jobs without client-side generation
- historical batches remain visible after later runs
- a blocked user sees a clear reason instead of a silent empty state

## Implementation Notes

Build this in phases, but preserve the final architecture from day one:

1. types, contracts, and storage model
2. readiness + career-path refresh
3. source adapters + live-search fallback
4. validation + scoring + enrichment
5. delivery + email
6. dashboard loading and history
7. cron scheduling and run logging

This keeps the shipped implementation incremental without collapsing the design into a temporary shortcut architecture.
