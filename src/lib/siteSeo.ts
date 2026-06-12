/** Shared SEO / GEO constants and JSON-LD builders for HireSchema. */

export const SITE_URL = 'https://hireschema.com';
export const SITE_NAME = 'HireSchema';
export const SITE_STATUS = 'Public beta — free access while we refine the product';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
export const DEFAULT_OG_IMAGE_ALT = 'HireSchema — AI remote job matching and daily job alerts';

export const HOME_KEYWORDS = [
  'remote jobs',
  'find remote jobs',
  'remote job search',
  'AI job matching',
  'remote work',
  'work from home jobs',
  'remote job alerts',
  'personalized job matches',
  'remote software engineer jobs',
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
      'Upload your resume, set your career paths and preferences, and HireSchema runs a daily AI pipeline to discover remote roles, filter irrelevant listings, and surface high-fit matches. HireSchema is in public beta with free access while we refine the product.',
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
    question: 'Does HireSchema work for remote jobs in India?',
    answer:
      'Yes. HireSchema supports remote job seekers globally, including India. The blog includes dedicated guides for remote hiring in India and role-specific remote job search playbooks at hireschema.com/blog.',
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
      description: 'Free tier: 1 curated remote job match per day. Pro tier: up to 10 matches per day.',
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
