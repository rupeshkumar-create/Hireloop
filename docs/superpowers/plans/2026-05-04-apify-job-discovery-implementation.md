# Apify Job Discovery + Career Path Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current feed-based job discovery with Apify (Fantastic.jobs “Career Site Job Listing API”) as the primary discovery source and add “top 3 career path suggestions” stored per user.

**Architecture:** Add an Apify adapter that calls the Apify `run-sync-get-dataset-items` endpoint, normalize dataset items into the existing `DiscoveredJob` contract, and wire Apify into `researchJobs()`. Add a career-path suggestions record in `users/{uid}` and a selected career path ID; use it to shape Apify filters and matching context.

**Tech Stack:** TypeScript, Vercel Serverless Functions, Firebase Admin/Firestore, Vitest, OpenRouter via `/api/openai`.

---

## File structure (new + modified)

**Create**
- `src/services/jobSources/apifyCareerSite.ts` (Apify HTTP client + minimal schema types)
- `src/services/__tests__/apifyCareerSite.test.ts` (unit tests for Apify adapter + normalization)
- `src/services/__tests__/careerPathSuggestions.test.ts` (unit tests for suggestion storage logic)

**Modify**
- `src/services/jobResearcher.ts` (add Apify mode to `researchJobs`, normalization wiring)
- `api/cron/process-user.ts` (read selected career path and pass into research/matching; ensure suggestions exist)
- `src/services/aiService.ts` (add a new “top 3 suggestions” generator using the `career_path_suggestion` model route)
- `src/contexts/AuthContext.tsx` (extend profile type + load/store new fields)
- `src/pages/Settings.tsx` (minimal selector UI for suggested career path)
- `.env.example` (add `APIFY_API_TOKEN` + `JOB_DISCOVERY_MODE`)
- `DATABASE_SCHEMA.md` (document new user fields)

---

### Task 1: Add Apify adapter (server-only) + dataset item normalization helpers

**Files:**
- Create: `src/services/jobSources/apifyCareerSite.ts`
- Test: `src/services/__tests__/apifyCareerSite.test.ts`

- [ ] **Step 1: Create the Apify adapter module**

Add:

```ts
export type ApifyTimeRange = '1h' | '24h' | '7d' | '6m';
export type ApifyDescriptionType = 'text' | 'html';
export type ApifyAts =
  | 'greenhouse'
  | 'lever.co'
  | 'ashby'
  | 'workday'
  | 'workable'
  | 'smartrecruiters'
  | 'icims'
  | 'successfactors'
  | 'personio'
  | 'jobvite'
  | 'taleo'
  | 'other';

export type ApifyWorkArrangement = 'On-site' | 'Hybrid' | 'Remote OK' | 'Remote Solely';

export type ApifyCareerSiteInput = {
  timeRange: ApifyTimeRange;
  limit: number;
  includeAi: boolean;
  descriptionType: ApifyDescriptionType;
  ats?: string[];
  titleSearch?: string[];
  titleExclusionSearch?: string[];
  descriptionSearch?: string[];
  descriptionExclusionSearch?: string[];
  organizationSearch?: string[];
  organizationExclusionSearch?: string[];
  locationSearch?: string[];
  locationExclusionSearch?: string[];
  aiWorkArrangementFilter?: ApifyWorkArrangement[];
};

export type ApifyCareerSiteItem = Record<string, unknown>;

const ACTOR_ID = 'fantastic-jobs~career-site-job-listing-api';
const RUN_SYNC_ITEMS_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

export function requireApifyToken(token: string | undefined): string {
  const value = (token || '').trim();
  if (!value) {
    throw new Error('Server Configuration Error: Missing APIFY_API_TOKEN environment variable.');
  }
  return value;
}

export async function runCareerSiteActor(input: ApifyCareerSiteInput, token: string): Promise<ApifyCareerSiteItem[]> {
  const url = new URL(RUN_SYNC_ITEMS_URL);
  url.searchParams.set('token', token);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Apify Actor failed with HTTP ${response.status}${text ? `: ${text}` : ''}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

export function pickString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function pickStringArray(item: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      const strings = value.filter((v) => typeof v === 'string').map((v) => (v as string).trim()).filter(Boolean);
      if (strings.length > 0) return strings;
    }
  }
  return [];
}
```

- [ ] **Step 2: Add normalization to `DiscoveredJob` (pure helper)**

Add:

