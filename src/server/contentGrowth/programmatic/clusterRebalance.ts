import type { EvergreenSpec } from '../evergreen/buildArticle.js';

/** Blog index filters — each must have at least 20 posts. */
export const PRIMARY_FILTER_CLUSTERS = [
  'ai-job-matching',
  'resume-optimization',
  'salary-negotiation',
  'interview-prep',
  'hiring-trends',
] as const;

export type PrimaryFilterCluster = (typeof PRIMARY_FILTER_CLUSTERS)[number];

const PRIMARY_SET = new Set<string>(PRIMARY_FILTER_CLUSTERS);

export function isPrimaryFilterCluster(clusterId?: string): clusterId is PrimaryFilterCluster {
  return clusterId != null && PRIMARY_SET.has(clusterId);
}

/**
 * Map SEO catalog clusters onto the five primary blog filters so each filter
 * surfaces 20+ guides (competitors → AI, skills → Resume, boards → Trends, etc.).
 */
export function assignBlogFilterCluster(spec: EvergreenSpec, locationRoleIndex: number): string {
  const id = spec.clusterId ?? '';

  if (isPrimaryFilterCluster(id)) return id;
  if (id === 'competitor-alternatives') return 'ai-job-matching';
  if (id === 'skill-remote-jobs') return 'resume-optimization';
  if (id === 'remote-job-boards' || id === 'career-growth') return 'hiring-trends';
  if (id === 'geo-location-guides' || id === 'geo-role-guides' || id === 'geo-india-role-guides') {
    return 'salary-negotiation';
  }
  if (id === 'location-role-guides') {
    return PRIMARY_FILTER_CLUSTERS[locationRoleIndex % PRIMARY_FILTER_CLUSTERS.length]!;
  }

  return id;
}

export function applyBlogFilterClusters(specs: EvergreenSpec[]): EvergreenSpec[] {
  let locationRoleIndex = 0;
  return specs.map((spec) => {
    const idx = spec.clusterId === 'location-role-guides' ? locationRoleIndex++ : 0;
    const clusterId = assignBlogFilterCluster(spec, idx);
    return clusterId === spec.clusterId ? spec : { ...spec, clusterId };
  });
}

export function countByPrimaryCluster(specs: EvergreenSpec[]): Record<PrimaryFilterCluster, number> {
  const counts = Object.fromEntries(
    PRIMARY_FILTER_CLUSTERS.map((id) => [id, 0])
  ) as Record<PrimaryFilterCluster, number>;

  for (const spec of specs) {
    const id = spec.clusterId ?? '';
    if (isPrimaryFilterCluster(id)) counts[id]++;
  }
  return counts;
}
