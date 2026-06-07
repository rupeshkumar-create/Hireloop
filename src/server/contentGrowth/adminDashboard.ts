/**
 * Admin dashboard builders — full strategy + post details for Super Admin.
 */

import type { BlogPost, MarketingStrategy } from '../marketingEngine.js';
import type { ContentGrowthState } from '../../types/contentGrowth.js';
import type { ContentStrategyPlan } from '../../types/contentGrowth.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from './wordCount.js';

export interface PostAdminSummary {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  category: string;
  tags: string[];
  targetKeywords: string[];
  clusterId?: string;
  status: string;
  publishedAt: string;
  refreshedAt?: string;
  readTimeMinutes: number;
  strategyVersion: number;
  directAnswer?: string;
  faqCount: number;
  definitionsCount: number;
  salaryBenchmarksCount: number;
  hiringTrendsCount: number;
  internalLinksCount: number;
  entityTagsCount: number;
  seoScore?: number;
  seoPassed?: boolean;
  seoIssues?: string[];
  llmScore?: number;
  llmGrade?: string;
  llmRecommendations?: string[];
  slopPhrases?: string[];
  coverImageUrl?: string;
  imageAltText?: string;
  hasSchema: boolean;
  pageviews?: number;
  ctaClicks?: number;
  wordCount?: number;
  meetsWordTarget?: boolean;
}

export function buildPostAdminSummary(
  post: Omit<BlogPost, 'content'> & { content?: string },
  pageviews = 0,
  ctaClicks = 0
): PostAdminSummary {
  const wordCount = post.content
    ? countWords(post.content)
    : (post.excerpt?.split(/\s+/).length ?? 0) * 5;

  return {
    slug: post.slug,
    title: post.title,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags ?? [],
    targetKeywords: post.targetKeywords ?? [],
    clusterId: post.clusterId,
    status: post.status,
    publishedAt: post.publishedAt,
    refreshedAt: post.refreshedAt,
    readTimeMinutes: post.readTimeMinutes,
    strategyVersion: post.strategyVersion,
    directAnswer: post.directAnswer,
    faqCount: post.faq?.length ?? 0,
    definitionsCount: post.definitions?.length ?? 0,
    salaryBenchmarksCount: post.salaryBenchmarks?.length ?? 0,
    hiringTrendsCount: post.hiringTrends?.length ?? 0,
    internalLinksCount: post.internalLinks?.length ?? 0,
    entityTagsCount: post.entityTags?.length ?? 0,
    seoScore: post.seoValidation?.score,
    seoPassed: post.seoValidation?.passed,
    seoIssues: [...(post.seoValidation?.issues ?? []), ...(post.seoValidation?.warnings ?? [])],
    llmScore: post.llmOptimization?.score,
    llmGrade: post.llmOptimization?.grade,
    llmRecommendations: post.llmOptimization?.recommendations,
    slopPhrases: post.llmOptimization?.slopPhrasesFound,
    coverImageUrl: post.coverImageUrl,
    imageAltText: post.imageAltText,
    hasSchema: Boolean(post.schema?.article),
    pageviews,
    ctaClicks,
    wordCount,
    meetsWordTarget: post.content ? meetsMinimumWordCount(post.content) : undefined,
  };
}

export interface OperationalCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  detail: string;
  action?: string;
}

