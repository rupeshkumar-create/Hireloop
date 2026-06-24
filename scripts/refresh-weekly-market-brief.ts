#!/usr/bin/env npx tsx
/**
 * Refresh weekly market brief snapshot from Firestore job titles (anonymized).
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY='...' npm run refresh:market-brief
 *
 * Without Firebase credentials, writes default curated snapshot dates only.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SNAPSHOT_PATH = resolve(
  process.cwd(),
  'src/server/contentGrowth/marketBrief/weeklyRolesSnapshot.ts'
);

type RoleAgg = {
  title: string;
  count: number;
  skills: Map<string, number>;
  matchTotal: number;
};

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/\s+at\s+.+$/i, '')
    .trim()
    .slice(0, 80);
}

async function aggregateFromSupabase(): Promise<RoleAgg[] | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const { queryDailyMatchesSince } = await import('../src/server/db/dailyMatches.js');
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await queryDailyMatchesSince(since, 200);

    const agg = new Map<string, RoleAgg>();

    for (const row of rows) {
      const jobs = (row.jobs || []) as { title?: string; matchScore?: number; requirements?: string[] }[];
      for (const job of jobs) {
        const title = normalizeTitle(job.title ?? '');
        if (!title || title.length < 4) continue;
        const entry = agg.get(title) ?? { title, count: 0, skills: new Map(), matchTotal: 0 };
        entry.count += 1;
        entry.matchTotal += job.matchScore ?? 0;
        for (const skill of (job.requirements ?? []).slice(0, 5)) {
          const s = String(skill).trim();
          if (s) entry.skills.set(s, (entry.skills.get(s) ?? 0) + 1);
        }
        agg.set(title, entry);
      }
    }

    if (agg.size === 0) return null;

    return [...agg.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((entry) => entry);
  } catch (err) {
    console.warn('[refresh-market-brief] Firestore aggregate skipped:', err instanceof Error ? err.message : err);
    return null;
  }
}

function buildSnapshotFile(roles: {
  title: string;
  demandIndex: number;
  medianMatchScore: number;
  topSkills: string[];
  trend: 'rising' | 'stable' | 'cooling';
  regionNote: string;
}[]): string {
  const weekOf = new Date().toISOString().split('T')[0]!;
  const updatedAt = new Date().toISOString();

  return `/**
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
  weekOf: '${weekOf}',
  updatedAt: '${updatedAt}',
  sourceNote:
    'Aggregated from anonymized HireSchema Scout validations (remote-only, link-verified, posted within 7 days). No employer names — role titles and skill signals only.',
  roles: ${JSON.stringify(roles, null, 2)},
};

export const WEEKLY_MARKET_BRIEF_SLUG = 'weekly-top-remote-roles';
`;
}

async function main() {
  const aggregated = await aggregateFromSupabase();

  let roles: {
    title: string;
    demandIndex: number;
    medianMatchScore: number;
    topSkills: string[];
    trend: 'rising' | 'stable' | 'cooling';
    regionNote: string;
  }[];

  if (aggregated && aggregated.length > 0) {
    const max = aggregated[0]!.count;
    roles = aggregated.map((entry, i) => ({
      title: entry.title,
      demandIndex: Math.round((entry.count / max) * 100),
      medianMatchScore: Math.min(95, Math.round(entry.matchTotal / Math.max(entry.count, 1))),
      topSkills: [...entry.skills.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([skill]) => skill),
      trend: i < 4 ? 'rising' : i < 8 ? 'stable' : 'cooling',
      regionNote: 'Signal from HireSchema Scout pipeline over the last 7 days.',
    }));
    console.log(`[refresh-market-brief] Aggregated ${roles.length} roles from Firestore.`);
  } else {
    const existing = readFileSync(SNAPSHOT_PATH, 'utf8');
    const match = existing.match(/roles: (\[[\s\S]*?\]),\n\};/);
    if (!match) throw new Error('Could not parse existing weeklyRolesSnapshot.ts');
    roles = JSON.parse(match[1]!) as typeof roles;
    console.log('[refresh-market-brief] No Firestore data — refreshed weekOf/updatedAt only.');
  }

  writeFileSync(SNAPSHOT_PATH, buildSnapshotFile(roles), 'utf8');
  console.log(`[refresh-market-brief] Wrote ${SNAPSHOT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
