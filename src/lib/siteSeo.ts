/** Shared SEO / GEO constants and JSON-LD builders for HireSchema. */

export const SITE_URL = 'https://hireschema.com';
export const SITE_NAME = 'HireSchema';
export const SITE_STATUS = 'Free: 10 daily AI-scored job matches. Pro: AI application tools from $19/mo.';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
export const DEFAULT_OG_IMAGE_ALT = 'HireSchema — AI remote job matching and daily job alerts';

export const HOME_KEYWORDS = [
  'remote jobs USA',
  'remote jobs Europe',
  'remote jobs United States',
  'remote jobs UK',
  'find remote jobs',
  'remote job search',
  'AI job matching',
  'remote work',
  'work from home jobs USA',
  'remote job alerts',
  'personalized job matches',
  'remote software engineer jobs US',
  'remote job board alternative',
];

export const HOME_FAQ: { question: string; answer: string }[] = [
  {
    question: 'What is HireSchema?',
    answer:
      'HireSchema is an AI-powered remote job matching platform. It scouts live job listings daily, scores each role against your resume and career path, and delivers personalized remote job alerts — plus AI tools to tailor resumes, write outreach emails, and prepare for interviews.',
  },
  {
    question: 'How do I find remote jobs with HireSchema?',
    answer:
      'Upload your resume, set your career paths and preferences, and HireSchema runs a daily AI pipeline to discover remote roles, filter irrelevant listings, and surface high-fit matches. Free includes 10 curated matches per day; Pro adds AI resume tailoring, cold emails, cover letters, and interview prep.',
  },
  {
    question: 'What does HireSchema Pro cost?',
    answer:
      'Pro is $19 per month or $180 per year (billed annually). Free includes the same 10 daily AI-scored job matches — Pro unlocks AI application tools on saved roles.',
  },
  {
    question: 'Is HireSchema only for remote jobs?',
    answer:
      'Yes. HireSchema focuses exclusively on remote and work-from-home roles for knowledge workers — software engineers, product managers, designers, marketers, and similar careers worldwide.',
  },
  {
    question: 'How is HireSchema different from job boards like LinkedIn or Indeed?',
    answer:
      'Traditional job boards show the same listings to everyone. HireSchema matches jobs to your specific resume, skills, seniority, and career path using AI scoring — so you spend time on roles you can actually land, not keyword spam.',
  },
  {
    question: 'Does HireSchema work for remote jobs in the US and Europe?',
    answer:
      'Yes. HireSchema is optimized for US and European remote hiring: daily matches prioritize US, UK, and EU-remote listings, with salary bands and guides for North America and Europe at hireschema.com/blog.',
  },
  {
    question: 'Which regions does HireSchema focus on?',
    answer:
      'HireSchema targets remote knowledge workers hiring in the United States, United Kingdom, Canada, and Europe (EU/EMEA). Scout discovery and ranking boost US/EU-remote roles; you can adjust target markets in Settings.',
  },
];

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon-48.png`,
    description:
      'AI-powered remote job matching platform with daily personalized job alerts, resume tailoring, and interview prep.',
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
      'Find remote jobs matched to your resume with AI. Daily personalized remote job alerts for software engineers, PMs, designers, and more.',
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
      description: 'Free: 10 curated remote job matches per day. Pro: $19/mo or $180/yr for AI application tools.',
    },
    description:
      'AI remote job matching platform that delivers daily personalized job alerts based on your resume, career path, and preferences.',
    featureList: [
      'Daily AI-scored remote job matches',
      'Resume tailoring per job',
      'Cold email generation',
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