```ts
export type NormalizedApifyJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  postedAt: string;
  salary: string;
  workTypeHint: string;
  requirements: string[];
};

export function normalizeApifyItem(item: ApifyCareerSiteItem): NormalizedApifyJob | null {
  const record = item as Record<string, unknown>;
  const title = pickString(record, ['title', 'jobTitle', 'positionTitle', 'name']);
  const company = pickString(record, ['company', 'companyName', 'organization', 'organizationName']);
  const location = pickString(record, ['location', 'jobLocation', 'city', 'locationText']);
  const description = pickString(record, ['description', 'jobDescription', 'descriptionText', 'text', 'body']);
  const applyUrl = pickString(record, ['applyUrl', 'applicationUrl', 'url', 'jobUrl', 'detailUrl']);
  const postedAt = pickString(record, ['postedAt', 'datePosted', 'datePostedAt', 'createdAt', 'publishedAt']);
  const salary = pickString(record, ['salary', 'salaryText', 'rawSalary', 'aiSalary']);
  const requirements = pickStringArray(record, ['requirements', 'skills', 'aiSkills', 'aiRequirements']);
  const workTypeHint = pickString(record, ['workArrangement', 'workType', 'aiWorkArrangement', 'employmentType']);

  if (!title || !company || !description || description.length < 30 || !applyUrl.startsWith('http')) return null;

  return {
    title,
    company,
    location: location || 'Remote',
    description,
    applyUrl,
    postedAt: postedAt || new Date().toISOString(),
    salary,
    requirements,
    workTypeHint,
  };
}
```

- [ ] **Step 3: Write unit tests for Apify adapter + normalization**

Create `src/services/__tests__/apifyCareerSite.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeApifyItem, runCareerSiteActor, requireApifyToken } from '../jobSources/apifyCareerSite';

describe('apifyCareerSite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requireApifyToken throws on empty', () => {
    expect(() => requireApifyToken('')).toThrow(/APIFY_API_TOKEN/);
  });

  it('normalizeApifyItem returns null when missing required fields', () => {
    expect(normalizeApifyItem({ title: 'Engineer' })).toBeNull();
  });

  it('normalizeApifyItem accepts valid item', () => {
    const normalized = normalizeApifyItem({
      title: 'Frontend Engineer',
      companyName: 'Acme',
      descriptionText: 'A'.repeat(80),
      jobUrl: 'https://example.com/jobs/1',
      datePosted: '2026-05-01T00:00:00.000Z',
    });
    expect(normalized?.title).toBe('Frontend Engineer');
    expect(normalized?.company).toBe('Acme');
    expect(normalized?.applyUrl).toBe('https://example.com/jobs/1');
  });

  it('runCareerSiteActor returns array response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => [{ title: 'X' }],
    } as any);

    const items = await runCareerSiteActor(
      { timeRange: '7d', limit: 10, includeAi: true, descriptionType: 'text' },
      'token'
    );
    expect(items).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: PASS (new Apify tests included).

- [ ] **Step 5: Commit**

```bash
git add src/services/jobSources/apifyCareerSite.ts src/services/__tests__/apifyCareerSite.test.ts
git commit -m "feat: add apify career-site adapter"
```

---

### Task 2: Wire Apify into `researchJobs()` (Option A replacement) + env toggle

**Files:**
- Modify: `src/services/jobResearcher.ts`
- Modify: `.env.example`
- Test: `src/services/__tests__/apifyCareerSite.test.ts` (extend)

- [ ] **Step 1: Add discovery mode + env helpers**

In `src/services/jobResearcher.ts`, add:

```ts
type DiscoveryMode = 'apify' | 'feeds';

function getDiscoveryMode(): DiscoveryMode {
  const raw = getEnvValue('JOB_DISCOVERY_MODE').trim().toLowerCase();
  return raw === 'feeds' ? 'feeds' : 'apify';
}
```

- [ ] **Step 2: Add Apify fetch path in `researchJobs()`**

Update `researchJobs()` to:

```ts
import { normalizeApifyItem, requireApifyToken, runCareerSiteActor } from './jobSources/apifyCareerSite';

function mapAtsAllowlistToApifyAts(profileAts: Array<'greenhouse' | 'lever'>): string[] {
  const mapped = profileAts.map((ats) => (ats === 'lever' ? 'lever.co' : 'greenhouse'));
  return Array.from(new Set(mapped));
}

function apifyTitleSearch(careerPaths: string[]): string[] {
  return careerPaths.map((value) => value.trim()).filter(Boolean).slice(0, 10);
}

