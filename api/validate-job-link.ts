import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = typeof req.body?.url === 'string' ? req.body.url : '';
  const allowedDomains = Array.isArray(req.body?.allowedDomains)
    ? req.body.allowedDomains.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  const blockedDomains = Array.isArray(req.body?.blockedDomains)
    ? req.body.blockedDomains.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  const skipNetworkFetchForDomains = Array.isArray(req.body?.skipNetworkFetchForDomains)
    ? req.body.skipNetworkFetchForDomains.filter(
        (value: unknown): value is string => typeof value === 'string'
      )
    : [];
  const allowCompanyCareerPages = req.body?.allowCompanyCareerPages === true;

  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  try {
    const lowerUrl = url.toLowerCase();
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      return res.status(200).json({ valid: false, finalUrl: lowerUrl });
    }

    const shouldSkipFetch = skipNetworkFetchForDomains.some((domain) =>
      lowerUrl.includes(domain.toLowerCase())
    );

    let finalUrl = lowerUrl;
    if (!shouldSkipFetch) {
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
      });

      if (response.status === 405) {
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
        });
      }

      if (!response.ok) {
        return res.status(200).json({ valid: false, finalUrl: response.url || url });
      }

      finalUrl = (response.url || url).toLowerCase();
    }

    const isBlocked = blockedDomains.some((domain) => finalUrl.includes(domain.toLowerCase()));
    const isAllowed = allowedDomains.some((domain) => finalUrl.includes(domain.toLowerCase()));
    const looksLikeCareerPage =
      allowCompanyCareerPages &&
      /careers|jobs|job-application|job\/|apply/.test(finalUrl) &&
      !isBlocked;
    const valid = !isBlocked && (isAllowed || looksLikeCareerPage);

    return res.status(200).json({ valid, finalUrl });
  } catch (error: any) {
    return res.status(200).json({ valid: false, error: error?.message || 'Validation failed' });
  }
}
