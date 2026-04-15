---
title: Pro Live Search Fill (10 jobs) Design
date: 2026-04-15
status: draft
---

## Problem

Pro users can see: “Live search did not return enough valid remote matches right now. Please try again later.”

This occurs when the live-search pipeline returns 0 valid jobs after filtering and link validation, despite Pro expecting up to 10 relevant results.

Current constraints causing empty results:
- Query generation is ATS-only and explicitly avoids LinkedIn/Indeed, which reduces inventory.
- Link validation blocks major job boards and depends on `HEAD/GET` fetches that are frequently blocked, making many otherwise valid job links fail validation.
- The job pipeline does not have a Pro-specific “fill” stage that relaxes constraints while preserving relevance and reasonable apply links.

## Goals

- Pro fetch targets up to 10 jobs per request, sourced from live search.
- Prefer direct apply links (ATS/company careers) when available.
- Allow job-board posting URLs (LinkedIn/Indeed and a short list of other major boards) as fallback to fill Pro to 10 when ATS/career inventory is light.
- Keep Free behavior conservative and high-quality (1 job/day, stricter rules).
- Preserve relevance: jobs must still be remote and pass ranking.
- Reduce false “0 results” scenarios; only show the hard error when truly no usable jobs exist.

## Non-goals

- Building scrapers or bypassing bot protections for job boards.
- Guaranteeing that every returned link is a login-free application flow.
- Adding paid/official job-board API integrations.

## Proposed Approach (A): Multi-stage retrieval with “prefer external apply, allow boards” rules

### Overview

Make retrieval staged and Pro-aware:
1. ATS-only stage (existing).
2. Trusted company career pages stage (existing).
3. Pro-only job boards stage (new) to fill remaining slots.

Across all stages, choose the best apply link from Serper job payload by prioritizing ATS/company apply links; use job board links only when necessary.

### Sources & Link Policy

**Preferred (highest quality):**
- ATS domains (Greenhouse, Lever, Ashby, Workable, Workday)
- Company careers pages that “look like” a careers/job posting URL (existing heuristic)

**Allowed for Pro fill (fallback):**
- LinkedIn, Indeed
- Optionally: Glassdoor, ZipRecruiter (if needed for fill; must be explicitly configured)

**Always blocked:**
- Google search results URLs (e.g., `google.com/search`)

### Validation Changes

Introduce a split validation strategy:
- **Network-validated links:** ATS + company career pages continue to use the existing `/api/validate-job-link` fetch+redirect logic.
- **Allowlisted board links (Pro only):** Skip network fetch validation for allowlisted job-board domains and validate by URL/domain heuristics. This avoids false invalidation due to bot blocks.

This requires:
- Extending `validateJobLink()` and `/api/validate-job-link` to support an option like `skipNetworkFetchForDomains` (or equivalent), used only in the Pro board stage.
- Ensuring the returned URL still meets minimal safety checks (http/https, not a google search URL).

### Freshness

- Free: keep 7-day freshness.
- Pro: expand to 14-day freshness to improve fill while staying reasonably fresh.

## Detailed Design

### 1) Query Generation Rules

Adjust the prompt for Pro so it can find inventory beyond ATS-only:
- Keep remote + title + skills requirements.
- For ATS/careers stages, continue ATS-only constraints.
- For Pro board stage, generate additional queries that include job-board sites in a controlled way.

Deterministic (non-LLM) expansion remains as fallback if the LLM query generation fails.

### 2) Retrieval Stages

**Stage 1: ATS-only (existing)**
- `allowedDomains = ATS_DOMAINS`
- `allowCompanyCareerPages = false`
- Freshness: 7 days (Free and Pro)

**Stage 2: Trusted company career pages (existing)**
- `allowedDomains = ATS_DOMAINS`
- `allowCompanyCareerPages = true`
- Freshness: 7 days (Free), 14 days (Pro)

**Stage 3: Pro job boards (new)**
- Triggered only when `plan == pro` and `realJobs.length < limit`.
- Search with a controlled set of job-board queries.
- Link acceptance:
  - Prefer ATS/careers link from `apply_options` if present.
  - Otherwise allow job-board posting links for the allowlisted board domains.
- Validation:
  - For board domains: skip network fetch and accept by heuristic.
  - For non-board domains: validate normally (network fetch).
- Freshness: 14 days.

### 3) Apply Link Selection

Improve link selection from Serper payload:
- Evaluate candidate URLs in priority order:
  1. Apply options links (scan all options, not just index 0)
  2. `apply_link`
  3. `link`
- Score URLs by:
  - ATS domain match (highest)
  - Company career-page heuristic (next)
  - Allowlisted job-board domain (fallback for Pro)
- Pick the best valid URL per job.

### 4) Deduplication and “Seen” Handling

Maintain existing:
- In-batch dedup by title+company fingerprint.
- Seen/unseen partitioning and scoring.

Pro may still backfill from “seen” jobs when inventory is light (existing), but the new stages aim to produce more unseen inventory first.

### 5) UI/UX Behavior

Current toast behavior:
- 0 jobs => error toast.
- < limit jobs => info toast.

Update behavior:
- Only show error toast when *no jobs at all* could be returned after all stages.
- If results are non-zero but < 10 for Pro, show info toast (existing message is fine).

## Security & Abuse Considerations

- Do not log or store user secrets.
- Keep a tight allowlist for skip-network-validation domains; do not accept arbitrary domains without network validation.
- Enforce http/https only.
- Keep blocking Google search result URLs.

## Observability

Keep existing aggregated retrieval stats and add stage attribution:
- Count jobs accepted per stage.
- Count removed by: remote filter, freshness filter, missing link, link validation, shape validation.
- Count accepted by: ATS, careers, board.

## Testing Plan

- Unit tests for:
  - URL classification: ATS vs careers vs board vs blocked.
  - Apply link selection picks ATS over board when both exist.
  - Freshness window differences for Free vs Pro.
- Integration tests (mock Serper response payload):
  - Pro returns up to 10 with stage 3 enabled.
  - Free remains constrained and returns 1.
  - When network validation fails for LinkedIn/Indeed, Pro still accepts allowlisted board links without network validation.

## Rollout Plan

- Ship behind plan gating (Pro only) for job-board stage and skip-network-validation.
- Monitor stats (0 results rate, <10 rate) and error toast rate.

