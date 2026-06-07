/**
 * Weekly trend pipeline: Reddit discovery → advanced writing → max 3 publishes/week.
 */
import {
  loadStrategy,
  saveStrategy,
  initializeStrategy,
  listBlogPosts,
  saveBlogPost,
  type MarketingStrategy,
} from '../marketingEngine.js';
import {
  runSeoValidationAgent,
  buildInternalLinks,
  runSchemaAgent,
  injectInternalLinks,
  assignClusterId,
} from './agents.js';
import { generateCoverDataUri, buildImageAltText } from './coverImage.js';
import { runQualityGate, autoFixSeoFields } from './qualityGate.js';
import { applyBidirectionalLinks, isDuplicateTopic } from './linking.js';
import { loadGrowthState, saveGrowthState, logGrowthRun } from './storage.js';
import { discoverRedditThreads, redditThreadToTopic, scoreThreadNovelty } from './reddit/discover.js';
import { runAdvancedWritingPipeline, runDeepResearchAgent, type TrendTopic } from './writingPipeline.js';
import { pingBlogSlugs } from './indexNow.js';
import { countWords, meetsMinimumWordCount, BLOG_TARGET_WORD_COUNT } from './wordCount.js';
import type { EnhancedBlogPostFields } from '../types/contentGrowth.js';
import type { BlogPost } from '../marketingEngine.js';

const MAX_WEEKLY_POSTS = 3;

type EnhancedBlogPost = BlogPost & EnhancedBlogPostFields;

function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

function toSlug(title: string, date: string): string {
  const kebab = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 55)
    .replace(/-$/, '');
  return `${date}-trend-${kebab}`;
}

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round(countWords(content) / 200));
}

function extractFaq(content: string): { question: string; answer: string }[] {
  const faqItems: { question: string; answer: string }[] = [];
  const faqRegex = /\*\*Q:\*\*\s*(.+?)\n\*\*A:\*\*\s*(.+?)(?=\n\*\*Q:|$)/gs;
  let match;
  while ((match = faqRegex.exec(content)) !== null) {
    faqItems.push({ question: match[1].trim(), answer: match[2].trim() });
  }
  return faqItems;
}

export interface WeeklyTrendResult {
  published: string[];
  skipped: string[];
  errors: { title: string; error: string }[];
  weekKey: string;
  redditThreadsScanned: number;
  aiCallsUsed: number;
  message: string;
}

