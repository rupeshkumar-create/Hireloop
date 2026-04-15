import { describe, expect, it } from 'vitest';
import {
  normalizeApolloRecruiter,
  type ApolloRecruiterPayload,
} from '../apolloService';
import { buildAssetForgeSkipResult } from '../aiService';

describe('normalizeApolloRecruiter', () => {
  it('returns null when recruiter email is missing', () => {
    const result = normalizeApolloRecruiter({
      first_name: 'Jane',
      last_name: 'Doe',
      title: 'Recruiter',
      email: '',
      linkedin_url: '',
    } satisfies ApolloRecruiterPayload);

    expect(result).toBeNull();
  });

  it('returns normalized recruiter data when email exists', () => {
    const result = normalizeApolloRecruiter({
      first_name: 'Jane',
      last_name: 'Doe',
      title: 'Recruiter',
      email: 'jane@acme.com',
      linkedin_url: 'https://linkedin.com/in/jane',
    } satisfies ApolloRecruiterPayload);

    expect(result).toEqual({
      name: 'Jane Doe',
      title: 'Recruiter',
      email: 'jane@acme.com',
      linkedinUrl: 'https://linkedin.com/in/jane',
    });
  });
});

describe('buildAssetForgeSkipResult', () => {
  it('returns a recruiter_not_found skip payload', () => {
    expect(buildAssetForgeSkipResult('recruiter_not_found')).toEqual({
      status: 'skipped',
      reason: 'recruiter_not_found',
    });
  });
});
