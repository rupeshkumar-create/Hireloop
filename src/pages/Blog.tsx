import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Tag } from 'lucide-react';

interface BlogPostSummary {
  slug: string;
  title: string;
  seoDescription: string;
  excerpt: string;
  category: string;
  tags: string[];
  readTimeMinutes: number;
  publishedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function Blog() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Blog — Remote Job Search & Career Advice | HireSchema';
    fetch('/api/blog/posts')
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load posts.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Hero */}
      <div className="mb-14 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
          The HireSchema Blog
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Remote Job Search, AI Tools &amp; Career Advice
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-foreground-muted">
          Practical guides to finding remote jobs faster — written by our AI, curated for real job seekers.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-surface p-6">
              <div className="mb-3 h-3 w-20 rounded bg-border" />
              <div className="mb-2 h-5 w-full rounded bg-border" />
              <div className="h-5 w-3/4 rounded bg-border" />
              <div className="mt-4 h-3 w-full rounded bg-border" />
              <div className="mt-2 h-3 w-5/6 rounded bg-border" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-foreground-muted">{error}</p>
      )}

      {/* Empty */}
      {!loading && !error && posts.length === 0 && (
        <div className="py-24 text-center">
          <p className="text-lg font-medium">No posts yet — check back soon.</p>
          <p className="mt-2 text-sm text-foreground-muted">
            Our AI is writing the first batch of guides for you.
          </p>
        </div>
      )}

      {/* Post grid */}
      {!loading && posts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all hover:border-foreground/20 hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                  {post.category}
                </span>
              </div>

              <h2 className="mb-2 text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-foreground">
                {post.title}
              </h2>

              <p className="mb-4 flex-1 text-sm leading-relaxed text-foreground-muted line-clamp-3">
                {post.seoDescription || post.excerpt}
              </p>

              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <span>{formatDate(post.publishedAt)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readTimeMinutes} min read
                </span>
              </div>

              {post.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Tag className="h-3 w-3 text-foreground-muted" />
                  {post.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[11px] text-foreground-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
