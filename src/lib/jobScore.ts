/**
 * Maps a 0-100 match score to a short qualitative verdict.
 *
 * Mirrors the rubric we send to the AI scorer (95+ perfect, 80+ strong,
 * 60+ reasonable, 40+ stretch, <40 off-target) so the user gets a richer
 * mental model than just a bare number. `tone` lets the renderer pick the
 * right colour palette without baking colour into this module.
 */
export type ScoreVerdictTone = 'accent' | 'good' | 'soft';

export interface ScoreVerdict {
  label: string;
  tone: ScoreVerdictTone;
}

export function scoreVerdict(score: number): ScoreVerdict {
  if (!Number.isFinite(score) || score <= 0) return { label: 'Unscored', tone: 'soft' };
  if (score >= 90) return { label: 'Perfect fit', tone: 'accent' };
  if (score >= 75) return { label: 'Strong fit', tone: 'accent' };
  if (score >= 60) return { label: 'Reasonable fit', tone: 'good' };
  if (score >= 40) return { label: 'Stretch', tone: 'soft' };
  return { label: 'Off target', tone: 'soft' };
}

/**
 * Resolves the display value for a saved job's match score.
 *
 * Older saved jobs in Firestore were written before the matching engine
 * back-filled `matchScore`/`finalScore`, so those fields are often missing.
 * The previous fallback was `|| 100`, which made every legacy card look
 * like a perfect match. We now return `null` when no real score is present
 * so the UI can render an explicit "—" placeholder.
 */
export function resolveJobScore(
  job: Partial<{ matchScore: number; finalScore: number }>
): number | null {
  const candidate =
    typeof job.matchScore === 'number' && job.matchScore > 0
      ? job.matchScore
      : typeof job.finalScore === 'number' && job.finalScore > 0
        ? job.finalScore
        : null;
  if (candidate === null) return null;
  // Clamp to 0–100 — defensive against future scoring tweaks.
  return Math.max(0, Math.min(100, Math.round(candidate)));
}
