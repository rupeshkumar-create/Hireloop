import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
  X,
  Plus,
  Briefcase,
  Compass,
  Rocket,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isOnboardingComplete, deriveOnboardingStep, nextStepAfterUpload } from '../lib/onboarding';
import { ResumeUploader } from '../components/dashboard/ResumeUploader';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import type { DailyJob } from '../types/dailyJob';
import { getDailyMatchLimit } from '../lib/planLimits';
import { inferUserCountry } from '../services/remoteEligibility';
import { scoreVerdict } from '../lib/jobScore';

const COUNTRY_DISPLAY: Record<string, string> = {
  US: 'the United States', CA: 'Canada', MX: 'Mexico', GB: 'the UK',
  IE: 'Ireland', DE: 'Germany', FR: 'France', NL: 'the Netherlands',
  ES: 'Spain', IT: 'Italy', PT: 'Portugal', PL: 'Poland',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  IN: 'India', SG: 'Singapore', AU: 'Australia', NZ: 'New Zealand',
  JP: 'Japan', CN: 'China', PH: 'the Philippines', ID: 'Indonesia',
  VN: 'Vietnam', TH: 'Thailand', BR: 'Brazil', AR: 'Argentina',
  CL: 'Chile', CO: 'Colombia', PE: 'Peru',
};

type Step = 'upload' | 'paths' | 'scout' | 'matches';

const STEP_ORDER: Step[] = ['upload', 'paths', 'scout', 'matches'];
const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload resume',
  paths: 'Career paths',
  scout: 'Scout running',
  matches: 'First matches',
};

// Derive the natural starting step from profile state so a refresh mid-wizard
// resumes where the user left off.
function deriveInitialStep(profile: any): Step {
  return deriveOnboardingStep(profile);
}

