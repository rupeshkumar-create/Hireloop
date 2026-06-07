import { describe, expect, it } from 'vitest';
import { normalizeContentYears, normalizeBlogPostYears } from '../contentStandards.js';

describe('contentStandards', () => {
  it('normalizes 2025 prose to 2026 without touching slug dates', () => {
    expect(normalizeContentYears('Trends in 2025 show remote hiring growth')).toBe(
      'Trends in 2026 show remote hiring growth'
    );
    expect(normalizeContentYears('Industry surveys 2025–2026')).toBe('Industry surveys 2026');
    expect(normalizeContentYears('/blog/2025-06-08-teal-alternative-remote-jobs')).toBe(
      '/blog/2025-06-08-teal-alternative-remote-jobs'
    );
  });

  it('normalizes blog post text fields', () => {
    const post = normalizeBlogPostYears({
      slug: '2025-06-08-test',
      title: 'Remote trends in 2025',
      seoTitle: 'Remote trends in 2025',
      seoDescription: 'Guide for 2025',
      excerpt: 'Summary for 2025',
      content: 'Hiring trends in 2025 continue.',
      category: 'Guides',
      tags: [],
      targetKeywords: [],
      readTimeMinutes: 5,
      publishedAt: '2026-01-01T00:00:00.000Z',
      status: 'published',
      strategyVersion: 1,
      faq: [{ question: 'What changed in 2025?', answer: 'A lot in 2025.' }],
      hiringTrends: [{ trend: 'AI apply', impact: 'Higher bar', timeframe: '2025–2026' }],
    });
    expect(post.title).toContain('2026');
    expect(post.content).toContain('2026');
    expect(post.hiringTrends?.[0].timeframe).toBe('2026');
    expect(post.slug).toBe('2025-06-08-test');
  });
});
