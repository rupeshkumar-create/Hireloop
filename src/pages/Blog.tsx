import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
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

      <div className="blog-lp-container-wide">
        <header className="blog-lp-header">
          <p className="blog-lp-eyebrow">Hiring Guides</p>
          <h1 className="blog-lp-display blog-lp-title-xl">
            Remote job search, salary data &amp; career tips
          </h1>
          <p className="blog-lp-lede">
            Actionable guides to help you find remote roles, tailor your applications, negotiate pay, and prepare for interviews.
          </p>
        </header>

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {CLUSTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCluster(c.id)}
              className={`blog-lp-filter ${activeCluster === c.id ? 'blog-lp-filter-active' : ''}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="blog-lp-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="blog-lp-card animate-pulse opacity-60">
                <div className="mb-3 h-3 w-20 rounded bg-[var(--lp-border)]" />
                <div className="mb-2 h-5 w-full rounded bg-[var(--lp-border)]" />
                <div className="h-12 w-full rounded bg-[var(--lp-border)]" />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-center blog-lp-body">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="blog-lp-display blog-lp-title-lg">No guides in this category yet</p>
            <p className="blog-lp-lede mt-3">
              Try another topic above, or{' '}
              <Link to="/login" className="blog-lp-nav-link" style={{ color: 'var(--lp-accent)' }}>
                start matching with remote jobs
              </Link>
              .
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="blog-lp-grid">
            {filtered.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-lp-card">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="blog-lp-badge">{post.category}</span>
                </div>
                <h2 className="blog-lp-card-title">{post.title}</h2>
                <p className="blog-lp-card-excerpt line-clamp-3">
                  {post.directAnswer || post.seoDescription || post.excerpt}
                </p>
                <div className="mt-4 flex items-center justify-between blog-lp-meta">
                  <span>{formatDate(post.publishedAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.readTimeMinutes} min
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
