# Pro Job Fill Design

## Goal

Fix the daily job-matching flow so Pro users reliably receive up to 10 real jobs per day instead of frequently seeing:

- `Could not find any matching jobs right now. Please try adjusting your preferences.`

The fix must preserve trust by returning only real jobs and by avoiding fabricated listings.

## Root Cause

The current Pro limit is already configured as `10` in `src/hooks/useDashboardJobs.ts`, so the limit itself is not the bug.

The failure happens earlier in the retrieval pipeline:

1. Query generation is intentionally narrow and ATS-only
2. Retrieval is limited to a small number of query batches
3. Every candidate is filtered through remote-only checks
4. Every apply link is validated against a strict ATS/domain allowlist
5. Already-seen jobs are removed before scoring

This combination causes an under-filled candidate pool. When no jobs survive, the UI shows a generic zero-results error even for Pro accounts that requested 10 jobs.

## Scope

This design applies to:

- `src/services/aiService.ts`
- `src/services/serperService.ts`
- `src/hooks/useDashboardJobs.ts`

In scope:

- Improve fill rate for Pro daily jobs
- Keep ATS-first retrieval but add progressive fallback stages
- Preserve real-job-only behavior
- Add structured logging for every filtering stage
- Improve the empty-results and under-fill user messaging

Out of scope:

- Payment or plan-management changes
- New third-party enrichment vendors
- Changes to AI writing features in Job Tracker
- Fabricated or AI-generated job inventory

## Proposed Behavior

### Daily Limits

- Free users continue to receive `1` daily job
- Pro users continue to receive `10` daily jobs

No change is needed to the configured Pro limit. The change is to retrieval behavior so the pipeline can fill that target more often.

### Retrieval Strategy

Use a staged search strategy that widens only when the stricter tier under-fills.

#### Stage 1: Strict ATS Precision

Keep the current high-trust search first:

- ATS-focused queries
- Remote-only filtering
- Freshness filtering
- Link validation
- Deduplication

If this stage produces enough unseen jobs, return them immediately.

#### Stage 2: Broader Real Query Expansion

If Stage 1 returns fewer than the requested limit:

- Generate more deterministic title and skill combinations
- Search more than the current small expansion set when needed
- Continue requiring remote jobs
- Continue requiring valid direct apply links

This stage still prioritizes trusted ATS domains but explores more query breadth before giving up.

#### Stage 3: Trusted Company Career Pages

If the result set is still below the limit:

- Allow final links that resolve to trusted company career pages
- Keep blocking generic boards and noisy aggregators
- Keep remote-only and freshness filters

This stage expands beyond the current ATS-only allowlist while still preserving real apply destinations.

#### Stage 4: Seen-Job Backfill For Pro

If Pro users still have fewer than 10 unseen jobs after live search:

- Fill remaining slots with the best previously seen real jobs from the latest validated pool
- Prefer recently posted jobs first
- Mark them only through ranking, not through separate UI badges in this change

This avoids showing zero results to Pro users on low-volume days while still returning real jobs.

Free users do not need this backfill stage because their target is only 1.

## Filtering Changes

### Link Validation

The current final-link validation is likely too strict for some legitimate job destinations.

Update validation logic to support:

- Existing ATS domains
- Trusted company-hosted careers subdomains
- Final resolved URLs that are clearly job application destinations

Continue rejecting:

- Google redirect/search pages
- Generic aggregator pages
- Non-HTTP destinations

### Seen-Job Handling

Separate jobs into two pools after validation:

- `unseenJobs`
- `seenJobs`

Use `unseenJobs` first for all users.
Use `seenJobs` only as a final Pro backfill step when live unseen inventory cannot fill 10 slots.

## Ranking

Keep the current ranking flow and continue to sort by `finalScore`.

For Pro backfill:

- Rank unseen validated jobs first
- Rank seen validated jobs second
- Only consume seen jobs if unseen jobs are insufficient

This preserves freshness and novelty while still meeting the Pro expectation more often.

## User Messaging

Replace the current generic failure behavior with clearer outcomes:

- If jobs are found: success toast with the count
- If some jobs are found but fewer than requested: informative toast that live search under-filled and the best available matches were returned
- If no unseen jobs are found but seen-job backfill is used for Pro: explain that matching jobs were limited today and repeat high-quality jobs were included
- If absolutely no validated jobs exist: show a clearer error mentioning that live search did not return enough valid remote matches

The goal is to explain what happened instead of implying user preferences are always the problem.

## Logging

Add explicit logs for:

- primary query count
- expansion query count
- jobs retrieved before validation
- jobs removed by remote filter
- jobs removed by freshness filter
- jobs removed by link validation
- validated unseen job count
- validated seen job count
- final returned count
- whether Pro backfill was used

This should make future debugging obvious without changing the public API.

## Error Handling

- If a query batch fails, continue with the remaining batches
- If validation fails for one job, skip only that job
- If scoring fails, keep the existing conservative fallback ranking
- If live retrieval is thin, return the best real jobs available instead of defaulting to the generic empty-state explanation

At no point should the system fabricate jobs.

## Verification

Verify the implementation with:

- TypeScript diagnostics on edited files
- Local production build
- Manual checks of the staged fallback logic in code

Automated tests are optional here because the core behavior is integration-heavy, but the helpers should stay structured enough for future test coverage.
