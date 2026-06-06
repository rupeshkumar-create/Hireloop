import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface OperationalCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  detail: string;
  action?: string;
}

interface TopicIdea {
  title: string;
  angle: string;
  targetKeywords: string[];
  priority: number;
}

interface StrategyView {
  version: number;
  targetAudience: string;
  contentPillars: string[];
  primaryKeywords: string[];
  longTailKeywords: string[];
  competitorInsights: string;
  llmOptimizationGuidance: string;
  lastUpdated: string;
  lastAnalysisDate: string | null;
  pendingTopics: TopicIdea[];
  usedTopics: string[];
  stats: { pendingCount: number; publishedCount: number; nextTopic: TopicIdea | null };
  monthlyPlan: {
    month: string;
    focusClusters: string[];
    priorityKeywords: string[];
    competitorActions: string[];
    llmOptimizationFocus: string[];
    internalLinkingPlan: string[];
    contentCalendar: { week: number; topics: TopicIdea[] }[];
  } | null;
}

interface PostSummary {
  slug: string;
  title: string;
  category: string;
  clusterId?: string;
  publishedAt: string;
  seoScore?: number;
  llmScore?: number;
  llmGrade?: string;
  faqCount: number;
  internalLinksCount: number;
  pageviews?: number;
  wordCount?: number;
  meetsWordTarget?: boolean;
  status: string;
}

interface PostDetail extends PostSummary {
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  directAnswer?: string;
  tags: string[];
  targetKeywords: string[];
  definitionsCount: number;
  salaryBenchmarksCount: number;
  hiringTrendsCount: number;
  entityTagsCount: number;
  seoPassed?: boolean;
  seoIssues?: string[];
  llmRecommendations?: string[];
  slopPhrases?: string[];
  coverImageUrl?: string;
  hasSchema: boolean;
  ctaClicks?: number;
  contentPreview?: string;
  contentLength?: number;
  faq?: { question: string; answer: string }[];
  definitions?: { term: string; definition: string }[];
  internalLinks?: { slug: string; title: string; anchorText: string }[];
  entityTags?: string[];
  refreshedAt?: string;
}

interface GrowthDashboard {
  state: {
    systemStatus: string;
    lastDailyPublish: string | null;
    lastKeywordDiscovery: string | null;
    lastCompetitorAnalysis: string | null;
    lastMonthlyLearning: string | null;
    totalPostsPublished: number;
    activeClusters: number;
    lastError: string | null;
  };
  operational: { ready: boolean; checks: OperationalCheck[] };
  strategy: StrategyView | null;
  schedule: { id: string; name: string; utcTime: string; description: string; aiCalls: number; path: string }[];
  models: { research: string; writing: string; dailyAiCalls: number; coverImages: string };
  summary: {
    totalPosts: number;
    pendingTopics: number;
    totalKeywords: number;
    totalClusters: number;
    totalPageviews: number;
    avgSeoScore: number;
    avgLlmScore: number;
  };
  posts: PostSummary[];
  loadErrors?: string[];
  runs: { id: string; type: string; status: string; createdAt: string; details: Record<string, unknown> }[];
  keywords: { keyword: string; trend: string; clusterId: string }[];
  clusters: { id: string; name: string; postSlugs: string[]; authorityScore: number }[];
  learningReports: { id: string; createdAt: string; emergingKeywords: string[]; strategyUpdates: string[] }[];
}

type Tab = 'overview' | 'strategy' | 'posts' | 'activity';

const EMPTY_DASHBOARD: GrowthDashboard = {
  state: {
    systemStatus: 'idle',
    lastDailyPublish: null,
    lastKeywordDiscovery: null,
    lastCompetitorAnalysis: null,
    lastMonthlyLearning: null,
    totalPostsPublished: 0,
    activeClusters: 0,
    lastError: null,
  },
  operational: { ready: false, checks: [] },
  strategy: null,
  schedule: [],
  models: { research: '—', writing: '—', dailyAiCalls: 0, coverImages: '—' },
  summary: {
    totalPosts: 0,
    pendingTopics: 0,
    totalKeywords: 0,
    totalClusters: 0,
    totalPageviews: 0,
    avgSeoScore: 0,
    avgLlmScore: 0,
  },
  posts: [],
  runs: [],
  keywords: [],
  clusters: [],
  learningReports: [],
};

