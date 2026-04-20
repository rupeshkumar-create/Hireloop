# Vercel API Helper Relocation Design

## Goal

Reduce Vercel Hobby-plan function counting risk by ensuring `api/` contains only real route handlers.

This change will move helper and test files out of `api/_lib` and into `src/server`, then update imports so runtime behavior stays the same.

## Scope

Files to move:

- `api/_lib/firebaseAdmin.ts` -> `src/server/firebaseAdmin.ts`
- `api/_lib/cronAuth.ts` -> `src/server/cronAuth.ts`
- `api/_lib/marketingEngine.ts` -> `src/server/marketingEngine.ts`
- `api/_lib/firebaseAdmin.test.ts` -> `src/server/__tests__/firebaseAdmin.test.ts`

Route handlers that will be updated:

- `api/jobs/request.ts`
- `api/jobs/trigger.ts`
- `api/cron/daily-alerts.ts`
- `api/cron/process-user.ts`
- `api/cron/daily-blog.ts`
- `api/cron/weekly-analysis.ts`
- `api/blog/post.ts`
- `api/blog/posts.ts`
- `api/blog/seed-strategy.ts`
- `api/admin/bootstrap.ts`
- `api/admin/users.ts`

## Approach

Recommended approach:

- Keep all HTTP entrypoints in `api/`
- Move all reusable server-only modules into `src/server/`
- Keep tests beside server modules under `src/server/__tests__/`

This preserves URL structure while making the Vercel deployment layout unambiguous.

## Architecture

Before:

`api routes -> api/_lib helpers`

After:

`api routes -> src/server helpers`

There is no intended runtime behavior change. Only file locations and import paths change.

## Vercel Impact

Expected improvement:

- `api/` contains only real route files
- helper files are no longer colocated with functions
- the Firebase admin test is no longer inside `api/`

This directly addresses the user's current Hobby-plan deployment issue caused by non-route files living under `api/`.

## Compatibility

The move must preserve:

- Firebase Admin initialization behavior
- cron auth secret behavior
- marketing engine behavior
- all current API URLs
- existing test behavior for Firebase admin helpers

## Error Handling

No logic changes are planned in the moved modules.

Risk areas:

- broken relative import paths
- test import paths after relocation
- route handlers accidentally pointing to stale files

Mitigation:

- update all imports in one pass
- run targeted tests for the moved Firebase admin module
- run a production build after the move
- confirm there are no remaining non-route `.ts` files under `api/_lib`

## Validation Plan

Required checks:

- run the Firebase admin test after relocation
- run a production build
- verify `api/` no longer contains the moved helper files
- confirm Git working tree contains only the expected relocation changes

## Out Of Scope

Not included in this change:

- merging or consolidating API endpoints
- changing endpoint URLs
- changing cron scheduling
- changing blog or marketing feature behavior

## Success Criteria

- helpers live under `src/server/`
- tests live outside `api/`
- all imports resolve correctly
- build passes
- targeted tests pass
- changes are committed and pushed to GitHub
