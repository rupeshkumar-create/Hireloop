import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Loader2, RefreshCw, Settings } from 'lucide-react';
import type { Job } from '../../types/dashboard';
import { Button } from '../ui/button';

interface Props {
  topJob: Job | null;
  loadingJobs: boolean;
  generatingJobs: boolean;
  onReviewJob: (job: Job) => void;
  onRunScout: (opts?: { force?: boolean }) => void;
  onShowFullDashboard: () => void;
  companyInitials: (company: string) => string;
  formatPosted: (job: Job) => string;
}

export function FirstSessionView({
  topJob,
  loadingJobs,
  generatingJobs,
  onReviewJob,
  onRunScout,
  onShowFullDashboard,
  companyInitials,
  formatPosted,
}: Props) {
  const score = topJob ? topJob.matchScore || topJob.finalScore || 0 : 0;
  const heading = generatingJobs
    ? 'Scout is searching for your matches'
    : topJob
    ? 'Scout found your first matches'
    : 'No matches yet — try adjusting your paths';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--hs-app-muted)]">
          Step 1 of 3
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-[var(--hs-app-fg)] md:text-3xl">
          {heading}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--hs-app-muted)]">
          This page is your inbox for new jobs. Save a role to move it to{' '}
          <strong className="font-medium text-[var(--hs-app-fg)]">Pipeline</strong> — where you track applications
          and use AI tools.
        </p>
      </header>

      {loadingJobs ? (
        <div className="rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-10 text-center text-sm text-[var(--hs-app-muted)]">
          Loading your matches…
        </div>
      ) : generatingJobs ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--hs-app-accent)]" />
          <div className="text-[15px] font-semibold text-[var(--hs-app-fg)]">Scout is searching for your matches</div>
          <p className="max-w-sm text-sm text-[var(--hs-app-muted)]">
            First-time runs usually finish in under a minute. Matches appear here automatically — no refresh needed.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => onRunScout({ force: true })}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Taking too long? Retry
          </Button>
        </div>
      ) : topJob ? (
        <>
          <article className="overflow-hidden rounded-2xl border-2 border-[var(--hs-app-accent)]/35 bg-[var(--hs-app-surface)] shadow-sm">
            <div className="border-b border-[var(--hs-app-border)] bg-[var(--hs-app-accent-soft)] px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-accent)]">
                Your strongest match today
              </p>
            </div>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="hs-company-mark">{companyInitials(topJob.company)}</span>
                  <span className="text-[11px] font-medium text-[var(--hs-app-muted)]">
                    {topJob.company} · {topJob.location || 'Flexible'}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-[var(--hs-app-fg)]">{topJob.title}</h2>
                <div className="hs-tags my-3">
                  {topJob.matchedCareerPath ? <span className="hs-tag">{topJob.matchedCareerPath}</span> : null}
                  {topJob.salary ? <span className="hs-tag">{topJob.salary}</span> : null}
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--hs-app-muted)]">
                  {topJob.aiSummary || topJob.aiInsight || topJob.description}
                </p>
                <p className="mt-3 text-[11px] text-[var(--hs-app-muted)]">
                  <span className="font-medium text-[var(--hs-app-fg)]">{score}/100</span> = how well this role fits
                  your resume and career paths.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
                <span className="hs-score text-lg" style={{ '--score': `${score}%` } as React.CSSProperties}>
                  {score}
                </span>
                <span className="font-mono text-[9px] text-[var(--hs-app-muted)]">{formatPosted(topJob)}</span>
              </div>
            </div>
            <div className="border-t border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-5 py-4">
              <Button className="w-full justify-center sm:w-auto" onClick={() => onReviewJob(topJob)}>
                Review this match
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <p className="mt-2 text-[11px] text-[var(--hs-app-muted)]">
                Next: save to Pipeline, then generate a tailored resume or cold email from the job panel.
              </p>
            </div>
          </article>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-10 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-[var(--hs-app-muted)]" />
          <div className="text-[15px] font-semibold text-[var(--hs-app-fg)]">No matches yet</div>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--hs-app-muted)]">
            Scout ran but didn&apos;t find roles strong enough for your profile today. Add 1–2 broader career
            paths or retry — you can also open the full dashboard below.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Button className="w-full sm:w-auto" onClick={() => onRunScout({ force: true })} disabled={generatingJobs}>
              {generatingJobs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Search again
            </Button>
            <Link
              to="/settings#job-preferences"
              className="inline-flex h-9 w-full items-center justify-center rounded-full border border-border bg-transparent px-3 text-xs font-medium text-foreground transition hover:border-border-strong hover:bg-surface-hover sm:w-auto"
            >
              <Settings className="mr-2 h-4 w-4" />
              Edit career paths
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 border-t border-[var(--hs-app-border)] pt-4 text-center">
        <button
          type="button"
          className="text-[12px] font-medium text-[var(--hs-app-muted)] underline-offset-2 hover:text-[var(--hs-app-fg)] hover:underline"
          onClick={onShowFullDashboard}
        >
          Show full dashboard
        </button>
        <p className="text-[11px] text-[var(--hs-app-muted)]">
          Filters, stats, and match history — or save a job above to finish this guided view.
        </p>
      </div>
    </div>
  );
}
