/**
 * jobResearcher.ts
 *
 * Feed/API-first job discovery for Daily Jobs.
 *
 * The daily matching pipeline should not need an LLM to find jobs. This module
 * pulls from public job APIs and RSS/Atom feeds, normalizes every listing into
 * the app's `DiscoveredJob` shape, then lets the matching engine rank them
 * against each user's resume and career paths.
 */

export type JobWorkType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type JobSource = string;

export interface DiscoveredJob {
  fingerprint: string;
  title: string;
  company: string;
  location: string;
  workType: JobWorkType;
  salary: string;
  description: string;
  requirements: string[];
  source: JobSource;
  applyUrl?: string;
  postedAt: string;
  daysOld: number;
  matchedCareerPath?: string;
}

export interface ResearchOptions {
  careerPaths: string[];
  resumeText: string;
  jobType?: string;
  location?: string;
  targetCount?: number;
  feedUrls?: string[];
}

export interface ResearchResult {
  jobs: DiscoveredJob[];
  sources: Record<JobSource, number>;
  totalFound: number;
  deduplicated: number;
}

export type CallAIFn = (
  messages: { role: string; content: string }[],
  model: string
) => Promise<string>;

type FeedKind = 'rss' | 'himalayas' | 'arbeitnow';

type FeedSource = {
  id: string;
  name: string;
  url: string;
  kind: FeedKind;
  enabled: boolean;
};

type RawFeedJob = {
  title: string;
  company?: string;
  location?: string;
  workType?: JobWorkType;
  salary?: string;
  description?: string;
  requirements?: string[];
  applyUrl?: string;
  postedAt?: string;
};

const DEFAULT_FEED_SOURCES: FeedSource[] = [
  {
    id: 'himalayas',
    name: 'Himalayas',
    kind: 'himalayas',
    url: 'https://himalayas.app/jobs/api?limit=20',
    enabled: true,
  },
  {
    id: 'arbeitnow',
    name: 'Arbeitnow',
    kind: 'arbeitnow',
    url: 'https://arbeitnow.com/api/job-board-api',
    enabled: true,
  },
  {
    id: 'jobicy-rss',
    name: 'Jobicy RSS',
    kind: 'rss',
    url: 'https://jobicy.com/jobs-rss-feed',
    enabled: true,
  },
  {
    id: 'hireweb3-rss',
    name: 'HireWeb3 RSS',
    kind: 'rss',
    url: 'https://hireweb3.io/job/rss',
    enabled: true,
  },
];

const SKILL_LIST = [
  'python', 'javascript', 'typescript', 'react', 'next.js', 'vue', 'angular',
  'node.js', 'golang', 'java', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'c++',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'linux',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'rest api',
  'machine learning', 'deep learning', 'data science', 'llm', 'ai', 'nlp',
  'tensorflow', 'pytorch', 'scikit-learn', 'spark', 'kafka', 'airflow',
  'devops', 'ci/cd', 'git', 'agile', 'scrum',
  'product management', 'product strategy', 'roadmap', 'figma', 'ux',
  'cybersecurity', 'penetration testing', 'blockchain', 'solidity',
  'scala', 'elixir', 'clojure', 'haskell', 'cloud', 'microservices',
];

export function jobFingerprint(title: string, company: string): string {
  return `${title.toLowerCase().trim()}::${company.toLowerCase().trim()}`;
}

function getEnvValue(name: string): string {
  if (typeof process === 'undefined') return '';
  return typeof process.env?.[name] === 'string' ? process.env[name] as string : '';
}

