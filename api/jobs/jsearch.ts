/**
 * /api/jobs/jsearch
 *
 * Server-side proxy for JSearch (RapidAPI). Called only from the cron pipeline
 * (never directly from the browser). Requires RAPIDAPI_KEY env var.
 *
 * If RAPIDAPI_KEY is absent the endpoint returns an empty job list so the cron
 * pipeline gracefully falls back to the free sources (Remotive, Arbeitnow, Jobicy).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rapidApiKey = process.env.RAPIDAPI_KEY || process.env.VITE_RAPIDAPI_KEY;

  // Graceful no-op when key is absent
  if (!rapidApiKey) {
    return res.status(200).json({ data: [], noKey: true });
  }

  try {
    const { query, num_pages = 2, date_posted = 'week', country } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const params = new URLSearchParams({
      query: String(query),
      num_pages: String(num_pages),
      date_posted: String(date_posted),
    });
    if (country) params.set('country', String(country));

    const response = await fetch(
      `https://jsearch.p.rapidapi.com/search?${params}`,
      {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[jsearch proxy] API error:', response.status, errText);
      return res.status(200).json({ data: [], error: `JSearch returned ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[jsearch proxy] Exception:', error);
    // Return empty so cron pipeline degrades gracefully
    return res.status(200).json({ data: [], error: error.message });
  }
}
