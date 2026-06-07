/**
 * Dispatch long-running work to GitHub Actions (Hobby-safe).
 * Scout jobs use generate-jobs.yml; content growth uses content-cron.yml.
 */

export type ContentCronJob = 'daily-blog' | 'weekly-trends' | 'weekly-analysis' | 'monthly-learning';

function normalizeGithubRepoValue(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  return value
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

export function resolveGithubRepo(): string {
  const explicit = normalizeGithubRepoValue(process.env.GITHUB_REPO || '');
  if (explicit) return explicit;

  const owner = (process.env.VERCEL_GIT_REPO_OWNER || '').trim();
  const slug = (process.env.VERCEL_GIT_REPO_SLUG || '').trim();
  if (owner && slug) return `${owner}/${slug}`;

  return '';
}

export function resolveGithubDispatchToken(): string {
  return (
    (process.env.GITHUB_DISPATCH_TOKEN || '').trim() ||
    (process.env.GITHUB_PAT || '').trim()
  );
}

export function resolveGithubRef(): string {
  return (
    (process.env.GITHUB_DISPATCH_REF || '').trim() ||
    (process.env.VERCEL_GIT_COMMIT_REF || '').trim() ||
    'main'
  );
}

function githubDispatchHint(status: number, workflowFile: string): string {
  if (status === 401 || status === 403) {
    return 'Check GITHUB_DISPATCH_TOKEN permissions and repository access.';
  }
  if (status === 404) {
    return 'Check GITHUB_REPO or confirm the Vercel project is linked to the correct GitHub repository.';
  }
  if (status === 422) {
    return `Check that .github/workflows/${workflowFile} includes repository_dispatch.`;
  }
  return 'Check the GitHub Actions workflow and repository dispatch configuration.';
}

export async function dispatchContentCronWorkflow(options: {
  job: ContentCronJob;
  dryRun?: boolean;
}): Promise<{ ok: boolean; status: number; hint?: string }> {
  const githubRepo = resolveGithubRepo();
  const githubToken = resolveGithubDispatchToken();

  if (!githubRepo || !githubToken) {
    return { ok: false, status: 0, hint: 'Missing GITHUB_REPO or GITHUB_DISPATCH_TOKEN' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/actions/workflows/content-cron.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'hireschema-content-dispatch',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: resolveGithubRef(),
          inputs: {
            job: options.job,
            dry_run: options.dryRun === true,
          },
        }),
        signal: ctrl.signal,
      }
    );

    if (response.ok) {
      return { ok: true, status: response.status };
    }

    return {
      ok: false,
      status: response.status,
      hint: githubDispatchHint(response.status, 'content-cron.yml'),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function dispatchContentCronEvent(options: {
  job: ContentCronJob;
  dryRun?: boolean;
}): Promise<{ ok: boolean; status: number; hint?: string }> {
  const githubRepo = resolveGithubRepo();
  const githubToken = resolveGithubDispatchToken();

  if (!githubRepo || !githubToken) {
    return { ok: false, status: 0, hint: 'Missing GITHUB_REPO or GITHUB_DISPATCH_TOKEN' };
  }

  const response = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'hireschema-content-dispatch',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'run-content-cron',
      client_payload: { job: options.job, dryRun: options.dryRun === true },
    }),
  });

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  return {
    ok: false,
    status: response.status,
    hint: githubDispatchHint(response.status, 'content-cron.yml'),
  };
}

/** Prefer workflow_dispatch; fall back to repository_dispatch. */
export async function dispatchContentCron(options: {
  job: ContentCronJob;
  dryRun?: boolean;
}): Promise<{ ok: boolean; status: number; hint?: string }> {
  const primary = await dispatchContentCronWorkflow(options);
  if (primary.ok) return primary;
  if (primary.status === 404 || primary.status === 422) {
    return dispatchContentCronEvent(options);
  }
  return primary;
}
