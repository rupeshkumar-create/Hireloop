import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import type { Job } from '../../types/dashboard';
import type { DailyBatchSummary } from './matchPaywall';
import { Button } from '../ui/button';

interface Props {
  summary: DailyBatchSummary;
  teaserJobs: Job[];
}

export function FreeMatchUpsell({ summary, teaserJobs }: Props) {
  if (summary.hiddenCount <= 0) return null;

  return (
    <div className="rounded-xl border border-[var(--hs-app-accent)]/25 bg-[var(--hs-app-accent-soft)] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--hs-app-accent)]/15 text-[var(--hs-app-accent)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--hs-app-fg)]">
            Scout ranked {summary.totalScouted} roles today — you&apos;re viewing your best match
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--hs-app-muted)]">
            Free includes 1 match daily. Pro unlocks all {summary.totalScouted} AI-picked roles plus AI Copilot
            on saved jobs.
          </p>
          {teaserJobs.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {teaserJobs.map((job) => {
                const score = job.matchScore ?? job.finalScore;
                return (
                  <li
                    key={`${job.company}-${job.title}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)]/80 px-2.5 py-1 text-[11px] text-[var(--hs-app-muted)]"
                  >
                    <Lock className="h-3 w-3 text-[var(--hs-app-accent)]" />
                    <span className="font-medium text-[var(--hs-app-fg)]">{job.company}</span>
                    {score ? <span>· {score}/100</span> : null}
                  </li>
                );
              })}
              {summary.hiddenCount > teaserJobs.length ? (
                <li className="inline-flex items-center rounded-full border border-dashed border-[var(--hs-app-border)] px-2.5 py-1 text-[11px] text-[var(--hs-app-muted)]">
                  +{summary.hiddenCount - teaserJobs.length} more on Pro
                </li>
              ) : null}
            </ul>
          ) : null}
          <Link to="/settings#billing-plan" className="mt-3 inline-block">
            <Button variant="action" size="sm">
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
