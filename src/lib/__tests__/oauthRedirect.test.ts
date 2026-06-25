import { describe, expect, it } from 'vitest';
import { resolveOAuthOrigin } from '../oauthRedirect';

describe('resolveOAuthOrigin', () => {
  it('uses live browser origin on production, ignoring localhost env', () => {
    expect(
      resolveOAuthOrigin('https://hireloop-xi.vercel.app', 'http://localhost:3001')
    ).toBe('https://hireloop-xi.vercel.app');
  });

  it('uses env site url on localhost dev', () => {
    expect(resolveOAuthOrigin('http://localhost:3001', 'http://localhost:3001')).toBe(
      'http://localhost:3001'
    );
  });

  it('falls back to env when window origin is missing', () => {
    expect(resolveOAuthOrigin(undefined, 'https://hireloop-xi.vercel.app')).toBe(
      'https://hireloop-xi.vercel.app'
    );
  });
});
