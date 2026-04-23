# Remove Job Backend Keep Frontend Design

## Goal

Remove the entire backend daily-jobs system while keeping the frontend application intact.

The frontend may still contain dashboard layout and placeholder UI, but it must no longer fetch, generate, store, or depend on job backend data.

## Scope

Remove all job-related backend responsibilities:

- API routes for job generation and job processing
- cron handlers used for job generation
- Firestore reads/writes used only for jobs
- job generation engines and supporting services that exist for this feature
- job-specific backend scripts
- job-related technical docs, plans, specs, and tests where they are clearly about this backend feature

Keep frontend structure:

- dashboard page
- navigation
- general frontend components

But remove live job functionality from the frontend:

- no fetching daily jobs
- no generating jobs
- no Firestore-driven daily job rendering
- no dependency on backend job routes

## Recommended Approach

Recommended approach:

- replace the current jobs frontend state hook with a minimal frontend-safe stub
- remove backend routes and engines in one focused pass
- update the dashboard and matches UI to render placeholder or disabled content instead of live job data

This avoids leaving half-connected code paths that still expect Firestore or server routes.

## Architecture

Before:

`Frontend dashboard -> useDashboardJobs -> Firestore + /api/jobs + cron + engines`

After:

`Frontend dashboard -> frontend-only placeholder state`

The jobs feature becomes presentation-only. No backend execution path remains.

## Files Likely In Scope

Backend removal targets likely include:

- `api/jobs/index.ts`
- `api/cron/process-user.ts`
- `api/cron/daily-alerts.ts` if it is only for jobs
- `scripts/generate-daily-jobs.ts`
- `src/services/cronEngine.ts`
- `src/services/jobResearcher.ts`
- `src/services/jobMatchingEngine.ts`
- `src/types/dailyJob.ts`
- tests that only verify this backend feature

Frontend updates likely include:

- `src/hooks/useDashboardJobs.ts`
- `src/components/dashboard/MatchesTab.tsx`
- `src/pages/Dashboard.tsx`
- any frontend component importing job-only backend data shapes

Docs cleanup likely includes:

- job-engine docs
- job-specific implementation plans/specs
- architecture docs sections that describe the removed system

## Firestore Impact

Code must stop using:

- `users/{uid}/daily_matches/*`
- `users.dailyJobs`
- `users.lastJobFetchTime`
- cron run records used only by this feature
- tracked job persistence that exists only because of daily jobs

This change does not need to delete existing production data. It only removes code paths that read or write it.

## Error Handling

After removal:

- the frontend must not throw because job arrays are missing
- the dashboard must not call removed endpoints
- no dead imports should remain
- no route references to deleted backend files should remain

## Validation Plan

- verify frontend builds successfully
- verify there are no imports left for removed job backend modules
- verify there are no route references left for removed job APIs
- verify dashboard still renders without the jobs backend
- verify tests still pass where applicable

## Out Of Scope

Not included:

- redesigning the whole dashboard
- replacing jobs with a new feature
- deleting production Firestore data manually
- broad unrelated cleanup outside this feature area

## Success Criteria

- no job backend routes remain
- no job engines remain
- no Firestore job read/write paths remain in code
- frontend still builds and renders
- removed feature docs/tests are cleaned up
- changes are committed and ready to push
