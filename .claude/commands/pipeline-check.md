---
description: Audit the job pipeline end-to-end for broken stages, invariant violations, or routing mismatches
---

Audit the HireSchema job pipeline for correctness. Check each stage systematically.

## Canonical pipeline order (from SYSTEM_FLOW.md)

```
User Profile → Scout → Harvester → Deduplicate → Validator → AI Scoring → Enrichment → Final Score → Selection → Store → Email → Dashboard → Learning Update
```

## What to check

### 1. Stage ordering invariants
- Validator (`src/services/validator.ts`) must run BEFORE any AI call — confirm no AI call precedes it in `cronEngine.ts` or `jobMatchingEngine.ts`
- Store to Firestore must succeed BEFORE Resend email is called in `api/cron/process-user.ts`
- Plan limits (Free=1, Pro=10 from `src/lib/planLimits.ts`) must be applied AFTER scoring, not before

### 2. Model routing compliance
- Every `openai.create(...)` or equivalent call in `src/services/` must use a model that matches `MODEL_ROUTER.md`
- Check: `aiService.ts`, `jobMatchingEngine.ts`, `jobResearcher.ts`
- Flag any hardcoded model strings that differ from MODEL_ROUTER.md

### 3. Deduplication
- Fingerprint format must be `title::company` (lowercase, trimmed)
- `seenJobFingerprints` must be loaded from user profile before scoring begins

### 4. Learning signals
- `learningSignals.ts` updates must only affect query generation (Scout stage)
- No learning signal should alter validator behavior

### 5. Cron auth
- All cron endpoints must call `verifyCronAuth()` from `api/_lib/cronAuth.ts` before processing
- Check `api/cron/daily-alerts.ts` and `api/cron/process-user.ts`

### 6. Firestore writes
- `daily_matches/{YYYY-MM-DD}` write must include: `jobs[]`, `generatedAt`, `userId`, `jobCount`
- `cronRuns` dedup doc must be written at start of processing (status: 'processing') and updated at end

## Output format

Report as a checklist. For each item: ✅ pass, ❌ fail (with file:line), or ⚠️ needs review.
Flag any system invariant violation immediately.