export async function runWeeklyTrendPipeline(options: {
  dryRun?: boolean;
  maxPosts?: number;
} = {}): Promise<WeeklyTrendResult> {
  const dryRun = options.dryRun ?? false;
  const maxPosts = Math.min(options.maxPosts ?? MAX_WEEKLY_POSTS, MAX_WEEKLY_POSTS);
  const weekKey = getWeekKey();
  const state = await loadGrowthState();

  if (state.lastWeeklyTrendWeek === weekKey && (state.weeklyTrendCount ?? 0) >= maxPosts && !dryRun) {
    return {
      published: [],
      skipped: ['weekly_limit_reached'],
      errors: [],
      weekKey,
      redditThreadsScanned: 0,
      aiCallsUsed: 0,
      message: `Already published ${state.weeklyTrendCount} trend posts this week (${weekKey}).`,
    };
  }

  const existingPosts = await listBlogPosts(200);
  const existingTitles = existingPosts.map((p) => p.title);
  const threads = await discoverRedditThreads(30);

  const ranked = threads
    .map((t) => ({ thread: t, score: scoreThreadNovelty(t, existingTitles) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPosts * 2);

  const strategy = (await loadStrategy()) ?? (await initializeStrategy());

  const published: string[] = [];
  const skipped: string[] = [];
  const errors: { title: string; error: string }[] = [];
  let aiCallsUsed = 0;
  let publishedThisRun = 0;

  for (const { thread } of ranked) {
    if (publishedThisRun >= maxPosts) break;

    const topicBase = redditThreadToTopic(thread);
    const topic: TrendTopic = {
      title: topicBase.title,
      angle: topicBase.angle,
      targetKeywords: topicBase.targetKeywords,
      priority: topicBase.priority,
      source: topicBase.source,
      redditUrl: topicBase.redditUrl,
    };

    const today = new Date().toISOString().split('T')[0];
    const slugPreview = toSlug(topic.title, today);
    const dup = isDuplicateTopic(topic.title, slugPreview, existingPosts.map((p) => ({ title: p.title, slug: p.slug })));
    if (dup.isDuplicate) {
      skipped.push(topic.title);
      continue;
    }

    try {
      const research = await runDeepResearchAgent(topic);
      aiCallsUsed++;

      const clusterId = assignClusterId(topic);
      const generated = await runAdvancedWritingPipeline(topic, research, strategy, clusterId);
      aiCallsUsed += generated.aiCallsUsed;

      let content = generated.content;
      if (!meetsMinimumWordCount(content)) {
        throw new Error(`Trend post below ${BLOG_TARGET_WORD_COUNT} words`);
      }

      const slug = toSlug(generated.title, today);
      const internalLinks = buildInternalLinks(
        { slug, title: generated.title, targetKeywords: topic.targetKeywords, clusterId },
        existingPosts.map((p) => ({
          slug: p.slug,
          title: p.title,
          targetKeywords: p.targetKeywords ?? [],
          clusterId: (p as EnhancedBlogPost).clusterId,
        }))
      );
      content = injectInternalLinks(content, internalLinks);
      const faq = extractFaq(content);

      const coverImageUrl = `https://hireschema.com/api/blog/cover?slug=${encodeURIComponent(slug)}`;

      let basePost: BlogPost = {
        slug,
        title: generated.title,
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription,
        excerpt: generated.directAnswer.slice(0, 200) + '…',
        content,
        category: generated.category || 'Trend Watch',
        tags: [...(generated.tags ?? []), 'reddit', 'trend watch', weekKey],
        targetKeywords: topic.targetKeywords,
        readTimeMinutes: estimateReadTime(content),
        publishedAt: new Date().toISOString(),
        status: dryRun ? 'draft' : 'published',
        strategyVersion: strategy.version,
        faq,
      };

      const fixed = autoFixSeoFields({
        ...basePost,
        directAnswer: generated.directAnswer,
        definitions: generated.definitions,
        salaryBenchmarks: generated.salaryBenchmarks,
        hiringTrends: generated.hiringTrends,
        internalLinks,
        entityTags: generated.entityTags,
      });
      basePost = { ...basePost, ...fixed };

      const seoValidation = runSeoValidationAgent(basePost);
      const qualityGate = runQualityGate(
        { ...basePost, directAnswer: generated.directAnswer, internalLinks, entityTags: generated.entityTags },
        seoValidation
      );

      if (!qualityGate.passed) {
        throw new Error(`Quality gate failed: ${qualityGate.blockers.join('; ')}`);
      }

      const enhanced: EnhancedBlogPost = {
        ...basePost,
        directAnswer: generated.directAnswer,
        definitions: generated.definitions ?? [],
        salaryBenchmarks: generated.salaryBenchmarks ?? [],
        hiringTrends: generated.hiringTrends ?? [],
        comparisonTableMarkdown: generated.comparisonTableMarkdown,
        coverImageUrl,
        coverImageDataUri: generateCoverDataUri(generated.title, clusterId),
        imageAltText: buildImageAltText(generated.title, clusterId),
        clusterId,
        internalLinks,
        schema: runSchemaAgent({ ...basePost, directAnswer: generated.directAnswer, clusterId, coverImageUrl }),
        seoValidation,
        llmOptimization: qualityGate.llmScore,
        entityTags: generated.entityTags ?? [],
      };

      if (!dryRun) {
        await saveBlogPost(enhanced);
        await applyBidirectionalLinks(
          { slug, title: generated.title, anchorText: generated.title, clusterId },
          internalLinks.map((l) => l.slug)
        );
        void pingBlogSlugs([slug]).catch(() => {});
      }

      published.push(slug);
      publishedThisRun++;
      existingPosts.push({ slug, title: generated.title } as typeof existingPosts[0]);
    } catch (err) {
      errors.push({
        title: topic.title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!dryRun && published.length > 0) {
    await saveGrowthState({
      lastWeeklyTrendPublish: new Date().toISOString(),
      lastWeeklyTrendWeek: weekKey,
      weeklyTrendCount: (state.lastWeeklyTrendWeek === weekKey ? (state.weeklyTrendCount ?? 0) : 0) + published.length,
      totalPostsPublished: (state.totalPostsPublished ?? 0) + published.length,
      systemStatus: 'idle',
    });

    await saveStrategy({
      ...strategy,
      usedTopics: [...strategy.usedTopics, ...published],
      lastUpdated: new Date().toISOString(),
    });
  }

  await logGrowthRun({
    type: 'weekly_trend',
    status: errors.length === 0 ? 'success' : 'partial',
    details: { weekKey, published, skipped, errors, aiCallsUsed, threads: threads.length },
  });

  return {
    published,
    skipped,
    errors,
    weekKey,
    redditThreadsScanned: threads.length,
    aiCallsUsed,
    message: dryRun
      ? `Dry run: would publish ${published.length} trend post(s) from ${threads.length} Reddit threads.`
      : `Published ${published.length} trend post(s) for ${weekKey} (max ${maxPosts}/week).`,
  };
}
