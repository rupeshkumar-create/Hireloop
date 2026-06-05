# JOB_ENGINE_FLOW.md

## Strict Flow

The job engine must run in this exact order.
No stage may be skipped.
No later stage may compensate for a failed earlier stage.

### 1. Generate Queries (`Scout`)

Rule:
Generate search queries from the user profile, resume summary, career paths, and preferences.
Do not generate vague or unrelated queries.

Scout model:

- dynamic user context provides the search intent
- static search guardrails constrain domains and query shape
- AI generation creates the first query set
- learning rewrite updates the final query set using user behavior

### 2. Fetch Jobs (`Harvester`)

Rule:
Fetch jobs only from approved sources.
Store raw results before transformation.

### 3. Deduplicate

Rule:
Remove duplicate jobs before validation.
Use a stable fingerprint so the same role is not processed twice in one cycle.

### 4. Apply Hard Filters (`Validator`)

Rule:
Reject jobs that fail hard requirements.
Examples include invalid link, wrong location, salary mismatch, stale posting, or remote mismatch.

### 5. AI Enrichment And Scoring

Rule:
Only validated jobs may enter AI scoring.
This stage may extract grounded requirements and quality signals, estimate missing salary, and score each job against the user resume and preferences.
Do not score without grounded input.

Implementation note:
In the current codebase, enrichment and scoring are produced together in one pass.

### 6. Final Score

Rule:
Combine AI fit with deterministic quality signals into one final ranking score.
The final score should reflect both match quality and result confidence.

Implementation note:
The current implementation blends match score, freshness, ATS quality, company quality, and hot-job signals.

### 7. Threshold And Selection

Rule:
Sort jobs by final score and keep only the best jobs for output.
Prefer unseen jobs first.
Apply plan-based output limits only after validation and scoring.
Plan limits must never override relevance standards.

Implementation note:
If unseen inventory is light and the plan allows more jobs, the system may backfill with strong seen jobs.

### 8. Save To Firestore

Rule:
Save only final approved jobs.
Persist output, generation metadata, and timestamps for debugging and regeneration control.
