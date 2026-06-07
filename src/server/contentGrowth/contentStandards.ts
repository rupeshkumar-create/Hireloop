/**
 * Content year and prose normalization for blog posts.
 */
import type { BlogPost } from '../marketingEngine.js';

export const CONTENT_YEAR = 2026;
export const SALARY_SURVEY_SOURCE = `Industry surveys ${CONTENT_YEAR}`;

const PROSE_YEAR_REPLACEMENTS: [RegExp, string][] = [
  [/2025[–-]2026/g, String(CONTENT_YEAR)],
  [/2024[–-]2025/g, String(CONTENT_YEAR)],
  [/2024-2025/g, String(CONTENT_YEAR)],
  [/Industry surveys 2025/g, SALARY_SURVEY_SOURCE],
  [/\bin 2025\b/g, `in ${CONTENT_YEAR}`],
  [/\bfor 2025\b/g, `for ${CONTENT_YEAR}`],
  [/\(2025\)/g, `(${CONTENT_YEAR})`],
  [/2025 Guide/g, `${CONTENT_YEAR} Guide`],
  [/2025 \(Ranked/g, `${CONTENT_YEAR} (Ranked`],
  [/boards 2025/g, `boards ${CONTENT_YEAR}`],
  [/tips 2025/g, `tips ${CONTENT_YEAR}`],
  [/salary 2025/g, `salary ${CONTENT_YEAR}`],
  [/search 2025/g, `search ${CONTENT_YEAR}`],
  [/companies 2025/g, `companies ${CONTENT_YEAR}`],
  [/trends in 2025/g, `trends in ${CONTENT_YEAR}`],
  [/right now \(2025\)/g, `right now (${CONTENT_YEAR})`],
  [/statistics \(2024-2025\)/g, `statistics (${CONTENT_YEAR})`],
  [/current 2025-2026 hiring data/g, `current ${CONTENT_YEAR} hiring data`],
  [/Salary Guide 2025/g, `Salary Guide ${CONTENT_YEAR}`],
  [/Remote Jobs in 2025/g, `Remote Jobs in ${CONTENT_YEAR}`],
  [/Job Boards in 2025/g, `Job Boards in ${CONTENT_YEAR}`],
];

export function normalizeContentYears(text: string | undefined | null): string {
  if (!text) return '';
  let out = text;
  for (const [pattern, replacement] of PROSE_YEAR_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function normalizeBlogPostYears<T extends BlogPost>(post: T): T {
  const hiringTrends = post.hiringTrends?.map((t) => ({
    ...t,
    timeframe: normalizeContentYears(t.timeframe),
    trend: normalizeContentYears(t.trend),
    impact: normalizeContentYears(t.impact),
  }));

  const salaryBenchmarks = post.salaryBenchmarks?.map((b) => ({
    ...b,
    source: b.source ? normalizeContentYears(b.source) : SALARY_SURVEY_SOURCE,
  }));

  const faq = post.faq?.map((f) => ({
    question: normalizeContentYears(f.question),
    answer: normalizeContentYears(f.answer),
  }));

  return {
    ...post,
    title: normalizeContentYears(post.title),
    seoTitle: normalizeContentYears(post.seoTitle),
    seoDescription: normalizeContentYears(post.seoDescription),
    excerpt: normalizeContentYears(post.excerpt),
    content: normalizeContentYears(post.content),
    directAnswer: post.directAnswer ? normalizeContentYears(post.directAnswer) : post.directAnswer,
    hiringTrends,
    salaryBenchmarks,
    faq,
  };
}
