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
  env: { openRouter: boolean; firebase: boolean; cronSecret: boolean }
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
    label: 'External cron configured',
    passed: env.cronSecret,
    severity: 'critical',
    detail: env.cronSecret
      ? 'CRON_SECRET set — use cron-job.org → POST /api/cron/tick daily'
      : 'Missing CRON_SECRET',
    action: 'Add CRON_SECRET in Vercel and create one cron-job.org job (see docs/CRON_SETUP.md)',
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
  checks.push({
    id: 'recent_publish',
    label: 'Published in last 36 hours',
    passed: hoursSincePublish < 36,
    severity: 'warning',
    detail:
      lastPublish > 0
        ? `Last publish: ${Math.round(hoursSincePublish)}h ago`
        : 'No publish recorded yet',
    action: hoursSincePublish >= 36 ? 'Check Vercel cron logs or trigger manual publish' : undefined,
  });

  checks.push({
    id: 'external_cron',
    label: 'Daily scheduler (cron-job.org)',
    passed: true,
    severity: 'info',
    detail: 'POST https://hireschema.com/api/cron/tick daily at 08:00 UTC',
    action: 'See docs/CRON_SETUP.md — one job runs Scout + blog automation',
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
