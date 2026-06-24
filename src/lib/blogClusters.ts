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

/** Accent colors aligned with programmatic cover art. */
export const CLUSTER_ACCENTS: Record<string, string> = {
  'remote-job-search': '#f97316',
  'ai-job-matching': '#38bdf8',
  'resume-optimization': '#a78bfa',
  'salary-negotiation': '#4ade80',
  'interview-prep': '#fb923c',
  'hiring-trends': '#34d399',
  'remote-companies': '#60a5fa',
  'career-growth': '#f472b6',
  hireloop: '#38bdf8',
};

const CLUSTER_LABEL_BY_ID = Object.fromEntries(
  BLOG_CLUSTERS.filter((c) => c.id !== 'all').map((c) => [c.id, c.label])
) as Record<string, string>;

export function clusterLabel(clusterId?: string): string | undefined {
  if (!clusterId) return undefined;
  return CLUSTER_LABEL_BY_ID[clusterId];
}

export function clusterAccent(clusterId?: string): string {
  if (clusterId && CLUSTER_ACCENTS[clusterId]) return CLUSTER_ACCENTS[clusterId]!;
  return '#f97316';
}

export function blogCoverUrl(slug: string): string {
  return `/api/blog/cover?slug=${encodeURIComponent(slug)}`;
}

/** Card eyebrow — cluster label in cover-art style. */
export function blogCardEyebrow(post: {
  clusterId?: string;
  category?: string;
  tags?: string[];
}): string | undefined {
  const label = clusterLabel(post.clusterId);
  if (label) return `${label} guide`;
  if (post.category) return post.category;
  return post.tags?.[0];
}
