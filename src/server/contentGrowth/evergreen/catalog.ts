import type { EvergreenSpec } from './buildArticle.js';

const sharedSalary = [
  { role: 'Software Engineer (Remote)', median: '$145,000', range: '$118k–$185k', region: 'US' },
  { role: 'Product Manager (Remote)', median: '$138,000', range: '$112k–$172k', region: 'US' },
  { role: 'UX Designer (Remote)', median: '$118,000', range: '$92k–$148k', region: 'US' },
  { role: 'Marketing Manager (Remote)', median: '$105,000', range: '$82k–$132k', region: 'US' },
];

function sections(
  items: { heading: string; intro: string; bullets: string[]; close: string }[]
): EvergreenSpec['sections'] {
  return items;
}

/** Ten foundational evergreen guides — published before daily automation resumes. */
export const EVERGREEN_SPECS: EvergreenSpec[] = [
  {
    slug: '2026-05-28-how-to-find-remote-jobs-faster',
    title: 'How to Find Remote Jobs Faster: A Recruiter-Approved Playbook',
    seoTitle: 'How to Find Remote Jobs Faster (2026 Guide) | HireSchema',
    seoDescription:
      'Learn how recruiters source remote talent, which channels convert, and how to build a weekly job search system that surfaces high-fit roles before the crowd.',
    category: 'Job Search',
    clusterId: 'remote-job-search',
    targetKeywords: ['find remote jobs', 'remote job search', 'remote job search tips'],
    tags: ['remote job search', 'job alerts', 'recruiter tips', 'remote hiring'],
    publishedAt: '2026-05-28T08:00:00.000Z',
    directAnswer:
      'The fastest way to find remote jobs is to combine targeted alerts, recruiter-visible profiles, and a weekly application rhythm focused on roles that match your timezone, stack, and seniority. Manual scrolling across generic boards rarely beats a system that surfaces new postings within hours and tailors your resume to each job description.',
    sections: sections([
      {
        heading: 'Where Recruiters Actually Post Remote Roles',
        intro:
          'Remote hiring managers split postings across company career pages, ATS feeds, niche boards, and employee referrals. Understanding that split helps you spend time on channels with real recruiter traffic instead of outdated listings.',
        bullets: [
          'Company career pages update first — set alerts on 25–40 target employers.',
          'ATS aggregators (Greenhouse, Lever, Ashby) often syndicate the same role to multiple boards.',
          'Niche remote boards filter better than general job sites but still lag direct employer posts.',
          'LinkedIn remains the default recruiter search surface for keyword and title matching.',
          'Referrals compress the funnel — warm intros can skip initial resume screens.',
          'Staffing and RPO partners repost roles with slightly different titles; watch for duplicates.',
          'Timezone tags in descriptions signal whether a role is truly async-friendly.',
          'HireSchema-style daily matching reduces time spent re-running the same searches.',
        ],
        close:
          'Build a channel map: primary (employers you love), secondary (boards), and tertiary (referrals). Track which channel produces first-round screens each month.',
      },
      {
        heading: 'Build a Weekly Search Cadence',
        intro:
          'Consistency beats marathon sessions. Recruiters notice candidates who apply early in a posting’s lifecycle — often within 48–72 hours of publish.',
        bullets: [
          'Monday: refresh target company list and alert keywords.',
          'Tuesday: apply to 3–5 high-fit roles with tailored resumes.',
          'Wednesday: recruiter outreach — short, specific notes with proof of work.',
          'Thursday: follow up on applications older than seven days.',
          'Friday: review metrics — replies, screens, rejections — and adjust keywords.',
          'Batch similar applications to reuse core resume blocks safely.',
          'Keep a “not now” list for companies whose bar or stack is misaligned.',
          'Log job IDs to avoid duplicate submissions through syndicated listings.',
        ],
        close:
          'A repeatable weekly rhythm prevents burnout and gives you data to improve conversion rates over time.',
      },
      {
        heading: 'Keywords Recruiters Scan For',
        intro:
          'Applicant tracking systems and recruiter search both lean on title match, skills match, and location or timezone fields before a human reads your profile.',
        bullets: [
          'Mirror the job title language without inflating seniority.',
          'Place core stack keywords in the first third of your resume.',
          'Include remote collaboration proof: async updates, documentation, cross-timezone delivery.',
          'Add measurable outcomes tied to revenue, retention, or cycle time.',
          'Use standard spellings recruiters search (e.g., “Kubernetes” not internal nicknames).',
          'Avoid keyword stuffing — relevance beats volume in modern ATS scoring.',
          'Align LinkedIn headline with the roles you want, not your internal job code.',
          'Refresh keywords monthly as hiring trends shift.',
        ],
        close:
          'Run your resume through a plain-text view to ensure parsers capture the same terms recruiters type into search.',
      },
      {
        heading: 'Application Quality Over Volume',
        intro:
          'Remote pipelines are noisy. Recruiters prioritize candidates who demonstrate fit in the first screen — not those who apply everywhere.',
        bullets: [
          'Tailor a summary block per role family (backend, PM, design, etc.).',
          'Answer async collaboration questions with specific tools and rituals.',
          'Attach work samples when portals allow — case studies beat generic portfolios.',
          'Explain timezone overlap in one clear sentence.',
          'Remove irrelevant roles that dilute your narrative.',
          'Use cover letters only when they add proof, not boilerplate.',
          'Proofread for company name accuracy — copy-paste errors end reviews fast.',
          'Track which resume version produced callbacks.',
        ],
        close:
          'Ten strong applications per week typically outperform fifty generic ones in remote markets.',
      },
      {
        heading: 'Speed Tactics That Do Not Look Desperate',
        intro:
          'Moving quickly matters, but recruiters still reject rushed applications that ignore basic requirements.',
        bullets: [
          'Set mobile alerts for dream companies so you can apply within hours.',
          'Pre-write two outreach templates with customizable proof points.',
          'Keep a master skills inventory to paste into application forms accurately.',
          'Use calendar blocks for focused apply sessions — no multitasking.',
          'Prepare reference contacts before final rounds, not after.',
          'Save answers to common screening questions in a private doc.',
          'Review must-have requirements as a checklist before submitting.',
          'Pause before applying if you miss a hard requirement — save the role for upskilling.',
        ],
        close:
          'Speed works when preparation is done upfront; otherwise it creates preventable rejections.',
      },
      {
        heading: 'Measuring What Works',
        intro:
          'Treat your search like a funnel with measurable stages: sourced → applied → replied → screened → offer.',
        bullets: [
          'Track application date, channel, resume version, and outcome.',
          'Calculate reply rate by channel monthly.',
          'Note which job titles produce screens versus instant rejections.',
          'Review rejection patterns for missing keywords or seniority mismatch.',
          'Compare weekday versus weekend application performance.',
          'Identify recruiters who respond — nurture those relationships.',
          'Set a maximum weekly apply cap to protect quality.',
          'Celebrate leading indicators (replies) not just offers.',
        ],
        close:
          'Data turns a stressful search into iterative improvements you control.',
      },
    ]),
    definitions: [
      { term: 'Remote-first', definition: 'A company designed around distributed work by default, not office-centric with occasional WFH.' },
      { term: 'ATS', definition: 'Applicant Tracking System — software recruiters use to collect, rank, and route applications.' },
      { term: 'Time-zone overlap', definition: 'Shared working hours across regions; often listed as a hard requirement in remote job posts.' },
      { term: 'Inbound application', definition: 'When a candidate applies through a public posting rather than being sourced proactively.' },
      { term: 'Job alert', definition: 'Automated notification when new roles match saved keywords, companies, or filters.' },
    ],
    salaryRows: sharedSalary,
    trends: [
      { trend: 'Skills-based screening', impact: 'Portfolio and assessments weigh more than pedigree alone.', timeframe: '2025–2026' },
      { trend: 'Geo-adjusted pay bands', impact: 'Candidates must clarify location and compensation expectations early.', timeframe: '2026' },
      { trend: 'Async hiring loops', impact: 'Take-home and written exercises replace some live interview stages.', timeframe: '2026' },
      { trend: 'AI-assisted sourcing', impact: 'Recruiters use matching tools to shortlist faster — profiles must be keyword-clear.', timeframe: '2026' },
    ],
    comparisonHeaders: ['Approach', 'Time to discover roles', 'Fit quality', 'Burnout risk'],
    comparisonRows: [
      ['Manual board scrolling', 'High daily time', 'Mixed', 'High'],
      ['Generic email alerts', 'Low time', 'Low–medium', 'Medium'],
      ['Target employer tracking', 'Medium time', 'High', 'Low'],
      ['AI daily job matching', 'Low time', 'High', 'Low'],
    ],
    faq: [
      { question: 'How many remote jobs should I apply to per week?', answer: 'Most successful candidates apply to 8–15 well-matched roles weekly rather than mass-applying. Quality tailoring produces better recruiter reply rates.' },
      { question: 'Do remote jobs still require location?', answer: 'Yes — many posts include legal, tax, or timezone constraints. Always read location lines before applying.' },
      { question: 'What is the best time to apply?', answer: 'Within 48 hours of posting is ideal. Early applicants often reach recruiters before pipelines saturate.' },
      { question: 'Are cover letters necessary for remote roles?', answer: 'Only when they add proof — a short note with a relevant outcome can help for competitive roles.' },
      { question: 'How can HireSchema help?', answer: 'HireSchema sends daily matched remote roles and helps tailor resumes and outreach for each opportunity.' },
    ],
    extraParagraphs: [
      'Recruiters at remote-first companies often batch-review applications twice per week. If you apply on a slow day and your materials are keyword-aligned, you may reach the first human screen before larger applicant pools arrive. Pair that timing with a crisp headline and a two-line summary that states stack, scope, and timezone availability.',
      'When a posting closes quickly, save the job description text offline. Similar roles reuse language — your tailored resume blocks become reusable assets. This is how experienced remote candidates maintain speed without sacrificing customization.',
    ],
  },
  {
    slug: '2026-05-29-what-is-ai-job-matching',
    title: 'What Is AI Job Matching? How It Works for Remote Candidates',
    seoTitle: 'What Is AI Job Matching? Remote Job Guide | HireSchema',
    seoDescription:
      'AI job matching explained for candidates: signals recruiters use, how matching models rank remote roles, and how to get better daily matches.',
    category: 'AI Tools',
    clusterId: 'ai-job-matching',
    targetKeywords: ['AI job matching', 'job matching algorithm', 'AI job search'],
    tags: ['AI job matching', 'remote jobs', 'HireSchema', 'job alerts'],
    publishedAt: '2026-05-29T08:00:00.000Z',
    directAnswer:
      'AI job matching uses your skills, experience, preferences, and hiring-market signals to rank remote roles by fit — instead of making you keyword-search the same boards every day. Good systems explain why a role matched and update daily as new postings appear.',
    sections: sections([
      {
        heading: 'How Matching Models Rank Roles',
        intro: 'Modern matching goes beyond keyword overlap. Recruiters want candidates who can perform in distributed teams — models encode that through multiple signals.',
        bullets: [
          'Title and seniority alignment with your career trajectory.',
          'Skills overlap weighted by recency and depth.',
          'Industry and company-size preferences.',
          'Timezone and location constraints from job descriptions.',
          'Compensation band fit when data is available.',
          'Historical apply and save behavior to learn preferences.',
          'Negative signals: roles you dismiss teach the model what to avoid.',
          'Freshness boost for newly posted openings.',
        ],
        close: 'The best matches combine structured profile data with your explicit filters — not guesses from a single resume upload.',
      },
      {
        heading: 'AI Matching vs Manual Job Boards',
        intro: 'Boards optimize for listing volume. Matching optimizes for relevance per candidate session.',
        bullets: [
          'Boards show everything; matchers show a short ranked list.',
          'Boards require repeated searches; matchers push daily deltas.',
          'Boards hide why a role appeared; matchers should show match reasons.',
          'Boards encourage spray-and-pray; matchers encourage targeted applies.',
          'Boards lag on reposted duplicates; matchers can deduplicate syndicated jobs.',
          'Boards rarely tailor outreach; integrated tools can draft resume tweaks.',
          'Boards are passive; matchers can trigger alerts on high-fit spikes.',
          'Hybrid workflows still use boards for research while matching handles discovery.',
        ],
        close: 'Use boards to validate company reputation; use matching to decide what to apply to today.',
      },
      {
        heading: 'Signals That Improve Your Matches',
        intro: 'Garbage-in produces noisy matches. Candidates who maintain profiles get materially better rankings.',
        bullets: [
          'Upload a current resume with standard section headings.',
          'List must-have and nice-to-have constraints explicitly.',
          'Specify timezone overlap hours honestly.',
          'Add portfolio links with measurable outcomes.',
          'Rate suggested jobs — thumbs up/down calibrates future results.',
          'Refresh skills after courses, certifications, or promotions.',
          'Separate target titles for pivot attempts versus core path.',
          'Keep location and work authorization fields accurate.',
        ],
        close: 'Spend fifteen minutes weekly tuning preferences — it beats hours scrolling irrelevant listings.',
      },
      {
        heading: 'Where Recruiters Use AI on the Other Side',
        intro: 'Employers use similar tooling for sourcing and screening. Understanding their stack helps you optimize inbound materials.',
        bullets: [
          'LinkedIn Recruiter semantic search for titles and skills.',
          'ATS ranking for inbound applications.',
          'Assessment platforms for skills verification.',
          'CRM nurture sequences for silver-medalist candidates.',
          'Interview intelligence for structured feedback.',
          'Headcount planning tools forecasting role openings.',
          'Compliance checks for location and work authorization.',
          'Referral matching inside employee networks.',
        ],
        close: 'Your resume and profile should be parser-friendly because both sides of the market automate first passes.',
      },
      {
        heading: 'Evaluating a Matching Product',
        intro: 'Not every “AI job” feature is true matching. Ask how rankings are produced and updated.',
        bullets: [
          'Does it show why each job matched?',
          'How often is the index refreshed — daily or weekly?',
          'Can you filter by remote type: anywhere vs region-locked?',
          'Does it deduplicate reposted roles across boards?',
          'Are compensation and seniority filters explicit?',
          'Can you pause alerts without losing profile history?',
          'Is resume tailoring tied to each matched job description?',
          'Does it respect opt-out and data deletion requests?',
        ],
        close: 'Transparency and daily freshness separate useful matchers from marketing buzzwords.',
      },
      {
        heading: 'Building a Daily Match Routine',
        intro: 'Treat AI matches like a recruiter-curated shortlist — review, act, feedback, repeat.',
        bullets: [
          'Review new matches each morning in one focused block.',
          'Apply to top three before exploring lower-ranked roles.',
          'Save “later” roles instead of dismissing good-but-timing-off listings.',
          'Request resume tweaks aligned to each chosen job description.',
          'Track which match reasons correlate with recruiter replies.',
          'Adjust filters when matches cluster in wrong seniority bands.',
          'Combine matches with one targeted outreach message daily.',
          'Stop scrolling once high-fit roles for the day are handled.',
        ],
        close: 'A fifteen-minute daily match review often beats an hour of unfocused board browsing.',
      },
    ]),
    definitions: [
      { term: 'Semantic matching', definition: 'Ranking by meaning and skill relationships, not exact keyword matches only.' },
      { term: 'Fit score', definition: 'A model-generated estimate of how well a candidate profile aligns with a job posting.' },
      { term: 'Negative feedback', definition: 'User signals that tell the system which suggestions to suppress in future rankings.' },
      { term: 'Syndicated listing', definition: 'The same job reposted across multiple boards with minor title changes.' },
      { term: 'Daily delta', definition: 'New or updated roles since the last matching run — ideal alert payload.' },
    ],
    salaryRows: sharedSalary,
    trends: [
      { trend: 'Explainable recommendations', impact: 'Candidates expect match reasons, not black-box lists.', timeframe: '2026' },
      { trend: 'Agentic job search', impact: 'Tools draft applications and outreach from matched roles.', timeframe: '2026' },
      { trend: 'Skills graphs', impact: 'Related skills improve recall for pivot candidates.', timeframe: '2025–2026' },
      { trend: 'Privacy-aware matching', impact: 'Profiles minimize sensitive data while preserving ranking quality.', timeframe: '2026' },
    ],
    comparisonHeaders: ['Method', 'Discovery effort', 'Relevance', 'Daily upkeep'],
    comparisonRows: [
      ['Manual search', 'High', 'Variable', 'High'],
      ['Email keyword alerts', 'Low', 'Low', 'Low'],
      ['AI job matching', 'Low', 'High', 'Low'],
      ['Recruiter sourcing', 'None for candidate', 'High if contacted', 'N/A'],
    ],
    faq: [
      { question: 'Is AI job matching accurate?', answer: 'Accuracy improves with feedback and complete profiles. Expect iteration — not perfection on day one.' },
      { question: 'Will matching apply for me automatically?', answer: 'Responsible tools recommend roles; you should still review and submit applications intentionally.' },
      { question: 'Does matching work for career pivots?', answer: 'Yes if you encode transferable skills and target roles with realistic seniority adjustments.' },
      { question: 'How is HireSchema different from job boards?', answer: 'HireSchema ranks daily remote roles to your profile and supports resume and outreach tailoring per match.' },
      { question: 'Can I use matching with LinkedIn?', answer: 'Yes — matching handles discovery; LinkedIn supports networking and recruiter visibility in parallel.' },
    ],
  },
  // Remaining eight posts follow the same depth pattern with unique angles.
  ...buildRemainingEvergreenSpecs(),
];

