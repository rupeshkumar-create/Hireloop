# Phase 8 Cron Engine Design

**Goal:** Move the daily job-generation loop into a server-owned cron engine that dispatches one isolated daily run per active user, stores validated results, and sends the alert email only after storage succeeds.

**Scope:** This phase introduces cron orchestration, per-user dispatch records, and a protected worker endpoint for the daily loop. It does not add third-party queue infrastructure, a retry dashboard, or a full server-only rewrite of every AI service in one pass.

## Current Context

The repo already contains most of the pieces needed for a daily cron engine:

- Vercel cron scheduling already exists in `vercel.json`
- the current cron entrypoint exists at `api/cron/daily-alerts.ts`
- the client job-fetch flow in `src/hooks/useDashboardJobs.ts` already performs job generation, persistence, and email delivery
- the product already stores daily results in `users/{uid}/daily_matches/{date}`
- plan-aware match limits already exist through `src/lib/planLimits.ts`
- cron execution rules are documented in `CRON_FLOW.md`

However, the current cron route is still a stub and the real daily loop still lives in the browser-oriented dashboard path.

That creates two problems:

1. scheduled daily delivery is not truly server-owned
2. the current Vercel cron route is not shaped for scale because one long sequential loop risks serverless timeouts

## Design Summary

Phase 8 introduces a dispatcher-style cron flow:

```text
vercel cron
-> dispatcher route
-> active users
-> one dispatch record per user per day
-> protected worker route
-> generate jobs
-> store jobs
-> send email
-> log outcome
```

Core behavior:

1. the daily cron still starts from one scheduled Vercel endpoint
2. the scheduled endpoint acts as a dispatcher, not the heavy processor
3. each user is processed by an isolated worker invocation
4. only active users are dispatched
5. jobs are stored before email is sent
6. every user run is recorded with a deterministic per-day execution key

This keeps the scheduled entrypoint fast, bounds per-user failures, and creates a clean path to a future queue-backed worker model without changing the public cron contract.

## Architecture

### 1. Dispatcher Route

The existing `api/cron/daily-alerts.ts` route becomes the dispatcher.

Responsibilities:

- verify cron authorization with `CRON_SECRET`
- compute the current cron day in IST
- query a bounded batch of active users
- create one execution record per user for that day
- invoke the worker route for users that were successfully queued
- return a compact summary of queued, skipped, and duplicate users

The dispatcher should stay lightweight. It should not run the full job engine inline for every user.

### 2. Worker Route

Add a new protected route such as:

```text
/api/cron/process-user
```

Responsibilities:

- verify internal dispatcher authorization
- accept a single `userId`
- load the user profile fresh from Firestore
- re-check eligibility and profile readiness
- run the daily job-generation pipeline for that user
- persist the result set
- send the daily alert email only after persistence succeeds
- update the execution record with the final status

The worker is the only route that owns the expensive `generate -> store -> email` sequence.

### 3. Active User Definition

The user selected the following rule for this phase:

- active means `plan` is present
- active means `receiveDailyAlerts !== false`

The dispatcher uses that rule to decide who should be queued.

The worker performs an additional readiness check before spending compute:

- require a valid `email`
- require non-empty `careerPaths`
- allow malformed or incomplete profiles to be marked as `skipped`

This keeps dispatch eligibility simple while preventing expensive work on profiles that cannot produce a useful email.

## Data Model

### 1. Primary Job Storage

Phase 8 keeps the existing storage model for actual daily results:

- update `users/{uid}.dailyJobs`
- update `users/{uid}.lastJobFetchTime`
- update `users/{uid}.seenJobFingerprints`
- store the dated snapshot in `users/{uid}/daily_matches/{date}`

This preserves compatibility with the dashboard path and existing product reads.

### 2. Execution Records

Add a small orchestration collection such as `cronRuns`.

Suggested document shape:

```ts
interface CronRun {
  userId: string;
  runDate: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  dispatchSource: 'daily-alerts';
  plan: string;
  email?: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  jobsStored?: number;
  emailSent?: boolean;
}
```

Purpose:

- prevent duplicate processing for the same user/day
- provide execution visibility
- capture failure reasons without polluting the user profile
- support controlled retries later

Execution records are orchestration metadata only. They are not the source of truth for job results.

### 3. Deterministic Run Key

Use a deterministic per-user per-day key:

```text
{userId}_{runDate}
```

Rules:

- dispatcher creates the record once for the IST cron day
- worker re-reads the record before processing
- `completed` means no second run for that day
- `processing` means a duplicate invocation should exit if the run still looks fresh
- `failed` may be retried explicitly later

