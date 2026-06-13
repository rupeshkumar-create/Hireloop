import { describe, expect, it } from 'vitest';
import { generateCoverSvg } from '../coverImage';

describe('generateCoverSvg', () => {
  it('uses larger title typography for short titles', () => {
    const svg = generateCoverSvg('Remote Job Search Tips', 'remote-job-search');
    expect(svg).toContain('font-size="68"');
    expect(svg).toContain('font-size="18"');
  });

  it('scales down typography for long multi-line titles', () => {
    const svg = generateCoverSvg(
      'How AI Remote Job Matching Actually Works (And How to Use It to Your Advantage)',
      'ai-job-matching'
    );
    expect(svg).toContain('font-size="48"');
    expect(svg).toMatch(/font-size="(42|48|56|68)"/);
  });
});
