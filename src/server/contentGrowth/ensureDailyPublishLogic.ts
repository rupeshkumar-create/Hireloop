/** Pure helpers for daily blog autopilot (safe to import in unit tests). */

export function todayUtcDate(now = new Date()): string {
  return now.toISOString().split('T')[0];
}

export function hasPublishedToday(
  posts: { publishedAt?: string }[],
  now = new Date()
): boolean {
  const today = todayUtcDate(now);
  return posts.some((post) => post.publishedAt?.startsWith(today));
}

const MIN_DISPATCH_HOUR_UTC = 8;
const RETRY_DISPATCH_HOURS = 3;

export function shouldAutoDispatchToday(options: {
  now?: Date;
  posts: { publishedAt?: string }[];
  lastAutoDispatchDate?: string | null;
  lastAutoDispatchAt?: string | null;
}): boolean {
  const now = options.now ?? new Date();
  if (now.getUTCHours() < MIN_DISPATCH_HOUR_UTC) return false;
  if (hasPublishedToday(options.posts, now)) return false;

  const today = todayUtcDate(now);
  if (options.lastAutoDispatchDate === today) return false;

  if (!options.lastAutoDispatchAt) return true;

  const hoursSinceAttempt =
    (now.getTime() - new Date(options.lastAutoDispatchAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceAttempt >= RETRY_DISPATCH_HOURS;
}
