/**
 * Content Growth Orchestrator
 *
 * Pipeline: Keyword Discovery → Content Planning → Content Generation →
 * SEO Validation → Quality Gate → Internal Linking → Schema → Publish →
 * Bidirectional Links → Analytics → Monthly Learning → Strategy Update
 */

import {
  loadStrategy,
  saveStrategy,
  initializeStrategy,
  researchTopic,
  saveBlogPost,
  listBlogPosts,
  getBlogPostBySlug,
  type BlogPost,
  type MarketingStrategy,
  type TopicIdea,
} from '../marketingEngine.js';
import {
  runKeywordDiscoveryAgent,
  runCompetitorAnalysisAgent,
  runStrategyAgent,
  runContentGenerationAgent,
  runSeoValidationAgent,
  buildInternalLinks,
  runSchemaAgent,
  runLearningAgent,
  runContentRefreshAgent,
  injectInternalLinks,
  assignClusterId,
  updateCluster,
} from './agents.js';
import { generateCoverDataUri, buildImageAltText } from './coverImage.js';
import { runQualityGate, autoFixSeoFields } from './qualityGate.js';
import { PipelineTracker, getCronSchedule, type PipelineRun } from './pipeline.js';
import { applyBidirectionalLinks, isDuplicateTopic } from './linking.js';
import {
  loadGrowthState,
  saveGrowthState,
  saveKeywords,
  listKeywords,
  saveCompetitors,
  listCompetitors,
  saveCluster,
  listClusters,
  listPageMetrics,
  saveLearningReport,
  saveStrategyPlan,
  logGrowthRun,
  buildPerformanceScores,
  listGrowthRuns,
  listLearningReports,
  getLatestStrategyPlan,
  getPageMetrics,
} from './storage.js';
import type { EnhancedBlogPostFields } from '../../types/contentGrowth.js';
import {
  buildPostAdminSummary,
  buildOperationalChecks,
  buildStrategyAdminView,
} from './adminDashboard.js';

function toSlug(title: string, date: string): string {
  const kebab = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
  return `${date}-${kebab}`;
}

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round(content.split(/\s+/).length / 200));
}

