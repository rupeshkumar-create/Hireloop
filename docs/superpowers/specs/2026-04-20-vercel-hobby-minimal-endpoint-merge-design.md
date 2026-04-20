# Vercel Hobby Minimal Endpoint Merge Design

## Goal

Reduce the current real Vercel API route count from 14 to 12 with the smallest possible behavior change.

## Scope

Merge exactly these route pairs:

- `api/jobs/request.ts` + `api/jobs/trigger.ts`
- `api/blog/post.ts` + `api/blog/posts.ts`

No other routes will be consolidated in this change.

## Recommended Approach

Use one shared route file per pair and preserve existing external behavior through query parameters and request handling branches.

Resulting route layout:

- `api/jobs/index.ts`
- `api/blog/index.ts`

Files removed:

- `api/jobs/request.ts`
- `api/jobs/trigger.ts`
- `api/blog/post.ts`
- `api/blog/posts.ts`

## Routing Design

### Jobs Route

Create one endpoint:

- `POST /api/jobs`

Request modes:

- async dispatch mode: `{"mode":"request"}`
- sync trigger mode: `{"mode":"trigger"}`

Frontend update:

- the dashboard first calls `/api/jobs` with `mode: "request"`
- if that returns any `5xx`, it retries `/api/jobs` with `mode: "trigger"`

This preserves the existing two-stage behavior while removing one Vercel function.

### Blog Route

Create one endpoint:

- `GET /api/blog`

Query modes:

- list posts: `/api/blog?limit=20`
- single post: `/api/blog?slug=some-slug`

Behavior:

- if `slug` is present, return one post
- otherwise return the posts list

This preserves public API capability while removing one Vercel function.

## Compatibility

The merge must preserve:

- existing auth and dispatch logic for jobs
- existing fallback from async dispatch to sync trigger
- existing blog list behavior
- existing single blog post fetch behavior
- no changes to admin or cron routes

## Error Handling

Jobs:

- invalid or missing mode returns `400`
- auth handling remains unchanged
- existing `401`, `5xx`, `202`, and `200` semantics stay intact

Blog:

- `slug` not found remains `404`
- invalid method remains `405`
- shared cache headers remain appropriate for list and detail responses

## Validation Plan

- update the dashboard client to call the merged jobs route
- run a production build
- verify there are exactly 12 route files left under `api/`
- check there are no stale frontend or internal references to removed route files

## Out Of Scope

- merging admin routes
- merging cron routes
- changing route auth model
- changing blog content schema
- changing job generation business logic

## Success Criteria

- `api/` contains 12 real route files
- dashboard job generation still works
- blog list and single-post fetch still work
- build passes
- final changes are committed and pushed
