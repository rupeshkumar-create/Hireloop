/**
 * Seed all 500 programmatic blog posts with staggered dates and quality gates.
 */
import {
  loadStrategy,
  saveStrategy,
  initializeStrategy,
  saveBlogPost,
  listBlogPosts,
  type MarketingStrategy,
  type TopicIdea,
} from '../marketingEngine.js';
import { loadGrowthState, saveGrowthState, logGrowthRun } from './storage.js';
import {
  ALL_PROGRAMMATIC_SPECS,
  PROGRAMMATIC_CLUSTERS,
  PROGRAMMATIC_POST_COUNT,
  TARGET_PROGRAMMATIC_COUNT,
  assertProgrammaticCatalogSize,
} from './programmatic/catalog.js';
import { buildPostFromSpec, type LinkPoolEntry } from './seed/buildPostFromSpec.js';
import { pingBlogSlugs } from './indexNow.js';
import { BLOG_TARGET_WORD_COUNT, countWords } from './wordCount.js';

const BATCH_LOG_EVERY = 25;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function dedupePendingTopics(strategy: MarketingStrategy, seededTitles: string[]): TopicIdea[] {
  const seeded = new Set(seededTitles.map(normalizeTitle));
  return strategy.pendingTopics.filter((t) => !seeded.has(normalizeTitle(t.title)));
}

export interface SeedLibraryResult {
  seeded: boolean;
  created: string[];
  skipped: string[];
  errors: { slug: string; error: string }[];
  totalSpecs: number;
  clusters: typeof PROGRAMMATIC_CLUSTERS;
  message: string;
}

export interface SeedLibraryOptions {
  force?: boolean;
  offset?: number;
  limit?: number;
}

export async function seedProgrammaticLibrary(
  options: SeedLibraryOptions = {}
): Promise<SeedLibraryResult> {
  assertProgrammaticCatalogSize(TARGET_PROGRAMMATIC_COUNT);

  const force = options.force ?? false;
  const offset = options.offset ?? 0;
  const limit = options.limit ?? ALL_PROGRAMMATIC_SPECS.length;

  const specs = ALL_PROGRAMMATIC_SPECS.slice(offset, offset + limit);
  const state = await loadGrowthState();
  const existing = await listBlogPosts(500);
  const existingSlugs = new Set(existing.map((p) => p.slug));

  const allSeeded =
    ALL_PROGRAMMATIC_SPECS.filter((s) => existingSlugs.has(s.slug)).length >=
    ALL_PROGRAMMATIC_SPECS.length;

  if (allSeeded && !force && offset === 0 && limit >= ALL_PROGRAMMATIC_SPECS.length) {
    return {
      seeded: false,
      created: [],
      skipped: ALL_PROGRAMMATIC_SPECS.map((s) => s.slug),
      errors: [],
      totalSpecs: PROGRAMMATIC_POST_COUNT,
      clusters: PROGRAMMATIC_CLUSTERS,
      message: `All ${TARGET_PROGRAMMATIC_COUNT} programmatic posts already seeded. Pass force=true to overwrite.`,
    };
  }

  let strategy = (await loadStrategy()) ?? (await initializeStrategy());
  const linkPool: LinkPoolEntry[] = ALL_PROGRAMMATIC_SPECS.map((s) => ({
    slug: s.slug,
    title: s.title,
    targetKeywords: s.targetKeywords,
    clusterId: s.clusterId,
  }));

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: { slug: string; error: string }[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    if (existingSlugs.has(spec.slug) && !force) {
      skipped.push(spec.slug);
      continue;
    }
    try {
      const post = buildPostFromSpec(spec, linkPool);
      if (countWords(post.content) < BLOG_TARGET_WORD_COUNT) {
        throw new Error(`Below ${BLOG_TARGET_WORD_COUNT} words after build`);
      }
      await saveBlogPost(post);
      created.push(spec.slug);
      if ((i + 1) % BATCH_LOG_EVERY === 0) {
        console.log(`[seed-library] progress ${i + 1}/${specs.length}`);
      }
    } catch (err) {
      errors.push({
        slug: spec.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (created.length > 0) {
    void pingBlogSlugs(created.slice(0, 100)).catch(() => {});
  }

  const seededTitles = ALL_PROGRAMMATIC_SPECS.map((s) => s.title);
  await saveStrategy({
    ...strategy,
    usedTopics: [...new Set([...strategy.usedTopics, ...seededTitles])],
    pendingTopics: dedupePendingTopics(strategy, seededTitles),
    lastUpdated: new Date().toISOString(),
  });

  await saveGrowthState({
    totalPostsPublished: Math.max(state.totalPostsPublished ?? 0, (state.totalPostsPublished ?? 0) + created.length),
    evergreenSeeded: true,
    evergreenSeededAt: new Date().toISOString(),
    programmaticLibrarySeeded: created.length > 0,
    programmaticLibrarySeededAt: created.length > 0 ? new Date().toISOString() : state.programmaticLibrarySeededAt ?? null,
    systemStatus: errors.length > 0 ? 'error' : 'idle',
    lastError: errors.length > 0 ? `${errors.length} seed errors` : null,
  });

  await logGrowthRun({
    type: 'evergreen_seed',
    status: errors.length === 0 ? 'success' : 'partial',
    details: { type: 'full_library', created: created.length, skipped: skipped.length, errors, clusters: PROGRAMMATIC_CLUSTERS },
  });

  return {
    seeded: created.length > 0,
    created,
    skipped,
    errors,
    totalSpecs: PROGRAMMATIC_POST_COUNT,
    clusters: PROGRAMMATIC_CLUSTERS,
    message: `Seeded ${created.length}/${specs.length} programmatic posts (${TARGET_PROGRAMMATIC_COUNT} total library, staggered publish dates).`,
  };
}
