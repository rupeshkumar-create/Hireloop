# Content Growth System

Autonomous hiring content pipeline for HireSchema. Publishes SEO + LLM-optimized guides daily with zero human intervention after setup.

## What It Does

| Capability | How |
|------------|-----|
| Keyword discovery | Perplexity Sonar Pro finds job-related keywords weekly |
| Competitor analysis | Profiles Wellfound, Remote.co, FlexJobs, etc. |
| Content generation | Claude Opus writes recruiter-focused guides |
| SEO | Auto title, meta, slug, schema, sitemap |
| LLM optimization | Direct answers, FAQs, definitions, salary tables, entity tags |
| Internal linking | Cluster + keyword matching, bidirectional backlinks |
| Cover images | Deterministic branded SVG (zero AI cost) |
| Analytics | Pageview + CTA tracking feeds monthly learning loop |
| Quality gate | SEO score + LLM grade + anti-slop phrase detection |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERCEL CRON SCHEDULER                        │
├──────────────┬──────────────────┬──────────────────────────────┤
│ Daily 08:00  │ Weekly Sat 06:00  │ Monthly 1st 07:00            │
│ daily-blog   │ weekly-analysis   │ monthly-learning             │
└──────┬───────┴────────┬─────────┴──────────────┬───────────────┘
       │                │                        │
       ▼                ▼                        ▼
┌──────────────┐ ┌──────────────┐        ┌──────────────┐
│  Orchestrator │ │ Keyword +    │        │ Performance  │
│  11-step      │ │ Competitor + │        │ analysis +   │
│  pipeline     │ │ Strategy     │        │ refresh +    │
└──────┬───────┘ └──────────────┘        │ new plan     │
       │                                  └──────────────┘
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  OpenRouter  │     │  Firestore   │     │  Public site │
│  2 calls/day │────▶│  blog_posts  │────▶│  /blog       │
└──────────────┘     └──────────────┘     └──────────────┘
```

## AI Usage (Minimal, Best Models)

**Daily publish: exactly 2 OpenRouter calls**

1. `perplexity/sonar-pro` — live web research
2. `anthropic/claude-opus-4-6` — full article + SEO metadata in one JSON response

**Zero AI:** internal links, quality gate, schema, cover SVG, dedup check, bidirectional backlinks

**Cover images:** deterministic SVG generated from title + cluster color. Served at `/api/blog/cover?slug=...`. No DALL·E/Flux.

## When It Runs

| Job | Cron | UTC Time | AI Calls |
|-----|------|----------|----------|
| Daily publish | `0 8 * * *` | 08:00 every day | 2 |
| Weekly intelligence | `0 6 * * 6` | 06:00 every Saturday | 3 |
| Monthly learning | `0 7 1 * *` | 07:00 on the 1st | 2 |

Requires Vercel Pro for crons. Runs automatically after deploy.

## Daily Pipeline Steps

1. Load strategy from `marketing/strategy`
2. Research topic (Sonar Pro)
3. Generate article (Claude Opus)
4. Build internal links (deterministic)
5. Quality gate (SEO + LLM score + slop detection)
6. Generate cover SVG
7. Build JSON-LD (Article, FAQPage, BreadcrumbList)
8. Publish to `blog_posts/{slug}`
9. Update topical cluster
10. Backlink from related older posts
11. Move topic from pending → used

## Firestore Collections

- `blog_posts/{slug}` — published guides
- `marketing/strategy` — topic queue + keywords
- `content_growth/state` — system status
- `content_keywords` — discovered keywords
- `content_competitors` — competitor profiles
- `content_clusters` — topical authority clusters
- `content_metrics/{slug}` — pageview analytics
- `content_learning_reports` — monthly reports
- `content_growth_runs` — pipeline audit log

## How to Test

### Option 1: Super Admin UI (recommended)

1. Sign in as super admin → `/superadmin`
2. Click **Content Growth** tab
3. Click **Dry Run** — runs full pipeline with 2 AI calls, does NOT publish
4. Review LLM grade + SEO score in the panel
5. Click **Publish Now** to go live
6. Visit `/blog` to see the guide

### Option 2: Health check

```
POST /api/admin/content-growth?action=health
Authorization: Bearer <firebase-id-token>
```

### Option 3: Trigger cron manually

```bash
# Seed strategy (first time only)
curl -X POST "https://hireschema.com/api/blog/seed-strategy?analyze=true" \
  -H "Authorization: Bearer $CRON_SECRET"

# Publish one guide
curl -X POST "https://hireschema.com/api/cron/daily-blog" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Option 4: Verify outputs

- `/blog` — guides index with cluster filters
- `/blog/{slug}` — full article with schema, FAQ, salary tables
- `/sitemap.xml` — auto-generated sitemap
- `/blog/rss.xml` — RSS feed
- `/api/blog/cover?slug={slug}` — cover image SVG
- View page source → look for `application/ld+json` scripts

## Required Environment Variables

```
OPENROUTER_API_KEY=       # AI calls
FIREBASE_SERVICE_ACCOUNT_KEY=  # Firestore writes
FIRESTORE_DATABASE_ID=    # If using named DB
CRON_SECRET=              # Cron authentication
```

## Admin API Actions

| Action | Method | Description |
|--------|--------|-------------|
| `dry-run` | POST | Test pipeline, no publish |
| `publish` | POST | Publish one guide now |
| `health` | POST | Check env vars + schedule |
| `keywords` | POST | Run keyword discovery |
| `competitors` | POST | Run competitor analysis |
| `learning` | POST | Run monthly learning loop |
| `refresh` | POST | Refresh existing post (body: `{ slug, reason }`) |

## Success Metrics Tracked

- Organic pageviews per post (`content_metrics`)
- CTA clicks (Get Daily Job Alerts button)
- Content performance scores (winners/losers)
- LLM optimization grade (A–F)
- SEO validation score
- Topical cluster authority scores
- Keyword trend (rising/stable/declining)
