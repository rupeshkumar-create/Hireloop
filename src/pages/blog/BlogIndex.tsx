import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import blogPosts from '../../data/blogPosts.json';

export function BlogIndex() {
  // Sort posts by date, newest first
  const sortedPosts = [...blogPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-14 text-center">
          <h1 className="mb-4 text-4xl tracking-tight text-foreground md:text-5xl">
            The Hireschema Blog
          </h1>
          <p className="text-xl leading-8 text-foreground-muted">
            Insights, strategies, and guides on landing the best remote jobs.
          </p>
        </div>

        <div className="grid gap-8">
          {sortedPosts.map((post) => (
            <Link 
              key={post.slug} 
              to={`/blog/${post.slug}`}
              className="block rounded-[28px] border border-border bg-surface p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
            >
              <div className="mb-3 flex items-center gap-2 text-sm text-foreground-muted">
                <Calendar className="w-4 h-4" />
                {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h2 className="mb-3 text-3xl leading-tight text-foreground">
                {post.title}
              </h2>
              <p className="mb-6 leading-7 text-foreground-muted">
                {post.excerpt}
              </p>
              <div className="flex items-center font-medium text-primary">
                Read article <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
