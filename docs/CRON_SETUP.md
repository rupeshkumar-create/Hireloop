# Cron setup (simple — one cron-job.org job)

Vercel **Hobby (free)** does not run scheduled crons inside Vercel. Use **[cron-job.org](https://cron-job.org)** (free) with **one cron job** that hits Hireschema once per day.

## Vercel function budget (7 of 12 used)

Hobby allows **12 serverless functions**. Hireschema uses **7** — you have **5 slots free**.

| # | Function | What it does |
|---|----------|----------------|
| 1 | `api/cron/[job].ts` | All cron URLs including **`/api/cron/tick`** |
| 2 | `api/jobs/index.ts` | User Scout runs from the dashboard |
| 3 | `api/ai/[[...route]].ts` | OpenAI + Apollo (server-side) |
| 4 | `api/blog/[[...route]].ts` | Blog API, RSS, covers |
| 5 | `api/admin/[[...route]].ts` | Super Admin API |
| 6 | `api/public/[[...route]].ts` | Sitemap + analytics |
| 7 | `api/webhook/dodo.ts` | Pro billing webhooks |

Individual cron paths (`/api/cron/daily-alerts`, etc.) still work for manual testing — they all share **one** Vercel function.

---

## Step 1 — Vercel environment variables

In **Vercel → Project → Settings → Environment Variables**:

| Variable | Required |
|----------|----------|
| `CRON_SECRET` | Yes — auth for all cron endpoints |
| `INTERNAL_CRON_SECRET` | Yes — worker auth (can match `CRON_SECRET`) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes |
| `FIRESTORE_DATABASE_ID` | Yes |
| `OPENROUTER_API_KEY` | Yes |
| `APIFY_API_TOKEN` | Yes (job discovery) |

Redeploy after changing env vars.

---

## Step 2 — Create ONE job on cron-job.org

You only need **one** cron job. It runs everything that is due.

| Field | Value |
|-------|--------|
| **Title** | Hireschema — daily scheduler |
| **URL** | `https://hireschema.com/api/cron/tick` |
| **Schedule** | Every day at **08:00 UTC** |
| **Request method** | **POST** |
| **Header** | Name: `Authorization` · Value: `Bearer YOUR_CRON_SECRET` |

Replace `YOUR_CRON_SECRET` with the exact value from Vercel.

### What runs at 08:00 UTC?

| Task | When |
|------|------|
| Daily Scout (job matches) | Every day |
| Daily blog publish | Every day |
| Weekly content strategy | Saturdays only |
| Monthly learning loop | 1st of each month |

All run in one batch when your cron-job.org job fires at **08:00 UTC**. On a normal weekday you get Scout + blog; on Saturdays you also get weekly strategy; on the 1st you also get the monthly loop.

---

## Step 3 — Test it

**Run now** in cron-job.org, or:

```bash
curl -X POST "https://hireschema.com/api/cron/tick" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Success example:

```json
{
  "ran": ["daily-alerts", "daily-blog"],
  "failed": [],
  "serverTimeUtc": "2026-06-06T08:02:00.000Z"
}
```

See schedule + function count (authenticated):

```bash
curl "https://hireschema.com/api/cron/tick" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Force a single job (manual / Super Admin)

```bash
# Just Scout dispatch
curl -X POST "https://hireschema.com/api/cron/tick?force=daily-alerts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Everything (ignore schedule)
curl -X POST "https://hireschema.com/api/cron/tick?force=all" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Legacy URLs still work:

```bash
curl -X POST "https://hireschema.com/api/cron/daily-alerts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## FAQ

**Do I need 4 separate cron-job.org jobs?**  
No. Use **one** job pointing at `/api/cron/tick`.

**Why 08:00 UTC instead of 02:30?**  
One daily trigger is simpler. Scout still respects each user’s `preferredDeliveryHour` in their profile; the dispatcher runs once and queues due users.

**What about `process-user`?**  
Internal only — `daily-alerts` calls it per user. Do not add a separate cron-job.org entry.

**Inactivity pause (3 days)**  
Users inactive 3+ days are skipped and auto-paused until they open the app again.

**Blog seed (once)**

```bash
curl -X POST "https://hireschema.com/api/blog/seed-strategy?analyze=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Super Admin UI**  
Content Growth tab: `/superadmin?tab=content` for dry-run / publish now.

---

## cron-job.org click-by-click

1. Sign up at [cron-job.org](https://cron-job.org)
2. **Create cronjob**
3. URL: `https://hireschema.com/api/cron/tick`
4. Schedule: **Daily** → **08:00** → timezone **UTC**
5. **Advanced** → add header `Authorization: / Bearer YOUR_CRON_SECRET`
6. Method: **POST**
7. Save → **Run now** → expect HTTP **200**

Done. You do not need any other cron jobs on cron-job.org.
