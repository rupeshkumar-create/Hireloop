import { describe, expect, it } from 'vitest';
import { buildAdminUserDetail, buildAdminUserListItem } from '../adminUsers';

describe('buildAdminUserListItem', () => {
  it('keeps the lightweight admin list payload focused on table fields', () => {
    const result = buildAdminUserListItem({
      id: 'user_1',
      email: 'person@example.com',
      displayName: 'Person',
      plan: 'pro',
      createdAt: { toDate: () => new Date('2026-04-01T00:00:00.000Z') },
      lastActiveAt: '2026-04-10T00:00:00.000Z',
      jobType: 'remote',
      location: 'Remote',
      minSalary: 150000,
      careerPaths: ['Frontend Engineer'],
      resumeText: 'Very large resume payload',
      seenJobFingerprints: ['ignore-me'],
      learningProfile: { jobPreferences: 'React', writingStyle: 'concise' },
    });

    expect(result).toEqual({
      id: 'user_1',
      email: 'person@example.com',
      displayName: 'Person',
      plan: 'pro',
      createdAt: '2026-04-01T00:00:00.000Z',
      lastActiveAt: '2026-04-10T00:00:00.000Z',
      jobType: 'remote',
      location: 'Remote',
      minSalary: 150000,
      careerPaths: ['Frontend Engineer'],
    });
    expect(result).not.toHaveProperty('resumeText');
    expect(result).not.toHaveProperty('seenJobFingerprints');
  });
});

describe('buildAdminUserDetail', () => {
  it('includes the extra fields required for detail and ghost mode flows', () => {
    const result = buildAdminUserDetail({
      id: 'user_1',
      email: 'person@example.com',
      plan: 'free',
      createdAt: '2026-04-01T00:00:00.000Z',
      careerPaths: ['Backend Engineer'],
      learningProfile: {
        jobPreferences: 'Backend roles',
        writingStyle: 'direct',
      },
      resumeText: 'Built APIs',
      seenJobFingerprints: ['backend engineer::acme'],
      learningSignals: { likedKeywords: ['node'] },
    });

    expect(result.learningProfile).toEqual({
      jobPreferences: 'Backend roles',
      writingStyle: 'direct',
    });
    expect(result.resumeText).toBe('Built APIs');
    expect(result.seenJobFingerprints).toEqual(['backend engineer::acme']);
    expect(result.learningSignals).toEqual({ likedKeywords: ['node'] });
  });
});
