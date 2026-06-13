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
export const LANDING_BLOG_FALLBACK: LandingBlogPost[] = [
  {
    slug: '2026-06-06-how-ai-remote-job-matching-actually-works-and-how-to-use-it',
    title: 'How AI Remote Job Matching Actually Works (And How to Use It to Your Advantage)',
    excerpt:
      'AI job matching works by converting your profile and every job posting into structured data, then scoring how well they align across skills, seniority, salary, and timezone…',
    publishedAt: '2026-06-06T08:24:09.026Z',
    category: 'Remote Work',
    clusterId: 'ai-job-matching',
  },
  {
    slug: '2026-06-05-how-to-spot-remote-job-scams-and-low-quality-listings-at-sca',
    title: 'How to Spot Remote Job Scams and Low-Quality Listings at Scale',
    excerpt:
      'Remote job scams cost job seekers hundreds of millions annually. Learn the red flags recruiters use to filter bad listings before you apply…',
    publishedAt: '2026-06-05T08:24:09.026Z',
    category: 'Remote Work',
    clusterId: 'remote-job-search',
  },
  {
    slug: '2026-05-28-how-to-find-remote-jobs-faster',
    title: 'How to Find Remote Jobs Faster: A Recruiter-Approved Playbook',
    excerpt:
      'The fastest way to find remote jobs is to combine targeted alerts, recruiter-visible profiles, and a weekly application rhythm focused on high-fit roles…',
    publishedAt: '2026-05-28T08:00:00.000Z',
    category: 'Job Search',
    clusterId: 'remote-job-search',
  },
];

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
