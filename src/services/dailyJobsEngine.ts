import { jobFingerprint } from './serperService';
import type { ValidationResult } from './validator';
import type { GhostModeJob, GhostModeRejectedJob } from '../types/adminGhostMode';

function buildFingerprint(job: { title: string; company: string }) {
  return jobFingerprint(job.title, job.company);
}

export function mapRejectedJobsWithCodes<TJob extends GhostModeJob>(
  rejected: Array<{
    job: TJob;
    validation: ValidationResult;
  }>
): GhostModeRejectedJob[] {
  return rejected.map(({ job, validation }) => ({
    job,
    code: validation.code || 'UNKNOWN_REJECTION',
  }));
}

export function buildRejectionCodeCounts(
  rejectedJobs: GhostModeRejectedJob[]
): Record<string, number> {
  return rejectedJobs.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.code] = (acc[entry.code] || 0) + 1;
    return acc;
  }, {});
}

export function splitJobsBySeenFingerprints<TJob extends { title: string; company: string }>(
  jobs: TJob[],
  seenFingerprints: string[]
): {
  unseenJobs: TJob[];
  seenJobs: TJob[];
} {
  const seenSet = new Set(seenFingerprints);
  const unseenJobs: TJob[] = [];
  const seenJobs: TJob[] = [];

  for (const job of jobs) {
    const fingerprint = buildFingerprint(job);
    if (seenSet.has(fingerprint)) {
      seenJobs.push(job);
    } else {
      unseenJobs.push(job);
    }
  }

  return { unseenJobs, seenJobs };
}
