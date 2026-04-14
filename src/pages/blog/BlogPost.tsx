import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ArrowRight, Calendar, User, Share2, Linkedin, Twitter, MessageCircle, Link as LinkIcon } from 'lucide-react';
import blogPosts from '../../data/blogPosts.json';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find(p => p.slug === slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return <Navigate to="/blog" />;
  }

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(post.title);

  return (
    <div className="mx-auto max-w-5xl py-12 md:py-16">
      <div className="rounded-[36px] border border-border bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)] md:p-12">
        <Link to="/blog" className="mb-10 inline-flex items-center text-sm text-foreground-muted transition-colors hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
        </Link>
        
        <header className="mb-12 border-b border-border pb-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Remote job strategy
          </p>
          <h1 className="mb-6 max-w-4xl text-4xl leading-tight tracking-tight text-foreground md:text-6xl">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-5 text-sm text-foreground-muted">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {post.author}
            </div>
          </div>
        </header>

        <article className="markdown-body mx-auto mb-16 max-w-3xl text-[1.04rem] leading-8 text-foreground md:text-[1.08rem]">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </article>

        <div className="mx-auto max-w-3xl space-y-8">
          <div className="rounded-[28px] border border-border bg-background/80 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-xl text-foreground">
              <Share2 className="h-5 w-5 text-primary" /> Share this article
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={() => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareTitle}&summary=${encodeURIComponent(post.excerpt)}`, '_blank')}>
                <Linkedin className="h-4 w-4" /> LinkedIn
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}%0A%0A${encodeURIComponent(post.excerpt)}`, '_blank')}>
                <Twitter className="h-4 w-4" /> X (Twitter)
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.open(`https://reddit.com/submit?url=${shareUrl}&title=${shareTitle}`, '_blank')}>
                <MessageCircle className="h-4 w-4" /> Reddit
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Link copied to clipboard!');
              }}>
                <LinkIcon className="h-4 w-4" /> Copy Link
              </Button>
            </div>
          </div>

          <div className="rounded-[30px] border border-border bg-foreground px-7 py-8 text-surface shadow-[0_18px_48px_rgba(20,20,19,0.18)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface/70">
              Ready to apply this?
            </p>
            <h3 className="mb-3 text-3xl leading-tight">
              Use Hireschema to turn this strategy into your actual workflow.
            </h3>
            <p className="mb-5 max-w-2xl text-sm leading-7 text-surface/80">
              Find better-fit remote roles, tailor outreach faster, and keep your search moving without losing momentum.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center rounded-full bg-surface px-5 py-3 text-sm font-medium text-foreground"
            >
              Start free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
