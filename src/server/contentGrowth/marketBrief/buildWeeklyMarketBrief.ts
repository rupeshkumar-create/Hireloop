import type { EvergreenSpec } from '../evergreen/buildArticle.js';
import { CONTENT_YEAR } from '../contentStandards.js';
import {
  WEEKLY_MARKET_BRIEF_SLUG,
  WEEKLY_ROLES_SNAPSHOT,
  type WeeklyRolesSnapshot,
} from './weeklyRolesSnapshot.js';

function trendLabel(trend: string): string {
  if (trend === 'rising') return '↑ Rising';
  if (trend === 'cooling') return '↓ Cooling';
  return '→ Stable';
}

export function buildWeeklyMarketBriefSpec(
  snapshot: WeeklyRolesSnapshot = WEEKLY_ROLES_SNAPSHOT
): EvergreenSpec {
  const top = snapshot.roles[0];
  const header =
    '| Rank | Role | Demand | Median fit* | Top skills | Trend |\n| --- | --- | ---: | ---: | --- | --- |';
  const rows = snapshot.roles
    .map((r, i) => {
      const skills = r.topSkills.slice(0, 3).join(', ');
      return `| ${i + 1} | ${r.title} | ${r.demandIndex} | ${r.medianMatchScore}% | ${skills} | ${trendLabel(r.trend)} |`;
    })
    .join('\n');

  const detailBlocks = snapshot.roles
    .slice(0, 8)
    .map(
      (r) =>
        `### ${r.title}\n\n- **Demand index:** ${r.demandIndex}/100\n- **Median resume fit score:** ${r.medianMatchScore}%\n- **Skills in demand:** ${r.topSkills.join(', ')}\n- **Market note:** ${r.regionNote}`
    )
    .join('\n\n');

  return {
    slug: WEEKLY_MARKET_BRIEF_SLUG,
    title: `Top Remote Roles This Week (${snapshot.weekOf})`,
    seoTitle: `Top Remote Jobs This Week — Demand Data ${CONTENT_YEAR} | HireSchema`,
    seoDescription:
      'Weekly anonymized remote hiring demand from HireSchema Scout: top roles, skills in demand, and median resume fit scores.',
    category: 'Market Brief',
    clusterId: 'hiring-trends',
    targetKeywords: [
      'top remote jobs this week',
      'remote hiring trends',
      'in demand remote roles',
    ],
    tags: ['weekly brief', 'hiring trends', 'remote jobs', 'market data', 'HireSchema'],
    publishedAt: snapshot.updatedAt,
    includeInSitemap: true,
    directAnswer: `This week (${snapshot.weekOf}), **${top?.title ?? 'Senior Backend Engineer'}** leads remote hiring demand with a ${top?.demandIndex ?? 90}/100 index. Top skills: ${(top?.topSkills ?? ['Python', 'AWS']).join(', ')}. ${snapshot.sourceNote}`,
    sections: [
      {
        heading: 'What changed this week',
        intro: 'Remote hiring velocity shifts by function — this brief tracks validated listings only.',
        bullets: snapshot.roles.slice(0, 5).map(
          (r) => `${r.title}: demand ${r.demandIndex}, trend ${r.trend}.`
        ),
        close: 'Use the leaderboard below before expanding your application volume.',
      },
      {
        heading: 'How to use this data',
        intro: 'Turn demand signals into a focused apply list:',
        bullets: [
          'Prioritize rising roles where your resume scores 75%+.',
          'Close skill gaps before mass applying to cooling roles.',
          'Set a salary floor so high-demand roles do not misalign comp.',
          'Track screens per 10 tailored applications — target 2+ before adding channels.',
        ],
        close: 'HireSchema daily matches apply these filters automatically for your resume.',
      },
    ],
    definitions: [
      { term: 'Demand index', definition: 'Composite freshness + volume signal from Scout-validated remote listings.' },
      { term: 'Median fit', definition: 'Typical resume match score for candidates targeting that role family.' },
    ],
    salaryRows: snapshot.roles.slice(0, 4).map((r) => ({
      role: r.title,
      median: `${r.medianMatchScore}% fit`,
      range: `Demand ${r.demandIndex}/100`,
      region: 'Global remote',
    })),
    trends: snapshot.roles.slice(0, 4).map((r) => ({
      trend: r.title,
      impact: r.regionNote,
      timeframe: snapshot.weekOf,
    })),
    comparisonHeaders: ['Role', 'Demand', 'Fit score', 'Trend'],
    comparisonRows: snapshot.roles.slice(0, 6).map((r) => [
      r.title,
      String(r.demandIndex),
      `${r.medianMatchScore}%`,
      trendLabel(r.trend),
    ]),
    faq: [
      {
        question: 'How is this different from a job board?',
        answer: 'This is aggregated demand data — not listings. HireSchema daily matches show specific roles for your resume.',
      },
      {
        question: 'Can I get alerts for these roles?',
        answer: 'Yes — upload your resume at hireschema.com/login for daily validated matches.',
      },
      {
        question: 'How often is this list updated?',
        answer: `Weekly, aligned to Scout validation windows (${CONTENT_YEAR}).`,
      },
    ],
    appendixMarkdown: [
      '## Weekly demand leaderboard',
      '',
      header,
      rows,
      '',
      '*Median fit = anonymized match score vs. validated listings; not a guarantee of interview.',
      '',
      '## Role snapshots',
      '',
      detailBlocks,
    ].join('\n'),
  };
}
