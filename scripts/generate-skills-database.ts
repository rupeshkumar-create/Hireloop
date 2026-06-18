/**
 * Generates src/lib/skillsDatabase/skills.json (~5000 canonical skills).
 * Run: npm run generate:skills
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../src/lib/skillsDatabase/skills.json');
const TARGET_COUNT = 5000;

type SkillCategory =
  | 'language'
  | 'framework'
  | 'library'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'data'
  | 'ml'
  | 'design'
  | 'product'
  | 'marketing'
  | 'sales'
  | 'support'
  | 'finance'
  | 'hr'
  | 'soft'
  | 'tool'
  | 'methodology'
  | 'certification'
  | 'domain';

interface SkillSeed {
  name: string;
  aliases?: string[];
  category: SkillCategory;
  roles?: string[];
}

interface SkillEntry {
  id: string;
  name: string;
  aliases: string[];
  category: SkillCategory;
  roles: string[];
  searchTerms: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const ROLE_BUCKETS: Record<string, string[]> = {
  software: ['Software Engineer', 'Full Stack Developer', 'Backend Developer'],
  frontend: ['Frontend Developer', 'UI Engineer'],
  mobile: ['Mobile Developer', 'iOS Developer'],
  data: ['Data Scientist', 'Data Engineer', 'Data Analyst'],
  ml: ['ML Engineer', 'AI Engineer'],
  devops: ['DevOps Engineer', 'SRE', 'Platform Engineer'],
  product: ['Product Manager', 'Product Owner'],
  design: ['UX Designer', 'Product Designer', 'UI Designer'],
  marketing: ['Marketing Manager', 'Growth Marketer', 'Content Writer'],
  sales: ['Account Executive', 'SDR', 'Sales Manager'],
  support: ['Customer Support', 'Customer Support Specialist', 'Technical Support'],
  finance: ['Accountant', 'Financial Analyst', 'FP&A Analyst'],
  hr: ['Recruiter', 'HR Manager', 'People Ops'],
  pm: ['Project Manager', 'Program Manager'],
  qa: ['QA Engineer', 'SDET'],
  security: ['Security Engineer', 'Cybersecurity Analyst'],
};

// ── Core seeds (expanded programmatically below) ─────────────────────────────

const LANGUAGE_SEEDS: SkillSeed[] = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Kotlin', 'Swift', 'Go', 'Rust', 'Ruby', 'PHP',
  'C#', 'C++', 'Scala', 'Elixir', 'Clojure', 'Haskell', 'R', 'MATLAB', 'Perl', 'Lua',
  'Dart', 'Objective-C', 'Shell', 'Bash', 'PowerShell', 'SQL', 'HTML', 'CSS', 'Solidity', 'VBA',
].map((name) => ({ name, category: 'language' as const, roles: ROLE_BUCKETS.software }));

const FRAMEWORK_SEEDS: SkillSeed[] = [
  'React', 'Next.js', 'Vue.js', 'Nuxt', 'Angular', 'Svelte', 'Remix', 'Gatsby', 'Node.js', 'Express',
  'NestJS', 'Fastify', 'Django', 'FastAPI', 'Flask', 'Spring Boot', 'Ruby on Rails', 'Laravel', 'ASP.NET', 'Symfony',
  'Flutter', 'React Native', 'SwiftUI', 'Jetpack Compose', '.NET MAUI', 'Electron', 'Tauri',
  'Tailwind CSS', 'Bootstrap', 'Material UI', 'Chakra UI', 'Shadcn UI', 'Redux', 'Zustand', 'TanStack Query',
  'GraphQL', 'REST API', 'gRPC', 'WebSockets', 'Apache Kafka', 'RabbitMQ',
].map((name) => ({
  name,
  category: 'framework' as const,
  roles: [...ROLE_BUCKETS.software, ...ROLE_BUCKETS.frontend],
}));

const DATABASE_SEEDS: SkillSeed[] = [
  'PostgreSQL', 'MySQL', 'MariaDB', 'SQLite', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB',
  'Cassandra', 'CouchDB', 'Neo4j', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'ClickHouse',
  'Supabase', 'Firebase', 'PlanetScale', 'CockroachDB', 'TimescaleDB', 'InfluxDB',
].map((name) => ({ name, category: 'database' as const, roles: ROLE_BUCKETS.data }));

const CLOUD_DEVOPS_SEEDS: SkillSeed[] = [
  'AWS', 'Amazon EC2', 'AWS Lambda', 'Amazon S3', 'Amazon RDS', 'AWS ECS', 'AWS EKS', 'CloudFormation',
  'Google Cloud', 'GCP', 'Google Kubernetes Engine', 'Azure', 'Microsoft Azure', 'Azure DevOps',
  'Kubernetes', 'Docker', 'Terraform', 'Pulumi', 'Ansible', 'Chef', 'Puppet', 'Helm', 'Argo CD',
  'GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI', 'Travis CI', 'Bitbucket Pipelines',
  'Linux', 'Ubuntu', 'Nginx', 'Apache', 'HAProxy', 'Prometheus', 'Grafana', 'Datadog', 'New Relic',
  'Splunk', 'PagerDuty', 'Cloudflare', 'Vercel', 'Netlify', 'Heroku', 'Fly.io', 'Railway',
].map((name) => ({ name, category: 'devops' as const, roles: [...ROLE_BUCKETS.devops, ...ROLE_BUCKETS.software] }));

const DATA_ML_SEEDS: SkillSeed[] = [
  'Machine Learning', 'Deep Learning', 'Natural Language Processing', 'Computer Vision', 'LLM',
  'RAG', 'Prompt Engineering', 'PyTorch', 'TensorFlow', 'Keras', 'scikit-learn', 'XGBoost',
  'Hugging Face', 'LangChain', 'OpenAI API', 'Anthropic API', 'Pandas', 'NumPy', 'SciPy',
  'Apache Spark', 'Apache Airflow', 'dbt', 'Fivetran', 'Airbyte', 'Looker', 'Tableau', 'Power BI',
  'Metabase', 'Mode Analytics', 'Amplitude', 'Mixpanel', 'Segment', 'Heap', 'Google Analytics',
  'A/B Testing', 'Experimentation', 'Statistical Analysis', 'ETL', 'Data Modeling', 'Data Warehousing',
].map((name) => ({ name, category: 'data' as const, roles: [...ROLE_BUCKETS.data, ...ROLE_BUCKETS.ml] }));

const DESIGN_PRODUCT_SEEDS: SkillSeed[] = [
  'Figma', 'Sketch', 'Adobe XD', 'Framer', 'InVision', 'Zeplin', 'Design Systems', 'UI Design',
  'UX Design', 'UX Research', 'Usability Testing', 'Wireframing', 'Prototyping', 'Information Architecture',
  'Product Discovery', 'Product Strategy', 'Roadmapping', 'OKRs', 'User Stories', 'Backlog Grooming',
  'Jira', 'Linear', 'Asana', 'Notion', 'Confluence', 'Miro', 'FigJam', 'Product Analytics',
].map((name) => ({
  name,
  category: name.includes('Product') || name.includes('OKR') || name.includes('Roadmap') ? 'product' : 'design',
  roles: name.includes('Product') ? ROLE_BUCKETS.product : ROLE_BUCKETS.design,
}));

const MARKETING_SALES_SEEDS: SkillSeed[] = [
  'SEO', 'Technical SEO', 'Content Marketing', 'Copywriting', 'Email Marketing', 'Marketing Automation',
  'HubSpot', 'Marketo', 'Pardot', 'Mailchimp', 'Klaviyo', 'Google Ads', 'Meta Ads', 'LinkedIn Ads',
  'Paid Search', 'Paid Social', 'Growth Marketing', 'Demand Generation', 'Brand Marketing',
  'Salesforce CRM', 'Salesforce', 'Outreach', 'Salesloft', 'Apollo.io', 'ZoomInfo', 'Cold Calling',
  'B2B Sales', 'SaaS Sales', 'Account Management', 'Pipeline Management', 'CRM', 'Lead Generation',
  'Social Media Marketing', 'Community Management', 'Influencer Marketing', 'Affiliate Marketing',
].map((name) => ({
  name,
  category: name.toLowerCase().includes('sales') || ['CRM', 'Outreach', 'Apollo.io'].includes(name) ? 'sales' : 'marketing',
  roles: name.toLowerCase().includes('sales') ? ROLE_BUCKETS.sales : ROLE_BUCKETS.marketing,
}));

const SUPPORT_SEEDS: SkillSeed[] = [
  'Customer Support', 'Technical Support', 'Help Desk', 'Zendesk', 'Intercom', 'Freshdesk', 'ServiceNow',
  'ITIL', 'Ticket Triage', 'SLA Management', 'Customer Success', 'Client Onboarding', 'Account Retention',
  'Churn Reduction', 'QBR', 'Escalation Management', 'Live Chat Support', 'Phone Support', 'Email Support',
  'Knowledge Base', 'Support Documentation', 'Bug Triage', 'API Troubleshooting', 'Incident Communication',
  'Customer Empathy', 'De-escalation', 'CRM Support', 'SaaS Support', 'B2B Support', 'Tier 1 Support', 'Tier 2 Support',
].map((name) => ({ name, category: 'support' as const, roles: ROLE_BUCKETS.support }));

const FINANCE_HR_SEEDS: SkillSeed[] = [
  'Financial Modeling', 'FP&A', 'Budgeting', 'Forecasting', 'Variance Analysis', 'QuickBooks', 'Xero',
  'NetSuite', 'SAP', 'Oracle Financials', 'Accounts Payable', 'Accounts Receivable', 'Payroll',
  'Tax Compliance', 'GAAP', 'IFRS', 'Audit', 'Bookkeeping', 'Excel', 'Google Sheets',
  'Technical Recruiting', 'Sourcing', 'ATS', 'Greenhouse', 'Lever', 'Workday', 'BambooHR', 'Gusto',
  'People Operations', 'Employee Relations', 'Compensation', 'Benefits Administration', 'Onboarding',
].map((name) => ({
  name,
  category: ['Technical Recruiting', 'ATS', 'People Operations', 'Greenhouse', 'Lever', 'Workday', 'BambooHR', 'Gusto', 'Onboarding', 'Employee Relations', 'Compensation', 'Benefits Administration', 'Sourcing'].some((k) => name.includes(k)) ? 'hr' : 'finance',
  roles: name.includes('Recruit') || name.includes('HR') || name.includes('People') ? ROLE_BUCKETS.hr : ROLE_BUCKETS.finance,
}));

const METHODOLOGY_SOFT_SEEDS: SkillSeed[] = [
  'Agile', 'Scrum', 'Kanban', 'SAFe', 'Lean', 'Waterfall', 'DevOps Culture', 'CI/CD', 'TDD', 'BDD',
  'Code Review', 'Pair Programming', 'System Design', 'Microservices', 'Event-Driven Architecture',
  'Domain-Driven Design', 'SOLID Principles', 'Communication', 'Leadership', 'Stakeholder Management',
  'Cross-functional Collaboration', 'Remote Collaboration', 'Async Communication', 'Documentation',
  'Problem Solving', 'Critical Thinking', 'Time Management', 'Presentation Skills', 'Negotiation',
].map((name) => ({
  name,
  category: ['Communication', 'Leadership', 'Problem Solving', 'Critical Thinking', 'Time Management', 'Presentation Skills', 'Negotiation', 'Remote Collaboration', 'Async Communication'].includes(name) ? 'soft' : 'methodology',
  roles: [...ROLE_BUCKETS.software, ...ROLE_BUCKETS.pm],
}));

const TOOL_SEEDS: SkillSeed[] = [
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'VS Code', 'IntelliJ IDEA', 'PyCharm', 'WebStorm', 'Xcode',
  'Android Studio', 'Postman', 'Insomnia', 'Swagger', 'OpenAPI', 'Jest', 'Vitest', 'Cypress', 'Playwright',
  'Selenium', 'JUnit', 'pytest', 'Mocha', 'Webpack', 'Vite', 'Rollup', 'esbuild', 'Babel', 'ESLint',
  'Prettier', 'SonarQube', 'Sentry', 'LogRocket', 'Hotjar', 'FullStory', 'Zapier', 'Make', 'Airtable',
  'Webflow', 'WordPress', 'Shopify', 'Stripe', 'Twilio', 'SendGrid', 'Auth0', 'Okta', '1Password',
].map((name) => ({ name, category: 'tool' as const, roles: ROLE_BUCKETS.software }));

const DOMAIN_SEEDS: SkillSeed[] = [
  'E-commerce', 'Fintech', 'Healthtech', 'Edtech', 'SaaS', 'B2B', 'B2C', 'Marketplace', 'AdTech',
  'Insurtech', 'Proptech', 'Legaltech', 'Gaming', 'Cybersecurity', 'Blockchain', 'Web3', 'IoT',
  'Automotive', 'Aerospace', 'Retail', 'Logistics', 'Supply Chain', 'Manufacturing', 'Telecommunications',
  'Media', 'Publishing', 'Hospitality', 'Travel', 'Real Estate', 'Energy', 'Climate Tech', 'AgTech',
  'Biotech', 'Pharma', 'Government', 'Nonprofit', 'Consulting', 'Agency', 'Startup', 'Enterprise',
].map((name) => ({ name, category: 'domain' as const, roles: [...ROLE_BUCKETS.software, ...ROLE_BUCKETS.product] }));

const CERT_SEEDS: SkillSeed[] = [
  'AWS Certified Solutions Architect', 'AWS Certified Developer', 'AWS Certified SysOps',
  'Google Professional Cloud Architect', 'Azure Administrator', 'Azure Solutions Architect',
  'Certified Kubernetes Administrator', 'CKA', 'CKAD', 'Terraform Associate', 'PMP', 'CSM', 'PSM',
  'SAFe Agilist', 'ITIL Foundation', 'CISSP', 'CompTIA Security+', 'Google Analytics Certification',
  'HubSpot Inbound', 'Salesforce Administrator', 'Salesforce Developer', 'CFA', 'CPA', 'CMA',
].map((name) => ({ name, category: 'certification' as const, roles: [...ROLE_BUCKETS.software, ...ROLE_BUCKETS.devops] }));

const INDUSTRY_TOOLS: string[] = [
  'Shopify', 'Magento', 'WooCommerce', 'BigCommerce', 'Salesforce Commerce', 'SAP Commerce',
  'Workday HCM', 'ADP', 'Rippling', 'Deel', 'Remote.com', 'Gusto Payroll', 'Carta', 'Brex',
  'Ramp', 'Mercury', 'Plaid', 'Stripe Billing', 'Chargebee', 'Recurly', 'Zuora',
  'Snowflake Analytics', 'dbt Cloud', 'Fivetran ETL', 'Hightouch', 'Census', 'Reverse ETL',
  'Gong', 'Chorus', 'Clari', 'Salesforce CPQ', 'HubSpot CRM', 'Pipedrive', 'Close CRM',
  'Gorgias', 'Kustomer', 'Gladly', 'Help Scout', 'Crisp', 'Drift', 'Qualified',
  'Canva', 'Adobe Creative Cloud', 'Photoshop', 'Illustrator', 'After Effects', 'Premiere Pro',
  'Unity', 'Unreal Engine', 'Blender', 'Maya', 'Substance Painter',
];

const SKILL_MODIFIERS = [
  'Administration', 'Architecture', 'Automation', 'Configuration', 'Deployment', 'Development',
  'Engineering', 'Implementation', 'Integration', 'Management', 'Migration', 'Monitoring',
  'Optimization', 'Administration', 'Analytics', 'Auditing', 'Consulting', 'Support', 'Testing',
  'Troubleshooting', 'Training', 'Strategy', 'Operations', 'Security', 'Compliance',
];

const SENIORITY_PREFIXES = ['Junior', 'Mid-level', 'Senior', 'Lead', 'Principal', 'Staff'];

function addSkill(map: Map<string, SkillEntry>, seed: SkillSeed, suffix = ''): void {
  const name = suffix ? `${seed.name} ${suffix}`.trim() : seed.name;
  const id = slugify(name);
  if (!id || map.has(id)) return;
  const aliases = [...new Set([...(seed.aliases || []), seed.name].filter((a) => a !== name))];
  map.set(id, {
    id,
    name,
    aliases,
    category: seed.category,
    roles: seed.roles || [],
    searchTerms: [name, ...aliases].slice(0, 4),
  });
}

function buildDatabase(): SkillEntry[] {
  const map = new Map<string, SkillEntry>();

  const allSeeds = [
    ...LANGUAGE_SEEDS,
    ...FRAMEWORK_SEEDS,
    ...DATABASE_SEEDS,
    ...CLOUD_DEVOPS_SEEDS,
    ...DATA_ML_SEEDS,
    ...DESIGN_PRODUCT_SEEDS,
    ...MARKETING_SALES_SEEDS,
    ...SUPPORT_SEEDS,
    ...FINANCE_HR_SEEDS,
    ...METHODOLOGY_SOFT_SEEDS,
    ...TOOL_SEEDS,
    ...DOMAIN_SEEDS,
    ...CERT_SEEDS,
    ...INDUSTRY_TOOLS.map((name) => ({
      name,
      category: 'tool' as const,
      roles: ROLE_BUCKETS.software,
    })),
  ];

  for (const seed of allSeeds) addSkill(map, seed);

  // Compound: Skill + modifier (e.g. "Kubernetes Administration")
  for (const seed of [...FRAMEWORK_SEEDS, ...DATABASE_SEEDS, ...CLOUD_DEVOPS_SEEDS, ...DATA_ML_SEEDS]) {
    for (const mod of SKILL_MODIFIERS) {
      addSkill(map, seed, mod);
      if (map.size >= TARGET_COUNT) break;
    }
    if (map.size >= TARGET_COUNT) break;
  }

  // Seniority + role skill combos for support/sales/marketing
  for (const seed of [...SUPPORT_SEEDS, ...MARKETING_SALES_SEEDS.slice(0, 20)]) {
    for (const prefix of SENIORITY_PREFIXES) {
      addSkill(map, seed, `(${prefix})`);
      if (map.size >= TARGET_COUNT) break;
    }
    if (map.size >= TARGET_COUNT) break;
  }

  // Stack pairings
  const stacks: [string, string][] = [
    ['React', 'TypeScript'], ['Python', 'Django'], ['Python', 'FastAPI'], ['Node.js', 'Express'],
    ['Go', 'Kubernetes'], ['Java', 'Spring Boot'], ['Ruby', 'Rails'], ['PHP', 'Laravel'],
    ['Vue.js', 'Nuxt'], ['React', 'Next.js'], ['AWS', 'Terraform'], ['GCP', 'BigQuery'],
    ['Customer Support', 'Zendesk'], ['Technical Support', 'APIs'], ['Sales', 'Salesforce'],
  ];
  for (const [a, b] of stacks) {
    const name = `${a} + ${b}`;
    const id = slugify(name);
    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        aliases: [a, b],
        category: 'domain',
        roles: [...ROLE_BUCKETS.software, ...ROLE_BUCKETS.support],
        searchTerms: [a, b],
      });
    }
  }

  // Fill remaining with numbered domain specializations
  let i = 0;
  while (map.size < TARGET_COUNT) {
    const domain = DOMAIN_SEEDS[i % DOMAIN_SEEDS.length]!;
    const tool = TOOL_SEEDS[i % TOOL_SEEDS.length]!;
    const name = `${domain.name} ${tool.name}`;
    addSkill(
      map,
      { name: domain.name, category: 'domain', roles: domain.roles },
      tool.name
    );
    i += 1;
    if (i > TARGET_COUNT * 3) break;
  }

  const entries = [...map.values()].slice(0, TARGET_COUNT);
  if (entries.length < TARGET_COUNT) {
    throw new Error(`Only generated ${entries.length} skills, expected ${TARGET_COUNT}`);
  }
  return entries;
}

const skills = buildDatabase();
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(
  OUT_PATH,
  JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      count: skills.length,
      skills,
    },
    null,
    0
  )
);

console.log(`[generate-skills-database] Wrote ${skills.length} skills to ${OUT_PATH}`);
