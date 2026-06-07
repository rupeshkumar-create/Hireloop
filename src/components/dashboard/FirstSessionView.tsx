import React from 'react';
import { ArrowRight, Briefcase, Loader2, RefreshCw } from 'lucide-react';
import type { Job } from '../../types/dashboard';
import type { DailyBatchSummary } from './matchPaywall';
import { FreeMatchUpsell } from './FreeMatchUpsell';
import { Button } from '../ui/button';

interface Props {
  topJob: Job | null;
  batchSummary: DailyBatchSummary;
  loadingJobs: boolean;
  generatingJobs: boolean;
  onReviewJob: (job: Job) => void;
  onRunScout: () => void;
  onShowFullDashboard: () => void;
  companyInitials: (company: string) => string;
  formatPosted: (job: Job) => string;
}

export function FirstSessionView({
  topJob,
  batchSummary,
  loadingJobs,
  generatingJobs,
  onReviewJob,
  onRunScout,
  onShowFullDashboard,
  companyInitials,
  formatPosted,
}: Props) {
  const score = topJob ? topJob.matchScore || topJob.finalScore || 0 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--hs-app-muted)]">
          Step 1 of 3
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-[var(--hs-app-fg)] md:text-3xl">
          Scout found your first matches
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
            Usually 1–2 minutes. Matches appear here automatically — no refresh needed.
          </p>
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
                    {topJob.company} · {topJob.location || 'Remote'}
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
                Next: save to Pipeline, then generate a tailored resume or cold email (Pro).
              </p>
            </div>
          </article>

          <FreeMatchUpsell summary={batchSummary} teaserJobs={batchSummary.teaserJobs} />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-10 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-[var(--hs-app-muted)]" />
          <div className="text-[15px] font-semibold text-[var(--hs-app-fg)]">No matches yet</div>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--hs-app-muted)]">
            Scout may still be running, or today&apos;s market is thin for your paths. Try again or broaden career paths
            in Settings.
          </p>
          <Button className="mt-4" onClick={onRunScout} disabled={generatingJobs}>
            {generatingJobs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Find jobs now
          </Button>
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
