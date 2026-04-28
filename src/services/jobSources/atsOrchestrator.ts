import type { DiscoveredJob } from '../jobResearcher';
import type { AtsSource } from './atsAllowlist';
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs } from './lever';

export type VerifyUrlFn = (url: string) => Promise<boolean>;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function fetchAtsJobs(
  sources: AtsSource[],
  opts: {
    fetchFn: typeof fetch;
    verifyUrl: VerifyUrlFn;
    perSourceTimeoutMs?: number;
    concurrency?: number;
    maxJobs?: number;
    seenFingerprints?: string[];
  }
): Promise<DiscoveredJob[]> {
  const perSourceTimeoutMs = opts.perSourceTimeoutMs ?? 8000;
  const concurrency = opts.concurrency ?? 6;
  const maxJobs = opts.maxJobs ?? 60;
  const seen = new Set((opts.seenFingerprints || []).map((v) => String(v)));

  const batches = await mapWithConcurrency(sources, concurrency, async (source) => {
    const run = async () => {
      if (source.ats === 'greenhouse') {
        return await fetchGreenhouseJobs(source.boardUrl, source.companyName, opts.fetchFn);
      }
      if (source.ats === 'lever') {
        return await fetchLeverJobs(source.boardUrl, source.companyName, opts.fetchFn);
      }
      return [];
    };
    const result = await withTimeout(run(), perSourceTimeoutMs);
    return result || [];
  });

  const flattened = batches.flat();
  const deduped: DiscoveredJob[] = [];
  const batchSeen = new Set<string>();

  for (const job of flattened) {
    if (!job || !job.fingerprint) continue;
    if (seen.has(job.fingerprint)) continue;
    if (batchSeen.has(job.fingerprint)) continue;
    batchSeen.add(job.fingerprint);
    deduped.push(job);
    if (deduped.length >= maxJobs) break;
  }

  const verified: DiscoveredJob[] = [];
  for (const job of deduped) {
    if (!job.applyUrl) continue;
    const ok = await opts.verifyUrl(job.applyUrl);
    if (ok) verified.push(job);
    if (verified.length >= maxJobs) break;
  }

  return verified;
}

