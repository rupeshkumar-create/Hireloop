import { describe, expect, it } from 'vitest';
import { EVERGREEN_SPECS } from '../contentGrowth/evergreen/catalog.js';
import { buildEvergreenMarkdown, validateEvergreenSpec } from '../contentGrowth/evergreen/buildArticle.js';
import { BLOG_TARGET_WORD_COUNT } from '../contentGrowth/wordCount.js';

describe('evergreen seed catalog', () => {
  it('defines exactly 10 evergreen posts', () => {
    expect(EVERGREEN_SPECS).toHaveLength(10);
  });

  it('each post meets the 2000-word minimum', () => {
    for (const spec of EVERGREEN_SPECS) {
      const { ok, wordCount } = validateEvergreenSpec(spec);
      expect(ok, `${spec.slug} has ${wordCount} words`).toBe(true);
      expect(wordCount).toBeGreaterThanOrEqual(BLOG_TARGET_WORD_COUNT);
    }
  });

  it('includes FAQ and comparison sections', () => {
    for (const spec of EVERGREEN_SPECS) {
      const md = buildEvergreenMarkdown(spec);
      expect(md).toMatch(/### FAQ/i);
      expect(md).toMatch(/## Comparison/i);
      expect(md).toMatch(/## Salary Benchmarks/i);
    }
  });

  it('uses unique slugs', () => {
    const slugs = EVERGREEN_SPECS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(10);
  });
});
