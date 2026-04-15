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
  title: 'Frontend Engineer',
  company: 'Acme',
  location: 'Remote',
  salary: '$120k',
  description: 'Build product UI',
  url: 'https://example.com/jobs/1',
  requirements: ['React', 'TypeScript'],
  matchScore: 92,
};

function renderMatches(plan?: string, jobs: Job[] = [sampleJob]) {
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
      { ...sampleJob, title: 'Platform Engineer', url: 'https://example.com/jobs/2' },
    ]);

    expect(html).not.toContain('Upgrade to Pro');
    expect(html).not.toContain('Premium Match');
  });
});
