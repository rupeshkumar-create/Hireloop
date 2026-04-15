import { describe, expect, it } from 'vitest';
import {
  isRecent,
  validateAssetForgeEmail,
  validateGeneratedEmail,
  validateJob,
  validateQueryGenerationOutput,
  validateJobScoringOutput,
  validateJobValidationBatchOutput,
  validateJobsBeforeAI,
  validateTailoredResumeOutput,
  type GuardrailJobInput,
  type GuardrailUserContext,
} from '../validator';

const remoteUser: GuardrailUserContext = {
  preferences: {
    remoteOnly: true,
  },
};

const baseJob: GuardrailJobInput = {
  title: 'Senior Frontend Engineer',
  company: 'Acme',
  location: 'Remote - US',
  description: 'Build product features',
  url: 'https://jobs.example.com/123',
  isRemote: true,
  postedAt: new Date().toISOString(),
};

describe('isRecent', () => {
  it('returns true for a job posted today', () => {
    expect(isRecent(new Date().toISOString(), 7)).toBe(true);
  });

  it('returns false for a job older than 7 days', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecent(old, 7)).toBe(false);
  });
});

describe('validateJob', () => {
  it('rejects a job with no url', () => {
    const result = validateJob({ ...baseJob, url: '' }, remoteUser);
    expect(result.passed).toBe(false);
    expect(result.code).toBe('MISSING_URL');
  });

  it('rejects a non-remote job for a remote-only user', () => {
    const result = validateJob(
      { ...baseJob, isRemote: false, location: 'New York, NY' },
      remoteUser
    );
    expect(result.passed).toBe(false);
    expect(result.code).toBe('REMOTE_MISMATCH');
  });

  it('rejects a stale job', () => {
    const old = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const result = validateJob({ ...baseJob, postedAt: old }, remoteUser);
    expect(result.passed).toBe(false);
    expect(result.code).toBe('STALE_JOB');
  });

  it('accepts a valid recent remote job', () => {
    const result = validateJob(baseJob, remoteUser);
    expect(result.passed).toBe(true);
  });
});

describe('validateJobsBeforeAI', () => {
  it('splits accepted and rejected jobs', () => {
    const result = validateJobsBeforeAI(
      [baseJob, { ...baseJob, url: '', title: 'Broken Link Job' }],
      remoteUser
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].validation.code).toBe('MISSING_URL');
  });
});

describe('validateJobValidationBatchOutput', () => {
  it('rejects mismatched totals', () => {
    const result = validateJobValidationBatchOutput(
      { accepted: [baseJob], rejected: [] },
      { expectedCount: 2 }
    );

    expect(result.passed).toBe(false);
    expect(result.code).toBe('VALIDATION_COUNT_MISMATCH');
  });
});

describe('validateJobScoringOutput', () => {
  it('rejects non-array output', () => {
    const result = validateJobScoringOutput({}, { jobCount: 1 });
    expect(result.passed).toBe(false);
    expect(result.code).toBe('INVALID_SCORING_OUTPUT');
  });

  it('accepts scored jobs with numeric matchScore', () => {
    const result = validateJobScoringOutput(
      [{ matchScore: 87 }, { matchScore: 63 }],
      { jobCount: 2 }
    );

    expect(result.passed).toBe(true);
  });
});

describe('validateQueryGenerationOutput', () => {
  it('rejects non-array output', () => {
    const result = validateQueryGenerationOutput({}, { expectedCount: 10 });
    expect(result.passed).toBe(false);
    expect(result.code).toBe('INVALID_QUERY_OUTPUT');
  });

  it('rejects arrays with fewer than 10 queries', () => {
    const result = validateQueryGenerationOutput(
      ['frontend engineer remote react'],
      { expectedCount: 10 }
    );
    expect(result.passed).toBe(false);
    expect(result.code).toBe('QUERY_COUNT_MISMATCH');
  });

  it('rejects duplicate queries after normalization', () => {
    const result = validateQueryGenerationOutput(
      [
        'frontend engineer remote react',
        'frontend engineer remote react',
        'q3',
        'q4',
        'q5',
        'q6',
        'q7',
        'q8',
        'q9',
        'q10',
      ],
      { expectedCount: 10 }
    );
    expect(result.passed).toBe(false);
    expect(result.code).toBe('DUPLICATE_QUERY');
  });

  it('accepts 10 unique non-empty queries', () => {
    const result = validateQueryGenerationOutput(
      [
        'frontend developer remote react',
        'react engineer remote startup',
        'typescript frontend remote saas',
        'senior react remote product engineer',
        'frontend software engineer remote startup',
        'remote react typescript engineer',
        'frontend engineer remote growth team',
        'remote ui engineer react typescript',
        'frontend product engineer remote react',
        'remote javascript react frontend developer',
      ],
      { expectedCount: 10 }
    );
    expect(result.passed).toBe(true);
  });
});

describe('validateGeneratedEmail', () => {
  it('rejects generic language', () => {
    const result = validateGeneratedEmail(
      'I am excited to apply for the Frontend Engineer role at Acme.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
    );

    expect(result.passed).toBe(false);
    expect(result.code).toBe('GENERIC_LANGUAGE');
  });

  it('accepts a grounded email under the limit', () => {
    const result = validateGeneratedEmail(
      'Saw the Frontend Engineer role at Acme. I have shipped React dashboards and design systems for remote teams and can help your product move faster.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
    );

    expect(result.passed).toBe(true);
  });
});

describe('validateAssetForgeEmail', () => {
  it('rejects an email that does not mention the company', () => {
    const result = validateAssetForgeEmail(
      'I can help your team with React architecture for this Frontend Engineer role.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
    );

    expect(result.passed).toBe(false);
    expect(result.code).toBe('MISSING_COMPANY');
  });

  it('rejects an email that does not mention the role', () => {
    const result = validateAssetForgeEmail(
      'I can help Acme ship product faster with React and TypeScript.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
    );

    expect(result.passed).toBe(false);
    expect(result.code).toBe('MISSING_ROLE');
  });

  it('rejects an email over 120 words', () => {
    const longEmail = `${'Acme Frontend Engineer '.repeat(50)}`.trim();
    const result = validateAssetForgeEmail(longEmail, {
      company: 'Acme',
      jobTitle: 'Frontend Engineer',
    });

    expect(result.passed).toBe(false);
    expect(result.code).toBe('EMAIL_TOO_LONG');
  });

  it('accepts a concise company-and-role-specific email', () => {
    const result = validateAssetForgeEmail(
      'I saw the Frontend Engineer opening at Acme. My resume shows React, TypeScript, and dashboard work that maps well to the role, and I would be glad to connect.',
      { company: 'Acme', jobTitle: 'Frontend Engineer' }
    );

    expect(result.passed).toBe(true);
  });
});

describe('validateTailoredResumeOutput', () => {
  it('rejects output with no job keyword alignment', () => {
    const result = validateTailoredResumeOutput('Completely unrelated text.', {
      jobDescription: 'React TypeScript frontend engineer building dashboards',
    });

    expect(result.passed).toBe(false);
    expect(result.code).toBe('NO_KEYWORD_ALIGNMENT');
  });

  it('accepts output with matching job keywords', () => {
    const result = validateTailoredResumeOutput('Built React and TypeScript dashboards.', {
      jobDescription: 'React TypeScript frontend engineer building dashboards',
    });

    expect(result.passed).toBe(true);
  });
});
