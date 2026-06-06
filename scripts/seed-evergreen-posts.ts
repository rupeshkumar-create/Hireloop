#!/usr/bin/env npx tsx
/**
 * Seed 10 evergreen blog posts to Firestore.
 * Usage: npx tsx scripts/seed-evergreen-posts.ts [--force]
 */
import { seedEvergreenPosts } from '../src/server/contentGrowth/seedEvergreen.js';

const force = process.argv.includes('--force');

seedEvergreenPosts({ force })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.seeded || result.skipped.length > 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
