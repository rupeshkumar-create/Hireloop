import { Link } from 'react-router-dom';
import { SeoHead } from '../components/seo/SeoHead';
import { HireloopLogo } from '../components/brand/HireloopLogo';
import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  HOME_KEYWORDS,
} from '../lib/siteSeo';
import '../styles/blogLanding.css';

const JOB_SEARCH_FAQ = [
  {
    question: 'What is the best way to find jobs in 2026?',
    answer:
      'The most effective approach combines targeted channels (company career pages, referrals, and LinkedIn) with AI job matching that filters listings to your resume and career path. Hireloop automates this by scouting live listings daily, scoring each job against your profile, and delivering only high-fit matches.',
  },
  {
    question: 'How does Hireloop job search work?',
    answer:
      'Upload your resume or LinkedIn URL and set your target career paths. Hireloop runs a nightly AI pipeline: it discovers live listings, applies career-path filters, scores jobs with AI against your skills, and delivers up to 10 curated matches daily. Pro adds connect with hiring managers, Scout Chat, resume tailoring, and interview prep ($19/mo).',
  },
  {
    question: 'Is Hireloop better than LinkedIn or Indeed?',
    answer:
      'LinkedIn and Indeed show the same listings to every user. Hireloop is built for personalized job matching — it rejects irrelevant roles, aligns matches to your career path, and helps you connect with hiring managers instead of spraying applications.',
  },
  {
    question: 'What types of jobs does Hireloop match?',
    answer:
      'Hireloop matches knowledge-worker roles: software engineering, product management, design, data, marketing, sales, customer success, and related careers. Matches are filtered by your chosen career paths and seniority level.',
  },
  {
    question: 'Are there free job alerts on Hireloop?',
    answer:
      'Yes. Hireloop Free includes 10 AI-scored job matches every day. Pro ($19/mo or $180/yr) unlocks connect with recruiters, Scout Chat, tailored resumes, cover letters, and interview prep on saved roles.',
  },
];

const GEO_GUIDES = [
  { slug: '2026-06-10-remote-jobs-united-states', label: 'Jobs in the United States' },
  { slug: '2026-06-10-remote-jobs-united-kingdom', label: 'Jobs in the United Kingdom' },
  { slug: '2026-06-10-remote-jobs-germany', label: 'Jobs in Germany' },
  { slug: '2026-06-10-remote-jobs-canada', label: 'Jobs in Canada' },
  { slug: '2026-06-10-remote-jobs-ireland', label: 'Jobs in Ireland (EU)' },
];

const ROLE_GUIDES = [
  { slug: '2026-06-10-remote-software-engineer-jobs', label: 'Software engineer jobs' },
  { slug: '2026-06-10-remote-product-manager-jobs', label: 'Product manager jobs' },
];

/** @deprecated Use JobSearchPage — kept for imports */
export function RemoteJobsPage() {
  return <JobSearchPage />;
}

