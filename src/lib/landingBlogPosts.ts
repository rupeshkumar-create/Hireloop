import { listCoreBlogSummaries } from './coreBlogPosts';

/** Summaries for the landing page blog strip — also used when /api/blog is unavailable. */
export type LandingBlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  category: string;
  clusterId?: string;
};

/** Curated fallback when the blog API fails (dev offline, deploy misconfig, etc.). */
export const LANDING_BLOG_FALLBACK: LandingBlogPost[] = listCoreBlogSummaries(5).map(
  ({ slug, title, excerpt, publishedAt, category, clusterId }) => ({
    slug,
    title,
    excerpt,
    publishedAt,
    category,
    clusterId,
  })
);

export async function fetchLandingBlogPosts(limit = 3): Promise<LandingBlogPost[]> {
  try {
    const res = await fetch(`/api/blog?limit=${limit}`);
    const text = await res.text();
    let data: { posts?: LandingBlogPost[]; error?: string } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('Blog API returned an invalid response.');
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Blog API is misconfigured (expected JSON).');
    }
    if (!res.ok || data.error) {
      throw new Error(data.error || `Blog API error (${res.status})`);
    }
    const posts = (data.posts ?? []).slice(0, limit);
    return posts.length > 0 ? posts : LANDING_BLOG_FALLBACK.slice(0, limit);
  } catch {
    return LANDING_BLOG_FALLBACK.slice(0, limit);
  }
}
