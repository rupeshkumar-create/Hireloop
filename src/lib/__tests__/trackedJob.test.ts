// Pure-helper tests for the tracked-job model. Each block locks in one
// behavioural contract surfaced in the pipeline UI.

import { describe, expect, it } from 'vitest';
import {
  assetCompleteness,
  daysBetween,
  followUpHint,
  pipelineMetrics,
  searchTrackedJobs,
  statusTransitionPatch,
  timeAwareLabel,
  trackedJobsToCsv,
  trackedJobsToIcs,
  type TrackedJob,
} from '../trackedJob';

function base(overrides: Partial<TrackedJob> = {}): TrackedJob {
  return {
    id: 'j1',
    userId: 'u1',
    title: 'Senior Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    salary: '',
    status: 'saved',
    url: 'https://example.com/jd',
    notes: '',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

const NOW = new Date('2026-05-15T00:00:00.000Z');

// ─── daysBetween ─────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns whole-day difference, floor-rounded', () => {
    expect(daysBetween('2026-05-10T00:00:00.000Z', NOW)).toBe(5);
  });
  it('returns null on missing input', () => {
    expect(daysBetween(undefined, NOW)).toBeNull();
  });
  it('returns null on invalid date string', () => {
    expect(daysBetween('not-a-date', NOW)).toBeNull();
  });
});

// ─── timeAwareLabel ──────────────────────────────────────────────────────────

