#!/usr/bin/env npx tsx
/** Seed full 500-post programmatic library. Usage: npx tsx scripts/seed-all-posts.ts [--force] [--offset N] [--limit N] */
import './load-env.js';
import { seedProgrammaticLibrary } from '../src/server/contentGrowth/seedProgrammaticLibrary.js';

const force = process.argv.includes('--force');
const offsetArg = process.argv.find((a) => a.startsWith('--offset='));
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const offset = offsetArg ? Number(offsetArg.split('=')[1]) : 0;
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

seedProgrammaticLibrary({ force, offset, limit })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.seeded || result.skipped.length > 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
