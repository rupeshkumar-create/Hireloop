# Phase 6 Self-Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic learning signals for `saved`, `dismissed`, `applied`, and `clicked` job actions, then inject those signals into Scout so future queries avoid disliked terms and boost liked ones.

**Architecture:** Introduce a focused `learningSignals.ts` service that owns keyword extraction, scoring, and Scout query rewriting as pure functions. Wire event capture at the existing product touchpoints in `useDashboardJobs.ts`, `JobTracker.tsx`, `MatchesTab.tsx`, and `JobDetailsPanel.tsx`, then thread structured `learningSignals` into `generateDailyJobs()` so Phase 3 Scout remains the only stage whose behavior changes.

**Tech Stack:** TypeScript, React, Firebase Firestore, Vite, Vitest

---

## File Structure

- Create: `src/services/learningSignals.ts`
- Create: `src/services/__tests__/learningSignals.test.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/pages/JobTracker.tsx`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/components/dashboard/JobDetailsPanel.tsx`
- Modify: `src/services/aiService.ts`
- Modify: `src/services/__tests__/phase3ScoutHarvester.test.ts`

Each file has one clear role:

- `learningSignals.ts`: pure deterministic keyword extraction, signal updates, and Scout query rewrite helpers
- `learningSignals.test.ts`: unit coverage for the deterministic core
- `AuthContext.tsx`: user-profile types for structured learning signals
- `useDashboardJobs.ts`: save, dismiss, and dashboard click learning writes plus fetch-time Scout input
- `JobTracker.tsx`: apply transition and tracked-job click learning writes
- `MatchesTab.tsx`: dismiss affordance on surfaced daily matches
- `JobDetailsPanel.tsx`: route apply/save/dismiss click events through learning-aware handlers
- `aiService.ts`: accept structured learning signals and rewrite Scout queries safely
- `phase3ScoutHarvester.test.ts`: Scout-regression coverage for query injection

### Task 1: Build the Deterministic Learning Core

**Files:**
- Create: `src/services/learningSignals.ts`
- Create: `src/services/__tests__/learningSignals.test.ts`
- Test: `src/services/__tests__/learningSignals.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `src/services/__tests__/learningSignals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyLearningEvent,
  extractLearningKeywords,
  rewriteScoutQueriesWithLearning,
  type LearningSignals,
} from '../learningSignals';

const baseSignals: LearningSignals = {
  likedKeywords: [],
  dislikedKeywords: [],
  keywordScores: {},
  events: {
    saved: 0,
    dismissed: 0,
    applied: 0,
    clicked: 0,
  },
};

describe('extractLearningKeywords', () => {
  it('extracts concrete skill terms and removes generic words', () => {
    const result = extractLearningKeywords({
      title: 'Senior React Engineer',
      company: 'Acme',
      description: 'Build frontend systems with React, TypeScript, GraphQL and performance tuning.',
      requirements: ['React', 'TypeScript', 'GraphQL'],
    });

    expect(result).toContain('react');
    expect(result).toContain('typescript');
    expect(result).toContain('graphql');
    expect(result).not.toContain('engineer');
    expect(result).not.toContain('senior');
    expect(result).not.toContain('remote');
  });
});

describe('applyLearningEvent', () => {
  it('promotes liked keywords from saved and applied events', () => {
    const afterSave = applyLearningEvent(baseSignals, 'saved', {
      title: 'Frontend Engineer',
      company: 'Acme',
      description: 'React and TypeScript work.',
      requirements: ['React', 'TypeScript'],
    });

    const afterApply = applyLearningEvent(afterSave, 'applied', {
      title: 'Frontend Engineer',
      company: 'Acme',
      description: 'React and TypeScript work.',
      requirements: ['React', 'TypeScript'],
    });

    expect(afterApply.keywordScores.react).toBeGreaterThan(afterSave.keywordScores.react);
    expect(afterApply.likedKeywords).toContain('react');
    expect(afterApply.events?.saved).toBe(1);
    expect(afterApply.events?.applied).toBe(1);
  });

  it('promotes disliked keywords from repeated dismissals', () => {
    const once = applyLearningEvent(baseSignals, 'dismissed', {
      title: 'Java Backend Engineer',
      company: 'Globex',
      description: 'Java, Spring Boot, Kafka.',
      requirements: ['Java', 'Spring Boot'],
    });

    const twice = applyLearningEvent(once, 'dismissed', {
      title: 'Java Backend Engineer',
      company: 'Globex',
      description: 'Java, Spring Boot, Kafka.',
      requirements: ['Java', 'Spring Boot'],
    });

    expect(twice.keywordScores.java).toBeLessThan(0);
    expect(twice.dislikedKeywords).toContain('java');
    expect(twice.events?.dismissed).toBe(2);
  });
});

describe('rewriteScoutQueriesWithLearning', () => {
  it('removes disliked optional modifiers and appends liked ones safely', () => {
    const result = rewriteScoutQueriesWithLearning(
      [
        'remote frontend engineer react java site:greenhouse.io',
        'remote software engineer java site:lever.co',
      ],
      {
        likedKeywords: ['typescript'],
        dislikedKeywords: ['java'],
      }
    );

    expect(result[0]).toContain('typescript');
    expect(result[0]).not.toContain(' java ');
    expect(result[1]).toContain('remote');
    expect(result[1]).toMatch(/site:(greenhouse|lever)\.io/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/learningSignals.test.ts
```

