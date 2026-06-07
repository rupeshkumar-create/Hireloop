/**
 * scripts/run-content-cron.ts
 *
 * Runs long-running content growth jobs inside GitHub Actions (Hobby-safe).
 * Vercel Hobby caps serverless functions at 60s — the blog pipeline needs minutes.
 *
 * Cron mode:
 *   JOB=daily-blog npx tsx scripts/run-content-cron.ts
 *   JOB=weekly-analysis npx tsx scripts/run-content-cron.ts
 *   JOB=monthly-learning npx tsx scripts/run-content-cron.ts
 *
 * Dry run (no publish):
 *   JOB=daily-blog DRY_RUN=true npx tsx scripts/run-content-cron.ts
 *
 * Required env (GitHub secrets):
 *   FIREBASE_SERVICE_ACCOUNT_KEY
 *   OPENROUTER_API_KEY
 *   FIRESTORE_DATABASE_ID (optional)
 */

import {
  runDailyContentPipeline,
  runKeywordDiscovery,
  runCompetitorAnalysis,
  runMonthlyLearningLoop,
} from '../src/server/contentGrowth/orchestrator.js';
import { runWeeklyTrendPipeline } from '../src/server/contentGrowth/weeklyTrendPipeline.js';
import { hasPublishedToday } from '../src/server/contentGrowth/ensureDailyPublishLogic.js';
import { listBlogPosts } from '../src/server/marketingEngine.js';
import { loadStrategy, initializeStrategy, runWeeklyAnalysis } from '../src/server/marketingEngine.js';
import { getAdminDb } from '../src/server/firebaseAdmin.js';

type ContentCronJob = 'daily-blog' | 'weekly-trends' | 'weekly-analysis' | 'monthly-learning';

function resolveJob(): ContentCronJob {
  const raw = (process.env.JOB || 'weekly-trends').trim();
  if (
    raw === 'daily-blog' ||
    raw === 'weekly-trends' ||
    raw === 'weekly-analysis' ||
    raw === 'monthly-learning'
  ) {
    return raw;
  }
  throw new Error(`Unknown JOB "${raw}". Use weekly-trends, weekly-analysis, or monthly-learning.`);
}

async function runWeeklyAnalysisJob() {
  let strategy = await loadStrategy();
  if (!strategy) {
    strategy = await initializeStrategy();
  }

  const [updatedStrategy, keywordCount, competitorCount] = await Promise.all([
    runWeeklyAnalysis(strategy),
    runKeywordDiscovery().catch(() => 0),
    runCompetitorAnalysis().catch(() => 0),
  ]);

  const db = getAdminDb();
  await db.collection('marketing_runs').add({
    type: 'weekly_analysis',
    strategyVersion: updatedStrategy.version,
    newTopicsAdded: updatedStrategy.pendingTopics.length - strategy.pendingTopics.length,
    keywordsDiscovered: keywordCount,
    competitorsAnalyzed: competitorCount,
    lastAnalysisDate: updatedStrategy.lastAnalysisDate,
    createdAt: new Date().toISOString(),
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        job: 'weekly-analysis',
        strategyVersion: updatedStrategy.version,
        pendingTopics: updatedStrategy.pendingTopics.length,
        keywordsDiscovered: keywordCount,
        competitorsAnalyzed: competitorCount,
        lastAnalysisDate: updatedStrategy.lastAnalysisDate,
      },
      null,
      2
    )
  );
}

async function main() {
  const job = resolveJob();
  const dryRun = process.env.DRY_RUN === 'true';

  switch (job) {
    case 'weekly-trends': {
      const result = await runWeeklyTrendPipeline({ dryRun });
      console.log(JSON.stringify({ success: true, job, dryRun, result }, null, 2));
      break;
    }
    case 'daily-blog': {
      if (!dryRun && process.env.FORCE_PUBLISH !== 'true') {
        const recentPosts = await listBlogPosts(10);
        if (hasPublishedToday(recentPosts)) {
          console.log(
            JSON.stringify({
              success: true,
              job,
              skipped: true,
              reason: 'already_published_today',
            })
          );
          break;
        }
      }
      const result = await runDailyContentPipeline({ dryRun });
      console.log(JSON.stringify({ success: true, job, dryRun, result }, null, 2));
      break;
    }
    case 'weekly-analysis':
      await runWeeklyAnalysisJob();
      break;
    case 'monthly-learning': {
      const reportId = await runMonthlyLearningLoop();
      console.log(JSON.stringify({ success: true, job, reportId }, null, 2));
      break;
    }
    default:
      throw new Error(`Unhandled job: ${job}`);
  }
}

main().catch((error) => {
  console.error('[run-content-cron] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
