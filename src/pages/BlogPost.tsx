import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Clock, Tag } from 'lucide-react';
import { Button } from '../components/ui/button';

interface BlogPostData {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  content: string;
  category: string;
  tags: string[];
  readTimeMinutes: number;
  publishedAt: string;
  faq?: { question: string; answer: string }[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        document.title = `${data.post.seoTitle || data.post.title} | HireSchema`;
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
          <Button variant="outline">Back to Blog</Button>
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-6 py-12">
      {/* Back link */}
      <Link
        to="/blog"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All articles
      </Link>

      {/* Meta */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-md border border-border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
          {post.category}
        </span>
        <span className="flex items-center gap-1 text-xs text-foreground-muted">
          <Clock className="h-3 w-3" />
          {post.readTimeMinutes} min read
        </span>
        <span className="text-xs text-foreground-muted">{formatDate(post.publishedAt)}</span>
      </div>

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-1.5">
          <Tag className="h-3 w-3 text-foreground-muted" />
          {post.tags.map((tag) => (
            <span key={tag} className="text-xs text-foreground-muted">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-neutral dark:prose-invert max-w-none
        prose-headings:tracking-[-0.02em]
        prose-h2:text-xl prose-h2:font-medium prose-h2:mt-10 prose-h2:mb-4
        prose-h3:text-base prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-base prose-p:leading-relaxed prose-p:text-foreground
        prose-li:text-base prose-li:text-foreground
        prose-strong:font-medium prose-strong:text-foreground
        prose-a:text-foreground prose-a:underline prose-a:underline-offset-2
        prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:text-foreground-muted">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>

      {/* CTA */}
      <div className="mt-16 rounded-xl border border-border bg-surface p-8 text-center">
        <h3 className="mb-2 text-lg font-medium">Find Your Next Remote Job with AI</h3>
        <p className="mb-6 text-sm text-foreground-muted">
          HireSchema sends you daily personalized remote job matches — tailored to your resume and preferences.
          Free to start.
        </p>
        <Link to="/login">
          <Button variant="action" size="lg">Get Daily Job Alerts</Button>
        </Link>
      </div>
    </article>
  );
}
