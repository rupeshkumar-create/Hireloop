#!/usr/bin/env npx tsx
/**
 * Seed all 500 programmatic posts in batches, then backfill internal links.
 *
 * Usage:
 *   npx tsx scripts/seed-all-batches.ts
 *   npx tsx scripts/seed-all-batches.ts --batch-size=50
 *   npx tsx scripts/seed-all-batches.ts --force
 */
import './load-env.js';
import { assertSeedEnv } from './load-env.js';
import { seedProgrammaticLibrary } from '../src/server/contentGrowth/seedProgrammaticLibrary.js';
import { backfillAllPostInternalLinks } from '../src/server/contentGrowth/enrichPostLinks.js';
import { TARGET_PROGRAMMATIC_COUNT } from '../src/server/contentGrowth/programmatic/catalog.js';

const force = process.argv.includes('--force');
const batchSizeArg = process.argv.find((a) => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? Number(batchSizeArg.split('=')[1]) : 100;

async function main() {
  assertSeedEnv();

  const totals = { created: 0, skipped: 0, errors: 0 };
  const batchCount = Math.ceil(TARGET_PROGRAMMATIC_COUNT / BATCH_SIZE);

  console.log(`[seed-all-batches] Starting ${batchCount} batches (size ${BATCH_SIZE}, total ${TARGET_PROGRAMMATIC_COUNT})`);

  for (let i = 0; i < batchCount; i++) {
    const offset = i * BATCH_SIZE;
    console.log(`\n[seed-all-batches] Batch ${i + 1}/${batchCount} — offset=${offset} limit=${BATCH_SIZE}`);
    const result = await seedProgrammaticLibrary({ force, offset, limit: BATCH_SIZE });
    console.log(result.message);
    console.log(`  created=${result.created.length} skipped=${result.skipped.length} errors=${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log('  first errors:', result.errors.slice(0, 3));
    }
    totals.created += result.created.length;
    totals.skipped += result.skipped.length;
    totals.errors += result.errors.length;
  }

  console.log('\n[seed-all-batches] Running internal link backfill…');
  const backfill = await backfillAllPostInternalLinks({ limit: 500 });
  console.log(`[seed-all-batches] Backfill updated ${backfill.updated.length} posts`);

  console.log('\n[seed-all-batches] Done.', totals);
  process.exit(totals.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
