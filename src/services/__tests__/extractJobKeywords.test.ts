// extractJobKeywords pulls the most ATS-significant terms from a job
// description and hands them to the resume-tailoring prompt. These tests
// pin its behaviour so the tailored-resume keyword injection stays
// deterministic.

import { describe, expect, it } from 'vitest';
import { extractJobKeywords } from '../aiService';

describe('extractJobKeywords', () => {
  it('returns frequent meaningful terms', () => {
    const jd = `We are looking for a Senior Backend Engineer who can build
      services in TypeScript and Postgres. TypeScript is a must. Postgres
      experience preferred. Familiar with AWS and Docker.`;
    const keywords = extractJobKeywords(jd, 10);
    expect(keywords).toContain('typescript');
    expect(keywords).toContain('postgres');
  });

  it('drops English stopwords + resume boilerplate', () => {
    const jd = 'We are looking for a strong candidate who has experience with great teams.';
    const keywords = extractJobKeywords(jd, 10);
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('and');
    expect(keywords).not.toContain('looking');
    expect(keywords).not.toContain('strong');
    expect(keywords).not.toContain('experience');
    expect(keywords).not.toContain('candidate');
  });

  it('boosts proper nouns (Capitalised in original)', () => {
    const jd = 'Use Stripe and Twilio. Also some generic words like build and ship.';
    const keywords = extractJobKeywords(jd, 5);
    // Stripe and Twilio should outrank generic verbs even though they appear
    // only once each, thanks to the proper-noun boost.
    expect(keywords).toContain('stripe');
    expect(keywords).toContain('twilio');
  });

  it('caps output at the requested max', () => {
    const jd = 'react redux typescript node express postgres redis kafka graphql vite'.repeat(10);
    expect(extractJobKeywords(jd, 5).length).toBeLessThanOrEqual(5);
  });

  it('returns empty array for empty / undefined input', () => {
    expect(extractJobKeywords('')).toEqual([]);
    expect(extractJobKeywords(undefined as unknown as string)).toEqual([]);
  });

  it('drops pure numbers', () => {
    const jd = 'Required: 5 years experience and 1000 lines of TypeScript.';
    const keywords = extractJobKeywords(jd, 10);
    expect(keywords).not.toContain('5');
    expect(keywords).not.toContain('1000');
  });
});
