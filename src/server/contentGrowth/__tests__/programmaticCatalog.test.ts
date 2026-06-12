import { describe, expect, it } from 'vitest';
import {
  ALL_PROGRAMMATIC_SPECS,
  PROGRAMMATIC_CLUSTERS,
  PROGRAMMATIC_POST_COUNT,
  TARGET_PROGRAMMATIC_COUNT,
  assertProgrammaticCatalogSize,
} from '../programmatic/catalog.js';
import {
  PRIMARY_FILTER_CLUSTERS,
  countByPrimaryCluster,
} from '../programmatic/clusterRebalance.js';
import { buildEvergreenMarkdown } from '../evergreen/buildArticle.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from '../wordCount.js';

describe('500-post programmatic catalog', () => {
  it('has exactly 500 unique specs', () => {
    expect(() => assertProgrammaticCatalogSize(500)).not.toThrow();
    expect(PROGRAMMATIC_POST_COUNT).toBe(TARGET_PROGRAMMATIC_COUNT);
    const slugs = new Set(ALL_PROGRAMMATIC_SPECS.map((s) => s.slug));
    expect(slugs.size).toBe(500);
  });

  it('cluster breakdown sums to 500', () => {
    const sum = Object.values(PROGRAMMATIC_CLUSTERS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(500);
    expect(PROGRAMMATIC_CLUSTERS.locationRole).toBe(280);
    expect(PROGRAMMATIC_CLUSTERS.skills).toBe(60);
  });

  it('staggered publish dates are monotonic and not in the future', () => {
    const now = Date.now();
    const dates = ALL_PROGRAMMATIC_SPECS.map((s) => new Date(s.publishedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThan(dates[i - 1]!);
    }
    expect(dates[dates.length - 1]!).toBeLessThanOrEqual(now + 24 * 60 * 60 * 1000);
  });

  it('each primary blog filter cluster has at least 20 posts', () => {
    const counts = countByPrimaryCluster(ALL_PROGRAMMATIC_SPECS);
    for (const clusterId of PRIMARY_FILTER_CLUSTERS) {
      expect(counts[clusterId], clusterId).toBeGreaterThanOrEqual(20);
    }
  });

  it('sample specs meet word target', () => {
    for (const spec of [ALL_PROGRAMMATIC_SPECS[0], ALL_PROGRAMMATIC_SPECS[200], ALL_PROGRAMMATIC_SPECS[499]]) {
      const md = buildEvergreenMarkdown(spec);
      expect(meetsMinimumWordCount(md)).toBe(true);
      expect(countWords(md)).toBeGreaterThanOrEqual(BLOG_TARGET_WORD_COUNT);
    }
  });
});
