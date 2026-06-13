import { describe, expect, it } from 'vitest';
import { buildLockedSlotFromJob, buildMatchFeedItems, getDailyBatchSummary } from '../matchPaywall';
import type { Job } from '../../../types/dashboard';

const sampleJob: Job = {
  title: 'Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  salary: '$120k',
  description: 'Build product UI',
  id: 'frontend engineer::acme',
  fingerprint: 'frontend engineer::acme',
  workType: 'remote' as const,
  source: 'perplexity' as const,
  applyUrl: 'https://example.com/jobs/1',
  postedAt: new Date().toISOString(),
  matchReasons: [],
  skillGaps: [],
  aiSummary: '',
  isHotJob: false,
  finalScore: 92,
  requirements: ['React', 'TypeScript'],
  matchScore: 92,
};

describe('buildMatchFeedItems', () => {
  it('returns all jobs for free users without locked placeholders', () => {
    const result = buildMatchFeedItems([sampleJob], 'free');
    expect(result).toHaveLength(1);
    expect(result.every((item) => item.kind === 'job')).toBe(true);
  });

  it('returns all jobs for pro users', () => {
    const result = buildMatchFeedItems(
      [sampleJob, { ...sampleJob, title: 'Platform Engineer' }],
      'pro'
    );
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.kind === 'job')).toBe(true);
  });

  it('keeps the empty state honest when there are no jobs', () => {
    expect(buildMatchFeedItems([], 'free')).toEqual([]);
  });
});

describe('buildLockedSlotFromJob', () => {
  it('includes score band in teaser copy', () => {
    const slot = buildLockedSlotFromJob(sampleJob, 0);
    expect(slot.teaser).toContain('92/100 fit');
    expect(slot.title).toBe('Frontend Engineer');
  });
});

describe('getDailyBatchSummary', () => {
  it('reports no hidden roles — free and pro see the same batch size', () => {
    const summary = getDailyBatchSummary([sampleJob], 'free');
    expect(summary.visibleCount).toBe(1);
    expect(summary.totalScouted).toBe(1);
    expect(summary.hiddenCount).toBe(0);
    expect(summary.teaserJobs).toHaveLength(0);
  });
});