function normalizeDashboard(raw: unknown): GrowthDashboard | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<GrowthDashboard>;
  if (!r.state && !r.operational && !r.schedule) return null;
  return {
    ...EMPTY_DASHBOARD,
    ...r,
    state: { ...EMPTY_DASHBOARD.state, ...r.state },
    operational: { ...EMPTY_DASHBOARD.operational, ...r.operational },
    models: { ...EMPTY_DASHBOARD.models, ...r.models },
    summary: { ...EMPTY_DASHBOARD.summary, ...r.summary },
    posts: Array.isArray(r.posts) ? r.posts : [],
    runs: Array.isArray(r.runs) ? r.runs : [],
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    clusters: Array.isArray(r.clusters) ? r.clusters : [],
    learningReports: Array.isArray(r.learningReports) ? r.learningReports : [],
    schedule: Array.isArray(r.schedule) ? r.schedule : [],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
    idle: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
    error: 'border-red-500/40 bg-red-500/10 text-red-500',
  };
  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', styles[status] ?? 'border-border text-foreground-muted')}>
      {status}
    </span>
  );
}

function CheckIcon({ passed }: { passed: boolean }) {
  return (
    <span className={cn('text-sm', passed ? 'text-emerald-600' : 'text-red-500')}>
      {passed ? '✓' : '✗'}
    </span>
  );
}

function GradeBadge({ grade }: { grade?: string }) {
  if (!grade) return <span className="text-xs text-foreground-muted">—</span>;
  const colors: Record<string, string> = { A: 'text-emerald-600', B: 'text-blue-500', C: 'text-amber-600', D: 'text-orange-500', F: 'text-red-500' };
  return <span className={cn('font-mono text-xs font-bold', colors[grade] ?? 'text-foreground-muted')}>{grade}</span>;
}

// ── Post Detail Modal ──────────────────────────────────────────────────────────

