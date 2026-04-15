# Phase 6 Self-Learning Loop Design

**Goal:** Add a deterministic self-learning loop that captures user intent from real job actions and feeds those signals back into Scout so query generation improves over time.

**Scope:** This phase adds structured learning signals, event-driven updates, and Scout query injection. It does not redesign Harvester, validation, ranking, or UI analytics dashboards.

## Current Context

The repo already has the right extension points:

- Scout query generation lives in `src/services/aiService.ts`
- the Scout -> Harvester -> De-Duper pipeline is already formalized in Phase 3
- job actions already exist in `src/hooks/useDashboardJobs.ts` and `src/pages/JobTracker.tsx`
- the user profile already stores lightweight AI learning context in `learningProfile.jobPreferences`

However, the current job-preference learning is an opaque AI-generated string. That is useful as passive context, but not reliable enough for deterministic query rewriting.

Phase 6 introduces a structured memory layer for job preference learning.

## Design Summary

Phase 6 adds a deterministic loop:

```text
user action -> keyword extraction -> signal scoring -> stored learning signals -> Scout query rewrite
```

Tracked signals:

1. `dismissed`
2. `saved`
3. `applied`
4. `clicked`

Core behavior:

- dismissed jobs add negative keyword signal
- saved jobs add positive keyword signal
- applied jobs add stronger positive signal than saved
- clicked jobs add weak exploratory positive signal
- Scout removes or suppresses negatively scored terms where safe
- Scout boosts positively scored terms where safe

This creates a lightweight moat: the job engine becomes more personalized as the user interacts with it, without requiring a fully opaque AI feedback system.

## Architecture

### 1. Learning Signal Store

Add a new structured object on the user profile:

```ts
interface LearningSignals {
  likedKeywords: string[];
  dislikedKeywords: string[];
  keywordScores: Record<string, number>;
  events?: {
    saved: number;
    dismissed: number;
    applied: number;
    clicked: number;
  };
  updatedAt?: string;
}
```

Recommended ownership:

- source of truth: `keywordScores`
- derived views: `likedKeywords`, `dislikedKeywords`
- observability counters: `events`

Why both scores and arrays:

- `keywordScores` supports accumulation over time
- `likedKeywords` and `dislikedKeywords` make Scout integration simple
- derived arrays are easier to inspect and test than raw weighted maps alone

### 2. Event Writers

Learning updates should be triggered by real user actions:

- `saveJob()` in `src/hooks/useDashboardJobs.ts`
- status transitions to `applied` in `src/pages/JobTracker.tsx`
- explicit dismiss action for dashboard job cards
- outbound job click tracking where the product already opens application links

Phase 6 does not require a new backend service. Firestore profile updates are sufficient.

Important rule:

- learning writes must be best-effort and must never block the primary user action

If a save or apply succeeds but the learning write fails, the user action still succeeds.

### 3. Deterministic Keyword Extraction

Each tracked job action should first be converted into a compact keyword set.

Inputs:

- job title
- description
- requirements
- optionally normalized tags already available on the job record

Extraction rules:

- lowercase
- trim whitespace
- de-duplicate
- drop generic stopwords
- ignore weak platform-wide words such as:
  - `remote`
  - `engineer`
  - `developer`
  - `senior`
  - `company`
  - `team`
- prefer concrete skill, domain, and specialization terms

Examples of good learning terms:

- `react`
- `typescript`
- `graphql`
- `fintech`
- `data platform`
- `frontend performance`

Examples of bad learning terms:

- `job`
- `role`
- `great company`
- `remote`

This phase should keep keyword extraction deterministic. No LLM should sit inside the feedback loop.

### 4. Signal Scoring

Each action updates keyword scores with fixed deterministic weights.

Recommended initial weights:

- `dismissed`: `-2`
- `saved`: `+2`
- `applied`: `+4`
- `clicked`: `+1`

Then derive:

- `likedKeywords`: keywords with score `>= 3`
- `dislikedKeywords`: keywords with score `<= -3`

Recommended caps:

- keep only the strongest 10 liked keywords
- keep only the strongest 10 disliked keywords

This prevents Scout prompts from bloating and reduces noisy overfitting.

### 5. Scout Injection

Scout should consume learning signals through a structured extension of the existing `ScoutContext`.

Suggested shape:

```ts
interface ScoutLearningContext {
  likedKeywords: string[];
  dislikedKeywords: string[];
}
```

Then extend `ScoutContext`:

```ts
interface ScoutContext {
  careerPaths: string[];
  resumeText: string;
  resumeSummary?: string;
  jobType?: string;
  structuredProfile?: {
    skills: string[];
    techStack: string[];
    seniority: string;
    roles: string[];
    industries: string[];
  };
  preferences?: {
    remoteOnly: boolean;
    salaryFloor: number | null;
    locations: string[];
  };
  learningContext?: string;
  learningSignals?: ScoutLearningContext;
  location?: string;
}
```

Scout rewrite rule:

```text
queries = base queries - safely removable disliked terms + precision-safe liked boosts
```

Interpretation:

