import { describe, expect, it } from 'vitest';
import {
  BLOG_TARGET_WORD_COUNT,
  countWords,
  meetsMinimumWordCount,
  wordsNeeded,
} from '../contentGrowth/wordCount';
import { runQualityGate } from '../contentGrowth/qualityGate';

describe('wordCount', () => {
  it('uses 2000 as the blog minimum', () => {
    expect(BLOG_TARGET_WORD_COUNT).toBe(2000);
  });

  it('counts words correctly', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('  spaced   words  ')).toBe(2);
  });

  it('detects when content meets the minimum', () => {
    const short = Array(900).fill('word').join(' ');
    const long = Array(2000).fill('word').join(' ');
    expect(meetsMinimumWordCount(short)).toBe(false);
    expect(meetsMinimumWordCount(long)).toBe(true);
    expect(wordsNeeded(short)).toBe(1100);
  });
});

describe('qualityGate word count', () => {
  it('blocks posts under 2000 words', () => {
    const content = `# Title\n\n${Array(1500).fill('word').join(' ')}\n\n### FAQ\n\n**Q:** Q1?\n**A:** A1.\n**Q:** Q2?\n**A:** A2.\n**Q:** Q3?\n**A:** A3.`;
    const result = runQualityGate(
      {
        content,
        directAnswer: 'A direct answer that is long enough for the quality gate check.',
        faq: [
          { question: 'Q1', answer: 'A1' },
          { question: 'Q2', answer: 'A2' },
          { question: 'Q3', answer: 'A3' },
        ],
      },
      { passed: true, score: 100, issues: [] }
    );

    expect(result.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes('2000'))).toBe(true);
  });
});
