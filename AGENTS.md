# HireSchema — Codex Context

## What This Is

HireSchema is an AI-powered daily job matching platform. It runs a nightly cron pipeline that discovers real job listings via web search, scores them against a candidate's resume, enriches the top matches with AI-generated summaries, and delivers them via email and a React dashboard. Users can then track applications, generate tailored resumes, cold emails, and interview questions.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite, TailwindCSS, Shadcn/ui, React Router v7
- **Backend**: Vercel Serverless Functions (TypeScript)
- **AI Gateway**: `openai` npm package pointed at `https://openrouter.ai/api/v1` — **not** `@anthropic-ai/sdk`, not direct OpenAI. Every model (Codex, Gemini, GPT) is called through OpenRouter using the same `openai.chat.completions.create()` interface.
- **Storage**: Firebase Firestore + Firebase Auth (Google OAuth)
- **Email**: Resend API
- **Deployment**: Vercel (frontend + API) + Firebase (auth/DB + rules)

## Key Scripts

```bash
npm run dev          # Start Vite dev server on port 3000
npm run lint         # TypeScript type check (tsc --noEmit)
npm run build        # Production build
npm run test         # Run Vitest tests
npm run deploy:rules # Deploy firestore.rules to Firebase
```

## Model Routing (strict — do not deviate)

Every AI task has an assigned model. Never change routing without updating `MODEL_ROUTER.md`.

| Task | Model (via OpenRouter) |
|------|----------------------|
| `query_generation`, `resume_analysis`, `career_path_suggestion`, `job_preference_extraction`, `recruiter_email_extraction`, `job_scoring` | `openai/gpt-4o-mini` |
| `resume_summary` | `google/gemini-pro-1.5` |
| `email_generation`, `resume_tailoring`, `text_improvement` | `anthropic/claude-3.5-sonnet` |
| `resume_extraction` | `openai/gpt-4o` |
| `interview_questions`, `salary_insights` | `anthropic/claude-3.5-sonnet` |

All calls flow through `api/openai.ts` — an OpenRouter proxy using the `openai` npm package with `baseURL: 'https://openrouter.ai/api/v1'`. **Never use `@anthropic-ai/sdk` or call provider APIs directly.** Never call from the frontend — always proxy through `api/openai.ts`.

## Canonical Job Pipeline

```
User Profile → Scout (query gen) → Harvester (Perplexity/Gemini search)
→ Deduplicate (fingerprint: title::company)
→ Validator (hard rules — remote/location/salary/freshness/URL)
→ AI Scoring (GPT-4o-mini batch score)
→ Top-15 Enrichment (Codex: matchReasons, skillGaps, aiSummary, hotSignals)
→ Final Score (composite: match×0.5 + freshness×0.2 + quality×0.2 + hotJob×0.1)
→ Selection (plan cap: Free=1, Pro=10)
→ Store to Firestore (users/{uid}/daily_matches/{YYYY-MM-DD})
→ Email via Resend
→ Dashboard display
→ User actions → Learning signals → Next cycle
```

**Cron entry**: `api/cron/daily-alerts.ts` → `api/cron/process-user.ts` → `src/services/cronEngine.ts`

## System Invariants — Never Break These

1. **No fake jobs** — all jobs sourced from live web search only
2. **Validator runs before AI** — hard filters cannot be bypassed or rescued by AI
3. **No job generation client-side** — all jobs stored server-side before dashboard reads them
4. **Plan limits applied after scoring** — never filter by plan before scoring
5. **No email before storage** — store to Firestore before calling Resend
6. **No hallucinations** — all AI output must be grounded in retrieved job data and user resume
7. **Learning signals never override hard filters** — deterministic validation stays deterministic
8. **Pro Quota & Relevance** — Pro users must receive 10 jobs daily with a minimum match score of 75%.
9. **Redundancy Guard** — Manual Scout runs are blocked if today's batch already exists.
10. **Automated Onboarding** — Profile creation MUST automatically parse the resume to extract structured data and exactly 3 career paths based on a deep analysis of experience and skills.

