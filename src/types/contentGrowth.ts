/** Shared types for the autonomous Content Growth System */

export interface DiscoveredKeyword {
  keyword: string;
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  volumeEstimate: 'high' | 'medium' | 'low';
  difficulty: 'high' | 'medium' | 'low';
  trend: 'rising' | 'stable' | 'declining';
  clusterId: string;
  relatedKeywords: string[];
  discoveredAt: string;
  lastSeenAt: string;
}

export interface CompetitorProfile {
  name: string;
  url: string;
  strengths: string[];
  weaknesses: string[];
  contentGaps: string[];
  topRankingTopics: string[];
  analyzedAt: string;
}

export interface TopicalCluster {
  id: string;
  name: string;
  pillarSlug?: string;
  keywords: string[];
  postSlugs: string[];
  authorityScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentDefinition {
  term: string;
  definition: string;
}

export interface SalaryBenchmark {
  role: string;
  median: string;
  range: string;
  region: string;
  source?: string;
}

export interface HiringTrend {
  trend: string;
  impact: string;
  timeframe: string;
}

export interface InternalLink {
  slug: string;
  title: string;
  anchorText: string;
  relevanceScore: number;
}

export interface StructuredDataSchema {
  article: Record<string, unknown>;
  faqPage?: Record<string, unknown>;
  breadcrumb?: Record<string, unknown>;
}

export interface SeoValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
  warnings: string[];
}

export interface PageMetrics {
  slug: string;
  pageviews: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;
  ctaClicks: number;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
}

export interface RankingSnapshot {
  keyword: string;
  slug: string;
  position: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  recordedAt: string;
}

export interface ContentPerformanceScore {
  slug: string;
  title: string;
  score: number;
  pageviews: number;
  rankingAvg: number | null;
  trend: 'winner' | 'loser' | 'stable';
  lastCalculatedAt: string;
}

export interface MonthlyLearningReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  trafficWinners: ContentPerformanceScore[];
  trafficLosers: ContentPerformanceScore[];
  emergingKeywords: string[];
  decliningKeywords: string[];
  refreshSuggestions: { slug: string; title: string; reason: string }[];
  newClusterOpportunities: { clusterName: string; keywords: string[]; rationale: string }[];
  strategyUpdates: string[];
  createdAt: string;
}

export interface ContentGrowthState {
  lastKeywordDiscovery: string | null;
  lastCompetitorAnalysis: string | null;
  lastMonthlyLearning: string | null;
  lastDailyPublish: string | null;
  totalPostsPublished: number;
  activeClusters: number;
  systemStatus: 'idle' | 'running' | 'error';
  lastError: string | null;
  evergreenSeeded?: boolean;
  evergreenSeededAt?: string | null;
  ga4PropertyId?: string;
  gscSiteUrl?: string;
  /** UTC date (YYYY-MM-DD) when GitHub Actions dispatch succeeded for daily blog */
  lastAutoDispatchDate?: string | null;
  lastAutoDispatchAt?: string | null;
  lastAutoDispatchError?: string | null;
  updatedAt: string;
}

export interface ContentStrategyPlan {
  version: number;
  month: string;
  focusClusters: string[];
  priorityKeywords: string[];
  contentCalendar: {
    week: number;
    topics: { title: string; angle: string; targetKeywords: string[]; clusterId: string }[];
  }[];
  competitorActions: string[];
  llmOptimizationFocus: string[];
  internalLinkingPlan: string[];
  createdAt: string;
}

export interface EnhancedBlogPostFields {
  directAnswer: string;
  definitions: ContentDefinition[];
  salaryBenchmarks: SalaryBenchmark[];
  hiringTrends: HiringTrend[];
  comparisonTableMarkdown?: string;
  imageAltText: string;
  clusterId: string;
  internalLinks: InternalLink[];
  schema: StructuredDataSchema;
  seoValidation: SeoValidationResult;
  performanceScore?: number;
  entityTags: string[];
  refreshedAt?: string;
}

export interface ContentGrowthRunLog {
  type:
    | 'keyword_discovery'
    | 'competitor_analysis'
    | 'daily_publish'
    | 'monthly_learning'
    | 'content_refresh'
    | 'content_expand'
    | 'evergreen_seed'
    | 'strategy_update'
    | 'analytics_sync';
  status: 'success' | 'error' | 'partial';
  details: Record<string, unknown>;
  createdAt: string;
}
