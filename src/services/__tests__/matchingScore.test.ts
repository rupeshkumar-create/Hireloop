// Unit tests for the rewritten deterministicMatchScore. The old scorer had
// two well-known bugs that these tests lock down so they don't regress:
//
//   1. STOP_WORDS used to drop "engineer", "senior", "developer" etc., which
//      meant a career path of "Senior Frontend Engineer" never actually
//      matched a job titled "Senior Frontend Engineer". Now the score for
//      an exact title match should be high (≥60 after all bonuses).
//
//   2. Skill matching relied on a hard-coded 30-item list that missed
//      domain-specific terms. Now it prefers the AI-extracted structured
//      profile when provided.

import { describe, expect, it } from 'vitest';
import { deterministicMatchScore } from '../jobMatchingEngine';

function makeJob(overrides: Partial<any> = {}): any {
  return {
    fingerprint: 'fp',
    title: 'Senior Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    workType: 'remote',
    salary: '',
    description: 'Build modern web applications.',
    requirements: [],
    source: 'ats-greenhouse',
    applyUrl: 'https://example.com/apply',
    postedAt: new Date().toISOString(),
    daysOld: 1,
    ...overrides,
  };
}

describe('deterministicMatchScore — title alignment', () => {
  it('scores an exact career-path/title match in the top quartile', () => {
    const score = deterministicMatchScore({
      job: makeJob({ title: 'Senior Frontend Engineer' }),
      careerPaths: ['Senior Frontend Engineer'],
      resumeText: '',
    });
    // exact-title (35) + token overlap (15) + remote (8) + recency (5) + apply (3)
    // = 66 minimum even without skills.
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('partial-substring title match earns less than exact', () => {
    const exact = deterministicMatchScore({
      job: makeJob({ title: 'Senior Frontend Engineer' }),
      careerPaths: ['Senior Frontend Engineer'],
      resumeText: '',
    });
    const substring = deterministicMatchScore({
      job: makeJob({ title: 'Senior Frontend Engineer II — Growth Pod' }),
      careerPaths: ['Senior Frontend Engineer'],
      resumeText: '',
    });
    expect(substring).toBeLessThan(exact);
    expect(substring).toBeGreaterThan(40);
  });

  it('completely unrelated title scores low', () => {
    const score = deterministicMatchScore({
      job: makeJob({ title: 'Aquatic Biologist' }),
      careerPaths: ['Senior Frontend Engineer'],
      resumeText: '',
    });
    expect(score).toBeLessThan(30);
  });
});

describe('deterministicMatchScore — skill overlap from structured profile', () => {
  it('rewards jobs whose description mentions skills the candidate actually has', () => {
    const haveSkills = deterministicMatchScore({
      job: makeJob({
        title: 'Backend Engineer',
        description: 'TypeScript and PostgreSQL on AWS. GraphQL APIs.',
      }),
      careerPaths: ['Backend Engineer'],
      resumeText: '',
      structuredProfile: {
        skills: ['Backend development'],
        techStack: ['TypeScript', 'PostgreSQL', 'GraphQL', 'AWS'],
        seniority: 'Senior',
        roles: ['Backend Engineer'],
        industries: ['SaaS'],
      },
    });
    const noSkills = deterministicMatchScore({
      job: makeJob({
        title: 'Backend Engineer',
        description: 'TypeScript and PostgreSQL on AWS. GraphQL APIs.',
      }),
      careerPaths: ['Backend Engineer'],
      resumeText: '',
      // No structuredProfile and empty resumeText → no skill hits possible.
    });
    expect(haveSkills).toBeGreaterThan(noSkills);
    expect(haveSkills - noSkills).toBeGreaterThanOrEqual(10);
  });

  it('does not crash on regex-special characters in skill names (C++, C#, .NET)', () => {
    expect(() =>
      deterministicMatchScore({
        job: makeJob({ description: 'C++ and C# and .NET roles welcome.' }),
        careerPaths: ['Software Engineer'],
        resumeText: '',
        structuredProfile: { skills: [], techStack: ['C++', 'C#', '.NET'] },
      }),
    ).not.toThrow();
  });
});

describe('deterministicMatchScore — seniority alignment', () => {
  it('penalises a junior role offered to a senior candidate', () => {
    const aligned = deterministicMatchScore({
      job: makeJob({ title: 'Senior Frontend Engineer' }),
      careerPaths: ['Senior Frontend Engineer'],
      resumeText: '',
      structuredProfile: { seniority: 'Senior', skills: [], techStack: [] },
    });
    const mismatched = deterministicMatchScore({
      job: makeJob({ title: 'Junior Frontend Engineer' }),
      careerPaths: ['Senior Frontend Engineer'],
      resumeText: '',
      structuredProfile: { seniority: 'Senior', skills: [], techStack: [] },
    });
    expect(mismatched).toBeLessThan(aligned);
  });

  it('rewards on-level matches', () => {
    const aligned = deterministicMatchScore({
      job: makeJob({ title: 'Staff Engineer' }),
      careerPaths: ['Staff Engineer'],
      resumeText: '',
      structuredProfile: { seniority: 'Staff', skills: [], techStack: [] },
    });
    expect(aligned).toBeGreaterThan(50);
  });
});

describe('deterministicMatchScore — score range hygiene', () => {
  it('always returns a value in [0, 100]', () => {
    for (const title of ['', 'X', 'aaaaa'.repeat(100), 'Senior Frontend Engineer']) {
      const s = deterministicMatchScore({
        job: makeJob({ title }),
        careerPaths: ['Frontend'],
        resumeText: '',
      });
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});
