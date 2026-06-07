import { describe, expect, it } from 'vitest';
import { buildEvergreenMarkdown } from '../evergreen/buildArticle.js';
import { COMPETITOR_SPECS } from '../competitors/buildCompetitorSpecs.js';
import { COMPETITOR_META } from '../competitors/meta.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from '../wordCount.js';

describe('competitor alternative posts', () => {
  it('generates 25 competitor specs', () => {
    expect(COMPETITOR_META).toHaveLength(25);
    expect(COMPETITOR_SPECS).toHaveLength(25);
  });

  it('each post meets word target and targets alternative keywords', () => {
    for (const spec of COMPETITOR_SPECS) {
      const markdown = buildEvergreenMarkdown(spec);
      expect(meetsMinimumWordCount(markdown)).toBe(true);
      expect(countWords(markdown)).toBeGreaterThanOrEqual(BLOG_TARGET_WORD_COUNT);
      expect(spec.slug).toContain('-alternative-remote-jobs');
      expect(spec.targetKeywords.some((k) => k.toLowerCase().includes('alternative'))).toBe(true);
      expect(spec.directAnswer.toLowerCase()).toContain('hireschema');
    }
  });
});
