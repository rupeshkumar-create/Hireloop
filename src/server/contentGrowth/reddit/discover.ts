/**
 * Discover trending Reddit discussions relevant to remote job search.
 * Uses public JSON endpoints — no OAuth required for read-only discovery.
 */
export interface RedditThread {
  id: string;
  title: string;
  subreddit: string;
  url: string;
  permalink: string;
  score: number;
  numComments: number;
  createdUtc: number;
  selftextPreview: string;
}

const SUBREDDITS = [
  'remotework',
  'jobs',
  'cscareerquestions',
  'recruitment',
  'Overemployed',
  'layoffs',
  'hiring',
];

const REMOTE_SIGNALS =
  /\b(remote|work from home|wfh|distributed|async|job search|apply|interview|resume|offer|layoff|hiring|recruiter|ats|salary|career)\b/i;

const GOSSIP_BLOCK =
  /\b(drama|gossip|relationship|politics|meme|shitpost|unpopular opinion)\b/i;

export async function discoverRedditThreads(limit = 25): Promise<RedditThread[]> {
  const sub = SUBREDDITS.join('+');
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}&raw_json=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'HireSchema-ContentBot/1.0 (hireschema.com)' },
  });

  if (!res.ok) {
    throw new Error(`Reddit discovery failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: { children?: { data: Record<string, unknown> }[] };
  };

  const threads: RedditThread[] = [];

  for (const child of data.data?.children ?? []) {
    const post = child.data;
    const title = String(post.title ?? '');
    const selftext = String(post.selftext ?? '').slice(0, 400);

    if (!REMOTE_SIGNALS.test(title + ' ' + selftext)) continue;
    if (GOSSIP_BLOCK.test(title)) continue;
    if (title.length < 20) continue;

    threads.push({
      id: String(post.id ?? ''),
      title,
      subreddit: String(post.subreddit ?? ''),
      url: `https://www.reddit.com${String(post.permalink ?? '')}`,
      permalink: String(post.permalink ?? ''),
      score: Number(post.score ?? 0),
      numComments: Number(post.num_comments ?? 0),
      createdUtc: Number(post.created_utc ?? 0),
      selftextPreview: selftext,
    });
  }

  return threads.sort((a, b) => b.score + b.numComments * 2 - (a.score + a.numComments * 2));
}

export function redditThreadToTopic(thread: RedditThread): {
  title: string;
  angle: string;
  targetKeywords: string[];
  source: string;
  redditUrl: string;
  priority: number;
} {
  const cleanTitle = thread.title.replace(/\[.*?\]/g, '').trim();
  const blogTitle = cleanTitle.endsWith('?')
    ? `${cleanTitle.slice(0, 80)} — What Remote Job Seekers Should Do (${new Date().getFullYear()})`
    : `What Reddit Is Saying About "${cleanTitle.slice(0, 60)}" (Remote Jobs ${new Date().getFullYear()})`;

  return {
    title: blogTitle.slice(0, 120),
    angle: `Community discussion from r/${thread.subreddit}: practical advice for remote job seekers, not gossip.`,
    targetKeywords: [
      'remote job search',
      thread.subreddit,
      'reddit job search advice',
      `remote jobs ${new Date().getFullYear()}`,
    ],
    source: `r/${thread.subreddit}`,
    redditUrl: thread.url,
    priority: thread.score + thread.numComments,
  };
}

export function scoreThreadNovelty(
  thread: RedditThread,
  existingTitles: string[]
): number {
  const normalized = thread.title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const dup = existingTitles.some((t) => {
    const n = t.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return n.includes(normalized.slice(0, 30)) || normalized.includes(n.slice(0, 30));
  });
  if (dup) return 0;
  return thread.score + thread.numComments * 3;
}
