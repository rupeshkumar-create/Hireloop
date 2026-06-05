import { describe, expect, it } from 'vitest';
import {
  hasResumeTextChanged,
  jobMatchesUserPreferences,
  normalizeResumeText,
  normalizeUserPreferences,
  syncLegacyPreferenceFields,
  validateStructuredProfile,
} from '../validator';

describe('phase 2 profile helpers', () => {
  it('syncs nested preferences to legacy profile fields', () => {
    const result = syncLegacyPreferenceFields({
      remoteOnly: true,
      salaryFloor: 150000,
      locations: ['San Francisco, CA', 'New York, NY'],
    });

    expect(result.jobType).toBe('remote');
    expect(result.minSalary).toBe(150000);
    expect(result.location).toBe('San Francisco, CA');
  });
});

describe('normalizeResumeText', () => {
  it('collapses repeated whitespace and trims noise', () => {
    const cleaned = normalizeResumeText('  Senior Engineer\n\nReact   TypeScript   ');
    expect(cleaned).toBe('Senior Engineer\n\nReact TypeScript');
  });
});

describe('hasResumeTextChanged', () => {
  it('returns false when only whitespace changes', () => {
    expect(
      hasResumeTextChanged(
        'Senior Engineer\n\nReact TypeScript',
        '  Senior Engineer\r\n\r\nReact   TypeScript   '
      )
    ).toBe(false);
  });

  it('returns true when the resume content changes', () => {
    expect(
      hasResumeTextChanged(
        'Senior Engineer\n\nReact TypeScript',
        'Senior Engineer\n\nReact TypeScript\nGraphQL'
      )
    ).toBe(true);
  });
});

describe('normalizeUserPreferences', () => {
  it('normalizes remoteOnly, salaryFloor, and locations', () => {
    const normalized = normalizeUserPreferences({
      remoteOnly: 'true',
      salaryFloor: '180000',
      locations: [' New York, NY ', '', 'Remote'],
    });

    expect(normalized).toEqual({
      remoteOnly: true,
      salaryFloor: 180000,
      locations: ['New York, NY', 'Remote'],
    });
  });
});

describe('jobMatchesUserPreferences', () => {
  it('rejects non-remote jobs for remote-only users', () => {
    const match = jobMatchesUserPreferences(
      {
        isRemote: false,
        salary: '$200,000',
        location: 'San Francisco, CA',
      },
      {
        remoteOnly: true,
        salaryFloor: null,
        locations: [],
      }
    );

    expect(match.passed).toBe(false);
    expect(match.code).toBe('REMOTE_MISMATCH');
  });

  it('rejects jobs below the salary floor', () => {
    const match = jobMatchesUserPreferences(
      {
        isRemote: true,
        salary: '$90,000',
        location: 'Remote',
      },
      {
        remoteOnly: true,
        salaryFloor: 120000,
        locations: [],
      }
    );

    expect(match.passed).toBe(false);
    expect(match.code).toBe('SALARY_FLOOR_MISMATCH');
  });

  it('rejects jobs outside preferred locations when locations are set', () => {
    const match = jobMatchesUserPreferences(
      {
        isRemote: false,
        salary: '$150,000',
        location: 'Austin, TX',
      },
      {
        remoteOnly: false,
        salaryFloor: null,
        locations: ['New York, NY'],
      }
    );

    expect(match.passed).toBe(false);
    expect(match.code).toBe('LOCATION_MISMATCH');
  });
});

describe('validateStructuredProfile', () => {
  it('accepts a complete structured profile shape', () => {
    const result = validateStructuredProfile({
      skills: ['react'],
      techStack: ['typescript', 'firebase'],
      seniority: 'senior',
      roles: ['Frontend Engineer'],
      industries: ['SaaS'],
    });

    expect(result.passed).toBe(true);
  });
});
