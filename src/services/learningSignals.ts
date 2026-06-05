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
  'with',
  'build',
  'using',
  'work',
  'works',
  'from',
  'for',
  'the',
  'and',
]);

const PROTECTED_TERMS = new Set([
  'remote',
  'hybrid',
  'onsite',
  'site:greenhouse.io',
  'site:lever.co',
  'site:ashbyhq.com',
  'site:workable.com',
  'site:jobs.workday.com',
]);

const EVENT_WEIGHTS: Record<LearningEventType, number> = {
  saved: 2,
  dismissed: -2,
  applied: 4,
  clicked: 1,
};

const MAX_KEYWORDS = 10;
const POSITIVE_THRESHOLD = 3;
const NEGATIVE_THRESHOLD = -3;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sortKeywordsByStrength(
  keywordScores: Record<string, number>,
  predicate: (score: number) => boolean
): string[] {
  return Object.entries(keywordScores)
    .filter(([, score]) => predicate(score))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, MAX_KEYWORDS)
    .map(([keyword]) => keyword);
}

export function extractLearningKeywords(job: LearningEventJob): string[] {
  const tokens = [
    ...tokenize(job.title),
    ...tokenize(job.description || ''),
    ...(job.requirements || []).flatMap(tokenize),
  ];

  return Array.from(
    new Set(
      tokens
        .map(normalizeKeyword)
        .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    )
  ).slice(0, 12);
}

export function applyLearningEvent(
  currentSignals: LearningSignals | undefined,
  eventType: LearningEventType,
  job: LearningEventJob
): LearningSignals {
  const baseSignals: LearningSignals = currentSignals || {
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

  const keywordScores = { ...baseSignals.keywordScores };
  const keywords = extractLearningKeywords(job);
  const delta = EVENT_WEIGHTS[eventType];

  for (const keyword of keywords) {
    keywordScores[keyword] = (keywordScores[keyword] || 0) + delta;
  }

  const events = {
    saved: baseSignals.events?.saved || 0,
    dismissed: baseSignals.events?.dismissed || 0,
    applied: baseSignals.events?.applied || 0,
    clicked: baseSignals.events?.clicked || 0,
  };
  events[eventType] += 1;

  return {
    keywordScores,
    likedKeywords: sortKeywordsByStrength(
      keywordScores,
      (score) => score >= POSITIVE_THRESHOLD
    ),
    dislikedKeywords: sortKeywordsByStrength(
      keywordScores,
      (score) => score <= NEGATIVE_THRESHOLD
    ),
    events,
    updatedAt: new Date().toISOString(),
  };
}

export function rewriteScoutQueriesWithLearning(
  queries: string[],
  learningSignals?: ScoutLearningContext
): string[] {
  if (
    !learningSignals ||
    (learningSignals.likedKeywords.length === 0 &&
      learningSignals.dislikedKeywords.length === 0)
  ) {
    return queries;
  }

  return queries.map((query) => {
    const originalQuery = query.trim().replace(/\s+/g, ' ');
    let rewritten = originalQuery;

    for (const dislikedKeyword of learningSignals.dislikedKeywords) {
      const normalized = normalizeKeyword(dislikedKeyword);
      if (!normalized || PROTECTED_TERMS.has(normalized)) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'ig');
      rewritten = rewritten.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
    }

    const currentLower = ` ${rewritten.toLowerCase()} `;
    const likedToInject = learningSignals.likedKeywords
      .map(normalizeKeyword)
      .filter((keyword) => keyword && !currentLower.includes(` ${keyword} `))
      .slice(0, 2);

    if (rewritten.includes('site:')) {
      for (const likedKeyword of likedToInject) {
        rewritten = `${rewritten} "${likedKeyword}"`.replace(/\s+/g, ' ').trim();
      }
    }

    // Keep Scout precision-safe. If the rewrite stripped too much, fall back.
    if (rewritten.length < 20 || !rewritten.includes('site:')) {
      return originalQuery;
    }

    return rewritten;
  });
}
