/**
 * Detect overlapping programmatic guides and assign canonical URLs for SEO.
 * Secondary posts stay live for long-tail queries but defer to a primary guide.
 */
import type { EvergreenSpec } from '../evergreen/buildArticle.js';

export type CannibalizedSpec = EvergreenSpec & {
  /** When set and different from slug, this post should use rel=canonical to the primary guide. */
  canonicalSlug?: string;
  /** False for secondary posts — excluded from sitemap to reduce cannibalization. */
  includeInSitemap?: boolean;
};

const CLUSTER_PRIORITY: Record<string, number> = {
  'remote-job-search': 100,
  'ai-job-matching': 95,
  'resume-optimization': 90,
  'interview-prep': 88,
  'salary-negotiation': 85,
  'hiring-trends': 82,
  'career-growth': 80,
  'competitor-alternatives': 75,
  'remote-job-boards': 70,
  'geo-location-guides': 55,
  'geo-role-guides': 50,
  'geo-india-role-guides': 50,
  'skill-remote-jobs': 45,
  'location-role-guides': 20,
};

function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const overlap = [...wordsA].filter((w) => wordsB.has(w)).length;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function canonicalScore(spec: EvergreenSpec): number {
  const cluster = spec.clusterId ?? '';
  const clusterScore = CLUSTER_PRIORITY[cluster] ?? 40;
  const slugPenalty = spec.slug.length / 100;
  const keywordBreadth = (spec.targetKeywords[0]?.split(' ').length ?? 3) < 5 ? 5 : 0;
  return clusterScore + keywordBreadth - slugPenalty;
}

function pickCanonical(group: EvergreenSpec[]): EvergreenSpec {
  return [...group].sort((a, b) => canonicalScore(b) - canonicalScore(a))[0]!;
}

export interface CannibalizationGroup {
  primaryKeyword: string;
  canonical: EvergreenSpec;
  secondaries: EvergreenSpec[];
}

/** Group specs that compete for the same primary keyword. */
export function findCannibalizationGroups(specs: EvergreenSpec[]): CannibalizationGroup[] {
  const byKeyword = new Map<string, EvergreenSpec[]>();

  for (const spec of specs) {
    const key = normalizeKeyword(spec.targetKeywords[0] ?? spec.slug);
    if (!key) continue;
    const list = byKeyword.get(key) ?? [];
    list.push(spec);
    byKeyword.set(key, list);
  }

  const groups: CannibalizationGroup[] = [];
  for (const [primaryKeyword, members] of byKeyword) {
    if (members.length < 2) continue;
    const canonical = pickCanonical(members);
    const secondaries = members.filter((s) => s.slug !== canonical.slug);
    groups.push({ primaryKeyword, canonical, secondaries });
  }

  return groups;
}

export function applyCannibalization(specs: EvergreenSpec[]): CannibalizedSpec[] {
  const groups = findCannibalizationGroups(specs);
  const secondaryMap = new Map<string, string>();

  for (const group of groups) {
    for (const secondary of group.secondaries) {
      secondaryMap.set(secondary.slug, group.canonical.slug);
    }
  }

  // Title-level collisions within the same cluster (fuzzy)
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const a = specs[i]!;
      const b = specs[j]!;
      if (a.clusterId !== b.clusterId) continue;
      if (titleSimilarity(a.title, b.title) < 0.82) continue;
      const canonical = canonicalScore(a) >= canonicalScore(b) ? a : b;
      const secondary = canonical.slug === a.slug ? b : a;
      if (!secondaryMap.has(secondary.slug)) {
        secondaryMap.set(secondary.slug, canonical.slug);
      }
    }
  }

  return specs.map((spec) => {
    const canonicalSlug = secondaryMap.get(spec.slug);
    if (!canonicalSlug) {
      return { ...spec, includeInSitemap: true };
    }
    return {
      ...spec,
      canonicalSlug,
      includeInSitemap: false,
    };
  });
}

export function buildCannibalizationNotice(spec: CannibalizedSpec, canonicalTitle: string): string {
  if (!spec.canonicalSlug || spec.canonicalSlug === spec.slug) return '';
  return (
    `> **Primary guide:** This page targets a specific long-tail query. For the comprehensive ` +
    `[${canonicalTitle}](/blog/${spec.canonicalSlug}) guide, start there — then return here for localized detail.\n`
  );
}

export function getCanonicalSlug(spec: CannibalizedSpec): string {
  return spec.canonicalSlug && spec.canonicalSlug !== spec.slug ? spec.canonicalSlug : spec.slug;
}