function PostDetailModal({ slug, onClose, getToken }: { slug: string; onClose: () => void; getToken: () => Promise<string> }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken()
      .then((token) => fetch(`/api/admin/content-growth?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` } }))
      .then((r) => r.json())
      .then((d) => { setPost(d.post); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug, getToken]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between border-b border-border bg-surface px-6 py-4">
          <div>
            <h3 className="text-lg font-medium">{loading ? 'Loading…' : post?.title}</h3>
            {post && <p className="mt-1 font-mono text-xs text-foreground-muted">/blog/{post.slug}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        {loading && <div className="p-8 text-center text-foreground-muted">Loading post details…</div>}

        {post && (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['SEO Score', post.seoScore ?? '—'],
                ['LLM Grade', post.llmGrade ?? '—'],
                ['LLM Score', post.llmScore ?? '—'],
                ['Pageviews', post.pageviews ?? 0],
                ['FAQs', post.faqCount],
                ['Words', post.wordCount != null ? `${post.wordCount}${post.meetsWordTarget === false ? ' ⚠' : ''}` : '—'],
                ['Links', post.internalLinksCount],
                ['CTA Clicks', post.ctaClicks ?? 0],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-foreground-muted">{k}</p>
                  <p className="text-sm font-medium">{v}</p>
                </div>
              ))}
            </div>

            <Section title="SEO">
              <Field label="SEO Title" value={post.seoTitle} />
              <Field label="Meta Description" value={post.seoDescription} />
              <Field label="Category" value={post.category} />
              <Field label="Cluster" value={post.clusterId} />
              <Field label="Keywords" value={post.targetKeywords?.join(', ')} />
              <Field label="Tags" value={post.tags?.join(', ')} />
              {post.seoIssues && post.seoIssues.length > 0 && (
                <p className="text-xs text-amber-600">Issues: {post.seoIssues.join('; ')}</p>
              )}
            </Section>

            <Section title="LLM Optimization">
              <Field label="Direct Answer" value={post.directAnswer} />
              <Field label="Entity Tags" value={post.entityTags?.join(', ')} />
              <Field label="Definitions" value={`${post.definitionsCount} terms`} />
              <Field label="Salary Benchmarks" value={`${post.salaryBenchmarksCount} rows`} />
              <Field label="Hiring Trends" value={`${post.hiringTrendsCount} trends`} />
              <Field label="Schema" value={post.hasSchema ? 'Article + FAQ + Breadcrumb' : 'Missing'} />
              {post.slopPhrases && post.slopPhrases.length > 0 && (
                <p className="text-xs text-red-500">Slop phrases: {post.slopPhrases.join(', ')}</p>
              )}
            </Section>

            {post.faq && post.faq.length > 0 && (
              <Section title={`FAQ (${post.faq.length})`}>
                {post.faq.map((f) => (
                  <div key={f.question} className="mb-2">
                    <p className="text-sm font-medium">{f.question}</p>
                    <p className="text-xs text-foreground-muted">{f.answer}</p>
                  </div>
                ))}
              </Section>
            )}

            {post.internalLinks && post.internalLinks.length > 0 && (
              <Section title="Internal Links">
                {post.internalLinks.map((l) => (
                  <a key={l.slug} href={`/blog/${l.slug}`} target="_blank" rel="noopener noreferrer" className="block text-sm text-foreground-muted hover:underline">
                    → {l.anchorText || l.title}
                  </a>
                ))}
              </Section>
            )}

            {post.contentPreview && (
              <Section title="Content Preview">
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs text-foreground-muted">
                  {post.contentPreview}…
                </pre>
              </Section>
            )}

            <div className="flex gap-2">
              <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">View Live</Button>
              </a>
              {post.coverImageUrl && (
                <a href={post.coverImageUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm">Cover Image</Button>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[11px] text-foreground-muted">{label}: </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function ContentGrowthPanel() {
  const { realUser } = useAuth();
  const [data, setData] = useState<GrowthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedPost, setSelectedPost] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!realUser) throw new Error('Not authenticated');
    return realUser.getIdToken();
  }, [realUser]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!realUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/content-growth', { headers: { Authorization: `Bearer ${token}` } });
      const contentType = res.headers.get('content-type') ?? '';
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${res.status})`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error('Admin API returned an invalid response. Redeploy the latest code and try again.');
      }
      const normalized = normalizeDashboard(payload);
      if (!normalized) {
        throw new Error('Could not parse dashboard data. The admin API may be misconfigured.');
      }
      setData(normalized);
      if (Array.isArray(normalized.loadErrors) && normalized.loadErrors.length > 0) {
        toast.warning(`Some dashboard data could not load (${normalized.loadErrors.length} issue(s))`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load content growth data';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [realUser, getToken]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const runAction = async (action: string, body?: Record<string, string>) => {
    setActionLoading(action);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/content-growth?action=${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Action failed');
      toast.success(
        action === 'dry-run'
          ? `Dry run done — grade ${result.result?.llmGrade}`
          : action === 'expand-posts'
            ? `Expanded ${result.expanded?.length ?? 0} post(s)`
            : action === 'seed-evergreen'
              ? result.message ?? `Seeded ${result.created?.length ?? 0} evergreen posts`
              : `${action} completed`
      );
      await loadDashboard();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return <div className="py-12 text-center text-foreground-muted">Loading content growth system…</div>;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border p-8 text-center">
        <p className="text-foreground-muted">{loadError ?? 'Could not load dashboard.'}</p>
        {loadError?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') && (
          <p className="mt-2 text-xs text-foreground-muted">
            Add FIREBASE_SERVICE_ACCOUNT_KEY in Vercel → Settings → Environment Variables, then redeploy.
          </p>
        )}
        {loadError?.includes('super admin') && (
          <p className="mt-2 text-xs text-foreground-muted">
            Sign in with an allowlisted admin email ({'rupesh7126@gmail.com'} or kv3244@gmail.com).
          </p>
        )}
        <Button variant="outline" size="sm" className="mt-4" onClick={loadDashboard}>Retry</Button>
      </div>
    );
  }

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['strategy', 'Strategy'],
    ['posts', `Posts (${data.posts.length})`],
    ['activity', 'Activity'],
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">Content Growth System</h2>
          <p className="text-sm text-foreground-muted">
            {data.models.dailyAiCalls} AI calls/day · {data.summary.pendingTopics} topics queued
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={data.state.systemStatus} />
          {data.operational.ready ? (
            <span className="text-xs text-emerald-600">Ready for daily cron</span>
          ) : (
            <span className="text-xs text-red-500">Not ready — fix checks below</span>
          )}
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {data.loadErrors && data.loadErrors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium">Partial data loaded</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {data.loadErrors.slice(0, 3).map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {data.state.lastError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Last error: {data.state.lastError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === id ? 'border-foreground text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Daily success checklist */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-medium">Daily Success Checklist</h3>
            <p className="mb-4 text-xs text-foreground-muted">
              All critical checks must pass for the 08:00 UTC cron to publish automatically.
            </p>
            <div className="space-y-2">
              {data.operational.checks.map((check) => (
                <div key={check.id} className="flex items-start gap-3 rounded-lg border border-border/50 px-4 py-3">
                  <CheckIcon passed={check.passed} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{check.label}</p>
                      <span className={cn(
                        'text-[10px] uppercase',
                        check.severity === 'critical' ? 'text-red-500' : check.severity === 'warning' ? 'text-amber-600' : 'text-foreground-muted'
                      )}>
                        {check.severity}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-muted">{check.detail}</p>
                    {!check.passed && check.action && (
                      <p className="mt-1 text-xs text-amber-600">→ {check.action}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Published', data.summary.totalPosts],
              ['Queued', data.summary.pendingTopics],
              ['Avg SEO', data.summary.avgSeoScore],
              ['Avg LLM', data.summary.avgLlmScore],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-xl font-medium">{v}</p>
                <p className="text-xs text-foreground-muted">{l}</p>
              </div>
            ))}
          </div>

          {/* Schedule */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium">Autonomous Schedule</h3>
            {data.schedule.map((job) => (
              <div key={job.id} className="flex justify-between border-b border-border/50 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{job.name}</p>
                  <p className="text-xs text-foreground-muted">{job.description}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-medium">{job.utcTime}</p>
                  <p className="text-foreground-muted">{job.aiCalls} AI calls</p>
                </div>
              </div>
            ))}
          </section>

          {/* Controls */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium">Manual Controls</h3>
            <div className="flex flex-wrap gap-2">
              {[
                ['dry-run', 'Dry Run'],
                ['publish', 'Publish Now'],
                ['health', 'Health Check'],
                ['keywords', 'Discover Keywords'],
                ['competitors', 'Analyze Competitors'],
                ['learning', 'Monthly Learning'],
                ['expand-posts', 'Expand Short Posts'],
                ['seed-evergreen', 'Seed 10 Evergreen Posts'],
              ].map(([action, label]) => (
                <Button key={action} variant="outline" size="sm" disabled={actionLoading !== null} onClick={() => runAction(action)}>
                  {actionLoading === action ? 'Running…' : label}
                </Button>
              ))}
            </div>
            <div className="mt-3 grid gap-1 text-xs text-foreground-muted md:grid-cols-2">
              <span>Last publish: {fmtDate(data.state.lastDailyPublish)}</span>
              <span>Last keywords: {fmtDate(data.state.lastKeywordDiscovery)}</span>
              <span>Last competitors: {fmtDate(data.state.lastCompetitorAnalysis)}</span>
              <span>Last learning: {fmtDate(data.state.lastMonthlyLearning)}</span>
            </div>
          </section>

          {/* Next up */}
          {data.strategy?.stats.nextTopic && (
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="text-sm font-medium">Next Scheduled Publish</h3>
              <p className="mt-1 text-sm">{data.strategy?.stats.nextTopic.title}</p>
              <p className="mt-1 text-xs text-foreground-muted">{data.strategy?.stats.nextTopic.angle}</p>
              <p className="mt-2 text-xs text-foreground-muted">
                Keywords: {data.strategy?.stats.nextTopic.targetKeywords.join(', ')}
              </p>
            </section>
          )}
        </div>
      )}

      {/* ── STRATEGY TAB ── */}
      {tab === 'strategy' && data.strategy && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <StatBox label="Strategy Version" value={`v${data.strategy.version}`} />
            <StatBox label="Pending Topics" value={data.strategy.stats.pendingCount} />
            <StatBox label="Published Topics" value={data.strategy.stats.publishedCount} />
          </div>

          <CollapsibleSection title="Target Audience" defaultOpen>
            <p className="text-sm text-foreground-muted">{data.strategy.targetAudience}</p>
          </CollapsibleSection>

          <CollapsibleSection title={`Content Pillars (${data.strategy.contentPillars.length})`} defaultOpen>
            <ul className="list-inside list-disc text-sm text-foreground-muted">
              {data.strategy.contentPillars.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title={`Primary Keywords (${data.strategy.primaryKeywords.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {data.strategy.primaryKeywords.map((k) => (
                <span key={k} className="rounded-md border border-border px-2 py-0.5 text-xs">{k}</span>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={`Long-tail Keywords (${data.strategy.longTailKeywords.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {data.strategy.longTailKeywords.map((k) => (
                <span key={k} className="rounded-md border border-border px-2 py-0.5 text-xs">{k}</span>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="LLM Optimization Guidance">
            <p className="text-sm text-foreground-muted">{data.strategy.llmOptimizationGuidance}</p>
          </CollapsibleSection>

          <CollapsibleSection title="Competitor Insights">
            <p className="whitespace-pre-wrap text-sm text-foreground-muted">{data.strategy.competitorInsights}</p>
          </CollapsibleSection>

          <CollapsibleSection title={`Pending Topic Queue (${data.strategy.pendingTopics.length})`} defaultOpen>
            <div className="space-y-3">
              {data.strategy.pendingTopics.map((t, i) => (
                <div key={t.title} className="rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground-muted">#{i + 1}</span>
                    <span className="text-xs text-amber-600">P{t.priority}</span>
                    {i === 0 && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">NEXT</span>}
                  </div>
                  <p className="mt-1 text-sm font-medium">{t.title}</p>
                  <p className="mt-1 text-xs text-foreground-muted">{t.angle}</p>
                  <p className="mt-1 text-xs text-foreground-muted">Keywords: {t.targetKeywords.join(', ')}</p>
                </div>
              ))}
              {data.strategy.pendingTopics.length === 0 && (
                <p className="text-sm text-red-500">Queue empty — daily cron will fail. Run keyword discovery.</p>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={`Published Topics (${data.strategy.usedTopics.length})`}>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm text-foreground-muted">
              {data.strategy.usedTopics.map((t) => <li key={t}>✓ {t}</li>)}
            </ul>
          </CollapsibleSection>

          {data.strategy.monthlyPlan && (
            <CollapsibleSection title={`Monthly Plan (${data.strategy.monthlyPlan.month})`} defaultOpen>
              <div className="space-y-4 text-sm">
                <Field label="Focus Clusters" value={data.strategy.monthlyPlan.focusClusters.join(', ')} />
                <Field label="Priority Keywords" value={data.strategy.monthlyPlan.priorityKeywords.join(', ')} />
                <Field label="LLM Focus" value={data.strategy.monthlyPlan.llmOptimizationFocus.join('; ')} />
                {data.strategy.monthlyPlan.contentCalendar.map((week) => (
                  <div key={week.week}>
                    <p className="text-xs font-medium uppercase text-foreground-muted">Week {week.week}</p>
                    {week.topics.map((t) => (
                      <p key={t.title} className="mt-1 text-sm text-foreground-muted">• {t.title}</p>
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          <p className="text-xs text-foreground-muted">
            Last updated: {fmtDate(data.strategy.lastUpdated)} · Last analysis: {fmtDate(data.strategy.lastAnalysisDate)}
          </p>
        </div>
      )}

      {tab === 'strategy' && !data.strategy && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <p className="text-sm">No strategy found. Seed it first.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => runAction('keywords')}>
            Initialize via Keyword Discovery
          </Button>
        </div>
      )}

      {/* ── POSTS TAB ── */}
      {tab === 'posts' && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left text-xs text-foreground-muted">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Cluster</th>
                <th className="px-4 py-3">SEO</th>
                <th className="px-4 py-3">LLM</th>
                <th className="px-4 py-3">FAQs</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.posts.map((post) => (
                <tr key={post.slug} className="hover:bg-muted/20">
                  <td className="max-w-xs truncate px-4 py-3 font-medium">{post.title}</td>
                  <td className="px-4 py-3 text-xs text-foreground-muted">{post.clusterId ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{post.seoScore ?? '—'}</td>
                  <td className="px-4 py-3"><GradeBadge grade={post.llmGrade} /></td>
                  <td className="px-4 py-3 text-xs">{post.faqCount}</td>
                  <td className="px-4 py-3 text-xs">{post.pageviews ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-foreground-muted">{fmtDate(post.publishedAt)}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedPost(post.slug)}>
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
              {data.posts.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-foreground-muted">No posts yet. Run Dry Run or Publish Now.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === 'activity' && (
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium">Pipeline Activity Log</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-foreground-muted">
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => (
                  <tr key={run.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{run.type}</td>
                    <td className="py-2 pr-4 text-xs">{run.status}</td>
                    <td className="py-2 pr-4 text-xs text-foreground-muted">{fmtDate(run.createdAt)}</td>
                    <td className="py-2 font-mono text-[11px] text-foreground-muted">{JSON.stringify(run.details).slice(0, 150)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium">Topical Clusters</h3>
            {data.clusters.map((c) => (
              <div key={c.id} className="flex justify-between border-b border-border/50 py-2 text-sm last:border-0">
                <span>{c.name}</span>
                <span className="text-xs text-foreground-muted">{c.postSlugs.length} posts · authority {c.authorityScore}</span>
              </div>
            ))}
          </section>
        </div>
      )}

      {selectedPost && (
        <PostDetailModal slug={selectedPost} onClose={() => setSelectedPost(null)} getToken={getToken} />
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-lg font-medium">{value}</p>
      <p className="text-xs text-foreground-muted">{label}</p>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium"
        onClick={() => setOpen(!open)}
      >
        {title}
        <span className="text-foreground-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </section>
  );
}
