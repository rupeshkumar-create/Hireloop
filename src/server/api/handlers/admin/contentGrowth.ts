/**
 * Super Admin — Content Growth System API
 *
 * GET  /api/admin/content-growth           → dashboard data
 * POST /api/admin/content-growth?action=  → trigger pipeline steps
 *
 * Actions: publish, dry-run, keywords, competitors, learning, refresh, expand-posts, seed-evergreen, health
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken, verifySuperAdmin } from '../../../adminAuth.js';
import {
  getContentGrowthDashboard,
  getPostAdminDetail,
  runDailyContentPipeline,
  runKeywordDiscovery,
  runCompetitorAnalysis,
  runMonthlyLearningLoop,
  refreshContent,
  expandShortBlogPosts,
} from '../../../contentGrowth/orchestrator.js';
import { seedEvergreenPosts } from '../../../contentGrowth/seedEvergreen.js';
import { saveGrowthState } from '../../../contentGrowth/storage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  try {
    await verifySuperAdmin(token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    if (message.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || message.includes('Failed to parse')) {
      return res.status(503).json({ error: message });
    }
    const status = (err as { status?: number }).status ?? 401;
    return res.status(status).json({ error: message });
  }

  if (req.method === 'GET') {
    try {
      const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
      if (slug) {
        const post = await getPostAdminDetail(slug);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        return res.status(200).json({ post });
      }

      const dashboard = await getContentGrowthDashboard();
      return res.status(200).json(dashboard);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  if (req.method === 'POST') {
    const action = typeof req.query.action === 'string' ? req.query.action : 'publish';
    const body = (req.body ?? {}) as { slug?: string; reason?: string; ga4PropertyId?: string; gscSiteUrl?: string };

    try {
      switch (action) {
        case 'publish': {
          const result = await runDailyContentPipeline({ dryRun: false });
          return res.status(200).json({ success: true, action, result });
        }
        case 'dry-run': {
          const result = await runDailyContentPipeline({ dryRun: true });
          return res.status(200).json({ success: true, action, result });
        }
        case 'health': {
          const dashboard = await getContentGrowthDashboard();
          const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
          const hasFirebase = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          const hasCron = Boolean(process.env.CRON_SECRET);
          return res.status(200).json({
            success: true,
            action,
            healthy: hasOpenRouter && hasFirebase,
            checks: {
              openRouter: hasOpenRouter,
              firebase: hasFirebase,
              cronSecret: hasCron,
            },
            schedule: dashboard.schedule,
            models: dashboard.models,
            pendingTopics: dashboard.strategyPlan ? undefined : 'check marketing/strategy',
          });
        }
        case 'keywords': {
          const count = await runKeywordDiscovery();
          return res.status(200).json({ success: true, action, keywordsDiscovered: count });
        }
        case 'competitors': {
          const count = await runCompetitorAnalysis();
          return res.status(200).json({ success: true, action, competitorsAnalyzed: count });
        }
        case 'learning': {
          const reportId = await runMonthlyLearningLoop();
          return res.status(200).json({ success: true, action, reportId });
        }
        case 'refresh': {
          if (!body.slug) return res.status(400).json({ error: 'slug required' });
          await refreshContent(body.slug, body.reason || 'Manual refresh from Super Admin');
          return res.status(200).json({ success: true, action, slug: body.slug });
        }
        case 'expand-posts': {
          const result = await expandShortBlogPosts({
            slug: body.slug,
            limit: body.slug ? 1 : 5,
          });
          return res.status(200).json({ success: true, action, ...result });
        }
        case 'seed-evergreen': {
          const result = await seedEvergreenPosts({ force: body.force === 'true' });
          return res.status(200).json({ success: true, action, ...result });
        }
        case 'config': {
          await saveGrowthState({
            ga4PropertyId: body.ga4PropertyId,
            gscSiteUrl: body.gscSiteUrl,
          });
          return res.status(200).json({ success: true, action });
        }
        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