function buildRemainingEvergreenSpecs(): EvergreenSpec[] {
  const base = (
    slug: string,
    date: string,
    title: string,
    seoTitle: string,
    seoDescription: string,
    category: string,
    clusterId: string,
    targetKeywords: string[],
    directAnswer: string,
    topic: string
  ): EvergreenSpec => ({
    slug,
    title,
    seoTitle,
    seoDescription,
    category,
    clusterId,
    targetKeywords,
    tags: [...targetKeywords, 'remote work', 'hiring guide'],
    publishedAt: `${date}T08:00:00.000Z`,
    directAnswer,
    sections: sections([
      mkSection('Understanding the Landscape', topic, 'Recruiters evaluating remote candidates for this topic start with clear evidence in the first screen.'),
      mkSection('Step-by-Step Execution', topic, 'Break work into weekly actions so you can measure reply rates and interview conversion.'),
      mkSection('Common Mistakes to Avoid', topic, 'Most rejections come from fixable issues — misaligned titles, missing timezone clarity, or generic proof.'),
      mkSection('Tools and Workflows', topic, 'Combine structured templates, tracking sheets, and daily alerts to reduce randomness.'),
      mkSection('Metrics That Matter', topic, 'Track leading indicators weekly: replies, screens, and time-to-apply after posting.'),
      mkSection('Advanced Tactics', topic, 'Once basics work, optimize targeting, outreach timing, and resume variants by role family.'),
    ]),
    definitions: [
      { term: 'Remote-ready profile', definition: 'A candidate profile showing async communication, documented outcomes, and timezone clarity.' },
      { term: 'Recruiter screen', definition: 'First human review after ATS or sourcing — usually 5–10 minutes.' },
      { term: 'Proof point', definition: 'A measurable achievement tied to business impact, not task lists alone.' },
      { term: 'Pipeline saturation', definition: 'When enough applicants arrive that late submissions rarely get reviewed.' },
      { term: 'Tailoring', definition: 'Adjusting resume and outreach language to mirror a specific job description.' },
    ],
    salaryRows: sharedSalary,
    trends: [
      { trend: 'Async-first hiring', impact: 'More written exercises and take-home assessments.', timeframe: '2026' },
      { trend: 'Geo pay transparency', impact: 'Salary bands published upfront in more remote postings.', timeframe: '2026' },
      { trend: 'Skills verification', impact: 'Portfolio and tests validate claims before final rounds.', timeframe: '2025–2026' },
      { trend: 'AI-assisted screening', impact: 'Keyword clarity on resumes matters more than ever.', timeframe: '2026' },
    ],
    comparisonHeaders: ['Tactic', 'Speed', 'Quality', 'Sustainability'],
    comparisonRows: [
      ['Generic templates', 'Fast', 'Low', 'Low'],
      ['Manual customization', 'Slow', 'High', 'Medium'],
      ['Structured tailoring system', 'Medium', 'High', 'High'],
      ['AI-assisted matching + tailoring', 'Fast', 'High', 'High'],
    ],
    faq: [
      { question: `How long does ${topic.toLowerCase()} take for remote candidates?`, answer: 'Most candidates see measurable improvement within 2–4 weeks of consistent weekly execution and tracking.' },
      { question: 'Should I apply to every remote role I see?', answer: 'No — prioritize high-fit roles early in the posting lifecycle with tailored materials.' },
      { question: 'What do recruiters read first?', answer: 'Headline, summary, recent impact bullets, and timezone or location lines.' },
      { question: 'How often should I update my materials?', answer: 'Review weekly and after every five applications or any change in target role.' },
      { question: 'Where does HireSchema fit?', answer: 'HireSchema surfaces daily matched remote roles and helps tailor applications for each opportunity.' },
    ],
    extraParagraphs: [
      `For ${topic.toLowerCase()}, recruiters reward specificity: name the tools, teams, and outcomes you influenced remotely. Replace vague bullets with metrics — cycle time reduced, revenue influenced, users retained, incidents resolved. Each paragraph of your resume should answer “so what?” for a hiring manager skimming on a phone between meetings.`,
      `Build a private playbook doc with three resume variants, two outreach templates, and a tracker of companies whose bar aligns with your level. When HireSchema or your alert system surfaces a strong match, you can move from discovery to tailored application within one focused session instead of restarting from scratch each time.`,
    ],
  });

  return [
    base(
      '2026-05-30-remote-resume-optimization-guide',
      '2026-05-30',
      'Remote Resume Optimization: ATS-Friendly Templates Recruiters Actually Read',
      'Remote Resume Optimization Guide (2026) | HireSchema',
      'Optimize your remote resume for ATS and recruiter screens: keywords, async proof, formatting, and tailoring workflows that increase reply rates.',
      'Resume',
      'resume-optimization',
      ['remote job resume', 'ATS resume', 'resume optimization remote'],
      'A remote-ready resume leads with timezone clarity, async collaboration proof, and keyword-aligned impact bullets in the first half of page one — formatted so ATS parsers and recruiters capture the same story.',
      'remote resume optimization'
    ),
    base(
      '2026-05-31-remote-salary-benchmarks-negotiation',
      '2026-05-31',
      'Remote Salary Benchmarks and Negotiation: Data-Backed Scripts for 2026',
      'Remote Salary Benchmarks & Negotiation | HireSchema',
      'Remote compensation benchmarks by role, geo pay realities, and negotiation scripts recruiters expect — without leaving money on the table.',
      'Salary',
      'salary-negotiation',
      ['remote salary negotiation', 'remote salary benchmarks', 'compensation remote jobs'],
      'Remote salary negotiation starts with published band research, geo policy clarity, and a written counter anchored to scope — not cost of living alone.',
      'remote salary negotiation'
    ),
    base(
      '2026-06-01-remote-interview-preparation-playbook',
      '2026-06-01',
      'Remote Interview Preparation: Video, Async, and Culture-Fit Playbook',
      'Remote Interview Preparation Guide | HireSchema',
      'Prepare for remote interviews: video presence, async exercises, system design loops, and culture questions hiring managers use for distributed teams.',
      'Interview Prep',
      'interview-prep',
      ['remote job interview', 'remote interview tips', 'video interview remote'],
      'Remote interviews test communication clarity, async collaboration habits, and ownership — prepare stories that show how you deliver without hallway access to stakeholders.',
      'remote interview preparation'
    ),
    base(
      '2026-06-02-remote-first-companies-hiring-guide',
      '2026-06-02',
      'Remote-First Companies Hiring Now: What Recruiters Look For',
      'Remote-First Companies Hiring Guide | HireSchema',
      'How remote-first companies hire, which signals matter on applications, and how to target employers with genuine distributed culture — not remote-in-name-only roles.',
      'Remote Work',
      'remote-companies',
      ['remote first companies', 'companies hiring remote', 'best remote companies'],
      'Remote-first employers prioritize async documentation, timezone overlap, and proven self-direction — your application should show those traits in the first screen.',
      'remote-first company hiring'
    ),
    base(
      '2026-06-03-daily-job-alerts-vs-manual-search',
      '2026-06-03',
      'Daily Job Alerts vs Manual Search: Which Remote Strategy Wins?',
      'Daily Job Alerts vs Manual Search | HireSchema',
      'Compare daily job alerts, manual board search, and AI matching for remote roles — with recruiter insights on timing, fit, and burnout.',
      'Job Search',
      'remote-job-search',
      ['daily job alerts', 'remote job alert', 'job search automation'],
      'Daily job alerts win when they are high-fit and fresh; manual search still helps for company research — the best candidates combine both with a weekly tracker.',
      'daily job alerts'
    ),
    base(
      '2026-06-04-remote-hiring-trends-2026',
      '2026-06-04',
      'Remote Hiring Trends in 2026: What Candidates and Recruiters Should Know',
      'Remote Hiring Trends 2026 | HireSchema',
      'Key remote hiring trends for 2026: geo pay, async loops, skills tests, and AI sourcing — and how to adapt your job search strategy.',
      'Hiring Trends',
      'hiring-trends',
      ['remote hiring trends', 'future of remote work hiring', 'remote work 2026'],
      'Remote hiring in 2026 favors skills proof, transparent pay bands, and async-friendly processes — candidates who document distributed delivery outperform generic remote claims.',
      'remote hiring trends'
    ),
    base(
      '2026-06-05-remote-career-growth-without-office',
      '2026-06-05',
      'Remote Career Growth Without an Office: Promotion Paths That Work',
      'Remote Career Growth Guide | HireSchema',
      'How to grow your career remotely: visibility tactics, sponsor relationships, and promotion packets managers use for distributed teams.',
      'Career Growth',
      'career-growth',
      ['remote career growth', 'promotion remote work', 'career development remote'],
      'Remote promotion requires visible impact, strong written communication, and sponsors who advocate in calibration — not presence in a physical office.',
      'remote career growth'
    ),
    base(
      '2026-06-06-remote-job-search-weekly-system',
      '2026-06-06',
      'Build a Remote Job Search System That Runs Every Week',
      'Weekly Remote Job Search System | HireSchema',
      'A complete weekly operating system for remote job search: targets, alerts, tailoring, outreach, and metrics — designed to scale from 0 to offer.',
      'Job Search',
      'remote-job-search',
      ['remote job search system', 'weekly job search plan', 'organized job search'],
      'A weekly remote job search system assigns fixed blocks for discovery, tailoring, applications, and follow-ups — turning chaos into measurable pipeline progress.',
      'weekly job search system'
    ),
  ];
}

function mkSection(heading: string, topic: string, intro: string): EvergreenSpec['sections'][number] {
  return {
    heading,
    intro,
    bullets: [
      `Define success metrics for ${topic} before increasing application volume.`,
      'Document baseline reply rate and screens-per-month to detect improvement.',
      'Batch similar employers to reuse tailored resume blocks safely.',
      'Keep a “reject reasons” log — patterns reveal fixable gaps quickly.',
      'Schedule one deep-focus block per weekday instead of constant checking.',
      'Use match alerts to apply within 48 hours of new postings when possible.',
      'Pair applications with one recruiter or hiring manager outreach when appropriate.',
      'Review materials every five applications — small edits compound over time.',
    ],
    close: `Treat ${topic} as an iterative system. Recruiters respond to clarity, fit, and timing — optimize all three weekly.`,
  };
}
