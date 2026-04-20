# Vercel Hobby Minimal Endpoint Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the minimum set of API routes needed to reduce Vercel Hobby function count from 14 to 12 without changing product behavior.

**Architecture:** Replace the two jobs endpoints with one shared `api/jobs/index.ts` handler that switches on request `mode`, and replace the two blog endpoints with one shared `api/blog/index.ts` handler that switches on `slug` query presence. Update the dashboard client to call the merged jobs endpoint and remove the superseded route files.

**Tech Stack:** TypeScript, Vercel serverless functions, Firebase Admin SDK, Vite, Vitest

---

## File Map

**Create**
- `api/jobs/index.ts`
- `api/blog/index.ts`

**Modify**
- `src/hooks/useDashboardJobs.ts`

**Delete**
- `api/jobs/request.ts`
- `api/jobs/trigger.ts`
- `api/blog/post.ts`
- `api/blog/posts.ts`

---

### Task 1: Merge Jobs Endpoints Into `api/jobs/index.ts`

**Files:**
- Create: `api/jobs/index.ts`
- Delete: `api/jobs/request.ts`
- Delete: `api/jobs/trigger.ts`

- [ ] **Step 1: Create the merged jobs route**

Create `api/jobs/index.ts` with the two existing code paths preserved behind a `mode` switch:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from '../../src/server/firebaseAdmin.js';
import { getCronRunDateIST, processUserCronRun } from '../../src/services/cronEngine';
import { researchJobs, jobFingerprint } from '../../src/services/jobResearcher';
import { matchAndRankJobs } from '../../src/services/jobMatchingEngine';
import type { CallAIFn } from '../../src/services/jobResearcher';
import { buildDailyJobAlertsEmailPayload } from '../../src/services/emailService';
import type { DailyJob } from '../../src/types/dailyJob';

const MAX_SEEN_FINGERPRINTS = 500;

function makeServerCallAI(): CallAIFn {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  return async (messages, model) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://hireschema.com',
        'X-Title': 'HireSchema Jobs',
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    return (data as any).choices?.[0]?.message?.content?.trim() || '';
  };
}

function getBaseUrl(req: VercelRequest): string {
  const proto =
    Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || process.env.VERCEL_URL;
  if (!host) throw new Error('Cannot determine request host');
  return `${proto}://${host}`;
}

async function verifyUser(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\\s+/i, '').trim();
  if (!idToken) return null;

  const decoded = await getAdminAuth().verifyIdToken(idToken);
  return decoded.uid;
}

async function handleAsyncDispatch(uid: string, res: VercelResponse) {
  const githubToken = process.env.GITHUB_DISPATCH_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubToken || !githubRepo) {
    return res.status(503).json({
      error: 'async_not_configured',
      message: 'GitHub Actions dispatch is not set up; use sync trigger mode instead.',
    });
  }

  const runDate = getCronRunDateIST();

  let ghResponse: Response;
  try {
    ghResponse = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'generate-jobs-for-user',
        client_payload: { userId: uid, runDate },
      }),
    });
  } catch (fetchErr) {
    console.error('[jobs/index] GitHub fetch threw:', fetchErr);
    return res.status(503).json({
      error: 'async_not_configured',
      message: 'GitHub Actions unreachable; use sync trigger mode instead.',
    });
  }

  if (!ghResponse.ok) {
    const body = await ghResponse.text().catch(() => '');
    console.error('[jobs/index] GitHub dispatch failed:', ghResponse.status, body);

    let hint = '';
    if (ghResponse.status === 401 || ghResponse.status === 403) {
      hint = ' — check that GITHUB_DISPATCH_TOKEN has the "repo" scope';
    } else if (ghResponse.status === 404) {
      hint = ` — repo "${githubRepo}" not found or token lacks access`;
    } else if (ghResponse.status === 422) {
      hint = ' — workflow file may be missing the repository_dispatch trigger';
    }

    return res.status(502).json({
      error: `GitHub dispatch failed (HTTP ${ghResponse.status})${hint}`,
      githubStatus: ghResponse.status,
    });
  }

  return res.status(202).json({
    status: 'dispatched',
    runDate,
    message: 'Job generation started. Your dashboard will update automatically in ~2 minutes.',
  });
}

