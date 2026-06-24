import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOME_META_DESCRIPTION, HOME_PAGE_TITLE } from '../homepageSeo';

describe('homepage SEO', () => {
  it('exports target keyword in title and description', () => {
    expect(HOME_PAGE_TITLE.toLowerCase()).toContain('job matching');
    expect(HOME_META_DESCRIPTION.toLowerCase()).toContain('job matching');
  });

  it('index.html includes crawlable static body copy', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('<h1>');
    expect(html.toLowerCase()).toContain('job matching');
    expect(html.toLowerCase()).toContain('scout');
    expect(html).toContain('href="/blog"');
    expect(html).toContain('send_page_view: false');
    expect(html).toContain('googletagmanager.com/gtag/js?id=G-M99635SH9J');
  });
});
