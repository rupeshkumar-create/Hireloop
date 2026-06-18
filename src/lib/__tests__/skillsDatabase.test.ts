import { describe, expect, it } from 'vitest';
import {
  buildApifySkillDiscoveryQueries,
  extractSkillsFromText,
  getSkillsDatabaseMeta,
  skillsForCareerPaths,
} from '../skillsDatabase/index';

describe('skillsDatabase', () => {
  it('loads ~5000 skills', () => {
    const meta = getSkillsDatabaseMeta();
    expect(meta.count).toBeGreaterThanOrEqual(5000);
  });

  it('extracts React and TypeScript from resume text', () => {
    const hits = extractSkillsFromText(
      'Senior engineer with React, TypeScript, Node.js, and PostgreSQL experience.',
      10
    );
    const names = hits.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes('react'))).toBe(true);
    expect(names.some((n) => n.includes('typescript'))).toBe(true);
  });

  it('maps customer support career paths to support skills', () => {
    const hits = skillsForCareerPaths(['Customer Support Specialist'], 10);
    const names = hits.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes('support') || n.includes('zendesk'))).toBe(true);
  });

  it('builds Apify description search from profile', () => {
    const q = buildApifySkillDiscoveryQueries({
      careerPaths: ['Customer Support'],
      resumeText: 'Zendesk, Intercom, SaaS support tickets, API troubleshooting.',
      structuredProfile: { skills: ['Customer Support'], techStack: ['Zendesk'] },
    });
    expect(q.descriptionSearch.length).toBeGreaterThan(0);
    expect(q.descriptionSearch.some((t) => /zendesk|support/i.test(t))).toBe(true);
  });
});
