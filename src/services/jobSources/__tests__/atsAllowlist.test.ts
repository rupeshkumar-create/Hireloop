import { describe, expect, it } from 'vitest';
import { extractGreenhouseToken, extractLeverToken } from '../atsAllowlist';

describe('atsAllowlist token parsing', () => {
  it('extracts greenhouse token', () => {
    expect(extractGreenhouseToken('https://boards.greenhouse.io/stripe')).toBe('stripe');
    expect(extractGreenhouseToken('https://boards.greenhouse.io/stripe/')).toBe('stripe');
  });

  it('rejects non-greenhouse urls', () => {
    expect(extractGreenhouseToken('https://example.com/stripe')).toBeNull();
  });

  it('extracts lever token', () => {
    expect(extractLeverToken('https://jobs.lever.co/notion')).toBe('notion');
    expect(extractLeverToken('https://jobs.lever.co/notion/')).toBe('notion');
  });

  it('rejects non-lever urls', () => {
    expect(extractLeverToken('https://example.com/notion')).toBeNull();
  });
});

