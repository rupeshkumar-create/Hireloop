# Phase 3 Scout Harvester Design

**Goal:** Formalize query generation, job harvesting, and job deduplication into explicit Phase 3 engine stages so the system has a clear Scout, Harvester, and De-Duper flow before scoring and enrichment.

**Scope:** This phase focuses only on Scout, Harvester, and De-Duper. It does not redesign scoring, confidence logic, thresholding, or cron flow. It builds on the existing job engine and Phase 1 guardrails.

## Current Context

The repo already has working building blocks:

- query generation helpers in `src/services/aiService.ts`
- Serper harvesting in `src/services/serperService.ts`
- title+company deduplication through `jobFingerprint()`
- Phase 1 guardrails in `src/services/systemEngine.ts`

However, these pieces are still embedded inside `generateDailyJobs()` and are not yet formalized as explicit engine stages with their own validation contracts.

That makes Scout and Harvester harder to reason about, test, and extend.

## Design Summary

Phase 3 introduces three explicit stages:

1. `Scout`
2. `Harvester`
3. `De-Duper`

The flow becomes:

```text
user context -> Scout -> 10 validated queries -> Harvester -> ~40 raw jobs -> De-Duper -> unique jobs
```

Scout is AI-assisted and guarded.
Harvester and De-Duper are deterministic.

## Architecture

### 1. Scout

Scout is responsible for building the search queries.

Target API:

```ts
runWithGuardrails('query_generation', buildQueries, userContext)
```

Expected output:

```ts
[
  "frontend developer remote react",
  "react engineer remote startup"
]
```

Phase 3 rules:

- return exactly 10 queries
- every query must be a non-empty string
- no duplicate queries
- queries must be grounded in:
  - `careerPaths`
  - `structuredProfile`
  - `preferences`
  - `resumeSummary` or cleaned resume text
- queries must avoid broad filler like "software job remote"

Fallback behavior:

- if AI query generation fails validation, use deterministic query generation
- deterministic fallback remains acceptable in Phase 3 because Scout must never block harvesting entirely

### 2. Harvester

Harvester is responsible for fetching jobs from Serper.

Phase 3 target:

- fetch about 40 raw jobs total from the Scout queries

Harvester stays deterministic and should keep using `searchRemoteJobs()` as the core implementation.

Phase 3 rules:

- use Scout output only after query validation passes
- search across the 10 validated queries
- respect existing remote, freshness, link, and shape filtering
- keep search stats for observability
- prefer returning enough raw candidates for later stages without exploding query volume

The Harvester does not score jobs.
It only retrieves and filters source candidates.

### 3. De-Duper

De-Duper is responsible for collapsing duplicate jobs before later stages.

Canonical dedupe key:

```ts
hash = title + company
```

The repo already uses:

```ts
jobFingerprint(title, company)
```

Phase 3 keeps that as the canonical dedupe primitive.

Rules:

- lowercase and trim both title and company
- dedupe before scoring
- dedupe after harvesting batches are merged
- same title + same company = one job
- same title + different company = separate jobs

## Data Contracts

### Scout Input

Scout should read a compact user context object, not the entire app state.

Suggested shape:

```ts
interface ScoutContext {
  careerPaths: string[];
  resumeText: string;
  resumeSummary?: string;
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
}
```

### Scout Output

```ts
string[]
```

with an exact count of 10 after validation/fallback.

### Harvester Output

Harvester should continue returning:

```ts
interface SearchRemoteJobsResult {
  jobs: SerperJob[];
  stats: SearchRemoteJobsStats;
}
```

### De-Duper Output

```ts
SerperJob[]
```

with duplicates removed by `jobFingerprint()`.

## Validation Ownership

### `validator.ts`

Phase 3 should add deterministic validation for Scout output.

Suggested helper:

```ts
validateQueryGenerationOutput(output: unknown, input: { expectedCount: number }): ValidationResult
```

Rules:

- output must be an array
- output length must equal 10
- each item must be a non-empty string
- normalized query values must be unique

This validator belongs in `validator.ts`, not in ad hoc checks inside the Scout implementation.

### `systemEngine.ts`

Phase 3 should register a new guarded task:

- `query_generation`

That task uses:

- AI query generation as the primary path
- deterministic fallback query generation when validation fails or the model call errors

## Integration With Existing Job Engine

Phase 3 should not replace `generateDailyJobs()` wholesale.
It should refactor it into explicit stages while keeping its public behavior intact.

Recommended shape:

1. create Scout context
2. run guarded Scout
3. run Harvester using validated queries
4. merge and dedupe harvested jobs
5. pass unique jobs into existing Phase 1 validation and later scoring

This preserves working behavior while making the pipeline legible.

## Search Volume Strategy

The user requested 10 Scout queries and about 40 harvested jobs.

Recommended interpretation:

- Scout always returns 10 queries
- Harvester uses capped Serper fetches and query slicing to target about 40 raw jobs total
- exact count can vary by live market results, but the design should aim for that order of magnitude

This keeps Scout broad enough while preventing runaway noise.

## Error Handling

### Scout Failure

- if AI output is invalid, use deterministic fallback
- if fallback still produces invalid output, throw a guardrail error

### Harvester Failure

- query-level fetch failures should not crash the entire stage
- partial results are acceptable
- stage-level errors should be logged

### De-Duper Failure

- dedupe logic is deterministic and should not fail under normal input
- if malformed jobs appear, they should be filtered earlier by Harvester or validation

## Testing Strategy

### Unit tests

Add tests for:

- Scout output validation
- exactly 10 queries rule
- duplicate query rejection
- dedupe with same title+company
- dedupe allowing same title across different companies

### Focused integration tests

Add a focused engine-flow test for:

- Scout output -> Harvester result -> De-Duper result shape

The goal is not to mock the entire market.
The goal is to verify the phase boundaries and contracts.

## Recommended File Responsibilities

### `src/services/aiService.ts`

- own `buildQueries()`
- register `query_generation`
- orchestrate Scout -> Harvester -> De-Duper inside `generateDailyJobs()`

### `src/services/validator.ts`

- own `validateQueryGenerationOutput()`

### `src/services/serperService.ts`

- remain the Harvester core
- keep `searchRemoteJobs()` and `jobFingerprint()`

## Out Of Scope

- scoring redesign
- confidence scoring
- threshold filtering redesign
- plan-limit logic redesign
- cron orchestration changes

## Recommended Outcome

After Phase 3:

- Scout is an explicit guarded task
- Harvester is an explicit deterministic fetch stage
- De-Duper is a named stage with a stable hash rule
- `generateDailyJobs()` becomes easier to understand, test, and extend
- later phases can plug into clear stage boundaries instead of one large job-generation function
