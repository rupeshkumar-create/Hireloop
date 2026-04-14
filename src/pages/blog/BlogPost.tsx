import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Calendar, User, Share2, Linkedin, Twitter, MessageCircle, Link as LinkIcon } from 'lucide-react';
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
    <div className="mx-auto max-w-4xl py-12 md:py-16">
      <div className="rounded-[32px] border border-border bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)] md:p-12">
        <Link to="/blog" className="mb-8 inline-flex items-center text-sm text-foreground-muted transition-colors hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
        </Link>
        
        <header className="mb-12">
          <h1 className="mb-6 text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-6 border-y border-border py-4 text-sm text-foreground-muted">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </div>
          </div>
        </header>

        <article className="markdown-body mb-16 max-w-none text-[1.02rem] leading-8 text-foreground">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </article>

        <div className="mt-12 border-t border-border pt-8">
          <h3 className="mb-6 flex items-center gap-2 text-xl text-foreground">
            <Share2 className="w-5 h-5 text-primary" /> Share this article
          </h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareTitle}&summary=${encodeURIComponent(post.excerpt)}`, '_blank')}>
              <Linkedin className="w-4 h-4" /> LinkedIn
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}%0A%0A${encodeURIComponent(post.excerpt)}`, '_blank')}>
              <Twitter className="w-4 h-4" /> X (Twitter)
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.open(`https://reddit.com/submit?url=${shareUrl}&title=${shareTitle}`, '_blank')}>
              <MessageCircle className="w-4 h-4" /> Reddit
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Link copied to clipboard!');
            }}>
              <LinkIcon className="w-4 h-4" /> Copy Link
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
