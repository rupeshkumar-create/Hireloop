import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { SeoHead } from '../components/seo/SeoHead';
import { DEFAULT_OG_IMAGE } from '../lib/siteSeo';

interface BlogPostSummary {
  slug: string;
  title: string;
  seoDescription: string;
  excerpt: string;
  category: string;
  tags: string[];
  readTimeMinutes: number;
  publishedAt: string;
  clusterId?: string;
  directAnswer?: string;
}

import { blogCardEyebrow, blogCoverUrl, clusterAccent } from '../lib/blogClusters';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function Blog() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/blog?limit=5')
      .then(async (r) => {
        const contentType = r.headers.get('content-type') ?? '';
        const text = await r.text();
        let data: { posts?: BlogPostSummary[]; error?: string } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error('Blog API returned an invalid response. Redeploy may be required.');
        }
        if (!contentType.includes('application/json')) {
          throw new Error('Blog API is misconfigured on the server (expected JSON).');
        }
        if (!r.ok || data.error) {
          throw new Error(data.error || `Blog API error (${r.status})`);
        }
        setPosts(data.posts ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Could not load posts.';
        setError(message);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <SeoHead
        title="About Hireloop — Jack, Jill & Scout | Hireloop"
        description="Five guides on how Hireloop works: Jack the career copilot, Jill for recruiters, Scout job discovery, and the match-to-offer workflow."
        canonicalUrl="https://hireloop.vercel.app/blog"
        ogType="website"
        ogImage={DEFAULT_OG_IMAGE}
        keywords={['hireschema', 'jack ai', 'job search agent', 'scout job matching']}
      />

      <div className="blog-lp-container-wide">
        <header className="blog-lp-header">
          <p className="blog-lp-eyebrow">Product guides</p>
          <h1 className="blog-lp-display blog-lp-title-xl">
            How Hireloop works
          </h1>
          <p className="blog-lp-lede">
            Everything you need to know about Jack, Jill, Scout, and the chat-first job search workflow.
            {!loading && !error && posts.length > 0 ? (
              <span className="block mt-2 text-sm opacity-80">
                {posts.length} guides
              </span>
            ) : null}
          </p>
        </header>

        {loading && (
          <div className="blog-lp-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="blog-lp-card blog-lp-card-skeleton animate-pulse">
                <div className="blog-lp-card-cover-skeleton" />
                <div className="blog-lp-card-body">
                  <div className="mb-3 h-3 w-24 rounded bg-[var(--lp-border)]" />
                  <div className="mb-2 h-5 w-full rounded bg-[var(--lp-border)]" />
                  <div className="h-12 w-full rounded bg-[var(--lp-border)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-center blog-lp-body">{error}</p>}

        {!loading && !error && posts.length === 0 && (
          <div className="py-20 text-center">
            <p className="blog-lp-display blog-lp-title-lg">No guides in this category yet</p>
            <p className="blog-lp-lede mt-3">
              Try another topic above, or{' '}
              <Link to="/login" className="blog-lp-nav-link" style={{ color: 'var(--lp-accent)' }}>
                start matching with Scout
              </Link>
              .
            </p>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div className="blog-lp-grid">
            {posts.map((post) => {
              const eyebrow = blogCardEyebrow(post);
              const accent = clusterAccent(post.clusterId);
              const coverSrc = blogCoverUrl(post.slug);
              return (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="blog-lp-card"
                style={{ '--blog-card-accent': accent } as CSSProperties}
              >
                <div className="blog-lp-card-cover">
                  <img
                    src={coverSrc}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  {eyebrow ? (
                    <span className="blog-lp-card-cover-label">{eyebrow}</span>
                  ) : null}
                </div>
                <div className="blog-lp-card-body">
                  <h2 className="blog-lp-card-title">{post.title}</h2>
                  <p className="blog-lp-card-excerpt line-clamp-3">
                    {post.directAnswer || post.seoDescription || post.excerpt}
                  </p>
                  <div className="blog-lp-card-footer">
                    <span>{formatDate(post.publishedAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readTimeMinutes} min
                    </span>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
