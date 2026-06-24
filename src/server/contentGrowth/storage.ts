import {
  addDoc,
  getDoc,
  getDocByPath,
  queryDocs,
  setDoc,
  setDocByPath,
} from '../db/docStore.js';
import type {
  CompetitorProfile,
  ContentGrowthRunLog,
  ContentGrowthState,
  ContentPerformanceScore,
  ContentStrategyPlan,
  DiscoveredKeyword,
  MonthlyLearningReport,
  PageMetrics,
  RankingSnapshot,
  TopicalCluster,
} from '../../types/contentGrowth.js';

const STATE_DOC = 'content_growth/state';
const KEYWORDS_COLLECTION = 'content_keywords';
const COMPETITORS_COLLECTION = 'content_competitors';
const CLUSTERS_COLLECTION = 'content_clusters';
const METRICS_COLLECTION = 'content_metrics';
const RANKINGS_COLLECTION = 'content_rankings';
const LEARNING_COLLECTION = 'content_learning_reports';
const STRATEGY_PLANS_COLLECTION = 'content_strategy_plans';
const RUNS_COLLECTION = 'content_growth_runs';

export async function loadGrowthState(): Promise<ContentGrowthState> {
  const doc = await getDocByPath(STATE_DOC);
  if (doc.exists && doc.data) return doc.data as ContentGrowthState;

  const initial: ContentGrowthState = {
    lastKeywordDiscovery: null,
    lastCompetitorAnalysis: null,
    lastMonthlyLearning: null,
    lastDailyPublish: null,
    totalPostsPublished: 0,
    activeClusters: 0,
    systemStatus: 'idle',
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
  await setDocByPath(STATE_DOC, initial);
  return initial;
}

export async function saveGrowthState(state: Partial<ContentGrowthState>): Promise<void> {
  await setDocByPath(STATE_DOC, { ...state, updatedAt: new Date().toISOString() }, true);
}

export async function saveKeywords(keywords: DiscoveredKeyword[]): Promise<void> {
  for (const kw of keywords) {
    const id = kw.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
    await setDoc(KEYWORDS_COLLECTION, id, kw as unknown as Record<string, unknown>, true);
  }
}

export async function listKeywords(limit = 100): Promise<DiscoveredKeyword[]> {
  const docs = await queryDocs(KEYWORDS_COLLECTION, {
    orderBy: { field: 'lastSeenAt', ascending: false },
    limit,
  });
  return docs.map((d) => d.data as DiscoveredKeyword);
}

export async function saveCompetitors(competitors: CompetitorProfile[]): Promise<void> {
  for (const c of competitors) {
    const id = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await setDoc(COMPETITORS_COLLECTION, id, c as unknown as Record<string, unknown>, true);
  }
}

export async function listCompetitors(): Promise<CompetitorProfile[]> {
  const docs = await queryDocs(COMPETITORS_COLLECTION, {
    orderBy: { field: 'analyzedAt', ascending: false },
    limit: 20,
  });
  return docs.map((d) => d.data as CompetitorProfile);
}

export async function saveCluster(cluster: TopicalCluster): Promise<void> {
  await setDoc(CLUSTERS_COLLECTION, cluster.id, cluster as unknown as Record<string, unknown>, true);
}

export async function listClusters(): Promise<TopicalCluster[]> {
  const docs = await queryDocs(CLUSTERS_COLLECTION, {
    orderBy: { field: 'authorityScore', ascending: false },
    limit: 50,
  });
  return docs.map((d) => d.data as TopicalCluster);
}

export async function savePageMetrics(metrics: PageMetrics): Promise<void> {
  await setDoc(METRICS_COLLECTION, metrics.slug, metrics as unknown as Record<string, unknown>, true);
}

export async function getPageMetrics(slug: string): Promise<PageMetrics | null> {
  const doc = await getDoc(METRICS_COLLECTION, slug);
  return doc.data ? (doc.data as PageMetrics) : null;
}

export async function listPageMetrics(limit = 100): Promise<PageMetrics[]> {
  const docs = await queryDocs(METRICS_COLLECTION, {
    orderBy: { field: 'pageviews', ascending: false },
    limit,
  });
  return docs.map((d) => d.data as PageMetrics);
}

export async function recordRanking(snapshot: RankingSnapshot): Promise<void> {
  const id = `${snapshot.slug}_${snapshot.keyword}_${snapshot.recordedAt.split('T')[0]}`;
  await setDoc(RANKINGS_COLLECTION, id, snapshot as unknown as Record<string, unknown>, false);
}

export async function listRankingsForSlug(slug: string): Promise<RankingSnapshot[]> {
  const docs = await queryDocs(RANKINGS_COLLECTION, {
    where: [{ field: 'slug', op: 'eq', value: slug }],
    orderBy: { field: 'recordedAt', ascending: false },
    limit: 50,
  });
  return docs.map((d) => d.data as RankingSnapshot);
}

export async function saveLearningReport(report: MonthlyLearningReport): Promise<void> {
  await setDoc(LEARNING_COLLECTION, report.id, report as unknown as Record<string, unknown>, false);
}

export async function listLearningReports(limit = 12): Promise<MonthlyLearningReport[]> {
  const docs = await queryDocs(LEARNING_COLLECTION, {
    orderBy: { field: 'createdAt', ascending: false },
    limit,
  });
  return docs.map((d) => d.data as MonthlyLearningReport);
}

export async function saveStrategyPlan(plan: ContentStrategyPlan): Promise<void> {
  await setDoc(STRATEGY_PLANS_COLLECTION, plan.month, plan as unknown as Record<string, unknown>, false);
}

export async function getLatestStrategyPlan(): Promise<ContentStrategyPlan | null> {
  const docs = await queryDocs(STRATEGY_PLANS_COLLECTION, {
    orderBy: { field: 'createdAt', ascending: false },
    limit: 1,
  });
  return docs[0] ? (docs[0].data as ContentStrategyPlan) : null;
}

export async function logGrowthRun(log: Omit<ContentGrowthRunLog, 'createdAt'>): Promise<void> {
  await addDoc(RUNS_COLLECTION, { ...log, createdAt: new Date().toISOString() });
}

export async function listGrowthRuns(limit = 50): Promise<(ContentGrowthRunLog & { id: string })[]> {
  const docs = await queryDocs(RUNS_COLLECTION, {
    orderBy: { field: 'createdAt', ascending: false },
    limit,
  });
  return docs.map((d) => ({ id: d.id, ...(d.data as ContentGrowthRunLog) }));
}

export async function incrementPageview(slug: string, timeOnPage = 0): Promise<void> {
  const doc = await getDoc(METRICS_COLLECTION, slug);
  const now = new Date().toISOString();
  const periodStart = new Date();
  periodStart.setDate(1);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);

  if (!doc.exists || !doc.data) {
    await setDoc(METRICS_COLLECTION, slug, {
      slug,
      pageviews: 1,
      uniqueVisitors: 1,
      avgTimeOnPage: timeOnPage,
      bounceRate: 0,
      ctaClicks: 0,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      updatedAt: now,
    } satisfies PageMetrics as unknown as Record<string, unknown>);
    return;
  }

  const data = doc.data as PageMetrics;
  const views = data.pageviews + 1;
  const avgTime =
    data.avgTimeOnPage > 0
      ? Math.round((data.avgTimeOnPage * data.pageviews + timeOnPage) / views)
      : timeOnPage;

  await setDoc(METRICS_COLLECTION, slug, { pageviews: views, avgTimeOnPage: avgTime, updatedAt: now }, true);
}

