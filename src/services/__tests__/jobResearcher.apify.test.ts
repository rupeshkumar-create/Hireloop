import { beforeEach, describe, expect, it, vi } from 'vitest';

const runCareerSiteActor = vi.fn();

vi.mock('../jobSources/apifyCareerSite', async () => {
  const actual = await vi.importActual<typeof import('../jobSources/apifyCareerSite')>(
    '../jobSources/apifyCareerSite'
  );
  return {
    ...actual,
    runCareerSiteActor,
  };
});

describe('jobResearcher Apify discovery', () => {
  beforeEach(() => {
    vi.resetModules();
    runCareerSiteActor.mockReset();
    process.env.APIFY_API_TOKEN = 'test-token';
  });

  it('falls back to a broader Apify search when strict career-path filters return no items', async () => {
    const { researchJobs } = await import('../jobResearcher');

    runCareerSiteActor
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'job_1',
          title: 'Frontend Engineer',
          organization: 'Acme',
          locations_derived: ['Remote, United States'],
          description_text: 'Build React and TypeScript interfaces for customer-facing products.',
          url: 'https://example.com/jobs/frontend',
          date_posted: '2026-05-07T00:00:00.000Z',
          ai_work_arrangement: 'Remote OK',
          ai_key_skills: ['React', 'TypeScript'],
        },
      ]);

    const result = await researchJobs({
      careerPaths: ['Founding Product Engineer'],
      resumeText: 'React TypeScript frontend engineer',
      jobType: 'remote',
      targetCount: 5,
    });

    expect(runCareerSiteActor).toHaveBeenCalledTimes(2);
    expect(runCareerSiteActor.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        timeRange: '7d',
        titleSearch: ['Founding Product Engineer'],
        aiWorkArrangementFilter: ['Remote OK', 'Remote Solely'],
      })
    );
    expect(runCareerSiteActor.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        timeRange: '6m',
      })
    );
    expect(runCareerSiteActor.mock.calls[1][0]).not.toHaveProperty('titleSearch');
    expect(runCareerSiteActor.mock.calls[1][0]).not.toHaveProperty('aiWorkArrangementFilter');
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      title: 'Frontend Engineer',
      company: 'Acme',
      source: 'apifyCareerSite',
      applyUrl: 'https://example.com/jobs/frontend',
    });
  });

  it('falls back when strict Apify items cannot be normalized into usable jobs', async () => {
    const { researchJobs } = await import('../jobResearcher');

    runCareerSiteActor
      .mockResolvedValueOnce([
        {
          id: 'bad_job',
          title: 'Frontend Engineer',
          organization: 'Acme',
          description_text: 'Missing apply URL should make this unusable.',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'job_2',
          title: 'React Engineer',
          organization: 'Bright Apps',
          locations_derived: ['Remote'],
          description_text: 'Build React dashboards with TypeScript and customer-facing analytics.',
          url: 'https://example.com/jobs/react',
          date_posted: '2026-05-07T00:00:00.000Z',
          ai_work_arrangement: 'Remote Solely',
          ai_key_skills: ['React', 'TypeScript'],
        },
      ]);

    const result = await researchJobs({
      careerPaths: ['React Engineer'],
      resumeText: 'React TypeScript dashboard engineer',
      jobType: 'remote',
      targetCount: 5,
    });

    expect(runCareerSiteActor).toHaveBeenCalledTimes(2);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      title: 'React Engineer',
      company: 'Bright Apps',
      applyUrl: 'https://example.com/jobs/react',
    });
  });
});
