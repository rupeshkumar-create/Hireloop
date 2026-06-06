import { describe, expect, it } from 'vitest';
import { normalizeHistoryJobToDashboardJob } from '../historyJob.js';

describe('normalizeHistoryJobToDashboardJob', () => {
  it('fills missing description from aiSummary', () => {
    const job = normalizeHistoryJobToDashboardJob({
      title: 'QA Engineer',
      company: 'Acme',
      aiSummary: 'Strong fit for automation testing background.',
    });

    expect(job.description).toContain('Strong fit');
    expect(job.matchScore).toBe(0);
    expect(job.requirements).toEqual([]);
  });

  it('coerces string requirements into an array', () => {
    const job = normalizeHistoryJobToDashboardJob({
      title: 'Engineer',
      company: 'Co',
      requirements: 'Python\nTypeScript',
    });

    expect(job.requirements).toEqual(['Python', 'TypeScript']);
  });
});