export async function recordCtaClick(slug: string): Promise<void> {
  const doc = await getDoc(METRICS_COLLECTION, slug);
  if (!doc.exists) {
    await incrementPageview(slug);
    await setDoc(METRICS_COLLECTION, slug, { ctaClicks: 1 }, true);
    return;
  }
  const data = doc.data as PageMetrics;
  await setDoc(
    METRICS_COLLECTION,
    slug,
    { ctaClicks: (data.ctaClicks || 0) + 1, updatedAt: new Date().toISOString() },
    true
  );
}

export function buildPerformanceScores(
  metrics: PageMetrics[],
  posts: { slug: string; title: string; targetKeywords?: string[] }[]
): ContentPerformanceScore[] {
  const metricsBySlug = new Map(metrics.map((m) => [m.slug, m]));

  return posts.map((post) => {
    const m = metricsBySlug.get(post.slug);
    const pageviews = m?.pageviews ?? 0;
    const avgTime = m?.avgTimeOnPage ?? 0;
    const ctaRate = m && m.pageviews > 0 ? (m.ctaClicks / m.pageviews) * 100 : 0;
    const score = Math.min(
      100,
      Math.round(pageviews * 0.4 + avgTime * 0.3 + ctaRate * 10 + (post.targetKeywords?.length ?? 0) * 2)
    );

    let trend: ContentPerformanceScore['trend'] = 'stable';
    if (score >= 60) trend = 'winner';
    else if (score < 25 && pageviews > 0) trend = 'loser';

    return {
      slug: post.slug,
      title: post.title,
      score,
      pageviews,
      rankingAvg: null,
      trend,
      lastCalculatedAt: new Date().toISOString(),
    };
  });
}
