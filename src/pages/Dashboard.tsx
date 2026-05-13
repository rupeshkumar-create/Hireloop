import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { useDashboardAI } from '../hooks/useDashboardAI';
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import { GettingStartedCard } from '../components/dashboard/GettingStartedCard';
import type { Job } from '../types/dashboard';
import { jobFingerprint } from '../services/jobResearcher';
import { getDailyMatchLimit } from '../lib/planLimits';

function companyInitials(company: string) {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'JB';
}

// "Today · May 10"  /  "Yesterday · May 9"  /  "3d ago · May 7"
// Combines a relative freshness label with the actual posted date so users
// see both how stale the listing is AND the calendar date.
function formatPosted(job: Job) {
  let postedDate: Date | null = null;
  let days: number | null = null;

  if (job.postedAt) {
    const d = new Date(job.postedAt);
    if (!Number.isNaN(d.getTime())) {
      postedDate = d;
      days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
    }
  }
  if (days === null && typeof job.daysOld === 'number') {
    days = Math.max(0, job.daysOld);
    postedDate = new Date(Date.now() - days * 86_400_000);
  }

  if (days === null || !postedDate) return 'Fresh';

  const dateLabel = postedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const relative =
    days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
  return `${relative} · ${dateLabel}`;
}

export function Dashboard() {
  const { profile, user, updateProfile } = useAuth();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobFingerprints, setSavedJobFingerprints] = useState<string[]>([]);
  const [savingJobFingerprints, setSavingJobFingerprints] = useState<string[]>([]);

  const {
    filteredAndSortedJobs,
    loadingJobs,
    generatingJobs,
    requestJobs,
    stats,
    saveJob,
    dismissJob,
    trackJobClick,
    dailyJobsMeta,
    nextJobDeliveryAt,
  } = useDashboardJobs(user, profile, updateProfile);

  const {
    aiAction,
    aiResult,
    setAiResult,
    actionLoading,
    handleAiAction,
    downloadResume,
  } = useDashboardAI(profile);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Payment processing. Your account will be upgraded shortly.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Show the full daily batch up to the user's plan cap (1 for Free, 10
  // for Pro). Earlier this was hardcoded to 4 and silently hid 6 of a
  // Pro user's matches even though the stat tile said "10 new matches".
  const topJobs = filteredAndSortedJobs.slice(0, getDailyMatchLimit(profile?.plan));
  const bestScore = topJobs.reduce((max, job) => Math.max(max, job.matchScore || job.finalScore || 0), 0);
  const pipelineCount = (stats as any)?.total || (stats?.saved || 0) + (stats?.applied || 0) + (stats?.interviewing || 0);
  const nextRun = nextJobDeliveryAt ? new Date(nextJobDeliveryAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'tomorrow morning';

  const digest = useMemo(() => {
    const careerPath = profile?.careerPaths?.[0] || 'your saved career paths';
    const top = topJobs[0];
    return [
      top
        ? `${top.company} is the strongest current fit at ${top.matchScore || top.finalScore}/100, mainly because it overlaps with ${top.matchedCareerPath || careerPath}.`
        : `Scout is ready to match roles against ${careerPath}. Generate today's jobs to fill this board.`,
      `${profile?.preferences?.remoteOnly !== false ? 'Remote-only filtering is active' : 'Remote preference is flexible'}, with salary floor ${profile?.preferences?.salaryFloor ? `$${profile.preferences.salaryFloor.toLocaleString()}` : 'not set'}.`,
      dailyJobsMeta?.generatedAt
        ? `Last completed run: ${new Date(dailyJobsMeta.generatedAt).toLocaleString()}.`
        : `Next scheduled run: ${nextRun}.`,
      'Best next action: save the strongest role, then generate a tailored cover letter from the job detail panel.',
    ];
  }, [dailyJobsMeta?.generatedAt, nextRun, profile?.careerPaths, profile?.preferences?.remoteOnly, profile?.preferences?.salaryFloor, topJobs]);

  const handleSaveJob = async (job: Job) => {
    const fp = jobFingerprint(job.title, job.company);
    if (savingJobFingerprints.includes(fp) || savedJobFingerprints.includes(fp)) return false;

    setSavingJobFingerprints((current) => [...current, fp]);
    try {
      const didSave = await saveJob(job);
      if (!didSave) return false;
      setSavedJobFingerprints((current) => (current.includes(fp) ? current : [...current, fp]));
      return true;
    } finally {
      setSavingJobFingerprints((current) => current.filter((value) => value !== fp));
    }
  };

  if (!profile?.resumeText) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <div className="hs-view space-y-7">
      <GettingStartedCard
        hasMatches={filteredAndSortedJobs.length > 0}
        savedCount={savedJobFingerprints.length}
        onRunScout={() => requestJobs()}
        isRunningScout={generatingJobs}
      />
      <div className="hs-stats">
        <div className="hs-stat">
          <div className="hs-stat-num">{filteredAndSortedJobs.length}</div>
          <div className="hs-label mt-2">New matches today</div>
          <div className="hs-stat-delta">From Scout</div>
        </div>
        <div className="hs-stat">
          <div className="hs-stat-num">{dailyJobsMeta?.returnedCount || filteredAndSortedJobs.length || 0}</div>
          <div className="hs-label mt-2">Roles matched so far</div>
          <div className="hs-stat-delta">Latest daily batch</div>
        </div>
        <div className="hs-stat">
          <div className="hs-stat-num">{pipelineCount}</div>
          <div className="hs-label mt-2">Roles in pipeline</div>
          <div className="hs-stat-delta">Saved · Applied · Interview</div>
        </div>
        <div className="hs-stat">
          <div className="hs-stat-num">{bestScore || '—'}</div>
          <div className="hs-label mt-2">Best match score</div>
          <div className="hs-stat-delta">{topJobs[0]?.company || 'Waiting for run'}</div>
        </div>
      </div>

      <div className="hs-grid">
        <section className="hs-block">
          <div className="hs-block-header">
            <div>
              <div className="hs-label mb-1">Today's Scout run</div>
              <div className="hs-section-title">Top matches</div>
            </div>
            <button type="button" className="hs-btn hs-btn-primary" onClick={() => requestJobs()} disabled={generatingJobs}>
              {generatingJobs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Generate daily jobs
            </button>
          </div>

          {loadingJobs ? (
            <div className="p-10 text-center text-sm text-[var(--hs-app-muted)]">Loading your latest Scout run...</div>
          ) : topJobs.length > 0 ? (
            topJobs.map((job) => {
              const score = job.matchScore || job.finalScore || 0;
              return (
                <article key={job.id || job.fingerprint} className="hs-card-row" onClick={() => setSelectedJob(job)}>
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="hs-company-mark">{companyInitials(job.company)}</span>
                      <span className="text-[11px] font-medium text-[var(--hs-app-muted)]">
                        {job.company} · {job.location || 'Remote'}
                      </span>
                    </div>
                    <h2 className="mb-2 text-[14px] font-semibold text-[var(--hs-app-fg)]">{job.title}</h2>
                    <div className="hs-tags mb-3">
                      {job.matchedCareerPath ? <span className="hs-tag">{job.matchedCareerPath}</span> : null}
                      {job.salary ? <span className="hs-tag">{job.salary}</span> : null}
                    </div>
                    <p className="line-clamp-2 text-[12px] leading-6 text-[var(--hs-app-muted)]">
                      {job.aiSummary || job.aiInsight || job.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="hs-score" style={{ '--score': `${score}%` } as React.CSSProperties}>{score}</span>
                    <span className="font-mono text-[9px] text-[var(--hs-app-muted)]">{formatPosted(job)}</span>
                    {job.isHotJob ? <span className="hs-pill hs-pill-success text-[9px]">Hot</span> : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="p-10 text-center">
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-[var(--hs-app-muted)]" />
              <div className="text-[15px] font-semibold">No matches loaded yet</div>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--hs-app-muted)]">
                Run Scout now. It will use your resume, career paths, salary floor, and remote preferences.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="hs-block">
            <div className="hs-block-header">
              <div>
                <div className="hs-label mb-1">Why these roles</div>
                <div className="font-display text-[16px] font-semibold">Today's digest</div>
              </div>
            </div>
            {digest.map((item, index) => (
              <div key={item} className="flex gap-3 border-b border-[var(--hs-app-border)] px-5 py-4 last:border-b-0">
                <span className="font-mono text-[10px] font-bold text-[var(--hs-app-muted)]">{String(index + 1).padStart(2, '0')}</span>
                <p className="text-[13px] leading-6 text-[var(--hs-app-fg)]">{item}</p>
              </div>
            ))}
          </section>

          <section className="hs-block">
            <div className="hs-block-header">
              <div>
                <div className="hs-label mb-1">Pipeline</div>
                <div className="font-display text-[16px] font-semibold">Recent activity</div>
              </div>
            </div>
            <div className="space-y-0">
              <div className="border-b border-[var(--hs-app-border)] px-5 py-4 text-[12px]">
                <strong>Scout found {filteredAndSortedJobs.length} matches</strong>
                <div className="mt-1 font-mono text-[10px] text-[var(--hs-app-muted)]">Latest local session</div>
              </div>
              <div className="border-b border-[var(--hs-app-border)] px-5 py-4 text-[12px]">
                <strong>{pipelineCount} jobs are in your pipeline</strong>
                <div className="mt-1 font-mono text-[10px] text-[var(--hs-app-muted)]">Saved, applied, or interviewing</div>
              </div>
              <Link to="/saved" className="flex items-center justify-between px-5 py-4 text-[12px] font-semibold hover:bg-[var(--hs-app-bg)]">
                Open saved library
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {selectedJob && (
        <JobDetailsPanel
          selectedJob={selectedJob}
          saveJob={handleSaveJob}
          dismissJob={dismissJob}
          trackJobClick={trackJobClick}
          handleAiAction={handleAiAction}
          aiAction={aiAction}
          aiResult={aiResult}
          setAiResult={setAiResult}
          actionLoading={actionLoading}
          downloadResume={downloadResume}
          onClose={() => setSelectedJob(null)}
          isSaved={savedJobFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company))}
          isSaving={savingJobFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company))}
        />
      )}
    </div>
  );
}
