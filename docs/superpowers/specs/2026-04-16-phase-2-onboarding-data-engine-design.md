# Phase 2 Onboarding Data Engine Design

**Goal:** Replace raw-text-only onboarding with a structured resume data pipeline that stores durable extraction artifacts, adds deterministic hard filters, and prepares the system for better validation and matching without requiring UI redesign.

**Scope:** This phase focuses on onboarding data flow, profile schema, deterministic filter storage, and validator ownership of hard filters. It does not redesign onboarding UI. Existing screens should keep working through compatibility fields while the new data engine is introduced.

## Current Context

The current onboarding flow is minimal:

- `src/pages/Onboarding.tsx` only handles resume upload and redirect
- `src/hooks/useResumeParser.ts` parses a file into plain text and stores `resumeText`
- AI then derives career paths, preferences, and analysis from the raw text
- profile storage in `src/contexts/AuthContext.tsx` still centers on top-level fields like `resumeText`, `jobType`, `minSalary`, and `location`

This is not enough for a durable data engine because:

- the system stores raw text but not durable structured resume outputs
- deterministic filters are mixed with inferred AI preferences
- downstream services do not have a stable structured profile to use

## Design Summary

Phase 2 introduces a structured onboarding pipeline that stores:

- `resumeRaw`
- `resumeCleaned`
- `resumeSummary`
- `structuredProfile`

It also introduces a nested `preferences` object for deterministic filters:

- `remoteOnly`
- `salaryFloor`
- `locations`

To preserve compatibility, Phase 2 keeps current top-level fields in sync:

- `jobType`
- `minSalary`
- `location`

Hard filters remain deterministic and belong in `validator.ts`, not AI prompts.

## Architecture

### 1. Resume Data Pipeline

The upload flow becomes a staged data pipeline:

1. parse uploaded file into text
2. store raw parsed text as `resumeRaw`
3. normalize text into `resumeCleaned`
4. extract structured fields into `structuredProfile`
5. generate a concise `resumeSummary`
6. save deterministic `preferences`
7. sync legacy fields for existing screens

Each stage has a different responsibility:

- `resumeRaw`: exact parser output for traceability and debugging
- `resumeCleaned`: normalized text safe for downstream extraction and prompts
- `resumeSummary`: short reusable context for later AI tasks
- `structuredProfile`: durable typed extraction used by job generation and validation

### 2. `structuredProfile`

`structuredProfile` becomes the primary structured representation of the candidate.

Phase 2 fields:

```ts
interface StructuredProfile {
  skills: string[];
  techStack: string[];
  seniority: string;
  roles: string[];
  industries: string[];
}
```

Rules:

- fields must be extracted from the actual resume only
- no fabricated skills, industries, or seniority
- arrays should be deduplicated and normalized
- empty arrays are allowed when data is missing

### 3. `preferences`

Phase 2 introduces a deterministic filter object:

```ts
interface UserPreferences {
  remoteOnly: boolean;
  salaryFloor: number | null;
  locations: string[];
}
```

This object is the new source of truth for hard filters.

Compatibility fields are still written:

- `jobType`
- `minSalary`
- `location`

Sync rules:

- `jobType` mirrors `preferences.remoteOnly`
- `minSalary` mirrors `preferences.salaryFloor`
- `location` mirrors the first item in `preferences.locations`

This lets current settings, admin, and dashboard screens keep working during the migration.

## File Responsibilities

### `src/hooks/useResumeParser.ts`

Responsibilities:

- parse the uploaded file
- run the staged onboarding pipeline
- call extraction helpers and AI extraction functions
- save the final profile payload through `updateProfile()`

This file should stop thinking in terms of only `resumeText`.

### `src/services/aiService.ts`

Responsibilities:

- add `extractResume()` for structured extraction
- optionally add `summarizeResume()` if summary generation is kept separate
- keep AI tasks focused on extraction and summarization, not hard-filter enforcement

### `src/services/validator.ts`

Responsibilities:

