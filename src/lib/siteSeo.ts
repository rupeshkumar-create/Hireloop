/** Shared SEO / GEO constants and JSON-LD builders for HireSchema. */

import { BRAND_NAME, BRAND_SHORT_DESCRIPTION, BRAND_SITE_STATUS, HOME_KEYWORDS } from './brand';

export const SITE_URL = 'https://hireschema.com';
export const SITE_NAME = BRAND_NAME;
export const SITE_STATUS = BRAND_SITE_STATUS;

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
export const DEFAULT_OG_IMAGE_ALT = `${BRAND_NAME} — AI job matching and career copilot`;

export { HOME_KEYWORDS };

export const HOME_FAQ: { question: string; answer: string }[] = [
  {
    question: 'What is HireSchema?',
    answer:
      'HireSchema is an AI-powered job matching platform and career copilot. Scout discovers live listings daily, scores each role against your resume and career path, delivers personalized matches, and helps you connect with hiring managers — plus AI chat, resume tailoring, and interview prep.',
  },
  {
    question: 'How does HireSchema job search work?',
    answer:
      'Upload your resume or paste your LinkedIn URL, set your career paths and preferences, and Scout runs a daily AI pipeline to discover roles, filter irrelevant listings, and surface high-fit matches. Free includes 10 curated matches per day; Pro adds connect-with-recruiter outreach, tailored resumes, cover letters, and interview prep.',
  },
  {
    question: 'What does HireSchema Pro cost?',
    answer:
      'Pro is $19 per month or $180 per year (billed annually). Free includes the same 10 daily AI-scored job matches — Pro unlocks connect with hiring managers, AI application tools on saved roles, and Scout Chat.',
  },
  {
    question: 'Can I use LinkedIn instead of uploading a resume?',
    answer:
      'Yes. During onboarding you can paste your LinkedIn profile URL or upload a CV. Scout uses the same profile signals either way to score matches and power Scout Chat.',
  },
  {
    question: 'How is HireSchema different from job boards like LinkedIn or Indeed?',
    answer:
      'Traditional job boards show the same listings to everyone. HireSchema matches jobs to your specific resume, skills, seniority, and career path using AI scoring — then helps you connect with hiring managers instead of spraying cold applications.',
  },
  {
    question: 'Does HireSchema work in the US and Europe?',
    answer:
      'Yes. HireSchema is optimized for knowledge-worker hiring in the United States, United Kingdom, Canada, and Europe. Scout discovery and ranking respect your target markets and location preferences in Settings.',
  },
  {
    question: 'What is Scout Chat?',
    answer:
      'Scout Chat is HireSchema’s LLM career copilot — ask about today’s matches, interview strategy, resume tweaks, or your pipeline. It uses your profile context so answers stay grounded in your search.',
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
      email: 'support@hireschema.com',
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
      'Find jobs matched to your resume with AI. Daily personalized job alerts, recruiter connect, and Scout Chat for software engineers, PMs, designers, and more.',
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
      description: 'Free: 10 curated job matches per day. Pro: $19/mo or $180/yr for connect, AI application tools, and Scout Chat.',
    },
    description: BRAND_SHORT_DESCRIPTION,
    featureList: [
      'Daily AI-scored job matches',
      'Connect with hiring managers',
      'Scout Chat career copilot',
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
