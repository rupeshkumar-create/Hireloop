const LINKEDIN_PROFILE_RE =
  /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%\-]+\/?(\?.*)?$/i;

export function normalizeLinkedInProfileUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.replace(/^www\./, '').toLowerCase().endsWith('linkedin.com')) {
      return null;
    }
    const path = parsed.pathname.replace(/\/+$/, '');
    if (!/^\/in\/[a-zA-Z0-9_%\-]+$/i.test(path)) {
      return null;
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function isValidLinkedInProfileUrl(raw: string): boolean {
  return normalizeLinkedInProfileUrl(raw) !== null || LINKEDIN_PROFILE_RE.test(raw.trim());
}

export function extractLinkedInFromHyperlinks(urls: string[]): string | undefined {
  for (const url of urls) {
    const normalized = normalizeLinkedInProfileUrl(url);
    if (normalized) return normalized;
  }
  return undefined;
}

export function profileTextFromLinkedInData(profile: Record<string, unknown>): string {
  const lines: string[] = [];
  const name = pick(profile, ['name', 'fullName', 'full_name']);
  const headline = pick(profile, ['headline', 'title', 'job_title']);
  const location = pick(profile, ['location', 'geo', 'city']);
  const summary = pick(profile, ['summary', 'about', 'description']);
  const company = pick(profile, ['current_company', 'company', 'currentCompany']);

  if (name) lines.push(name);
  if (headline) lines.push(headline);
  if (company) lines.push(`Current company: ${company}`);
  if (location) lines.push(`Location: ${location}`);
  if (summary) {
    lines.push('');
    lines.push(summary);
  }

  const experience = profile.experience ?? profile.experiences ?? profile.positions;
  if (Array.isArray(experience) && experience.length > 0) {
    lines.push('');
    lines.push('Experience:');
    for (const item of experience.slice(0, 8)) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const role = pick(row, ['title', 'position', 'role']);
      const org = pick(row, ['company', 'companyName', 'organization']);
      const dates = [pick(row, ['startDate', 'start']), pick(row, ['endDate', 'end'])]
        .filter(Boolean)
        .join(' – ');
      if (role || org) {
        lines.push(`- ${[role, org].filter(Boolean).join(' at ')}${dates ? ` (${dates})` : ''}`);
      }
    }
  }

  const skills = profile.skills;
  if (Array.isArray(skills) && skills.length > 0) {
    const skillNames = skills
      .map((s) => (typeof s === 'string' ? s : pick(s as Record<string, unknown>, ['name', 'skill'])))
      .filter(Boolean);
    if (skillNames.length > 0) {
      lines.push('');
      lines.push(`Skills: ${skillNames.slice(0, 30).join(', ')}`);
    }
  }

  return lines.join('\n').trim();
}

function pick(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
