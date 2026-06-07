/**
 * After each Vercel production build, dispatch the content-cron workflow
 * so daily blog publish runs without manual clicks. The workflow skips if
 * today's post already exists.
 */
const token = (process.env.GITHUB_DISPATCH_TOKEN || process.env.GITHUB_PAT || '').trim();
const explicitRepo = (process.env.GITHUB_REPO || '')
  .trim()
  .replace(/^https?:\/\/github\.com\//i, '')
  .replace(/^github\.com\//i, '')
  .replace(/\.git$/i, '')
  .replace(/^\/+|\/+$/g, '');

const owner = (process.env.VERCEL_GIT_REPO_OWNER || '').trim();
const slug = (process.env.VERCEL_GIT_REPO_SLUG || '').trim();
const repo = explicitRepo || (owner && slug ? `${owner}/${slug}` : '');

async function main() {
  if (process.env.CONTENT_AUTOPILOT_ON_DEPLOY === 'false') return;
  if (process.env.VERCEL !== '1') return;
  if (process.env.VERCEL_ENV !== 'production') return;
  if (new Date().getUTCHours() < 8) return;
  if (!token || !repo) {
    console.warn('[postbuild-dispatch-blog] skip: missing GITHUB_DISPATCH_TOKEN or repo');
    return;
  }

  const ref = (process.env.GITHUB_DISPATCH_REF || process.env.VERCEL_GIT_COMMIT_REF || 'main').trim();
  const response = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/content-cron.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'hireschema-postbuild-dispatch',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref,
        inputs: { job: 'daily-blog', dry_run: false },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn(`[postbuild-dispatch-blog] dispatch failed HTTP ${response.status}: ${body.slice(0, 200)}`);
    return;
  }

  console.log(`[postbuild-dispatch-blog] dispatched content-cron.yml on ${ref} for ${repo}`);
}

main().catch((error) => {
  console.warn('[postbuild-dispatch-blog] error:', error instanceof Error ? error.message : error);
});
