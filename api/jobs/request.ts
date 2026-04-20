/**
 * /api/jobs/request
 *
 * Lightweight endpoint for the "Generate my jobs now" button.
 * Returns 202 immediately after dispatching a GitHub Actions workflow_dispatch
 * event — no long-running AI work happens inside this function.
 *
 * The actual pipeline (researchJobs → matchAndRankJobs → store → email) runs
 * inside GitHub Actions where there is no Vercel function-timeout constraint.
 *
 * The frontend watches profile.lastJobFetchTime via Firestore onSnapshot so
 * the dashboard updates automatically when GitHub Actions finishes writing jobs.
 *
 * Required Vercel env vars:
 *   GITHUB_DISPATCH_TOKEN  — GitHub PAT with `repo` scope
 *   GITHUB_REPO            — e.g. "rupesh7128/hireschema"
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth } from '../_lib/firebaseAdmin.js';
import { getCronRunDateIST } from '../../src/services/cronEngine.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── Auth: verify Firebase ID token ──────────────────────────────────────
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return res.status(401).json({ error: 'Missing Authorization header' });

    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    // ── Verify GitHub dispatch is configured ────────────────────────────────
    const githubToken = process.env.GITHUB_DISPATCH_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;

    if (!githubToken || !githubRepo) {
      // GitHub Actions not configured — tell the client to fall back to the
      // direct (synchronous) trigger endpoint.
      return res.status(503).json({
        error: 'async_not_configured',
        message: 'GitHub Actions dispatch is not set up; use /api/jobs/trigger instead.',
      });
    }

    // ── Dispatch repository_dispatch to GitHub Actions ──────────────────────
    const runDate = getCronRunDateIST();

    let ghResponse: Response;
  try {
      ghResponse = await fetch(
        `https://api.github.com/repos/${githubRepo}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'generate-jobs-for-user',
            client_payload: { userId: uid, runDate },
          }),
        }
      );
    } catch (fetchErr) {
      console.error('[jobs/request] GitHub fetch threw:', fetchErr);
      return res.status(503).json({
        error: 'async_not_configured',
        message: 'GitHub Actions unreachable; use /api/jobs/trigger instead.',
      });
    }

    if (!ghResponse.ok) {
      const body = await ghResponse.text().catch(() => '');
      console.error('[jobs/request] GitHub dispatch failed:', ghResponse.status, body);

      let hint = '';
      if (ghResponse.status === 401 || ghResponse.status === 403) {
        hint = ' — check that GITHUB_DISPATCH_TOKEN has the "repo" scope';
      } else if (ghResponse.status === 404) {
        hint = ` — repo "${githubRepo}" not found or token lacks access`;
      } else if (ghResponse.status === 422) {
        hint = ' — workflow file may be missing the repository_dispatch trigger';
      }

      return res.status(502).json({
        error: `GitHub dispatch failed (HTTP ${ghResponse.status})${hint}`,
        githubStatus: ghResponse.status,
      });
    }

    // 202: client should now listen to Firestore for the result
    return res.status(202).json({
      status: 'dispatched',
      runDate,
      message: 'Job generation started. Your dashboard will update automatically in ~2 minutes.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[jobs/request] Unexpected failure:', message);
    return res.status(500).json({ error: message });
  }
}
