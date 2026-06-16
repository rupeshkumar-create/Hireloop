# Cron setup (Vercel Hobby + GitHub Actions)

## Why GitHub needs secrets

Your **Firebase, OpenRouter, Apify, etc. live in Vercel** — that is correct for the live site.

**GitHub Actions runs on GitHub's servers**, not Vercel. Scheduled workflows cannot read Vercel env unless you connect them.

### One-time GitHub setup

Go to **GitHub → your repo → Settings → Secrets and variables → Actions** and add:

| Secret | Where to find it |
|--------|------------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase console → service account JSON (one line) |
| `OPENROUTER_API_KEY` | OpenRouter dashboard |
| `APIFY_API_TOKEN` | Apify console → Settings → Integrations (required for Scout job discovery) |
| `APIFY_ACTOR_ID` | Optional — Apify actor ID (defaults to `WZ6I13XHxnlgZ0I0j` in code) |
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) — optional, pulls supplemental env |
| `VERCEL_ORG_ID` | Vercel → Project → Settings → General |
| `VERCEL_PROJECT_ID` | Same page → Project ID |

You also need `GITHUB_DISPATCH_TOKEN` and `GITHUB_REPO` in **Vercel** for legacy Scout dispatch paths.

After this, `generate-jobs.yml` pulls production env via `scripts/gha-source-env.sh`.

---

## What runs automatically

| Workflow | Purpose | Schedule |
|----------|---------|----------|
| `generate-jobs.yml` | Daily Scout job matching for active users | 02:30 & 09:00 UTC |

**Blog content is manual** — update posts in Firestore or the programmatic catalog in code, then deploy. Build regenerates `llms.txt`, `llms-full.txt`, and `sitemap.xml` automatically.

---

## Manual Scout run

**Actions → Generate Daily Jobs → Run workflow** (optional `user_id` for a single user).

Dashboard **Generate daily jobs** runs Scout inline on Vercel (no GitHub wait).
