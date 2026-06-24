export type AtsProvider = 'greenhouse' | 'lever';

export type AtsSource = {
  id: string;
  companyName: string;
  ats: AtsProvider;
  boardUrl: string;
  enabled: boolean;
  remoteOnly: boolean;
  tags: string[];
};

export function extractGreenhouseToken(boardUrl: string): string | null {
  try {
    const url = new URL(boardUrl);
    if (url.hostname !== 'boards.greenhouse.io') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const token = parts[0];
    return token ? token.trim() : null;
  } catch {
    return null;
  }
}

export function extractLeverToken(boardUrl: string): string | null {
  try {
    const url = new URL(boardUrl);
    if (url.hostname !== 'jobs.lever.co') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const token = parts[0];
    return token ? token.trim() : null;
  } catch {
    return null;
  }
}

export async function loadAtsAllowlist(_getAdminDb?: () => unknown): Promise<AtsSource[]> {
  const { queryDocs } = await import('../../server/db/docStore.js');
  const docs = await queryDocs('job_sources', {
    where: [{ field: 'enabled', op: 'eq', value: true }],
  });

  const sources: AtsSource[] = [];
  for (const doc of docs) {
    const data = doc.data;
    const companyName = typeof data.companyName === 'string' ? data.companyName.trim() : '';
    const ats = data.ats === 'greenhouse' || data.ats === 'lever' ? (data.ats as AtsProvider) : null;
    const boardUrl = typeof data.boardUrl === 'string' ? data.boardUrl.trim() : '';
    const enabled = data.enabled === true;
    const remoteOnly = data.remoteOnly !== false;
    const tags = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string') : [];

    if (!companyName || !ats || !boardUrl || !enabled) continue;
    sources.push({ id: doc.id, companyName, ats, boardUrl, enabled, remoteOnly, tags });
  }

  return sources;
}
