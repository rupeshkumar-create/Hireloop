import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { isOnboardingComplete, isFreshlyOnboarded } from '../lib/onboarding';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { useDailyMatchHistory } from '../hooks/useDailyMatchHistory';
import { useDashboardAI } from '../hooks/useDashboardAI';
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import { GettingStartedCard } from '../components/dashboard/GettingStartedCard';
import { DailyMatchHistoryTab } from '../components/dashboard/DailyMatchHistoryTab';
import { LockedMatchCard } from '../components/dashboard/LockedMatchCard';
import { buildMatchFeedItems } from '../components/dashboard/matchPaywall';
import type { Job } from '../types/dashboard';
import { jobFingerprint } from '../services/jobResearcher';
import { getDailyMatchLimit } from '../lib/planLimits';

// ISO country code → display name for the eligibility banner. Falls back to
// the code itself when an unmapped country comes through (rare; defensive).
const COUNTRY_NAMES: Record<string, string> = {
  US: 'the United States', CA: 'Canada', MX: 'Mexico', GB: 'the UK',
  IE: 'Ireland', DE: 'Germany', FR: 'France', NL: 'the Netherlands',
  ES: 'Spain', IT: 'Italy', PT: 'Portugal', PL: 'Poland',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  IN: 'India', SG: 'Singapore', AU: 'Australia', NZ: 'New Zealand',
  JP: 'Japan', CN: 'China', PH: 'the Philippines', ID: 'Indonesia',
  VN: 'Vietnam', TH: 'Thailand', BR: 'Brazil', AR: 'Argentina',
  CL: 'Chile', CO: 'Colombia', PE: 'Peru',
};
function countryDisplayName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

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
  const [dashboardTab, setDashboardTab] = useState<'today' | 'history'>('today');
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
    markJobApplied,
    dismissJob,
    trackJobClick,
    dailyJobsMeta,
    nextJobDeliveryAt,
    userCountry,
    regionFilteredCount,
  } = useDashboardJobs(user, profile, updateProfile);

  const { days: historyDays, loading: historyLoading, totals: historyTotals } =
    useDailyMatchHistory(user);

  const {
    aiAction,
    aiResult,
    setAiResult,
    actionLoading,
    handleAiAction,
    downloadResume,
  } = useDashboardAI(profile);

  const [awaitingPaymentUpgrade, setAwaitingPaymentUpgrade] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') {
      setShowWelcome(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get('payment') === 'success') {
      setAwaitingPaymentUpgrade(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      toast.info('Payment received. Activating Pro…');
    }
  }, []);

  useEffect(() => {
    if (!awaitingPaymentUpgrade) return;
    if (profile?.plan?.toLowerCase() === 'pro') {
      setAwaitingPaymentUpgrade(false);
      toast.success('Welcome to Pro! Scout now delivers 10 matches daily.');
    }
  }, [awaitingPaymentUpgrade, profile?.plan]);

  useEffect(() => {
    if (window.location.hash === '#matches') {
      document.getElementById('matches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loadingJobs]);

  useEffect(() => {
    if (!showWelcome && !isFreshlyOnboarded(profile)) return;
    if (filteredAndSortedJobs.length > 0 || generatingJobs || loadingJobs) return;
    void requestJobs();
  }, [showWelcome, profile?.onboardingCompletedAt, filteredAndSortedJobs.length, generatingJobs, loadingJobs, requestJobs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scout') !== '1') return;
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!generatingJobs && !loadingJobs) {
      void requestJobs();
    }
  }, [generatingJobs, loadingJobs, requestJobs]);

  // First-dashboard-visit booster: if the user just completed onboarding
  // (within the last 5 minutes), auto-open the top match's details panel.
  // Saves them from deciding "which job do I click?" — the highest-scored
  // role + AI Copilot toolbar are right in front of them. Per-browser flag
  // so the second visit lands cleanly without auto-open.
  const [autoOpenedFirstMatch, setAutoOpenedFirstMatch] = useState(false);
  useEffect(() => {
    if (autoOpenedFirstMatch) return;
    if (selectedJob) return;
    if (!profile?.onboardingCompletedAt || !filteredAndSortedJobs.length) return;
    const completedAt = new Date(profile.onboardingCompletedAt).getTime();
    const isFreshOnboarding = !Number.isNaN(completedAt) && Date.now() - completedAt < 5 * 60 * 1000;
    const sessionKey = `hs:auto-opened-top-match:${profile.uid || 'anon'}`;
    if (!isFreshOnboarding) return;
    if (sessionStorage.getItem(sessionKey)) return;
    setSelectedJob(filteredAndSortedJobs[0]);
    sessionStorage.setItem(sessionKey, '1');
    setAutoOpenedFirstMatch(true);
  }, [autoOpenedFirstMatch, selectedJob, profile?.onboardingCompletedAt, profile?.uid, filteredAndSortedJobs]);

  // Show the full daily batch up to the user's plan cap (1 for Free, 10
  // for Pro). Earlier this was hardcoded to 4 and silently hid 6 of a
  // Pro user's matches even though the stat tile said "10 new matches".
  const topJobs = filteredAndSortedJobs.slice(0, getDailyMatchLimit(profile?.plan));
  const matchFeedItems = useMemo(
    () => buildMatchFeedItems(topJobs, profile?.plan),
    [topJobs, profile?.plan]
  );
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

      // First-asset chained CTA — collapse "save → discover Copilot → click"
      // into a single follow-up tap. Only fires for users who haven't generated
      // an asset yet (the activation half they're missing). Once activated,
      // we don't pester them again.
      if (!profile?.activatedAt) {
        toast.success('Saved to your library', {
          duration: 9000,
          action: {
            label: 'Tailor my resume',
            onClick: () => {
              setSelectedJob(job);
              handleAiAction('resume', job);
            },
          },
        });
      }
      return true;
    } finally {
      setSavingJobFingerprints((current) => current.filter((value) => value !== fp));
    }
  };

  if (!isOnboardingComplete(profile)) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <div className="hs-view space-y-7">
      <div className="flex gap-2 border-b border-[var(--hs-app-border)]">
        {([
          ['today', "Today's matches"],
          ['history', 'Match history'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDashboardTab(id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              dashboardTab === id
                ? 'border-[var(--hs-app-accent)] text-[var(--hs-app-fg)]'
                : 'border-transparent text-[var(--hs-app-muted)] hover:text-[var(--hs-app-fg)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {profile?.automationPausedReason === 'inactive_3d' && profile.receiveDailyAlerts === false ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-700">
          Daily Scout was paused after 3 days of inactivity. Open the app again to resume — your next visit re-enables automation.
        </div>
      ) : null}

      {(showWelcome || isFreshlyOnboarded(profile)) && (
        <div className="rounded-xl border border-[var(--hs-app-accent)]/30 bg-[var(--hs-app-accent-soft)] px-5 py-4">
          <div className="text-[13px] font-semibold text-[var(--hs-app-fg)]">
            {filteredAndSortedJobs.length > 0
              ? `You're set up — ${filteredAndSortedJobs.length} ${filteredAndSortedJobs.length === 1 ? 'match' : 'matches'} ready today.`
              : generatingJobs
              ? 'Scout is finding your first matches…'
              : 'Welcome — Scout is preparing your first batch.'}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--hs-app-muted)]">
            {filteredAndSortedJobs.length > 0
              ? 'Click a role below to see why it fits, then save it to unlock the AI Copilot.'
              : 'This usually takes 1–2 minutes. Matches appear here automatically — no refresh needed.'}
          </p>
        </div>
      )}

      {dashboardTab === 'history' ? (
        <DailyMatchHistoryTab
          days={historyDays}
          loading={historyLoading}
          totals={historyTotals}
          jobDetails={{
            saveJob: handleSaveJob,
            dismissJob,
            trackJobClick,
            markJobApplied,
            handleAiAction,
            aiAction,
            aiResult,
            setAiResult,
            actionLoading,
            downloadResume,
            savedFingerprints: savedJobFingerprints,
            savingFingerprints: savingJobFingerprints,
          }}
        />
      ) : (
        <>
      {/* Region banner moved above Getting Started — it answers "why don't
          I see X jobs?" which is the first question a new user asks. */}
      {userCountry !== 'UNKNOWN' && regionFilteredCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-4 py-3 text-[12px] text-[var(--hs-app-muted)]">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--hs-app-accent)]/15 text-[10px] font-semibold text-[var(--hs-app-accent)]">
            {userCountry}
          </span>
          <div>
            <span className="text-[var(--hs-app-fg)] font-medium">
              Showing remote roles eligible for {countryDisplayName(userCountry)}.
            </span>{' '}
            Hidden {regionFilteredCount} role{regionFilteredCount === 1 ? '' : 's'} restricted to other regions
            (e.g. US-only) — Scout learns your eligibility from your resume location.
          </div>
        </div>
      )}
      <GettingStartedCard
        hasMatches={filteredAndSortedJobs.length > 0}
        // Use the LIVE Firestore snapshot count, not the Dashboard-local
        // savedJobFingerprints array. Otherwise saves made on /jobs (the
        // Pipeline page) don't tick the "first save" step of the checklist,
        // because that local state is only populated when the user saves
        // from the dashboard.
        savedCount={(stats as any)?.total ?? savedJobFingerprints.length}
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
        <section id="matches" className="hs-block">
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
          ) : generatingJobs ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--hs-app-accent)]" />
              <div className="text-[15px] font-semibold text-[var(--hs-app-fg)]">Scout is searching for your matches</div>
              <p className="max-w-sm text-sm text-[var(--hs-app-muted)]">
                Checking ATS feeds and job boards against your resume. This usually takes 1–2 minutes.
              </p>
            </div>
          ) : matchFeedItems.length > 0 ? (
            matchFeedItems.map((item) =>
              item.kind === 'locked' ? (
                <LockedMatchCard key={item.id} slot={item.slot} />
              ) : (
                (() => {
                  const job = item.job;
                  const score = job.matchScore || job.finalScore || 0;
                  return (
                    <article
                      key={item.id}
                      className="hs-card-row"
                      onClick={() => setSelectedJob(job)}
                    >
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
                })()
              )
            )
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
              <Link to="/jobs" className="flex items-center justify-between px-5 py-4 text-[12px] font-semibold hover:bg-[var(--hs-app-bg)]">
                Open pipeline
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
        </>
      )}

      {dashboardTab !== 'history' && selectedJob && (
        <JobDetailsPanel
          selectedJob={selectedJob}
          saveJob={handleSaveJob}
          dismissJob={dismissJob}
          trackJobClick={trackJobClick}
          markJobApplied={markJobApplied}
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