- own deterministic hard filter logic
- normalize and validate `remoteOnly`, `salaryFloor`, and `locations`
- expose reusable helpers for pre-AI and job-level filtering

Examples:

- `normalizeUserPreferences()`
- `validateUserPreferences()`
- `jobMatchesUserPreferences()`

These remain deterministic and must not depend on AI output.

### `src/contexts/AuthContext.tsx`

Responsibilities:

- extend `UserProfile` with the new stored fields
- preserve existing compatibility fields
- continue saving partial updates safely through `updateProfile()`

## Data Model Changes

Add these fields to `UserProfile`:

```ts
resumeRaw?: string;
resumeCleaned?: string;
resumeSummary?: string;
structuredProfile?: StructuredProfile;
preferences?: UserPreferences;
```

Keep these fields for backward compatibility:

```ts
resumeText?: string;
jobType?: string;
minSalary?: number | null;
location?: string;
```

Phase 2 write behavior:

- `resumeText` should continue to store the cleaned version for existing consumers
- new consumers should prefer `resumeCleaned` and `structuredProfile`

## Resume Cleaning Rules

`resumeCleaned` should normalize parser noise before AI extraction.

Phase 2 cleaning rules:

- collapse repeated whitespace
- normalize line breaks
- trim leading and trailing noise
- preserve enough structure to keep role and skill extraction meaningful

This should be deterministic. No AI is required for cleaning.

## Preference Ownership

The user specifically wants hard filters to live in validators, not AI.

That means:

- AI may infer suggested preferences from a resume
- deterministic filter enforcement must happen in `validator.ts`
- job filtering must read the stored `preferences`
- the final decision about job eligibility must not rely on prompt interpretation

## Integration With Existing Job Pipeline

Phase 2 does not replace Phase 1 guardrails. It extends them.

Integration points:

- `generateDailyJobs()` should read `structuredProfile` and `preferences` when available
- `validator.ts` should use `preferences.remoteOnly`, `preferences.salaryFloor`, and `preferences.locations`
- legacy callers can continue passing `jobType`, `minSalary`, and `location` until later phases migrate them fully

## Error Handling

### Resume Parsing

- unsupported or unreadable files fail early
- no profile write occurs if parsing fails

### Structured Extraction

- if structured extraction fails, preserve `resumeRaw` and `resumeCleaned`
- log the extraction failure
- do not silently fabricate `structuredProfile`

### Preference Validation

- invalid `salaryFloor` values should normalize to `null` or fail validation
- empty or malformed locations should normalize to an empty array
- `remoteOnly` must always be boolean after normalization

## Testing Strategy

### Unit tests

Add focused tests for:

- resume cleaning helper
- preference normalization
- preference validation
- deterministic job matching against preferences

### Integration tests

Add focused onboarding pipeline coverage for:

- upload -> parsed raw text -> cleaned text -> structured profile -> saved profile payload
- backward compatibility field sync

The goal is confidence in the data engine, not broad UI snapshot testing.

## Recommended Implementation Shape

Phase 2 should stay structured and incremental:

1. extend profile types
2. add resume cleaning helper
3. add AI resume extraction function
4. store `resumeRaw`, `resumeCleaned`, `resumeSummary`, `structuredProfile`
5. add nested `preferences`
6. sync compatibility fields
7. add validator-owned hard filter helpers

This keeps the data engine strict without forcing a full UI migration in the same phase.

## Open Decisions Resolved

- onboarding is a data-engine phase, not a UI redesign
- structured resume artifacts are mandatory
- deterministic filters live in `validator.ts`
- nested `preferences` is the new source of truth
- legacy top-level fields remain in sync during migration

## Out Of Scope

- redesigning onboarding screens
- replacing all current readers with `structuredProfile` in one pass
- full admin schema redesign
- final cron integration
- full query generation rewrite

## Recommended Outcome

After Phase 2:

- resumes are stored as both raw and structured data
- the system has a durable structured profile for matching
- hard filters are deterministic and validator-owned
- existing app screens still work
- later phases can migrate from compatibility fields without rebuilding onboarding again
