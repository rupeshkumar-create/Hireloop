import { describe, expect, it } from 'vitest';
import { dedupeJobsByFingerprint, normalizeGeneratedQueries } from '../aiService';
import { rewriteScoutQueriesWithLearning } from '../learningSignals';

describe('normalizeGeneratedQueries', () => {
  it('trims whitespace and limits output to 10 queries', () => {
    const result = normalizeGeneratedQueries([
      '  frontend developer remote react  ',
      'react engineer remote startup',
      'typescript frontend remote saas',
      'senior react remote product engineer',
      'frontend software engineer remote startup',
      'remote react typescript engineer',
      'frontend engineer remote growth team',
      'remote ui engineer react typescript',
      'frontend product engineer remote react',
      'remote javascript react frontend developer',
      'extra query that should be cut',
    ]);

    expect(result).toHaveLength(10);
    expect(result[0]).toBe('frontend developer remote react');
  });
});

describe('dedupeJobsByFingerprint', () => {
  it('dedupes jobs with the same title and company', () => {
    const result = dedupeJobsByFingerprint([
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        description: 'One',
        applyLink: 'https://a',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        description: 'Two',
        applyLink: 'https://b',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it('keeps jobs with the same title at different companies', () => {
    const result = dedupeJobsByFingerprint([
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        description: 'One',
        applyLink: 'https://a',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
      {
        title: 'Frontend Engineer',
        company: 'Globex',
        location: 'Remote',
        description: 'Two',
        applyLink: 'https://b',
        salary: '',
        postedAt: 'today',
        daysOld: 0,
        requiresRelocation: false,
      },
    ]);

    expect(result).toHaveLength(2);
  });
});

describe('rewriteScoutQueriesWithLearning', () => {
  it('returns original queries when no learning signals exist', () => {
    const queries = ['remote frontend engineer react site:greenhouse.io'];
    expect(rewriteScoutQueriesWithLearning(queries, undefined)).toEqual(queries);
  });

  it('removes disliked modifiers without stripping the role anchor', () => {
    const result = rewriteScoutQueriesWithLearning(
      ['remote frontend engineer react java site:greenhouse.io'],
      {
        likedKeywords: [],
        dislikedKeywords: ['java'],
      }
    );

    expect(result[0]).toContain('frontend engineer');
    expect(result[0]).toContain('remote');
    expect(result[0]).toContain('site:greenhouse.io');
    expect(result[0]).not.toContain('java');
  });

  it('adds up to two liked modifiers when they are absent', () => {
    const result = rewriteScoutQueriesWithLearning(
      ['remote frontend engineer react site:greenhouse.io'],
      {
        likedKeywords: ['typescript', 'graphql', 'next.js'],
        dislikedKeywords: [],
      }
    );

    expect(result[0]).toContain('typescript');
    expect(result[0]).toContain('graphql');
    expect(result[0]).not.toContain('next.js');
  });
});
