/**
 * Combined ATS + Apify job discovery used by dashboard Scout, Vercel cron,
 * and GitHub Actions daily generation.
 */
import { researchJobs, type DiscoveredJob } from './jobResearcher.js';
import { loadAtsAllowlist } from './jobSources/atsAllowlist.js';
import { fetchAtsJobs } from './jobSources/atsOrchestrator.js';
import { verifyHttpUrl } from './urlVerifier.js';

export interface DiscoverJobsInput {
  careerPaths: string[];
  resumeText: string;
  jobType?: string;
  location?: string;
  /** Target pool size before matching (not final deliver count). */
  targetCount?: number;
  seenFingerprints?: string[];
  /** When provided, ATS allowlist jobs are merged before Apify backfill. */
  getAdminDb?: () => unknown;
}

export interface DiscoverJobsResult {
  jobs: DiscoveredJob[];
  sources: Record<string, number>;
}

export async function discoverJobsForMatching(
  input: DiscoverJobsInput
): Promise<DiscoverJobsResult> {
  const targetDiscoveryCount = Math.max(30, input.targetCount ?? 60);
  const seenFingerprints = input.seenFingerprints || [];
  const byFingerprint = new Set<string>();
  const combined: DiscoveredJob[] = [];

  const addJob = (job: DiscoveredJob) => {
    if (!job?.fingerprint || byFingerprint.has(job.fingerprint)) return;
    byFingerprint.add(job.fingerprint);
    combined.push(job);
  };

  if (input.getAdminDb) {
    try {
      const atsSources = await loadAtsAllowlist(input.getAdminDb);
      if (atsSources.length > 0) {
        const atsJobs = await fetchAtsJobs(atsSources, {
          fetchFn: fetch,
          verifyUrl: async (url) => await verifyHttpUrl(url),
          seenFingerprints,
          maxJobs: targetDiscoveryCount,
          concurrency: 8,
          perSourceTimeoutMs: 4500,
        });
        for (const job of atsJobs) addJob(job as DiscoveredJob);
        console.log(`[discoverJobs] ATS returned ${atsJobs.length} jobs (${combined.length} unique).`);
      }
    } catch (err) {
      console.warn('[discoverJobs] ATS discovery failed:', err);
    }
  }

  const sourceCounts: Record<string, number> = {};
  for (const job of combined) {
    sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
  }

  if (combined.length < targetDiscoveryCount) {
    const missing = targetDiscoveryCount - combined.length;
    const { jobs: feedJobs, sources: apifySources } = await researchJobs({
      careerPaths: input.careerPaths,
      resumeText: input.resumeText,
      jobType: input.jobType,
      location: input.location,
      targetCount: Math.max(20, missing),
    });
    for (const job of feedJobs) {
      addJob(job);
      if (combined.length >= targetDiscoveryCount) break;
    }
    for (const [source, count] of Object.entries(apifySources)) {
      sourceCounts[source] = (sourceCounts[source] || 0) + count;
    }
    console.log(
      `[discoverJobs] Apify added ${feedJobs.length} jobs (total ${combined.length} unique).`
    );
  }

  return { jobs: combined, sources: sourceCounts };
}
