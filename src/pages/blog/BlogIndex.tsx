import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import blogPosts from '../../data/blogPosts.json';

export function BlogIndex() {
  const sortedPosts = [...blogPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [featuredPost, ...secondaryPosts] = sortedPosts;

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <section className="mb-14 rounded-[36px] border border-border bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)] md:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
                Hireschema Journal
              </p>
              <h1 className="mb-5 text-5xl leading-[1.02] tracking-tight text-foreground md:text-6xl">
                Practical remote-job strategy for candidates who want better outcomes.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-foreground-muted">
                Tactics, sourcing ideas, and AI-driven workflows to help serious remote candidates find stronger roles faster.
              </p>
            </div>
            <div className="rounded-[28px] border border-border bg-background/80 p-6">
              <p className="mb-2 text-sm font-medium text-foreground">Get the full workflow</p>
              <p className="mb-5 text-sm leading-6 text-foreground-muted">
                Read the strategy, then use Hireschema to turn it into a repeatable remote job search system.
              </p>
              <Link to="/login" className="inline-flex items-center text-sm font-medium text-primary">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {featuredPost ? (
          <div className="mb-16 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
            <Link
              to={`/blog/${featuredPost.slug}`}
              className="group block rounded-[32px] border border-border bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(0,0,0,0.08)]"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Featured article
              </p>
              <h2 className="mb-4 text-4xl leading-tight text-foreground">
                {featuredPost.title}
              </h2>
              <p className="mb-6 max-w-2xl leading-7 text-foreground-muted">
                {featuredPost.excerpt}
              </p>
              <div className="mb-6 flex items-center gap-3 text-sm text-foreground-muted">
                <Calendar className="h-4 w-4" />
                {new Date(featuredPost.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="flex items-center font-medium text-primary">
                Read featured story <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <div className="space-y-4">
              {secondaryPosts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="block rounded-[28px] border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(0,0,0,0.07)]"
                >
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-foreground-muted">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(post.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <h3 className="mb-2 text-2xl leading-tight text-foreground">
                    {post.title}
                  </h3>
                  <p className="text-sm leading-6 text-foreground-muted">
                    {post.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <section className="rounded-[32px] border border-border bg-foreground px-8 py-10 text-surface shadow-[0_18px_48px_rgba(20,20,19,0.18)] md:px-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface/70">
            Turn reading into action
          </p>
          <h2 className="mb-4 text-4xl leading-tight">
            Use Hireschema to apply the playbook, not just read it.
          </h2>
          <p className="mb-6 max-w-2xl text-base leading-7 text-surface/80">
            Upload your resume, get curated remote matches, tailor assets faster, and keep your entire search organized in one system.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center rounded-full bg-surface px-5 py-3 text-sm font-medium text-foreground"
          >
            Start your free workflow <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
