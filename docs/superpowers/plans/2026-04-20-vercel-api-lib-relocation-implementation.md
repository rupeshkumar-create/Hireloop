# Vercel API Helper Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move non-route server helpers and their test out of `api/` so Vercel Hobby counts only real serverless route handlers.

**Architecture:** Keep all HTTP entrypoints under `api/` and relocate reusable server-only modules into `src/server/`. Update route imports to point at the new server module paths, then verify the moved Firebase Admin test and the production build still pass.

**Tech Stack:** TypeScript, Vercel serverless functions, Firebase Admin SDK, Vitest, Vite

---

## File Map

**Create**
- `src/server/firebaseAdmin.ts`
- `src/server/cronAuth.ts`
- `src/server/marketingEngine.ts`
- `src/server/__tests__/firebaseAdmin.test.ts`

**Modify**
- `api/jobs/request.ts`
- `api/jobs/trigger.ts`
- `api/cron/daily-alerts.ts`
- `api/cron/process-user.ts`
- `api/cron/daily-blog.ts`
- `api/cron/weekly-analysis.ts`
- `api/blog/post.ts`
- `api/blog/posts.ts`
- `api/blog/seed-strategy.ts`
- `api/admin/bootstrap.ts`
- `api/admin/users.ts`

**Delete**
- `api/_lib/firebaseAdmin.ts`
- `api/_lib/cronAuth.ts`
- `api/_lib/marketingEngine.ts`
- `api/_lib/firebaseAdmin.test.ts`

---

### Task 1: Relocate Firebase Admin Helper And Test

**Files:**
- Create: `src/server/firebaseAdmin.ts`
- Create: `src/server/__tests__/firebaseAdmin.test.ts`
- Delete: `api/_lib/firebaseAdmin.ts`
- Delete: `api/_lib/firebaseAdmin.test.ts`
- Test: `src/server/__tests__/firebaseAdmin.test.ts`

- [ ] **Step 1: Move the Firebase Admin runtime helper**

Run:

```bash
mkdir -p src/server src/server/__tests__
mv api/_lib/firebaseAdmin.ts src/server/firebaseAdmin.ts
```

Expected: `src/server/firebaseAdmin.ts` exists and `api/_lib/firebaseAdmin.ts` no longer exists.

- [ ] **Step 2: Move the Firebase Admin test file**

Run:

```bash
mv api/_lib/firebaseAdmin.test.ts src/server/__tests__/firebaseAdmin.test.ts
```

Expected: `src/server/__tests__/firebaseAdmin.test.ts` exists and `api/_lib/firebaseAdmin.test.ts` no longer exists.

- [ ] **Step 3: Update the moved test import**

In `src/server/__tests__/firebaseAdmin.test.ts`, replace:

```ts
const { getAdminDb } = await import('./firebaseAdmin');
```

with:

```ts
const { getAdminDb } = await import('../firebaseAdmin');
```

Apply the same `./firebaseAdmin` -> `../firebaseAdmin` replacement for every dynamic import in that test file.

- [ ] **Step 4: Run the Firebase Admin test**

Run:

```bash
npx vitest run src/server/__tests__/firebaseAdmin.test.ts
```

Expected: PASS with all Firebase Admin helper tests green.

- [ ] **Step 5: Commit**

```bash
git add src/server/firebaseAdmin.ts src/server/__tests__/firebaseAdmin.test.ts api/_lib/firebaseAdmin.ts api/_lib/firebaseAdmin.test.ts
git commit -m "refactor(server): move firebase admin helper out of api"
```

---

### Task 2: Relocate Cron Auth Helper And Update Its Route Imports

**Files:**
- Create: `src/server/cronAuth.ts`
- Modify: `api/cron/daily-alerts.ts`
- Modify: `api/cron/process-user.ts`
- Modify: `api/cron/daily-blog.ts`
- Modify: `api/cron/weekly-analysis.ts`
- Modify: `api/blog/seed-strategy.ts`
- Delete: `api/_lib/cronAuth.ts`

- [ ] **Step 1: Move the cron auth helper**

Run:

```bash
mv api/_lib/cronAuth.ts src/server/cronAuth.ts
```

Expected: `src/server/cronAuth.ts` exists and `api/_lib/cronAuth.ts` is removed.

- [ ] **Step 2: Update cron route imports**

Apply these exact import changes:

```ts
// api/cron/daily-alerts.ts
import { requireCronSecret } from '../../src/server/cronAuth.js';

// api/cron/process-user.ts
import { requireInternalCronSecret } from '../../src/server/cronAuth.js';

// api/cron/daily-blog.ts
import { requireCronSecret } from '../../src/server/cronAuth.js';

// api/cron/weekly-analysis.ts
import { requireCronSecret } from '../../src/server/cronAuth.js';

// api/blog/seed-strategy.ts
import { requireCronSecret } from '../../src/server/cronAuth.js';
```

- [ ] **Step 3: Verify there are no stale `cronAuth` imports**

Run:

```bash
rg "../_lib/cronAuth|./_lib/cronAuth|_lib/cronAuth" api
```

Expected: no matches.

- [ ] **Step 4: Run a quick type-safe build check**

Run:

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 5: Commit**

```bash
git add src/server/cronAuth.ts api/cron/daily-alerts.ts api/cron/process-user.ts api/cron/daily-blog.ts api/cron/weekly-analysis.ts api/blog/seed-strategy.ts api/_lib/cronAuth.ts
git commit -m "refactor(server): move cron auth helper out of api"
```

---

