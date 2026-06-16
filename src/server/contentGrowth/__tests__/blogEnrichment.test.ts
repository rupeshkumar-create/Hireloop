import { describe, expect, it } from 'vitest';
import { buildEvergreenMarkdown } from '../evergreen/buildArticle.js';
import { ALL_PROGRAMMATIC_SPECS } from '../programmatic/catalog.js';
import {
  applyCannibalization,
} from '../programmatic/cannibalization.js';
import { buildWeeklyMarketBriefSpec } from '../marketBrief/buildWeeklyMarketBrief.js';
import { WEEKLY_MARKET_BRIEF_SLUG } from '../marketBrief/weeklyRolesSnapshot.js';
import { meetsMinimumWordCount } from '../wordCount.js';
import { getSitemapProgrammaticSpecs } from '../programmatic/publicListing.js';

describe('blog enrichment + cannibalization + weekly brief', () => {
  it('adds action checklist and real-world examples to programmatic posts', () => {
    const spec = ALL_PROGRAMMATIC_SPECS[0]!;
    const md = buildEvergreenMarkdown(spec);
    expect(md).toContain('## 7-Day Action Checklist');
    expect(md).toContain('## Real-World Examples');
    expect(md).toContain('## Quick Stats');
    expect(meetsMinimumWordCount(md)).toBe(true);
  });

  it('assigns canonical slugs for duplicate primary keywords', () => {
    const specs = applyCannibalization([
      {
        slug: 'primary-guide',
        title: 'Primary Remote Jobs Guide',
        targetKeywords: ['remote jobs india'],
        clusterId: 'remote-job-search',
      } as (typeof ALL_PROGRAMMATIC_SPECS)[0],
      {
        slug: 'secondary-guide',
        title: 'Secondary Remote Jobs India Tips',
        targetKeywords: ['remote jobs india'],
        clusterId: 'location-role-guides',
      } as (typeof ALL_PROGRAMMATIC_SPECS)[0],
    ]);

    const secondary = specs.find((s) => s.slug === 'secondary-guide');
    expect(secondary?.canonicalSlug).toBe('primary-guide');
    expect(secondary?.includeInSitemap).toBe(false);
  });

  it('marks secondary posts in full catalog for canonical consolidation', () => {
    const secondaries = ALL_PROGRAMMATIC_SPECS.filter(
      (s) => s.canonicalSlug && s.canonicalSlug !== s.slug
    );
    expect(secondaries.length).toBeGreaterThan(0);
    expect(secondaries.every((s) => s.includeInSitemap === false)).toBe(true);
  });

  it('builds weekly market brief spec', () => {
    const spec = buildWeeklyMarketBriefSpec();
    expect(spec.slug).toBe(WEEKLY_MARKET_BRIEF_SLUG);
    const md = buildEvergreenMarkdown(spec);
    expect(md).toContain('Weekly demand leaderboard');
    expect(md).toContain('Senior Backend Engineer');
    expect(meetsMinimumWordCount(md)).toBe(true);
  });

  it('includes weekly brief in sitemap specs', () => {
    const slugs = getSitemapProgrammaticSpecs().map((s) => s.slug);
    expect(slugs).toContain(WEEKLY_MARKET_BRIEF_SLUG);
  });
});