async function handleSyncTrigger(uid: string, req: VercelRequest, res: VercelResponse) {
  const db = getAdminDb();
  const runDate = getCronRunDateIST();
  const baseUrl = getBaseUrl(req);
  const callAI = makeServerCallAI();

  const result = await processUserCronRun(
    { userId: uid, runDate },
    {
      loadUser: async (userId) => {
        const snap = await db.collection('users').doc(userId).get();
        return snap.exists ? { id: snap.id, data: snap.data() || {} } : null;
      },
      getExistingRun: async (runId) => {
        const snap = await db.collection('cronRuns').doc(runId).get();
        return snap.exists ? ({ id: snap.id, ...snap.data() } as any) : null;
      },
      markRun: async (runId, patch) => {
        await db.collection('cronRuns').doc(runId).set(
          { userId: uid, runDate, dispatchSource: 'user-triggered', ...patch },
          { merge: true }
        );
      },
      generateJobs: async (profile, limit) => {
        const careerPaths: string[] = profile.careerPaths || [];
        const resumeText: string = profile.resumeText || '';
        const jobType: string = profile.jobType || 'both';
        const location: string = profile.location || '';
        const seenFingerprints: string[] = profile.seenJobFingerprints || [];

        const { jobs: discovered } = await researchJobs(
          { careerPaths, resumeText, jobType, location, targetCount: 30 },
          callAI
        );

        if (discovered.length === 0) {
          return { jobs: [], requestedLimit: limit, usedBackfill: false, totalValidatedJobs: 0, unseenCount: 0, seenCount: 0 };
        }

        const matchResult = await matchAndRankJobs(
          discovered,
          { careerPaths, resumeText, jobType, seenFingerprints, limit },
          callAI
        );

        return {
          jobs: matchResult.jobs,
          requestedLimit: limit,
          usedBackfill: matchResult.usedFallback,
          totalValidatedJobs: matchResult.scoredCount,
          unseenCount: matchResult.scoredCount,
          seenCount: 0,
        };
      },
      storeJobs: async (userId, date, profile, generated) => {
        const fetchedAt = new Date().toISOString();
        const jobs: DailyJob[] = generated.jobs || [];

        const newFingerprints = jobs.map((j) => jobFingerprint(j.title, j.company));
        const nextFingerprints = [
          ...new Set([...(profile.seenJobFingerprints || []), ...newFingerprints]),
        ].slice(-MAX_SEEN_FINGERPRINTS);

        await db.collection('users').doc(userId).set(
          { dailyJobs: jobs, lastJobFetchTime: fetchedAt, seenJobFingerprints: nextFingerprints },
          { merge: true }
        );

        if (jobs.length > 0) {
          const sources: Record<string, number> = {};
          for (const j of jobs) sources[j.source] = (sources[j.source] || 0) + 1;

          await db
            .collection('users').doc(userId)
            .collection('daily_matches').doc(date)
            .set({ userId, date, generatedAt: fetchedAt, jobs, jobCount: jobs.length, sources });
        }
      },
      sendDailyEmail: async (email, jobs) => {
        try {
          const response = await fetch(`${baseUrl}/api/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildDailyJobAlertsEmailPayload(email, jobs)),
          });
          if (!response.ok) console.warn('[jobs/index] Email send failed:', await response.text());
        } catch (err) {
          console.warn('[jobs/index] Email send threw:', err);
        }
      },
    }
  );

  const snap = await db.collection('users').doc(uid).collection('daily_matches').doc(runDate).get();
  const jobs = snap.exists ? (snap.data()?.jobs || []) : [];

  return res.status(200).json({ ...result, jobs });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid: string | null = null;
  try {
    uid = await verifyUser(req);
    if (!uid) return res.status(401).json({ error: 'Missing Authorization header' });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }

  const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim() : 'request';

  try {
    if (mode === 'request') return await handleAsyncDispatch(uid, res);
    if (mode === 'trigger') return await handleSyncTrigger(uid, req, res);
    return res.status(400).json({ error: 'Invalid jobs mode. Use "request" or "trigger".' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[jobs/index] Unexpected failure:', message);
    return res.status(500).json({ error: message });
  }
}
```

- [ ] **Step 2: Delete the superseded jobs route files**

Run:

```bash
rm api/jobs/request.ts api/jobs/trigger.ts
```

Expected: only `api/jobs/index.ts` remains in the jobs route directory.

- [ ] **Step 3: Run a build check for the new merged jobs route**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Verify route count moved down by one**

Run:

```bash
find api -type f -name "*.ts" | sort
```

Expected: jobs routes now contribute one file instead of two.

- [ ] **Step 5: Commit**

```bash
git add api/jobs/index.ts api/jobs/request.ts api/jobs/trigger.ts
git commit -m "refactor(api): merge jobs endpoints for hobby plan"
```

---

### Task 2: Update Dashboard Client To Use The Merged Jobs Endpoint

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`

- [ ] **Step 1: Update the async dispatch call**

In `src/hooks/useDashboardJobs.ts`, replace:

```ts
const requestResponse = await fetch('/api/jobs/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
});
```

with:

```ts
const requestResponse = await fetch('/api/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
  body: JSON.stringify({ mode: 'request' }),
});
```

- [ ] **Step 2: Update the sync fallback call**

Replace:

```ts
const triggerResponse = await fetch('/api/jobs/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
});
```

with:

```ts
const triggerResponse = await fetch('/api/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
  body: JSON.stringify({ mode: 'trigger' }),
});
```

- [ ] **Step 3: Verify there are no stale frontend references**

Run:

```bash
rg "/api/jobs/request|/api/jobs/trigger" src api
```

Expected: no matches.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardJobs.ts
git commit -m "refactor(client): call merged jobs endpoint"
```

---

### Task 3: Merge Blog Endpoints Into `api/blog/index.ts`

**Files:**
- Create: `api/blog/index.ts`
- Delete: `api/blog/post.ts`
- Delete: `api/blog/posts.ts`

- [ ] **Step 1: Create the merged blog route**

Create `api/blog/index.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBlogPostBySlug, listBlogPosts } from '../../src/server/marketingEngine.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';

    if (slug) {
      const post = await getBlogPostBySlug(slug);
      if (!post) return res.status(404).json({ error: 'Post not found' });

      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
      return res.status(200).json({ post });
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const posts = await listBlogPosts(limit);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}
```

- [ ] **Step 2: Delete the superseded blog route files**

Run:

```bash
rm api/blog/post.ts api/blog/posts.ts
```

Expected: only `api/blog/index.ts` and `api/blog/seed-strategy.ts` remain in the blog route directory.

- [ ] **Step 3: Verify no stale code references the old blog routes**

Run:

```bash
rg "api/blog/post|api/blog/posts|/api/blog/post|/api/blog/posts" src api
```

Expected: no matches, or only documentation files if they exist outside runtime code.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/blog/index.ts api/blog/post.ts api/blog/posts.ts
git commit -m "refactor(api): merge blog endpoints for hobby plan"
```

---

### Task 4: Final Verification, Count Check, And Push

**Files:**
- Verify: `api/`
- Verify: `src/hooks/useDashboardJobs.ts`

- [ ] **Step 1: Confirm final API route count is 12**

Run:

```bash
find api -type f -name "*.ts" | sort | wc -l
find api -type f -name "*.ts" | sort
```

Expected: `12` route files.

- [ ] **Step 2: Run the production build one final time**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Review final diff**

Run:

```bash
git status --short
git diff --stat HEAD~3..HEAD
```

Expected: only the endpoint merges, client update, and plan/spec docs from this work.

- [ ] **Step 4: Create the final consolidation commit if needed**

If any work remains uncommitted, run:

```bash
git add -A
git commit -m "refactor(api): reduce hobby route count to twelve"
```

Expected: clean working tree.

- [ ] **Step 5: Push**

```bash
git push origin main
```

Expected: branch `main` updated on GitHub.

---

## Self-Review

**Spec coverage**
- Merge jobs endpoints: covered by Task 1.
- Update dashboard to the merged jobs route: covered by Task 2.
- Merge blog endpoints: covered by Task 3.
- Verify route count is exactly 12: covered by Task 4.
- Keep scope minimal: no admin or cron merges included.

**Placeholder scan**
- No `TODO`, `TBD`, or vague "adjust as needed" instructions remain.
- All commands, file paths, and code snippets are explicit.

**Type consistency**
- Merged jobs route uses `mode: 'request' | 'trigger'`, matching the client payload changes.
- Merged blog route preserves `posts` list and single `post` detail response shapes.
