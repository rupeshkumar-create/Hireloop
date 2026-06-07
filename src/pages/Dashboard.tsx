import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useAppChrome } from '../contexts/AppChromeContext';
import { isOnboardingComplete, isFreshlyOnboarded, isInFirstSession, shouldUseCompactFreePaywall } from '../lib/onboarding';
import { useDashboardJobsContext } from '../contexts/DashboardJobsContext';
import { useDailyMatchHistory } from '../hooks/useDailyMatchHistory';
import { useDashboardAI } from '../hooks/useDashboardAI';
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import { GettingStartedCard } from '../components/dashboard/GettingStartedCard';
import { ScoutReadinessBanner } from '../components/dashboard/ScoutReadinessBanner';
import { DailyMatchHistoryTab } from '../components/dashboard/DailyMatchHistoryTab';
import { FirstSessionView } from '../components/dashboard/FirstSessionView';
import { FreeMatchUpsell } from '../components/dashboard/FreeMatchUpsell';
import { LockedMatchCard } from '../components/dashboard/LockedMatchCard';
import { buildMatchFeedItems, getDailyBatchSummary } from '../components/dashboard/matchPaywall';
import type { Job } from '../types/dashboard';
import { jobFingerprint } from '../services/jobResearcher';
import { getDailyMatchLimit, isProPlan } from '../lib/planLimits';
import type { PipelineNavigationState } from '../lib/pipelineNavigation';
import { resolveTodayLocalDateKey } from '../lib/localDate';

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
  const { setMinimal } = useAppChrome();
  const navigate = useNavigate();
  const [dashboardTab, setDashboardTab] = useState<'today' | 'history'>('today');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobFingerprints, setSavedJobFingerprints] = useState<string[]>([]);
  const [savingJobFingerprints, setSavingJobFingerprints] = useState<string[]>([]);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [savedThisSession, setSavedThisSession] = useState(0);
  const [lastSavedJobId, setLastSavedJobId] = useState<string | null>(null);

  const {
    filteredAndSortedJobs,
    paywallJobs,
    loadingJobs,
    generatingJobs,
    requestJobs,
    stats,
    saveJob,
    markJobApplied,
    dismissJob,
    trackJobClick,
    pipelineFingerprints,
    dismissedFingerprints,
    dailyJobsMeta,
    nextJobDeliveryAt,
    userCountry,
    regionFilteredCount,
    filterCompany,
    setFilterCompany,
    filterLocation,
    setFilterLocation,
    filterSalary,
    setFilterSalary,
    filterWorkType,
    setFilterWorkType,
    sortBy,
    setSortBy,
  } = useDashboardJobsContext();

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
  const [firstSessionExpanded, setFirstSessionExpanded] = useState(false);
  const [justCompletedFirstSave, setJustCompletedFirstSave] = useState(false);
  const welcomeScoutStartedRef = useRef(false);

  const pipelineCount = (stats as any)?.total || (stats?.saved || 0) + (stats?.applied || 0) + (stats?.interviewing || 0);
  const inFirstSession = isInFirstSession(profile, pipelineCount);
  const showGuidedFirstSession = inFirstSession && !firstSessionExpanded;
  const useCompactPaywall = shouldUseCompactFreePaywall(profile, profile?.plan, pipelineCount);

  useEffect(() => {
    setMinimal(showGuidedFirstSession);
    return () => setMinimal(false);
  }, [showGuidedFirstSession, setMinimal]);

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

    const today = resolveTodayLocalDateKey(new Date(), profile);
    if (profile?.lastSuccessfulJobRunLocalDate === today) return;
    if (welcomeScoutStartedRef.current) return;

    welcomeScoutStartedRef.current = true;
    void requestJobs({ firstRun: true });
  }, [showWelcome, profile?.onboardingCompletedAt, profile?.lastSuccessfulJobRunLocalDate, filteredAndSortedJobs.length, generatingJobs, loadingJobs, requestJobs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scout') !== '1') return;
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!generatingJobs && !loadingJobs) {
      void requestJobs();
    }
  }, [generatingJobs, loadingJobs, requestJobs]);

  const topJobs = filteredAndSortedJobs.slice(0, getDailyMatchLimit(profile?.plan));

  const allSavedFingerprints = useMemo(() => {
    const merged = new Set([...pipelineFingerprints, ...savedJobFingerprints]);
    return Array.from(merged);
  }, [pipelineFingerprints, savedJobFingerprints]);

  /** Today's queue — exclude roles already in Pipeline or skipped to history. */
  const pendingJobs = useMemo(() => {
    return topJobs.filter((job) => {
      const fp = jobFingerprint(job.title, job.company);
      return !allSavedFingerprints.includes(fp) && !dismissedFingerprints.includes(fp);
    });
  }, [topJobs, allSavedFingerprints, dismissedFingerprints]);

  const batchSummary = useMemo(
    () => getDailyBatchSummary(pendingJobs.length > 0 ? pendingJobs : topJobs, profile?.plan, paywallJobs),
    [pendingJobs, topJobs, profile?.plan, paywallJobs]
  );
  const matchFeedItems = useMemo(
    () =>
      buildMatchFeedItems(
        pendingJobs.length > 0 ? pendingJobs : topJobs,
        profile?.plan,
        paywallJobs,
        { compactPaywall: useCompactPaywall }
      ),
    [pendingJobs, topJobs, profile?.plan, paywallJobs, useCompactPaywall]
  );

  const reviewIndex = selectedJob
    ? pendingJobs.findIndex(
        (j) => jobFingerprint(j.title, j.company) === jobFingerprint(selectedJob.title, selectedJob.company)
      )
    : -1;

  const openReviewJob = (job: Job) => {
    setReviewComplete(false);
    setSelectedJob(job);
  };

  const closeReviewPanel = () => {
    setSelectedJob(null);
    setReviewComplete(false);
  };

  const advanceReviewQueue = (afterFingerprint: string) => {
    const remaining = pendingJobs.filter(
      (j) => jobFingerprint(j.title, j.company) !== afterFingerprint
    );
    if (remaining.length > 0) {
      setSelectedJob(remaining[0]);
      setReviewComplete(false);
    } else {
      setSelectedJob(null);
      setReviewComplete(true);
    }
  };

  const handleSkipJob = (job: Job) => {
    const fp = jobFingerprint(job.title, job.company);
    dismissJob(job);
    toast.info('Moved to Match history', {
      description: `${job.title} at ${job.company} — find it under the History tab.`,
    });
    advanceReviewQueue(fp);
  };

  const goToPreviousReviewJob = () => {
    if (reviewIndex <= 0) return;
    setSelectedJob(pendingJobs[reviewIndex - 1]);
  };

  const goToNextReviewJob = () => {
    if (reviewIndex < 0 || reviewIndex >= pendingJobs.length - 1) return;
    setSelectedJob(pendingJobs[reviewIndex + 1]);
  };
  const hasActiveFilters =
    filterCompany.trim().length > 0 ||
    filterLocation.trim().length > 0 ||
    filterSalary.trim().length > 0 ||
    filterWorkType !== 'all' ||
    sortBy !== 'matchScore';
  const bestScore = topJobs.reduce((max, job) => Math.max(max, job.matchScore || job.finalScore || 0), 0);
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
    if (savingJobFingerprints.includes(fp) || allSavedFingerprints.includes(fp)) return false;

    const isFirstEverSave = pipelineCount === 0 && savedThisSession === 0;

    setSavingJobFingerprints((current) => [...current, fp]);
    try {
      const jobId = await saveJob(job);
      if (!jobId) return false;
      setSavedJobFingerprints((current) => (current.includes(fp) ? current : [...current, fp]));
      setSavedThisSession((n) => n + 1);
      setLastSavedJobId(jobId);

      if (isFirstEverSave) {
        await updateProfile({ firstSessionCompletedAt: new Date().toISOString() });
        setJustCompletedFirstSave(true);
      }

      toast.success('Saved to Pipeline', {
        description: isProPlan(profile?.plan)
          ? `${job.title} at ${job.company} — cold email, resume, and interview prep are generating now.`
          : `${job.title} at ${job.company} saved. Pro unlocks auto-generated application assets.`,
      });

      if (
        selectedJob &&
        jobFingerprint(selectedJob.title, selectedJob.company) === fp
      ) {
        advanceReviewQueue(fp);
      }
      return true;
    } finally {
      setSavingJobFingerprints((current) => current.filter((value) => value !== fp));
    }
  };

  const handleGoToPipeline = () => {
    navigate('/jobs', {
      state: {
        highlightJobId: lastSavedJobId ?? undefined,
        fromSave: true,
      } satisfies PipelineNavigationState,
    });
  };

  const handleShowFullDashboard = () => {
    setFirstSessionExpanded(true);
  };

  if (!isOnboardingComplete(profile)) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <div className="hs-view space-y-7">
      {!showGuidedFirstSession ? (
        <div className="flex gap-2 border-b border-[var(--hs-app-border)]">
          {([
            ['today', "Today's matches"],
            ...(inFirstSession ? [] : [['history', 'Match history'] as const]),
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
      ) : null}

      {profile?.automationPausedReason === 'inactive_3d' && profile.receiveDailyAlerts === false ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-700">
          Daily Scout was paused after 3 days of inactivity. Open the app again to resume — your next visit re-enables automation.
        </div>
      ) : null}

      <ScoutReadinessBanner
        profile={profile}
        hasMatches={filteredAndSortedJobs.length > 0}
        generatingJobs={generatingJobs}
      />

      {justCompletedFirstSave ? (
        <div className="rounded-xl border border-[var(--hs-app-accent)]/30 bg-[var(--hs-app-accent-soft)] px-5 py-4">
          <div className="text-[13px] font-semibold text-[var(--hs-app-fg)]">Nice — your first role is saved</div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--hs-app-muted)]">
            {isProPlan(profile?.plan)
              ? 'Pipeline is where you track status and generate application assets. Tomorrow Scout will deliver a fresh batch here on the dashboard.'
              : 'Pipeline is where you track saved roles. Upgrade to Pro when you are ready for AI application assets.'}
          </p>
        </div>
      ) : null}

      {!showGuidedFirstSession && (showWelcome || isFreshlyOnboarded(profile)) && !justCompletedFirstSave ? (
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
              ? isProPlan(profile?.plan)
                ? 'Review matches here. Save a role to send it to Pipeline — where you track applications and use AI Copilot.'
                : 'Review your best match here. Save roles to Pipeline to track applications. Upgrade to Pro for AI-tailored resumes, cold emails, and interview prep.'
              : 'This usually takes 1–2 minutes. Matches appear here automatically — no refresh needed.'}
          </p>
        </div>
      ) : null}

      {showGuidedFirstSession ? (
        <FirstSessionView
          topJob={topJobs[0] || null}
          batchSummary={batchSummary}
          loadingJobs={loadingJobs}
          generatingJobs={generatingJobs}
          onReviewJob={openReviewJob}
          onRunScout={(opts) => void requestJobs({ firstRun: true, force: opts?.force })}
          onShowFullDashboard={() => void handleShowFullDashboard()}
          companyInitials={companyInitials}
          formatPosted={formatPosted}
        />
      ) : dashboardTab === 'history' ? (
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
            savedFingerprints: allSavedFingerprints,
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
          <div className="hs-stat-num">{pendingJobs.length}</div>
          <div className="hs-label mt-2">To review today</div>
          <div className="hs-stat-delta">{topJobs.length - pendingJobs.length} saved or skipped</div>
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

          <div className="border-b border-[var(--hs-app-border)] px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                className="hs-form-input min-w-[120px] flex-1 text-[12px]"
                placeholder="Filter company"
                value={filterCompany}
                onChange={(event) => setFilterCompany(event.target.value)}
                aria-label="Filter by company"
              />
              <input
                type="search"
                className="hs-form-input min-w-[120px] flex-1 text-[12px]"
                placeholder="Filter location"
                value={filterLocation}
                onChange={(event) => setFilterLocation(event.target.value)}
                aria-label="Filter by location"
              />
              <input
                type="search"
                className="hs-form-input min-w-[100px] flex-1 text-[12px]"
                placeholder="Filter salary"
                value={filterSalary}
                onChange={(event) => setFilterSalary(event.target.value)}
                aria-label="Filter by salary"
              />
              <select
                className="hs-form-input text-[12px]"
                value={filterWorkType}
                onChange={(event) => setFilterWorkType(event.target.value as 'all' | 'remote')}
                aria-label="Filter by work type"
              >
                <option value="all">All work types</option>
                <option value="remote">Remote only</option>
              </select>
              <select
                className="hs-form-input text-[12px]"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                aria-label="Sort matches"
              >
                <option value="matchScore">Best match</option>
                <option value="datePosted">Newest posted</option>
                <option value="company">Company A–Z</option>
              </select>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="hs-btn text-[11px]"
                  onClick={() => {
                    setFilterCompany('');
                    setFilterLocation('');
                    setFilterSalary('');
                    setFilterWorkType('all');
                    setSortBy('matchScore');
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            {hasActiveFilters ? (
              <p className="mt-2 text-[11px] text-[var(--hs-app-muted)]">
                Showing {topJobs.length} of {filteredAndSortedJobs.length} visible matches
                {regionFilteredCount > 0 ? ` · ${regionFilteredCount} hidden by region eligibility` : ''}
              </p>
            ) : null}
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
          ) : pendingJobs.length === 0 && topJobs.length > 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[var(--hs-app-accent)]" />
              <div className="text-[15px] font-semibold">All of today&apos;s matches reviewed</div>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--hs-app-muted)]">
                Saved roles are in Pipeline. Skipped roles are in Match history.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {pipelineCount > 0 ? (
                  <Link to="/jobs" className="hs-btn hs-btn-primary">
                    Open Pipeline <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                ) : null}
                <button type="button" className="hs-btn" onClick={() => setDashboardTab('history')}>
                  View Match history
                </button>
              </div>
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
                      onClick={() => openReviewJob(job)}
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
          {useCompactPaywall && topJobs.length > 0 ? (
            <div className="border-t border-[var(--hs-app-border)] p-5">
              <FreeMatchUpsell summary={batchSummary} teaserJobs={batchSummary.teaserJobs} />
            </div>
          ) : null}
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
                <div className="hs-label mb-1">Your saved roles</div>
                <div className="font-display text-[16px] font-semibold">Pipeline snapshot</div>
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
                Open full Pipeline
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
        </>
      )}

      {(selectedJob || reviewComplete) && (
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
          onClose={closeReviewPanel}
          isSaved={selectedJob ? allSavedFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company)) : false}
          isSaving={selectedJob ? savingJobFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company)) : false}
          reviewIndex={reviewIndex >= 0 ? reviewIndex : 0}
          reviewTotal={pendingJobs.length || topJobs.length}
          onPrevious={reviewIndex > 0 ? goToPreviousReviewJob : undefined}
          onNext={reviewIndex >= 0 && reviewIndex < pendingJobs.length - 1 ? goToNextReviewJob : undefined}
          onSkip={selectedJob ? () => handleSkipJob(selectedJob) : undefined}
          reviewComplete={reviewComplete}
          savedThisSession={savedThisSession}
          onGoToPipeline={handleGoToPipeline}
        />
      )}
    </div>
  );
}
