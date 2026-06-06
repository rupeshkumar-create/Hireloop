import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Tag, Sparkles } from 'lucide-react';
import { SeoHead } from '../components/seo/SeoHead';

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

const CLUSTERS = [
  { id: 'all', label: 'All Guides' },
  { id: 'remote-job-search', label: 'Job Search' },
  { id: 'ai-job-matching', label: 'AI Matching' },
  { id: 'resume-optimization', label: 'Resume' },
  { id: 'salary-negotiation', label: 'Salary' },
  { id: 'interview-prep', label: 'Interview' },
  { id: 'hiring-trends', label: 'Trends' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function Blog() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState('all');

  useEffect(() => {
    fetch('/api/blog?limit=50')
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

  const filtered = useMemo(() => {
    if (activeCluster === 'all') return posts;
    return posts.filter((p) => p.clusterId === activeCluster);
  }, [posts, activeCluster]);

  return (
    <>
      <SeoHead
        title="Hiring Guides & Remote Job Insights | HireSchema"
        description="Practical guides for remote job seekers — search strategies, resume tips, salary data, and interview prep."
        canonicalUrl="https://hireschema.com/blog"
        ogType="website"
        keywords={['remote job search', 'hiring guides', 'resume tips', 'salary negotiation', 'interview prep']}
      />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-14 text-center">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-foreground-muted">
            <Sparkles className="h-3 w-3" />
            Hiring Guides
          </div>
          <h1 className="text-4xl font-normal tracking-[-0.02em] md:text-5xl">
            Remote Job Search, Salary Data &amp; Career Tips
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-foreground-muted">
            Actionable guides to help you find remote roles, tailor your applications, negotiate pay, and prepare for interviews.
          </p>
        </div>

        {/* Cluster filter */}
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {CLUSTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCluster(c.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeCluster === c.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-foreground-muted hover:border-border-strong hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-6">
                <div className="mb-3 h-3 w-20 rounded bg-border" />
                <div className="mb-2 h-5 w-full rounded bg-border" />
                <div className="h-5 w-3/4 rounded bg-border" />
                <div className="mt-4 h-3 w-full rounded bg-border" />
                <div className="mt-2 h-3 w-5/6 rounded bg-border" />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-center text-sm text-foreground-muted">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-24 text-center">
            <p className="text-lg font-medium">No guides in this category yet.</p>
            <p className="mt-2 text-sm text-foreground-muted">
              Try another topic above, or{' '}
              <Link to="/signup" className="underline underline-offset-2 hover:text-foreground">
                start matching with remote jobs
              </Link>
              .
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {filtered.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group flex flex-col rounded-xl border border-border bg-surface p-6 transition-colors duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border-strong"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-md border border-border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                    {post.category}
                  </span>
                  {post.clusterId && (
                    <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
                      {post.clusterId.replace(/-/g, ' ')}
                    </span>
                  )}
                </div>

                <h2 className="mb-2 text-lg font-medium leading-snug tracking-[-0.01em] transition-colors group-hover:text-foreground">
                  {post.title}
                </h2>

                <p className="mb-4 flex-1 text-sm leading-relaxed text-foreground-muted line-clamp-3">
                  {post.directAnswer || post.seoDescription || post.excerpt}
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
                      <span key={tag} className="text-[11px] text-foreground-muted">{tag}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
