import { describe, expect, it } from 'vitest';
import { normalizeLinkedInProfileUrl, profileTextFromLinkedInData } from '../linkedinUrl';

describe('normalizeLinkedInProfileUrl', () => {
  it('normalizes linkedin.com/in URLs', () => {
    expect(normalizeLinkedInProfileUrl('linkedin.com/in/jane-doe')).toBe(
      'https://linkedin.com/in/jane-doe'
    );
  });

  it('rejects non-profile URLs', () => {
    expect(normalizeLinkedInProfileUrl('https://linkedin.com/company/acme')).toBeNull();
  });
});

describe('profileTextFromLinkedInData', () => {
  it('builds resume-like text from profile fields', () => {
    const text = profileTextFromLinkedInData({
      name: 'Jane Doe',
      headline: 'Senior Engineer',
      summary: 'Built distributed systems.',
      skills: ['TypeScript', 'React'],
    });
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Senior Engineer');
    expect(text).toContain('TypeScript');
  });
});
