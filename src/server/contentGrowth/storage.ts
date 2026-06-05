import { getAdminDb } from '../firebaseAdmin.js';
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
  const db = getAdminDb();
  const doc = await db.doc(STATE_DOC).get();
  if (doc.exists) return doc.data() as ContentGrowthState;

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
  await db.doc(STATE_DOC).set(initial);
  return initial;
}

export async function saveGrowthState(state: Partial<ContentGrowthState>): Promise<void> {
  const db = getAdminDb();
  await db.doc(STATE_DOC).set(
    { ...state, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function saveKeywords(keywords: DiscoveredKeyword[]): Promise<void> {
  const db = getAdminDb();
  const batch = db.batch();
  for (const kw of keywords) {
    const id = kw.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
    batch.set(db.collection(KEYWORDS_COLLECTION).doc(id), kw, { merge: true });
  }
  await batch.commit();
}

export async function listKeywords(limit = 100): Promise<DiscoveredKeyword[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(KEYWORDS_COLLECTION)
    .orderBy('lastSeenAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as DiscoveredKeyword);
}

export async function saveCompetitors(competitors: CompetitorProfile[]): Promise<void> {
  const db = getAdminDb();
  const batch = db.batch();
  for (const c of competitors) {
    const id = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    batch.set(db.collection(COMPETITORS_COLLECTION).doc(id), c, { merge: true });
  }
  await batch.commit();
}

export async function listCompetitors(): Promise<CompetitorProfile[]> {
  const db = getAdminDb();
  const snap = await db.collection(COMPETITORS_COLLECTION).orderBy('analyzedAt', 'desc').limit(20).get();
  return snap.docs.map((d) => d.data() as CompetitorProfile);
}

export async function saveCluster(cluster: TopicalCluster): Promise<void> {
  const db = getAdminDb();
  await db.collection(CLUSTERS_COLLECTION).doc(cluster.id).set(cluster, { merge: true });
}

export async function listClusters(): Promise<TopicalCluster[]> {
  const db = getAdminDb();
  const snap = await db.collection(CLUSTERS_COLLECTION).orderBy('authorityScore', 'desc').limit(50).get();
  return snap.docs.map((d) => d.data() as TopicalCluster);
}

export async function savePageMetrics(metrics: PageMetrics): Promise<void> {
  const db = getAdminDb();
  await db.collection(METRICS_COLLECTION).doc(metrics.slug).set(metrics, { merge: true });
}

export async function getPageMetrics(slug: string): Promise<PageMetrics | null> {
  const db = getAdminDb();
  const doc = await db.collection(METRICS_COLLECTION).doc(slug).get();
  return doc.exists ? (doc.data() as PageMetrics) : null;
}

export async function listPageMetrics(limit = 100): Promise<PageMetrics[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(METRICS_COLLECTION)
    .orderBy('pageviews', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as PageMetrics);
}

export async function recordRanking(snapshot: RankingSnapshot): Promise<void> {
  const db = getAdminDb();
  const id = `${snapshot.slug}_${snapshot.keyword}_${snapshot.recordedAt.split('T')[0]}`;
  await db.collection(RANKINGS_COLLECTION).doc(id).set(snapshot);
}

export async function listRankingsForSlug(slug: string): Promise<RankingSnapshot[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(RANKINGS_COLLECTION)
    .where('slug', '==', slug)
    .orderBy('recordedAt', 'desc')
    .limit(50)
    .get();
  return snap.docs.map((d) => d.data() as RankingSnapshot);
}

export async function saveLearningReport(report: MonthlyLearningReport): Promise<void> {
  const db = getAdminDb();
  await db.collection(LEARNING_COLLECTION).doc(report.id).set(report);
}

export async function listLearningReports(limit = 12): Promise<MonthlyLearningReport[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(LEARNING_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as MonthlyLearningReport);
}

export async function saveStrategyPlan(plan: ContentStrategyPlan): Promise<void> {
  const db = getAdminDb();
  await db.collection(STRATEGY_PLANS_COLLECTION).doc(plan.month).set(plan);
}

export async function getLatestStrategyPlan(): Promise<ContentStrategyPlan | null> {
  const db = getAdminDb();
  const snap = await db
    .collection(STRATEGY_PLANS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as ContentStrategyPlan;
}

export async function logGrowthRun(log: Omit<ContentGrowthRunLog, 'createdAt'>): Promise<void> {
  const db = getAdminDb();
  await db.collection(RUNS_COLLECTION).add({ ...log, createdAt: new Date().toISOString() });
}

export async function listGrowthRuns(limit = 50): Promise<(ContentGrowthRunLog & { id: string })[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(RUNS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ContentGrowthRunLog) }));
}

export async function incrementPageview(slug: string, timeOnPage = 0): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(METRICS_COLLECTION).doc(slug);
  const doc = await ref.get();
  const now = new Date().toISOString();
  const periodStart = new Date();
  periodStart.setDate(1);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);

  if (!doc.exists) {
    await ref.set({
      slug,
      pageviews: 1,
      uniqueVisitors: 1,
      avgTimeOnPage: timeOnPage,
      bounceRate: 0,
      ctaClicks: 0,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      updatedAt: now,
    } satisfies PageMetrics);
    return;
  }

  const data = doc.data() as PageMetrics;
  const views = data.pageviews + 1;
  const avgTime =
    data.avgTimeOnPage > 0
      ? Math.round((data.avgTimeOnPage * data.pageviews + timeOnPage) / views)
      : timeOnPage;

  await ref.update({ pageviews: views, avgTimeOnPage: avgTime, updatedAt: now });
}

export async function recordCtaClick(slug: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(METRICS_COLLECTION).doc(slug);
  const doc = await ref.get();
  if (!doc.exists) {
    await incrementPageview(slug);
    await ref.update({ ctaClicks: 1 });
    return;
  }
  const data = doc.data() as PageMetrics;
  await ref.update({ ctaClicks: (data.ctaClicks || 0) + 1, updatedAt: new Date().toISOString() });
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