describe('timeAwareLabel', () => {
  it('green for recently saved', () => {
    const j = base({ createdAt: '2026-05-14T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW)).toEqual({ label: 'Saved 1d ago', tone: 'green' });
  });

  it('amber for saved 5 days ago — nudges to apply', () => {
    const j = base({ createdAt: '2026-05-10T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW)).toEqual({ label: 'Saved 5d ago — apply?', tone: 'amber' });
  });

  it('red for stale saved 10+ days ago', () => {
    const j = base({ createdAt: '2026-05-04T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW)).toMatchObject({ tone: 'red' });
  });

  it('applied recently: green', () => {
    const j = base({ status: 'applied', appliedAt: '2026-05-14T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW)).toEqual({ label: 'Applied 1d ago', tone: 'green' });
  });

  it('applied 9 days ago: amber + follow-up hint in label', () => {
    const j = base({ status: 'applied', appliedAt: '2026-05-06T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW).label).toMatch(/follow up/i);
    expect(timeAwareLabel(j, NOW).tone).toBe('amber');
  });

  it('applied 14+ days ago: red + stalled', () => {
    const j = base({ status: 'applied', appliedAt: '2026-04-30T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW).tone).toBe('red');
  });

  it('offered with imminent deadline: red', () => {
    const j = base({ status: 'offered', offerDeadline: '2026-05-16T12:00:00.000Z' });
    expect(timeAwareLabel(j, NOW).tone).toBe('red');
  });

  it('offered with past deadline: red + past due', () => {
    const j = base({ status: 'offered', offerDeadline: '2026-05-10T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW).label).toMatch(/past due/i);
  });

  it('interviewing tomorrow: red hours-countdown', () => {
    const j = base({ status: 'interviewing', interviewAt: '2026-05-15T18:00:00.000Z' });
    expect(timeAwareLabel(j, NOW).tone).toBe('red');
  });

  it('rejected: muted tone', () => {
    const j = base({ status: 'rejected', statusChangedAt: '2026-05-10T00:00:00.000Z' });
    expect(timeAwareLabel(j, NOW).tone).toBe('muted');
  });
});

// ─── statusTransitionPatch ───────────────────────────────────────────────────

describe('statusTransitionPatch', () => {
  it('returns empty patch when status unchanged (no-op write)', () => {
    expect(statusTransitionPatch(base({ status: 'saved' }), 'saved')).toEqual({});
  });

  it('stamps appliedAt and statusChangedAt on saved → applied', () => {
    const patch = statusTransitionPatch(base({ status: 'saved' }), 'applied', NOW);
    expect(patch.status).toBe('applied');
    expect(patch.appliedAt).toBe(NOW.toISOString());
    expect(patch.statusChangedAt).toBe(NOW.toISOString());
  });

  it('does not overwrite appliedAt if already present (re-transition to applied)', () => {
    const existing = base({ status: 'rejected', appliedAt: '2026-05-01T00:00:00.000Z' });
    const patch = statusTransitionPatch(existing, 'applied', NOW);
    expect(patch.appliedAt).toBeUndefined();
    expect(patch.statusChangedAt).toBe(NOW.toISOString());
  });

  it('stamps statusChangedAt on any non-applied transition', () => {
    const patch = statusTransitionPatch(base({ status: 'applied' }), 'interviewing', NOW);
    expect(patch.statusChangedAt).toBe(NOW.toISOString());
    expect(patch.appliedAt).toBeUndefined();
  });
});

// ─── assetCompleteness ──────────────────────────────────────────────────────

describe('assetCompleteness', () => {
  it('reports 0/5 for a brand-new save', () => {
    const c = assetCompleteness(base());
    expect(c.completed).toBe(0);
    expect(c.total).toBe(5);
  });

  it('reports each asset truthy when present + non-empty', () => {
    const c = assetCompleteness(base({
      tailoredResume: '# Resume', coldEmail: 'Email body', followUpEmail: 'fu',
      coverLetter: 'Dear team...',
      interviewQuestions: ['Q1', 'Q2'],
    }));
    expect(c).toEqual({
      resume: true,
      email: true,
      coverLetter: true,
      interview: true,
      followUp: true,
      completed: 5,
      total: 5,
    });
  });

  it('treats whitespace-only strings as absent', () => {
    const c = assetCompleteness(base({ tailoredResume: '   ', coldEmail: '' }));
    expect(c.completed).toBe(0);
  });
});

// ─── followUpHint ───────────────────────────────────────────────────────────

describe('followUpHint', () => {
  it('does not prompt before day 7', () => {
    const j = base({ status: 'applied', appliedAt: '2026-05-12T00:00:00.000Z' });
    expect(followUpHint(j, NOW).shouldPrompt).toBe(false);
  });

  it('prompts at day 7+', () => {
    const j = base({ status: 'applied', appliedAt: '2026-05-06T00:00:00.000Z' });
    expect(followUpHint(j, NOW).shouldPrompt).toBe(true);
  });

  it('uses more-urgent copy at day 14+', () => {
    const j = base({ status: 'applied', appliedAt: '2026-04-30T00:00:00.000Z' });
    expect(followUpHint(j, NOW).reason).toMatch(/one more time/i);
  });

  it('stops nagging once a follow-up has been drafted', () => {
    const j = base({
      status: 'applied',
      appliedAt: '2026-05-06T00:00:00.000Z',
      followUpEmail: 'Hi…',
    });
    expect(followUpHint(j, NOW).shouldPrompt).toBe(false);
  });

  it('never prompts for non-applied statuses', () => {
    expect(followUpHint(base({ status: 'saved' }), NOW).shouldPrompt).toBe(false);
    expect(followUpHint(base({ status: 'interviewing' }), NOW).shouldPrompt).toBe(false);
  });
});

// ─── pipelineMetrics ────────────────────────────────────────────────────────

describe('pipelineMetrics', () => {
  it('counts statuses and computes conversion rates', () => {
    const jobs: TrackedJob[] = [
      base({ id: '1', status: 'saved' }),
      base({ id: '2', status: 'saved' }),
      base({ id: '3', status: 'applied' }),
      base({ id: '4', status: 'applied' }),
      base({ id: '5', status: 'interviewing' }),
      base({ id: '6', status: 'offered' }),
      base({ id: '7', status: 'rejected' }),
    ];
    const m = pipelineMetrics(jobs);
    expect(m.total).toBe(7);
    expect(m.saved).toBe(2);
    expect(m.applied).toBe(2);
    expect(m.interviewing).toBe(1);
    expect(m.offered).toBe(1);
    expect(m.rejected).toBe(1);
    // advancedToApplied = 5/7 ≈ 0.714
    expect(m.saveToApplyRate).toBeCloseTo(5 / 7, 3);
    // advancedToInterview = 2/5 = 0.4
    expect(m.applyToInterviewRate).toBeCloseTo(2 / 5, 3);
    // 1/2 = 0.5
    expect(m.interviewToOfferRate).toBeCloseTo(1 / 2, 3);
  });

  it('returns 0 rates on empty pipeline', () => {
    const m = pipelineMetrics([]);
    expect(m.saveToApplyRate).toBe(0);
    expect(m.applyToInterviewRate).toBe(0);
    expect(m.interviewToOfferRate).toBe(0);
    expect(m.medianTimeToApplyDays).toBeNull();
  });

  it('computes median time-to-apply across applied jobs', () => {
    const jobs: TrackedJob[] = [
      base({ createdAt: '2026-05-01T00:00:00Z', appliedAt: '2026-05-04T00:00:00Z' }),  // 3d
      base({ createdAt: '2026-05-01T00:00:00Z', appliedAt: '2026-05-06T00:00:00Z' }),  // 5d
      base({ createdAt: '2026-05-01T00:00:00Z', appliedAt: '2026-05-08T00:00:00Z' }),  // 7d
    ];
    expect(pipelineMetrics(jobs).medianTimeToApplyDays).toBe(5);
  });
});

// ─── search ─────────────────────────────────────────────────────────────────

describe('searchTrackedJobs', () => {
  const jobs: TrackedJob[] = [
    base({ id: '1', title: 'Senior Frontend Engineer', company: 'Stripe' }),
    base({ id: '2', title: 'Backend Engineer', company: 'Acme', location: 'Berlin' }),
    base({ id: '3', title: 'Designer', company: 'Linear', notes: 'fintech focus' }),
  ];

  it('returns all jobs on empty query', () => {
    expect(searchTrackedJobs(jobs, '   ').length).toBe(3);
  });

  it('matches case-insensitively across title + company + notes + location', () => {
    expect(searchTrackedJobs(jobs, 'stripe')).toHaveLength(1);
    expect(searchTrackedJobs(jobs, 'berlin')).toHaveLength(1);
    expect(searchTrackedJobs(jobs, 'fintech')).toHaveLength(1);
  });

  it('returns empty when no match', () => {
    expect(searchTrackedJobs(jobs, 'kubernetes')).toHaveLength(0);
  });
});

// ─── CSV export ─────────────────────────────────────────────────────────────

describe('trackedJobsToCsv', () => {
  it('includes header row + one row per job', () => {
    const csv = trackedJobsToCsv([
      base({ title: 'A', company: 'X' }),
      base({ title: 'B', company: 'Y' }),
    ]);
    const lines = csv.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('Title');
    expect(lines[1]).toContain('A');
    expect(lines[2]).toContain('B');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const csv = trackedJobsToCsv([base({ title: 'A, B "C"', notes: 'line1\nline2' })]);
    expect(csv).toContain('"A, B ""C"""');
    expect(csv).toContain('"line1\nline2"');
  });

  it('marks asset completeness as yes/no per column', () => {
    const csv = trackedJobsToCsv([base({ tailoredResume: 'r', coldEmail: '' })]);
    const row = csv.split('\n')[1];
    expect(row).toMatch(/yes/);
    expect(row).toMatch(/no/);
  });
});

// ─── ICS export ─────────────────────────────────────────────────────────────

describe('trackedJobsToIcs', () => {
  it('emits one VEVENT per scheduled interview', () => {
    const ics = trackedJobsToIcs([
      base({ id: '1', interviewAt: '2026-06-01T13:00:00.000Z' }),
      base({ id: '2', interviewAt: '2026-06-02T15:00:00.000Z' }),
      base({ id: '3' }), // no interviewAt → skipped
    ]);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(2);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('escapes commas and newlines in summary/description', () => {
    const ics = trackedJobsToIcs([
      base({ id: 'x', title: 'Senior, Lead', interviewAt: '2026-06-01T13:00:00.000Z' }),
    ]);
    expect(ics).toContain('Senior\\, Lead');
  });

  it('produces a calendar with no events when no interviews scheduled', () => {
    const ics = trackedJobsToIcs([base()]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
