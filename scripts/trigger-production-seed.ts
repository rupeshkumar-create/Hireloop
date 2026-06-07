#!/usr/bin/env npx tsx
/**
 * Trigger seed batches on production Vercel (uses real Firebase secrets server-side).
 *
 * Usage:
 *   npx vercel env run --environment=production -- npx tsx scripts/trigger-production-seed.ts
 */
const BASE = process.env.SEED_BASE_URL || 'https://www.hireschema.com';
const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE || 50);
const TOTAL = Number(process.env.SEED_TOTAL || 500);

async function runBatch(offset: number, limit: number, backfill: boolean): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET missing — use: npx vercel env run --environment=production -- ...');

  const url = new URL(`${BASE}/api/cron/seed-library`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  if (backfill) url.searchParams.set('backfill', 'true');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
  }

  console.log(
    `[batch offset=${offset}] created=${body.created?.length ?? 0} ` +
      `skipped=${body.skipped?.length ?? 0} errors=${body.errors?.length ?? 0} ` +
      (backfill ? `backfill=${body.backfillUpdated ?? 0}` : '')
  );
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    console.log('  errors:', body.errors.slice(0, 2));
  }
}

async function main() {
  const batchCount = Math.ceil(TOTAL / BATCH_SIZE);
  console.log(`Seeding ${TOTAL} posts in ${batchCount} batches of ${BATCH_SIZE} via ${BASE}`);

  for (let i = 0; i < batchCount; i++) {
    const offset = i * BATCH_SIZE;
    const isLast = i === batchCount - 1;
    await runBatch(offset, BATCH_SIZE, isLast);
    if (i < batchCount - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log('All batches complete.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
