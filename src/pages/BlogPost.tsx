import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Clock, Tag, TrendingUp, BookOpen, DollarSign } from 'lucide-react';
import { Button } from '../components/ui/button';
import { SeoHead } from '../components/seo/SeoHead';
import { usePageAnalytics, trackCtaClick } from '../hooks/usePageAnalytics';

interface BlogPostData {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  content: string;
  category: string;
  tags: string[];
  targetKeywords: string[];
  readTimeMinutes: number;
  publishedAt: string;
  faq?: { question: string; answer: string }[];
  directAnswer?: string;
  definitions?: { term: string; definition: string }[];
  salaryBenchmarks?: { role: string; median: string; range: string; region: string; source?: string }[];
  hiringTrends?: { trend: string; impact: string; timeframe: string }[];
  clusterId?: string;
  internalLinks?: { slug: string; title: string; anchorText: string }[];
  schema?: {
    article?: Record<string, unknown>;
    faqPage?: Record<string, unknown>;
    breadcrumb?: Record<string, unknown>;
  };
  imageAltText?: string;
  coverImageUrl?: string;
  coverImageDataUri?: string;
  entityTags?: string[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  usePageAnalytics(slug ?? '');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/blog?slug=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setPost(data.post);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-border" />
          <div className="h-8 w-full rounded bg-border" />
          <div className="h-8 w-4/5 rounded bg-border" />
          <div className="mt-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 rounded bg-border" style={{ width: `${75 + (i % 3) * 8}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <h1 className="mb-3 text-2xl font-medium">Post not found</h1>
        <p className="mb-8 text-foreground-muted">This article may have been moved or doesn't exist.</p>
        <Link to="/blog">
          <Button variant="outline">Back to Hiring Guides</Button>
        </Link>
      </div>
    );
  }

  const canonicalUrl = `https://hireschema.com/blog/${post.slug}`;

  return (
    <>
      <SeoHead
        title={`${post.seoTitle || post.title} | HireSchema`}
        description={post.seoDescription}
        canonicalUrl={canonicalUrl}
        keywords={post.targetKeywords}
        schema={post.schema}
        ogImage={post.coverImageUrl}
      />

      <article className="mx-auto max-w-2xl px-6 py-12">
        <Link
          to="/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All hiring guides
        </Link>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            {post.category}
          </span>
          {post.clusterId && (
            <span className="rounded-md border border-border px-2.5 py-0.5 text-[11px] text-foreground-muted">
              {post.clusterId.replace(/-/g, ' ')}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-foreground-muted">
            <Clock className="h-3 w-3" />
            {post.readTimeMinutes} min read
          </span>
          <span className="text-xs text-foreground-muted">{formatDate(post.publishedAt)}</span>
        </div>

        {post.tags?.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-1.5">
            <Tag className="h-3 w-3 text-foreground-muted" />
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs text-foreground-muted">{tag}</span>
            ))}
          </div>
        )}

        {/* Direct answer block for LLM retrieval */}
        {post.directAnswer && (
          <div className="mb-8 rounded-xl border border-border bg-surface p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Quick Answer
            </p>
            <p className="text-base leading-relaxed">{post.directAnswer}</p>
          </div>
        )}

        {/* Cover image — deterministic SVG, no AI generation */}
        {(post.coverImageUrl || post.imageAltText) && (
          <div className="mb-8 overflow-hidden rounded-xl border border-border">
            {(post.coverImageDataUri || post.coverImageUrl) ? (
              <img
                src={post.coverImageDataUri || post.coverImageUrl}
                alt={post.imageAltText || post.title}
                className="h-48 w-full object-cover md:h-56"
              />
            ) : (
              <div
                className="flex h-48 items-end bg-gradient-to-br from-surface to-surface-hover p-5 md:h-56"
                role="img"
                aria-label={post.imageAltText}
              >
                <span className="text-xs text-foreground-muted">{post.imageAltText}</span>
              </div>
            )}
          </div>
        )}

        <div className="prose prose-neutral dark:prose-invert max-w-none
          prose-headings:tracking-[-0.02em]
          prose-h2:text-xl prose-h2:font-medium prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-base prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-2
          prose-p:text-base prose-p:leading-relaxed prose-p:text-foreground
          prose-li:text-base prose-li:text-foreground
          prose-strong:font-medium prose-strong:text-foreground
          prose-a:text-foreground prose-a:underline prose-a:underline-offset-2
          prose-table:text-sm
          prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:text-foreground-muted">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>

        {/* Definitions */}
        {post.definitions && post.definitions.length > 0 && (
          <section className="mt-10 rounded-xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-foreground-muted" />
              <h2 className="text-lg font-medium">Key Definitions</h2>
            </div>
            <dl className="space-y-3">
              {post.definitions.map((d) => (
                <div key={d.term}>
                  <dt className="text-sm font-medium">{d.term}</dt>
                  <dd className="mt-0.5 text-sm text-foreground-muted">{d.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Salary benchmarks */}
        {post.salaryBenchmarks && post.salaryBenchmarks.length > 0 && (
          <section className="mt-8 rounded-xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-foreground-muted" />
              <h2 className="text-lg font-medium">Salary Benchmarks</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-foreground-muted">
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2 pr-4">Median</th>
                    <th className="pb-2 pr-4">Range</th>
                    <th className="pb-2">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {post.salaryBenchmarks.map((s) => (
                    <tr key={s.role} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{s.role}</td>
                      <td className="py-2 pr-4">{s.median}</td>
                      <td className="py-2 pr-4">{s.range}</td>
                      <td className="py-2">{s.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Hiring trends */}
        {post.hiringTrends && post.hiringTrends.length > 0 && (
          <section className="mt-8 rounded-xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-foreground-muted" />
              <h2 className="text-lg font-medium">Hiring Trends</h2>
            </div>
            <ul className="space-y-3">
              {post.hiringTrends.map((t) => (
                <li key={t.trend} className="text-sm">
                  <span className="font-medium">{t.trend}</span>
                  <span className="text-foreground-muted"> — {t.impact}</span>
                  <span className="ml-2 text-xs text-foreground-muted">({t.timeframe})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Structured FAQ for LLM/SEO */}
        {post.faq && post.faq.length > 0 && (
          <section className="mt-10 rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-4 text-lg font-medium">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {post.faq.map((item) => (
                <div key={item.question}>
                  <h3 className="text-sm font-medium">{item.question}</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Internal links */}
        {post.internalLinks && post.internalLinks.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-base font-medium">Related Hiring Guides</h2>
            <ul className="space-y-2">
              {post.internalLinks.map((link) => (
                <li key={link.slug}>
                  <Link to={`/blog/${link.slug}`} className="text-sm text-foreground-muted hover:text-foreground hover:underline">
                    {link.anchorText || link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-16 rounded-xl border border-border bg-surface p-8 text-center">
          <h3 className="mb-2 text-lg font-medium">Find Your Next Remote Job with AI</h3>
          <p className="mb-6 text-sm text-foreground-muted">
            HireSchema sends you daily personalized remote job matches — tailored to your resume and preferences.
            Free to start.
          </p>
          <Link
            to="/login"
            onClick={() => slug && trackCtaClick(slug)}
          >
            <Button variant="action" size="lg">Get Daily Job Alerts</Button>
          </Link>
        </div>
      </article>
    </>
  );
}
