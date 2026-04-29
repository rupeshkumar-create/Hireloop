import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, MapPin, DollarSign, Calendar,
  X, Lock, BookmarkPlus, ChevronDown, ChevronUp,
  Zap, AlertCircle, CheckCircle2, ExternalLink,
  Clock, Wifi, Globe, ArrowUpDown,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import type { DailyJob } from '../../types/dailyJob';
import type { Job, SortOption } from '../../types/dashboard';
import { cn } from '../../lib/utils';
import { isProPlan } from '../../lib/planLimits';
import { buildMatchFeedItems } from './matchPaywall';
import { jobFingerprint } from '../../services/jobResearcher';
import { resolveJobApplicationUrlWithFallback, isJobUrlFallback } from '../../lib/jobLinks';

interface MatchesTabProps {
  plan?: string;
  jobs: Job[];
  loadingJobs: boolean;
  generatingJobs?: boolean;
  onRequestJobs?: () => void;
  fetchJobs: (force?: boolean) => void;
  filterCompany: string;
  setFilterCompany: (v: string) => void;
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  filterSalary: string;
  setFilterSalary: (v: string) => void;
  filterWorkType: 'remote' | 'all';
  setFilterWorkType: (v: 'remote' | 'all') => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  selectedJob: Job | null;
  setSelectedJob: (j: Job | null) => void;
  setAiAction: (v: any) => void;
  saveJob: (j: Job) => Promise<boolean>;
  savedJobFingerprints: string[];
  dismissJob: (j: Job) => void;
  lastFetchTime?: string | null;
  dailyJobsMeta?: {
    requestedLimit?: number;
    returnedCount?: number;
    qualityLimited?: boolean;
    warnings?: string[];
  } | null;
  nextJobDeliveryAt?: string | null;
}

// ── Work-type badge ──────────────────────────────────────────────────────────
function WorkTypeBadge({ workType, location }: { workType?: string; location?: string }) {
  const isRemote =
    workType === 'remote' ||
    (location || '').toLowerCase().includes('remote');

  if (isRemote) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
        <Wifi className="h-3 w-3" />
        Remote
      </span>
    );
  }
  if (workType === 'hybrid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
        <Globe className="h-3 w-3" />
        Hybrid
      </span>
    );
  }
  if (workType === 'onsite') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
        <MapPin className="h-3 w-3" />
        On-site
      </span>
    );
  }
  return null;
}

// ── Career path chip ─────────────────────────────────────────────────────────
function CareerPathChip({ path }: { path: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
      {path}
    </span>
  );
}

// ── Match score bar ───────────────────────────────────────────────────────────
function MatchScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-[var(--ember-400)]' :
    score >= 60 ? 'bg-border-strong' :
    score >= 40 ? 'bg-border' :
    'bg-border';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className={cn(
        'text-xs font-medium tabular-nums',
        score >= 80 ? 'text-[var(--ember-400)]' :
        'text-foreground-muted'
      )}>
        {score}%
      </span>
    </div>
  );
}

