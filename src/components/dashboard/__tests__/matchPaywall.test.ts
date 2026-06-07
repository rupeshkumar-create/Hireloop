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
  it('appends nine locked placeholders for a free user with one real job', () => {
    const result = buildMatchFeedItems([sampleJob], 'free');

    expect(result).toHaveLength(10);
    expect(result[0].kind).toBe('job');
    expect(result.filter((item) => item.kind === 'locked')).toHaveLength(9);
  });

  it('uses hidden job metadata for locked slots when available', () => {
    const hiddenJobs = [
      { ...sampleJob, title: 'Staff Engineer', company: 'Globex', matchScore: 88, finalScore: 88 },
      { ...sampleJob, title: 'Platform Engineer', company: 'Initech', matchScore: 85, finalScore: 85 },
    ];

    const result = buildMatchFeedItems([sampleJob], 'free', hiddenJobs);
    const locked = result.filter((item) => item.kind === 'locked');

    expect(locked[0].kind).toBe('locked');
    if (locked[0].kind !== 'locked') throw new Error('expected locked slot');
    expect(locked[0].slot.title).toBe('Staff Engineer');
    expect(locked[0].slot.company).toBe('Globex');
    expect(locked[0].slot.matchScore).toBe(88);
    expect(locked[1].kind).toBe('locked');
    if (locked[1].kind !== 'locked') throw new Error('expected locked slot');
    expect(locked[1].slot.title).toBe('Platform Engineer');
  });

  it('does not append placeholders for pro users', () => {
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

  it('omits locked cards when compact paywall is enabled', () => {
    const result = buildMatchFeedItems([sampleJob], 'free', [{ ...sampleJob, title: 'Hidden' }], {
      compactPaywall: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('job');
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
  it('reports hidden roles for free users', () => {
    const hidden = [{ ...sampleJob, title: 'Staff Engineer', company: 'Globex' }];
    const summary = getDailyBatchSummary([sampleJob], 'free', hidden);
    expect(summary.visibleCount).toBe(1);
    expect(summary.totalScouted).toBe(2);
    expect(summary.hiddenCount).toBe(1);
    expect(summary.teaserJobs).toHaveLength(1);
  });
});
