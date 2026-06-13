import { describe, expect, it } from 'vitest';
import { generateCoverSvg } from '../coverImage';

describe('generateCoverSvg', () => {
  it('uses headline-scale typography for short titles', () => {
    const svg = generateCoverSvg('Remote Job Search Tips', 'remote-job-search');
    expect(svg).toMatch(/font-size="(84|96)"/);
  });

  it('fills the banner with large multi-line titles', () => {
    const svg = generateCoverSvg(
      'How AI Remote Job Matching Actually Works (And How to Use It to Your Advantage)',
      'ai-job-matching'
    );
    expect(svg).toContain('font-size="72"');
    expect(svg).toContain('How AI Remote Job Matching');
    expect(svg).toContain('fill-opacity="0.06"');
  });
});
