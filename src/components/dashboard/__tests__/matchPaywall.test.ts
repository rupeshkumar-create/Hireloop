import { describe, expect, it } from 'vitest';
import { buildMatchFeedItems } from '../matchPaywall';
import type { Job } from '../../../types/dashboard';

const sampleJob: Job = {
  title: 'Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  salary: '$120k',
  description: 'Build product UI',
  url: 'https://example.com/jobs/1',
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
});
