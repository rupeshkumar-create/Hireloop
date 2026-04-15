# Phase 5 Asset Forge Design

**Goal:** Build an Asset Forge stage that generates validated cold-email assets for jobs with real recruiter data, using Apollo as the primary recruiter source and skipping gracefully when no recruiter is found.

**Scope:** This phase covers recruiter lookup and cold-email asset generation only. It does not redesign the full job tracker UI, bulk sending workflow, or resume tailoring flow. It focuses on email asset generation as a monetizable feature.

## Current Context

The repo already has:

- guarded cold-email generation in `src/services/aiService.ts`
- deterministic email validation in `src/services/validator.ts`
- central execution guardrails in `src/services/systemEngine.ts`

The repo does not yet have:

- Apollo integration
- a structured recruiter model
- skip-on-missing-recruiter logic as a first-class phase behavior

The current recruiter logic is limited to scanning the job description for an email string. That is useful as a fallback utility, but it is not a true recruiter-source layer.

## Design Summary

Phase 5 introduces Asset Forge as a clear stage with this flow:

```text
job -> Apollo recruiter lookup -> recruiter found? -> guarded email generation -> validated email asset
                                            \-> no recruiter -> skip
```

Apollo is the primary recruiter source.
If Apollo does not return a recruiter, the system skips outreach generation instead of fabricating data.

## Architecture

### 1. Apollo Recruiter Lookup

Create a dedicated recruiter-source layer, ideally in:

- `src/services/apolloService.ts`

Responsibilities:

- search for recruiter/contact data using the company and role context
- normalize the Apollo response into a small internal recruiter object
- hide Apollo-specific request/response details from `aiService.ts`

Suggested recruiter shape:

```ts
interface RecruiterContact {
  name: string;
  title: string;
  email: string;
  linkedinUrl?: string;
}
```

Phase 5 rules:

- Apollo is the first lookup step
- recruiter email is required for a “found” result
- missing recruiter is not an exception
- request failures should be logged and treated as skip conditions

### 2. Asset Forge Email Generation

Cold email generation should move toward a structured input shape:

```ts
runWithGuardrails('email_generation', generateEmail, {
  job,
  recruiter,
  resumeSummary,
})
```

This is better than the current positional parameter API because:

- it matches the phase design more closely
- recruiter information becomes explicit
- validation and logging get a cleaner input record

Suggested job shape:

```ts
interface OutreachJobContext {
  title: string;
  company: string;
  description?: string;
  location?: string;
  url?: string;
}
```

The generated email should be grounded in:

- the job
- the recruiter
- the user `resumeSummary`

### 3. Validation

Validation remains deterministic and belongs in `validator.ts`.

Phase 5 validation rules:

- must mention company
- must mention role
- must be under 120 words

These rules already mostly exist in the current email validator, but they should be tightened to match the Asset Forge contract.

This phase does not require recruiter-name validation in the email body.
The recruiter is required for routing and delivery, but the content rules remain focused on company, role, and brevity.

## Skip Semantics

Phase 5 explicitly allows skip behavior.

If Apollo returns no recruiter:

- do not generate a cold email
- return a structured skip result
- do not treat it as a hard failure

Suggested result shape:

```ts
interface AssetForgeEmailResult {
  status: 'generated' | 'skipped';
  reason?: 'recruiter_not_found' | 'apollo_error';
  recruiter?: RecruiterContact;
  email?: string;
}
```

This keeps the system observable and safe.

## Guardrail Ownership

### `systemEngine.ts`

The existing `email_generation` task can remain in place.
Phase 5 does not require a rename to `email`.

That avoids churn across:

- tests
- dashboard hooks
- tracker pages

The important change is the structured Asset Forge input, not the task string.

### `validator.ts`

Phase 5 should continue to own:

- company mention checks
- role mention checks
- word-count checks

If needed, add a dedicated wrapper validator such as:

```ts
validateAssetForgeEmail(output: string, input: { company: string; jobTitle: string }): ValidationResult
```

This can either replace or delegate to the current `validateGeneratedEmail()`.

## Integration With Existing App

Phase 5 should not break the current email generation entry points.

Recommended migration path:

1. add Apollo service
2. add Asset Forge wrapper function in `aiService.ts`
3. keep current `generateColdEmail()` working
4. optionally make `generateColdEmail()` call the new structured helper internally

This preserves existing screens while enabling a richer paid feature path.

## Error Handling

### Apollo

- request error -> log -> return skipped result with `apollo_error`
- no recruiter found -> return skipped result with `recruiter_not_found`

### Email Generation

- recruiter found but email generation fails validation -> use existing guardrail behavior
- if self-fix still fails, return the existing hard failure path

### Observability

Apollo skip/failure states should be visible in logs so the system can distinguish:

- missing recruiter coverage
- provider outage
- generation failure

## Testing Strategy

### Unit tests

Add tests for:

- Apollo result normalization
- missing recruiter -> skip result
- email validation under Asset Forge rules

### Focused integration tests

Add focused flow tests for:

1. recruiter found -> email generated
2. recruiter not found -> skipped
3. invalid generated email -> validation failure/self-fix path

The goal is to verify the Asset Forge stage contract, not a complete end-to-end outreach system.

## Recommended File Responsibilities

### `src/services/apolloService.ts`

- Apollo API integration
- recruiter normalization
- skip-safe error handling

### `src/services/aiService.ts`

- Asset Forge orchestration
- guarded email generation
- compatibility layer for existing email generation callers

### `src/services/validator.ts`

- deterministic email validation rules

### `src/services/systemEngine.ts`

- existing `email_generation` task remains the guardrail wrapper

## Out Of Scope

- bulk email sending
- Apollo pagination and enrichment workflows
- recruiter CRM
- UI redesign for outreach
- automated sending cadence
- resume tailoring changes

## Recommended Outcome

After Phase 5:

- recruiter lookup has a real provider layer
- Apollo is the primary source
- cold-email generation only runs when recruiter data exists
- missing recruiter becomes a clean skip state
- email assets stay validated and guardrail-protected
- the repo gains a stronger foundation for a paid outreach feature
