import { describe, expect, it } from 'vitest';
import {
  applyGeoDeprioritization,
  indiaCanonicalSlug,
  isIndiaFocusedSpec,
} from '../programmatic/geoDeprioritization.js';
import type { EvergreenSpec } from '../evergreen/buildArticle.js';

function minimalSpec(overrides: Partial<EvergreenSpec>): EvergreenSpec {
  return {
    slug: 'test-slug',
    title: 'Test',
    category: 'guides',
    clusterId: 'remote-job-search',
    publishedAt: '2026-06-10T00:00:00.000Z',
    directAnswer: 'Answer',
    targetKeywords: ['remote jobs'],
    tags: [],
    faq: [],
    salaryRows: [],
    ...overrides,
  } as EvergreenSpec;
}

describe('geoDeprioritization', () => {
  it('flags India location and role guides', () => {
    expect(isIndiaFocusedSpec(minimalSpec({ slug: '2026-06-10-remote-jobs-india' }))).toBe(true);
    expect(isIndiaFocusedSpec(minimalSpec({ slug: '2026-06-10-remote-software-engineer-jobs-india' }))).toBe(
      true
    );
    expect(isIndiaFocusedSpec(minimalSpec({ clusterId: 'geo-india-role-guides' }))).toBe(true);
    expect(isIndiaFocusedSpec(minimalSpec({ slug: '2026-06-10-remote-jobs-united-states' }))).toBe(false);
  });

  it('maps India slugs to US canonical primaries', () => {
    expect(indiaCanonicalSlug('2026-06-10-remote-jobs-india')).toBe(
      '2026-06-10-remote-jobs-united-states'
    );
    expect(indiaCanonicalSlug('2026-06-10-remote-product-manager-jobs-india')).toBe(
      '2026-06-10-remote-product-manager-jobs-united-states'
    );
  });

  it('excludes India specs from sitemap via applyGeoDeprioritization', () => {
    const specs = applyGeoDeprioritization([
      minimalSpec({ slug: '2026-06-10-remote-jobs-india' }),
      minimalSpec({ slug: '2026-06-10-remote-jobs-united-states' }),
    ]);
    const india = specs.find((s) => s.slug.includes('india'));
    const us = specs.find((s) => s.slug.includes('united-states'));
    expect(india?.includeInSitemap).toBe(false);
    expect(india?.canonicalSlug).toBe('2026-06-10-remote-jobs-united-states');
    expect(us?.includeInSitemap).not.toBe(false);
  });
});
