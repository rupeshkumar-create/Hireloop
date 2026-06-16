/**
 * Shared factory: EvergreenSpec → enhanced Firestore blog post.
 */
import type { BlogPost } from '../../marketingEngine.js';
import {
  runSeoValidationAgent,
  buildInternalLinks,
  runSchemaAgent,
  injectInternalLinks,
} from '../agents.js';
import { generateCoverDataUri, buildImageAltText } from '../coverImage.js';
import { runQualityGate, autoFixSeoFields } from '../qualityGate.js';
import { buildEvergreenMarkdown, extractFaqFromMarkdown, type EvergreenSpec } from '../evergreen/buildArticle.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from '../wordCount.js';
import { SALARY_SURVEY_SOURCE } from '../contentStandards.js';
import type { EnhancedBlogPostFields } from '../../../types/contentGrowth.js';

export type EnhancedBlogPost = BlogPost & EnhancedBlogPostFields;

export type LinkPoolEntry = {
  slug: string;
  title: string;
  targetKeywords: string[];
  clusterId?: string;
};

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round(countWords(content) / 200));
}

export function buildPostFromSpec(
  spec: EvergreenSpec,
  linkPool: LinkPoolEntry[]
): EnhancedBlogPost {
  const canonicalTitle = spec.canonicalSlug
    ? linkPool.find((entry) => entry.slug === spec.canonicalSlug)?.title
    : undefined;
  let content = buildEvergreenMarkdown(spec, { canonicalTitle });
  if (!meetsMinimumWordCount(content)) {
    throw new Error(`Spec "${spec.slug}" is below ${BLOG_TARGET_WORD_COUNT} words`);
  }

  const faq = extractFaqFromMarkdown(content);
  const internalLinks = buildInternalLinks(
    {
      slug: spec.slug,
      title: spec.title,
      targetKeywords: spec.targetKeywords,
      clusterId: spec.clusterId,
    },
    linkPool.filter((s) => s.slug !== spec.slug).slice(0, 15)
  );
  content = injectInternalLinks(content, internalLinks);

  const coverImageUrl = `https://hireschema.com/api/blog/cover?slug=${encodeURIComponent(spec.slug)}`;

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
    strategyVersion: 1,
    faq,
  };

  const fixed = autoFixSeoFields({
    ...basePost,
    directAnswer: spec.directAnswer,
    definitions: spec.definitions,
    salaryBenchmarks: spec.salaryRows.map((r) => ({ ...r, source: SALARY_SURVEY_SOURCE })),
    hiringTrends: spec.trends,
    internalLinks,
    entityTags: ['HireSchema', ...(spec.tags ?? []).slice(0, 5)],
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

  return {
    ...basePost,
    directAnswer: spec.directAnswer,
    definitions: spec.definitions,
    salaryBenchmarks: spec.salaryRows.map((r) => ({ ...r, source: SALARY_SURVEY_SOURCE })),
    hiringTrends: spec.trends,
    comparisonTableMarkdown: spec.comparisonRows.map((r) => `| ${r.join(' | ')} |`).join('\n'),
    coverImageUrl,
    coverImageDataUri: generateCoverDataUri(spec.title, spec.clusterId),
    imageAltText: buildImageAltText(spec.title, spec.clusterId),
    clusterId: spec.clusterId,
    internalLinks,
    canonicalSlug: spec.canonicalSlug,
    schema: runSchemaAgent({ ...basePost, directAnswer: spec.directAnswer, clusterId: spec.clusterId, coverImageUrl }),
    seoValidation,
    llmOptimization: qualityGate.llmScore,
    entityTags: fixed.entityTags ?? [],
  };
}
