/**
 * Optional IndexNow pings for faster search-engine discovery.
 * Set INDEXNOW_KEY in env and host https://hireschema.com/{INDEXNOW_KEY}.txt
 */
const BASE = 'https://hireschema.com';
const HOST = 'hireschema.com';

export async function pingIndexNow(urls: string[]): Promise<{ ok: boolean; submitted: number }> {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || urls.length === 0) {
    return { ok: false, submitted: 0 };
  }

  const urlList = [...new Set(urls.map((u) => (u.startsWith('http') ? u : `${BASE}${u}`)))].slice(0, 10_000);

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `${BASE}/${key}.txt`,
        urlList,
      }),
    });
    return { ok: res.ok, submitted: urlList.length };
  } catch (error) {
    console.warn('[indexNow] ping failed:', error instanceof Error ? error.message : error);
    return { ok: false, submitted: 0 };
  }
}

export async function pingBlogSlugs(slugs: string[]): Promise<{ ok: boolean; submitted: number }> {
  return pingIndexNow(slugs.map((slug) => `${BASE}/blog/${slug}`));
}