export function JobSearchPage() {
  return (
    <div className="blog-lp-root">
      <SeoHead
        title="AI Job Search (2026) — Matched Roles & Scout | Hireloop"
        description="Find jobs matched to your resume. Hireloop scouts live listings daily, scores each role against your career path, and delivers personalized job alerts with connect and Scout Chat."
        canonicalUrl={`${SITE_URL}/job-search`}
        ogType="website"
        ogImage={DEFAULT_OG_IMAGE}
        keywords={[...HOME_KEYWORDS]}
        schema={{
          faqPage: buildFaqPageSchema(JOB_SEARCH_FAQ),
          breadcrumb: buildBreadcrumbSchema([
            { name: 'Home', url: `${SITE_URL}/` },
            { name: 'Job search', url: `${SITE_URL}/job-search` },
          ]),
        }}
      />

      <header className="blog-lp-nav">
        <div className="blog-lp-nav-inner">
          <Link to="/" className="blog-lp-wordmark">
            <HireloopLogo height={26} />
          </Link>
          <div className="blog-lp-nav-actions">
            <Link to="/blog" className="blog-lp-nav-link">Hiring Guides</Link>
            <Link to="/login" className="blog-lp-btn-p">Get started</Link>
          </div>
        </div>
      </header>

      <main className="blog-lp-container">
        <p className="blog-lp-eyebrow">Job search · USA &amp; Europe · 2026</p>
        <h1 className="blog-lp-display blog-lp-title-xl" style={{ marginBottom: 16 }}>
          Find jobs matched to your resume — not another job board scroll
        </h1>
        <p className="blog-lp-lede" style={{ color: 'var(--lp-fg)' }}>
          <strong>Hireloop</strong> is an AI job matching platform and career copilot.
          Scout pulls live listings daily, scores each role against your resume and career path, and delivers personalized
          job alerts — so you apply to fewer, better-fit roles and connect with hiring managers when it matters.
        </p>
        <Link to="/login" className="blog-lp-btn-p" style={{ marginTop: 24, display: 'inline-flex' }}>
          Get daily job matches
        </Link>

        <h2 className="blog-h2" style={{ marginTop: 48 }}>Why generic job searches fail</h2>
        <p className="blog-p">
          Most job boards show the same listings to everyone. Keyword search surfaces irrelevant roles —
          wrong seniority, wrong function, and listings that match buzzwords but not your actual career path.
          Effective job search requires filtering by fit, not volume.
        </p>

        <h2 className="blog-h2">How Scout job search works</h2>
        <ol className="blog-ol">
          <li className="blog-li"><strong>Resume or LinkedIn</strong> — skills, seniority, and career signals extracted automatically.</li>
          <li className="blog-li"><strong>Set career paths</strong> — target roles like Senior Frontend Engineer or Product Manager.</li>
          <li className="blog-li"><strong>Daily AI scouting</strong> — live listings from ATS feeds and the open web.</li>
          <li className="blog-li"><strong>Career-path filtering</strong> — irrelevant functions removed before you see them.</li>
          <li className="blog-li"><strong>AI scoring</strong> — only strong fits are delivered to your dashboard.</li>
          <li className="blog-li"><strong>Connect &amp; apply</strong> — reach hiring managers, chat with Scout, tailor resumes, and track your pipeline.</li>
        </ol>

        <h2 className="blog-h2">Hireloop vs job boards</h2>
        <div className="blog-table-wrap">
          <table className="blog-table">
            <thead className="blog-thead">
              <tr className="blog-tr">
                <th className="blog-th">Approach</th>
                <th className="blog-th">Best for</th>
                <th className="blog-th">Limitation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="blog-tr">
                <td className="blog-td">LinkedIn / Indeed</td>
                <td className="blog-td">Browsing volume</td>
                <td className="blog-td">Same listings for everyone; heavy noise</td>
              </tr>
              <tr className="blog-tr">
                <td className="blog-td">Niche job boards</td>
                <td className="blog-td">Category-specific listings</td>
                <td className="blog-td">No personalization to your resume</td>
              </tr>
              <tr className="blog-tr">
                <td className="blog-td"><strong>Hireloop</strong></td>
                <td className="blog-td">AI-matched daily alerts + connect</td>
                <td className="blog-td">Curated fit, not infinite scroll</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="blog-h2">Explore job search guides</h2>
        <ul className="blog-ul">
          {GEO_GUIDES.map((g) => (
            <li key={g.slug} className="blog-li">
              <Link to={`/blog/${g.slug}`} className="blog-link">{g.label}</Link>
            </li>
          ))}
          {ROLE_GUIDES.map((g) => (
            <li key={g.slug} className="blog-li">
              <Link to={`/blog/${g.slug}`} className="blog-link">{g.label}</Link>
            </li>
          ))}
        </ul>

        <h2 className="blog-h2">Frequently asked questions</h2>
        <dl>
          {JOB_SEARCH_FAQ.map((faq) => (
            <div key={faq.question} style={{ marginBottom: 20 }}>
              <dt className="blog-h3" style={{ marginTop: 0 }}>{faq.question}</dt>
              <dd className="blog-p" style={{ margin: '6px 0 0' }}>{faq.answer}</dd>
            </div>
          ))}
        </dl>

        <Link to="/login" className="blog-lp-btn-p" style={{ marginTop: 32, display: 'inline-flex' }}>
          Start matching jobs
        </Link>
      </main>
    </div>
  );
}