function extractFaq(content: string): { question: string; answer: string }[] {
  const faqMatch = content.match(/###\s+FAQ[\s\S]*/i);
  const faqSection = faqMatch ? faqMatch[0] : '';
  const faqItems: { question: string; answer: string }[] = [];
  const faqRegex = /\*\*Q:\*\*\s*(.+?)\n\*\*A:\*\*\s*(.+?)(?=\n\*\*Q:|$)/gs;
  let match;
  while ((match = faqRegex.exec(faqSection)) !== null) {
    faqItems.push({ question: match[1].trim(), answer: match[2].trim() });
  }
  return faqItems;
}

export type EnhancedBlogPost = BlogPost & EnhancedBlogPostFields;

export interface PublishResult {
  slug: string;
  title: string;
  seoScore: number;
  llmScore: number;
  llmGrade: string;
  clusterId: string;
  pipeline: PipelineRun;
  preview?: Partial<EnhancedBlogPost>;
  dryRun: boolean;
}

export interface PublishOptions {
  dryRun?: boolean;
}

// ─── Daily Publish Pipeline ───────────────────────────────────────────────────

export async function runDailyContentPipeline(options: PublishOptions = {}): Promise<PublishResult> {
  const dryRun = options.dryRun ?? false;
  const tracker = new PipelineTracker(dryRun ? 'dry_run' : 'live');

  if (!dryRun) {
    await saveGrowthState({ systemStatus: 'running', lastError: null });
  }

  try {
    tracker.start('load_strategy');
    let strategy = await loadStrategy();
    if (!strategy) strategy = await initializeStrategy();

    if (strategy.pendingTopics.length === 0) {
      await runKeywordDiscovery();
      const refreshed = await loadStrategy();
      if (!refreshed || refreshed.pendingTopics.length === 0) {
        throw new Error('No pending topics. Run monthly learning or seed strategy.');
      }
      strategy = refreshed;
    }
    tracker.complete('load_strategy', { pendingTopics: strategy.pendingTopics.length, version: strategy.version });

    const topic = strategy.pendingTopics[0];
    const clusterId = assignClusterId(topic);

    tracker.start('research');
    const research = await researchTopic(topic);
    tracker.complete('research', { model: 'perplexity/sonar-pro', researchLength: research.length });

    tracker.start('generate');
    const generated = await runContentGenerationAgent(topic, research, strategy, clusterId);
    tracker.complete('generate', { model: 'anthropic/claude-opus-4-6', title: generated.title });

    let content = generated.content;
    if (!content.startsWith('#')) {
      content = `# ${generated.title}\n\n${content}`;
    }

    const today = new Date().toISOString().split('T')[0];
    const slug = toSlug(generated.title, today);

    const existingPosts = await listBlogPosts(50);
    const dup = isDuplicateTopic(
      generated.title,
      slug,
      existingPosts.map((p) => ({ title: p.title, slug: p.slug }))
    );
    if (dup.isDuplicate) {
      throw new Error(`Duplicate content blocked: ${dup.reason}`);
    }

    tracker.start('internal_links');
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
    tracker.complete('internal_links', { links: internalLinks.length });

    tracker.start('cover_image');
    const coverImageUrl = `https://hireschema.com/api/blog/cover?slug=${encodeURIComponent(slug)}`;
    const coverImageDataUri = generateCoverDataUri(generated.title, clusterId);
    const imageAltText = buildImageAltText(generated.title, clusterId);
    tracker.complete('cover_image', { type: 'deterministic-svg' });

    const excerpt = generated.directAnswer || content.replace(/#{1,6}\s+[^\n]+\n?/g, '').slice(0, 200).trim() + '…';

    let basePost: BlogPost = {
      slug,
      title: generated.title,
      seoTitle: generated.seoTitle || generated.title,
      seoDescription: generated.seoDescription || excerpt,
      excerpt,
      content,
      category: generated.category || 'Remote Work',
      tags: generated.tags || topic.targetKeywords,
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

    tracker.start('quality_gate');
    const seoValidation = runSeoValidationAgent(basePost);
    const qualityGate = runQualityGate(
      {
        ...basePost,
        directAnswer: generated.directAnswer,
        definitions: generated.definitions,
        salaryBenchmarks: generated.salaryBenchmarks,
        hiringTrends: generated.hiringTrends,
        internalLinks,
        entityTags: generated.entityTags,
      },
      seoValidation
    );
    tracker.complete('quality_gate', {
      seoScore: qualityGate.seoScore,
      llmScore: qualityGate.llmScore.score,
      llmGrade: qualityGate.llmScore.grade,
      blockers: qualityGate.blockers,
      slopPhrases: qualityGate.llmScore.slopPhrasesFound,
    });

    tracker.start('schema');
    const enhancedPost: EnhancedBlogPost = {
      ...basePost,
      directAnswer: generated.directAnswer,
      definitions: generated.definitions ?? [],
      salaryBenchmarks: generated.salaryBenchmarks ?? [],
      hiringTrends: generated.hiringTrends ?? [],
      comparisonTableMarkdown: generated.comparisonTableMarkdown,
      coverImageUrl,
      coverImageDataUri,
      imageAltText,
      clusterId,
      internalLinks,
      schema: runSchemaAgent({ ...basePost, directAnswer: generated.directAnswer, clusterId, coverImageUrl }),
      seoValidation,
      llmOptimization: qualityGate.llmScore,
      entityTags: generated.entityTags ?? [],
    };
    tracker.complete('schema', { types: ['Article', 'FAQPage', 'BreadcrumbList'] });

    if (dryRun) {
      tracker.skip('publish', 'dry run mode');
      tracker.skip('cluster_update', 'dry run mode');
      tracker.skip('bidirectional_links', 'dry run mode');
      tracker.skip('strategy_update', 'dry run mode');

      const pipeline = tracker.finish({
        slug,
        title: generated.title,
        qualityGate,
        aiCallsUsed: 2,
      });

      return {
        slug,
        title: generated.title,
        seoScore: qualityGate.seoScore,
        llmScore: qualityGate.llmScore.score,
        llmGrade: qualityGate.llmScore.grade,
        clusterId,
        pipeline,
        preview: {
          ...enhancedPost,
          content: enhancedPost.content.slice(0, 2000) + '\n\n… [truncated for preview]',
        },
        dryRun: true,
      };
    }

    tracker.start('publish');
    await saveBlogPost(enhancedPost as BlogPost);
    tracker.complete('publish', { slug });

    tracker.start('cluster_update');
    const clusters = await listClusters();
    const existingCluster = clusters.find((c) => c.id === clusterId);
    const cluster = await updateCluster(clusterId, slug, topic.targetKeywords, existingCluster);
    await saveCluster(cluster);
    tracker.complete('cluster_update', { clusterId, authorityScore: cluster.authorityScore });

    tracker.start('bidirectional_links');
    const backlinkCount = await applyBidirectionalLinks(
      { slug, title: generated.title, anchorText: generated.title, clusterId },
      internalLinks.map((l) => l.slug)
    );
    tracker.complete('bidirectional_links', { updatedPosts: backlinkCount });

    tracker.start('strategy_update');
    const updatedStrategy: MarketingStrategy = {
      ...strategy,
      pendingTopics: strategy.pendingTopics.slice(1),
      usedTopics: [...strategy.usedTopics, topic.title],
      lastUpdated: new Date().toISOString(),
    };
    await saveStrategy(updatedStrategy);
    tracker.complete('strategy_update', { remainingTopics: updatedStrategy.pendingTopics.length });

    const state = await loadGrowthState();
    await saveGrowthState({
      lastDailyPublish: new Date().toISOString(),
      totalPostsPublished: (state.totalPostsPublished || 0) + 1,
      activeClusters: (await listClusters()).length,
      systemStatus: 'idle',
    });

    const pipeline = tracker.finish({
      slug,
      title: generated.title,
      qualityGate: {
        seoScore: qualityGate.seoScore,
        llmScore: qualityGate.llmScore.score,
        llmGrade: qualityGate.llmScore.grade,
      },
      aiCallsUsed: 2,
      backlinkCount,
    });

    await logGrowthRun({
      type: 'daily_publish',
      status: qualityGate.passed ? 'success' : 'partial',
      details: {
        slug,
        title: generated.title,
        clusterId,
        seoScore: qualityGate.seoScore,
        llmScore: qualityGate.llmScore.score,
        llmGrade: qualityGate.llmScore.grade,
        internalLinks: internalLinks.length,
        backlinkCount,
        aiCallsUsed: 2,
        coverImage: 'deterministic-svg',
        pipelineSteps: pipeline.steps.length,
        totalDurationMs: pipeline.totalDurationMs,
        issues: qualityGate.blockers,
      },
    });

    return {
      slug,
      title: generated.title,
      seoScore: qualityGate.seoScore,
      llmScore: qualityGate.llmScore.score,
      llmGrade: qualityGate.llmScore.grade,
      clusterId,
      pipeline,
      dryRun: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!dryRun) {
      await saveGrowthState({ systemStatus: 'error', lastError: message });
      await logGrowthRun({ type: 'daily_publish', status: 'error', details: { error: message } });
    }
    tracker.finish({ error: message });
    throw error;
  }
}

// ─── Keyword Discovery ────────────────────────────────────────────────────────

export async function runKeywordDiscovery(): Promise<number> {
  const strategy = (await loadStrategy()) ?? (await initializeStrategy());
  const existing = [
    ...strategy.primaryKeywords,
    ...strategy.longTailKeywords,
    ...(await listKeywords()).map((k) => k.keyword),
  ];

  const keywords = await runKeywordDiscoveryAgent(existing);
  await saveKeywords(keywords);

  const newTopics: TopicIdea[] = keywords
    .filter((k) => k.trend !== 'declining' && k.volumeEstimate !== 'low')
    .slice(0, 5)
    .map((k) => ({
      title: k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1),
      angle: `Comprehensive recruiter-focused guide covering ${k.keyword} with salary data, trends, and actionable advice for remote job seekers`,
      targetKeywords: [k.keyword, ...k.relatedKeywords.slice(0, 3)],
      priority: k.trend === 'rising' ? 1 : 2,
    }));

  const existingTitles = new Set([
    ...strategy.pendingTopics.map((t) => t.title.toLowerCase()),
    ...strategy.usedTopics.map((t) => t.toLowerCase()),
  ]);
  const fresh = newTopics.filter((t) => !existingTitles.has(t.title.toLowerCase()));

  if (fresh.length > 0) {
    await saveStrategy({
      ...strategy,
      pendingTopics: [...strategy.pendingTopics, ...fresh].sort((a, b) => a.priority - b.priority),
      primaryKeywords: [...new Set([...strategy.primaryKeywords, ...keywords.slice(0, 5).map((k) => k.keyword)])].slice(0, 15),
      lastUpdated: new Date().toISOString(),
    });
  }

  await saveGrowthState({ lastKeywordDiscovery: new Date().toISOString() });
  await logGrowthRun({ type: 'keyword_discovery', status: 'success', details: { count: keywords.length, topicsAdded: fresh.length } });

  return keywords.length;
}

// ─── Competitor Analysis ──────────────────────────────────────────────────────

export async function runCompetitorAnalysis(): Promise<number> {
  const competitors = await runCompetitorAnalysisAgent();
  await saveCompetitors(competitors);

  const strategy = (await loadStrategy()) ?? (await initializeStrategy());
  const insights = competitors
    .map((c) => `${c.name}: gaps — ${c.contentGaps.slice(0, 2).join('; ')}`)
    .join('\n');

  await saveStrategy({
    ...strategy,
    competitorInsights: insights,
    lastUpdated: new Date().toISOString(),
  });

  await saveGrowthState({ lastCompetitorAnalysis: new Date().toISOString() });
  await logGrowthRun({ type: 'competitor_analysis', status: 'success', details: { count: competitors.length } });

  return competitors.length;
}

// ─── Monthly Learning Loop ────────────────────────────────────────────────────

export async function runMonthlyLearningLoop(): Promise<string> {
  const strategy = (await loadStrategy()) ?? (await initializeStrategy());
  const posts = await listBlogPosts(100);
  const metrics = await listPageMetrics(100);
  const keywords = await listKeywords(100);

  const scores = buildPerformanceScores(metrics, posts);
  const report = await runLearningAgent(scores, keywords, strategy);
  await saveLearningReport(report);

  const performanceSummary = `Winners: ${report.trafficWinners.map((w) => w.title).join(', ') || 'none'}. Losers: ${report.trafficLosers.map((l) => l.title).join(', ') || 'none'}.`;

  const competitors = await listCompetitors();
  const plan = await runStrategyAgent(strategy, keywords, competitors, performanceSummary);
  await saveStrategyPlan(plan);

  const newTopics: TopicIdea[] = plan.contentCalendar
    .flatMap((w) => w.topics)
    .slice(0, 8)
    .map((t) => ({
      title: t.title,
      angle: t.angle,
      targetKeywords: t.targetKeywords,
      priority: 1,
    }));

  const existingTitles = new Set([
    ...strategy.pendingTopics.map((t) => t.title.toLowerCase()),
    ...strategy.usedTopics.map((t) => t.toLowerCase()),
  ]);
  const fresh = newTopics.filter((t) => !existingTitles.has(t.title.toLowerCase()));

  await saveStrategy({
    ...strategy,
    version: plan.version,
    pendingTopics: [...strategy.pendingTopics, ...fresh].sort((a, b) => a.priority - b.priority),
    primaryKeywords: plan.priorityKeywords,
    llmOptimizationGuidance: plan.llmOptimizationFocus.join('. '),
    lastUpdated: new Date().toISOString(),
    lastAnalysisDate: new Date().toISOString(),
  });

  for (const suggestion of report.refreshSuggestions.slice(0, 2)) {
    if (!suggestion.slug || suggestion.slug === 'slug-or-placeholder') continue;
    const post = await getBlogPostBySlug(suggestion.slug);
    if (post) {
      try {
        await refreshContent(suggestion.slug, suggestion.reason);
      } catch {
        // Non-blocking
      }
    }
  }

  await saveGrowthState({ lastMonthlyLearning: new Date().toISOString() });
  await logGrowthRun({
    type: 'monthly_learning',
    status: 'success',
    details: {
      reportId: report.id,
      winners: report.trafficWinners.length,
      losers: report.trafficLosers.length,
      emergingKeywords: report.emergingKeywords.length,
      topicsAdded: fresh.length,
    },
  });

  return report.id;
}

// ─── Content Refresh ──────────────────────────────────────────────────────────

export async function refreshContent(slug: string, reason: string): Promise<void> {
  const post = await getBlogPostBySlug(slug);
  if (!post) throw new Error(`Post not found: ${slug}`);

  const refreshedContent = await runContentRefreshAgent(post, reason);
  const faq = extractFaq(refreshedContent);
  const enhanced = post as EnhancedBlogPost;

  const updated: EnhancedBlogPost = {
    ...enhanced,
    content: refreshedContent,
    faq,
    refreshedAt: new Date().toISOString(),
    schema: runSchemaAgent({ ...post, content: refreshedContent, faq, refreshedAt: new Date().toISOString() }),
    seoValidation: runSeoValidationAgent({ ...post, content: refreshedContent, faq }),
  };

  await saveBlogPost(updated as BlogPost);
  await logGrowthRun({ type: 'content_refresh', status: 'success', details: { slug, reason } });
}

// ─── Admin Dashboard Data ─────────────────────────────────────────────────────

export async function getContentGrowthDashboard() {
  const [state, keywords, competitors, clusters, metrics, runs, reports, plan, posts, strategy] =
    await Promise.all([
      loadGrowthState(),
      listKeywords(50),
      listCompetitors(),
      listClusters(),
      listPageMetrics(30),
      listGrowthRuns(30),
      listLearningReports(6),
      getLatestStrategyPlan(),
      listBlogPosts(50),
      loadStrategy(),
    ]);

  const metricsBySlug = new Map(metrics.map((m) => [m.slug, m]));
  const performanceScores = buildPerformanceScores(metrics, posts);

  const postSummaries = posts.map((p) =>
    buildPostAdminSummary(
      p,
      metricsBySlug.get(p.slug)?.pageviews ?? 0,
      metricsBySlug.get(p.slug)?.ctaClicks ?? 0
    )
  );

  const operational = buildOperationalChecks(state, strategy, {
    openRouter: Boolean(process.env.OPENROUTER_API_KEY),
    firebase: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
  });

  return {
    state,
    schedule: getCronSchedule(),
    operational,
    strategy: buildStrategyAdminView(strategy, plan),
    keywords: keywords.slice(0, 30),
    allKeywords: keywords,
    competitors,
    clusters,
    metrics: metrics.slice(0, 20),
    runs,
    learningReports: reports,
    posts: postSummaries,
    recentPosts: postSummaries.slice(0, 10),
    performanceScores: performanceScores.slice(0, 15),
    summary: {
      totalKeywords: keywords.length,
      totalClusters: clusters.length,
      totalPosts: posts.length,
      pendingTopics: strategy?.pendingTopics?.length ?? 0,
      avgSeoScore: postSummaries.length
        ? Math.round(
            postSummaries
              .filter((p) => p.seoScore != null)
              .reduce((s, p) => s + (p.seoScore ?? 0), 0) /
              Math.max(1, postSummaries.filter((p) => p.seoScore != null).length)
          )
        : 0,
      avgLlmScore: postSummaries.length
        ? Math.round(
            postSummaries
              .filter((p) => p.llmScore != null)
              .reduce((s, p) => s + (p.llmScore ?? 0), 0) /
              Math.max(1, postSummaries.filter((p) => p.llmScore != null).length)
          )
        : 0,
      totalPageviews: metrics.reduce((s, m) => s + m.pageviews, 0),
    },
    models: {
      research: 'perplexity/sonar-pro',
      writing: 'anthropic/claude-opus-4-6',
      dailyAiCalls: 2,
      coverImages: 'deterministic-svg (zero AI)',
    },
  };
}

export async function getPostAdminDetail(slug: string) {
  const post = await getBlogPostBySlug(slug);
  if (!post) return null;

  const m = await getPageMetrics(slug);

  const { content, coverImageDataUri, ...rest } = post;
  void coverImageDataUri;

  return {
    ...buildPostAdminSummary(post, m?.pageviews ?? 0, m?.ctaClicks ?? 0),
    contentPreview: content.slice(0, 3000),
    contentLength: content.length,
    wordCount: content.split(/\s+/).length,
    faq: post.faq,
    definitions: post.definitions,
    salaryBenchmarks: post.salaryBenchmarks,
    hiringTrends: post.hiringTrends,
    internalLinks: post.internalLinks,
    entityTags: post.entityTags,
    tags: post.tags,
    targetKeywords: post.targetKeywords,
    schema: post.schema,
    seoValidation: post.seoValidation,
    llmOptimization: post.llmOptimization,
    comparisonTableMarkdown: post.comparisonTableMarkdown,
  };
}

export { getCronSchedule };
export { runDailyContentPipeline as generateAndPublishPostEnhanced };
