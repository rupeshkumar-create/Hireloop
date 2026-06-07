/**
 * Keeps daily blog publishing automatic on Vercel Hobby:
 * - GitHub Actions runs the pipeline on a schedule
 * - If that misses, RSS/sitemap crawlers trigger a one-per-day GitHub dispatch
 */

import { listBlogPosts } from '../marketingEngine.js';
import { dispatchContentCron } from '../githubDispatch.js';
import { loadGrowthState, saveGrowthState } from './storage.js';
import {
  hasPublishedToday,
  shouldAutoDispatchToday,
  todayUtcDate,
} from './ensureDailyPublishLogic.js';

export { hasPublishedToday, shouldAutoDispatchToday, todayUtcDate } from './ensureDailyPublishLogic.js';

export async function ensureDailyBlogPublish(
  source: string,
  options?: { posts?: { publishedAt?: string }[] }
): Promise<{ action: 'skipped' | 'dispatched' | 'failed'; reason?: string }> {
  const now = new Date();
  const posts = options?.posts ?? (await listBlogPosts(10));

  if (hasPublishedToday(posts, now)) {
    return { action: 'skipped', reason: 'already_published_today' };
  }

  if (now.getUTCHours() < 8) {
    return { action: 'skipped', reason: 'before_publish_window' };
  }

  const state = await loadGrowthState();
  if (
    !shouldAutoDispatchToday({
      now,
      posts,
      lastAutoDispatchDate: state.lastAutoDispatchDate,
      lastAutoDispatchAt: state.lastAutoDispatchAt,
    })
  ) {
    return { action: 'skipped', reason: 'dispatch_already_attempted_today' };
  }

  const today = todayUtcDate(now);
  await saveGrowthState({ lastAutoDispatchAt: now.toISOString() });

  const dispatch = await dispatchContentCron({ job: 'daily-blog' });
  if (!dispatch.ok) {
    const reason = dispatch.hint || `GitHub dispatch HTTP ${dispatch.status}`;
    console.error(`[ensureDailyBlogPublish:${source}] dispatch failed`, dispatch.status, reason);
    await saveGrowthState({ lastAutoDispatchError: reason });
    return { action: 'failed', reason };
  }

  await saveGrowthState({
    lastAutoDispatchDate: today,
    lastAutoDispatchError: null,
    lastAutoDispatchAt: now.toISOString(),
  });

  console.log(`[ensureDailyBlogPublish:${source}] dispatched content-cron.yml for ${today}`);
  return { action: 'dispatched' };
}
