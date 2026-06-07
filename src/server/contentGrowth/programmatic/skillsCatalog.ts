import type { EvergreenSpec } from '../evergreen/buildArticle.js';

interface SkillTopic {
  id: string;
  skill: string;
  stack: string[];
  roles: string[];
}

const SKILL_TOPICS: SkillTopic[] = [
  { id: 'react', skill: 'React', stack: ['React', 'TypeScript', 'Next.js'], roles: ['Frontend Developer', 'Full Stack Developer'] },
  { id: 'typescript', skill: 'TypeScript', stack: ['TypeScript', 'Node.js', 'React'], roles: ['Software Engineer', 'Full Stack Developer'] },
  { id: 'python', skill: 'Python', stack: ['Python', 'Django', 'FastAPI'], roles: ['Software Engineer', 'Data Scientist'] },
  { id: 'nodejs', skill: 'Node.js', stack: ['Node.js', 'Express', 'PostgreSQL'], roles: ['Backend Developer', 'Full Stack Developer'] },
  { id: 'nextjs', skill: 'Next.js', stack: ['Next.js', 'React', 'Vercel'], roles: ['Frontend Developer', 'Full Stack Developer'] },
  { id: 'vue', skill: 'Vue.js', stack: ['Vue', 'Nuxt', 'TypeScript'], roles: ['Frontend Developer'] },
  { id: 'angular', skill: 'Angular', stack: ['Angular', 'TypeScript', 'RxJS'], roles: ['Frontend Developer'] },
  { id: 'java', skill: 'Java', stack: ['Java', 'Spring', 'Kotlin'], roles: ['Backend Developer', 'Software Engineer'] },
  { id: 'golang', skill: 'Go', stack: ['Go', 'gRPC', 'Kubernetes'], roles: ['Backend Developer', 'DevOps Engineer'] },
  { id: 'rust', skill: 'Rust', stack: ['Rust', 'Systems', 'WebAssembly'], roles: ['Software Engineer'] },
  { id: 'csharp', skill: 'C#', stack: ['C#', '.NET', 'Azure'], roles: ['Software Engineer', 'Backend Developer'] },
  { id: 'ruby', skill: 'Ruby', stack: ['Ruby', 'Rails', 'PostgreSQL'], roles: ['Backend Developer', 'Full Stack Developer'] },
  { id: 'php', skill: 'PHP', stack: ['PHP', 'Laravel', 'MySQL'], roles: ['Backend Developer', 'Full Stack Developer'] },
  { id: 'swift', skill: 'Swift', stack: ['Swift', 'iOS', 'SwiftUI'], roles: ['Mobile Developer'] },
  { id: 'kotlin', skill: 'Kotlin', stack: ['Kotlin', 'Android', 'Jetpack'], roles: ['Mobile Developer'] },
  { id: 'flutter', skill: 'Flutter', stack: ['Flutter', 'Dart', 'Firebase'], roles: ['Mobile Developer'] },
  { id: 'react-native', skill: 'React Native', stack: ['React Native', 'TypeScript', 'Expo'], roles: ['Mobile Developer'] },
  { id: 'aws', skill: 'AWS', stack: ['AWS', 'Lambda', 'S3'], roles: ['DevOps Engineer', 'Cloud Architect'] },
  { id: 'azure', skill: 'Azure', stack: ['Azure', 'ARM', 'AKS'], roles: ['Cloud Architect', 'DevOps Engineer'] },
  { id: 'gcp', skill: 'Google Cloud', stack: ['GCP', 'BigQuery', 'GKE'], roles: ['Cloud Architect', 'Data Engineer'] },
  { id: 'kubernetes', skill: 'Kubernetes', stack: ['Kubernetes', 'Docker', 'Helm'], roles: ['DevOps Engineer', 'SRE'] },
  { id: 'terraform', skill: 'Terraform', stack: ['Terraform', 'IaC', 'AWS'], roles: ['DevOps Engineer', 'Cloud Architect'] },
  { id: 'docker', skill: 'Docker', stack: ['Docker', 'CI/CD', 'Linux'], roles: ['DevOps Engineer', 'Backend Developer'] },
  { id: 'postgresql', skill: 'PostgreSQL', stack: ['PostgreSQL', 'SQL', 'Redis'], roles: ['Backend Developer', 'Data Engineer'] },
  { id: 'mongodb', skill: 'MongoDB', stack: ['MongoDB', 'Node.js', 'Atlas'], roles: ['Backend Developer', 'Full Stack Developer'] },
  { id: 'graphql', skill: 'GraphQL', stack: ['GraphQL', 'Apollo', 'Node.js'], roles: ['Backend Developer', 'Full Stack Developer'] },
  { id: 'machine-learning', skill: 'Machine Learning', stack: ['Python', 'PyTorch', 'scikit-learn'], roles: ['Data Scientist', 'ML Engineer'] },
  { id: 'pytorch', skill: 'PyTorch', stack: ['PyTorch', 'Python', 'CUDA'], roles: ['ML Engineer', 'Data Scientist'] },
  { id: 'tensorflow', skill: 'TensorFlow', stack: ['TensorFlow', 'Python', 'Keras'], roles: ['ML Engineer', 'Data Scientist'] },
  { id: 'llm', skill: 'LLM Engineering', stack: ['LLMs', 'RAG', 'Python'], roles: ['ML Engineer', 'Software Engineer'] },
  { id: 'data-engineering', skill: 'Data Engineering', stack: ['Spark', 'Airflow', 'dbt'], roles: ['Data Engineer', 'Backend Developer'] },
  { id: 'sql', skill: 'SQL', stack: ['SQL', 'PostgreSQL', 'Analytics'], roles: ['Data Analyst', 'Backend Developer'] },
  { id: 'tableau', skill: 'Tableau', stack: ['Tableau', 'SQL', 'BI'], roles: ['Data Analyst', 'Business Analyst'] },
  { id: 'figma', skill: 'Figma', stack: ['Figma', 'Design Systems', 'Prototyping'], roles: ['Product Designer', 'UX Designer'] },
  { id: 'ux-research', skill: 'UX Research', stack: ['User Research', 'Figma', 'Usability Testing'], roles: ['UX Designer', 'Product Designer'] },
  { id: 'product-management', skill: 'Product Management', stack: ['Roadmaps', 'Discovery', 'Metrics'], roles: ['Product Manager'] },
  { id: 'agile', skill: 'Agile', stack: ['Scrum', 'Kanban', 'Jira'], roles: ['Project Manager', 'Product Manager'] },
  { id: 'salesforce', skill: 'Salesforce', stack: ['Salesforce', 'CRM', 'Apex'], roles: ['Account Executive', 'Business Analyst'] },
  { id: 'hubspot', skill: 'HubSpot', stack: ['HubSpot', 'CRM', 'Marketing Automation'], roles: ['Marketing Manager', 'SDR'] },
  { id: 'seo', skill: 'SEO', stack: ['Technical SEO', 'Content Strategy', 'Analytics'], roles: ['SEO Specialist', 'Content Writer'] },
  { id: 'content-marketing', skill: 'Content Marketing', stack: ['SEO Writing', 'Newsletters', 'Analytics'], roles: ['Content Writer', 'Marketing Manager'] },
  { id: 'growth-marketing', skill: 'Growth Marketing', stack: ['Experimentation', 'Analytics', 'Paid Social'], roles: ['Marketing Manager'] },
  { id: 'copywriting', skill: 'Copywriting', stack: ['B2B SaaS', 'Email', 'Landing Pages'], roles: ['Content Writer', 'Marketing Manager'] },
  { id: 'customer-success', skill: 'Customer Success', stack: ['Retention', 'Onboarding', 'QBRs'], roles: ['Customer Success Manager'] },
  { id: 'technical-writing', skill: 'Technical Writing', stack: ['Docs', 'API Reference', 'Developer Experience'], roles: ['Content Writer', 'Developer Advocate'] },
  { id: 'cybersecurity', skill: 'Cybersecurity', stack: ['SIEM', 'Cloud Security', 'Incident Response'], roles: ['Cybersecurity Analyst'] },
  { id: 'blockchain', skill: 'Blockchain', stack: ['Solidity', 'Web3', 'Ethereum'], roles: ['Software Engineer'] },
  { id: 'game-dev', skill: 'Game Development', stack: ['Unity', 'C#', 'Unreal'], roles: ['Software Engineer'] },
  { id: 'qa-automation', skill: 'QA Automation', stack: ['Playwright', 'Cypress', 'CI'], roles: ['QA Engineer'] },
  { id: 'support-engineering', skill: 'Support Engineering', stack: ['Debugging', 'APIs', 'Customer Support'], roles: ['Customer Success Manager', 'Software Engineer'] },
  { id: 'devrel', skill: 'Developer Relations', stack: ['Community', 'Content', 'APIs'], roles: ['Developer Advocate', 'Marketing Manager'] },
  { id: 'finance-fpa', skill: 'FP&A', stack: ['Financial Modeling', 'Excel', 'Reporting'], roles: ['Finance Manager'] },
  { id: 'accounting', skill: 'Accounting', stack: ['QuickBooks', 'Reconciliation', 'Payroll'], roles: ['Accountant'] },
  { id: 'hr-people-ops', skill: 'People Ops', stack: ['HRIS', 'Policy', 'Recruiting Ops'], roles: ['HR Manager', 'Recruiter'] },
  { id: 'recruiting', skill: 'Technical Recruiting', stack: ['Sourcing', 'ATS', 'Closing'], roles: ['Recruiter'] },
  { id: 'virtual-assistant', skill: 'Virtual Assistant', stack: ['Calendar', 'Inbox', 'CRM'], roles: ['Virtual Assistant'] },
  { id: 'project-coordination', skill: 'Project Coordination', stack: ['Asana', 'Notion', 'Stakeholders'], roles: ['Project Manager', 'Virtual Assistant'] },
  { id: 'business-analysis', skill: 'Business Analysis', stack: ['Requirements', 'SQL', 'Process Mapping'], roles: ['Business Analyst'] },
  { id: 'no-code', skill: 'No-Code', stack: ['Webflow', 'Zapier', 'Airtable'], roles: ['Product Designer', 'Marketing Manager'] },
  { id: 'wordpress', skill: 'WordPress', stack: ['WordPress', 'PHP', 'SEO'], roles: ['Content Writer', 'Frontend Developer'] },
];

