import { describe, expect, it } from 'vitest';
import {
  buildRejectionCodeCounts,
  mapRejectedJobsWithCodes,
  splitJobsBySeenFingerprints,
} from '../dailyJobsEngine';

const acceptedJob = {
  title: 'Senior Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  salary: '$180k',
  description: 'Build product features',
  url: 'https://jobs.example.com/acme',
  requirements: ['React', 'TypeScript'],
};

const seenJob = {
  title: 'Product Engineer',
  company: 'Orbit',
  location: 'Remote',
  salary: '$170k',
  description: 'Ship product',
  url: 'https://jobs.example.com/orbit',
  requirements: ['React'],
};

describe('mapRejectedJobsWithCodes', () => {
  it('maps validation payloads down to compact code entries', () => {
    const result = mapRejectedJobsWithCodes([
      {
        job: acceptedJob,
        validation: { passed: false, code: 'REMOTE_MISMATCH' },
      },
      {
        job: seenJob,
        validation: { passed: false },
      },
    ]);

    expect(result).toEqual([
      { job: acceptedJob, code: 'REMOTE_MISMATCH' },
      { job: seenJob, code: 'UNKNOWN_REJECTION' },
    ]);
  });
});

describe('buildRejectionCodeCounts', () => {
  it('counts repeated rejection codes', () => {
    const result = buildRejectionCodeCounts([
      { job: acceptedJob, code: 'REMOTE_MISMATCH' },
      { job: seenJob, code: 'REMOTE_MISMATCH' },
      { job: seenJob, code: 'STALE_JOB' },
    ]);

    expect(result).toEqual({
      REMOTE_MISMATCH: 2,
      STALE_JOB: 1,
    });
  });
});

describe('splitJobsBySeenFingerprints', () => {
  it('splits unseen jobs from seen jobs using title-company fingerprints', () => {
    const result = splitJobsBySeenFingerprints(
      [acceptedJob, seenJob],
      ['product engineer::orbit']
    );

    expect(result.unseenJobs).toEqual([acceptedJob]);
    expect(result.seenJobs).toEqual([seenJob]);
  });
});
