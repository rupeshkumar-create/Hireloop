import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, TrendingUp, BookOpen, DollarSign } from 'lucide-react';
import { SeoHead } from '../components/seo/SeoHead';
import { BlogArticleMarkdown } from '../components/blog/BlogArticleMarkdown';
import { prepareBlogBodyContent } from '../lib/blogContent';
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
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        const contentType = r.headers.get('content-type') ?? '';
        const text = await r.text();
        try {
          const data = text ? JSON.parse(text) : {};
          if (!contentType.includes('application/json')) throw new Error('Invalid response');
          return data;
        } catch {
          throw new Error('Invalid response');
        }
      })
      .then((data) => {
        if (!data) return;
        setPost(data.post);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  const bodyContent = useMemo(() => {
    if (!post) return '';
    const hasStructured =
      Boolean(post.definitions?.length) ||
      Boolean(post.salaryBenchmarks?.length) ||
      Boolean(post.hiringTrends?.length) ||
      Boolean(post.faq?.length);

    return prepareBlogBodyContent(post.content, {
      title: post.title,
      stripStructuredSections: hasStructured,
      stripFaq: Boolean(post.faq?.length),
    });
  }, [post]);

  if (loading) {
    return (
      <div className="blog-lp-container">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-28 rounded bg-[var(--lp-border)]" />
          <div className="h-10 w-full rounded bg-[var(--lp-border)]" />
          <div className="h-6 w-2/3 rounded bg-[var(--lp-border)]" />
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="blog-lp-container py-24 text-center">
        <h1 className="blog-lp-display blog-lp-title-lg">Post not found</h1>
        <p className="blog-lp-lede mt-3">This article may have been moved or doesn&apos;t exist.</p>
        <Link to="/blog" className="blog-lp-btn-p mt-8 inline-flex">
          Back to Hiring Guides
        </Link>
      </div>
    );
  }

  const canonicalUrl = `https://hireschema.com/blog/${post.slug}`;
  const lede = post.directAnswer || post.seoDescription;

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

      <article className="blog-lp-container">
        <Link to="/blog" className="blog-lp-back">
          <ArrowLeft className="h-4 w-4" />
          All hiring guides
        </Link>

        <header className="blog-lp-article-header">
          <div className="blog-lp-meta-row">
            <span className="blog-lp-badge">{post.category}</span>
            <span className="blog-lp-meta inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readTimeMinutes} min read
            </span>
            <span className="blog-lp-meta">{formatDate(post.publishedAt)}</span>
          </div>

          <h1 className="blog-lp-display blog-lp-title-lg">{post.title}</h1>

          {lede && <p className="blog-lp-lede mt-5">{lede}</p>}

          {post.tags?.length > 0 && (
            <div className="blog-lp-tags-row">
              {post.tags.map((tag) => (
                <span key={tag} className="blog-lp-tag">{tag}</span>
              ))}
            </div>
          )}
        </header>

        {(post.coverImageUrl || post.coverImageDataUri) && (
          <div className="blog-lp-cover">
            <img
              src={post.coverImageDataUri || post.coverImageUrl}
              alt={post.imageAltText || post.title}
            />
          </div>
        )}

        <BlogArticleMarkdown content={bodyContent} />

        {post.definitions && post.definitions.length > 0 && (
          <section className="blog-lp-section">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4" style={{ color: 'var(--lp-muted)' }} />
              <h2 className="blog-lp-section-title" style={{ margin: 0 }}>Terms to know</h2>
            </div>
            <dl className="grid gap-3 md:grid-cols-2">
              {post.definitions.map((d) => (
                <div
                  key={d.term}
                  className="rounded-xl border border-[var(--lp-border)] bg-[var(--lp-bg)] px-4 py-3"
                >
                  <dt className="text-sm font-medium" style={{ color: 'var(--lp-fg)' }}>{d.term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--lp-muted)' }}>{d.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {post.salaryBenchmarks && post.salaryBenchmarks.length > 0 && (
          <section className="blog-lp-section">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: 'var(--lp-muted)' }} />
              <h2 className="blog-lp-section-title" style={{ margin: 0 }}>Salary benchmarks</h2>
            </div>
            <div className="blog-table-wrap">
              <table className="blog-table">
                <thead>
                  <tr>
                    <th className="blog-th">Role</th>
                    <th className="blog-th">Median</th>
                    <th className="blog-th">Range</th>
                    <th className="blog-th">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {post.salaryBenchmarks.map((s) => (
                    <tr key={s.role} className="blog-tr">
                      <td className="blog-td font-medium">{s.role}</td>
                      <td className="blog-td">{s.median}</td>
                      <td className="blog-td">{s.range}</td>
                      <td className="blog-td">{s.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {post.hiringTrends && post.hiringTrends.length > 0 && (
          <section className="blog-lp-section">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: 'var(--lp-muted)' }} />
              <h2 className="blog-lp-section-title" style={{ margin: 0 }}>What&apos;s changing in hiring</h2>
            </div>
            <ul className="space-y-3">
              {post.hiringTrends.map((t) => (
                <li
                  key={t.trend}
                  className="rounded-xl border border-[var(--lp-border)] bg-[var(--lp-bg)] px-4 py-3 text-sm leading-relaxed"
                >
                  <span className="font-medium" style={{ color: 'var(--lp-fg)' }}>{t.trend}</span>
                  <span style={{ color: 'var(--lp-muted)' }}> — {t.impact}</span>
                  <span className="mt-1 block blog-lp-meta">{t.timeframe}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {post.faq && post.faq.length > 0 && (
          <section className="blog-lp-section">
            <h2 className="blog-lp-section-title">Common questions</h2>
            <p className="blog-lp-body mb-4">Quick answers if you&apos;re skimming.</p>
            <div>
              {post.faq.map((item) => (
                <div key={item.question} className="blog-faq-item">
                  <h3 className="blog-lp-display text-lg" style={{ margin: 0 }}>{item.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lp-muted)' }}>{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {post.internalLinks && post.internalLinks.length > 0 && (
          <section className="blog-lp-section" style={{ borderStyle: 'dashed' }}>
            <h2 className="blog-lp-section-title">Keep reading</h2>
            <ul className="space-y-2">
              {post.internalLinks.map((link) => (
                <li key={link.slug}>
                  <Link to={`/blog/${link.slug}`} className="blog-link text-sm">
                    {link.anchorText || link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="blog-lp-cta">
          <h3 className="blog-lp-display text-2xl">Ready to find remote roles that fit you?</h3>
          <p className="blog-lp-lede mx-auto mt-3 max-w-md">
            HireSchema matches you to remote jobs daily — based on your resume, skills, and preferences. Free to start.
          </p>
          <Link to="/login" className="blog-lp-btn-p mt-6 inline-flex" onClick={() => slug && trackCtaClick(slug)}>
            Get daily job matches
          </Link>
        </div>
      </article>
    </>
  );
}
