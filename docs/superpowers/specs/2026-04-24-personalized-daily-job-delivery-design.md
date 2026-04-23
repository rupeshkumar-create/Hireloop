# Personalized Daily Job Delivery Design

## Goal

Improve the daily jobs system so users see jobs matched to their resume, career paths, and settings, with delivery scheduled in each user's local time.

The system should preserve the current monetization model:

- Pro users receive up to `10` strong matches per day
- Free users receive up to `1` strong match per day

The system should remain quality-first:

- weak matches must not be used just to fill the quota
- users may receive fewer than the plan target when the quality bar is not met

## Scope

This change covers:

- better per-user daily scheduling using local timezone and preferred send hour
- stronger profile readiness checks before job generation
- tighter matching using resume, career paths, and settings together
- richer run metadata so the dashboard can explain what happened
- frontend settings and dashboard updates needed to support this workflow
- focused tests for scheduling, eligibility, and quality-limited runs

This change does not replace the current jobs product with a new system. It upgrades the existing cron, matching, storage, and dashboard flow.

## Recommended Approach

Use the existing cron + Firestore architecture and strengthen it in place.

Recommended flow:

`User profile -> readiness check -> due-user scheduler -> discovery -> scoring -> quality filtering -> store daily batch -> dashboard + email delivery`

Why this approach is recommended:

- the current codebase already uses this architecture
- the dashboard already reads precomputed daily matches from Firestore
- the existing per-user processing path already supports job generation and delivery
- this avoids a risky rewrite while still improving personalization and reliability

Alternative approaches such as a full queue-first platform or a shared global job pool are out of scope for this change.

## Product Rules

These rules are fixed for this design:

- Pro users target up to `10` jobs per day
- Free users target up to `1` job per day
- delivery happens in the user's local timezone
- `receiveDailyAlerts !== false` still controls email eligibility
- quality beats quantity, so low-confidence jobs should be excluded even when the target count is not reached

## Current Context

The current codebase already has the main building blocks:

- a dispatcher route in `api/cron/daily-alerts.ts`
- a per-user processing route in `api/cron/process-user.ts`
- scheduling and run-state helpers in `src/services/cronEngine.ts`
- a ranking engine in `src/services/jobMatchingEngine.ts`
- a dashboard data hook in `src/hooks/useDashboardJobs.ts`
- plan-aware limits in `src/lib/planLimits.ts`
- user preference editing in `src/pages/Settings.tsx`

The main gaps are not "missing jobs infrastructure." The main gaps are:

- no per-user local-time delivery scheduling
- weak visibility into why runs were skipped or returned fewer jobs
- incomplete readiness modeling for profile quality
- matching inputs are not normalized into one canonical delivery-oriented workflow

## Architecture

### 1. Profile Readiness Layer

Add a clear readiness evaluation step before job generation.

Inputs used for readiness:

- `resumeText`
- `careerPaths`
- normalized matching preferences derived from settings
- delivery preferences such as timezone and preferred send hour

Readiness outcomes:

- `ready`: enough information exists to generate relevant jobs
- `partial`: matching is possible but quality may be limited
- `blocked`: not enough information to generate useful jobs

Recommended blocking rules:

- block only when both of these are missing:
  - usable resume text
  - at least one meaningful career path

Recommended partial-quality rule:

- if resume text is very short or missing, but career paths exist, allow the run and record that the result quality may be limited

This readiness result should be stored so the dashboard can explain what the user needs to improve.

### 2. Due-User Scheduler

Keep the existing dispatcher shape, but change user selection from stale-first global ordering to due-now local-time scheduling.

Required behavior:

- every user has a `deliveryTimezone`
- every user has a `preferredDeliveryHour`
- the dispatcher selects only users whose local time has reached or passed that hour
- a user must not receive more than one completed run for the same local date

Recommended idempotency rule:

- derive the unique daily run identity from `userId + localDate`

This should remain compatible with the existing `queued -> processing -> completed | skipped | failed` run lifecycle.

### 3. Matching Pipeline

Keep the current discovery and ranking pipeline, but make the scoring inputs more explicitly profile-driven.

Matching inputs:

- resume text
- career paths
- work type preferences
- location preference
- salary floor
- anti-slop / quality preferences
- recent seen fingerprints to reduce repetition

Required matching behavior:

- discovery gathers a broad candidate pool
- scoring ranks jobs against the user profile
- quality filters remove weak jobs before final selection
- final selection takes the best remaining jobs up to the plan limit

Quality-first rule:

- if only `4` strong matches exist for a Pro user, store and deliver `4`
- do not pad the result with weak matches only to reach `10`

### 4. Storage and Delivery

The stored daily batch remains the source of truth for both dashboard and email.

Required behavior:

- store one daily batch per user per local date
- the dashboard reads the stored batch
- the email uses the same stored batch
- do not regenerate a second independent set for email

This keeps the user experience consistent across surfaces and reduces duplicate processing.

### 5. Frontend Consumption

Keep the existing high-level frontend flow:

`Dashboard -> useDashboardJobs -> Firestore`

The frontend should not reimplement matching logic. Its job is to explain the result clearly:

