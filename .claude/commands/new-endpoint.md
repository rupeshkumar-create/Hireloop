---
description: Scaffold a new Vercel API endpoint with auth and error handling
---

Create a new Vercel serverless function in `api/` for HireSchema.

## What I need from you

Tell me:
1. The endpoint path (e.g. `api/jobs/refresh.ts`)
2. The HTTP method (GET / POST)
3. Auth type: `firebase-user` (ID token), `cron` (CRON_SECRET), `internal-cron` (INTERNAL_CRON_SECRET), or `none`
4. What the endpoint does (1–2 sentences)

## Pattern to follow

Look at `api/jobs/trigger.ts` (firebase-user auth) or `api/cron/process-user.ts` (cron auth) as your reference.

All endpoints must:
- Import from `../_lib/firebaseAdmin` for Firestore access
- Import from `../_lib/cronAuth` for cron auth verification
- Return `{ success: true, data: ... }` on success
- Return `{ error: "message" }` with appropriate HTTP status on failure
- Never expose internal error stack traces in the response body
- Never call OpenRouter directly — use `api/openai.ts` proxy for AI calls

After creating the file, run `npm run lint` to verify types.
