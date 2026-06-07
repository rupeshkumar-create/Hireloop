#!/usr/bin/env npx tsx
/**
 * Seed 25 competitor alternative blog posts to Firestore.
 * Usage: npx tsx scripts/seed-competitor-posts.ts [--force]
 */
import { seedCompetitorPosts } from '../src/server/contentGrowth/seedCompetitors.js';

const force = process.argv.includes('--force');

seedCompetitorPosts({ force })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.seeded || result.skipped.length > 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