Expected: FAIL because `src/services/learningSignals.ts` does not exist yet.

- [ ] **Step 3: Implement the pure helper module**

Create `src/services/learningSignals.ts`:

```ts
export type LearningEventType = 'saved' | 'dismissed' | 'applied' | 'clicked';

export interface LearningEventJob {
  title: string;
  company: string;
  description?: string;
  requirements?: string[];
}

export interface LearningSignals {
  likedKeywords: string[];
  dislikedKeywords: string[];
  keywordScores: Record<string, number>;
  events?: {
    saved: number;
    dismissed: number;
    applied: number;
    clicked: number;
  };
  updatedAt?: string;
}

export interface ScoutLearningContext {
  likedKeywords: string[];
  dislikedKeywords: string[];
}

const STOPWORDS = new Set([
  'remote',
  'engineer',
  'developer',
  'senior',
  'staff',
  'lead',
  'company',
  'team',
  'role',
  'job',
  'great',
]);

const WEIGHTS: Record<LearningEventType, number> = {
  saved: 2,
  dismissed: -2,
  applied: 4,
  clicked: 1,
};

const MAX_TERMS = 10;
const LIKE_THRESHOLD = 3;
const DISLIKE_THRESHOLD = -3;

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractLearningKeywords(job: LearningEventJob): string[] {
  const phrases = [
    ...tokenize(job.title),
    ...tokenize(job.description || ''),
    ...(job.requirements || []).flatMap(tokenize),
  ];

  return Array.from(
    new Set(
      phrases.filter((term) => term.length > 1 && !STOPWORDS.has(term))
    )
  ).slice(0, 12);
}

function sortByStrength(
  scores: Record<string, number>,
  predicate: (value: number) => boolean
): string[] {
  return Object.entries(scores)
    .filter(([, value]) => predicate(value))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, MAX_TERMS)
    .map(([key]) => key);
}

export function applyLearningEvent(
  currentSignals: LearningSignals | undefined,
  eventType: LearningEventType,
  job: LearningEventJob
): LearningSignals {
  const base = currentSignals || {
    likedKeywords: [],
    dislikedKeywords: [],
    keywordScores: {},
    events: { saved: 0, dismissed: 0, applied: 0, clicked: 0 },
  };

  const keywords = extractLearningKeywords(job);
  const keywordScores = { ...base.keywordScores };

  for (const keyword of keywords) {
    keywordScores[keyword] = (keywordScores[keyword] || 0) + WEIGHTS[eventType];
  }

  const events = {
    saved: base.events?.saved || 0,
    dismissed: base.events?.dismissed || 0,
    applied: base.events?.applied || 0,
    clicked: base.events?.clicked || 0,
  };
  events[eventType] += 1;

  return {
    keywordScores,
    likedKeywords: sortByStrength(keywordScores, (value) => value >= LIKE_THRESHOLD),
    dislikedKeywords: sortByStrength(keywordScores, (value) => value <= DISLIKE_THRESHOLD),
    events,
    updatedAt: new Date().toISOString(),
  };
}

export function rewriteScoutQueriesWithLearning(
  queries: string[],
  learning: ScoutLearningContext | undefined
): string[] {
  if (!learning || (learning.likedKeywords.length === 0 && learning.dislikedKeywords.length === 0)) {
    return queries;
  }

  return queries.map((query) => {
    const lowered = ` ${query.toLowerCase()} `;
    let next = query;

    for (const disliked of learning.dislikedKeywords) {
      const token = disliked.toLowerCase();
      if (['remote'].includes(token)) continue;
      next = next.replace(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), '').replace(/\s+/g, ' ').trim();
    }

    const likedToInject = learning.likedKeywords.filter((term) => !lowered.includes(` ${term.toLowerCase()} `)).slice(0, 2);
    for (const liked of likedToInject) {
      if (!next.includes('site:')) continue;
      next = `${next} "${liked}"`.replace(/\s+/g, ' ').trim();
    }

    const safe = next.trim();
    return safe.length >= 20 ? safe : query;
  });
}
```

