// @vitest-environment happy-dom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LockedMatchCard } from '../LockedMatchCard';

describe('LockedMatchCard', () => {
  it('renders locked paywall content with upgrade CTA on first slot', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(LockedMatchCard, {
          slot: {
            kind: 'locked',
            index: 0,
            title: 'Premium Match',
            company: 'Hidden until you upgrade',
            location: 'Remote',
            salary: 'Top-fit role',
            teaser: 'Unlock 9 more AI-picked jobs daily',
          },
        })
      )
    );

    expect(html).toContain('Upgrade to Pro');
    expect(html).toContain('Unlock 9 more AI-picked jobs daily');
    expect(html).toContain('Premium Match');
  });

  it('omits upgrade button on non-first locked slots', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(LockedMatchCard, {
          slot: {
            kind: 'locked',
            index: 2,
            title: 'Premium Match',
            company: 'Hidden until you upgrade',
            location: 'Remote',
            salary: 'Top-fit role',
            teaser: 'Unlock 9 more AI-picked jobs daily',
          },
        })
      )
    );

    expect(html).not.toContain('Upgrade to Pro');
    expect(html).toContain('Locked');
  });
});