export function Onboarding() {
  const { profile, updateProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [bootstrapped, setBootstrapped] = useState(false);

  // Initial step derivation once the profile lands.
  useEffect(() => {
    if (loading) return;
    if (!bootstrapped) {
      setStep(deriveInitialStep(profile));
      setBootstrapped(true);
    }
  }, [loading, profile, bootstrapped]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }
  if (isOnboardingComplete(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  const goNext = (next: Step) => setStep(next);
  const finish = async () => {
    await updateProfile({ onboardingCompletedAt: new Date().toISOString() });
    navigate('/dashboard?welcome=1');
  };

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        <WizardHeader currentStep={step} />

        <div className="mt-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {step === 'upload' && (
                <UploadStep
                  profile={profile}
                  updateProfile={updateProfile}
                  onDone={() => goNext(nextStepAfterUpload(profile))}
                />
              )}
              {step === 'paths' && (
                <PathsStep
                  profile={profile}
                  updateProfile={updateProfile}
                  onDone={() => goNext('scout')}
                  onSkipScout={finish}
                />
              )}
              {step === 'scout' && (
                <ScoutStep
                  profile={profile}
                  onDone={() => goNext('matches')}
                  onFinishEarly={finish}
                />
              )}
              {step === 'matches' && (
                <MatchesStep
                  profile={profile}
                  onFinish={finish}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Header / progress indicator ──────────────────────────────────────────────

function WizardHeader({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  return (
    <header>
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground-muted">
        Welcome to Hireschema
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl font-semibold text-foreground">
        Calibrate your AI Scout.
      </h1>
      <p className="mt-2 text-foreground-muted">
        Upload once, confirm your paths, then Scout finds remote roles matched to your resume.
      </p>

      <ol className="mt-8 flex flex-wrap items-center gap-2">
        {STEP_ORDER.map((s, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
          return (
            <li
              key={s}
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                state === 'done'
                  ? 'border-[var(--hs-app-accent)]/30 bg-[var(--hs-app-accent-soft)] text-[var(--hs-app-accent)]'
                  : state === 'active'
                  ? 'border-[var(--hs-app-accent)]/40 bg-[var(--hs-app-accent)]/10 text-[var(--hs-app-accent)]'
                  : 'border-border bg-surface text-foreground-muted',
              ].join(' ')}
            >
              {state === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[10px] font-bold">{i + 1}</span>
              )}
              {STEP_LABELS[s]}
            </li>
          );
        })}
      </ol>
    </header>
  );
}

// ─── Step 1 — Upload ──────────────────────────────────────────────────────────

function UploadStep({
  profile,
  updateProfile,
  onDone,
}: {
  profile: any;
  updateProfile: (data: any) => Promise<void>;
  onDone: () => void;
}) {
  // If a resume is already in the profile (refresh after upload), allow user
  // to continue without re-uploading.
  const hasResume = Boolean(profile?.resumeText);

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 md:p-10">
      <StepHeading
        icon={Briefcase}
        eyebrow="Step 1 of 4"
        title="Upload your resume"
        body="We'll extract your skills, summarise your experience, and suggest 3 career paths. This runs once — no manual setup."
      />

      <div className="mt-8">
        <ResumeUploader
          profile={profile}
          updateProfile={updateProfile}
          onSuccess={onDone}
          quiet
        />
      </div>

      {hasResume && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm">
          <span className="text-foreground-muted">
            <CheckCircle2 className="inline h-4 w-4 text-[var(--hs-app-accent)] mr-2" />
            Resume already uploaded.
          </span>
          <Button variant="outline" size="sm" onClick={onDone}>
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}
    </section>
  );
}

// ─── Step 2 — Confirm 3 paths ─────────────────────────────────────────────────

function PathsStep({
  profile,
  updateProfile,
  onDone,
  onSkipScout,
}: {
  profile: any;
  updateProfile: (data: any) => Promise<void>;
  onDone: () => void;
  onSkipScout: () => Promise<void>;
}) {
  // Start from existing careerPaths if any, otherwise from suggestions.
  const seed: string[] = useMemo(() => {
    if (profile?.careerPaths?.length) return profile.careerPaths.slice(0, 3);
    if (profile?.careerPathSuggestions?.length) {
      return profile.careerPathSuggestions.slice(0, 3).map((p: any) => p.title);
    }
    return [];
  }, [profile?.careerPaths, profile?.careerPathSuggestions]);

  const [paths, setPaths] = useState<string[]>(seed);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [seededSuggestions, setSeededSuggestions] = useState(false);

  const suggestions = (profile?.careerPathSuggestions || []) as Array<{
    id: string;
    title: string;
    rationale?: string;
  }>;

  useEffect(() => {
    if (seededSuggestions || paths.length > 0 || suggestions.length === 0) return;
    setPaths(suggestions.slice(0, 3).map((s) => s.title));
    setSeededSuggestions(true);
  }, [paths.length, seededSuggestions, suggestions]);

  const addPath = (title: string) => {
    const t = title.trim();
    if (!t) return;
    if (paths.includes(t)) return;
    if (paths.length >= 3) {
      toast.info('You can pick up to 3 paths. Remove one to add another.');
      return;
    }
    setPaths([...paths, t]);
    setDraft('');
  };

  const removePath = (title: string) => setPaths(paths.filter((p) => p !== title));

  const handleSkip = async () => {
    if (paths.length > 0) {
      setSaving(true);
      try {
        await updateProfile({ careerPaths: paths });
      } catch (e: any) {
        toast.error(e?.message || 'Could not save career paths.');
        return;
      } finally {
        setSaving(false);
      }
    }
    await onSkipScout();
  };

  const handleContinue = async () => {
    if (paths.length === 0) {
      toast.error('Pick at least one path so Scout knows what to search for.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ careerPaths: paths });
      // Kick Scout *now* (async, fire-and-forget) so the pipeline is already
      // running while the user reads the step-3 progress UI. By the time
      // they look up from the page, results are usually landing.
      // Errors are swallowed here — step 3 retries on mount as a fallback.
      void triggerScoutRun().catch(() => {});
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save career paths.');
    } finally {
      setSaving(false);
    }
  };

  // Resolve the inferred country up-front so we can show the user what
  // region Scout will filter for *before* they see the dashboard. This
  // pre-empts the "why are you showing me US jobs?" confusion entirely.
  const inferredCountry = inferUserCountry({
    deliveryTimezone: profile?.deliveryTimezone,
    locations: profile?.preferences?.locations || (profile?.location ? [profile.location] : []),
  });
  const countryLabel = inferredCountry !== 'UNKNOWN' ? COUNTRY_DISPLAY[inferredCountry] || inferredCountry : null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 md:p-10">
      <StepHeading
        icon={Compass}
        eyebrow="Step 2 of 4"
        title="Confirm your career paths"
        body="We picked these from your resume. Keep 1–3 roles Scout should search for — you can edit anytime in Settings."
      />

      {countryLabel && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-accent-soft)] px-4 py-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--hs-app-accent)] text-[10px] font-bold text-white">
            {inferredCountry}
          </span>
          <div className="text-[13px] leading-relaxed text-foreground">
            <span className="font-medium">Scout will focus on remote roles eligible for {countryLabel}.</span>{' '}
            <span className="text-foreground-muted">
              We detected this from your resume + timezone. You can change it later in Settings.
            </span>
          </div>
        </div>
      )}

      {/* Selected pills */}
      <div className="mt-8">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted mb-3">
          Your paths ({paths.length}/3)
        </div>
        {paths.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-foreground-muted">
            No paths selected yet. Pick one of the suggestions below or add your own.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {paths.map((p) => (
              <span
                key={p}
                className="group inline-flex items-center gap-2 rounded-full bg-[var(--hs-app-accent)]/15 px-3 py-1.5 text-sm font-medium text-[var(--hs-app-accent)]"
              >
                {p}
                <button
                  type="button"
                  onClick={() => removePath(p)}
                  className="rounded-full p-0.5 hover:bg-[var(--hs-app-accent)]/25"
                  aria-label={`Remove ${p}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted mb-3">
            AI suggestions
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {suggestions.map((s) => {
              const selected = paths.includes(s.title);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => (selected ? removePath(s.title) : addPath(s.title))}
                  className={[
                    'text-left rounded-xl border px-4 py-3 transition-all',
                    selected
                      ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent)]/10'
                      : 'border-border bg-background hover:border-[var(--hs-app-accent)]/40 hover:bg-[var(--hs-app-accent)]/5',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground text-sm">{s.title}</span>
                    {selected ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--hs-app-accent)] shrink-0" />
                    ) : (
                      <Plus className="h-4 w-4 text-foreground-muted shrink-0" />
                    )}
                  </div>
                  {s.rationale && (
                    <p className="mt-2 text-xs leading-relaxed text-foreground-muted">{s.rationale}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom entry */}
      <div className="mt-8">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted mb-3">
          Add your own
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPath(draft);
              }
            }}
            placeholder="e.g. Staff Platform Engineer"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-accent)]/40"
          />
          <Button variant="outline" onClick={() => addPath(draft)} disabled={!draft.trim() || paths.length >= 3}>
            Add
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-foreground-muted">
          Pick at least 1 path. Scout starts as soon as you continue.
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleSkip()} disabled={saving}>
            Finish without waiting for Scout
          </Button>
          <Button onClick={handleContinue} disabled={saving || paths.length === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start Scout <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

// Fires a one-shot Scout request via /api/jobs. Defined outside any step so
// it can be triggered from step 2's "Continue" handler — that way the engine
// is already running by the time the user lands on step 3. Idempotent on the
// API side (the user-triggered dispatcher dedupes); harmless if called twice.
async function triggerScoutRun(): Promise<'dispatched' | 'ready'> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated.');
  const idToken = await user.getIdToken(true);
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ mode: 'request', firstRun: true }),
  });
  if (res.ok && res.status !== 202) {
    const payload = await res.json().catch(() => ({}));
    if (Array.isArray((payload as any).jobs) && (payload as any).jobs.length > 0) {
      return 'ready';
    }
  }
  if (res.status === 202 || res.status === 409 || res.ok) {
    return res.status === 202 ? 'dispatched' : 'ready';
  }
  const text = await res.text().catch(() => '');
  throw new Error(`Scout request failed (${res.status}). ${text}`);
}

// ─── Step 3 — Scout runs ──────────────────────────────────────────────────────

const SCOUT_STAGES = [
  { id: 'queue',     label: 'Briefing Scout on your profile',     hint: 'Loading your resume + career paths' },
  { id: 'search',    label: 'Searching ATS feeds and live job boards', hint: 'Greenhouse · Lever · Apify' },
  { id: 'validate',  label: 'Filtering by your region + freshness', hint: 'Removing region-restricted roles' },
  { id: 'rank',      label: 'Scoring resume fit',              hint: 'OpenRouter ranks the strongest matches' },
  { id: 'deliver',   label: 'Preparing your first matches',       hint: 'Almost there…' },
];

function ScoutStep({
  profile,
  onDone,
  onFinishEarly,
}: {
  profile: any;
  onDone: () => void;
  onFinishEarly: () => Promise<void>;
}) {
  const [stageIdx, setStageIdx] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [dispatched, setDispatched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (triggered) return;
    setTriggered(true);

    triggerScoutRun()
      .then((status) => {
        if (!cancelled) {
          setDispatched(status === 'dispatched');
          if (status === 'ready') onDone();
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Could not start Scout. You can try again from the dashboard.');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stageIdx >= SCOUT_STAGES.length - 1) return;
    const t = setTimeout(() => setStageIdx((i) => Math.min(i + 1, SCOUT_STAGES.length - 1)), 5000);
    return () => clearTimeout(t);
  }, [stageIdx]);

  const jobsReady = (profile?.dailyJobs?.length || 0) > 0;
  useEffect(() => {
    if (jobsReady) onDone();
  }, [jobsReady, onDone]);

  const canOpenDashboard = elapsedSec >= 45;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 md:p-10">
      <StepHeading
        icon={Rocket}
        eyebrow="Step 3 of 4"
        title="Scout is searching for your matches"
        body={
          dispatched
            ? 'Running in the background — if nothing appears in 2 minutes, open your dashboard and tap Retry.'
            : 'Scoring jobs against your resume now — usually under a minute for your first batch.'
        }
      />

      <div className="mt-4 flex items-center justify-between text-xs text-foreground-muted">
        <span>Elapsed {elapsedSec}s</span>
        {dispatched ? <span>Background job started</span> : null}
      </div>

      {error ? (
        <div className="mt-8 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {SCOUT_STAGES.map((s, i) => {
            const state: 'done' | 'active' | 'pending' =
              i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'pending';
            return (
              <li
                key={s.id}
                className={[
                  'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                  state === 'done'
                    ? 'border-[var(--hs-app-accent)]/25 bg-[var(--hs-app-accent-soft)]'
                    : state === 'active'
                    ? 'border-[var(--hs-app-accent)]/40 bg-[var(--hs-app-accent)]/5'
                    : 'border-border bg-background',
                ].join(' ')}
              >
                <div className="mt-0.5 shrink-0">
                  {state === 'done' ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--hs-app-accent)]" />
                  ) : state === 'active' ? (
                    <Loader2 className="h-5 w-5 text-[var(--hs-app-accent)] animate-spin" />
                  ) : (
                    <span className="block h-5 w-5 rounded-full border-2 border-border" />
                  )}
                </div>
                <div className="min-w-0">
                  <div
                    className={[
                      'text-sm font-medium',
                      state === 'pending' ? 'text-foreground-muted' : 'text-foreground',
                    ].join(' ')}
                  >
                    {s.label}
                  </div>
                  <div className="text-xs text-foreground-muted mt-0.5">{s.hint}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-xs text-foreground-muted">
        <Sparkles className="inline h-3 w-3 mr-1 text-[var(--hs-app-accent)]" />
        Scout also runs every morning at your preferred delivery hour.
      </p>

      {canOpenDashboard ? (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => void onFinishEarly()}>
            Open dashboard while Scout finishes
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-[11px] text-foreground-muted">
          You can open the dashboard in {Math.max(45 - elapsedSec, 0)}s if Scout is taking longer than expected.
        </p>
      )}
    </section>
  );
}

// ─── Step 4 — First matches ───────────────────────────────────────────────────

function MatchesStep({ profile, onFinish }: { profile: any; onFinish: () => Promise<void> }) {
  const limit = getDailyMatchLimit(profile?.plan);
  const jobs: DailyJob[] = (profile?.dailyJobs || []).slice(0, Math.min(3, limit));
  const isFree = limit === 1;
  const totalToday = profile?.dailyJobsMeta?.returnedCount || profile?.dailyJobs?.length || jobs.length;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 md:p-10">
      <StepHeading
        icon={CheckCircle2}
        eyebrow="Step 4 of 4"
        title={jobs.length > 0 ? `${jobs.length} fresh ${jobs.length === 1 ? 'match' : 'matches'} ready` : 'Almost there'}
        body={
          jobs.length > 0
            ? 'Tap a role to read why it fits. Save to Pipeline when you want to track or apply.'
            : 'Scout is still running or today\'s market is thin. Your dashboard updates automatically when matches land.'
        }
      />

      {isFree && totalToday > 1 ? (
        <div className="mt-6 rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-accent-soft)] px-4 py-3 text-[13px] text-foreground">
          <span className="font-medium">Free plan:</span>{' '}
          Scout ranked {totalToday} roles — you&apos;ll see your best match first. Pro unlocks all {Math.min(totalToday, 10)} daily.
        </div>
      ) : null}

      <div className="mt-6 rounded-lg border border-dashed border-[var(--hs-app-border)] bg-background px-4 py-3 text-[12px] leading-relaxed text-foreground-muted">
        <strong className="text-foreground">How it works:</strong> Dashboard = new jobs Scout finds.
        Pipeline = roles you save to track and generate AI application assets.
      </div>

      {jobs.length === 0 ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-sm text-foreground-muted">
            Scout is still working or today&apos;s market is thin for your paths. Your dashboard will update automatically when matches land.
          </div>
          <p className="text-xs text-foreground-muted">
            Tip: add another career path in Settings if you want a wider search tomorrow.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {jobs.map((j: any, i: number) => {
            const score = j.matchScore || j.finalScore || 0;
            const verdict = scoreVerdict(score);
            const insight = j.aiInsight || j.aiSummary;
            return (
              <li
                key={j.fingerprint || `${j.title}-${j.company}-${i}`}
                className="flex items-start gap-4 rounded-xl border border-border bg-background px-4 py-3"
              >
                <div className="hs-score shrink-0" style={{ '--score': `${score}%` } as React.CSSProperties}>
                  {score || '–'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-medium text-foreground truncate">{j.title}</div>
                    {score > 0 && (
                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          verdict.tone === 'accent'
                            ? 'bg-[var(--hs-app-accent-soft)] text-[var(--hs-app-accent)]'
                            : verdict.tone === 'good'
                            ? 'bg-[var(--hs-app-bg)] text-[var(--hs-app-fg)] border border-[var(--hs-app-border)]'
                            : 'bg-[var(--hs-app-bg)] text-[var(--hs-app-muted)] border border-[var(--hs-app-border)]',
                        ].join(' ')}
                      >
                        {verdict.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground-muted truncate">
                    {j.company}
                    {j.location ? ` · ${j.location}` : ''}
                  </div>
                  {insight && (
                    <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted line-clamp-2">
                      {insight}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10 flex items-center justify-end">
        <Button onClick={onFinish}>
          {jobs.length > 0 ? 'Review my best match' : 'Open dashboard'} <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function StepHeading({
  icon: Icon,
  eyebrow,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--hs-app-accent)]/15 text-[var(--hs-app-accent)]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-muted">{eyebrow}</p>
        <h2 className="mt-1 text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-foreground-muted">{body}</p>
      </div>
    </div>
  );
}
