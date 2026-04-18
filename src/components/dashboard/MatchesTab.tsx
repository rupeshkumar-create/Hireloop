import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, MapPin, DollarSign, Calendar, ArrowUpDown,
  X, Lock, BookmarkPlus, ChevronDown, ChevronUp,
  Zap, TrendingUp, AlertCircle, CheckCircle2, ExternalLink,
  Clock, Briefcase,
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
import { jobFingerprint } from '../../services/jobHarvester';

interface MatchesTabProps {
  plan?: string;
  jobs: Job[];
  loadingJobs: boolean;
  fetchJobs: (force?: boolean) => void;
  filterCompany: string;
  setFilterCompany: (v: string) => void;
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  filterSalary: string;
  setFilterSalary: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  selectedJob: Job | null;
  setSelectedJob: (j: Job | null) => void;
  setAiAction: (v: any) => void;
  saveJob: (j: Job) => Promise<boolean>;
  savedJobFingerprints: string[];
  dismissJob: (j: Job) => void;
  lastFetchTime?: string | null;
}

// ── Work-type badge colours ──────────────────────────────────────────────────
function WorkTypeBadge({ workType }: { workType?: string }) {
  if (!workType || workType === 'unknown') return null;
  const styles: Record<string, string> = {
    remote:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    hybrid:  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    onsite:  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', styles[workType] || 'bg-muted text-muted-foreground')}>
      <Briefcase className="h-3 w-3" />
      {workType.charAt(0).toUpperCase() + workType.slice(1)}
    </span>
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
  return (
    <div className="mt-4 border-t border-border pt-4 space-y-4">

      {/* AI Summary */}
      {job.aiSummary && (
        <p className="text-sm text-foreground leading-relaxed">{job.aiSummary}</p>
      )}

      {/* Match reasons + Skill gaps */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {job.matchReasons && job.matchReasons.length > 0 && (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Why you match
            </p>
            <ul className="space-y-1">
              {job.matchReasons.slice(0, 4).map((r, i) => (
                <li key={i} className="text-xs text-green-900 dark:text-green-300 flex gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {job.skillGaps && job.skillGaps.length > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Skill gaps
            </p>
            <ul className="space-y-1">
              {job.skillGaps.slice(0, 4).map((g, i) => (
                <li key={i} className="text-xs text-amber-900 dark:text-amber-300 flex gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>{g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Requirements */}
      {job.requirements && job.requirements.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground-muted mb-2">Key requirements</p>
          <div className="flex flex-wrap gap-1.5">
            {job.requirements.slice(0, 10).map((r, i) => (
              <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-foreground-muted">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Full description */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-foreground-muted hover:text-foreground list-none flex items-center gap-1 select-none">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          Full job description
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl bg-surface p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap border border-border">
          {job.description}
        </div>
      </details>

      {/* Hot signals */}
      {job.isHotJob && job.hotSignals && job.hotSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.hotSignals.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
              <Zap className="h-3 w-3" />{s}
            </span>
          ))}
        </div>
      )}

      {/* CTA row */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant={isSaved ? 'secondary' : 'action'}
          size="sm"
          disabled={isSaved || isSaving}
          onClick={onSave}
          className="flex-1"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
          {isSaved ? 'Saved to Tracker' : isSaving ? 'Saving…' : 'Save to Tracker'}
        </Button>

        {job.applyUrl && (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Apply externally
          </a>
        )}

        <Button variant="ghost" size="icon" className="shrink-0 text-foreground-muted" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main job card ────────────────────────────────────────────────────────────
function JobCard({
  job,
  isSaved,
  isSaving,
  isExpanded,
  onToggleExpand,
  onSave,
  onDismiss,
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
        'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-border-strong',
        isExpanded ? 'border-border-strong ring-1 ring-ring' : ''
      )}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex justify-between items-start gap-3" onClick={onToggleExpand}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground font-display text-lg leading-tight">{job.title}</h3>
              {job.isHotJob && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                  <Zap className="h-3 w-3" /> Hot
                </span>
              )}
            </div>
            <p className="text-foreground-muted font-medium mt-0.5">{job.company}</p>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            {job.matchScore !== undefined && (
              <Badge
                variant={job.matchScore >= 80 ? 'success' : job.matchScore >= 60 ? 'secondary' : 'outline'}
                className="font-semibold"
              >
                {job.matchScore}% match
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-foreground-muted mt-1" />
            ) : (
              <ChevronDown className="h-4 w-4 text-foreground-muted mt-1" />
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-3 text-sm text-foreground-muted" onClick={onToggleExpand}>
          <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</div>
          {(job.salary || job.estimatedSalary) && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {job.salary || job.estimatedSalary}
              {!job.salary && job.estimatedSalary && (
                <span className="text-xs text-foreground-muted/70">(est.)</span>
              )}
            </div>
          )}
          {postedLabel && (
            <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{postedLabel}</div>
          )}
          <WorkTypeBadge workType={job.workType} />
          {job.companyStage && job.companyStage !== 'Unknown' && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />{job.companyStage}
            </div>
          )}
        </div>

        {/* Quick summary (collapsed state) */}
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
  plan,
  jobs, loadingJobs, fetchJobs,
  filterCompany, setFilterCompany,
  filterLocation, setFilterLocation,
  filterSalary, setFilterSalary,
  sortBy, setSortBy,
  selectedJob, setSelectedJob, setAiAction,
  saveJob, savedJobFingerprints, dismissJob,
  lastFetchTime,
}: MatchesTabProps) {
  const feedItems = buildMatchFeedItems(jobs, plan);
  const showLockedCards = !isProPlan(plan) && jobs.length > 0;

  const [savingFingerprints, setSavingFingerprints] = useState<string[]>([]);
  const [expandedFingerprint, setExpandedFingerprint] = useState<string | null>(null);

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

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl tracking-tight text-foreground">Your Daily Matches</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            AI-curated jobs based on your resume and career goals.
            {lastFetchTime && (
              <span className="ml-2 text-foreground-muted/60">
                Updated {new Date(lastFetchTime).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        {showLockedCards && (
          <Link to="/settings#billing-plan">
            <Button variant="action">Upgrade to Pro</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex w-full flex-shrink-0 flex-col gap-3 rounded-[28px] border border-border bg-surface p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="grid flex-1 w-full grid-cols-1 gap-3 md:grid-cols-3">
          <Input placeholder="Filter by company…" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="w-full text-sm" />
          <Input placeholder="Filter by location…" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-full text-sm" />
          <Input placeholder="Filter by salary…" value={filterSalary} onChange={(e) => setFilterSalary(e.target.value)} className="w-full text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-foreground-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground-muted outline-none focus:ring-2 focus:ring-[#3898ec]"
          >
            <option value="matchScore">Match Score</option>
            <option value="datePosted">Newest First</option>
            <option value="company">Company (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-8">
        {loadingJobs ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            <p className="text-foreground-muted font-medium animate-pulse">Loading your curated job matches…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Calendar className="h-10 w-10 text-foreground-muted/40" />
            <p className="font-medium text-foreground-muted">Your daily matches are being prepared</p>
            <p className="text-sm text-foreground-muted/70 max-w-xs">
              Jobs are curated every day at 8:00 AM IST and delivered automatically. Check back soon!
            </p>
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
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-foreground font-display text-lg">{item.slot.title}</h3>
                            <p className="text-foreground-muted font-medium">{item.slot.company}</p>
                          </div>
                          <Badge variant="secondary" className="font-semibold">Locked</Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-foreground-muted">
                          <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {item.slot.location}</div>
                          <div className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4" /> {item.slot.salary}</div>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-[rgba(248,245,239,0.72)] backdrop-blur-sm">
                        <div className="mx-6 flex max-w-xs flex-col items-center rounded-2xl border border-border bg-background/95 px-5 py-4 text-center shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                          <Lock className="mb-2 h-5 w-5 text-primary" />
                          <p className="text-sm font-medium text-foreground">{item.slot.teaser}</p>
                          <p className="mt-1 text-xs text-foreground-muted">Go Pro to unlock 10 AI-curated matches daily.</p>
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