## Key Files & Directories

```
src/
├── services/
│   ├── aiService.ts            # Email gen, resume tailoring, interview questions
│   ├── jobResearcher.ts        # Stage 1: Perplexity + Gemini job discovery
│   ├── jobMatchingEngine.ts    # Stage 2: scoring + enrichment + final selection
│   ├── validator.ts            # Hard validation rules (deterministic)
│   ├── cronEngine.ts           # Orchestrates full pipeline
│   ├── learningSignals.ts      # User behavior → next-cycle query improvements
│   └── systemEngine.ts         # Guardrails + AI output logging
├── hooks/
│   ├── useDashboardJobs.ts     # Loads today's daily_matches from Firestore
│   └── useDashboardAI.ts       # AI actions (email, resume, questions)
├── types/
│   ├── dailyJob.ts             # Core DailyJob type
│   └── dashboard.ts
├── lib/
│   └── planLimits.ts           # Free (1) vs Pro (10) job caps
api/
├── cron/
│   ├── daily-alerts.ts         # Dispatcher: queues active users
│   └── process-user.ts         # Per-user orchestrator
├── jobs/
│   └── trigger.ts              # User-facing on-demand endpoint
├── _lib/
│   ├── firebaseAdmin.ts        # Firebase Admin SDK init
│   └── cronAuth.ts             # CRON_SECRET verification
└── openai.ts                   # OpenRouter proxy (all AI calls go here)

Documentation (read these before changing AI logic):
├── SYSTEM_FLOW.md              # Canonical top-level flow
├── JOB_ENGINE_FLOW.md          # Detailed job discovery → matching
├── CRON_FLOW.md                # Cron dispatcher → per-user flow
├── MODEL_ROUTER.md             # Model assignments per task
├── AI_RULES.md                 # Anti-hallucination + anti-slop rules
├── VALIDATION_RULES.md         # Hard filter requirements
└── DATABASE_SCHEMA.md          # Firestore collections + field types
```

## Firestore Collections

- `users/{uid}` — user profile, resume, preferences, plan, learningSignals, dailyJobs
- `users/{uid}/daily_matches/{YYYY-MM-DD}` — dated job batches (primary store)
- `users/{uid}/trackedJobs/{jobId}` — saved/applied/interviewing/offered/rejected jobs
- `cronRuns/{uid}_{date}` — dedup guard (prevents double-processing per user per day)
- `admin_logs/{id}` — ghost mode + admin audit trail

## AI Rules (enforced in all AI tasks)

- No placeholder text, no invented data, no "Company X" stand-ins
- No "I am excited" or generic corporate filler (anti-slop)
- Email generation: must reference role + company + user background; max 120 words
- Resume tailoring: stay grounded in original resume; no fabricated experience
- If context is insufficient: fail safely or fall back deterministically

## Auth & Security

- Firebase Auth (Google OAuth) for users
- Custom `superAdmin` Firebase claim for admin access
- `CRON_SECRET` + `INTERNAL_CRON_SECRET` verify cron endpoints (checked in `cronAuth.ts`)
- Firestore security rules in `firestore.rules` — users own their data; admin bypasses via service account

## Environment Variables

```env
# Frontend (Vite)
VITE_OPENROUTER_API_KEY=
VITE_RESEND_API_KEY=
VITE_SUPER_ADMIN_PASSWORD=

# Backend (Vercel)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
OPENROUTER_API_KEY=
CRON_SECRET=
INTERNAL_CRON_SECRET=
```

## Available Custom Commands

| Command | Purpose |
|---------|---------|
| `/new-endpoint` | Scaffold a new Vercel API endpoint with auth wiring |
| `/add-model` | Add or update a model assignment in MODEL_ROUTER |
| `/pipeline-check` | Audit the job pipeline for broken connections or invariant violations |
| `/schema-update` | Update Firestore schema, TypeScript types, and firestore.rules in sync |
