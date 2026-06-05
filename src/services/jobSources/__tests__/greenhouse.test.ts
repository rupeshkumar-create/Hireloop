import { describe, expect, it } from 'vitest';
import { normaliseGreenhouseJob } from '../greenhouse';

describe('greenhouse adapter', () => {
  it('normalizes a remote greenhouse job', () => {
    const job = normaliseGreenhouseJob('Stripe', {
      title: 'Software Engineer',
      absolute_url: 'https://boards.greenhouse.io/stripe/jobs/123',
      location: { name: 'Remote - US' },
      content: '<p>Build APIs for payments. This role works on distributed systems and reliability.</p>',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(job?.company).toBe('Stripe');
    expect(job?.workType).toBe('remote');
    expect(job?.applyUrl).toContain('greenhouse.io');
  });

  it('rejects non-remote locations', () => {
    const job = normaliseGreenhouseJob('Stripe', {
      title: 'Software Engineer',
      absolute_url: 'https://boards.greenhouse.io/stripe/jobs/123',
      location: { name: 'San Francisco, CA' },
      content: '<p>Build APIs for payments. This role works on distributed systems and reliability.</p>',
    });
    expect(job).toBeNull();
  });
});

