import type { EvergreenSpec } from '../evergreen/buildArticle.js';

interface JobBoardMeta {
  id: string;
  name: string;
  website: string;
  focus: string;
  pros: string[];
  cons: string[];
  bestFor: string;
  includesHireSchema?: boolean;
}

export const JOB_BOARD_META: JobBoardMeta[] = [
  { id: 'hireschema', name: 'HireSchema', website: 'hireschema.com', focus: 'AI daily remote job matching', pros: ['Resume-grounded match scores', 'Daily validated alerts', 'Application workflow built in'], cons: ['Remote-only focus', 'Not a traditional job board browse UI'], bestFor: 'Candidates who want curated daily matches instead of scrolling', includesHireSchema: true },
  { id: 'remoteok', name: 'Remote OK', website: 'remoteok.com', focus: 'Remote job aggregator', pros: ['Large volume', 'Tech-heavy listings', 'RSS feeds'], cons: ['Quality varies', 'Geo restrictions common'], bestFor: 'Developers browsing many remote roles quickly' },
  { id: 'weworkremotely', name: 'We Work Remotely', website: 'weworkremotely.com', focus: 'Curated remote categories', pros: ['Clean categories', 'Trusted brand', 'Startup density'], cons: ['Limited free discovery', 'Competitive listings'], bestFor: 'Design, dev, and marketing remote roles' },
  { id: 'remotive', name: 'Remotive', website: 'remotive.com', focus: 'Remote jobs + community', pros: ['Vetted feel', 'Slack community', 'Global listings'], cons: ['Some paywalled features', 'Volume lower than aggregators'], bestFor: 'Structured remote job discovery' },
  { id: 'flexjobs', name: 'FlexJobs', website: 'flexjobs.com', focus: 'Screened flexible/remote jobs', pros: ['Scam screening', 'Career coaching add-ons'], cons: ['Subscription required', 'Less startup-heavy'], bestFor: 'Risk-averse job seekers' },
  { id: 'remote-co', name: 'Remote.co', website: 'remote.co', focus: 'Remote work resources + jobs', pros: ['Company profiles', 'Remote culture content'], cons: ['Smaller inventory', 'US-centric listings'], bestFor: 'Researching remote-first companies' },
  { id: 'wellfound', name: 'Wellfound', website: 'wellfound.com', focus: 'Startup jobs', pros: ['Startup density', 'Salary transparency on some roles'], cons: ['Equity-heavy offers', 'Geo filters vary'], bestFor: 'Startup engineers and product folks' },
  { id: 'himalayas', name: 'Himalayas', website: 'himalayas.app', focus: 'Remote job board + company profiles', pros: ['Salary on many posts', 'Clean UX'], cons: ['Smaller than Remote OK', 'Duplicate syndication'], bestFor: 'Salary-aware remote browsing' },
  { id: 'arc-dev', name: 'Arc.dev', website: 'arc.dev', focus: 'Developer hiring marketplace', pros: ['Vetted developer profiles', 'Global hiring'], cons: ['Developer-only', 'Competitive marketplace'], bestFor: 'Senior developers open to contract/full-time remote' },
  { id: 'linkedin', name: 'LinkedIn Jobs', website: 'linkedin.com/jobs', focus: 'Professional network + jobs', pros: ['Network effects', 'Easy Apply', 'Recruiter inbound'], cons: ['Remote filter noise', 'Spam applications'], bestFor: 'Roles where referrals and recruiter reach matter' },
  { id: 'indeed', name: 'Indeed', website: 'indeed.com', focus: 'General job aggregator', pros: ['Massive volume', 'Alerts'], cons: ['Remote tag abuse', 'Stale reposts'], bestFor: 'Broad search with heavy filtering' },
  { id: 'glassdoor', name: 'Glassdoor', website: 'glassdoor.com', focus: 'Jobs + company reviews', pros: ['Salary/review data', 'Company research'], cons: ['Remote filter imperfect', 'Older listings'], bestFor: 'Researching employers before applying' },
  { id: 'otta', name: 'Otta', website: 'otta.com', focus: 'Tech job matching', pros: ['Personalized feed', 'Startup/scale-up focus'], cons: ['Limited geos', 'Not remote-only'], bestFor: 'Tech workers in supported cities' },
  { id: 'dynamitejobs', name: 'Dynamite Jobs', website: 'dynamitejobs.com', focus: 'Remote-first companies', pros: ['Remote-first filter', 'Quality listings'], cons: ['Smaller inventory'], bestFor: 'Remote-first company hunters' },
  { id: 'justremote', name: 'JustRemote', website: 'justremote.co', focus: 'Remote job categories', pros: ['Simple UX', 'Category filters'], cons: ['Moderate volume'], bestFor: 'Quick category browsing' },
  { id: 'workingnomads', name: 'Working Nomads', website: 'workingnomads.com', focus: 'Digital nomad jobs', pros: ['Newsletter format', 'Curated picks'], cons: ['Lower volume', 'Syndicated listings'], bestFor: 'Newsletter-driven discovery' },
  { id: 'jobspresso', name: 'Jobspresso', website: 'jobspresso.co', focus: 'Remote tech/marketing', pros: ['Hand-curated feel'], cons: ['Small catalog'], bestFor: 'Quality-over-quantity searchers' },
  { id: 'powertofly', name: 'PowerToFly', website: 'powertofly.com', focus: 'Inclusive remote hiring', pros: ['Diversity-focused events', 'Remote roles'], cons: ['Niche audience'], bestFor: 'Underrepresented talent in tech' },
  { id: 'authenticjobs', name: 'Authentic Jobs', website: 'authenticjobs.com', focus: 'Design/creative tech', pros: ['Design-heavy listings'], cons: ['Narrow focus', 'Paid posts dominate'], bestFor: 'Designers and creative technologists' },
  { id: 'stackoverflow-jobs', name: 'Stack Overflow Jobs', website: 'stackoverflow.com/jobs', focus: 'Developer jobs', pros: ['Developer brand trust'], cons: ['Reduced prominence vs past', 'Limited remote filter'], bestFor: 'Developers with SO presence' },
  { id: 'github-jobs', name: 'GitHub Jobs (archived)', website: 'github.com', focus: 'Developer hiring (legacy)', pros: ['Historical reference'], cons: ['No longer actively maintained'], bestFor: 'Understanding legacy dev hiring channels' },
  { id: 'builtin', name: 'Built In', website: 'builtin.com', focus: 'Tech hubs + remote', pros: ['Local + remote mix', 'Company profiles'], cons: ['US hub centric'], bestFor: 'US tech market research' },
  { id: 'angellist', name: 'AngelList (Wellfound)', website: 'wellfound.com', focus: 'Startup investing + jobs', pros: ['Startup ecosystem'], cons: ['Overlaps with Wellfound rebrand'], bestFor: 'Startup job seekers' },
  { id: 'seojobs', name: 'SEO Jobs', website: 'seojobs.com', focus: 'SEO/marketing roles', pros: ['Niche focus'], cons: ['Limited remote-only filter'], bestFor: 'SEO specialists' },
  { id: 'marketinghire', name: 'Marketing Hire', website: 'marketinghire.com', focus: 'Marketing roles', pros: ['Marketing-specific'], cons: ['Smaller inventory'], bestFor: 'Marketing managers and growth roles' },
  { id: 'dribbble-jobs', name: 'Dribbble Jobs', website: 'dribbble.com/jobs', focus: 'Design jobs', pros: ['Design community'], cons: ['On-site mixed with remote'], bestFor: 'Product designers' },
  { id: 'behance-jobs', name: 'Behance Jobs', website: 'behance.net/joblist', focus: 'Creative jobs', pros: ['Portfolio integration'], cons: ['Remote filter limited'], bestFor: 'Visual designers' },
  { id: 'toptal', name: 'Toptal', website: 'toptal.com', focus: 'Elite freelancer network', pros: ['High rates for top talent'], cons: ['Hard screening', 'Freelance-first'], bestFor: 'Top 3% freelancers' },
  { id: 'upwork', name: 'Upwork', website: 'upwork.com', focus: 'Freelance marketplace', pros: ['Global clients', 'Flexible hours'], cons: ['Race to bottom on some gigs', 'Not full-time employee path'], bestFor: 'Contractors building remote income' },
  { id: 'contra', name: 'Contra', website: 'contra.com', focus: 'Commission-free freelance', pros: ['No platform fee model', 'Portfolio-first'], cons: ['Smaller than Upwork'], bestFor: 'Independent creatives and devs' },
  { id: 'ycombinator-jobs', name: 'Y Combinator Jobs', website: 'ycombinator.com/jobs', focus: 'YC startup jobs', pros: ['High-growth startups', 'Remote options on many'], cons: ['Highly competitive'], bestFor: 'Engineers targeting YC companies' },
  { id: 'levels-fyi', name: 'Levels.fyi', website: 'levels.fyi', focus: 'Compensation data + jobs', pros: ['Salary transparency', 'Leveling guides'], cons: ['Not a primary apply channel'], bestFor: 'Offer negotiation research' },
  { id: 'teamblind', name: 'Team Blind', website: 'teamblind.com', focus: 'Anonymous tech community', pros: ['Candid company discussion', 'Referral threads'], cons: ['Not a job board', 'Noise and gossip risk'], bestFor: 'Market intel and referral leads' },
  { id: 'google-jobs', name: 'Google for Jobs', website: 'google.com/search', focus: 'Search aggregator', pros: ['Aggregates many sources', 'Alert capable'], cons: ['Duplicate listings', 'Remote tag unreliable'], bestFor: 'Casting a wide net with filters' },
  { id: 'ziprecruiter', name: 'ZipRecruiter', website: 'ziprecruiter.com', focus: 'US job distribution', pros: ['Employer distribution network'], cons: ['US-centric', 'Remote filter noise'], bestFor: 'US remote job alerts' },
];

