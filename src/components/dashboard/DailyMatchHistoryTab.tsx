import React, { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import type { DailyMatchHistoryDay } from '../../hooks/useDailyMatchHistory';
import type { Job } from '../../types/dashboard';
import type { AiActionType } from '../../hooks/useDashboardAI';
import { JobDetailsPanel } from './JobDetailsPanel';
import { normalizeHistoryJobToDashboardJob } from '../../lib/historyJob';
import { jobFingerprint } from '../../services/jobResearcher';
import { cn } from '../../lib/utils';

type Filter = 'all' | 'saved' | 'unsaved';

function formatDayLabel(dateKey: string): string {
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface DailyMatchHistoryJobDetailsProps {
  saveJob: (job: Job) => Promise<boolean>;
  dismissJob: (job: Job) => void;
  trackJobClick: (job: Job) => void;
  markJobApplied?: (job: Job) => Promise<boolean>;
  handleAiAction: (action: AiActionType, job: Job) => void;
  aiAction: AiActionType;
  aiResult: string | string[];
  setAiResult?: (next: string | string[]) => void;
  actionLoading: boolean;
  downloadResume: (job: Job | null) => void;
  savedFingerprints: string[];
  savingFingerprints: string[];
}

interface DailyMatchHistoryTabProps {
  days: DailyMatchHistoryDay[];
  loading: boolean;
  totals: { days: number; jobs: number; saved: number; unsaved: number };
  jobDetails: DailyMatchHistoryJobDetailsProps;
}

export function DailyMatchHistoryTab({
  days,
  loading,
  totals,
  jobDetails,
}: DailyMatchHistoryTabProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filteredDays = useMemo(() => {
    if (filter === 'all') return days;
    return days
      .map((day) => ({
        ...day,
        jobs: day.jobs.filter((job) => (filter === 'saved' ? job.saved : !job.saved)),
      }))
      .filter((day) => day.jobs.length > 0);
  }, [days, filter]);

  const openJob = (raw: (typeof days)[number]['jobs'][number]) => {
    setSelectedJob(normalizeHistoryJobToDashboardJob(raw));
  };

  const selectedFp = selectedJob ? jobFingerprint(selectedJob.title, selectedJob.company) : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--hs-app-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading match history…
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--hs-app-border)] px-6 py-14 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-[var(--hs-app-muted)]" />
        <p className="text-[15px] font-semibold text-[var(--hs-app-fg)]">No Scout history yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--hs-app-muted)]">
          Each daily Scout run is saved here. Generate your first batch from the Today tab and check back tomorrow.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="hs-stats">
          <div className="hs-stat">
            <div className="hs-stat-num">{totals.days}</div>
            <div className="hs-label mt-2">Scout runs</div>
          </div>
          <div className="hs-stat">
            <div className="hs-stat-num">{totals.jobs}</div>
            <div className="hs-label mt-2">Total matches</div>
          </div>
          <div className="hs-stat">
            <div className="hs-stat-num">{totals.saved}</div>
            <div className="hs-stat-delta">Saved to pipeline</div>
          </div>
          <div className="hs-stat">
            <div className="hs-stat-num">{totals.unsaved}</div>
            <div className="hs-stat-delta">Not saved</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'All jobs'],
            ['saved', 'Saved'],
            ['unsaved', 'Not saved'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                filter === id
                  ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent)]/10 text-[var(--hs-app-fg)]'
                  : 'border-[var(--hs-app-border)] text-[var(--hs-app-muted)] hover:text-[var(--hs-app-fg)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-[12px] text-[var(--hs-app-muted)]">
          Click a role or use <strong className="font-medium text-[var(--hs-app-fg)]">View details</strong> to open the full job panel.
        </p>

        <div className="space-y-6">
          {filteredDays.map((day) => (
            <section key={day.date} className="hs-block overflow-hidden">
              <div className="hs-block-header">
                <div>
                  <div className="hs-label mb-1">Scout run</div>
                  <div className="hs-section-title">{formatDayLabel(day.date)}</div>
                </div>
                <div className="text-right text-[11px] text-[var(--hs-app-muted)]">
                  <div>{day.jobs.length} role{day.jobs.length === 1 ? '' : 's'}</div>
                  {day.generatedAt ? (
                    <div className="font-mono text-[10px]">
                      {new Date(day.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  ) : null}
                </div>
              </div>

              {day.jobs.map((job) => {
                const score = job.matchScore || job.finalScore || 0;
                return (
                  <article
                    key={job.id || `${day.date}-${job.title}-${job.company}`}
                    className="hs-card-row group"
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${job.title} at ${job.company}`}
                    onClick={() => openJob(job)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openJob(job);
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-[var(--hs-app-fg)]">{job.title}</h3>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            job.saved
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-[var(--hs-app-bg)] text-[var(--hs-app-muted)]'
                          )}
                        >
                          {job.saved ? (
                            <BookmarkCheck className="h-3 w-3" />
                          ) : (
                            <Bookmark className="h-3 w-3" />
                          )}
                          {job.saved ? 'Saved' : 'Not saved'}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--hs-app-muted)]">
                        {job.company} · {job.location || 'Flexible'}
                      </p>
                      {job.aiSummary ? (
                        <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-[var(--hs-app-muted)]">
                          {job.aiSummary}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="hs-btn mt-3 inline-flex items-center gap-1 py-1.5 text-[11px] opacity-80 transition-opacity group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          openJob(job);
                        }}
                      >
                        View details
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className="hs-score"
                        style={{ '--score': `${score}%` } as React.CSSProperties}
                      >
                        {score}
                      </span>
                      {job.salary ? (
                        <span className="text-[10px] text-[var(--hs-app-muted)]">{job.salary}</span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      </div>

      {selectedJob && (
        <JobDetailsPanel
          selectedJob={selectedJob}
          saveJob={jobDetails.saveJob}
          dismissJob={jobDetails.dismissJob}
          trackJobClick={jobDetails.trackJobClick}
          markJobApplied={jobDetails.markJobApplied}
          handleAiAction={jobDetails.handleAiAction}
          aiAction={jobDetails.aiAction}
          aiResult={jobDetails.aiResult}
          setAiResult={jobDetails.setAiResult}
          actionLoading={jobDetails.actionLoading}
          downloadResume={jobDetails.downloadResume}
          onClose={() => setSelectedJob(null)}
          isSaved={jobDetails.savedFingerprints.includes(selectedFp)}
          isSaving={jobDetails.savingFingerprints.includes(selectedFp)}
        />
      )}
    </>
  );
}
