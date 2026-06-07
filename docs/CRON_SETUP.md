# Cron setup (Vercel Hobby + GitHub Actions)

Hireschema runs on **Vercel Hobby** (60s function limit, no Vercel Cron). Long-running jobs run in **GitHub Actions** instead.

## Schedules (UTC)

| Workflow | Schedule | What it does |
|----------|----------|--------------|
| [generate-jobs.yml](../.github/workflows/generate-jobs.yml) | `30 2 * * *` + `0 9 * * *` catch-up | Daily Scout — job matches for active users |
| [content-cron.yml](../.github/workflows/content-cron.yml) | `5 8 * * *` | Daily blog publish |
| [content-cron.yml](../.github/workflows/content-cron.yml) | `0 8 * * 6` | Weekly keyword/strategy (Saturdays) |
| [content-cron.yml](../.github/workflows/content-cron.yml) | `0 8 1 * *` | Monthly learning loop (1st of month) |

Confirm workflows are enabled under **GitHub → Actions** and that repo secrets are set.

## GitHub secrets

| Secret | Required for |
|--------|----------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Scout + content pipelines |
| `FIRESTORE_DATABASE_ID` | Optional — non-default Firestore DB |
| `OPENROUTER_API_KEY` | Scout AI + blog pipeline |
| `APIFY_API_TOKEN` | Scout job discovery |

## Vercel environment variables

| Variable | Required |
|----------|----------|
| `GITHUB_DISPATCH_TOKEN` | Yes — admin “Publish Now” and dashboard job generation dispatch GitHub Actions |
| `GITHUB_REPO` | Optional if Vercel is linked to GitHub (`owner/repo`) |
| `CRON_SECRET` | Optional — manual `/api/cron/*` calls only |
| `INTERNAL_CRON_SECRET` | Legacy — `/api/cron/process-user` worker auth |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes |
| `OPENROUTER_API_KEY` | Yes |

## Manual runs

**GitHub Actions UI:** Actions → Content Growth Cron → Run workflow → pick job.

**Local script:**

```bash
JOB=daily-blog npx tsx scripts/run-content-cron.ts
JOB=weekly-analysis npx tsx scripts/run-content-cron.ts
JOB=monthly-learning npx tsx scripts/run-content-cron.ts
```

**Vercel API (60s cap — blog will timeout):**

```bash
curl -X POST "https://hireschema.com/api/cron/tick?force=daily-blog" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Super Admin

**Content Growth → Publish Now** dispatches `content-cron.yml` on GitHub (returns 202). Refresh the dashboard after the workflow completes (~2–5 min).

## Vercel function budget (Hobby)

All serverless functions use **maxDuration: 60**. Cron routes remain for manual/debug use; do not rely on them for the blog pipeline.

See `VERCEL_FUNCTION_MANIFEST` in [`src/server/cronSchedule.ts`](../src/server/cronSchedule.ts) — stay under the 12-function Hobby limit.
