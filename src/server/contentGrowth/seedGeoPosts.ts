/**
 * Seed programmatic GEO guides (locations, roles, India role combos).
 */
import {
  loadStrategy,
  saveStrategy,
  initializeStrategy,
  saveBlogPost,
  listBlogPosts,
  type BlogPost,
  type MarketingStrategy,
  type TopicIdea,
} from '../marketingEngine.js';
import {
  runSeoValidationAgent,
  buildInternalLinks,
  runSchemaAgent,
  injectInternalLinks,
} from './agents.js';
import { generateCoverDataUri, buildImageAltText } from './coverImage.js';
import { runQualityGate, autoFixSeoFields } from './qualityGate.js';
import { applyBidirectionalLinks } from './linking.js';
import { loadGrowthState, saveGrowthState, logGrowthRun } from './storage.js';
import { GEO_SPECS } from './geo/buildGeoSpecs.js';
import { buildEvergreenMarkdown, extractFaqFromMarkdown } from './evergreen/buildArticle.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from './wordCount.js';
import type { EnhancedBlogPostFields } from '../../types/contentGrowth.js';
import type { BlogPost as BaseBlogPost } from '../marketingEngine.js';

type EnhancedBlogPost = BaseBlogPost & EnhancedBlogPostFields;

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round(countWords(content) / 200));
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function dedupePendingTopics(strategy: MarketingStrategy, seededTitles: string[]): TopicIdea[] {
  const seeded = new Set(seededTitles.map(normalizeTitle));
  return strategy.pendingTopics.filter((t) => !seeded.has(normalizeTitle(t.title)));
}

export interface SeedGeoResult {
  seeded: boolean;
  created: string[];
  skipped: string[];
  wordCounts: Record<string, number>;
  strategyPendingTopics: number;
  message: string;
}

