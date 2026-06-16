/**
 * Ordered career-path resolution — index 0 = priority 1 for Scout / Apify.
 */
export interface CareerPathProfile {
  careerPaths?: string[];
  structuredProfile?: { roles?: string[] };
}

/** Dedupe while preserving first-seen order. */
export function dedupeOrdered(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** User-ordered paths first (max 3), then structured roles, capped at 10 total. */
export function resolveOrderedCareerPaths(profile: CareerPathProfile): string[] {
  const fromCareerPaths = Array.isArray(profile.careerPaths) ? profile.careerPaths : [];
  const fromStructuredRoles = Array.isArray(profile.structuredProfile?.roles)
    ? profile.structuredProfile.roles
    : [];
  return dedupeOrdered([...fromCareerPaths, ...fromStructuredRoles]).slice(0, 10);
}

/** Top 3 preferences used for Apify priority and daily match selection. */
export function priorityCareerPaths(profile: CareerPathProfile): string[] {
  const ordered = resolveOrderedCareerPaths(profile);
  const fromUser = dedupeOrdered(
    (Array.isArray(profile.careerPaths) ? profile.careerPaths : []).filter(
      (v): v is string => typeof v === 'string'
    )
  ).slice(0, 3);
  if (fromUser.length > 0) return fromUser;
  return ordered.slice(0, 3);
}

export function reorderCareerPaths(paths: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return [...paths];
  const next = [...paths];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return paths;
  next.splice(toIndex, 0, item);
  return next;
}
