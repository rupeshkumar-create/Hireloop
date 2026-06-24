import { useEffect } from 'react';

interface SeoHeadProps {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: string;
  /** When true, adds robots noindex,nofollow (login, app-only pages). */
  noIndex?: boolean;
  schema?: {
    article?: Record<string, unknown>;
    faqPage?: Record<string, unknown>;
    breadcrumb?: Record<string, unknown>;
    organization?: Record<string, unknown>;
    website?: Record<string, unknown>;
    softwareApplication?: Record<string, unknown>;
  };
  keywords?: string[];
  ogImage?: string;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

const EXTRA_SCHEMA_KEYS = [
  'schema-organization',
  'schema-website',
  'schema-software',
] as const;

export function SeoHead({
  title,
  description,
  canonicalUrl,
  ogType = 'article',
  noIndex = false,
  schema,
  keywords,
  ogImage,
}: SeoHeadProps) {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    if (keywords?.length) upsertMeta('name', 'keywords', keywords.join(', '));
    upsertLink('canonical', canonicalUrl);

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:site_name', 'Hireloop');
    if (ogImage) {
      upsertMeta('property', 'og:image', ogImage);
      upsertMeta('name', 'twitter:image', ogImage);
    }

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    if (schema?.article) upsertJsonLd('schema-article', schema.article);
    else removeJsonLd('schema-article');

    if (schema?.faqPage) upsertJsonLd('schema-faq', schema.faqPage);
    else removeJsonLd('schema-faq');

    if (schema?.breadcrumb) upsertJsonLd('schema-breadcrumb', schema.breadcrumb);
    else removeJsonLd('schema-breadcrumb');

    if (schema?.organization) upsertJsonLd('schema-organization', schema.organization);
    else removeJsonLd('schema-organization');

    if (schema?.website) upsertJsonLd('schema-website', schema.website);
    else removeJsonLd('schema-website');

    if (schema?.softwareApplication) upsertJsonLd('schema-software', schema.softwareApplication);
    else removeJsonLd('schema-software');

    return () => {
      removeJsonLd('schema-article');
      removeJsonLd('schema-faq');
      removeJsonLd('schema-breadcrumb');
      for (const id of EXTRA_SCHEMA_KEYS) removeJsonLd(id);
    };
  }, [title, description, canonicalUrl, ogType, noIndex, schema, keywords, ogImage]);

  return null;
}
