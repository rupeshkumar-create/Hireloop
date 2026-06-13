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

  it('does not promote label lines like Cost or Best for to headings', () => {
    const content = [
      '6. Scale.jobs — Best Built-In Application Tools',
      '',
      'Cost: Free tools + $4/hour application service',
      'Volume: 1,000+ new jobs per month',
      'Best for: Job seekers who want resume checking',
      '',
      'Scale.jobs combines a job board with built-in tools.',
    ].join('\n');

    const result = inferMarkdownHeadings(content);

    expect(result).toContain('### 6. Scale.jobs — Best Built-In Application Tools');
    expect(result).toContain('**Cost:** Free tools + $4/hour application service');
    expect(result).toContain('**Volume:** 1,000+ new jobs per month');
    expect(result).toContain('**Best for:** Job seekers who want resume checking');
    expect(result).not.toMatch(/^##\s+Cost/m);
    expect(result).not.toMatch(/^##\s+Volume/m);
    expect(result).not.toMatch(/^##\s+Best for/m);
  });

  it('repairs legacy ## Cost headings saved by old reformat', () => {
    const content = '## Cost: Free tools\n\n## Volume: 1,000 jobs\n\nBody paragraph.';
    const result = prepareBlogBodyContent(content, { title: 'Test' });
    expect(result).toContain('**Cost:** Free tools');
    expect(result).not.toMatch(/^##\s+Cost/m);
  });

  it('keeps numbered tips as list items, not h3 headings', () => {
    const content = [
      'Seven Ways to Get Better Results From AI Job Matching',
      '',
      "These tactics work on any well-built matching platform, and they're especially effective with systems that show you component scores.",
      '',
      '1. **List specific tools, not categories.** "React, Next.js, TypeScript" beats "frontend technologies." Semantic matching handles synonyms, but specificity sharpens the score.',
      '',
      '2. **Set a salary floor.** Even if you\'re flexible, a floor removes the bottom 30% of listings that would waste your time and dilute your results.',
    ].join('\n');

    const result = prepareBlogBodyContent(content, { title: 'Test' });

    expect(result).toContain('## Seven Ways to Get Better Results From AI Job Matching');
    expect(result).toContain('1. **List specific tools, not categories.**');
    expect(result).not.toMatch(/^###\s+1\./m);
    expect(result).not.toMatch(/^###\s+2\./m);
  });

  it('repairs legacy ### numbered tips saved by old reformat', () => {
    const content = [
      '## Section',
      '',
      '### 1. **List specific tools, not categories.** "React, Next.js, TypeScript" beats "frontend technologies."',
      '',
      '### 2. **Set a salary floor.** Even if you\'re flexible, a floor removes the bottom 30% of listings.',
    ].join('\n');

    const result = prepareBlogBodyContent(content, { title: 'Test' });

    expect(result).not.toMatch(/^###\s+1\./m);
    expect(result).toContain('1. **List specific tools, not categories.**');
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
