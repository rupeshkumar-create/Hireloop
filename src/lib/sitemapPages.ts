/** URLs included in public/sitemap.xml — indexable marketing + blog content only. */
export const SITEMAP_STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' as const },
  { loc: '/job-search', priority: '0.95', changefreq: 'weekly' as const },
  { loc: '/blog', priority: '0.9', changefreq: 'weekly' as const },
  { loc: '/privacy', priority: '0.3', changefreq: 'yearly' as const },
  { loc: '/terms', priority: '0.3', changefreq: 'yearly' as const },
];

export const SITEMAP_BASE_URL = 'https://hireschema.com';