export function buildOperationalChecks(
  state: ContentGrowthState,
  strategy: MarketingStrategy | null,
  env: { openRouter: boolean; firebase: boolean; cronSecret: boolean; githubDispatch?: boolean },
  publishContext?: { postPublishedToday?: boolean }
): { ready: boolean; checks: OperationalCheck[] } {
  const checks: OperationalCheck[] = [];

  checks.push({
    id: 'openrouter',
    label: 'OpenRouter API key',
    passed: env.openRouter,
    severity: 'critical',
    detail: env.openRouter ? 'Configured in Vercel env' : 'Missing OPENROUTER_API_KEY',
    action: 'Add OPENROUTER_API_KEY in Vercel → Settings → Environment Variables',
  });

  checks.push({
    id: 'firebase',
    label: 'Firebase Admin SDK',
    passed: env.firebase,
    severity: 'critical',
    detail: env.firebase ? 'Service account configured' : 'Missing FIREBASE_SERVICE_ACCOUNT_KEY',
    action: 'Add FIREBASE_SERVICE_ACCOUNT_KEY in Vercel env',
  });

  checks.push({
    id: 'cron_job',
    label: 'Cron authentication',
    passed: env.cronSecret || Boolean(env.githubDispatch),
    severity: 'info',
    detail: env.githubDispatch
      ? 'GITHUB_DISPATCH_TOKEN set — Publish Now dispatches GitHub Actions'
      : env.cronSecret
        ? 'CRON_SECRET set — manual /api/cron/* only (60s Vercel cap)'
        : 'Add GITHUB_DISPATCH_TOKEN for admin publish + scheduled GitHub workflows',
    action: !env.githubDispatch
      ? 'Add GITHUB_DISPATCH_TOKEN in Vercel env (repo workflow scope)'
      : undefined,
  });

  checks.push({
    id: 'strategy',
    label: 'Content strategy initialized',
    passed: Boolean(strategy),
    severity: 'critical',
    detail: strategy ? `Strategy v${strategy.version} loaded` : 'No marketing/strategy document',
    action: 'Run: POST /api/blog/seed-strategy?analyze=true with CRON_SECRET',
  });

  const pendingCount = strategy?.pendingTopics?.length ?? 0;
  checks.push({
    id: 'topic_queue',
    label: 'Topic queue has content',
    passed: pendingCount > 0,
    severity: 'critical',
    detail: pendingCount > 0 ? `${pendingCount} topics queued` : 'Queue empty — daily cron will fail',
    action: 'Click "Discover Keywords" or run weekly analysis to refill queue',
  });

  checks.push({
    id: 'system_status',
    label: 'System status healthy',
    passed: state.systemStatus !== 'error',
    severity: 'warning',
    detail: state.systemStatus === 'error' ? `Error: ${state.lastError}` : `Status: ${state.systemStatus}`,
    action: state.lastError ? 'Fix the error, then run Dry Run to verify' : undefined,
  });

  const lastPublish = state.lastDailyPublish ? new Date(state.lastDailyPublish).getTime() : 0;
  const hoursSincePublish = lastPublish ? (Date.now() - lastPublish) / (1000 * 60 * 60) : Infinity;
  const todayUtc = new Date().toISOString().split('T')[0];
  const hourUtc = new Date().getUTCHours();
  const publishedToday = Boolean(
    publishContext?.postPublishedToday ||
      state.lastDailyPublish?.startsWith(todayUtc)
  );
  const autoPublishPending = !publishedToday && hourUtc >= 8 && hourUtc < 18;
  checks.push({
    id: 'recent_publish',
    label: 'Published in last 36 hours',
    passed: publishedToday || hoursSincePublish < 36,
    severity: autoPublishPending ? 'info' : 'warning',
    detail: publishedToday
      ? `Today's post is live (${todayUtc} UTC)`
      : autoPublishPending
        ? `Auto-publish scheduled — GitHub Actions runs at 08:05, 09:00, 12:00, and 18:00 UTC`
        : lastPublish > 0
          ? `Last publish: ${Math.round(hoursSincePublish)}h ago — none yet today (${todayUtc} UTC)`
          : 'No publish recorded yet — autopilot will retry via GitHub Actions and RSS/sitemap triggers',
    action:
      !publishedToday && !autoPublishPending && hoursSincePublish >= 36
        ? 'Check GitHub Actions → Content Growth Cron / Generate Daily Jobs for errors'
        : undefined,
  });

  checks.push({
    id: 'github_scheduler',
    label: 'GitHub Actions autopilot',
    passed: Boolean(env.githubDispatch),
    severity: env.githubDispatch ? 'info' : 'critical',
    detail: env.githubDispatch
      ? 'Vercel dispatches GitHub on deploy + RSS/sitemap. Add VERCEL_TOKEN + ORG_ID + PROJECT_ID in GitHub secrets so scheduled runs can read your Vercel env.'
      : 'Missing GITHUB_DISPATCH_TOKEN in Vercel — autopilot cannot trigger GitHub Actions',
    action: env.githubDispatch
      ? 'GitHub → Settings → Secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID (see docs/CRON_SETUP.md)'
      : 'Add GITHUB_DISPATCH_TOKEN in Vercel env',
  });

  const criticalFailed = checks.filter((c) => c.severity === 'critical' && !c.passed);
  return { ready: criticalFailed.length === 0, checks };
}

export function buildStrategyAdminView(strategy: MarketingStrategy | null, plan: ContentStrategyPlan | null) {
  if (!strategy) return null;

  return {
    version: strategy.version,
    targetAudience: strategy.targetAudience,
    contentPillars: strategy.contentPillars,
    primaryKeywords: strategy.primaryKeywords,
    longTailKeywords: strategy.longTailKeywords,
    competitorInsights: strategy.competitorInsights,
    llmOptimizationGuidance: strategy.llmOptimizationGuidance,
    lastUpdated: strategy.lastUpdated,
    lastAnalysisDate: strategy.lastAnalysisDate,
    pendingTopics: strategy.pendingTopics,
    usedTopics: strategy.usedTopics,
    stats: {
      pendingCount: strategy.pendingTopics.length,
      publishedCount: strategy.usedTopics.length,
      nextTopic: strategy.pendingTopics[0] ?? null,
    },
    monthlyPlan: plan
      ? {
          month: plan.month,
          version: plan.version,
          focusClusters: plan.focusClusters,
          priorityKeywords: plan.priorityKeywords,
          competitorActions: plan.competitorActions,
          llmOptimizationFocus: plan.llmOptimizationFocus,
          internalLinkingPlan: plan.internalLinkingPlan,
          contentCalendar: plan.contentCalendar,
        }
      : null,
  };
}
