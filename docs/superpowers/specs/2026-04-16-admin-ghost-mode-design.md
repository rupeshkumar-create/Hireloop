# Admin Ghost Mode Design

**Goal:** Add a super-admin-only `Simulate for User` tool that runs the real daily jobs pipeline for a chosen user, exposes accepted and rejected jobs with rejection codes, and supports either preview-only or run-and-persist execution.

**Scope:** This feature adds an admin debugging workflow, shared debug output from the jobs engine, and optional temporary input overrides. It does not add a public user-facing simulation tool, email sending from admin simulation runs, or a second independent jobs pipeline.

## Current Context

The repo already has the core building blocks needed for Ghost Mode:

- `src/pages/AdminDashboard.tsx` already exposes a super-admin-only interface for user management
- `src/contexts/AuthContext.tsx` already supports impersonation by exposing `realUser`, `impersonateUser()`, and effective user/profile switching
- `src/services/aiService.ts` already contains the shared `generateDailyJobs()` entrypoint
- `src/services/validator.ts` already returns structured validation results with `code` and `reason`
- `src/hooks/useDashboardJobs.ts` already contains the current persistence flow for saving generated jobs to the user profile
- `api/cron/process-user.ts` already shows the pattern for server-owned orchestration using the same generation pipeline

However, the current admin surface has no direct debugging tool for understanding why a user's daily generation produced a specific outcome.

That creates three product gaps:

1. admins cannot inspect accepted vs rejected jobs without reproducing the full run mentally
2. admins cannot see the exact validation rejection codes that filtered jobs out
3. admins cannot safely test hypothetical profile changes without either editing the user record or shipping blind

## Design Summary

Ghost Mode adds an explicit admin-only simulation flow:

```text
Admin Dashboard
-> choose user
-> open Simulate for User
-> choose preview or persist
-> choose saved profile or overrides
-> run shared daily jobs engine
-> return accepted jobs + rejected jobs + rejection codes + run stats
-> optionally persist daily jobs using the normal storage path
```

Core behavior:

1. the feature lives inside the existing super-admin dashboard
2. simulation uses the same underlying jobs pipeline as the real product
3. preview mode never writes user data
4. persist mode writes the same daily jobs fields the normal flow uses
5. rejected jobs show compact validation codes only
6. overrides are temporary and never update the user profile directly
7. Ghost Mode does not send daily alert emails

This keeps Ghost Mode useful as a debugging weapon without creating a second source of truth.

## Architecture

### 1. Shared Engine Boundary

The current `generateDailyJobs()` function should remain the stable production entrypoint for normal callers.

Add a lower-level shared helper beneath it that executes the current jobs pipeline and can return full debug metadata in addition to the normal final jobs result.

Suggested flow:

```text
build queries
-> harvest jobs
-> dedupe jobs
-> validate jobs
-> split accepted and rejected
-> filter seen jobs
-> score accepted unseen jobs
-> optionally backfill from seen jobs
-> return final jobs + debug metadata
```

The helper should own the stage-by-stage accounting so Ghost Mode does not have to recreate engine logic in the admin page.

### 2. Production Entry Point Compatibility

Keep `generateDailyJobs()` compatible with current dashboard and cron callers.

Rules:

- existing callers still receive the current lightweight result shape
- the new debug payload stays opt-in
- normal product behavior must not change just because admin debugging exists

This avoids regressions in `useDashboardJobs.ts` and the cron worker path.

### 3. Ghost Mode Entry Point

Add an admin-facing simulation action that wraps the shared helper and exposes the full debug payload.

Required execution inputs:

- target user id
- run mode: `preview` or `persist`
- input mode: `saved` or `override`
- effective profile inputs used for the run

The simulation entry point may initially live in the admin page by calling the shared engine directly, because the existing admin tooling is already browser-based and permissioned through the super-admin gate.

If the feature later needs stronger server-only boundaries, the shared debug-oriented engine contract should make it straightforward to move behind an admin API route without redesigning the feature.

## Admin UX

### 1. Table Action

Add a new user-row action in `src/pages/AdminDashboard.tsx`:

```text
Simulate for User
```

This action is separate from impersonation. It should not require the admin to enter the user's dashboard first.

### 2. Simulation Modal

Clicking `Simulate for User` opens a modal with the following controls:

- `Run Mode`
- `Input Mode`
- conditional override fields
- a primary run button
- a results panel after execution

#### Run Mode

Supported values:

- `Preview Only`
- `Run + Persist`

Behavior:

- preview runs the engine and returns debug output only
- persist runs the engine and then stores the results through the normal daily-jobs persistence path

Persist mode should have stronger confirmation language because it changes the live cached daily jobs for that user.

#### Input Mode

Supported values:

- `Use Saved Profile`
- `Use Overrides`

Behavior:

- saved profile uses the target user's current persisted data exactly
- overrides layer temporary admin-entered inputs on top of the saved profile for this run only

### 3. Override Fields

When `Use Overrides` is selected, show a compact advanced form for:

- `careerPaths`
- `jobType`
- `location`
- `minSalary`
- `resumeText`
- optional learning context inputs if present in the current profile model

Rules:

- override values are used only for the active simulation
- override mode must not call `updateDoc()` or `setDoc()` on the user profile
- switching back to saved mode should restore the original effective inputs shown in the modal

### 4. Results Layout

After a run, the modal should render a clear debug result surface with:

- `Accepted Jobs`
- `Rejected Jobs`
- `Rejection Code Counts`
- `Queries Used`
- `Engine Stats`
- run mode and input mode summary

Accepted jobs should show the same identifying fields the existing dashboard already cares about, such as title, company, location, and score when available.

Rejected jobs should show:

- title
- company
- rejection code

Per the approved design, Ghost Mode should show validation codes only and not the full human-readable reason text in the UI.

### 5. Persist Result Feedback

When persist mode succeeds, the result panel should make it visually obvious that the live user cache changed.

Expected signals:

- a success toast summarizing the count stored
- a persisted badge or label in the results panel
- admin audit logging for the run

## Data Model

### 1. Debug Result Shape

Add a shared debug payload returned by the lower-level engine helper.

Suggested shape:

```ts
interface DailyJobsDebugResult {
  queries: string[];
  harvestedCount: number;
  dedupedCount: number;
  validatedCount: number;
  unseenCount: number;
  seenCount: number;
  usedBackfill: boolean;
  acceptedJobs: Job[];
  rejectedJobs: Array<{
    job: Job;
    code: string;
  }>;
  rejectionCodeCounts: Record<string, number>;
  finalJobs: Job[];
}
```

Notes:

- `acceptedJobs` means jobs that pass deterministic validation before seen filtering and scoring
- `rejectedJobs` means jobs rejected by deterministic validation
- `finalJobs` means the jobs returned after seen filtering, scoring, and optional backfill

This preserves the difference between "validated successfully" and "actually selected for delivery."

### 2. Persisted Storage

Persist mode should reuse the existing daily storage path already used by the product:

- update `users/{uid}.dailyJobs`
- update `users/{uid}.lastJobFetchTime`
- update `users/{uid}.seenJobFingerprints`
- write `users/{uid}/daily_matches/{date}`

Ghost Mode does not need a separate result storage collection for its main output, because the purpose of persist mode is to simulate a real daily run.

### 3. Audit Logging

Each persisted simulation should create an `admin_logs` entry.

Suggested fields:

```ts
interface AdminGhostModeLog {
  adminUid: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  action: 'simulate_daily_jobs';
  runMode: 'preview' | 'persist';
  inputMode: 'saved' | 'override';
  overrideKeys?: string[];
  acceptedCount: number;
  rejectedCount: number;
  finalCount: number;
  timestamp: string;
}
```

Preview runs may also be logged later, but persist runs are the minimum required audit boundary for this phase.

## Execution Rules

### 1. Shared Pipeline Fidelity

Ghost Mode must run the same stage ordering as the real daily jobs engine.

Rules:

- do not create a separate admin-only validation algorithm
- do not create a separate admin-only ranking algorithm
- do not skip deterministic validation in simulation mode

The main value of Ghost Mode is that it reflects real system behavior.

### 2. Email Behavior

Ghost Mode must never send daily alert emails.

Reason:

- preview mode is a debugger and should never notify the user
- persist mode is for simulation and cache control, not outbound communication

This prevents accidental email side effects while still allowing admins to test storage outcomes.

### 3. Override Safety

Overrides are request-scoped only.

Rules:

- the effective simulation profile may differ from the saved profile
- the saved profile remains unchanged after the run
- the admin can still separately use existing edit tools if they intentionally want to change real profile fields

## Error Handling

### 1. Incomplete Saved Profile

If the target user lacks required inputs such as empty `careerPaths` or missing resume text, return a clear admin-facing error and do not start a partial run.

### 2. External Or AI Failure

If Serper, AI scoring, or guardrail execution fails:

- surface the raw failure message in the modal
- mark the run as not persisted
- do not write partial daily jobs data

### 3. Persist Failure

If the simulation succeeds but the storage step fails:

- show the generation results because the engine did complete
- show persist failure separately
- avoid misleading the admin into thinking live cache changed

This distinction matters because generation and persistence are separate debugging concerns.

## Testing

Add focused tests around the new shared helper and admin-facing result shaping.

Priority coverage:

- accepted and rejected jobs are split correctly
- rejection code counts are aggregated correctly
- preview mode never triggers persistence
- persist mode uses the normal daily storage path
- current `generateDailyJobs()` callers keep the old return contract

Avoid low-value UI snapshot tests. The most important risk is divergence between real generation logic and Ghost Mode debug output.

## Rollout Notes

This feature should be implemented incrementally:

1. extract or add the shared debug-capable engine helper
2. preserve `generateDailyJobs()` compatibility
3. add the admin simulation modal and action
4. wire preview mode
5. wire persist mode and audit logging
6. add focused tests

This order reduces regression risk because it locks the engine contract before expanding the admin UI.