- when the next delivery will happen
- when the last run completed
- why fewer than the target number of jobs were delivered
- what profile changes would improve matching quality

## Data Model

### User Profile Fields

Add or formalize the following fields on `users/{uid}`:

- `deliveryTimezone`
  - IANA timezone string such as `Asia/Kolkata`
- `preferredDeliveryHour`
  - integer hour in local time, e.g. `8`
- `lastSuccessfulJobRunLocalDate`
  - local date string used to prevent duplicate daily sends
- `matchReadiness`
  - object containing:
    - `status`
    - `hasResume`
    - `hasCareerPaths`
    - `blockingReason`
    - `qualityWarnings`
- `matchingPreferences`
  - canonical normalized job-matching settings

The `matchingPreferences` object should become the canonical source used by the jobs system, even if some legacy top-level fields remain for compatibility.

### Daily Match Record Fields

Extend the stored daily batch with operational metadata:

- `requestedLimit`
- `returnedCount`
- `qualityFilteredCount`
- `dedupedCount`
- `deliveryTimezone`
- `deliveryLocalDate`
- `emailSent`
- `qualityLimited`
- `skipReason`
- `warnings`

The record should remain easy for the dashboard to read directly.

## Scheduling Logic

### Due Selection

A user is due when:

- the user is active for daily jobs
- the user's local hour is at or after `preferredDeliveryHour`
- no completed run exists for that user's current local date

Users not meeting those conditions are skipped by the dispatcher and not queued.

### Eligibility

A queued user is still skipped during processing if:

- the user record no longer exists
- the user is inactive
- the profile is not ready for meaningful matching

The skip reason must be recorded explicitly.

### Duplicate Protection

Duplicate safety must exist at two levels:

- dispatcher-level: avoid queueing duplicate runs for the same user and local date
- processor-level: avoid reprocessing when a run is already `processing` or `completed`

## Matching Rules

### Target Counts

Use existing plan logic:

- Free: `1`
- Pro: `10`

These are maximum daily counts, not guaranteed counts.

### Strictness

Strengthen the minimum match threshold so irrelevant jobs are filtered earlier.

The threshold should consider:

- title alignment to career paths
- overlap between resume evidence and job requirements
- work type compatibility
- location compatibility
- salary compatibility when a floor exists

### Deduplication

Deduplicate against:

- recent seen fingerprints
- duplicates within the same discovery batch
- same-company same-title near-duplicates where practical

The goal is to reduce repeated low-value recommendations across days.

## Error Handling

### Research Failure

If discovery fails, mark the run as `failed` and store a reason.

Do not write misleading partial dashboard data.

### Low-Quality Results

If discovery succeeds but not enough jobs pass the quality threshold:

- mark the run `completed`
- store the smaller result set
- set `qualityLimited = true`

This ensures the product stays truthful while still giving the user the best available results.

### Profile Not Ready

If the user lacks usable resume text and career paths:

- mark the run as `skipped`
- store a human-readable `skipReason`

### Email Failure

If Firestore storage succeeds but email delivery fails:

- keep the run `completed`
- store `emailSent = false`
- do not discard the dashboard batch

## Frontend Changes

### Settings

Update `src/pages/Settings.tsx` to add:

- delivery timezone control
- preferred delivery hour control
- clearer job-matching preference grouping

The settings page should remain the main place where the user controls:

- career paths
- work type
- locations
- salary floor
- daily alerts
- delivery schedule

### Dashboard

Update the dashboard jobs experience so it explains system state better.

Recommended additions:

- next delivery time
- last completed run time
- quality-limited message when fewer than target jobs were found
- profile improvement prompt when readiness is partial or blocked

The existing list and job detail workflow should remain intact.

## Testing

Testing should focus on behavior, not styling.

Required coverage:

- due-user selection in local time
- prevention of duplicate daily runs
- readiness-based skip behavior
- quality-limited completion behavior
- plan-based target counts still resolving to `1` and `10`
- dashboard compatibility with richer daily batch metadata

Add tests only where they materially reduce regression risk in cron, matching, and dashboard state handling.

## Validation Plan

- verify settings can save delivery timezone and preferred send hour
- verify the dispatcher queues only due users
- verify processing uses local-date idempotency
- verify weak profiles are skipped with clear reasons
- verify strong profiles can receive fewer than the target when quality is low
- verify the dashboard still renders with stored daily batches
- verify email failure does not erase stored dashboard results
- run targeted tests and project diagnostics after implementation

## Out Of Scope

This design does not include:

- changing monetization so all users receive `10` jobs per day
- replacing Firestore with a new data store
- building a separate queue platform
- redesigning the full dashboard UI
- deleting historical job data
- changing the core saved-job tracker product

## Success Criteria

The change is successful when:

- Pro users receive up to `10` strong jobs per day
- Free users receive up to `1` strong job per day
- delivery respects each user's local timezone and preferred hour
- jobs are ranked using resume, career paths, and settings together
- users can receive fewer than the target when weak matches are filtered out
- the dashboard clearly explains run outcomes, not just raw job counts
- duplicate same-day runs are prevented
- the implementation fits the current cron + Firestore architecture
