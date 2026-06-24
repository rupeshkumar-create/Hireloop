import type { DailyJob } from '../../types/dailyJob';
import { ExternalLink, ThumbsDown, ThumbsUp, UserPlus } from 'lucide-react';

type JobMatchCardProps = {
  job: DailyJob;
  onYes: () => void;
  onNo: () => void;
  onIntro?: () => void;
  busy?: boolean;
};

export function JobMatchCard({ job, onYes, onNo, onIntro, busy }: JobMatchCardProps) {
  const score = job.matchScore ?? job.finalScore ?? 0;
  const salary = job.salary || job.estimatedSalary || 'Comp not listed';
  const tags = [
    job.location,
    salary,
    ...(job.requirements?.slice(0, 2) || []),
  ].filter(Boolean);

  return (
    <div className="mt-2 w-full max-w-md rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)]">
            {job.company}
          </p>
          <p className="mt-0.5 text-base font-semibold text-[var(--hs-app-fg)]">{job.title}</p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--hs-app-accent)] text-sm font-bold text-[var(--hs-app-accent)]"
          style={{ borderColor: `color-mix(in oklab, var(--hs-app-accent) ${Math.min(score, 100)}%, var(--hs-app-border))` }}
        >
          {Math.round(score)}%
        </div>
      </div>
      {job.aiSummary ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--hs-app-muted)] line-clamp-3">{job.aiSummary}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded-full bg-[var(--hs-app-bg)] px-2.5 py-0.5 text-[11px] text-[var(--hs-app-muted)]"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onYes}
          className="hs-btn hs-btn-primary flex-1 justify-center text-sm"
        >
          <ThumbsUp className="h-3.5 w-3.5" /> Yes — save this
        </button>
        <button type="button" disabled={busy} onClick={onNo} className="hs-btn flex-1 justify-center text-sm">
          <ThumbsDown className="h-3.5 w-3.5" /> Not for me
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {onIntro ? (
          <button type="button" disabled={busy} onClick={onIntro} className="hs-btn flex-1 justify-center text-sm">
            <UserPlus className="h-3.5 w-3.5" /> Request introduction
          </button>
        ) : null}
        {job.applyUrl ? (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noreferrer"
            className="hs-btn flex-1 justify-center text-sm no-underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View listing
          </a>
        ) : null}
      </div>
    </div>
  );
}