function splitConfiguredUrls(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfiguredSources(feedUrls: string[] = []): FeedSource[] {
  const envUrls = [
    ...splitConfiguredUrls(getEnvValue('JOB_RSS_FEEDS')),
    ...splitConfiguredUrls(getEnvValue('JOB_FEED_URLS')),
  ];

  const customSources = [...envUrls, ...feedUrls].map((url, index) => ({
    id: `custom-rss-${index + 1}`,
    name: `Custom RSS ${index + 1}`,
    kind: 'rss' as const,
    url,
    enabled: true,
  }));

  return [...DEFAULT_FEED_SOURCES, ...customSources].filter((source) => source.enabled);
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeHtml(match[1]).trim() : '';
}

function extractAnyTag(xml: string, tags: string[]): string {
  for (const tag of tags) {
    const value = extractTag(xml, tag);
    if (value) return value;
  }
  return '';
}

function extractAtomLink(entry: string): string {
  const hrefMatch = entry.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (hrefMatch?.[1]) return decodeHtml(hrefMatch[1]).trim();
  return extractTag(entry, 'link');
}

function parseDate(value: unknown): string {
  if (typeof value === 'number') {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  return new Date().toISOString();
}

function daysOld(postedAt: string): number {
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

function detectWorkType(text: string): JobWorkType {
  const lower = text.toLowerCase();
  if (/\bremote\b|work from anywhere|distributed/i.test(lower)) return 'remote';
  if (/\bhybrid\b/i.test(lower)) return 'hybrid';
  if (/on-?site|in office|in-office/i.test(lower)) return 'onsite';
  return 'unknown';
}

function inferCompany(title: string, fallback = 'Unknown Company'): string {
  const patterns = [
    /\bat\s+(.+)$/i,
    /\s[-–|]\s([^-|–]+)$/,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return fallback;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+\bat\s+.+$/i, '')
    .replace(/\s[-–|]\s[^-|–]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRequirements(description: string): string[] {
  const lower = description.toLowerCase();
  const skills = SKILL_LIST.filter((skill) => lower.includes(skill));
  if (skills.length > 0) return skills.slice(0, 8).map((skill) => skill.toUpperCase() === skill ? skill : skill);

  return description
    .split(/[.;]\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20 && part.length <= 140)
    .slice(0, 6);
}

function normalizeJob(raw: RawFeedJob, source: FeedSource): DiscoveredJob | null {
  const rawTitle = (raw.title || '').trim();
  const company = (raw.company || inferCompany(rawTitle)).trim();
  const title = cleanTitle(rawTitle);
  const description = stripHtml(raw.description || '');

  if (!title || !company || company === 'Unknown Company') return null;
  if (description.length < 30) return null;

  const location = (raw.location || 'Remote').trim();
  const postedAt = parseDate(raw.postedAt);
  const workType = raw.workType || detectWorkType(`${title} ${location} ${description}`);

  return {
    fingerprint: jobFingerprint(title, company),
    title,
    company,
    location,
    workType,
    salary: (raw.salary || '').trim(),
    description,
    requirements: raw.requirements?.length ? raw.requirements.slice(0, 8) : extractRequirements(description),
    source: source.id,
    applyUrl: raw.applyUrl?.trim(),
    postedAt,
    daysOld: daysOld(postedAt),
  };
}

function parseRssItems(xml: string): RawFeedJob[] {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((match) => match[0]);

  return blocks.map((block) => {
    const title = stripHtml(extractTag(block, 'title'));
    const company = stripHtml(extractAnyTag(block, [
      'hireweb3Jobs:companyName',
      'company',
      'dc:creator',
      'author',
    ]));
    const description = extractAnyTag(block, [
      'description',
      'summary',
      'content',
      'content:encoded',
    ]);
    const location = stripHtml(extractAnyTag(block, [
      'hireweb3Jobs:location',
      'location',
    ]));
    const locationType = stripHtml(extractAnyTag(block, [
      'hireweb3Jobs:locationType',
      'workType',
    ]));
    const minSalary = stripHtml(extractTag(block, 'hireweb3Jobs:minSalary'));
    const maxSalary = stripHtml(extractTag(block, 'hireweb3Jobs:maxSalary'));
    const salary = minSalary || maxSalary ? [minSalary, maxSalary].filter(Boolean).join(' - ') : '';

    return {
      title,
      company,
      location,
      workType: detectWorkType(`${location} ${locationType} ${description}`),
      salary,
      description,
      applyUrl: extractAtomLink(block),
      postedAt: extractAnyTag(block, ['pubDate', 'published', 'updated', 'dc:date']),
    };
  });
}

async function fetchRssSource(source: FeedSource): Promise<DiscoveredJob[]> {
  const response = await fetch(source.url, {
    headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
  });
  if (!response.ok) throw new Error(`${source.name} failed with HTTP ${response.status}`);
  const xml = await response.text();
  return parseRssItems(xml)
    .map((job) => normalizeJob(job, source))
    .filter((job): job is DiscoveredJob => job !== null);
}

async function fetchHimalayas(source: FeedSource): Promise<DiscoveredJob[]> {
  const urls = [source.url, 'https://himalayas.app/jobs/api?limit=20&offset=20'];
  const jobs: DiscoveredJob[] = [];

  for (const url of urls) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) continue;
    const data = await response.json();
    const items = Array.isArray(data) ? data : Array.isArray(data.jobs) ? data.jobs : [];

    for (const item of items) {
      const company =
        item.companyName ||
        item.company?.name ||
        item.company ||
        '';
      const location =
        item.location ||
        item.locations?.map((loc: any) => loc.name || loc).filter(Boolean).join(', ') ||
        'Remote';
      const raw = {
        title: item.title || item.name || '',
        company,
        location,
        workType: detectWorkType(`${location} ${item.description || ''}`),
        salary: item.salary || item.salaryRange || '',
        description: item.description || item.excerpt || '',
        applyUrl: item.applicationUrl || item.applyUrl || item.url,
        postedAt: item.pubDate || item.publishedAt || item.createdAt,
      };
      const normalized = normalizeJob(raw, source);
      if (normalized) jobs.push(normalized);
    }
  }

  return jobs;
}

async function fetchArbeitnow(source: FeedSource): Promise<DiscoveredJob[]> {
  const response = await fetch(source.url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${source.name} failed with HTTP ${response.status}`);

  const data = await response.json();
  const items = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];

  return items
    .map((item: any) => normalizeJob({
      title: item.title || '',
      company: item.company_name || item.company || '',
      location: item.location || (item.remote ? 'Remote' : ''),
      workType: item.remote ? 'remote' : detectWorkType(`${item.location || ''} ${item.description || ''}`),
      salary: item.salary || '',
      description: item.description || '',
      requirements: Array.isArray(item.tags) ? item.tags : [],
      applyUrl: item.url || item.apply_url,
      postedAt: item.created_at || item.date,
    }, source))
    .filter((job: DiscoveredJob | null): job is DiscoveredJob => job !== null);
}

async function fetchSource(source: FeedSource): Promise<DiscoveredJob[]> {
  try {
    if (source.kind === 'himalayas') return await fetchHimalayas(source);
    if (source.kind === 'arbeitnow') return await fetchArbeitnow(source);
    return await fetchRssSource(source);
  } catch (error) {
    console.warn(`[jobResearcher] ${source.name} skipped:`, error);
    return [];
  }
}

function deduplicateJobs(jobs: DiscoveredJob[]): { jobs: DiscoveredJob[]; deduplicated: number } {
  const seen = new Set<string>();
  const result: DiscoveredJob[] = [];

  for (const job of jobs) {
    const key = `${job.fingerprint}::${job.applyUrl || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(job);
  }

  return { jobs: result, deduplicated: jobs.length - result.length };
}

export async function researchJobs(
  opts: ResearchOptions,
  _callAI?: CallAIFn
): Promise<ResearchResult> {
  const target = opts.targetCount ?? 60;
  const sources = getConfiguredSources(opts.feedUrls);
  const results = await Promise.allSettled(sources.map(fetchSource));
  const allJobs = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const { jobs, deduplicated } = deduplicateJobs(allJobs);
  const selected = jobs
    .sort((a, b) => a.daysOld - b.daysOld)
    .slice(0, target);

  const sourceCounts: Record<string, number> = {};
  for (const job of selected) {
    sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
  }

  return {
    jobs: selected,
    sources: sourceCounts,
    totalFound: allJobs.length,
    deduplicated,
  };
}
