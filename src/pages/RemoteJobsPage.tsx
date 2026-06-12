import { Link } from 'react-router-dom';
import { SeoHead } from '../components/seo/SeoHead';
import { HireschemaLogo } from '../components/brand/HireschemaLogo';
import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  buildBreadcrumbSchema,
  buildFaqPageSchema,
} from '../lib/siteSeo';
import '../styles/blogLanding.css';

const REMOTE_JOBS_FAQ = [
  {
    question: 'What is the best way to find remote jobs in 2026?',
    answer:
      'The most effective approach combines targeted channels (company career pages, curated remote boards, and referrals) with AI job matching that filters listings to your resume and career path. HireSchema automates this by scouting live remote listings daily, scoring each job against your profile, and delivering only high-fit matches.',
  },
  {
    question: 'How does HireSchema help you find remote jobs?',
    answer:
      'Upload your resume and set your target career paths. HireSchema runs a nightly AI pipeline: it discovers remote listings, applies career-path filters, scores jobs with AI against your skills, and delivers a curated daily shortlist. Free users get 1 match per day; Pro users get up to 10.',
  },
  {
    question: 'Is HireSchema better than LinkedIn or Indeed for remote jobs?',
    answer:
      'LinkedIn and Indeed show the same listings to every user. HireSchema is built for personalized remote job matching — it rejects irrelevant roles, aligns matches to your career path, and includes AI resume tailoring and interview prep for each saved job.',
  },
  {
    question: 'What types of remote jobs does HireSchema match?',
    answer:
      'HireSchema matches knowledge-worker remote roles: software engineering, product management, design, data, marketing, sales, customer success, and related careers. Matches are filtered by your chosen career paths and seniority level.',
  },
  {
    question: 'Are there free remote job alerts on HireSchema?',
    answer:
      'Yes. HireSchema offers a free plan with one AI-scored remote job match delivered daily. The Pro plan includes up to ten curated matches per day plus resume tailoring, cold email generation, and interview prep tools.',
  },
];

const GEO_GUIDES = [
  { slug: '2026-06-10-remote-jobs-india', label: 'Remote jobs in India' },
  { slug: '2026-06-10-remote-jobs-united-states', label: 'Remote jobs in the United States' },
  { slug: '2026-06-10-remote-jobs-united-kingdom', label: 'Remote jobs in the United Kingdom' },
];

const ROLE_GUIDES = [
  { slug: '2026-06-10-remote-software-engineer-jobs', label: 'Remote software engineer jobs' },
  { slug: '2026-06-10-remote-product-manager-jobs', label: 'Remote product manager jobs' },
];

export function RemoteJobsPage() {
  return (
    <div className="blog-lp-root">
      <SeoHead
        title="Remote Jobs (2026) — Find AI-Matched Remote Work | HireSchema"
        description="Find remote jobs matched to your resume. HireSchema scouts live listings daily, scores each role against your career path with AI, and delivers personalized remote job alerts."
        canonicalUrl={`${SITE_URL}/remote-jobs`}
        ogType="website"
        ogImage={DEFAULT_OG_IMAGE}
        keywords={[
          'remote jobs',
          'find remote jobs',
          'remote job search',
          'work from home jobs',
          'AI job matching',
          'remote job alerts',
        ]}
        schema={{
          faqPage: buildFaqPageSchema(REMOTE_JOBS_FAQ),
          breadcrumb: buildBreadcrumbSchema([
            { name: 'Home', url: `${SITE_URL}/` },
            { name: 'Remote Jobs', url: `${SITE_URL}/remote-jobs` },
          ]),
        }}
      />

      <header className="blog-lp-nav">
        <div className="blog-lp-nav-inner">
          <Link to="/" className="blog-lp-wordmark">
            <HireschemaLogo height={26} />
          </Link>
          <div className="blog-lp-nav-actions">
            <Link to="/blog" className="blog-lp-nav-link">Hiring Guides</Link>
            <Link to="/login" className="blog-lp-btn-p">Get started</Link>
          </div>
        </div>
      </header>

      <main className="blog-lp-container">
        <p className="blog-lp-eyebrow">Remote Jobs · 2026</p>
        <h1 className="blog-lp-display blog-lp-title-xl" style={{ marginBottom: 16 }}>
          Find remote jobs matched to your resume
        </h1>
        <p className="blog-lp-lede" style={{ color: 'var(--lp-fg)' }}>
          <strong>HireSchema</strong> is an AI remote job matching platform that scouts live listings daily,
          scores each role against your resume and career path, and delivers personalized remote job alerts —
          so you apply to fewer, better-fit roles instead of scrolling generic job boards.
        </p>
        <Link to="/login" className="blog-lp-btn-p" style={{ marginTop: 24, display: 'inline-flex' }}>
          Get daily remote job matches
        </Link>

        <h2 className="blog-h2" style={{ marginTop: 48 }}>Why generic remote job searches fail</h2>
        <p className="blog-p">
          Most job boards show the same remote listings to everyone. Keyword search surfaces irrelevant roles —
          wrong seniority, wrong function, hybrid jobs labeled remote, and listings that match buzzwords but not
          your actual career path. Effective remote job search requires filtering by fit, not volume.
        </p>

        <h2 className="blog-h2">How HireSchema finds remote jobs for you</h2>
        <ol className="blog-ol">
          <li className="blog-li"><strong>Upload your resume</strong> — skills, seniority, and career signals extracted automatically.</li>
          <li className="blog-li"><strong>Set career paths</strong> — target roles like Senior Frontend Engineer or Remote Product Manager.</li>
          <li className="blog-li"><strong>Daily AI scouting</strong> — live remote listings from ATS feeds and the open web.</li>
          <li className="blog-li"><strong>Career-path filtering</strong> — irrelevant functions removed before you see them.</li>
          <li className="blog-li"><strong>AI scoring</strong> — only strong fits are delivered to your dashboard.</li>
          <li className="blog-li"><strong>Apply faster</strong> — resume tailoring, outreach emails, and interview prep in one place.</li>
        </ol>

        <h2 className="blog-h2">Remote job search: HireSchema vs job boards</h2>
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
                <td className="blog-td">Remote job boards</td>
                <td className="blog-td">Remote-only listings</td>
                <td className="blog-td">No personalization to your resume</td>
              </tr>
              <tr className="blog-tr">
                <td className="blog-td"><strong>HireSchema</strong></td>
                <td className="blog-td">AI-matched daily alerts</td>
                <td className="blog-td">Curated fit, not infinite scroll</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="blog-h2">Explore remote job guides</h2>
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
          {REMOTE_JOBS_FAQ.map((faq) => (
            <div key={faq.question} style={{ marginBottom: 20 }}>
              <dt className="blog-h3" style={{ marginTop: 0 }}>{faq.question}</dt>
              <dd className="blog-p" style={{ margin: '6px 0 0' }}>{faq.answer}</dd>
            </div>
          ))}
        </dl>

        <Link to="/login" className="blog-lp-btn-p" style={{ marginTop: 32, display: 'inline-flex' }}>
          Start matching remote jobs
        </Link>
      </main>
    </div>
  );
}