function buildSkillSpec(topic: SkillTopic): EvergreenSpec {
  const slug = `2026-07-01-remote-${topic.id}-jobs`;
  const title = `Remote ${topic.skill} Jobs: How to Find Roles in 2026`;
  const stack = topic.stack.slice(0, 3).join(', ');

  return {
    slug,
    title,
    seoTitle: `Remote ${topic.skill} Jobs (2026) | Find & Apply | HireSchema`,
    seoDescription: `Find remote ${topic.skill} jobs in 2026: top boards, salary bands, portfolio tips, and daily AI matching with HireSchema.`,
    category: 'Skills & Stack',
    clusterId: 'skill-remote-jobs',
    targetKeywords: [
      `remote ${topic.skill} jobs`,
      `remote ${topic.id} developer jobs 2026`,
      `work from home ${topic.skill}`,
      ...topic.roles.map((r) => `remote ${r.toLowerCase()} ${topic.skill}`),
    ],
    tags: [topic.skill, 'remote jobs', '2026', 'skills', 'HireSchema'],
    publishedAt: new Date().toISOString(),
    directAnswer: `The best way to find remote ${topic.skill} jobs in 2026 is to lead with ${stack} proof on your resume and portfolio, target remote-first employers hiring ${topic.roles[0]} roles, and apply within 48 hours of posting. HireSchema ranks daily remote matches to your full resume — not keyword title games. Free: 1/day. Pro: 10/day.`,
    sections: [
      { heading: `Where Remote ${topic.skill} Jobs Are Posted`, intro: `${topic.skill} roles appear on both general and specialist channels.`, bullets: ['Remote OK, We Work Remotely, Himalayas — filter by stack keywords.', 'Company career pages for remote-first product teams.', 'Wellfound for startup density.', 'HireSchema Scout — daily validated matches ranked to resume.', 'Communities where ' + topic.skill + ' engineers share leads.'], close: 'Track reply rate by channel monthly.' },
      { heading: 'Portfolio and Resume for ' + topic.skill, intro: 'Proof beats buzzwords in 2026 remote hiring.', bullets: [`Highlight ${stack} with measurable outcomes.`, 'Link GitHub, live demos, or case studies.', 'Mirror job description keywords in summary — not body stuffing.', 'Include async collaboration examples.', 'Keep resume scannable in plain text ATS view.'], close: 'One strong portfolio project can outweigh ten weak bullets.' },
      { heading: 'Salary Benchmarks', intro: `Remote ${topic.skill} compensation varies by seniority and employer region.`, bullets: ['Global USD bands often exceed local market for senior ICs.', 'Contractor rates differ from W2 — model tax impact.', 'Equity-heavy startup offers need cash runway analysis.', 'Negotiate on scope and level — not title alone.', 'Ask about stipends and learning budgets.'], close: 'Compare total compensation, not headline salary.' },
      { heading: 'Interview Preparation', intro: `${topic.skill} remote loops test depth and communication.`, bullets: ['Prepare live coding or system design if role is engineering-heavy.', 'Have async writing sample ready (RFC, doc, PR description).', 'Test AV setup before video rounds.', 'Ask about on-call and timezone overlap.', 'Send thank-you with one additional proof link.'], close: 'Remote interviews reward clarity — practice concise explanations.' },
      { heading: 'Use HireSchema for Daily ' + topic.skill + ' Matches', intro: 'Reduce scroll time with validated delivery.', bullets: ['Scout scores fit using full resume — critical for ' + topic.skill + ' stacks.', 'Dismiss noise to train the learning loop.', 'Apply only to high-fit matches each week.', 'Pro: tailoring and interview prep per role.', 'Start free: https://hireschema.com/login'], close: 'Compare Scout vs manual search for 14 days.' },
    ],
    definitions: [
      { term: topic.skill, definition: `Core technology for ${topic.roles.join(' and ')} remote roles.` },
      { term: 'Remote-first', definition: 'Company designed for distributed teams by default.' },
      { term: 'HireSchema', definition: 'AI remote job matching with daily personalized alerts.' },
    ],
    salaryRows: [
      { role: topic.roles[0] + ' (' + topic.skill + ')', median: '$140,000', range: '$110k–$175k', region: 'Global USD' },
      { role: topic.roles[1] ?? topic.roles[0], median: '$130,000', range: '$100k–$165k', region: 'Global USD' },
      { role: 'Software Engineer (Remote)', median: '$145,000', range: '$118k–$185k', region: 'Benchmark' },
    ],
    trends: [
      { trend: `${topic.skill} remote demand`, impact: `${stack} remains top filter on job boards.`, timeframe: '2026' },
      { trend: 'Skills verification', impact: 'Portfolios and assessments outweigh pedigree.', timeframe: '2026' },
      { trend: 'AI job matching', impact: 'Seekers shift from browse to curated alerts.', timeframe: '2026' },
    ],
    comparisonHeaders: ['Channel', 'Signal', 'Effort'],
    comparisonRows: [
      ['Generic boards', 'High volume, noisy', 'High'],
      ['Target employers', 'High fit', 'Medium'],
      ['HireSchema Scout', 'Validated daily matches', 'Low'],
      ['Referrals', 'Highest conversion', 'Medium'],
    ],
    faq: [
      { question: `Are remote ${topic.skill} jobs still hiring in 2026?`, answer: `Yes — ${topic.skill} remains active on remote-first teams, especially for ${topic.roles[0]} roles with proven ${stack} experience.` },
      { question: 'Do I need a degree?', answer: 'Portfolio and proof of work often outweigh formal credentials for remote tech roles.' },
      { question: 'How does HireSchema match ' + topic.skill + ' roles?', answer: 'Scout scores listings against your full resume and skills — not just job title keywords.' },
      { question: 'Contractor or full-time?', answer: 'Both exist remotely — confirm employment type, timezone, and currency before accepting.' },
    ],
  };
}

export function buildAllSkillSpecs(): EvergreenSpec[] {
  return SKILL_TOPICS.map(buildSkillSpec);
}

export const SKILLS_SPECS = buildAllSkillSpecs();
