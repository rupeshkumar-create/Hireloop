import { describe, expect, it } from 'vitest';
import { buildEvergreenMarkdown } from '../evergreen/buildArticle.js';
import { GEO_SPECS, buildAllGeoSpecs } from '../geo/buildGeoSpecs.js';
import { GEO_LOCATIONS } from '../geo/locations.js';
import { GEO_ROLES } from '../geo/roles.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from '../wordCount.js';

describe('GEO programmatic guides', () => {
  it('generates location + role + India role pages', () => {
    const expected = GEO_LOCATIONS.length + GEO_ROLES.length * 2;
    expect(buildAllGeoSpecs()).toHaveLength(expected);
    expect(GEO_SPECS).toHaveLength(expected);
  });

  it('includes India location and software engineer India combo', () => {
    expect(GEO_SPECS.some((s) => s.slug === '2026-06-10-remote-jobs-india')).toBe(true);
    expect(GEO_SPECS.some((s) => s.slug === '2026-06-10-remote-software-engineer-jobs-india')).toBe(true);
  });

  it('each guide meets word target and GEO structure', () => {
    for (const spec of GEO_SPECS.slice(0, 5)) {
      const markdown = buildEvergreenMarkdown(spec);
      expect(meetsMinimumWordCount(markdown)).toBe(true);
      expect(countWords(markdown)).toBeGreaterThanOrEqual(BLOG_TARGET_WORD_COUNT);
      expect(spec.directAnswer.toLowerCase()).toContain('hireschema');
      expect(spec.faq.length).toBeGreaterThanOrEqual(4);
    }
  });
});