function apifyWorkArrangement(jobType: string | undefined): Array<'Remote OK' | 'Remote Solely' | 'Hybrid' | 'On-site'> | undefined {
  if (jobType === 'remote') return ['Remote OK', 'Remote Solely'];
  if (jobType === 'hybrid') return ['Hybrid', 'Remote OK'];
  if (jobType === 'onsite') return ['On-site'];
  return undefined;
}
```

Then in `researchJobs()`:

```ts
  const target = opts.targetCount ?? 60;
  const mode = getDiscoveryMode();

  if (mode === 'apify') {
    const token = requireApifyToken(getEnvValue('APIFY_API_TOKEN'));
    const items = await runCareerSiteActor(
      {
        timeRange: '7d',
        limit: Math.min(5000, Math.max(10, target)),
        includeAi: true,
        descriptionType: 'text',
        ats: opts.jobType ? mapAtsAllowlistToApifyAts(['greenhouse', 'lever']) : mapAtsAllowlistToApifyAts(['greenhouse', 'lever']),
        titleSearch: apifyTitleSearch(opts.careerPaths || []),
        aiWorkArrangementFilter: apifyWorkArrangement(opts.jobType),
      },
      token
    );

    const allJobs = items
      .map(normalizeApifyItem)
      .filter((job): job is NonNullable<typeof job> => job !== null)
      .map((job) => {
        const postedAt = parseDate(job.postedAt);
        const workType = detectWorkType(`${job.workTypeHint} ${job.location} ${job.title} ${job.description}`);
        const normalized: DiscoveredJob = {
          fingerprint: jobFingerprint(cleanTitle(job.title), job.company),
          title: cleanTitle(job.title),
          company: job.company,
          location: job.location,
          workType,
          salary: job.salary,
          description: stripHtml(job.description),
          requirements: job.requirements.length ? job.requirements.slice(0, 8) : extractRequirements(job.description),
          source: 'apify',
          applyUrl: job.applyUrl,
          postedAt,
          daysOld: daysOld(postedAt),
        };
        return normalized;
      });

    const { jobs, deduplicated } = deduplicateJobs(allJobs);
    const selected = jobs.sort((a, b) => a.daysOld - b.daysOld).slice(0, target);

    return {
      jobs: selected,
      sources: { apify: selected.length },
      totalFound: allJobs.length,
      deduplicated,
    };
  }
```

Keep the existing feed-based flow as the `mode === 'feeds'` branch.

- [ ] **Step 3: Add env vars to `.env.example`**

Append:

```env
# Apify (Backend job discovery)
APIFY_API_TOKEN="your_apify_api_token_here"

# apify (default) or feeds (legacy)
JOB_DISCOVERY_MODE="apify"
```

- [ ] **Step 4: Extend test to cover env-mode branching**

Add a test that sets `process.env.JOB_DISCOVERY_MODE = 'apify'` and stubs `process.env.APIFY_API_TOKEN = 'token'`, then asserts `researchJobs()` returns `source: 'apify'`.

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/jobResearcher.ts .env.example src/services/__tests__/apifyCareerSite.test.ts
git commit -m "feat: use apify as primary job discovery source"
```

---

### Task 3: Persist “top 3 career path suggestions” and selection in user profile

**Files:**
- Modify: `src/services/aiService.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Test: `src/services/__tests__/careerPathSuggestions.test.ts`
- Modify: `DATABASE_SCHEMA.md`

- [ ] **Step 1: Add a typed suggestion output and generator in `aiService.ts`**

Add:

```ts
export type CareerPathSuggestion = {
  id: string;
  title: string;
  rationale: string;
  queryHints: string[];
};

export async function generateCareerPathSuggestions(
  resumeText: string,
  antiSlopEnabled: boolean = true
): Promise<CareerPathSuggestion[]> {
  const prompt = `You are a career counselor. Based on this resume, propose 3 target remote career paths.

Rules:
- Each title must be a realistic job title the candidate can pursue.
- Provide a short rationale grounded in the resume. Do not invent experience.
- Provide 3-6 query hints (keywords) per path for job search targeting.

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume:
${resumeText.substring(0, 3000)}

Return JSON:
{
  "suggestions": [
    { "id": "frontend", "title": "Frontend Engineer", "rationale": "...", "queryHints": ["react", "typescript"] }
  ]
}
Respond ONLY with JSON.`;

  const response = await callOpenAI(
    [{ role: 'user', content: prompt }],
    { type: 'json_object' },
    'openai/gpt-4o-mini'
  );

  const content = response?.choices?.[0]?.message?.content;
  if (!content) return [];
  const parsed = JSON.parse(content);
  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  return suggestions
    .filter((s: any) => s && typeof s.title === 'string')
    .slice(0, 3)
    .map((s: any, index: number) => ({
      id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `path-${index + 1}`,
      title: String(s.title || '').trim(),
      rationale: typeof s.rationale === 'string' ? s.rationale.trim() : '',
      queryHints: Array.isArray(s.queryHints)
        ? s.queryHints.filter((v: any) => typeof v === 'string').map((v: string) => v.trim()).filter(Boolean).slice(0, 6)
        : [],
    }))
    .filter((s: CareerPathSuggestion) => s.title.length > 0);
}
```

Leave the existing `suggestCareerPaths()` in place for compatibility, but switch resume parsing to prefer the new suggestion method in a later task.

- [ ] **Step 2: Document new fields in `DATABASE_SCHEMA.md`**

Add under `users/{uid}`:

```md
#### career path targeting

