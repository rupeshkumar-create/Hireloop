/** Shared SEO / GEO constants and JSON-LD builders for Hireloop. */

import { BRAND_NAME, BRAND_SHORT_DESCRIPTION, BRAND_SITE_STATUS, HOME_KEYWORDS, SUPPORT_EMAIL } from './brand';

function resolveSiteUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) {
    return String(import.meta.env.VITE_SITE_URL).replace(/\/$/, '');
  }
  if (typeof process !== 'undefined' && process.env?.VITE_SITE_URL) {
    return String(process.env.VITE_SITE_URL).replace(/\/$/, '');
  }
  if (typeof process !== 'undefined' && process.env?.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://hireloop-xi-swart.vercel.app';
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = BRAND_NAME;
export const SITE_STATUS = BRAND_SITE_STATUS;

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
export const DEFAULT_OG_IMAGE_ALT = `${BRAND_NAME} — AI job matching and career copilot`;

export { HOME_KEYWORDS };

export const HOME_FAQ: { question: string; answer: string }[] = [
  {
    question: 'What is Hireloop?',
    answer:
      'Hireloop is an AI career copilot. Jack scouts live job listings daily, scores each role against your resume, coaches interviews, and helps you apply — with Jill on the recruiter side for warm introductions.',
  },
  {
    question: 'How does Hireloop job search work?',
    answer:
      'Sign in with Google or LinkedIn, confirm your profile, and Scout runs a nightly pipeline to discover real listings, validate them, score fit with AI, and deliver matches in Jack chat and your dashboard.',
  },
  {
    question: 'Is Hireloop free?',
    answer:
      'Yes. Jack is free — daily matches, chat coaching, resume tailoring, and interview prep are included without a paywall.',
  },
  {
    question: 'Can I use LinkedIn instead of uploading a resume?',
    answer:
      'Yes. Sign in with LinkedIn or paste your profile URL during onboarding. Jack imports your background and asks you to confirm before searching.',
  },
  {
    question: 'How is Hireloop different from job boards?',
    answer:
      'Job boards show the same listings to everyone. Hireloop matches roles to your specific resume with AI scoring and guides you in chat — with warm recruiter intros instead of cold spam.',
  },
  {
    question: 'What is Jack?',
    answer:
      'Jack is Hireloop\'s candidate AI agent — a chat-first copilot for reviewing matches, mock interviews, salary coaching, and application prep.',
  },
  {
    question: 'What is Jill?',
    answer:
      'Jill is Hireloop\'s recruiter agent. Hiring teams post roles, review matched candidates, and request warm introductions that candidates approve in Jack first.',
  },
];

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon-48.png`,
    description: BRAND_SHORT_DESCRIPTION,
    sameAs: [`${SITE_URL}/blog`],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SUPPORT_EMAIL,
      telephone: '+91-79039-59739',
      availableLanguage: 'English',
    },
  };
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description:
      'AI job matching with Jack & Jill — daily personalized matches, warm recruiter intros, and chat-first career coaching.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free AI career copilot with daily matches and Jack chat.',
    },
    description: BRAND_SHORT_DESCRIPTION,
    featureList: [
      'Daily AI-scored job matches',
      'Jack chat career copilot',
      'Jill warm recruiter intros',
      'Resume or LinkedIn onboarding',
      'Resume tailoring per job',
      'Interview prep',
      'Application tracking dashboard',
    ],
  };
}

export function buildFaqPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
