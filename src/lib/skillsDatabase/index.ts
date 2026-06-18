/**
 * Canonical skills database (~5K entries) for discovery, matching, and requirements extraction.
 */
import skillsData from './skills.json';

export type SkillCategory =
  | 'language'
  | 'framework'
  | 'library'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'data'
  | 'ml'
  | 'design'
  | 'product'
  | 'marketing'
  | 'sales'
  | 'support'
  | 'finance'
  | 'hr'
  | 'soft'
  | 'tool'
  | 'methodology'
  | 'certification'
  | 'domain';

export interface SkillEntry {
  id: string;
  name: string;
  aliases: string[];
  category: SkillCategory;
  roles: string[];
  searchTerms: string[];
}

export interface SkillsDatabaseFile {
  version: number;
  generatedAt: string;
  count: number;
  skills: SkillEntry[];
}

export interface ProfileSkillInput {
  careerPaths?: string[];
  resumeText?: string;
  structuredProfile?: {
    skills?: string[];
    techStack?: string[];
    roles?: string[];
  };
}

const DB = skillsData as SkillsDatabaseFile;
const SKILLS: SkillEntry[] = DB.skills;

let aliasIndex: Map<string, SkillEntry> | null = null;
let sortedAliasEntries: [string, SkillEntry][] | null = null;

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildAliasIndex(): Map<string, SkillEntry> {
  const index = new Map<string, SkillEntry>();
  for (const skill of SKILLS) {
    const keys = new Set([skill.name, ...skill.aliases, ...skill.searchTerms]);
    for (const key of keys) {
      const norm = normalizeToken(key);
      if (norm.length < 2) continue;
      if (!index.has(norm)) index.set(norm, skill);
    }
  }
  return index;
}

function getAliasIndex(): Map<string, SkillEntry> {
  if (!aliasIndex) aliasIndex = buildAliasIndex();
  return aliasIndex;
}

function getSortedAliasEntries(): [string, SkillEntry][] {
  if (!sortedAliasEntries) {
    sortedAliasEntries = [...getAliasIndex().entries()].sort((a, b) => b[0].length - a[0].length);
  }
  return sortedAliasEntries;
}

export function getSkillsDatabaseMeta(): Pick<SkillsDatabaseFile, 'version' | 'count' | 'generatedAt'> {
  return { version: DB.version, count: DB.count, generatedAt: DB.generatedAt };
}

export function getSkillById(id: string): SkillEntry | undefined {
  return SKILLS.find((s) => s.id === id);
}

/** Extract skills mentioned in free text (resume, job description). */
export function extractSkillsFromText(text: string, limit = 20): SkillEntry[] {
  if (!text?.trim()) return [];
  const haystack = normalizeToken(text);
  const found = new Map<string, SkillEntry>();

  for (const [alias, skill] of getSortedAliasEntries()) {
    if (found.has(skill.id)) continue;
    if (alias.length < 2) continue;
    const escaped = alias.replace(/[.+#]/g, '\\$&');
    const hit = alias.includes(' ')
      ? haystack.includes(alias)
      : new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
    if (hit) found.set(skill.id, skill);
    if (found.size >= limit) break;
  }

  return [...found.values()];
}

function careerPathTokens(path: string): string[] {
  return normalizeToken(path)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !['and', 'the', 'for', 'with', 'remote'].includes(t));
}

/** Skills associated with user's career paths via role overlap and token match. */
export function skillsForCareerPaths(careerPaths: string[], limit = 15): SkillEntry[] {
  if (careerPaths.length === 0) return [];
  const pathsNorm = careerPaths.map(normalizeToken);
  const pathTokens = new Set(careerPaths.flatMap(careerPathTokens));
  const scored: { skill: SkillEntry; score: number }[] = [];

  for (const skill of SKILLS) {
    let score = 0;
    const nameNorm = normalizeToken(skill.name);
    for (const path of pathsNorm) {
      if (path.includes(nameNorm) || nameNorm.includes(path)) score += 8;
    }
    for (const role of skill.roles) {
      const roleNorm = normalizeToken(role);
      for (const path of pathsNorm) {
        if (path.includes(roleNorm) || roleNorm.includes(path)) score += 6;
      }
    }
    for (const token of pathTokens) {
      if (nameNorm.includes(token) || skill.aliases.some((a) => normalizeToken(a).includes(token))) {
        score += 3;
      }
    }
    if (score > 0) scored.push({ skill, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const out: SkillEntry[] = [];
  const seen = new Set<string>();
  for (const { skill } of scored) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    out.push(skill);
    if (out.length >= limit) break;
  }
  return out;
}

/** Merge explicit profile skills with DB-resolved entries. */
export function resolveProfileSkills(input: ProfileSkillInput, limit = 20): SkillEntry[] {
  const byId = new Map<string, SkillEntry>();

  const addByName = (name: string) => {
    const norm = normalizeToken(name);
    const hit = getAliasIndex().get(norm);
    if (hit) byId.set(hit.id, hit);
    else {
      const extracted = extractSkillsFromText(name, 1);
      for (const s of extracted) byId.set(s.id, s);
    }
  };

  for (const s of input.structuredProfile?.skills || []) addByName(s);
  for (const s of input.structuredProfile?.techStack || []) addByName(s);
  for (const s of extractSkillsFromText(input.resumeText || '', 12)) byId.set(s.id, s);
  for (const s of skillsForCareerPaths(input.careerPaths || [], 12)) byId.set(s.id, s);

  return [...byId.values()].slice(0, limit);
}

export interface ApifySkillDiscoveryQueries {
  descriptionSearch: string[];
  supplementalTitleSearch: string[];
}

/** Build Apify search terms from profile + career paths. */
export function buildApifySkillDiscoveryQueries(input: ProfileSkillInput): ApifySkillDiscoveryQueries {
  const profileSkills = resolveProfileSkills(input, 16);
  const pathSkills = skillsForCareerPaths(input.careerPaths || [], 10);

  const descriptionSearch = [...new Set(
    [...profileSkills, ...pathSkills].map((s) => s.name).filter((n) => n.length >= 2)
  )].slice(0, 10);

  const supplementalTitleSearch = [...new Set(
    pathSkills
      .filter((s) => s.roles.length > 0)
      .map((s) => s.name)
      .filter((n) => n.length >= 3 && n.length <= 40)
  )].slice(0, 6);

  return { descriptionSearch, supplementalTitleSearch };
}

/** Fast requirement extraction from job descriptions using the skills DB. */
export function extractRequirementsFromDescription(description: string, limit = 8): string[] {
  const fromDb = extractSkillsFromText(description, limit).map((s) => s.name);
  if (fromDb.length > 0) return fromDb;

  return description
    .split(/[.;]\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20 && part.length <= 140)
    .slice(0, 6);
}