- `careerPathSuggestions: { id: string; title: string; rationale: string; queryHints: string[] }[]`
- `selectedCareerPathId: string`
- `careerPathGeneratedAt: string`
```

- [ ] **Step 3: Add a focused unit test for parsing/shape**

Create `src/services/__tests__/careerPathSuggestions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { generateCareerPathSuggestions } from '../aiService';

describe('generateCareerPathSuggestions', () => {
  it('returns empty array on invalid JSON', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not-json' } }],
      }),
    } as any);

    await expect(generateCareerPathSuggestions('resume')).resolves.toEqual([]);
  });
});
```

Then extend with a happy-path test by returning valid JSON.

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiService.ts src/services/__tests__/careerPathSuggestions.test.ts DATABASE_SCHEMA.md
git commit -m "feat: add top-3 career path suggestions generator"
```

---

### Task 4: Ensure suggestions exist server-side and apply selected career path in cron discovery

**Files:**
- Modify: `api/cron/process-user.ts`

- [ ] **Step 1: Ensure `careerPathSuggestions` exists**

In `generateJobs` inside `api/cron/process-user.ts`, before calling `researchJobs()`:

```ts
import { generateCareerPathSuggestions } from '../../src/services/aiService';
```

Add logic:

```ts
          const resumeText: string = profile.resumeText || '';
          const existingSuggestions = Array.isArray(profile.careerPathSuggestions)
            ? profile.careerPathSuggestions
            : [];

          if (existingSuggestions.length === 0 && resumeText.trim().length > 50) {
            const suggestions = await generateCareerPathSuggestions(resumeText, profile.antiSlopEnabled !== false);
            if (suggestions.length > 0) {
              const selectedCareerPathId =
                typeof profile.selectedCareerPathId === 'string' && profile.selectedCareerPathId.trim()
                  ? profile.selectedCareerPathId.trim()
                  : suggestions[0].id;

              await db.collection('users').doc(profile.id || userId).set(
                {
                  careerPathSuggestions: suggestions,
                  selectedCareerPathId,
                  careerPathGeneratedAt: new Date().toISOString(),
                },
                { merge: true }
              );

              profile.careerPathSuggestions = suggestions;
              profile.selectedCareerPathId = selectedCareerPathId;
            }
          }
```

- [ ] **Step 2: Use selected career path to set `careerPaths`**

Replace:

```ts
const careerPaths: string[] = profile.careerPaths || [];
```

With:

```ts
          const suggestions = Array.isArray(profile.careerPathSuggestions) ? profile.careerPathSuggestions : [];
          const selectedId = typeof profile.selectedCareerPathId === 'string' ? profile.selectedCareerPathId : '';
          const selected = suggestions.find((s: any) => s?.id === selectedId);
          const careerPaths: string[] = selected?.title ? [selected.title] : (profile.careerPaths || []);
```

This keeps backward compatibility with existing `careerPaths` while allowing “single selected path” mode.

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/cron/process-user.ts
git commit -m "feat: apply selected career path to cron job discovery"
```

---

### Task 5: Add minimal Settings UI for selecting a suggested career path

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Extend loaded profile shape**

In `AuthContext.tsx`, ensure the `profile` state includes:
- `careerPathSuggestions?: { id: string; title: string; rationale?: string; queryHints?: string[] }[]`
- `selectedCareerPathId?: string`

When saving via `updateProfile`, these fields should be merged like the rest of the profile fields.

- [ ] **Step 2: Add selector UI**

In `Settings.tsx`, add a new section above “Career Paths / Desired Titles”:

- If `profile.careerPathSuggestions` exists and length > 0:
  - Render a `<select>` bound to `selectedCareerPathId`
  - Show the selected suggestion’s rationale + query hints below
  - Save `selectedCareerPathId` via `updateProfile` in `handleSave`

Use existing Button/Input styles; do not introduce new components.

- [ ] **Step 3: Run build + tests**

Run:
- `npm run lint`
- `npm run test`
- `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx src/contexts/AuthContext.tsx
git commit -m "feat: allow selecting suggested career path"
```

---

### Task 6: Verification + safety checks (no token leaks)

**Files:**
- Review only: entire repo diff

- [ ] **Step 1: Scan for token strings**

Run: `git grep -n "apify_api_" || true`
Expected: no matches.

- [ ] **Step 2: Run full verification**

Run:
- `npm run lint`
- `npm run test`
- `npm run build`

Expected: all PASS.

- [ ] **Step 3: Manual smoke test**

- Start dev server: `npm run dev`
- In Settings: confirm suggested paths appear (or are generated after resume upload) and selection persists.
- Trigger a cron user run (using existing on-demand endpoint, if available) and confirm discovery source is `apify` in stored `daily_matches`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: apify job discovery with career path targeting"
```

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-04-apify-job-discovery-implementation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?

