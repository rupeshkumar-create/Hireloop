import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MatchesTab } from '../MatchesTab';
import type { Job } from '../../../types/dashboard';

vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
}));

const sampleJob: Job = {
  id: 'frontend engineer::acme',
  fingerprint: 'frontend engineer::acme',
  title: 'Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  workType: 'remote',
  salary: '$120k',
  description: 'Build product UI',
  source: 'remotive',
  applyUrl: 'https://example.com/jobs/1',
  postedAt: new Date().toISOString(),
  requirements: ['React', 'TypeScript'],
  matchScore: 92,
  finalScore: 92,
  matchReasons: [],
  skillGaps: [],
  aiSummary: '',
  isHotJob: false,
};

function renderMatches(
  plan?: string,
  jobs: Job[] = [sampleJob],
  savedJobFingerprints: string[] = []
) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(MatchesTab, {
        plan,
        jobs,
        loadingJobs: false,
        fetchJobs: () => {},
        filterCompany: '',
        setFilterCompany: () => {},
        filterLocation: '',
        setFilterLocation: () => {},
        filterSalary: '',
        setFilterSalary: () => {},
        sortBy: 'matchScore',
        setSortBy: () => {},
        selectedJob: null,
        setSelectedJob: () => {},
        setAiAction: () => {},
        saveJob: async () => true,
        savedJobFingerprints,
        dismissJob: () => {},
      })
    )
  );
}

describe('MatchesTab paywall rendering', () => {
  it('shows locked placeholders and the upgrade CTA for free users', () => {
    const html = renderMatches('free');

    expect(html).toContain('Upgrade to Pro');
    expect(html).toContain('Unlock 9 more AI-picked jobs daily');
    expect((html.match(/Premium Match/g) || []).length).toBe(9);
  });

  it('does not show locked placeholders for pro users', () => {
    const html = renderMatches('pro', [
      sampleJob,
      { ...sampleJob, title: 'Platform Engineer', id: 'platform engineer::acme', fingerprint: 'platform engineer::acme', applyUrl: 'https://example.com/jobs/2' },
    ]);

    expect(html).not.toContain('Upgrade to Pro');
    expect(html).not.toContain('Premium Match');
  });

  it('shows a save action on unlocked job cards', () => {
    const html = renderMatches('pro');

    expect(html).toContain('Save');
  });

  it('shows saved status for recently saved jobs', () => {
    const html = renderMatches('pro', [sampleJob], ['frontend engineer::acme']);

    expect(html).toContain('Saved');
  });
});
