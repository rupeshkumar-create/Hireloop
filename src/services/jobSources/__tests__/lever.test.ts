import { describe, expect, it } from 'vitest';
import { normaliseLeverPosting } from '../lever';

describe('lever adapter', () => {
  it('normalizes a remote lever job', () => {
    const job = normaliseLeverPosting('Notion', {
      text: 'Backend Engineer',
      hostedUrl: 'https://jobs.lever.co/notion/abc',
      categories: { location: 'Remote - US' },
      descriptionPlain: 'Build backend systems for collaboration. Own reliability and scale. Partner with product and design to ship features, improve performance, and harden the platform.',
      createdAt: Date.now(),
    });
    expect(job?.company).toBe('Notion');
    expect(job?.workType).toBe('remote');
    expect(job?.applyUrl).toContain('lever.co');
  });

  it('rejects non-remote locations', () => {
    const job = normaliseLeverPosting('Notion', {
      text: 'Backend Engineer',
      hostedUrl: 'https://jobs.lever.co/notion/abc',
      categories: { location: 'New York, NY' },
      descriptionPlain: 'Build backend systems for collaboration. Own reliability and scale. Partner with product and design to ship features, improve performance, and harden the platform.',
      createdAt: Date.now(),
    });
    expect(job).toBeNull();
  });
});
