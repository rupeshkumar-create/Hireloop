import { describe, expect, it } from 'vitest';
import { reformatBlogPostContent } from '../blogContent.js';

describe('reformatBlogPostContent', () => {
  it('adds markdown headings and updates read time', () => {
    const updated = reformatBlogPostContent({
      slug: 'test-post',
      title: 'How AI Job Matching Works',
      excerpt: 'Short excerpt',
      content: [
        '# How AI Job Matching Works',
        '',
        'AI job matching helps you find roles faster when you know how the pipeline works.',
        '',
        'The Matching Pipeline',
        '',
        'Recruiters and platforms score your profile against open roles using skills, title, and location signals.',
      ].join('\n'),
      faq: [],
    });

    expect(updated.content).toContain('## The Matching Pipeline');
    expect(updated.content).not.toMatch(/^#\s+How AI Job Matching Works/m);
    expect(updated.readTimeMinutes).toBeGreaterThan(0);
    expect(updated.refreshedAt).toBeTruthy();
  });
});