// ── Inline expanded job detail ───────────────────────────────────────────────
function InlineJobDetail({ job, onSave, isSaved, isSaving, onDismiss }: {
  job: DailyJob;
  onSave: () => void;
  isSaved: boolean;
  isSaving: boolean;
  onDismiss: () => void;
}) {
  const applyUrl = resolveJobApplicationUrlWithFallback(job);
  const isFallbackUrl = isJobUrlFallback(job);

  return (
    <div className="mt-4 border-t border-border pt-4 space-y-4">

      {job.aiSummary && (
        <p className="text-sm text-foreground leading-relaxed">{job.aiSummary}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {job.matchReasons && job.matchReasons.length > 0 && (
          <div className="rounded-xl bg-[rgba(127,184,147,0.16)] p-3">
            <p className="text-xs font-medium text-[var(--signal-success)] mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Why you match
            </p>
            <ul className="space-y-1">
              {job.matchReasons.slice(0, 4).map((r, i) => (
                <li key={i} className="text-xs text-foreground flex gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {job.skillGaps && job.skillGaps.length > 0 && (
          <div className="rounded-xl bg-[rgba(212,168,90,0.16)] p-3">
            <p className="text-xs font-medium text-[var(--signal-warn)] mb-2 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Skill gaps
            </p>
            <ul className="space-y-1">
              {job.skillGaps.slice(0, 4).map((g, i) => (
                <li key={i} className="text-xs text-foreground flex gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>{g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {job.requirements && job.requirements.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground-muted mb-2">Key requirements</p>
          <div className="flex flex-wrap gap-1.5">
            {job.requirements.slice(0, 10).map((r, i) => (
              <span key={i} className="rounded-md border border-border bg-surface px-2.5 py-0.5 text-xs text-foreground-muted">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-foreground-muted hover:text-foreground list-none flex items-center gap-1 select-none">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          Full job description
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl bg-surface p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap border border-border">
          {job.description}
        </div>
      </details>

      {job.isHotJob && job.hotSignals && job.hotSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.hotSignals.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-[rgba(212,168,90,0.16)] px-2.5 py-0.5 text-xs font-medium text-[var(--signal-warn)]">
              <Zap className="h-3 w-3" />{s}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant={isSaved ? 'secondary' : 'action'}
          size="sm"
          disabled={isSaved || isSaving}
          onClick={onSave}
          className="flex-1"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
          {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save Job'}
        </Button>

        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={isFallbackUrl ? 'Search for this job on Google' : 'Open application page'}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground-muted transition-colors duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-foreground hover:border-border-strong"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {isFallbackUrl ? 'Find & Apply' : 'Apply'}
        </a>

        <Button variant="ghost" size="icon" className="shrink-0 text-foreground-muted" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Job card ─────────────────────────────────────────────────────────────────
function JobCard({
  job, isSaved, isSaving, isExpanded, onToggleExpand, onSave, onDismiss,
}: {
  job: DailyJob;
  isSaved: boolean;
  isSaving: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const postedLabel = job.daysOld === 0
    ? 'Today'
    : job.daysOld === 1
    ? 'Yesterday'
    : job.daysOld != null
    ? `${job.daysOld}d ago`
    : job.postedAt
    ? new Date(job.postedAt).toLocaleDateString()
    : '';

  return (
    <Card
      className={cn(
        'hover:border-border-strong',
        isExpanded ? 'border-[var(--ember-400)] bg-[var(--ember-tint)]' : ''
      )}
    >
      <CardContent className="p-5">
        {/* Top strip: work type + career path + hot badge */}
        <div className="flex items-center gap-2 mb-3 flex-wrap" onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
          <WorkTypeBadge workType={job.workType} location={job.location} />
          {job.matchedCareerPath && (
            <CareerPathChip path={job.matchedCareerPath} />
          )}
          {job.isHotJob && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(212,168,90,0.16)] px-2 py-0.5 text-xs font-medium text-[var(--signal-warn)]">
              <Zap className="h-3 w-3" /> Hot
            </span>
          )}
        </div>

        {/* Header row */}
        <div className="flex justify-between items-start gap-3" onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
          <div className="min-w-0">
            <h3 className="text-lg font-medium leading-tight tracking-[-0.01em] text-foreground">{job.title}</h3>
            <p className="text-foreground-muted font-medium mt-0.5">{job.company}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {job.matchScore !== undefined && (
              <MatchScoreBar score={job.matchScore} />
            )}
            {isExpanded
              ? <ChevronUp className="h-4 w-4 text-foreground-muted" />
              : <ChevronDown className="h-4 w-4 text-foreground-muted" />}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-3 text-sm text-foreground-muted" onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
          {job.location && (
            <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{job.location}</div>
          )}
          {(job.salary || job.estimatedSalary) && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              {job.salary || job.estimatedSalary}
              {!job.salary && job.estimatedSalary && (
                <span className="text-xs text-foreground-muted/70">(est.)</span>
              )}
            </div>
          )}
          {postedLabel && (
            <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" />{postedLabel}</div>
          )}
          {job.companyStage && job.companyStage !== 'Unknown' && (
            <div className="flex items-center gap-1 text-xs">{job.companyStage}</div>
          )}
        </div>

        {/* Quick summary */}
        {!isExpanded && job.aiSummary && (
          <p className="mt-2 text-xs text-foreground-muted line-clamp-2 cursor-pointer" onClick={onToggleExpand}>
            {job.aiSummary}
          </p>
        )}

        {/* Expanded detail */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <InlineJobDetail
                job={job}
                onSave={onSave}
                isSaved={isSaved}
                isSaving={isSaving}
                onDismiss={onDismiss}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ── MatchesTab (main export) ─────────────────────────────────────────────────
export function MatchesTab({
  plan, jobs, loadingJobs, generatingJobs, onRequestJobs, fetchJobs,
  filterCompany, setFilterCompany,
  filterLocation, setFilterLocation,
  filterSalary, setFilterSalary,
  filterWorkType, setFilterWorkType,
  sortBy, setSortBy,
  selectedJob, setSelectedJob, setAiAction,
  saveJob, savedJobFingerprints, dismissJob,
  lastFetchTime,
  dailyJobsMeta,
  nextJobDeliveryAt,
}: MatchesTabProps) {
  const feedItems = buildMatchFeedItems(jobs, plan);
  const showLockedCards = !isProPlan(plan) && jobs.length > 0;

  const [savingFingerprints, setSavingFingerprints] = useState<string[]>([]);
  const [expandedFingerprint, setExpandedFingerprint] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleSave = async (job: DailyJob) => {
    const fp = jobFingerprint(job.title, job.company);
    setSavingFingerprints((cur) => [...cur, fp]);
    try {
      await saveJob(job);
    } finally {
      setSavingFingerprints((cur) => cur.filter((f) => f !== fp));
    }
  };

  const handleDismiss = (job: DailyJob) => {
    const fp = jobFingerprint(job.title, job.company);
    if (expandedFingerprint === fp) setExpandedFingerprint(null);
    dismissJob(job);
  };

  const toggleExpand = (job: DailyJob) => {
    const fp = jobFingerprint(job.title, job.company);
    setExpandedFingerprint((cur) => (cur === fp ? null : fp));
    setSelectedJob(job);
    setAiAction(null);
  };

  const remoteCount = jobs.filter(
    (j) => j.workType === 'remote' || (j.location || '').toLowerCase().includes('remote')
  ).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h2 className="text-2xl tracking-tight text-foreground">Your Daily Matches</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Remote-first · AI-curated from your resume &amp; career goals
            {lastFetchTime && (
              <span className="ml-2 text-foreground-muted/60">
                · Updated {new Date(lastFetchTime).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        {showLockedCards && (
          <Link to="/settings#billing-plan">
            <Button variant="action" size="sm">Upgrade to Pro</Button>
          </Link>
        )}
      </div>

      {(dailyJobsMeta || nextJobDeliveryAt) && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4 text-sm text-foreground-muted">
          {nextJobDeliveryAt && (
            <p>
              <span className="font-medium text-foreground">Next delivery:</span>{' '}
              {new Date(nextJobDeliveryAt).toLocaleString()}
            </p>
          )}
          {dailyJobsMeta?.qualityLimited && (
            <p className="mt-1">
              Only {dailyJobsMeta.returnedCount ?? jobs.length} strong match
              {(dailyJobsMeta.returnedCount ?? jobs.length) === 1 ? '' : 'es'} found today.
            </p>
          )}
          {(dailyJobsMeta?.warnings || []).map((warning) => (
            <p key={warning} className="mt-1">{warning}</p>
          ))}
        </div>
      )}

      {/* Work-type toggle + sort */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
        {/* Remote / All tabs */}
        <div className="flex rounded-full border border-border bg-surface-hover p-0.5 gap-0.5">
          <button
            onClick={() => setFilterWorkType('remote')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              filterWorkType === 'remote'
                ? 'bg-surface text-foreground'
                : 'text-foreground-muted hover:text-foreground'
            )}
          >
            <Wifi className="h-3.5 w-3.5" />
            Remote
            {remoteCount > 0 && (
              <span className={cn(
                'ml-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
                filterWorkType === 'remote' ? 'bg-[var(--ember-tint)] text-foreground' : 'bg-border text-foreground-muted'
              )}>
                {remoteCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterWorkType('all')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              filterWorkType === 'all'
                ? 'bg-surface text-foreground'
                : 'text-foreground-muted hover:text-foreground'
            )}
          >
            All
            {jobs.length > 0 && (
              <span className={cn(
                'ml-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
                filterWorkType === 'all' ? 'bg-border text-foreground-muted' : 'bg-border text-foreground-muted'
              )}>
                {jobs.length}
              </span>
            )}
          </button>
        </div>

        {/* Sort + advanced filters toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-foreground-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground-muted outline-none transition-[border-color,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:border-[var(--ember-400)] focus-visible:shadow-[var(--ember-glow)]"
            >
              <option value="matchScore">Best match</option>
              <option value="datePosted">Newest first</option>
              <option value="company">Company A–Z</option>
            </select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground-muted text-xs"
            onClick={() => setShowAdvancedFilters((v) => !v)}
          >
            Filters {showAdvancedFilters ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Advanced filters (collapsible) */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mb-4 flex-shrink-0"
          >
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 rounded-2xl border border-border bg-surface p-3">
              <Input placeholder="Filter by company…" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="text-sm" />
              <Input placeholder="Filter by location…" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="text-sm" />
              <Input placeholder="Filter by salary…" value={filterSalary} onChange={(e) => setFilterSalary(e.target.value)} className="text-sm" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-8">
        {loadingJobs && jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            <p className="text-foreground-muted font-medium animate-pulse">Loading your curated job matches…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            {generatingJobs ? (
              <>
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-[var(--ember-400)]" />
                  <Wifi className="absolute inset-0 m-auto h-4 w-4 text-[var(--ember-400)] opacity-60" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Finding remote jobs for you…</p>
                  <p className="mt-1 text-sm text-foreground-muted max-w-xs">
                    Perplexity is scanning live job boards for each of your career paths. Claude is scoring and enriching every match. Takes about 60–90 seconds.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground-muted/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--ember-400)] animate-pulse" />
                  Searching LinkedIn · Greenhouse · Lever · Wellfound · Remote.co
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-xl border border-border bg-surface-hover flex items-center justify-center">
                  <Wifi className="h-8 w-8 text-foreground-muted" />
                </div>
                <div>
                  <p className="font-medium text-foreground">No remote jobs curated yet today</p>
                  <p className="mt-1 text-sm text-foreground-muted max-w-xs">
                    {isProPlan(plan)
                      ? 'Generate your 10 personalised remote matches right now, or wait for the daily cron at 8 AM IST.'
                      : 'Your 1 daily remote match will appear automatically at 8 AM IST.'}
                  </p>
                </div>
                {isProPlan(plan) && onRequestJobs && (
                  <Button variant="action" onClick={onRequestJobs} className="mt-2">
                    <Zap className="mr-2 h-4 w-4" />
                    Find my remote jobs now
                  </Button>
                )}
              </>
            )}
          </div>
        ) : feedItems.length === 0 ? (
          /* All jobs filtered out by work-type toggle */
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Wifi className="h-8 w-8 text-foreground-muted/30" />
            <p className="text-sm font-medium text-foreground-muted">No remote jobs in today's batch</p>
            <button
              onClick={() => setFilterWorkType('all')}
              className="text-xs text-primary underline underline-offset-2"
            >
              Show all work types
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {feedItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
              >
                {item.kind === 'job' ? (
                  (() => {
                    const job = item.job as DailyJob;
                    const fp = jobFingerprint(job.title, job.company);
                    return (
                      <JobCard
                        job={job}
                        isSaved={savedJobFingerprints.includes(fp)}
                        isSaving={savingFingerprints.includes(fp)}
                        isExpanded={expandedFingerprint === fp}
                        onToggleExpand={() => toggleExpand(job)}
                        onSave={() => handleSave(job)}
                        onDismiss={() => handleDismiss(job)}
                      />
                    );
                  })()
                ) : (
                  /* Locked / paywall card */
                  <Card className="relative overflow-hidden border-border bg-surface/90">
                    <CardContent className="p-5">
                      <div className="pointer-events-none select-none blur-[3px] opacity-80">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
                            <Wifi className="h-3 w-3" /> Remote
                          </span>
                        </div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-medium leading-tight tracking-[-0.01em] text-foreground">{item.slot.title}</h3>
                            <p className="text-foreground-muted font-medium">{item.slot.company}</p>
                          </div>
                          <Badge variant="secondary" className="font-medium">Locked</Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-foreground-muted">
                          <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {item.slot.location}</div>
                          <div className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4" /> {item.slot.salary}</div>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.12)] backdrop-blur-sm">
                        <div className="mx-6 flex max-w-xs flex-col items-center rounded-xl border border-border bg-background/95 px-5 py-4 text-center">
                          <Lock className="mb-2 h-5 w-5 text-primary" />
                          <p className="text-sm font-medium text-foreground">{item.slot.teaser}</p>
                          <p className="mt-1 text-xs text-foreground-muted">Go Pro to unlock 10 remote matches daily.</p>
                          {item.slot.index === 0 && (
                            <Link to="/settings#billing-plan" className="mt-3">
                              <Button variant="action" size="sm">Upgrade to Pro</Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
