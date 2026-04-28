import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

type AtsProvider = 'greenhouse' | 'lever';

type SeedSource = {
  companyName: string;
  ats: AtsProvider;
  boardUrl: string;
  enabled?: boolean;
  remoteOnly?: boolean;
  tags?: string[];
};

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
  const serviceAccount = JSON.parse(raw);

  const apps = getApps();
  const app = apps.length ? apps[0] : initializeApp({ credential: cert(serviceAccount) });

  const dbId = (process.env.FIRESTORE_DATABASE_ID || '').trim();
  const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

  return { db };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const SEED_SOURCES: SeedSource[] = [
  { companyName: 'Stripe', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/stripe' },
  { companyName: 'Datadog', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/datadog' },
  { companyName: 'Dropbox', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/dropbox' },
  { companyName: 'Reddit', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/reddit' },
  { companyName: 'Pinterest', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/pinterest' },
  { companyName: 'Lyft', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/lyft' },
  { companyName: 'Robinhood', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/robinhood' },
  { companyName: 'Coinbase', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/coinbase' },
  { companyName: 'Twilio', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/twilio' },
  { companyName: 'Plaid', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/plaid' },
  { companyName: 'Patreon', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/patreon' },
  { companyName: 'DoorDash', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/doordash' },
  { companyName: 'Affirm', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/affirm' },
  { companyName: 'Duolingo', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/duolingo' },
  { companyName: 'Snowflake', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/snowflakecomputing' },
  { companyName: 'Elastic', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/elastic' },
  { companyName: 'Sentry', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/sentry' },
  { companyName: 'Figma', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/figma' },
  { companyName: 'Airtable', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/airtable' },
  { companyName: 'Gusto', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/gusto' },
  { companyName: 'Intercom', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/intercom' },
  { companyName: 'Asana', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/asana' },
  { companyName: 'Okta', ats: 'greenhouse', boardUrl: 'https://boards.greenhouse.io/okta' },
  { companyName: 'Notion', ats: 'lever', boardUrl: 'https://jobs.lever.co/notion' },
  { companyName: 'Vercel', ats: 'lever', boardUrl: 'https://jobs.lever.co/vercel' },
  { companyName: 'HashiCorp', ats: 'lever', boardUrl: 'https://jobs.lever.co/hashicorp' },
  { companyName: 'Scale AI', ats: 'lever', boardUrl: 'https://jobs.lever.co/scaleai' },
  { companyName: 'Brex', ats: 'lever', boardUrl: 'https://jobs.lever.co/brex' },
  { companyName: 'Ramp', ats: 'lever', boardUrl: 'https://jobs.lever.co/ramp' },
  { companyName: 'Retool', ats: 'lever', boardUrl: 'https://jobs.lever.co/retool' },
  { companyName: 'Algolia', ats: 'lever', boardUrl: 'https://jobs.lever.co/algolia' },
  { companyName: 'ClickUp', ats: 'lever', boardUrl: 'https://jobs.lever.co/clickup' },
  { companyName: 'Postman', ats: 'lever', boardUrl: 'https://jobs.lever.co/postman' },
  { companyName: 'Webflow', ats: 'lever', boardUrl: 'https://jobs.lever.co/webflow' },
  { companyName: 'Aledade', ats: 'lever', boardUrl: 'https://jobs.lever.co/aledade' },
  { companyName: 'Anduril', ats: 'lever', boardUrl: 'https://jobs.lever.co/anduril' },
  { companyName: 'Attentive', ats: 'lever', boardUrl: 'https://jobs.lever.co/attentive' },
  { companyName: 'Benchling', ats: 'lever', boardUrl: 'https://jobs.lever.co/benchling' },
  { companyName: 'Fivetran', ats: 'lever', boardUrl: 'https://jobs.lever.co/fivetran' },
  { companyName: 'Hopin', ats: 'lever', boardUrl: 'https://jobs.lever.co/hopin' },
  { companyName: 'Lattice', ats: 'lever', boardUrl: 'https://jobs.lever.co/lattice' },
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
  const { db } = initAdmin();
  const now = new Date().toISOString();
  const collection = db.collection('job_sources');

  let count = 0;
  for (const source of SEED_SOURCES) {
    const id = `${source.ats}_${slugify(source.companyName)}`;
    await collection.doc(id).set(
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
      { merge: true }
    );
    count++;
  }

  console.log(`Seeded ${count} ATS sources into job_sources`);
}

upsertSources().catch((err) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});