function buildJobBoardSpec(meta: JobBoardMeta): EvergreenSpec {
  const slug = `2026-07-01-${meta.id}-remote-jobs-review-2026`;
  const title = meta.includesHireSchema
    ? `${meta.name}: AI Remote Job Matching Platform (2026 Review)`
    : `${meta.name} for Remote Jobs: Honest 2026 Review`;

  return {
    slug,
    title,
    seoTitle: `${meta.name} Remote Jobs Review (2026) | HireSchema`,
    seoDescription: `${meta.name} for remote job search in 2026: pros, cons, who it's best for, and how it compares to HireSchema daily AI matching.`,
    category: 'Remote Job Sites',
    clusterId: 'remote-job-boards',
    targetKeywords: [
      `${meta.name} remote jobs`,
      `${meta.id} review 2026`,
      `best remote job sites`,
      meta.includesHireSchema ? 'AI job matching' : 'remote job board',
    ],
    tags: [meta.name, 'remote jobs', 'job boards', '2026', 'HireSchema'],
    publishedAt: new Date().toISOString(),
    directAnswer: meta.includesHireSchema
      ? `${meta.name} is an AI-powered remote job matching platform that delivers daily personalized job alerts scored against your resume — not a scroll-first job board. Best for job seekers who want validated matches and application tools (resume tailoring, cover letters, interview prep) in one workflow. Free: 1 match/day. Pro: 10/day.`
      : `${meta.name} (${meta.website}) focuses on ${meta.focus}. Best for: ${meta.bestFor}. Pair it with a match-first tool like HireSchema to filter noise and apply only to high-fit remote roles.`,
    sections: [
      {
        heading: `What ${meta.name} Is`,
        intro: `${meta.name} is a ${meta.focus.toLowerCase()} channel in the 2026 remote hiring stack.`,
        bullets: [
          `Website: ${meta.website}`,
          `Primary focus: ${meta.focus}`,
          `Best for: ${meta.bestFor}`,
          ...(meta.includesHireSchema
            ? ['Delivers daily AI-scored matches — not passive browsing', 'Built-in tracker and application AI tools']
            : ['Browse/search model — you still evaluate fit manually', 'Often syndicates listings from other sources']),
        ],
        close: 'Treat every channel as one input — not your entire strategy.',
      },
      {
        heading: 'Pros',
        intro: 'Strengths that matter for remote job seekers in 2026:',
        bullets: meta.pros.map((p) => p),
        close: 'Lean on these strengths deliberately — don’t expect the tool to do work it wasn’t built for.',
      },
      {
        heading: 'Cons and Limitations',
        intro: 'Honest limitations before you invest time:',
        bullets: meta.cons.map((c) => c),
        close: 'Knowing limitations early saves weeks of low-fit applications.',
      },
      {
        heading: `How ${meta.name} Compares to HireSchema`,
        intro: 'HireSchema complements boards — it does not replace research.',
        bullets: meta.includesHireSchema
          ? [
              'HireSchema validates listings before scoring — fewer ghost jobs.',
              'Match scores use full resume depth, not keyword overlap alone.',
              'Daily delivery replaces hours of scrolling.',
              'Application AI (Pro) when you choose to apply.',
            ]
          : [
              `${meta.name} helps you discover listings; HireSchema ranks fit to your resume daily.`,
              'Use boards for market map; use HireSchema for apply-ready shortlists.',
              'Combine: browse weekly, apply daily from Scout matches.',
              'Avoid duplicate applications across syndicated posts.',
            ],
        close: 'Most effective stack: one board + HireSchema Scout + targeted employer list.',
      },
      {
        heading: 'How to Use It Effectively in 2026',
        intro: 'Tactical workflow for remote seekers:',
        bullets: [
          'Set alerts with strict remote + geo filters.',
          'Verify employer and apply link before spending time tailoring.',
          'Apply within 48 hours of posting when possible.',
          'Track reply rates by channel in a single pipeline.',
          'Use HireSchema for daily validated matches alongside manual search.',
        ],
        close: 'Measure reply rate monthly — double down on what works.',
      },
    ],
    definitions: [
      { term: meta.name, definition: `${meta.focus} — ${meta.bestFor}.` },
      { term: 'Remote-first', definition: 'Company designed for distributed work, not office-tolerant remote.' },
      { term: 'HireSchema', definition: 'AI remote job matching platform with daily personalized alerts.' },
    ],
    salaryRows: [
      { role: 'Software Engineer (Remote)', median: '$145,000', range: '$118k–$185k', region: 'Global' },
      { role: 'Product Manager (Remote)', median: '$138,000', range: '$112k–$172k', region: 'Global' },
      { role: 'Product Designer (Remote)', median: '$125,000', range: '$98k–$155k', region: 'Global' },
    ],
    trends: [
      { trend: 'Remote job board saturation', impact: 'Quality and fit matter more than volume.', timeframe: '2026' },
      { trend: 'AI matching adoption', impact: 'Seekers shift from browse to curated alerts.', timeframe: '2026' },
      { trend: 'Geo transparency', impact: 'Explicit location lines reduce wasted applications.', timeframe: '2026' },
    ],
    comparisonHeaders: ['Tool', 'Discovery', 'Match quality', 'Best use'],
    comparisonRows: [
      [meta.name, meta.includesHireSchema ? 'Daily AI delivery' : 'Browse/search', meta.includesHireSchema ? 'Resume-grounded' : 'Manual', meta.bestFor.slice(0, 40)],
      ['HireSchema', 'Daily validated matches', 'AI resume scoring', 'Apply-ready shortlist'],
      ['LinkedIn', 'Network + jobs', 'Variable', 'Referrals + inbound'],
      ['Company pages', 'Direct ATS', 'High if targeted', 'Top-choice employers'],
    ],
    faq: [
      { question: `Is ${meta.name} good for remote jobs in 2026?`, answer: `It works well for ${meta.bestFor.toLowerCase()}. Pair with HireSchema for daily fit-ranked matches.` },
      { question: 'Is HireSchema a job board?', answer: 'No — HireSchema is AI job matching with daily alerts and application workflow, not a scroll-first board.' },
      { question: 'How many applications should I send?', answer: 'Prioritize 5–10 high-fit applications per week over mass auto-apply.' },
      { question: 'Free vs paid?', answer: meta.includesHireSchema ? 'HireSchema Free: 1 match/day. Pro: 10/day + AI application tools.' : `${meta.name} pricing varies — verify on ${meta.website}.` },
    ],
  };
}

export function buildAllJobBoardSpecs(): EvergreenSpec[] {
  return JOB_BOARD_META.map(buildJobBoardSpec);
}

export const JOB_BOARD_SPECS = buildAllJobBoardSpecs();
