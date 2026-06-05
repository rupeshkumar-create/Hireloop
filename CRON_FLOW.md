# CRON_FLOW.md

## For Each User

The cron pipeline must run in this exact order.
Each step must complete before the next step begins.

### 1. Check Plan

Rule:
Read the user plan first.
Do not process users without an active plan.
Do not process users with daily alerts disabled.

### 2. Validate User Readiness

Rule:
Validate that the user has the minimum profile data required to run the engine.
At minimum, the cron worker must confirm an email and usable career paths before continuing.

### 3. Mark Run Processing

Rule:
Mark the run as processing before job generation starts.
Persist the run start time for idempotency, visibility, and debugging.

### 4. Run Shared Job Engine

Rule:
Run the same shared job engine used by the product flow.
Cron must not define a separate ranking or validation pipeline.
Use the defined engine flow with no skipped stages.

### 5. Store Jobs

Rule:
Store only final selected jobs produced by the engine.
Persist timestamps and generation metadata with the result set.

### 6. Send Email

Rule:
Send email only after storage succeeds.
Use stored and validated content only.
If no jobs are stored, email may be skipped.

### 7. Mark Run Completed Or Failed

Rule:
Log the full execution result for debugging and auditability.
Include user, timestamps, final status, jobs stored, email outcome, and failure reason if present.
