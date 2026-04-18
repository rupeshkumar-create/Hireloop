import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import type {
  GhostModeInputMode,
  GhostModeOverrides,
  GhostModeRunMode,
  GhostModeRunResult,
  GhostModeTargetUser,
} from '../../types/adminGhostMode';

interface GhostModeModalProps {
  open: boolean;
  user: GhostModeTargetUser | null;
  running: boolean;
  result: GhostModeRunResult | null;
  onClose: () => void;
  onRun: (payload: {
    runMode: GhostModeRunMode;
    inputMode: GhostModeInputMode;
    overrides?: GhostModeOverrides;
  }) => Promise<void>;
}

function buildOverrideState(user: GhostModeTargetUser | null): GhostModeOverrides {
  return {
    careerPaths: user?.careerPaths || [],
    jobType: user?.jobType || 'both',
    location: user?.location || '',
    minSalary: user?.minSalary || null,
    resumeText: user?.resumeText || '',
    learningContext: user?.learningProfile?.jobPreferences || '',
    learningSignals: user?.learningSignals,
  };
}

export function GhostModeModal({
  open,
  user,
  running,
  result,
  onClose,
  onRun,
}: GhostModeModalProps) {
  const [runMode, setRunMode] = useState<GhostModeRunMode>('preview');
  const [inputMode, setInputMode] = useState<GhostModeInputMode>('saved');
  const [overrides, setOverrides] = useState<GhostModeOverrides>(
    buildOverrideState(user)
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setRunMode('preview');
    setInputMode('saved');
    setOverrides(buildOverrideState(user));
  }, [open, user]);

  if (!open || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-foreground">Simulate for User</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              {user.email || 'Unknown user'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground-muted">
              Run Mode
            </label>
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2"
              value={runMode}
              onChange={(e) => setRunMode(e.target.value as GhostModeRunMode)}
            >
              <option value="preview">Preview Only</option>
              <option value="persist">Run + Persist</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground-muted">
              Input Mode
            </label>
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2"
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value as GhostModeInputMode)}
            >
              <option value="saved">Use Saved Profile</option>
              <option value="override">Use Overrides</option>
            </select>
          </div>
          </div>

          {inputMode === 'override' && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground-muted">
                Career Paths
              </label>
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-border bg-surface px-3 py-2"
                value={(overrides.careerPaths || []).join(', ')}
                onChange={(e) =>
                  setOverrides((current) => ({
                    ...current,
                    careerPaths: e.target.value
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground-muted">
                Job Type
              </label>
              <select
                className="w-full rounded-xl border border-border bg-surface px-3 py-2"
                value={overrides.jobType || 'both'}
                onChange={(e) =>
                  setOverrides((current) => ({
                    ...current,
                    jobType: e.target.value,
                  }))
                }
              >
                <option value="both">Both</option>
                <option value="remote">Remote Only</option>
                <option value="onsite">On-site Only</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground-muted">
                Location
              </label>
              <input
                className="w-full rounded-xl border border-border bg-surface px-3 py-2"
                value={overrides.location || ''}
                onChange={(e) =>
                  setOverrides((current) => ({
                    ...current,
                    location: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground-muted">
                Minimum Salary
              </label>
              <input
                type="number"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2"
                value={overrides.minSalary ?? ''}
                onChange={(e) =>
                  setOverrides((current) => ({
                    ...current,
                    minSalary: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground-muted">
                Resume Text
              </label>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-border bg-surface px-3 py-2"
                value={overrides.resumeText || ''}
                onChange={(e) =>
                  setOverrides((current) => ({
                    ...current,
                    resumeText: e.target.value,
                  }))
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground-muted">
                Learning Context
              </label>
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-border bg-surface px-3 py-2"
                value={overrides.learningContext || ''}
                onChange={(e) =>
                  setOverrides((current) => ({
                    ...current,
                    learningContext: e.target.value,
                  }))
                }
              />
            </div>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={running}>
              Cancel
            </Button>
            <Button
              variant="action"
              onClick={() =>
                onRun({
                  runMode,
                  inputMode,
                  overrides: inputMode === 'override' ? overrides : undefined,
                })
              }
              disabled={running}
            >
              {running ? 'Running...' : runMode === 'persist' ? 'Run + Persist' : 'Preview Run'}
            </Button>
          </div>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted">
                  Run Summary
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Limit: {result.requestedLimit}
                </p>
                <p className="text-sm text-foreground">
                  Persisted: {result.persisted ? 'Yes' : 'No'}
                </p>
                <p className="text-sm text-foreground">
                  Final Jobs: {result.debug.finalJobs.length}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted">
                  Engine Stats
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Harvested: {result.debug.harvestedCount}
                </p>
                <p className="text-sm text-foreground">
                  Deduped: {result.debug.dedupedCount}
                </p>
                <p className="text-sm text-foreground">
                  Scored: {result.debug.scoredCount}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted">
                  Seen Split
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Unseen: {result.debug.unseenCount}
                </p>
                <p className="text-sm text-foreground">
                  Seen: {result.debug.seenCount}
                </p>
                <p className="text-sm text-foreground">
                  Backfill: {result.debug.usedBackfill ? 'Yes' : 'No'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted">
                  Source Breakdown
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">
                  {JSON.stringify(result.debug.sourceBreakdown, null, 2)}
                </pre>
              </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-foreground-muted">
                  Final Selected Jobs
                </p>
                <div className="space-y-2 text-sm text-foreground">
                  {result.debug.finalJobs.map((job) => (
                    <p key={`${job.title}-${job.company}`}>
                      {job.title} @ {job.company} {typeof job.finalScore === 'number' ? `- score ${job.finalScore}` : ''}
                    </p>
                  ))}
                  {result.debug.finalJobs.length === 0 && (
                    <p className="text-foreground-muted">No final jobs selected.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
