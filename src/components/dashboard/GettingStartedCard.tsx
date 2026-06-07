import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth, type UserProfile } from '../../contexts/AuthContext';
import { isFreshlyOnboarded } from '../../lib/onboarding';
import { Button } from '../ui/button';

interface Props {
  hasMatches: boolean;
  savedCount: number;
  onRunScout: () => void;
  isRunningScout: boolean;
}

type StepKey =
  | 'resume'
  | 'paths'
  | 'firstMatches'
  | 'firstSave'
  | 'firstAsset'
  | 'enableAlerts';

interface Step {
  key: StepKey;
  label: string;
  description: string;
  done: boolean;
  cta?: { kind: 'link' | 'button'; label: string; to?: string; onClick?: () => void; disabled?: boolean };
}

function buildSteps(
  profile: UserProfile | null,
  hasMatches: boolean,
  savedCount: number,
  onRunScout: () => void,
  isRunningScout: boolean,
  skipSetupSteps: boolean
): Step[] {
  const resumeDone = !!profile?.resumeText;
  const pathsDone = (profile?.careerPaths?.length || 0) > 0;
  const firstSaveDone = savedCount > 0;
  const assetDone = !!profile?.activatedAt;
  const alertsOn = profile?.receiveDailyAlerts === true;

  const setupSteps: Step[] = skipSetupSteps
    ? []
    : [
        {
          key: 'resume',
          label: 'Upload your resume',
          description: 'We extract skills, experience, and suggest paths automatically.',
          done: resumeDone,
          cta: resumeDone ? undefined : { kind: 'link', label: 'Upload', to: '/onboarding' },
        },
        {
          key: 'paths',
          label: 'Confirm career paths',
          description: 'Scout searches against these. Keep 1–3 sharp roles.',
          done: pathsDone,
          cta: pathsDone ? undefined : { kind: 'link', label: 'Set paths', to: '/onboarding' },
        },
        {
          key: 'firstMatches',
          label: 'See your first matches',
          description: 'Scout runs on demand and every morning.',
          done: hasMatches,
          cta: hasMatches
            ? undefined
            : { kind: 'button', label: isRunningScout ? 'Running…' : 'Run Scout now', onClick: onRunScout, disabled: isRunningScout },
        },
      ];

  return [
    ...setupSteps,
    {
      key: 'firstSave',
      label: 'Save your first match',
      description: 'Saving sends the role to Pipeline — your tracker for applications and AI assets.',
      done: firstSaveDone,
    },
    {
      key: 'firstAsset',
      label: 'Generate your first application asset',
      description: 'Tailored resume, cold email, interview prep — one click each.',
      done: assetDone,
    },
    {
      key: 'enableAlerts',
      label: 'Turn on daily alerts',
      description: "We'll email tomorrow's matches before you wake up.",
      done: alertsOn,
      cta: alertsOn ? undefined : { kind: 'link', label: 'Settings', to: '/settings' },
    },
  ];
}

export function GettingStartedCard({ hasMatches, savedCount, onRunScout, isRunningScout }: Props) {
  const { profile, updateProfile } = useAuth();
  const [dismissing, setDismissing] = useState(false);

  const skipSetupSteps = isFreshlyOnboarded(profile);
  const steps = useMemo(
    () => buildSteps(profile, hasMatches, savedCount, onRunScout, isRunningScout, skipSetupSteps),
    [profile, hasMatches, savedCount, onRunScout, isRunningScout, skipSetupSteps]
  );

  // Hidden once the user dismisses OR every step is done.
  const allDone = steps.every((s) => s.done);
  if (profile?.tourCompletedAt || allDone) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const dismiss = async () => {
    setDismissing(true);
    try {
      await updateProfile({ tourCompletedAt: new Date().toISOString() });
    } finally {
      setDismissing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-5 md:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--hs-app-accent)]/15 text-[var(--hs-app-accent)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <h3 className="text-base font-semibold text-[var(--hs-app-fg)]">
                {skipSetupSteps ? 'Make your first move' : 'Get to your first interview'}
              </h3>
              <span className="text-[11px] font-semibold text-[var(--hs-app-muted)]">
                {doneCount} / {steps.length} done
              </span>
            </div>
            <p className="text-xs text-[var(--hs-app-muted)] mt-0.5">
              {skipSetupSteps
                ? 'Save a match (opens Pipeline), generate an asset, and turn on daily Scout.'
                : 'Dashboard = discover matches. Pipeline = saved roles you are applying to.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss getting started"
          onClick={dismiss}
          disabled={dismissing}
          className="rounded-full p-1.5 text-[var(--hs-app-muted)] hover:bg-[var(--hs-app-bg)] hover:text-[var(--hs-app-fg)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Progress bar */}
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hs-app-bg)]">
        <div
          className="h-full bg-[var(--hs-app-accent)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={[
              'flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
              s.done
                ? 'border-[var(--hs-app-accent)]/25 bg-[var(--hs-app-accent-soft)]'
                : 'border-[var(--hs-app-border)] bg-[var(--hs-app-bg)]',
            ].join(' ')}
          >
            <div className="mt-0.5 shrink-0">
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 text-[var(--hs-app-accent)]" />
              ) : (
                <Circle className="h-5 w-5 text-[var(--hs-app-muted)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className={['text-sm font-medium', s.done ? 'text-[var(--hs-app-muted)] line-through' : 'text-[var(--hs-app-fg)]'].join(' ')}>
                    {i + 1}. {s.label}
                  </div>
                  <div className="text-xs text-[var(--hs-app-muted)] mt-0.5">{s.description}</div>
                </div>
                {!s.done && s.cta && (
                  s.cta.kind === 'link' ? (
                    <Link to={s.cta.to || '#'} className="hs-btn text-xs py-1.5 px-3 shrink-0">
                      {s.cta.label}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <Button size="sm" onClick={s.cta.onClick} disabled={s.cta.disabled} className="text-xs">
                      {s.cta.label}
                      {!s.cta.disabled && <ChevronRight className="ml-1 h-3 w-3" />}
                    </Button>
                  )
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
