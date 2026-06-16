/**
 * Deprioritize India-focused programmatic SEO pages for US/Europe acquisition.
 * Pages stay live for long-tail queries but defer to US primaries in sitemap + canonical.
 */
import type { EvergreenSpec } from '../evergreen/buildArticle.js';

const US_LOCATION_GUIDE = '2026-06-10-remote-jobs-united-states';
const US_ROLE_GUIDE_PREFIX = '2026-06-10-remote-';

export function isIndiaFocusedSpec(spec: EvergreenSpec): boolean {
  if (spec.clusterId === 'geo-india-role-guides') return true;
  if (spec.slug.includes('-jobs-india') || spec.slug.endsWith('remote-jobs-india')) return true;
  if (spec.slug === '2026-06-10-remote-jobs-india') return true;
  return false;
}

export function indiaCanonicalSlug(slug: string): string {
  if (slug === '2026-06-10-remote-jobs-india') return US_LOCATION_GUIDE;
  if (slug.includes('-jobs-india')) {
    return slug.replace('-jobs-india', '-jobs-united-states');
  }
  if (slug.startsWith('2026-06-10-remote-') && slug.endsWith('-jobs-india')) {
    const roleId = slug.replace('2026-06-10-remote-', '').replace('-jobs-india', '');
    return `${US_ROLE_GUIDE_PREFIX}${roleId}-jobs`;
  }
  return US_LOCATION_GUIDE;
}

export function applyGeoDeprioritization(specs: EvergreenSpec[]): EvergreenSpec[] {
  return specs.map((spec) => {
    if (!isIndiaFocusedSpec(spec)) return spec;

    const canonical = indiaCanonicalSlug(spec.slug);
    return {
      ...spec,
      canonicalSlug: spec.canonicalSlug ?? canonical,
      includeInSitemap: false,
    };
  });
}

export function countIndiaDeprioritized(specs: EvergreenSpec[]): number {
  return specs.filter((s) => isIndiaFocusedSpec(s)).length;
}
