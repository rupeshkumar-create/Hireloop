# Structured-First Job Discovery (ATS Allowlist) — Design

## Goal

Deliver daily remote job matches using **non-AI structured sources first**, specifically an **ATS allowlist** (Greenhouse + Lever). Use the existing AI discovery pipeline only as a **fallback** when ATS coverage is insufficient to hit plan caps:

- Free: 1 job/day
- Pro: 10 jobs/day

## Non-Goals

- Building a full admin UI for managing sources (Firestore will be the source of truth; UI can come later).
- Scraping generic job boards without a stable structured endpoint.
- Removing AI scoring/enrichment; this design focuses on replacing **job discovery** with structured-first.

## Requirements

### Functional

- Fetch jobs from a curated allowlist of companies using:
  - Greenhouse job board API
  - Lever postings API
- Strict remote-only filtering:
  - Include only roles whose location is explicitly remote (e.g., `Remote`, `Remote - US`, `Remote (EMEA)`).
  - Exclude hybrid/on-site unless explicitly labeled remote.
- Dedupe by fingerprint (title + company), then exclude previously-seen fingerprints.
- Verify apply URLs via existing link verification before storing/displaying.
- Fill remaining quota using AI discovery only when ATS results are insufficient.

### Operational

- Timeouts per-company so one failing board does not fail the entire run.
- Safe parallelism (bounded concurrency).
- Same storage contract as current daily jobs:
  - `users/{uid}.dailyJobs` + `users/{uid}.lastJobFetchTime`
  - `users/{uid}/daily_matches/{date}`

## System Overview

### High-Level Flow (Per User Run)

1. Load user profile and compute plan limit.
2. Load enabled ATS sources from Firestore allowlist.
3. Fetch postings from ATS sources (Greenhouse + Lever).
4. Normalize each posting into the internal `DiscoveredJob` shape.
5. Strict remote filter.
6. ApplyUrl resolution + HTTP verification gate.
7. Dedupe against current batch + historical `seenJobFingerprints`.
8. If results < plan limit:
   - Call existing AI discovery to top up the remainder.
9. Rank + select (existing scoring pipeline) and store results.

## Firestore Model

### Collection: `job_sources`

Documents: `job_sources/{sourceId}`

```ts
type JobSourceDoc = {
  companyName: string;
  ats: 'greenhouse' | 'lever';
  boardUrl: string;
  enabled: boolean;
  remoteOnly?: boolean; // defaults true
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};
```

Notes:
- `boardUrl` is used to derive the ATS “board token”:
  - Greenhouse: `boards.greenhouse.io/{token}`
  - Lever: `jobs.lever.co/{token}`

## Source Adapters

### Greenhouse Adapter

- Endpoint: `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`
- Parsing rules:
  - Use returned JSON fields (title, location, absolute_url, updated_at/created_at, content).
  - Extract `applyUrl` from `absolute_url`.
  - Description from `content` (strip HTML to plain text).
  - Location: `location.name` (remote filter applied here).

### Lever Adapter

- Endpoint: `https://api.lever.co/v0/postings/{token}?mode=json`
- Parsing rules:
  - Use returned JSON fields (text, hostedUrl, createdAt, categories/location, description/descriptionPlain).
  - `applyUrl` from `hostedUrl`.
  - Description from `descriptionPlain` if available; else strip HTML.
  - Location from `categories.location` (remote filter applied here).

## Remote-Only Filter (Strict)

Accept a job if:
- Any location field contains `remote` (case-insensitive), including region-limited variants like `Remote - US`, `Remote (EMEA)`.

Reject a job if:
- No location data exists, or it does not include `remote`.

## Verification & Deduplication

### Fingerprint

- Use existing fingerprint approach (normalized title + company).

### Apply URL Verification

- Use existing URL validation / HTTP verification gate:
  - Only store/display jobs whose `applyUrl` is a valid HTTP(S) URL.
  - Reject redirects/4xx/5xx per existing verifier rules.

## AI Fallback Policy

- Only run AI discovery when ATS sources cannot fill the plan limit.
- AI discovery should request only the missing count (e.g., if Pro wants 10 and ATS returned 6, request 4).
- AI remains optional operationally (future toggle), but is enabled by default in this design to maintain delivery reliability.

## Seeding: 50 Company Allowlist

Provide a script that:
- Creates/updates `job_sources` documents for a seed list of ~50 remote-friendly companies split across Greenhouse + Lever.
- Supports re-running idempotently (upsert).
- Stores timestamps `createdAt/updatedAt`.

## Testing Strategy

- Unit tests:
  - Greenhouse token parsing from `boardUrl`.
  - Lever token parsing from `boardUrl`.
  - Remote-only filter behavior.
  - Adapter normalization to `DiscoveredJob`.
- Integration-ish tests (mock fetch):
  - Greenhouse API JSON response → normalized jobs.
  - Lever API JSON response → normalized jobs.

## Rollout Plan

1. Add Firestore allowlist + seed script.
2. Add adapters and structured-first orchestration.
3. Wire into job generation pipeline:
   - ATS-first discovery
   - AI top-up if short
4. Observe job volume and tune allowlist (enable/disable sources).
