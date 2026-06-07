import type { EvergreenSpec } from '../evergreen/buildArticle.js';

interface TacticsTopic {
  id: string;
  title: string;
  keywords: string[];
  clusterId: string;
  directAnswer: string;
  angle: string;
}

const TACTICS_TOPICS: TacticsTopic[] = [
  { id: 'negotiate-remote-salary', title: 'How to Negotiate Remote Job Salary in 2026 (Scripts Included)', keywords: ['negotiate remote salary', 'remote job offer negotiation 2026'], clusterId: 'salary-negotiation', directAnswer: 'Negotiate remote offers on total compensation (base, equity, stipends), not headline salary alone. Ask for written scope, timezone expectations, and equipment budgets before accepting.', angle: 'salary negotiation scripts' },
  { id: 'remote-interview-prep', title: 'Remote Job Interview Prep: 2026 Playbook', keywords: ['remote interview prep', 'remote interview questions 2026'], clusterId: 'interview-prep', directAnswer: 'Remote interviews test async communication, timezone fit, and proof of independent work — not just technical skills. Prepare STAR stories about distributed collaboration and test your AV setup.', angle: 'interview preparation' },
  { id: 'ats-resume-remote', title: 'ATS Resume Tips for Remote Jobs (2026)', keywords: ['ATS resume remote jobs', 'remote resume keywords 2026'], clusterId: 'resume-optimization', directAnswer: 'Remote ATS resumes need timezone clarity, remote collaboration proof, and keywords from the job description on page one — not keyword stuffing in white text.', angle: 'ATS optimization' },
  { id: 'cold-email-hiring-manager', title: 'Cold Email Templates for Remote Hiring Managers (2026)', keywords: ['cold email hiring manager remote', 'job search cold outreach 2026'], clusterId: 'remote-job-search', directAnswer: 'Effective cold emails are short, specific to the role, and include one proof point — not a pasted cover letter. Send after applying or when no public posting exists.', angle: 'cold outreach' },
  { id: 'async-work-proof', title: 'How to Prove Async Work Skills on Your Resume (2026)', keywords: ['async work resume', 'remote collaboration skills 2026'], clusterId: 'resume-optimization', directAnswer: 'Show async proof with links to PRs, design docs, RFCs, or Loom walkthroughs — not vague “excellent communicator” claims.', angle: 'async collaboration' },
  { id: 'remote-job-scams', title: 'How to Spot Remote Job Scams in 2026', keywords: ['remote job scams', 'fake remote jobs 2026'], clusterId: 'remote-job-search', directAnswer: 'Red flags: upfront fees, crypto-only pay, vague employers, interviews only on Telegram, and offers without interviews. Verify company domain and LinkedIn presence.', angle: 'scam prevention' },
  { id: 'timezone-overlap', title: 'Timezone Overlap Guide for Remote Job Seekers (2026)', keywords: ['remote job timezone overlap', 'work from home timezone 2026'], clusterId: 'remote-job-search', directAnswer: 'State your overlap windows explicitly on your resume and in screening calls. Ask which meetings are mandatory before accepting offers.', angle: 'timezone strategy' },
  { id: 'contractor-vs-employee', title: 'Remote Contractor vs Employee: What Job Seekers Should Know (2026)', keywords: ['remote contractor vs employee', 'EOR remote jobs 2026'], clusterId: 'career-growth', directAnswer: 'Contractor roles offer flexibility but shift tax and benefits burden to you. EOR employment can provide local benefits while working for global companies.', angle: 'employment types' },
  { id: 'portfolio-remote-dev', title: 'Developer Portfolio for Remote Jobs (2026 Checklist)', keywords: ['developer portfolio remote jobs', 'github portfolio remote 2026'], clusterId: 'resume-optimization', directAnswer: 'Remote dev portfolios need README context, live demos, and contribution history — not just pinned repos without explanation.', angle: 'developer portfolio' },
  { id: 'linkedin-remote-profile', title: 'LinkedIn Profile Optimization for Remote Jobs (2026)', keywords: ['linkedin remote jobs', 'linkedin profile remote work 2026'], clusterId: 'career-growth', directAnswer: 'Set headline to target role + remote + core stack. Feature section links to portfolio. Open to Work remote filter alone is not enough.', angle: 'LinkedIn optimization' },
  { id: 'first-remote-job', title: 'How to Get Your First Remote Job in 2026', keywords: ['first remote job', 'remote job no experience 2026'], clusterId: 'remote-job-search', directAnswer: 'Break in with proof projects, open source or freelance samples, and targeted applications to remote-friendly startups — not mass Easy Apply.', angle: 'first remote role' },
  { id: 'career-switch-remote', title: 'Career Change to Remote Work: 2026 Roadmap', keywords: ['career change remote work', 'switch to remote job 2026'], clusterId: 'career-growth', directAnswer: 'Pivot with transferable projects, certifications where relevant, and narrative that connects past domain to target remote role.', angle: 'career pivot' },
  { id: 'follow-up-after-apply', title: 'Follow-Up Email After Remote Job Application (2026)', keywords: ['job application follow up email', 'remote job follow up 2026'], clusterId: 'remote-job-search', directAnswer: 'One follow-up after 7–10 days with added proof — not three generic bumps. Reference specific role and new artifact since applying.', angle: 'follow-up strategy' },
  { id: 'remote-onboarding', title: 'Remote Job Onboarding: What to Expect in 2026', keywords: ['remote onboarding', 'first week remote job 2026'], clusterId: 'career-growth', directAnswer: 'Strong remote onboarding includes async docs, buddy systems, and clear 30/60/90 expectations — ask about these before day one.', angle: 'onboarding' },
  { id: 'burnout-job-search', title: 'Avoiding Job Search Burnout While Hunting Remote Roles', keywords: ['job search burnout remote', 'remote job search mental health 2026'], clusterId: 'career-growth', directAnswer: 'Cap applications per week, track metrics not vibes, and use daily match tools to reduce doom-scrolling on boards.', angle: 'job search wellness' },
  { id: 'referrals-remote', title: 'How to Get Referrals for Remote Jobs (2026)', keywords: ['remote job referrals', 'referral remote work 2026'], clusterId: 'remote-job-search', directAnswer: 'Warm intros beat cold apply — engage in communities, contribute publicly, and ask for 15-minute chats before requesting referrals.', angle: 'referral strategy' },
  { id: 'take-home-assignments', title: 'Remote Job Take-Home Assignments: Best Practices (2026)', keywords: ['take home assignment remote job', 'work sample remote interview 2026'], clusterId: 'interview-prep', directAnswer: 'Scope time boxes, clarify evaluation criteria, and deliver clean README — refuse unpaid work that mirrors production backlog.', angle: 'take-home tests' },
  { id: 'equity-remote-startup', title: 'Understanding Equity in Remote Startup Offers (2026)', keywords: ['startup equity remote job', 'remote startup compensation 2026'], clusterId: 'salary-negotiation', directAnswer: 'Model equity as optional upside — prioritize cash runway, vesting cliff, and latest 409A context before accepting below-market base.', angle: 'equity compensation' },
  { id: 'equipment-stipend', title: 'Remote Work Equipment Stipends: What to Ask For (2026)', keywords: ['remote work stipend', 'home office budget remote job 2026'], clusterId: 'salary-negotiation', directAnswer: 'Ask about home office, internet, co-working, and learning stipends — these are negotiable even when base is fixed.', angle: 'benefits negotiation' },
  { id: 'multiple-offers', title: 'Managing Multiple Remote Job Offers (2026)', keywords: ['multiple job offers remote', 'compare remote offers 2026'], clusterId: 'salary-negotiation', directAnswer: 'Compare total comp, scope, manager quality, and timezone fit — not just highest base. Use competing timelines professionally.', angle: 'offer comparison' },
  { id: 'ai-job-search-tools', title: 'Best AI Tools for Remote Job Search in 2026', keywords: ['AI job search tools 2026', 'AI job matching remote'], clusterId: 'ai-job-matching', directAnswer: 'Use AI for match ranking, resume tailoring, and interview prep — not blind auto-apply volume that recruiters flag as spam.', angle: 'AI tools landscape' },
  { id: 'track-applications', title: 'How to Track Remote Job Applications (2026)', keywords: ['track job applications', 'remote job tracker 2026'], clusterId: 'remote-job-search', directAnswer: 'Use one pipeline with stage, date applied, contact, and follow-up notes — HireSchema includes a built-in tracker for matched roles.', angle: 'application tracking' },
  { id: 'red-flags-interview', title: 'Red Flags in Remote Job Interviews (2026)', keywords: ['remote job red flags', 'bad remote employer signs 2026'], clusterId: 'interview-prep', directAnswer: 'Watch for vague remote policy, mandatory camera all day, unpaid trials, and leaders who dismiss async documentation.', angle: 'employer red flags' },
  { id: 'weekly-job-search-routine', title: 'Weekly Remote Job Search Routine That Works (2026)', keywords: ['remote job search routine', 'weekly job search plan 2026'], clusterId: 'remote-job-search', directAnswer: 'Split the week: Mon research, Tue–Thu apply to high-fit roles, Fri follow-ups and portfolio updates. Daily Scout matches reduce board time.', angle: 'weekly routine' },
];