- base role anchors from `careerPaths` remain intact
- disliked terms should only remove optional skill/domain modifiers
- liked terms may be appended or substituted if they keep the query narrow
- Scout must never rewrite queries into broad generic searches

### 6. Query Safety Rules

Learning must not be allowed to degrade Scout quality.

Rules:

- never remove the primary job title anchor
- never remove ATS-domain constraints
- never remove required remote/location modifiers
- never produce an empty or overly broad query
- if rewrite quality is uncertain, use the original query

Recommended pattern:

1. build normal Scout queries
2. normalize token candidates
3. remove disfavored optional modifiers where safe
4. inject 0-2 strongly liked modifiers where safe
5. run existing query normalization and validation

## Data Contracts

### User Profile Extension

Add to the profile shape in `src/contexts/AuthContext.tsx`:

```ts
interface UserProfile {
  learningSignals?: LearningSignals;
}
```

This should coexist with the existing:

```ts
learningProfile?: {
  jobPreferences?: string;
  writingStyle?: string;
}
```

Phase 6 does not need to delete the old freeform preference string immediately. It can remain as passive context for AI ranking while structured signals drive Scout injection.

### Learning Update API

Suggested helper:

```ts
type LearningEventType = 'saved' | 'dismissed' | 'applied' | 'clicked';

interface LearningEventJob {
  title: string;
  company: string;
  description?: string;
  requirements?: string[];
}
```

Suggested service-level helper:

```ts
function applyLearningEvent(
  currentSignals: LearningSignals | undefined,
  eventType: LearningEventType,
  job: LearningEventJob
): LearningSignals
```

This helper should:

- extract keywords
- update scores
- derive liked/disliked arrays
- increment event counters
- stamp `updatedAt`

It should be pure and deterministic so it is easy to unit test.

## Integration With Existing Job Engine

Phase 6 should preserve the public behavior of `generateDailyJobs()`.

Recommended integration steps:

1. read `profile.learningSignals`
2. map it into `ScoutContext.learningSignals`
3. generate normal Scout queries
4. rewrite queries using structured learning signals
5. pass rewritten queries through existing validation and normalization
6. continue existing Harvester, De-Duper, validation, and scoring flow unchanged

This keeps the learning loop tightly scoped to Scout.

## UI and Product Triggers

### Save

Current behavior already stores a saved job in `trackedJobs`.

Phase 6 addition:

- extract keywords from the saved job
- apply a positive score update

### Apply

Current behavior already supports tracked-job status updates.

Phase 6 addition:

- when status transitions into `applied`, apply a stronger positive score update

Important:

- only apply this boost on transition into `applied`
- repeated writes of the same `applied` status must not double count

### Click

If the app already has a point where the user opens the job URL, that action should add a weak positive signal.

If click tracking is not currently centralized, this can be added in a lightweight way later, but the design should reserve the event type now.

### Dismiss

Phase 6 should introduce a dismiss action on surfaced jobs that are not saved.

Behavior:

- hide the job from the current surface if desired
- extract keywords from that job
- subtract signal weights

This is the primary source of negative preference learning.

## Error Handling

### Missing Signals

- if `learningSignals` does not exist, Scout behaves exactly as it does today

### Empty Extraction

- if keyword extraction returns no strong keywords, increment the event counter and keep scores unchanged

### Corrupt Signal Data

- sanitize invalid arrays and maps before use
- default to empty structures

### Over-Pruned Queries

- if learning removes too many modifiers, fall back to the original query

### Write Failures

- never block the main save, apply, click, or dismiss action
- log the error and continue

## Testing Strategy

### Unit Tests

Add focused tests for:

- keyword normalization
- stopword removal
- action scoring
- threshold derivation of liked/disliked keywords
- capping liked/disliked lists
- Scout query rewrite safety

Recommended file:

- `src/services/__tests__/phase3ScoutHarvester.test.ts` for Scout-related behavior

Optionally, if the learning helper becomes large enough, create:

- `src/services/__tests__/learningSignals.test.ts`

### Required Regressions

Add tests that prove:

- `dismissed` adds negative score and can produce `dislikedKeywords`
- `saved` adds positive score and can produce `likedKeywords`
- `applied` boosts more strongly than `saved`
- empty learning state preserves current Scout behavior
- noisy learning state does not break query validation

## Out of Scope

Phase 6 does not include:

- personalized ranking changes after Harvester
- time decay or recency weighting
- cross-user collaborative filtering
- admin analytics dashboards for learning signals
- LLM-based interpretation inside the event loop

These can be added later if Phase 6 proves useful.

## Rollout Notes

Recommended order:

1. add structured `learningSignals` types
2. implement pure signal update helpers
3. wire save and apply events first
4. wire Scout injection
5. add dismiss and click tracking
6. add tests around the deterministic core

This sequence keeps risk low and allows value to ship before the full event surface is complete.

## Success Criteria

Phase 6 is successful when:

- user interactions create stable structured preference signals
- Scout consumes those signals without breaking query precision
- dismissed jobs reduce recurrence of similar skill/domain terms
- saved and applied jobs increase recurrence of similar high-fit terms
- the job engine remains deterministic and testable at the feedback layer
