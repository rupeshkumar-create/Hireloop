# Phase 7 Monetization Design

**Goal:** Enforce plan-based daily match limits in the product and introduce a clear upgrade paywall that monetizes the Daily Matches experience.

**Scope:** This phase covers backend-style plan enforcement in the job-fetch path and a frontend paywall for free users on the matches surface. It does not add webhook-based billing sync, entitlement history, or a full pricing-page redesign.

## Current Context

The repo already has most of the building blocks needed for a lightweight monetization phase:

- plan state is already stored on the user profile as `profile.plan`
- daily match fetches already use plan-aware limits in `src/hooks/useDashboardJobs.ts`
- the matches UI is centralized in `src/components/dashboard/MatchesTab.tsx`
- billing and checkout CTAs already exist in `src/pages/Settings.tsx`

The current product behavior already differentiates free and pro users at fetch time:

- free users receive `1` daily job
- pro users receive `10` daily jobs

However, that distinction is only partially productized. The backend-style enforcement exists in practice, but the matches UI does not yet present a monetization surface that makes the upgrade path obvious.

## Design Summary

Phase 7 formalizes monetization as two coordinated layers:

```text
user plan -> enforced daily match limit -> stored daily jobs -> matches UI -> paywall CTA
```

Core behavior:

1. free users are capped at `1` real daily match
2. pro users can receive up to `10` real daily matches
3. free users see additional locked teaser slots after the first visible job
4. locked teaser slots are placeholders, not hidden real jobs
5. locked teaser slots include a strong upgrade CTA that routes into the existing billing flow

This keeps enforcement strict, limits free-tier compute cost, and creates a clear product reason to upgrade.

## Architecture

### 1. Plan Limit Helper

The plan limit should be represented by a single helper rather than repeated inline checks.

Suggested behavior:

```ts
limit = user.plan === "pro" ? 10 : 1
```

Recommended ownership:

- place a small pure helper near the dashboard jobs flow or in a tiny shared utility
- normalize plan strings to avoid casing drift such as `Pro` vs `pro`
- default unknown or missing plan values to the free tier

Suggested helper shape:

```ts
function getDailyMatchLimit(plan?: string): number
```

Rules:

- `pro` -> `10`
- everything else -> `1`

This helper becomes the single source of truth for plan enforcement decisions in the matches product surface.

### 2. Enforcement Path

Phase 7 keeps enforcement in the existing fetch pipeline rather than adding a separate billing service.

Primary enforcement points:

- cache hydration in `src/hooks/useDashboardJobs.ts`
- fetch-time limit passed into `generateDailyJobs()`
- cached-job sufficiency checks used to decide whether to reuse or refresh `dailyJobs`

Required behavior:

- free users only fetch and store `1` real job in `dailyJobs`
- pro users fetch and store up to `10` real jobs in `dailyJobs`
- cached-job checks must compare against the same shared plan helper

Important constraint:

- the system must not fetch extra hidden jobs for free users just to populate the paywall

That means the paywall surface is a presentation layer built from placeholders, not from real paid inventory that is merely blurred.

### 3. Paywall Rendering Model

The matches UI should distinguish between:

- real jobs returned by the engine
- locked placeholder slots rendered only for free users

Recommended rendering model:

1. render the fetched real jobs as normal
2. if the user is free, append placeholder cards until the surface visually reaches `10` slots
3. style placeholder cards with blur, reduced contrast, and a locked-state overlay

Placeholder card content should be deterministic and clearly non-real. For example:

- role label such as `Premium Match`
- blurred company and metadata text
- hidden match score badge
- short locked-copy such as `Unlock 9 more AI-picked jobs daily`

This avoids misleading the user into thinking hidden cards represent actual fetched opportunities.

### 4. Upgrade CTA

The CTA should be visible both within the paywall cards and as a stronger upgrade prompt near the locked section.

Recommended CTA behavior:

- primary text: `Upgrade to Pro`
- supporting copy: emphasize `10 daily AI matches`
- click target: route users into the existing billing/checkout experience in `src/pages/Settings.tsx`

Two valid CTA routes:

1. navigate to `Settings` billing
2. directly open the existing checkout URL if the current UX already supports that path cleanly

Recommended default:

- send users to `Settings` billing unless there is already a stable direct-upgrade CTA pattern elsewhere in the dashboard

This keeps billing logic centralized and avoids duplicating checkout URLs across multiple UI surfaces unless necessary.

### 5. Free vs Pro UX

#### Free user

- sees one real job
- sees nine locked placeholder slots
- sees at least one prominent upgrade CTA
- can still interact with the single real job exactly as today

#### Pro user

- sees up to ten real jobs
- sees no locked placeholders
- sees no monetization overlay inside the matches list

### 6. Upgrade Transition

The repo already contains upgrade-adjacent refresh behavior in `src/hooks/useDashboardJobs.ts`.

Phase 7 should preserve and formalize this behavior:

- if a user upgrades from free to pro and only has one cached job, the app should refresh to try to fill toward the pro limit
- this logic must use the shared plan helper so refresh behavior and fetch behavior stay aligned

This gives the user immediate product feedback after upgrading.

## Component Responsibilities

### `src/hooks/useDashboardJobs.ts`

- own the plan-limit helper or consume it from a small shared utility
- use the helper for cache sufficiency checks
- use the helper for `generateDailyJobs()` limits
- preserve the refresh-on-upgrade behavior

### `src/components/dashboard/MatchesTab.tsx`

- render real job cards as it does today
- render free-tier locked placeholders after real jobs
- display upgrade CTA content for free users

### `src/pages/Dashboard.tsx`

- pass plan-awareness into `MatchesTab` if needed
- keep the current tab-switch and fetch flow intact

### `src/pages/Settings.tsx`

- remain the primary billing destination
- continue to own plan messaging and checkout URLs

## Data Contracts

Phase 7 does not require a new database collection or billing schema.

It relies on the existing profile field:

```ts
profile.plan?: string
```

Optional presentation-only helper shape:

```ts
interface LockedMatchSlot {
  kind: 'locked';
  index: number;
}
```

This does not need to be persisted. It only exists to support clean rendering in the matches UI.

## Error Handling

### Unknown plan values

- treat as free
- never assume premium entitlement on malformed data

### Partial pro inventory

- if live search returns fewer than `10` valid jobs for a pro user, continue the current behavior:
  - show the best available real jobs
  - keep the existing informational toast behavior

Phase 7 should not fabricate jobs for pro users.

### Empty free results

- if no real free job is available, keep the current empty-state behavior
- do not show a fake unlocked first result
- locked placeholders may still appear only if that does not create confusion about actual availability

Recommended default:

- if there are zero fetched jobs, prefer the current honest empty state over a misleading paywall-first screen

### CTA failures

- if a direct navigation path is used, fallback should remain the billing page route
- do not block the dashboard if upgrade routing fails

## Testing Strategy

### Unit tests

Add a focused unit test for the plan-limit helper:

- `pro` returns `10`
- `Pro` normalizes to `10`
- missing or unknown plan returns `1`

### Component tests

Add or update focused rendering tests for `MatchesTab`:

- free user with one job renders one real card plus locked placeholders
- pro user renders only real jobs
- upgrade CTA appears only for free users

### Regression checks

Verify:

- cache hydration still works for both free and pro users
- free users do not fetch hidden paid jobs
- upgrade refresh still triggers when a former free user now expects the pro limit

## Out Of Scope

Phase 7 does not include:

- Stripe or Dodo webhook reconciliation
- server-side entitlement verification
- usage counters beyond daily match count
- gated cold-email or interview-prep paywalls
- admin billing analytics
- pricing experiments or A/B testing

These can be layered on later after the basic monetization funnel is live.

## Recommended Rollout

Recommended implementation order:

1. extract the plan-limit helper
2. wire all dashboard match limit checks to the helper
3. add free-tier locked placeholder rendering
4. add the upgrade CTA and billing routing
5. add focused tests for the helper and matches rendering

This order keeps the risk low and makes backend-style enforcement land before UI upsell polish.

## Success Criteria

Phase 7 is successful when:

- free users can access only `1` real daily match
- pro users can access up to `10` real daily matches
- the Daily Matches screen clearly communicates locked premium value
- the upgrade CTA is visible and actionable from the paywall surface
- free-tier users do not incur hidden extra job-generation cost
- the monetization behavior is testable and easy to extend in later billing phases