### Task 3: Relocate Marketing Engine And Update Consumers

**Files:**
- Create: `src/server/marketingEngine.ts`
- Modify: `api/cron/daily-blog.ts`
- Modify: `api/cron/weekly-analysis.ts`
- Modify: `api/blog/seed-strategy.ts`
- Modify: `api/blog/post.ts`
- Modify: `api/blog/posts.ts`
- Delete: `api/_lib/marketingEngine.ts`

- [ ] **Step 1: Move the marketing engine**

Run:

```bash
mv api/_lib/marketingEngine.ts src/server/marketingEngine.ts
```

Expected: `src/server/marketingEngine.ts` exists and `api/_lib/marketingEngine.ts` is removed.

- [ ] **Step 2: Keep its internal Firebase import correct**

In `src/server/marketingEngine.ts`, ensure this import exists:

```ts
import { getAdminDb } from './firebaseAdmin.js';
```

Expected: no import path change is needed inside the moved file beyond confirming this line stays relative to `src/server/`.

- [ ] **Step 3: Update all marketing-engine route imports**

Apply these exact import changes:

```ts
// api/cron/daily-blog.ts
import { generateAndPublishPost } from '../../src/server/marketingEngine.js';

// api/cron/weekly-analysis.ts
import { loadStrategy, initializeStrategy, runWeeklyAnalysis } from '../../src/server/marketingEngine.js';

// api/blog/seed-strategy.ts
import { loadStrategy, initializeStrategy, runWeeklyAnalysis } from '../../src/server/marketingEngine.js';

// api/blog/post.ts
import { getBlogPostBySlug } from '../../src/server/marketingEngine.js';

// api/blog/posts.ts
import { listBlogPosts } from '../../src/server/marketingEngine.js';
```

- [ ] **Step 4: Verify there are no stale `marketingEngine` imports**

Run:

```bash
rg "../_lib/marketingEngine|./_lib/marketingEngine|_lib/marketingEngine" api src
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add src/server/marketingEngine.ts api/cron/daily-blog.ts api/cron/weekly-analysis.ts api/blog/seed-strategy.ts api/blog/post.ts api/blog/posts.ts api/_lib/marketingEngine.ts
git commit -m "refactor(server): move marketing engine out of api"
```

---

### Task 4: Update Firebase Admin Route Imports

**Files:**
- Modify: `api/jobs/request.ts`
- Modify: `api/jobs/trigger.ts`
- Modify: `api/cron/daily-alerts.ts`
- Modify: `api/cron/process-user.ts`
- Modify: `api/admin/bootstrap.ts`
- Modify: `api/admin/users.ts`

- [ ] **Step 1: Update job route imports**

Apply these exact import changes:

```ts
// api/jobs/request.ts
import { getAdminAuth } from '../../src/server/firebaseAdmin.js';

// api/jobs/trigger.ts
import { getAdminDb, getAdminAuth } from '../../src/server/firebaseAdmin.js';
```

- [ ] **Step 2: Update cron route imports**

Apply these exact import changes:

```ts
// api/cron/daily-alerts.ts
import { getAdminDb } from '../../src/server/firebaseAdmin.js';

// api/cron/process-user.ts
import { getAdminDb } from '../../src/server/firebaseAdmin.js';
```

- [ ] **Step 3: Update admin route imports**

Apply these exact import changes:

```ts
// api/admin/bootstrap.ts
import { getAdminAuth } from '../../src/server/firebaseAdmin.js';

// api/admin/users.ts
import { getAdminAuth, getAdminDb } from '../../src/server/firebaseAdmin.js';
```

- [ ] **Step 4: Verify there are no stale `firebaseAdmin` imports**

Run:

```bash
rg "../_lib/firebaseAdmin|./_lib/firebaseAdmin|_lib/firebaseAdmin" api src
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add api/jobs/request.ts api/jobs/trigger.ts api/cron/daily-alerts.ts api/cron/process-user.ts api/admin/bootstrap.ts api/admin/users.ts
git commit -m "refactor(server): update api imports for moved helpers"
```

---

### Task 5: Verify Vercel-Facing Layout And Final Safety Checks

**Files:**
- Verify: `api/`
- Verify: `src/server/`
- Test: `src/server/__tests__/firebaseAdmin.test.ts`

- [ ] **Step 1: Confirm `api/` no longer contains the moved helper or test files**

Run:

```bash
find api -maxdepth 2 -type f | sort
```

Expected: no `api/_lib/firebaseAdmin.ts`, no `api/_lib/cronAuth.ts`, no `api/_lib/marketingEngine.ts`, and no `api/_lib/firebaseAdmin.test.ts`.

- [ ] **Step 2: Run the targeted moved-module test again**

Run:

```bash
npx vitest run src/server/__tests__/firebaseAdmin.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Check the final git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only the relocation, import updates, and file deletions/additions from this plan.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "refactor(server): move non-route helpers out of api"
git push origin main
```

Expected: clean working tree after push.

---

## Self-Review

**Spec coverage**
- Move all four non-route files out of `api/`: covered by Tasks 1, 2, and 3.
- Update all affected imports: covered by Tasks 2, 3, and 4.
- Test that nothing else breaks: covered by Tasks 1 and 5.
- Commit and push to GitHub: covered by Task 5.

**Placeholder scan**
- No `TODO`, `TBD`, or vague "update as needed" instructions remain.
- All touched files and commands are explicit.

**Type consistency**
- All new runtime imports point to `../../src/server/*.js`.
- The moved Vitest file imports `../firebaseAdmin`, matching its new directory.