- [ ] **Step 4: Run the deterministic unit tests**

Run:

```bash
npm test -- src/services/__tests__/learningSignals.test.ts
```

Expected: PASS with the new helper coverage green.

- [ ] **Step 5: Commit**

```bash
git add src/services/learningSignals.ts src/services/__tests__/learningSignals.test.ts
git commit -m "feat: add deterministic learning signals core"
```

### Task 2: Add Structured Profile Types and Save-Event Plumbing

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/hooks/useDashboardJobs.ts`
- Test: `src/services/__tests__/learningSignals.test.ts`

- [ ] **Step 1: Extend the auth profile types**

Update `src/contexts/AuthContext.tsx`:

```ts
export interface LearningSignals {
  likedKeywords: string[];
  dislikedKeywords: string[];
  keywordScores: Record<string, number>;
  events?: {
    saved: number;
    dismissed: number;
    applied: number;
    clicked: number;
  };
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  careerPaths?: string[];
  jobType?: string;
  location?: string;
  minSalary?: number | null;
  resumeText?: string;
  resumeRaw?: string;
  resumeCleaned?: string;
  resumeSummary?: string;
  structuredProfile?: StructuredProfile;
  preferences?: UserPreferences;
  resumeAnalysis?: ResumeAnalysis;
  plan?: 'free' | 'pro';
  receiveDailyAlerts?: boolean;
  antiSlopEnabled?: boolean;
  dailyJobs?: any[];
  lastJobFetchTime?: string;
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string;
  learningProfile?: LearningProfile;
  learningSignals?: LearningSignals;
}
```

- [ ] **Step 2: Import the pure helper into the dashboard hook**

Update the imports at the top of `src/hooks/useDashboardJobs.ts`:

```ts
import {
  applyLearningEvent,
  type LearningEventJob,
  type LearningSignals,
} from '../services/learningSignals';
```

Add these helpers inside `useDashboardJobs()` above `saveJob`:

```ts
  const persistLearningSignals = async (signals: LearningSignals) => {
    if (!user) return;
    await setDoc(
      doc(db, 'users', user.uid),
      { learningSignals: signals },
      { merge: true }
    );
  };

  const recordLearningEvent = async (
    eventType: 'saved' | 'dismissed' | 'applied' | 'clicked',
    job: LearningEventJob
  ) => {
    const nextSignals = applyLearningEvent(profile?.learningSignals, eventType, job);
    await persistLearningSignals(nextSignals);
    updateProfile({ learningSignals: nextSignals });
  };
