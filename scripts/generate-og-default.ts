#!/usr/bin/env npx tsx
/**
 * Build-time OG image for homepage, remote-jobs, and default social previews.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { generateCoverSvg } from '../src/server/contentGrowth/coverImage.js';

const svg = generateCoverSvg('AI Remote Job Matching & Daily Job Alerts', 'ai-job-matching');
const outSvg = resolve(process.cwd(), 'public/og-default.svg');
const outPng = resolve(process.cwd(), 'public/og-default.png');

writeFileSync(outSvg, svg, 'utf8');
await sharp(Buffer.from(svg)).png().toFile(outPng);
console.log('[generate-og-default] Wrote public/og-default.svg and public/og-default.png');