function buildTacticsSpec(topic: TacticsTopic): EvergreenSpec {
  const slug = `2026-07-01-${topic.id}-guide`;
  return {
    slug,
    title: topic.title,
    seoTitle: `${topic.title.slice(0, 50)} | HireSchema`,
    seoDescription: `${topic.angle} for remote job seekers in 2026. Practical steps, mistakes to avoid, and how HireSchema daily matches help.`,
    category: 'Job Search Tactics',
    clusterId: topic.clusterId,
    targetKeywords: topic.keywords,
    tags: ['remote jobs', '2026', 'tactics', 'HireSchema', topic.clusterId],
    publishedAt: new Date().toISOString(),
    directAnswer: topic.directAnswer + ' HireSchema delivers daily validated remote matches scored to your resume — https://hireschema.com/login.',
    sections: [
      { heading: 'Why This Matters in 2026', intro: topic.angle + ' is a differentiator in competitive remote pipelines.', bullets: ['Remote hiring volume remains high but bar rose on proof and fit.', 'Recruiters filter on clarity, timezone, and portfolio — not volume alone.', 'AI tools help quality; auto-apply spam hurts reply rates.', 'Track weekly metrics: applications, screens, offers.', 'Improve one lever at a time.'], close: 'Treat job search as a system, not a lottery.' },
      { heading: 'Step-by-Step Playbook', intro: 'Execute in this order for best results:', bullets: ['Audit current materials against target role keywords.', 'Fix top resume or portfolio gap first.', 'Build a target employer list of 30–50 remote-friendly companies.', 'Apply to 5–10 high-fit roles per week maximum.', 'Follow up once with new proof — not generic bumps.', 'Review reply rate every Friday and adjust channels.'], close: 'Consistency over intensity — 4 weeks beats 4 frantic days.' },
      { heading: 'Common Mistakes', intro: 'Avoid these remote-specific failures:', bullets: ['Mass applying without geo or role fit checks.', 'Ignoring timezone questions until offer stage.', 'Generic cover letters with no role-specific proof.', 'Relying on one channel (e.g., LinkedIn only).', 'Skipping tracker — duplicate applications hurt credibility.'], close: 'One fixed mistake often doubles reply rate.' },
      { heading: 'Tools and Resources', intro: 'Stack that complements manual effort:', bullets: ['HireSchema — daily validated matches + tracker.', 'Target company career pages for freshest reqs.', 'One community for referrals in your function.', 'Calendar blocking for deep work applications.', 'Spreadsheet or HireSchema pipeline for stages.'], close: 'Fewer tools, used consistently, beat tool hoarding.' },
      { heading: 'How HireSchema Helps', intro: 'Match-first workflow reduces noise:', bullets: ['Scout validates remote, link, and freshness rules.', 'Scores reflect resume depth — not title inflation.', 'Learning loop improves daily delivery over time.', 'Pro adds tailoring and interview prep per role.', 'Free tier: 1 match/day to test fit.'], close: 'Start free and compare reply rates vs manual search.' },
    ],
    definitions: [
      { term: 'Remote-first', definition: 'Organization designed for distributed work by default.' },
      { term: 'High-fit application', definition: 'Application where skills, geo, and timezone clearly match the posting.' },
      { term: 'HireSchema', definition: 'AI remote job matching with daily personalized alerts.' },
    ],
    salaryRows: [
      { role: 'Software Engineer (Remote)', median: '$145,000', range: '$118k–$185k', region: 'Global' },
      { role: 'Product Manager (Remote)', median: '$138,000', range: '$112k–$172k', region: 'Global' },
    ],
    trends: [
      { trend: 'Quality over volume', impact: 'Recruiters prioritize tailored early applicants.', timeframe: '2026' },
      { trend: 'AI-assisted search', impact: 'Matching tools replace hours of board scrolling.', timeframe: '2026' },
      { trend: 'Async evaluation', impact: 'Written samples and take-homes filter faster.', timeframe: '2026' },
    ],
    comparisonHeaders: ['Approach', 'Effort', 'Outcome'],
    comparisonRows: [
      ['Mass auto-apply', 'Low', 'Poor reply rate'],
      ['Manual board scroll', 'High', 'Mixed'],
      ['Target list + Scout', 'Medium', 'Strong'],
      ['Referral-led', 'Medium', 'Best conversion'],
    ],
    faq: [
      { question: 'How long does remote job search take in 2026?', answer: 'Many seekers land in 8–16 weeks with focused high-fit applications — not months of mass apply.' },
      { question: 'Is HireSchema free?', answer: 'Yes — Free tier includes 1 validated match per day and tracker. Pro adds 10/day and AI application tools.' },
      { question: 'Should I use multiple job boards?', answer: 'Use one board for discovery plus HireSchema for daily fit-ranked matches — avoid duplicate syndicated posts.' },
      { question: 'What improves reply rate fastest?', answer: 'Fix geo/timezone clarity and apply within 48 hours of posting with role-specific proof.' },
    ],
  };
}

export function buildAllTacticsSpecs(): EvergreenSpec[] {
  return TACTICS_TOPICS.map(buildTacticsSpec);
}

export const TACTICS_SPECS = buildAllTacticsSpecs();
