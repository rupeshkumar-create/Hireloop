import { describe, expect, it } from 'vitest';
import {
  buildInternalLinks,
  contentHasRelatedSection,
  ensurePostLinkFields,
  extractInternalLinksFromMarkdown,
} from '../contentGrowth/linking.js';

const catalog = [
  {
    slug: 'post-a',
    title: 'How to Find Remote Jobs Faster',
    targetKeywords: ['remote jobs', 'job search'],
    clusterId: 'remote-job-search',
  },
  {
    slug: 'post-b',
    title: 'AI Job Matching Explained',
    targetKeywords: ['AI job matching', 'remote jobs'],
    clusterId: 'ai-job-matching',
  },
  {
    slug: 'post-c',
    title: 'Remote Salary Negotiation Guide',
    targetKeywords: ['salary negotiation', 'remote work'],
    clusterId: 'salary-negotiation',
  },
];

describe('internal linking', () => {
  it('builds links for a post with no existing links', () => {
    const links = buildInternalLinks(
      {
        slug: 'post-a',
        title: 'How to Find Remote Jobs Faster',
        targetKeywords: ['remote jobs'],
        clusterId: 'remote-job-search',
      },
      catalog
    );
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.slug !== 'post-a')).toBe(true);
  });

  it('extracts links from markdown related section', () => {
    const content = [
      'Body text',
      '',
      '## Related Hiring Guides',
      '',
      '- [AI Job Matching Explained](/blog/post-b)',
      '- [Salary Guide](/blog/post-c)',
    ].join('\n');
    const links = extractInternalLinksFromMarkdown(content);
    expect(links).toHaveLength(2);
    expect(links[0].slug).toBe('post-b');
  });

  it('injects related section when missing', () => {
    const enriched = ensurePostLinkFields(
      {
        slug: 'post-a',
        title: 'How to Find Remote Jobs Faster',
        content: 'Some article body.\n\n### FAQ\n\n**Q:** Test?\n**A:** Yes.',
        targetKeywords: ['remote jobs'],
        clusterId: 'remote-job-search',
      } as never,
      catalog
    );
    expect(contentHasRelatedSection(enriched.content)).toBe(true);
    expect(enriched.internalLinks?.length).toBeGreaterThan(0);
  });
});
