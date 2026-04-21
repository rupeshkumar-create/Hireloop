# SYSTEM_FLOW.md

## Purpose

This document defines the canonical end-to-end system flow for HireSchema.
It connects the user profile, the job engine, storage, dashboard delivery, user feedback, and the next-cycle learning loop.

This is the top-level flow.
More detailed rules still live in:

- `JOB_ENGINE_FLOW.md`
- `CRON_FLOW.md`
- `VALIDATION_RULES.md`
- `AI_RULES.md`

## Canonical Flow

The system must run in this order.
No later stage may silently compensate for a failed earlier stage.

### 1. User

Rule:
The flow starts from a real user and their current state.
The system must not generate jobs without a user context.

### 2. Profile

Rule:
Load the user profile before job generation.
The profile is the source of truth for:

- career paths
- resume text and summary
- structured profile
- job preferences
- plan
- seen job fingerprints
- learning signals

### 3. Scout

Rule:
Generate high-precision search queries from the profile.
Scout must use resume context, career paths, preferences, and learned signals.
Scout must optimize for real job retrieval, not broad idea generation.

Scout mental model:

- dynamic user context decides what to search for
- static search guardrails decide where and how Scout is allowed to search
- AI generation creates the first high-precision query set
- learning rewrite adjusts the final query set based on user behavior

### 4. Harvester

Rule:
Run live search using Scout queries.
Collect only real job candidates from approved domains and recent listings.
Harvester may cap volume, but it must not invent or synthesize jobs.

### 5. Deduplicate

Rule:
Remove duplicate jobs before validation.
Deduplication must use a stable fingerprint so the same role is not processed twice in one cycle.

### 6. Validator

Rule:
Apply deterministic hard rules before any AI ranking.
Reject jobs that fail remote, location, salary, freshness, or link requirements.
AI must not rescue jobs that fail hard validation.

### 7. AI Enrichment And Scoring

Rule:
Only validated jobs may enter AI scoring.
This stage may extract grounded requirements and quality signals, estimate missing salary, and assign a resume-fit score.
All output must stay grounded in the retrieved job content and user context.

Implementation note:
In the current codebase, enrichment and scoring are produced together inside the same scoring pass.

### 8. Final Score

Rule:
Combine the AI match score with deterministic quality signals to produce one final ranking score.
The final score should reflect both fit and confidence in the job quality.

Implementation note:
The current implementation blends:

- match score
- freshness
- ATS quality
- company quality
- hot-job signals

### 9. Threshold And Selection

Rule:
Sort jobs by final score and keep only the best jobs for output.
Prefer unseen jobs first.
If the plan allows more jobs and unseen inventory is light, the system may backfill with strong seen jobs.
Plan limits must be applied after validation and scoring, not before.

### 10. Store

Rule:
Persist only final selected jobs.
Store enough metadata to support dashboard rendering, historical lookup, and regeneration control.

Current storage includes:

- user-level `dailyJobs`
- user-level `lastJobFetchTime`
- user-level `seenJobFingerprints`
- dated `daily_matches` history

### 11. Dashboard

Rule:
The dashboard reads stored daily jobs and presents the final result set to the user.
The UI must not bypass the engine by inventing extra jobs client-side.

### 12. User Actions

Rule:
User behavior is part of the system.
Saved, dismissed, clicked, and applied actions are product signals, not just UI events.

### 13. Learning Update

Rule:
Convert user actions into structured learning signals.
Learning updates must adjust future retrieval behavior without breaking hard constraints.
Learning may boost preferred keywords and suppress disliked ones.

### 14. Next Cycle Improves

Rule:
The next generation cycle must consume the updated learning state.
Improvement happens through better query shaping and better candidate prioritization, not by skipping validation.

## Practical Pipeline

In compact form, the live system is:

`User -> Profile -> Scout -> Harvester -> Deduplicate -> Validator -> AI Enrichment And Scoring -> Final Score -> Threshold And Selection -> Store -> Dashboard -> User Actions -> Learning Update -> Next Cycle Improves`

## Current Code Mapping

### Primary Runtime Path

- Profile load and dashboard fetch orchestration: `src/hooks/useDashboardJobs.ts`
- Scout query generation + Harvester (Perplexity/Gemini search) + Deduplication: `src/services/jobResearcher.ts`
- Deterministic hard validation: `src/services/validator.ts`
- AI batch scoring + enrichment + final composite score + plan-capped selection: `src/services/jobMatchingEngine.ts`
- User-facing AI tasks (email generation, resume tailoring, interview questions, career paths): `src/services/aiService.ts`
- Learning signal extraction and Scout query rewrite: `src/services/learningSignals.ts`
- Guardrail validation and AI logging: `src/services/systemEngine.ts`

### Cron Path

Rule:
Cron follows the same engine flow.
Cron does not define a separate ranking system.
It only changes how users are dispatched and processed.

Primary cron entry points:

- `api/cron/daily-alerts.ts`
- `api/cron/process-user.ts`
- `src/services/cronEngine.ts`

## System Invariants

- No fake jobs.
- No AI scoring before deterministic validation.
- No dashboard-only job generation.
- No plan limit override of quality standards.
- No learning signal may override hard filters.
- No email delivery before storage succeeds in cron flow.

## Design Intent

The product should get better with use.
That improvement loop depends on three things staying strict:

- hard validation stays deterministic
- AI stays grounded
- user behavior feeds the next cycle safely
