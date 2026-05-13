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
