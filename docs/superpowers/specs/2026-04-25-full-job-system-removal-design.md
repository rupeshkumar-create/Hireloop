# Full Job System Removal Design

## Goal

Remove the live job research and matching system from the app completely.

After this change, the app should no longer:

- research jobs
- score or enrich jobs
- generate daily job batches
- run job cron dispatch or per-user job processing
- store or read daily matches as an active product feature
- expose admin controls that run the deleted pipeline

The rest of the app should continue to work.

## Scope

This change removes the full jobs subsystem across frontend, backend, admin, tests, and docs.

Included:

- job discovery and matching services
- job cron routes and job-only backend routes
- daily job dashboard loading logic
- job-only admin simulation flows
- job-only scripts, tests, and docs
- top-level architecture docs that still describe the jobs engine as active

Not included:

- deleting historical production Firestore data
- redesigning the dashboard beyond making jobs unavailable safely
- replacing jobs with a new feature
- removing unrelated AI features such as resume tailoring, cold email generation, or interview prep unless they fail only because of removed job data

## Recommended Approach

Use one clean removal pass instead of a soft disable.

Recommended flow after the change:

`Frontend shell -> placeholder jobs state -> static unavailable UI`

Why this approach is recommended:

- it matches the requested outcome of deleting the feature from the app
- it avoids dead code paths that still compile but should never run
- it reduces future maintenance by removing hidden backend dependencies
- the repo already contains prior design context for removing this subsystem

Soft-disable and phased approaches are not recommended because they leave the codebase in a half-removed state.

## Architecture

### 1. Remove Runtime Entry Points

Delete all runtime paths that can trigger live job generation or matching.

This includes:

- `api/jobs/index.ts`
- `api/cron/daily-alerts.ts`
- `api/cron/process-user.ts`
- `scripts/generate-daily-jobs.ts`

The app must have no active route or script that can perform job research, matching, daily storage, or job email delivery.

### 2. Remove Core Job Services

Delete the services that perform job discovery and job ranking:

- `src/services/jobResearcher.ts`
- `src/services/jobMatchingEngine.ts`
- `src/services/cronEngine.ts`
- `src/types/dailyJob.ts`

These files define the current jobs pipeline and should not remain as dormant code.

### 3. Replace Frontend Job Consumption

Keep the dashboard page and navigation structure, but remove live jobs behavior.

Required frontend behavior:

- no Firestore read from `users/{uid}/daily_matches/*`
- no read of `users.dailyJobs` as an active feature path
- no request to removed job APIs
- no request to cron routes
- no job generation button that still implies backend execution

The frontend jobs surface should become a safe placeholder that explains the feature is unavailable in this version.

### 4. Remove Admin Job Simulation

Admin tools must not be able to invoke the removed jobs pipeline.

Required behavior:

- remove admin imports of `jobResearcher` and `jobMatchingEngine`
- remove ghost mode flows that simulate daily jobs
- remove or disable UI controls that depend on the deleted pipeline

Admin user management can remain, but job simulation cannot.

### 5. Remove Active Firestore Dependencies

Code must stop actively reading or writing job delivery data such as:

- `users.dailyJobs`
- `users.dailyJobsMeta`
- `users.lastJobFetchTime`
- `users/{uid}/daily_matches/{date}`
- `cronRuns` records that exist only for jobs delivery

Historical data may remain in Firestore, but app code must no longer depend on it.

### 6. Clean Up Docs And Tests

Remove or update docs and tests that describe the deleted subsystem as active.

Likely cleanup targets:

- `JOB_ENGINE_FLOW.md`
- job-removal-obsolete specs/plans that only document the active jobs pipeline
- tests for `cronEngine`, `jobMatchingEngine`, dashboard match rendering, and related job-only helpers
- top-level architecture docs such as `SYSTEM_FLOW.md` and `CRON_FLOW.md`

If a document still matters historically but contains active guidance, it should be updated so it no longer misrepresents the current product.

## File Groups

### Delete

- `api/jobs/index.ts`
- `api/cron/daily-alerts.ts`
- `api/cron/process-user.ts`
- `scripts/generate-daily-jobs.ts`
- `src/services/cronEngine.ts`
- `src/services/jobResearcher.ts`
- `src/services/jobMatchingEngine.ts`
- `src/types/dailyJob.ts`
- job-only tests and job-only docs

### Modify

- `src/hooks/useDashboardJobs.ts`
- `src/components/dashboard/MatchesTab.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/services/adminGhostMode.ts`
- `src/contexts/AuthContext.tsx`
- `SYSTEM_FLOW.md`
- `CRON_FLOW.md`
- any remaining file that imports removed job modules

### Verify Carefully

- `src/components/dashboard/JobDetailsPanel.tsx`
- `src/components/dashboard/matchPaywall.ts`
- `src/lib/jobLinks.ts`
- `src/services/learningSignals.ts`
- `src/services/aiService.ts`
- `vercel.json`
- `firestore.rules`

## Frontend Design

### Dashboard

The dashboard remains available, but the jobs area becomes presentation-only.

Required behavior:

- render a clear placeholder or unavailable state
- do not crash if job arrays are absent
- keep layout stable
- remove selection, save, dismiss, and request-new-jobs behavior if it depends on deleted data

If some local-only filtering state still exists after removal, it should be simplified rather than preserved for a feature that no longer exists.

### Hook Contract

`useDashboardJobs.ts` should either:

- become a minimal placeholder hook that returns empty state and harmless handlers, or
- be removed entirely if the dashboard no longer needs a dedicated jobs hook

Recommendation:

- keep a minimal hook for now if it reduces UI churn during removal

This minimizes the surface area of frontend rewrites while still removing live behavior.

## Admin Design

Admin user listing and basic admin operations may remain.

Job-specific admin behavior must be removed:

- no generate-debug-result flow
- no simulate daily jobs flow
- no persist preview of generated jobs
- no admin UI that implies job research or matching still exists

If ghost mode is now job-only, it should be removed rather than left as dead abstraction.

## Error Handling

After removal:

- frontend pages must not fail due to missing `dailyJobs` data
- removed backend routes must not be referenced anywhere in code
- removed service imports must be fully cleaned up
- build and typecheck must pass without the deleted modules

User-facing messaging should be explicit and simple:

- jobs feature removed
- job discovery unavailable

There should be no misleading loading states that suggest jobs are still processing.

## Testing And Verification

Minimum verification:

- run typecheck
- run build
- search for leftover imports of removed job services and types
- search for leftover route references to removed job APIs
- confirm dashboard renders without live jobs
- confirm admin page no longer imports the deleted pipeline

Add new tests only if needed to support the placeholder dashboard or changed admin behavior. Avoid replacing deleted backend tests with low-value tests for removed functionality.

## Success Criteria

- no live job research or matching code remains active in the app
- no runtime route can generate or process jobs
- no active frontend path fetches or renders live daily matches
- no admin tool invokes the deleted jobs pipeline
- top-level docs no longer present the jobs engine as an active system
- the app still typechecks and builds
