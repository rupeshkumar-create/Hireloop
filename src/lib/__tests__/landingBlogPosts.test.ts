import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchLandingBlogPosts, LANDING_BLOG_FALLBACK } from '../landingBlogPosts';

describe('fetchLandingBlogPosts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns API posts when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () =>
          JSON.stringify({
            posts: [
              {
                slug: 'test-post',
                title: 'Test Post',
                excerpt: 'Excerpt',
                publishedAt: '2026-06-01T00:00:00.000Z',
                category: 'Remote Work',
              },
            ],
          }),
      }))
    );

    const posts = await fetchLandingBlogPosts(3);
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe('test-post');
  });

  it('falls back when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));

    const posts = await fetchLandingBlogPosts(3);
    expect(posts).toEqual(LANDING_BLOG_FALLBACK.slice(0, 3));
  });
});
