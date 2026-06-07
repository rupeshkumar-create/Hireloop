/** Topic cluster filters for the blog index (matches programmatic `clusterId`). */
export const BLOG_CLUSTERS = [
  { id: 'all', label: 'All Guides' },
  { id: 'remote-job-search', label: 'Job Search' },
  { id: 'ai-job-matching', label: 'AI Matching' },
  { id: 'resume-optimization', label: 'Resume' },
  { id: 'salary-negotiation', label: 'Salary' },
  { id: 'interview-prep', label: 'Interview' },
  { id: 'hiring-trends', label: 'Trends' },
] as const;

const CLUSTER_LABEL_BY_ID = Object.fromEntries(
  BLOG_CLUSTERS.filter((c) => c.id !== 'all').map((c) => [c.id, c.label])
) as Record<string, string>;

export function clusterLabel(clusterId?: string): string | undefined {
  if (!clusterId) return undefined;
  return CLUSTER_LABEL_BY_ID[clusterId];
}

/** Card eyebrow — prefer a specific tag over repeating the active filter label. */
export function blogCardEyebrow(post: {
  clusterId?: string;
  category?: string;
  tags?: string[];
}): string | undefined {
  const filterLabel = post.clusterId ? clusterLabel(post.clusterId) : undefined;
  const tag = post.tags?.find((t) => t && t !== filterLabel && t !== post.category);
  if (tag) return tag;
  if (post.category && post.category !== filterLabel) return post.category;
  return undefined;
}
