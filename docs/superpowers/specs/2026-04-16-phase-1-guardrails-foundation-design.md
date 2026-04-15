# Phase 1 Guardrails Foundation Design

**Goal:** Establish a strict pre-AI guardrail layer that validates inputs, wraps AI execution, records latency and audit data, and attempts safe self-healing before returning outputs.

**Scope:** This phase adds the core wrapper and validation foundation only. It does not redesign the full job engine or admin system. It focuses on guardrails that can be inserted into the current app with minimal disruption.

## Current Context

The current app already has:

- job retrieval and some raw filtering in `src/services/serperService.ts`
- AI orchestration in `src/services/aiService.ts`
- UI-triggered job generation in `src/hooks/useDashboardJobs.ts`
- Firestore access in `src/firebase.ts`

Today, validation is spread across the pipeline. Some checks happen during search. Other AI operations run without a shared wrapper, shared audit log, or shared validation contract. That makes failures harder to trace and makes future expansion risky.

## Design Summary

This phase introduces two new service files:

- `src/services/systemEngine.ts`
- `src/services/validator.ts`

`systemEngine.ts` becomes the single wrapper for guarded operations. Every guarded task goes through one entry point. The wrapper measures latency, runs task-specific validation, performs one safe self-fix attempt when allowed, and records an audit log to Firestore `aiLogs`.

`validator.ts` becomes the central home for hard business-rule validation. These checks run before AI processing for jobs and prevent invalid records from moving deeper into the system.

The design keeps the public app behavior stable while centralizing safety rules.

## Architecture

### 1. `validator.ts`

Purpose:

- enforce hard business rules before AI work
- provide structured validation results
- make failures explainable and loggable

Core responsibilities:

- `isRecent(postedAt, maxDaysOld?)`
- `validateJob(job, userContext)`
- `validateJobsBeforeAI(jobs, userContext)`
- task-specific validation helpers for AI outputs where needed

Validation result shape:

```ts
export interface ValidationResult {
  passed: boolean;
  reason?: string;
  code?: string;
  details?: Record<string, unknown>;
}
```

Job validation rules in this phase:

- job must have a valid URL
- if user selected remote-only, the job must be remote
- job must be recent enough
- invalid jobs must be rejected before AI scoring or enrichment

Collection-level validation should return both accepted and rejected jobs so later logging can explain losses:

```ts
export interface JobValidationBatchResult<TJob> {
  accepted: TJob[];
  rejected: Array<{
    job: TJob;
    validation: ValidationResult;
  }>;
}
```

### 2. `systemEngine.ts`

Purpose:

- provide one guarded execution wrapper
- measure latency
- validate outputs
- attempt safe self-healing
- persist audit logs

Core function:

```ts
export async function runWithGuardrails<TInput, TOutput>(
  taskName: GuardedTaskName,
  fn: (input: TInput) => Promise<TOutput>,
  input: TInput
): Promise<TOutput>
```

Core execution flow:

1. capture start time
2. execute task function
3. validate output with task-specific validator
4. if validation fails and task is repairable, run one self-fix attempt
5. revalidate repaired output
6. write Firestore audit log
7. return output or throw a structured error

### 3. Task Registry

`systemEngine.ts` should not rely on large `if/else` chains for behavior. Use a small registry keyed by task name.

Suggested task names for this phase:

- `job_scoring`
- `email_generation`
- `resume_tailoring`
- `validation`

Each task definition can provide:

- output validator
- self-fix handler or `null`
- log metadata

Example shape:

```ts
interface GuardedTaskConfig<TInput, TOutput> {
  validateOutput: (output: TOutput, input: TInput) => Promise<ValidationResult> | ValidationResult;
  selfFix?: (
    output: TOutput,
    input: TInput,
    validation: ValidationResult
  ) => Promise<TOutput>;
}
```

This keeps the wrapper simple while allowing new guarded tasks later.

## Audit Logging

Audit logs write to Firestore collection `aiLogs`.

Phase 1 log payload:

```ts
interface AILogRecord {
  taskName: string;
  input: unknown;
  output: unknown;
  validation: ValidationResult;
  latency: number;
  createdAt: string;
  status: 'passed' | 'self_fixed' | 'failed';
  errorMessage?: string;
  userId?: string;
}
```

Rules:

- every guarded execution attempts to write a log record
- logging failure must not silently crash the original operation after a successful result
- logging failure must still emit a console error
- sensitive payload trimming can be added later, but Phase 1 keeps payloads intact for debugging

## Self-Healing Rules

Self-healing is allowed only where repair is safe and deterministic enough.

Allowed in Phase 1:

- email generation
- resume tailoring
- structured AI outputs with validator-defined failures

Not allowed in Phase 1:

- hard-filtered job records that fail pre-AI validation
- malformed raw source data from search providers

Self-healing behavior:

- one retry only
- retry must receive the failure reason
- repaired output must be revalidated
- if revalidation still fails, throw a structured guardrail error and log failure

## Error Handling

Define a shared guardrail error shape in `systemEngine.ts`.

```ts
export class GuardrailError extends Error {
  taskName: string;
  validation?: ValidationResult;
  latency?: number;
}
```

Rules:

- validation failure after repair attempt throws `GuardrailError`
- unexpected function errors are wrapped with task name and latency context
- Firestore logging errors are caught separately and logged to console

This preserves debuggability without losing the original failure reason.

## Integration Plan

### `generateDailyJobs()`

Insert pre-AI validation after job retrieval and deduplication, but before scoring:

1. fetch raw candidate jobs
2. deduplicate
3. run `validateJobsBeforeAI()`
4. keep only accepted jobs
5. pass accepted jobs into scoring and ranking

This is the strict Phase 1 requirement: invalid jobs must not reach AI scoring.

### `generateColdEmail()` and `tailorResume()`

Wrap these in `runWithGuardrails()`:

- original generation logic remains mostly intact
- output validation becomes centralized
- latency and audit logging become automatic
- self-fix path becomes consistent

### `useDashboardJobs.ts`

No major architecture change is required here. The hook should keep calling the public service functions. The service layer absorbs guardrail behavior.

## Performance Monitoring

Phase 1 performance monitoring is lightweight and practical:

- measure latency per guarded task
- include latency in every `aiLogs` record
- emit console warnings for unusually slow operations during implementation

No dashboard or alerting system is required in this phase.

## Testing Strategy

### Unit tests for `validator.ts`

- rejects missing URL
- rejects non-remote jobs when user is remote-only
- rejects stale jobs
- accepts valid recent jobs

### Unit tests for `systemEngine.ts`

- returns successful output when validation passes
- triggers self-fix once when validation fails
- returns repaired output if revalidation passes
- throws `GuardrailError` if repair fails
- records latency
- attempts Firestore logging

### Focused integration test

- `generateDailyJobs()` filters invalid jobs before AI scoring

The goal is confidence in the guardrail boundary, not broad snapshot coverage.

## File Changes

Create:

- `src/services/systemEngine.ts`
- `src/services/validator.ts`

Modify:

- `src/services/aiService.ts`
- possibly `src/hooks/useDashboardJobs.ts` if signatures need cleanup

Potentially reuse:

- `src/firebase.ts`
- `src/services/serperService.ts`
- `src/types/dashboard.ts`

## Open Decisions Resolved

- audit logs go to Firestore `aiLogs`
- hard job validation runs before AI processing
- self-healing is limited to AI outputs, not raw jobs
- the wrapper is centralized in `systemEngine.ts`, not spread across feature files

## Out Of Scope

- full model-router implementation
- complete cron rebuild
- admin analytics dashboards
- schema migrations beyond the logging collection usage
- broad UI changes

## Recommended Implementation Shape

Keep Phase 1 small and strict:

- central wrapper
- pre-AI job filters
- structured validation results
- audit logs in Firestore
- one safe repair attempt

This creates the safety boundary first, then later phases can build on it without reworking every service again.
