/**
 * Static HTML for blog posts — crawlers receive full content in initial HTML.
 */
import { marked } from 'marked';
import type { BlogPost } from '../../src/server/marketingEngine.js';
import { SITE_URL, DEFAULT_OG_IMAGE } from '../../src/lib/siteSeo.js';
import { gtagHeadSnippet } from '../../src/lib/analytics.js';

const PRERENDER_CSS = `
:root { --fg:#1a1a1a; --muted:#555; --accent:#c45a2a; --bg:#faf8f5; --border:#e8e4df; }
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.65; color: var(--fg); background: var(--bg); margin: 0; }
main { max-width: 720px; margin: 0 auto; padding: 32px 24px 80px; }
nav { border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; gap: 16px; flex-wrap: wrap; }
nav a { color: var(--fg); text-decoration: none; font-weight: 600; font-size: 14px; }
h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); line-height: 1.15; margin: 0 0 1rem; letter-spacing: -0.02em; }
h2 { font-size: 1.35rem; margin: 2rem 0 0.75rem; color: var(--fg); }
h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
p, li { color: var(--muted); font-size: 1.02rem; }
.lead { font-size: 1.12rem; color: var(--fg); margin-bottom: 1.5rem; }
a { color: var(--accent); }
.meta { font-size: 0.9rem; color: var(--muted); margin-bottom: 1.5rem; }
.cta { display: inline-block; margin: 1.5rem 0; padding: 12px 24px; background: var(--accent); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
article img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }
article table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.95rem; }
article th, article td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; }
article th { background: #fff; color: var(--fg); }
article ul, article ol { padding-left: 1.25rem; }
.faq dt { font-weight: 600; color: var(--fg); margin-top: 1rem; }
.faq dd { margin: 0.25rem 0 0; color: var(--muted); }
footer { border-top: 1px solid var(--border); margin-top: 2.5rem; padding-top: 1.25rem; font-size: 0.9rem; color: var(--muted); }
`.trim();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonLdScript(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

export function buildBlogPostHtml(post: BlogPost): string {
  const canonical = post.canonicalSlug
    ? `${SITE_URL}/blog/${post.canonicalSlug}`
    : `${SITE_URL}/blog/${post.slug}`;
  const title = post.seoTitle || post.title;
  const ogImage = post.coverImageUrl || `${SITE_URL}/api/blog/cover?slug=${encodeURIComponent(post.slug)}`;
  const bodyHtml = marked.parse(post.content, { async: false }) as string;
  const faqHtml =
    post.faq && post.faq.length > 0
      ? `<h2>Frequently asked questions</h2><dl class="faq">${post.faq
          .map(
            (f) =>
              `<dt>${escapeHtml(f.question)}</dt><dd>${escapeHtml(f.answer)}</dd>`
          )
          .join('')}</dl>`
      : '';

  const schemaBlocks = [
    jsonLdScript(post.schema?.article as Record<string, unknown> | undefined),
    jsonLdScript(post.schema?.faqPage as Record<string, unknown> | undefined),
    jsonLdScript(post.schema?.breadcrumb as Record<string, unknown> | undefined),
  ].join('\n  ');

  const published = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} | HireSchema</title>
  <meta name="description" content="${escapeHtml(post.seoDescription)}" />
  ${post.targetKeywords?.length ? `<meta name="keywords" content="${escapeHtml(post.targetKeywords.join(', '))}" />` : ''}
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(post.seoDescription)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="HireSchema" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(post.seoDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  ${schemaBlocks}
  ${gtagHeadSnippet()}
  <style>${PRERENDER_CSS}</style>
</head>
<body>
  <nav>
    <a href="${SITE_URL}/">HireSchema</a>
    <a href="${SITE_URL}/blog">Hiring Guides</a>
    <a href="${SITE_URL}/remote-jobs">Remote Jobs</a>
    <a href="${SITE_URL}/login">Sign in</a>
  </nav>
  <main>
    <article>
      <p class="meta">${escapeHtml(post.category)} · ${published} · ${post.readTimeMinutes} min read</p>
      <h1>${escapeHtml(post.title)}</h1>
      ${post.directAnswer ? `<p class="lead">${escapeHtml(post.directAnswer)}</p>` : ''}
      <p><a class="cta" href="${SITE_URL}/login">Get daily remote job matches →</a></p>
      ${bodyHtml}
      ${faqHtml}
      <p><a class="cta" href="${SITE_URL}/login">Try HireSchema free →</a></p>
    </article>
    <footer>
      <p>© HireSchema · <a href="${SITE_URL}/">Home</a> · <a href="${SITE_URL}/blog">All guides</a> · <a href="${SITE_URL}/remote-jobs">Remote jobs</a></p>
    </footer>
  </main>
</body>
</html>`;
}

export function buildBlogIndexHtml(
  posts: { slug: string; title: string; category: string; publishedAt: string }[]
): string {
  const canonical = `${SITE_URL}/blog`;
  const grouped = posts.slice(0, 60);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hiring Guides & Remote Job Insights | HireSchema</title>
  <meta name="description" content="Practical guides for remote job seekers — search strategies, resume tips, salary data, and interview prep. Updated weekly." />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="Hiring Guides & Remote Job Insights | HireSchema" />
  <meta property="og:description" content="Practical remote job search guides updated weekly." />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="HireSchema" />
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
  ${gtagHeadSnippet()}
  <style>${PRERENDER_CSS} ul.guides { list-style: none; padding: 0; } ul.guides li { margin: 0.75rem 0; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }</style>
</head>
<body>
  <nav>
    <a href="${SITE_URL}/">HireSchema</a>
    <a href="${SITE_URL}/remote-jobs">Remote Jobs</a>
    <a href="${SITE_URL}/login">Sign in</a>
  </nav>
  <main>
    <h1>Remote job search, salary data &amp; career tips</h1>
    <p class="lead">Actionable hiring guides for remote job seekers — updated weekly.</p>
    <ul class="guides">
      ${grouped
        .map(
          (p) =>
            `<li><a href="${SITE_URL}/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a> <span class="meta">(${escapeHtml(p.category)})</span></li>`
        )
        .join('\n      ')}
    </ul>
    <p class="meta">${posts.length} guides available.</p>
    <p><a class="cta" href="${SITE_URL}/login">Get AI-matched remote jobs →</a></p>
  </main>
</body>
</html>`;
}