```

- [ ] **Step 3: Trigger the `saved` event in `saveJob()`**

Inside `saveJob()` in `src/hooks/useDashboardJobs.ts`, immediately after the successful `addDoc(...)` call, add:

```ts
      try {
        await recordLearningEvent('saved', {
          title: job.title,
          company: job.company,
          description: job.description,
          requirements: job.requirements,
        });
      } catch (learningError) {
        console.error('Failed to record saved-job learning event:', learningError);
      }
```

Keep this block outside the existing AI-assets branch so free users still produce learning signals.

- [ ] **Step 4: Run the learning-signal tests again**

Run:

```bash
npm test -- src/services/__tests__/learningSignals.test.ts
```

Expected: PASS, confirming the dashboard hook changes did not require changing the deterministic helper contract.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AuthContext.tsx src/hooks/useDashboardJobs.ts
git commit -m "feat: persist learning signals on save"
```

### Task 3: Capture `applied` and Tracked-Job `clicked` Events

**Files:**
- Modify: `src/pages/JobTracker.tsx`
- Modify: `src/contexts/AuthContext.tsx`
- Test: `src/services/__tests__/learningSignals.test.ts`

- [ ] **Step 1: Import the helper and add a tracked-job payload mapper**

At the top of `src/pages/JobTracker.tsx`, add:

```ts
import { applyLearningEvent } from '../services/learningSignals';
```

Below the `TrackedJob` interface, add:

```ts
function toLearningEventJob(job: TrackedJob) {
  return {
    title: job.title,
    company: job.company,
    description: job.notes,
    requirements: [],
  };
}
```

- [ ] **Step 2: Guard the `applied` transition**

Replace `updateStatus()` in `src/pages/JobTracker.tsx` with:

```ts
  const updateStatus = async (jobId: string, newStatus: string) => {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    try {
      await updateDoc(doc(db, 'trackedJobs', jobId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      if (newStatus === 'applied' && job.status !== 'applied' && profile && updateProfile) {
        try {
          const nextSignals = applyLearningEvent(
            profile.learningSignals,
            'applied',
            toLearningEventJob(job)
          );
          await updateProfile({ learningSignals: nextSignals });
        } catch (learningError) {
          console.error('Failed to record applied-job learning event:', learningError);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trackedJobs/${jobId}`);
    }
  };
```

- [ ] **Step 3: Centralize tracked-job link opens as `clicked` events**

Add this helper above `sendEmail()` in `src/pages/JobTracker.tsx`:

```ts
  const openTrackedJobLink = async (job: TrackedJob) => {
    if (profile && updateProfile) {
      try {
        const nextSignals = applyLearningEvent(
          profile.learningSignals,
          'clicked',
          toLearningEventJob(job)
        );
        await updateProfile({ learningSignals: nextSignals });
      } catch (learningError) {
        console.error('Failed to record clicked-job learning event:', learningError);
      }
    }

    window.open(job.url, '_blank');
  };
```

Replace each direct `window.open(job.url, '_blank')` usage in `JobTracker.tsx` with:

```ts
onClick={() => openTrackedJobLink(job)}
```

and

```ts
onClick={(e) => {
  e.stopPropagation();
  openTrackedJobLink(job);
}}
```

- [ ] **Step 4: Run the learning helper tests**

Run:

```bash
npm test -- src/services/__tests__/learningSignals.test.ts
```

Expected: PASS, with no helper regressions while wiring tracked-job events.

- [ ] **Step 5: Commit**

```bash
git add src/pages/JobTracker.tsx
git commit -m "feat: learn from applied and clicked tracked jobs"
```

### Task 4: Add Daily-Match `dismissed` and `clicked` Event Capture

**Files:**
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/components/dashboard/MatchesTab.tsx`
- Modify: `src/components/dashboard/JobDetailsPanel.tsx`
- Test: `src/services/__tests__/learningSignals.test.ts`

