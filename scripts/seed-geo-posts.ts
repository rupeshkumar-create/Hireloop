#!/usr/bin/env npx tsx
/** Seed GEO programmatic guides. Usage: npx tsx scripts/seed-geo-posts.ts [--force] */
import { seedGeoPosts } from '../src/server/contentGrowth/seedGeoPosts.js';

const force = process.argv.includes('--force');

seedGeoPosts({ force })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.seeded || result.skipped.length > 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
