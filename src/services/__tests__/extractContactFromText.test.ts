// Deterministic regex extractor for resume contact details. Doesn't touch
// the AI — these tests catch the most common contact-line shapes Hireschema
// users paste in.

import { describe, expect, it } from 'vitest';
import { extractContactFromText } from '../aiService';

describe('extractContactFromText', () => {
  it('pulls email + phone + linkedin from a typical Indian resume header', () => {
    const text = `
      Vivek Kumar
      vivek.kumar@gmail.com | +91 9876543210 | Bengaluru, Karnataka, India
      linkedin.com/in/vivekkumar | github.com/vivekk
    `;
    const c = extractContactFromText(text);
    expect(c.email).toBe('vivek.kumar@gmail.com');
    expect(c.phone).toMatch(/9876543210/);
    expect(c.linkedin).toContain('linkedin.com/in/vivekkumar');
    expect(c.github).toContain('github.com/vivekk');
  });

  it('handles US phone number formats', () => {
    expect(extractContactFromText('(415) 555-0123').phone).toContain('(415) 555-0123');
    expect(extractContactFromText('415-555-0123').phone).toContain('415-555-0123');
  });

  it('catches a bare 10-digit Indian mobile', () => {
    const c = extractContactFromText('Phone: 9876543210');
    expect(c.phone).toMatch(/9876543210/);
  });

  it('extracts personal website but skips linkedin/github/email domains', () => {
    const text = `email@example.com  linkedin.com/in/x  github.com/x  mysite.dev/portfolio`;
    const c = extractContactFromText(text);
    expect(c.website).toContain('mysite.dev');
    expect(c.website).not.toContain('linkedin');
    expect(c.website).not.toContain('github');
  });

  it('returns empty object when text has nothing recognisable', () => {
    const c = extractContactFromText('lorem ipsum dolor sit amet');
    expect(c.email).toBeUndefined();
    expect(c.phone).toBeUndefined();
    expect(c.linkedin).toBeUndefined();
    expect(c.github).toBeUndefined();
  });

  it('strips https:// from linkedin / github / website', () => {
    const text = 'https://linkedin.com/in/jane  https://github.com/jane  https://jane.dev';
    const c = extractContactFromText(text);
    expect(c.linkedin?.startsWith('https://')).toBe(false);
    expect(c.github?.startsWith('https://')).toBe(false);
    expect(c.website?.startsWith('https://')).toBe(false);
  });

  it('picks the first email when multiple are present', () => {
    const c = extractContactFromText('alt@x.com — main work email: primary@acme.com');
    expect(c.email).toBe('alt@x.com');
  });
});