- [ ] **Step 1: Expose dismiss and click actions from the dashboard hook**

In `src/hooks/useDashboardJobs.ts`, add local session state near the other hook state:

```ts
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([]);
```

Add these helpers below `saveJob()`:

```ts
  const dismissJob = async (job: Job) => {
    setDismissedFingerprints((current) =>
      current.includes(jobFingerprint(job.title, job.company))
        ? current
        : [...current, jobFingerprint(job.title, job.company)]
    );

    try {
      await recordLearningEvent('dismissed', {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      });
    } catch (learningError) {
      console.error('Failed to record dismissed-job learning event:', learningError);
    }
  };

  const trackJobClick = async (job: Job) => {
    try {
      await recordLearningEvent('clicked', {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      });
    } catch (learningError) {
      console.error('Failed to record clicked-job learning event:', learningError);
    }

    window.open(job.url, '_blank');
  };
```

Update `filteredAndSortedJobs` to exclude session-dismissed jobs:

```ts
      .filter((job) => {
        const fingerprint = jobFingerprint(job.title, job.company);
        const notDismissed = !dismissedFingerprints.includes(fingerprint);
        const matchCompany = job.company.toLowerCase().includes(filterCompany.toLowerCase());
        const matchLocation = job.location.toLowerCase().includes(filterLocation.toLowerCase());
        const matchSalary = job.salary.toLowerCase().includes(filterSalary.toLowerCase());
        return notDismissed && matchCompany && matchLocation && matchSalary;
      })
```

Return the new actions from the hook:

```ts
    dismissJob,
    trackJobClick,
```

- [ ] **Step 2: Add dismiss and apply handlers to the daily-match details panel**

Update `src/components/dashboard/JobDetailsPanel.tsx` props:

```ts
interface JobDetailsPanelProps {
  selectedJob: Job;
  saveJob: (j: Job) => void;
  dismissJob: (j: Job) => void;
  trackJobClick: (j: Job) => void;
  handleAiAction: (a: AiActionType, j: Job) => void;
  aiAction: AiActionType;
  aiResult: string | string[];
  actionLoading: boolean;
  downloadResume: (j: Job | null) => void;
  onClose: () => void;
}
```

Update the action row:

```tsx
            <div className="flex gap-3 mb-8">
              <Button
                variant="action"
                className="flex-1 shadow-[0_18px_40px_rgba(201,100,66,0.24)]"
                size="lg"
                onClick={() => trackJobClick(selectedJob)}
              >
                Apply Now <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-border bg-surface"
                onClick={() => saveJob(selectedJob)}
                title="Save to Tracker"
              >
                <BookmarkPlus className="h-5 w-5" /> Save Job
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-foreground-muted"
                onClick={() => {
                  dismissJob(selectedJob);
                  onClose();
                }}
              >
                Not for me
              </Button>
            </div>
```

- [ ] **Step 3: Add a dismiss button to the match cards**

In `src/components/dashboard/MatchesTab.tsx`, update the imports and props:

```ts
import { Loader2, Briefcase, MapPin, DollarSign, Calendar, ArrowUpDown, Plane, X } from 'lucide-react';

interface MatchesTabProps {
  jobs: Job[];
  loadingJobs: boolean;
  fetchJobs: (force?: boolean) => void;
  filterCompany: string;
  setFilterCompany: (v: string) => void;
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  filterSalary: string;
  setFilterSalary: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  selectedJob: Job | null;
  setSelectedJob: (j: Job | null) => void;
  setAiAction: (v: any) => void;
  dismissJob: (j: Job) => void;
}
```

Inside the card header, add:

```tsx
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-foreground font-display text-lg">{job.title}</h3>
                        <p className="text-foreground-muted font-medium">{job.company}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        {job.matchScore !== undefined && (
                          <Badge variant={job.matchScore >= 80 ? 'success' : 'secondary'} className="ml-2 font-semibold">
                            {job.matchScore}% Match
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-foreground-muted"
                          onClick={(event) => {
                            event.stopPropagation();
                            dismissJob(job);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
```

- [ ] **Step 4: Run the deterministic tests**

Run:

```bash
npm test -- src/services/__tests__/learningSignals.test.ts
```

Expected: PASS, confirming the UI wiring still matches the helper contract.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardJobs.ts src/components/dashboard/MatchesTab.tsx src/components/dashboard/JobDetailsPanel.tsx
git commit -m "feat: capture dismiss and click learning events"
```

### Task 5: Inject Learning Signals Into Scout and Cover Rewrites

**Files:**
- Modify: `src/services/aiService.ts`
- Modify: `src/hooks/useDashboardJobs.ts`
- Modify: `src/services/__tests__/phase3ScoutHarvester.test.ts`
- Test: `src/services/__tests__/phase3ScoutHarvester.test.ts`

- [ ] **Step 1: Extend Scout context and daily-job inputs**

At the top of `src/services/aiService.ts`, add:

```ts
import {
  rewriteScoutQueriesWithLearning,
  type ScoutLearningContext,
} from './learningSignals';
```

Update `ScoutContext`:

```ts
interface ScoutContext {
  careerPaths: string[];
  resumeText: string;
  resumeSummary?: string;
  jobType?: string;
  structuredProfile?: {
    skills: string[];
    techStack: string[];
    seniority: string;
    roles: string[];
    industries: string[];
  };
  preferences?: {
    remoteOnly: boolean;
    salaryFloor: number | null;
    locations: string[];
  };
  learningContext?: string;
  learningSignals?: ScoutLearningContext;
  location?: string;
}
```

Update `generateDailyJobs()`:

```ts
export async function generateDailyJobs(
  careerPaths: string[],
  jobType: string,
  minSalary: number | null,
  resumeText: string,
  limit: number = 1,
  seenFingerprints: string[] = [],
  learningContext: string = '',
  location: string = '',
  learningSignals?: ScoutLearningContext
): Promise<GenerateDailyJobsResult> {
```

and set:

```ts
    learningSignals,
```

inside `scoutContext`.

- [ ] **Step 2: Rewrite Scout queries after generation**

In `src/services/aiService.ts`, replace:

```ts
  const queries = await runWithGuardrails(
    'query_generation',
    buildQueries,
    scoutContext
  );
```

with:

```ts
  const generatedQueries = await runWithGuardrails(
    'query_generation',
    buildQueries,
    scoutContext
  );

  const queries = normalizeGeneratedQueries(
    rewriteScoutQueriesWithLearning(
      generatedQueries,
      scoutContext.learningSignals
    )
  );
```

Update the call site in `src/hooks/useDashboardJobs.ts`:

```ts
      const result = await generateDailyJobs(
        profile.careerPaths,
        profile.jobType || 'both',
        profile.minSalary || null,
        profile.resumeText || '',
        limit,
        seenFingerprints,
        profile.learningProfile?.jobPreferences || '',
        profile.location || '',
        profile.learningSignals
      );
```

- [ ] **Step 3: Add Scout-rewrite regression tests**

Append to `src/services/__tests__/phase3ScoutHarvester.test.ts`:

```ts
import { rewriteScoutQueriesWithLearning } from '../learningSignals';

describe('rewriteScoutQueriesWithLearning', () => {
  it('returns original queries when no learning signals exist', () => {
    const queries = ['remote frontend engineer react site:greenhouse.io'];
    expect(rewriteScoutQueriesWithLearning(queries, undefined)).toEqual(queries);
  });

  it('removes disliked modifiers without stripping the role anchor', () => {
    const result = rewriteScoutQueriesWithLearning(
      ['remote frontend engineer react java site:greenhouse.io'],
      {
        likedKeywords: [],
        dislikedKeywords: ['java'],
      }
    );

    expect(result[0]).toContain('frontend engineer');
    expect(result[0]).toContain('remote');
    expect(result[0]).toContain('site:greenhouse.io');
    expect(result[0]).not.toContain('java');
  });

  it('adds up to two liked modifiers when they are absent', () => {
    const result = rewriteScoutQueriesWithLearning(
      ['remote frontend engineer react site:greenhouse.io'],
      {
        likedKeywords: ['typescript', 'graphql', 'next.js'],
        dislikedKeywords: [],
      }
    );

    expect(result[0]).toContain('typescript');
    expect(result[0]).toContain('graphql');
    expect(result[0]).not.toContain('next.js');
  });
});
```

- [ ] **Step 4: Run the Scout-regression tests**

Run:

```bash
npm test -- src/services/__tests__/phase3ScoutHarvester.test.ts
```

Expected: PASS with the new learning-aware Scout coverage green.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiService.ts src/hooks/useDashboardJobs.ts src/services/__tests__/phase3ScoutHarvester.test.ts
git commit -m "feat: inject learning signals into scout"
```

### Task 6: Final Verification

**Files:**
- Modify: `src/services/__tests__/learningSignals.test.ts`
- Modify: `src/services/__tests__/phase3ScoutHarvester.test.ts`
- Test: `src/services/__tests__/learningSignals.test.ts`
- Test: `src/services/__tests__/phase3ScoutHarvester.test.ts`

- [ ] **Step 1: Run the targeted test suite**

Run:

```bash
npm test -- src/services/__tests__/learningSignals.test.ts src/services/__tests__/phase3ScoutHarvester.test.ts
```

Expected: PASS with all deterministic Phase 6 tests green.

- [ ] **Step 2: Check diagnostics for edited files**

Run the IDE diagnostics check for:

```text
src/services/learningSignals.ts
src/hooks/useDashboardJobs.ts
src/pages/JobTracker.tsx
src/components/dashboard/MatchesTab.tsx
src/components/dashboard/JobDetailsPanel.tsx
src/services/aiService.ts
```

Expected: no new TypeScript errors introduced by the Phase 6 changes.

- [ ] **Step 3: Smoke-test the product flow**

Verify manually in the app:

```text
1. Save a daily match and confirm the user profile gets `learningSignals`.
2. Change a tracked job from `saved` to `applied` and confirm only the first transition increments `events.applied`.
3. Open a tracked job URL and confirm `events.clicked` increments.
4. Dismiss a daily match and confirm it disappears from the current list.
5. Refresh matches and confirm Scout still returns valid jobs.
```

- [ ] **Step 4: Commit the verification cleanup**

```bash
git add src/services/__tests__/learningSignals.test.ts src/services/__tests__/phase3ScoutHarvester.test.ts src/services/learningSignals.ts src/hooks/useDashboardJobs.ts src/pages/JobTracker.tsx src/components/dashboard/MatchesTab.tsx src/components/dashboard/JobDetailsPanel.tsx src/services/aiService.ts
git commit -m "test: verify phase 6 self-learning loop"
```

## Self-Review

- Spec coverage:
  - structured `learningSignals` storage: Task 2
  - deterministic event scoring and keyword extraction: Task 1
  - `saved`, `applied`, `clicked`, `dismissed` triggers: Tasks 2, 3, 4
  - Scout injection and safety rules: Task 5
  - focused regression testing: Tasks 1, 5, 6
- Placeholder scan:
  - no `TODO`, `TBD`, or “implement later” placeholders remain
  - every code-changing step includes concrete code
  - every validation step includes an exact command and expected result
- Type consistency:
  - `LearningSignals`, `LearningEventJob`, `LearningEventType`, and `ScoutLearningContext` are defined once in `learningSignals.ts`
  - `generateDailyJobs()` receives `learningSignals` as the final optional argument and `useDashboardJobs.ts` is the matching caller