This gives the cron engine basic idempotency without introducing a full queue system.

## Time Boundary

Phase 8 should use the same 8:00 AM IST boundary already implied by the existing schedule and dashboard cache logic.

Rules:

- the Vercel schedule remains `30 2 * * *`
- the run date should represent the IST cron day, not raw UTC midnight
- scheduled generation and manual daily cache checks should remain aligned to the same business day

This avoids mismatches where the cron engine and dashboard disagree about whether a given day has already been generated.

## Server Ownership Boundaries

The current browser flow in `src/hooks/useDashboardJobs.ts` already performs:

1. `generateDailyJobs()`
2. profile updates
3. dated `daily_matches` writes
4. alert email sending

Phase 8 keeps that path for manual dashboard refreshes, but scheduled generation moves to server ownership.

Recommended boundary changes:

- keep email payload generation reusable
- make the worker call server-side email delivery directly rather than relying on browser fetch semantics
- extract or mirror the minimum generation orchestration needed for a server-safe daily run
- avoid depending on client auth state inside the worker path

The goal is not to rewrite the whole AI engine in this phase. The goal is to add a stable server-owned orchestration layer around the existing pipeline.

## Worker Processing Flow

For one user, the worker should follow this exact order:

```text
load user
-> verify active + readiness
-> mark cronRun processing
-> compute plan-aware limit
-> generate jobs
-> persist profile cache fields
-> persist daily_matches snapshot
-> send email if jobs exist
-> mark cronRun completed
```

This ordering follows `CRON_FLOW.md` and preserves the rule that email is never sent before storage succeeds.

## Plan Enforcement

The worker should use the same shared plan helper already used in the product.

Rules:

- free users receive the free daily match limit
- pro users receive the pro daily match limit
- unknown or malformed plans fall back to the free tier

This keeps scheduled generation aligned with the existing product behavior instead of introducing a second source of truth.

## Failure Handling

### 1. Bad Or Incomplete User Data

- mark the execution `skipped`
- record the reason
- do not fail the whole cron

### 2. Generation Failure

- mark the execution `failed`
- capture the error message
- do not send email

### 3. Storage Failure

- mark the execution `failed`
- do not send email
- preserve the failure reason for later inspection

### 4. Email Failure After Storage

- keep the stored jobs
- mark the execution `failed`
- record `emailSent = false`

### 5. Dispatcher-Level Failure

- one user failure must not block other users
- dispatcher should continue queuing remaining eligible users when possible

This phase favors isolation over all-or-nothing behavior.

## Concurrency Strategy

Phase 8 is dispatcher-shaped, but it should still be conservative.

Rules:

- dispatch users in a bounded batch per cron invocation
- allow multiple worker invocations, but avoid unbounded fan-out
- keep the dispatcher contract stable so a future real queue can sit behind it later

This is intentionally not a full queue system. It is a small scalable step that fits the current repo and hosting model.

## Testing Strategy

### Unit Tests

Add focused tests for:

- active-user filtering
- IST run-date generation
- deterministic cron run key generation
- worker state transitions: `queued -> processing -> completed`
- worker skip transitions for incomplete profiles
- worker failure transitions for generation and email failures

### Integration-Focused Tests

Add focused tests for:

- email is sent only after storage succeeds
- free scheduled users use the free match limit
- pro scheduled users use the pro match limit
- duplicate worker invocations do not re-process a completed run
- both cron routes reject invalid authorization

The goal is not to fully simulate live external systems. The goal is to lock down orchestration rules and sequencing.

## Out Of Scope

Phase 8 does not include:

- third-party queue services
- a retry dashboard
- webhook-driven orchestration
- full server-only extraction of every AI service
- cross-region worker coordination
- a complete cron analytics UI

These can be layered on later after the dispatcher and worker contract are stable.

## Recommended Rollout

Recommended implementation order:

1. convert `api/cron/daily-alerts.ts` into a true dispatcher
2. add the per-user worker route
3. add `cronRuns` idempotency and status tracking
4. wire worker persistence to the existing daily match storage model
5. wire email delivery after successful storage
6. add focused tests for auth, sequencing, and failure handling

This order keeps the cron surface simple while building the most important guarantees first.

## Success Criteria

Phase 8 is successful when:

- the daily loop is server-owned
- active users are dispatched once per IST cron day
- each user run is isolated from other users
- jobs are stored before email is sent
- execution outcomes are observable through per-user records
- scheduled generation uses the same plan rules as the product
- the design can later move behind a real queue without changing the external cron entrypoint
