# Cron setup (Vercel Hobby + GitHub Actions)

## Why GitHub needs 3 extra secrets

Your **Firebase, OpenRouter, Apify, etc. live in Vercel** — that is correct for the live site.

**GitHub Actions runs on GitHub’s servers**, not Vercel. Scheduled workflows cannot read Vercel env unless you connect them.

### One-time GitHub setup (5 minutes)

Go to **GitHub → your repo → Settings → Secrets and variables → Actions** and add:

| Secret | Where to find it |
|--------|------------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) — create a token |
| `VERCEL_ORG_ID` | Vercel → Project → **Settings → General** → Team / Org ID |
| `VERCEL_PROJECT_ID` | Same page → **Project ID** |

You already have `GITHUB_DISPATCH_TOKEN` and `GITHUB_REPO` in **Vercel** — keep those.

After this, workflows pull all production env vars from Vercel automatically (`scripts/gha-source-env.sh`).

**Alternative:** duplicate `FIREBASE_SERVICE_ACCOUNT_KEY` and `OPENROUTER_API_KEY` into GitHub secrets instead of the 3 Vercel tokens above.

---

## How automatic publish works

1. **Schedules** — `content-cron.yml` (08:05, 12:00, 18:00 UTC) and `generate-jobs.yml` publish job (02:30, 09:00 UTC)
2. **Every production deploy** — build runs `postbuild-dispatch-blog.mjs` and triggers GitHub if no post yet today
3. **Self-healing** — RSS, sitemap, blog API, and admin dashboard dispatch GitHub if a run was missed

All paths skip if today’s post already exists.

---

## After pushing these changes

1. Add the 3 GitHub secrets above
2. Push to `main` (triggers deploy → auto-dispatch)
3. Check **GitHub → Actions → Content Growth Cron** — should go green in ~3–5 min

Manual run: **Actions → Content Growth Cron → Run workflow → daily-blog**
