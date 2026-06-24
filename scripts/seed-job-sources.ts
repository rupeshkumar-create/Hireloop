import './load-env.ts';
import { setDoc } from '../src/server/db/docStore.js';

type AtsProvider = 'greenhouse' | 'lever';

type SeedSource = {
  companyName: string;
  ats: AtsProvider;
  boardUrl: string;
  enabled?: boolean;
  remoteOnly?: boolean;
  tags?: string[];
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const SEED_SOURCES: SeedSource[] = [
  { companyName: 'Airbnb', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/airbnb' },
  { companyName: 'Coinbase', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/coinbase' },
  { companyName: 'Discord', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/discord' },
  { companyName: 'Figma', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/figma' },
  { companyName: 'GitLab', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/gitlab' },
  { companyName: 'Notion', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/notion' },
  { companyName: 'Reddit', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/reddit' },
  { companyName: 'Stripe', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/stripe' },
  { companyName: 'Airtable', ats: 'lever', boardUrl: 'https://jobs.lever.co/airtable' },
  { companyName: 'Canva', ats: 'lever', boardUrl: 'https://jobs.lever.co/canva' },
  { companyName: 'Miro', ats: 'lever', boardUrl: 'https://jobs.lever.co/miro' },
  { companyName: 'Monday.com', ats: 'lever', boardUrl: 'https://jobs.lever.co/monday' },
  { companyName: 'Nuro', ats: 'lever', boardUrl: 'https://jobs.lever.co/nuro' },
  { companyName: 'PagerDuty', ats: 'lever', boardUrl: 'https://jobs.lever.co/pagerduty' },
  { companyName: 'Segment', ats: 'lever', boardUrl: 'https://jobs.lever.co/segment' },
  { companyName: 'Snyk', ats: 'lever', boardUrl: 'https://jobs.lever.co/snyk' },
  { companyName: 'Samsara', ats: 'lever', boardUrl: 'https://jobs.lever.co/samsara' },
  { companyName: 'Zapier', ats: 'lever', boardUrl: 'https://jobs.lever.co/zapier' },
];

async function upsertSources() {
  const now = new Date().toISOString();

  let count = 0;
  for (const source of SEED_SOURCES) {
    const id = `${source.ats}_${slugify(source.companyName)}`;
    await setDoc(
      'job_sources',
      id,
      {
        companyName: source.companyName,
        ats: source.ats,
        boardUrl: source.boardUrl,
        enabled: source.enabled !== false,
        remoteOnly: source.remoteOnly !== false,
        tags: source.tags || [],
        updatedAt: now,
        createdAt: now,
      },
      true,
    );
    count++;
  }

  console.log(`Seeded ${count} job_sources documents.`);
}

upsertSources().catch((err) => {
  console.error(err);
  process.exit(1);
});
