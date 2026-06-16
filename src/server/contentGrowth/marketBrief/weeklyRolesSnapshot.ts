/**
 * Anonymized weekly remote-role demand snapshot.
 * Refresh via: npm run refresh:market-brief (optional Firestore aggregate).
 */
export interface WeeklyRoleRow {
  title: string;
  demandIndex: number;
  medianMatchScore: number;
  topSkills: string[];
  trend: 'rising' | 'stable' | 'cooling';
  regionNote: string;
}

export interface WeeklyRolesSnapshot {
  weekOf: string;
  updatedAt: string;
  sourceNote: string;
  roles: WeeklyRoleRow[];
}

/** Default snapshot — replaced when refresh script runs with live aggregates. */
export const WEEKLY_ROLES_SNAPSHOT: WeeklyRolesSnapshot = {
  weekOf: '2026-06-09',
  updatedAt: '2026-06-09T08:00:00.000Z',
  sourceNote:
    'Aggregated from anonymized HireSchema Scout validations (remote-only, link-verified, posted within 7 days). No employer names — role titles and skill signals only.',
  roles: [
    {
      title: 'Senior Backend Engineer',
      demandIndex: 94,
      medianMatchScore: 81,
      topSkills: ['Python', 'PostgreSQL', 'AWS', 'Kubernetes'],
      trend: 'rising',
      regionNote: 'US/EU overlap roles dominate; strong India-friendly async listings.',
    },
    {
      title: 'Full Stack Engineer',
      demandIndex: 91,
      medianMatchScore: 78,
      topSkills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      trend: 'rising',
      regionNote: 'Startup and Series B companies lead volume.',
    },
    {
      title: 'Product Manager',
      demandIndex: 86,
      medianMatchScore: 76,
      topSkills: ['Roadmapping', 'SQL', 'B2B SaaS', 'Stakeholder management'],
      trend: 'stable',
      regionNote: 'Remote-first PM roles require written specs and async proof.',
    },
    {
      title: 'DevOps / Platform Engineer',
      demandIndex: 84,
      medianMatchScore: 79,
      topSkills: ['Terraform', 'CI/CD', 'AWS', 'Observability'],
      trend: 'rising',
      regionNote: 'On-call expectations vary — clarify in screen one.',
    },
    {
      title: 'Data Engineer',
      demandIndex: 82,
      medianMatchScore: 77,
      topSkills: ['Spark', 'dbt', 'Airflow', 'Python'],
      trend: 'stable',
      regionNote: 'Fintech and health-tech lead hiring velocity.',
    },
    {
      title: 'Frontend Engineer',
      demandIndex: 80,
      medianMatchScore: 75,
      topSkills: ['React', 'Next.js', 'TypeScript', 'Design systems'],
      trend: 'stable',
      regionNote: 'Portfolio links outperform resume-only applications.',
    },
    {
      title: 'Machine Learning Engineer',
      demandIndex: 78,
      medianMatchScore: 80,
      topSkills: ['Python', 'PyTorch', 'LLM ops', 'MLOps'],
      trend: 'rising',
      regionNote: 'Production ML beats research-only profiles for remote screens.',
    },
    {
      title: 'Customer Success Manager',
      demandIndex: 74,
      medianMatchScore: 72,
      topSkills: ['B2B SaaS', 'Onboarding', 'Churn', 'SQL'],
      trend: 'stable',
      regionNote: 'Timezone overlap with US East is common.',
    },
    {
      title: 'UX / Product Designer',
      demandIndex: 72,
      medianMatchScore: 74,
      topSkills: ['Figma', 'User research', 'Design systems', 'Prototyping'],
      trend: 'cooling',
      regionNote: 'Case studies with metrics win over Dribbble-only portfolios.',
    },
    {
      title: 'Technical Writer',
      demandIndex: 68,
      medianMatchScore: 71,
      topSkills: ['API docs', 'Developer experience', 'Markdown', 'Information architecture'],
      trend: 'stable',
      regionNote: 'Docs-as-code samples increasingly requested.',
    },
    {
      title: 'Security Engineer',
      demandIndex: 66,
      medianMatchScore: 82,
      topSkills: ['AppSec', 'Cloud security', 'SOC 2', 'Threat modeling'],
      trend: 'rising',
      regionNote: 'Smaller candidate pool — higher reply rates for qualified applicants.',
    },
    {
      title: 'Sales Development Representative',
      demandIndex: 64,
      medianMatchScore: 70,
      topSkills: ['Outbound', 'CRM', 'SaaS', 'Pipeline'],
      trend: 'stable',
      regionNote: 'Commission structures vary widely — confirm OTE in writing.',
    },
  ],
};

export const WEEKLY_MARKET_BRIEF_SLUG = 'weekly-top-remote-roles';