export async function seedGeoPosts(options: { force?: boolean } = {}): Promise<SeedGeoResult> {
  const force = options.force ?? false;
  const state = await loadGrowthState();
  const existing = await listBlogPosts(300);
  const existingSlugs = new Set(existing.map((p) => p.slug));
  const geoSlugs = GEO_SPECS.map((s) => s.slug);

  const alreadySeeded = geoSlugs.filter((slug) => existingSlugs.has(slug)).length >= GEO_SPECS.length;

  if (alreadySeeded && !force) {
    return {
      seeded: false,
      created: [],
      skipped: geoSlugs,
      wordCounts: {},
      strategyPendingTopics: (await loadStrategy())?.pendingTopics.length ?? 0,
      message: 'GEO posts already seeded. Pass force=true to overwrite.',
    };
  }

  let strategy = (await loadStrategy()) ?? (await initializeStrategy());
  const builtPosts: EnhancedBlogPost[] = [];
  const linkPool = GEO_SPECS.map((s) => ({
    slug: s.slug,
    title: s.title,
    targetKeywords: s.targetKeywords,
    clusterId: s.clusterId,
  }));

  for (const spec of GEO_SPECS) {
    let content = buildEvergreenMarkdown(spec);
    if (!meetsMinimumWordCount(content)) {
      throw new Error(`GEO seed "${spec.slug}" is below ${BLOG_TARGET_WORD_COUNT} words`);
    }

    const faq = extractFaqFromMarkdown(content);
    const internalLinks = buildInternalLinks(
      { slug: spec.slug, title: spec.title, targetKeywords: spec.targetKeywords, clusterId: spec.clusterId },
      linkPool.filter((s) => s.slug !== spec.slug).slice(0, 12)
    );
    content = injectInternalLinks(content, internalLinks);

    const coverImageUrl = `https://hireschema.com/api/blog/cover?slug=${encodeURIComponent(spec.slug)}`;
    const coverImageDataUri = generateCoverDataUri(spec.title, spec.clusterId);
    const imageAltText = buildImageAltText(spec.title, spec.clusterId);

    let basePost: BlogPost = {
      slug: spec.slug,
      title: spec.title,
      seoTitle: spec.seoTitle,
      seoDescription: spec.seoDescription,
      excerpt: spec.directAnswer.slice(0, 200) + '…',
      content,
      category: spec.category,
      tags: spec.tags,
      targetKeywords: spec.targetKeywords,
      readTimeMinutes: estimateReadTime(content),
      publishedAt: spec.publishedAt,
      status: 'published',
      strategyVersion: strategy.version,
      faq,
    };

    const fixed = autoFixSeoFields({
      ...basePost,
      directAnswer: spec.directAnswer,
      definitions: spec.definitions,
      salaryBenchmarks: spec.salaryRows.map((r) => ({ ...r, source: 'Industry surveys 2026' })),
      hiringTrends: spec.trends,
      internalLinks,
      entityTags: ['HireSchema', 'GEO', 'remote jobs', ...(spec.tags ?? []).slice(0, 4)],
    });
    basePost = { ...basePost, ...fixed };

    const seoValidation = runSeoValidationAgent(basePost);
    const qualityGate = runQualityGate(
      {
        ...basePost,
        directAnswer: spec.directAnswer,
        definitions: spec.definitions,
        salaryBenchmarks: spec.salaryRows,
        hiringTrends: spec.trends,
        internalLinks,
        entityTags: fixed.entityTags,
      },
      seoValidation
    );

    builtPosts.push({
      ...basePost,
      directAnswer: spec.directAnswer,
      definitions: spec.definitions,
      salaryBenchmarks: spec.salaryRows.map((r) => ({ ...r, source: 'Industry surveys 2026' })),
      hiringTrends: spec.trends,
      comparisonTableMarkdown: spec.comparisonRows.map((r) => `| ${r.join(' | ')} |`).join('\n'),
      coverImageUrl,
      coverImageDataUri,
      imageAltText,
      clusterId: spec.clusterId,
      internalLinks,
      schema: runSchemaAgent({ ...basePost, directAnswer: spec.directAnswer, clusterId: spec.clusterId, coverImageUrl }),
      seoValidation,
      llmOptimization: qualityGate.llmScore,
      entityTags: fixed.entityTags ?? [],
    });
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const wordCounts: Record<string, number> = {};

  for (const post of builtPosts) {
    wordCounts[post.slug] = countWords(post.content);
    if (existingSlugs.has(post.slug) && !force) {
      skipped.push(post.slug);
      continue;
    }
    await saveBlogPost(post);
    created.push(post.slug);
  }

  for (const post of builtPosts) {
    await applyBidirectionalLinks(
      {
        slug: post.slug,
        title: post.title,
        anchorText: post.title,
        clusterId: post.clusterId ?? 'geo-guides',
      },
      post.internalLinks?.map((l) => l.slug) ?? []
    );
  }

  const seededTitles = GEO_SPECS.map((s) => s.title);
  const updatedStrategy: MarketingStrategy = {
    ...strategy,
    usedTopics: [...new Set([...strategy.usedTopics, ...seededTitles])],
    pendingTopics: dedupePendingTopics(strategy, seededTitles),
    lastUpdated: new Date().toISOString(),
  };
  await saveStrategy(updatedStrategy);

  await saveGrowthState({
    totalPostsPublished: Math.max(state.totalPostsPublished ?? 0, (state.totalPostsPublished ?? 0) + created.length),
    systemStatus: 'idle',
    lastError: null,
  });

  await logGrowthRun({
    type: 'evergreen_seed',
    status: 'success',
    details: { type: 'geo_guides', created, skipped, wordCounts, count: GEO_SPECS.length },
  });

  return {
    seeded: true,
    created,
    skipped,
    wordCounts,
    strategyPendingTopics: updatedStrategy.pendingTopics.length,
    message: `Seeded ${created.length} GEO guides (${BLOG_TARGET_WORD_COUNT}+ words each, staggered publish dates).`,
  };
}
