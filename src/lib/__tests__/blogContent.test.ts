import { describe, expect, it } from 'vitest';
import { inferMarkdownHeadings, prepareBlogBodyContent, stripDuplicateTitle } from '../blogContent.js';

describe('blogContent', () => {
  it('strips duplicate title from markdown', () => {
    const content = '# How to Find Remote Jobs\n\nBody text here.';
    expect(stripDuplicateTitle(content, 'How to Find Remote Jobs')).toBe('Body text here.');
  });

  it('converts plain section lines to h2 headings', () => {
    const content = 'Intro paragraph that is long enough to not be a heading on its own.\n\nThe Matching Pipeline\n\nThis section explains how matching works in detail with enough words to qualify as a paragraph.';
    const result = inferMarkdownHeadings(content);
    expect(result).toContain('## The Matching Pipeline');
  });

  it('strips structured sections when rendered separately', () => {
    const content = [
      'Opening paragraph.',
      '',
      '## Key Definitions',
      '',
      '**ATS:** Applicant tracking system.',
      '',
      '## Main Section',
      '',
      'More body copy.',
    ].join('\n');

    const result = prepareBlogBodyContent(content, {
      title: 'Test',
      stripStructuredSections: true,
      stripFaq: false,
    });

    expect(result).not.toContain('Key Definitions');
    expect(result).toContain('Main Section');
  });
});
