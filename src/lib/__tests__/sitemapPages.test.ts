import { describe, expect, it } from 'vitest';
import { SITEMAP_STATIC_PAGES } from '../sitemapPages';

describe('sitemapPages', () => {
  it('excludes login and llms files from static sitemap entries', () => {
    const locs = SITEMAP_STATIC_PAGES.map((p) => p.loc);
    expect(locs).not.toContain('/login');
    expect(locs).not.toContain('/llms.txt');
    expect(locs).not.toContain('/llms-full.txt');
    expect(locs).toContain('/');
    expect(locs).toContain('/blog');
    expect(locs).toContain('/remote-jobs');
  });
});
