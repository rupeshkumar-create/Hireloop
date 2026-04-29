# HireSchema — Job Search / Daily Matches Report

This report documents how the “Job Search” (Daily Matches) feature works in the HireSchema project, including architecture, key modules, important functions, dependency relationships, run instructions, and the most likely reasons you’re seeing the empty-state “No remote jobs curated yet today”.

## 1) Overall Architecture

### Runtime shape

- **Frontend (SPA)**: Vite + React 19 + React Router renders the website and authenticated app UI.
- **API (Serverless)**: Vercel Serverless Functions under [api/](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api) implement cron dispatching, per-user job generation, OpenRouter proxying, admin endpoints, and email sending.
- **Persistence**: Firebase Auth (Google sign-in) + Firestore (user profiles, daily match batches, tracked jobs, cron run records).
- **Schedulers**:
  - **Vercel Cron** triggers `/api/cron/daily-alerts` on a schedule: [vercel.json](file:///Users/rupesh/Desktop/Side%20projects/hireschema/vercel.json)
  - **GitHub Actions** can also run the job generation script on schedule and for user-triggered dispatch: [generate-jobs.yml](file:///Users/rupesh/Desktop/Side%20projects/hireschema/.github/workflows/generate-jobs.yml), [generate-daily-jobs.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/scripts/generate-daily-jobs.ts)

### High-level data flow (Daily Matches)

1. User signs in → profile document exists in `users/{uid}` via [AuthProvider](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/contexts/AuthContext.tsx#L87-L177).
2. Daily job generation runs (cron or user-triggered) → writes:
   - `users/{uid}.dailyJobs`, `users/{uid}.dailyJobsMeta`, `users/{uid}.lastJobFetchTime`, etc.
   - `users/{uid}/daily_matches/{date}` document containing the batch.
3. Dashboard reads today’s `daily_matches` doc (primary) and falls back to the cached `users/{uid}.dailyJobs` (secondary) via [useDashboardJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts#L59-L173).
4. UI shows jobs in [MatchesTab](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/components/dashboard/MatchesTab.tsx#L349-L657) or shows the empty state if `jobs.length === 0`.

## 2) Major Modules and Responsibilities

### Frontend app

- **Routing / layouts**
  - Routes and auth gating: [App.tsx](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/App.tsx#L1-L115)
  - Main bootstrap: [main.tsx](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/main.tsx#L1-L13)
- **Auth + Profile**
  - Creates user profile on first login; keeps it in sync via Firestore `onSnapshot`: [AuthContext.tsx](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/contexts/AuthContext.tsx#L118-L208)
  - Note: `profile` changes drive the dashboard hooks (including “jobs arrived” updates).
- **Dashboard Job Loading**
  - Read today’s batch from `users/{uid}/daily_matches/{YYYY-MM-DD}` and fall back to cached `users/{uid}.dailyJobs`: [useDashboardJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts#L52-L173)
  - User-triggered generation (“Find my remote jobs now”) calls `POST /api/jobs` (mode=request): [useDashboardJobs.requestJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts#L218-L279)
- **Dashboard rendering**
  - Matches feed, filters, paywall placeholders: [MatchesTab](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/components/dashboard/MatchesTab.tsx#L349-L657)

### Backend / API (Vercel Functions)

- **Cron dispatcher**
  - Selects “due” users and fires `/api/cron/process-user` per user: [daily-alerts.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/daily-alerts.ts#L33-L116)
  - Protected by `CRON_SECRET`: [cronAuth.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/cronAuth.ts#L7-L23)
- **Per-user pipeline**
  - Runs the full job engine and stores results: [process-user.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/process-user.ts#L73-L277)
  - Also protected by internal cron secret: [cronAuth.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/cronAuth.ts#L16-L23)
- **User-triggered pipeline**
  - `/api/jobs` returns 202 and dispatches GitHub Actions if configured; otherwise it attempts an inline pipeline run: [api/jobs/index.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/jobs/index.ts#L285-L307)
- **AI gateway (OpenRouter)**
  - Browser-safe proxy endpoint (not used by the cron runner which calls OpenRouter directly): [api/openai.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/openai.ts#L1-L33)
- **Firebase Admin SDK bootstrap**
  - Server-side Firestore/Auth access using `FIREBASE_SERVICE_ACCOUNT_KEY`: [firebaseAdmin.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/firebaseAdmin.ts#L1-L93)

### Core business logic (shared between cron + scripts)

- **cronEngine**
  - Decides if users are eligible/due, orchestrates a run, marks cronRuns, calls generate/store/email functions: [cronEngine.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/cronEngine.ts#L1-L249)
- **jobResearcher**
  - Discovers jobs via Perplexity (and Gemini gap-fill) and normalizes them to a stable shape: [jobResearcher.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/jobResearcher.ts#L1-L483)
- **jobMatchingEngine**
  - Scores jobs in bulk (Gemini), applies deterministic preference filters, enriches top candidates (Claude), then ranks and selects: [jobMatchingEngine.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/jobMatchingEngine.ts#L291-L407)
- **jobDeliveryProfile**
  - Computes “due-ness”, local dates, and scheduling timestamps by timezone: [jobDeliveryProfile.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/jobDeliveryProfile.ts#L155-L220)

## 3) Key Classes / Types and Key Functions

### Core types

- `DailyJob` and daily match record shape: [dailyJob.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/types/dailyJob.ts)
- Dashboard view models: [dashboard.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/types/dashboard.ts)
- Auth/profile model: `UserProfile` in [AuthContext.tsx](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/contexts/AuthContext.tsx#L37-L70)

### Functions that implement Job Search

- **Dashboard read path**
  - Computes the “today” key using the user’s delivery timezone: [localDate.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/lib/localDate.ts#L23-L40)
  - `loadJobs()` reads `users/{uid}/daily_matches/{today}` then falls back to `users/{uid}.dailyJobs` if `lastJobFetchTime` is “today”: [useDashboardJobs.ts:loadJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts#L113-L173)
- **User-triggered job generation**
  - `requestJobs()` calls `POST /api/jobs` (mode=request) and expects a 202 handoff: [useDashboardJobs.ts:requestJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts#L218-L279)
  - `/api/jobs` (request): validates readiness then returns 202 and dispatches GitHub if configured, else tries running pipeline “after response”: [api/jobs/index.ts:handleAsyncDispatch](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/jobs/index.ts#L206-L274)
- **Cron job generation**
  - `/api/cron/daily-alerts` selects due users (based on `nextJobDeliveryAt`) and calls `/api/cron/process-user`: [daily-alerts.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/daily-alerts.ts#L40-L104)
  - `/api/cron/process-user` runs:
    - `researchJobs()` (discovery) + `matchAndRankJobs()` (ranking) then `storeJobs()` (writes Firestore): [process-user.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/process-user.ts#L87-L251)
  - Orchestration core:
    - `processUserCronRun()` (idempotency + readiness + generate/store/email): [cronEngine.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/cronEngine.ts#L155-L249)

## 4) Dependency Relationships

### Logical dependency graph (Job Search)

Frontend:

- [MatchesTab](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/components/dashboard/MatchesTab.tsx) depends on:
  - [useDashboardJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts) (jobs data + requestJobs)
  - [planLimits](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/lib/planLimits.ts) (Free vs Pro limits and paywall behavior)
  - Firestore client SDK via [firebase.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/firebase.ts)

Backend:

- `/api/cron/daily-alerts` depends on:
  - Admin Firestore via [firebaseAdmin.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/firebaseAdmin.ts)
  - Cron auth via [cronAuth.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/cronAuth.ts)
  - Scheduling logic via [cronEngine.evaluateDueUsers](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/cronEngine.ts#L119-L153) + [jobDeliveryProfile.evaluateDueDailyRun](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/jobDeliveryProfile.ts#L186-L220)
- `/api/cron/process-user` depends on:
  - [cronEngine.processUserCronRun](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/cronEngine.ts#L155-L249)
  - [jobResearcher.researchJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/jobResearcher.ts#L418-L483)
  - [jobMatchingEngine.matchAndRankJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/jobMatchingEngine.ts#L318-L407)
  - Resend payload builder: [emailService.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/emailService.ts)
- `/api/jobs` depends on:
  - Firebase Auth verify via [firebaseAdmin.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/firebaseAdmin.ts)
  - `processUserCronRun()` (shared orchestration): [cronEngine.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/cronEngine.ts#L155-L249)
  - Optional GitHub dispatch env vars (`GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`)

### External dependencies (that must be configured)

- OpenRouter API key (`OPENROUTER_API_KEY`) for all job generation: [.env.example](file:///Users/rupesh/Desktop/Side%20projects/hireschema/.env.example#L1-L6)
- Firebase service account key (`FIREBASE_SERVICE_ACCOUNT_KEY`) for server functions to read/write Firestore and verify user ID tokens: [.env.example](file:///Users/rupesh/Desktop/Side%20projects/hireschema/.env.example#L16-L25)
- Cron secrets (`CRON_SECRET`, `INTERNAL_CRON_SECRET`) to unlock cron endpoints: [cronAuth.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/cronAuth.ts#L7-L23)
- GitHub dispatch configuration for async generation (`GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`) if you want the 202 path to actually complete reliably: [api/jobs/index.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/jobs/index.ts#L207-L269)

## 5) How to Run the Project

### Local frontend dev

```bash
cd hireschema
npm install
npm run dev
```

- Starts the Vite dev server on `http://localhost:3000` (see [package.json](file:///Users/rupesh/Desktop/Side%20projects/hireschema/package.json#L6-L15)).
- You must configure Firebase client credentials in [firebase-applet-config.json](file:///Users/rupesh/Desktop/Side%20projects/hireschema/firebase-applet-config.json) for auth + Firestore reads/writes.

### Local verification

```bash
npm run lint
npm test
npm run build
```

### Running the job generation pipeline locally (admin/script)

- GitHub Actions script can be run locally if you provide env vars:

```bash
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
export OPENROUTER_API_KEY='...'
export USER_ID='someFirestoreUserDocId'
npx tsx scripts/generate-daily-jobs.ts
```

### Deploy / scheduled runs

- Firestore rules deployment:

```bash
npm run deploy:rules
```

- Vercel cron schedule lives in [vercel.json](file:///Users/rupesh/Desktop/Side%20projects/hireschema/vercel.json#L11-L24). Cron endpoints require `CRON_SECRET` headers, so the scheduler must supply an Authorization header matching `Bearer ${CRON_SECRET}`.

## 6) Where It’s Going Wrong (Most Likely Causes)

The empty-state you shared renders when `jobs.length === 0` in [MatchesTab](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/components/dashboard/MatchesTab.tsx#L531-L575). That ultimately means the dashboard could not find “today’s” jobs in either:

- `users/{uid}/daily_matches/{todayKey}` (primary), or
- `users/{uid}.dailyJobs` with a “today” `lastJobFetchTime` (fallback).

### A) Very likely: date-key mismatch between cron writes and dashboard reads

- Previous issue (now fixed): dashboard used an IST “today” key while cron stored batches under the user-local `deliveryLocalDate`.
- Cron dispatcher computes a **user-local** `deliveryLocalDate` and passes it as `runDate`: [cronEngine.evaluateDueUsers](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/cronEngine.ts#L119-L153), [daily-alerts.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/daily-alerts.ts#L60-L104)
- `/api/cron/process-user` stores `daily_matches/{date}` where `date` is that runDate (deliveryLocalDate): [process-user.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/process-user.ts#L229-L250)

Fix: dashboard now computes `todayKey` using the same user-local timezone logic via [localDate.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/lib/localDate.ts) and compares cache freshness using `deliveryLocalDate` / localized `lastJobFetchTime`: [useDashboardJobs.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts).

### B) Very likely: Vercel Cron is 401 Unauthorized (no Authorization header)

- `/api/cron/daily-alerts` is protected by `requireCronSecret`: [daily-alerts.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/daily-alerts.ts#L33-L35)
- `requireCronSecret` only accepts `Authorization: Bearer ${CRON_SECRET}`: [cronAuth.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/server/cronAuth.ts#L7-L14)

If the scheduler does not send that header, the cron never runs, so no `dailyJobs`/`daily_matches` are created.

### C) Likely for “Generate now”: 202 response path requires GitHub dispatch to actually run reliably

- `/api/jobs` responds `202` before doing work and relies on GitHub Actions dispatch for async processing: [api/jobs/index.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/jobs/index.ts#L232-L269)
- If `GITHUB_DISPATCH_TOKEN` / `GITHUB_REPO` are missing, it attempts to run the pipeline *after* sending the response. On serverless platforms this work is not guaranteed to complete after the response is returned.

Symptom: user clicks “Find my remote jobs now”, sees loading state, but nothing is ever written to Firestore.

### D) Due-user selection can exclude users entirely

- The dispatcher query requires `nextJobDeliveryAt` to exist because it filters `where('nextJobDeliveryAt', '<=', nowIso)`: [daily-alerts.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/api/cron/daily-alerts.ts#L40-L45)
- Users missing that field (older accounts / manual edits / imports) will never be picked up.

### E) Profile readiness can skip runs (and UI currently doesn’t surface that reason)

- A user without resume text (>= 50 chars) and without career paths is blocked: [computeMatchReadiness](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/jobDeliveryProfile.ts#L62-L101)
- `processUserCronRun` records `cronRuns.status=skipped` with `failureReason`, but the dashboard doesn’t display it: [cronEngine.ts](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/services/cronEngine.ts#L155-L204)

## 7) Debug Checklist (Fastest Path)

1. Confirm generation is happening:
   - Check Firestore `cronRuns/{uid}_{date}` records for `processing/completed/failed/skipped`.
2. Confirm jobs were stored:
   - Check `users/{uid}.dailyJobs` and `users/{uid}.lastJobFetchTime`.
   - Check `users/{uid}/daily_matches/{date}` and verify what `{date}` is (IST vs user-local).
3. Confirm dashboard is reading the same date key:
   - Dashboard reads `daily_matches/{todayLocalDate}` and only trusts `dailyJobs` when the cached batch is from the same local date: [useDashboardJobs](file:///Users/rupesh/Desktop/Side%20projects/hireschema/src/hooks/useDashboardJobs.ts#L113-L214)

## 8) Recommended Fixes (Design-Level)

- Pick one canonical “today key” and use it consistently for:
  - `users/{uid}/daily_matches/{date}`
  - `users/{uid}.dailyJobsMeta.deliveryLocalDate`
  - dashboard read key and cache-freshness checks
- If you want per-user local delivery, change the dashboard to compute “today” using the user’s `deliveryTimezone` (same as cron) rather than IST.
- If you want IST-only delivery for everyone, change cron to use IST `runDate` for storage (and keep `deliveryTimezone` purely for `nextJobDeliveryAt` scheduling).
- For `/api/jobs` user-triggered generation:
  - make the “202” path require GitHub dispatch (and return error if dispatch is not configured), or
  - make it synchronous (return 200 only after Firestore is written).
