# Apify Job Discovery + Career Path Suggestions (Backend Spec)

## Goal

Replace the current job discovery (feed/web-search based) with Apify as the primary source of real job listings, while preserving the existing pipeline invariants:

- No fake jobs (jobs must be sourced from real external sources)
- Validator runs before AI
- Plan limits applied after scoring
- Store to Firestore before sending email

Add an AI-backed “top 3 career path suggestions” feature that helps each user pick a targeting mode for job discovery and scoring.

## Scope

### In scope

- Add an Apify-backed discovery source integrated into `researchJobs()` so the cron pipeline can remain unchanged.
- Normalize Apify results into the existing `DiscoveredJob` contract.
- Add a new stored user field for career path suggestions and a selected career path ID.
- Use the selected career path to influence discovery inputs and query hints.
- Add server-side configuration for Apify token usage via environment variables.

### Out of scope (non-goals)

- No frontend redesign work (UI changes only if required to select a career path).
- No new providers called directly from the frontend.
- No weakening of deterministic validation rules.
- No committing any secrets/tokens to the repository.

## Key decision: Integration strategy

Apify is integrated as a new discovery source inside `src/services/jobResearcher.ts` so existing callers stay stable:

- Nightly cron: `/api/cron/process-user.ts` calls `researchJobs()` unchanged.
- On-demand endpoint: `/api/jobs/index.ts` can continue to work, optionally benefiting from the new Apify source via `researchJobs()`.

## Apify source design

### Actor

- Primary actor: `fantastic-jobs~career-site-job-listing-api`

### Token handling (security)

- Token is stored only in server runtime environment variables (Vercel).
- The token must never appear in logs, committed files, or client bundles.

### Input strategy (ATS-only)

Discovery inputs are constrained to ATS-powered sources already represented by the existing allowlist/orchestrator layer:

- Use `loadAtsAllowlist()` to load ATS sources from Firestore.
- Map ATS sources to the actor’s input format (exact field names derived from the actor’s OpenAPI schema).

### Output normalization

Apify dataset items are normalized into `DiscoveredJob` with:

- Stable `fingerprint = jobFingerprint(title, company)`
- `applyUrl` when available (preferred)
- `postedAt` when available; otherwise infer safely and compute `daysOld` conservatively
- `source` set to an Apify-specific identifier (e.g. `apify`)

All downstream stages operate unchanged because they already consume `DiscoveredJob[]`.

## Career path suggestions (Top 3)

### Behavior

- For each user, generate up to 3 career path suggestions from the resume + stored preferences.
- The user selects one suggestion; the selection is used in:
  - Discovery targeting hints (keywords, ATS sources if mapped)
  - Scoring context (match reasons / skill gaps consistency)

### Storage

Persist on the user document:

- `careerPathSuggestions`: array of `{ id, title, rationale, queryHints }`
- `selectedCareerPathId`: string
- `careerPathGeneratedAt`: timestamp

### Generation trigger

- On onboarding completion (first resume upload/parse)
- On resume updates

## Data flow (end-to-end)

1. Load user profile + resume context.
2. Ensure career path suggestions exist (generate if missing or stale).
3. Read selected career path.
4. Run `researchJobs()`:
   - Load ATS allowlist sources
   - Call Apify actor
   - Normalize into `DiscoveredJob[]`
5. Run deterministic validator over discovered jobs.
6. Run AI scoring + enrichment using existing model routing.
7. Apply plan limits after scoring.
8. Store to Firestore.
9. Send email via Resend.

## Error handling & fallbacks

- Missing Apify token: fail fast with a clear server configuration error.
- Apify actor failure/timeouts: treat as discovery failure for that run (no AI fallback that fabricates jobs).
- Empty results: store an empty batch with metadata and skip email (or send an “empty day” email only if that behavior already exists).

## Verification

- Unit tests for:
  - Apify item → `DiscoveredJob` normalization
  - Dedupe/fingerprint stability
  - Validator ordering (validator invoked before any AI stage)
- Integration test stubs (mock Apify HTTP responses).
- Commands:
  - `npm run lint`
  - `npm run test`

## Acceptance criteria

- Nightly cron continues to run without interface changes to cron endpoints.
- Discovery uses Apify as the primary source and emits `DiscoveredJob[]` compatible with scoring.
- Deterministic validation still runs before any AI scoring/enrichment.
- Career path suggestions (top 3) are generated server-side and stored; a selected career path influences discovery/scoring.
- No tokens or secrets are added to tracked files or logs.

