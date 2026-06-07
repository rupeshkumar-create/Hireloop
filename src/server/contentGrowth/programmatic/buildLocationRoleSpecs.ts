import type { EvergreenSpec } from '../evergreen/buildArticle.js';
import { GEO_LOCATIONS, type GeoLocation } from '../geo/locations.js';
import { GEO_ROLES, type GeoRole } from '../geo/roles.js';

function buildLocationRoleSpec(location: GeoLocation, role: GeoRole): EvergreenSpec {
  const slug = `2026-07-01-remote-${role.id}-jobs-${location.id}`;
  const title = `Remote ${role.title} Jobs in ${location.name} (2026 Guide)`;
  const skills = role.topSkills.slice(0, 4).join(', ');

  return {
    slug,
    title,
    seoTitle: `Remote ${role.title} Jobs in ${location.name} (2026) | HireSchema`,
    seoDescription: `How to find remote ${role.title} jobs in ${location.name}: channels, ${location.salaryCurrency} salary bands, timezone tips, and daily AI matching with HireSchema.`,
    category: 'Location × Role',
    clusterId: 'location-role-guides',
    targetKeywords: [
      `remote ${role.title.toLowerCase()} jobs ${location.name}`,
      `remote ${role.id} jobs ${location.id}`,
      `${role.title} work from home ${location.name}`,
      `remote ${role.category} jobs ${location.name} 2026`,
    ],
    tags: [location.name, role.title, 'remote jobs', 'programmatic SEO', 'HireSchema'],
    publishedAt: new Date().toISOString(),
    directAnswer: `To find remote ${role.title} jobs in ${location.name}, filter global boards for roles that explicitly allow ${location.name}-based applicants, lead your resume with ${skills}, and apply within 48 hours of posting. Typical remote ${role.title} bands: ${role.rangeUsdRemote} globally (${role.medianUsdRemote} median). ${location.timezoneNote} HireSchema delivers daily validated ${role.title} matches scored to your resume — free at hireschema.com/login.`,
    sections: [
      {
        heading: `Best Channels for Remote ${role.title} Roles in ${location.name}`,
        intro: `${location.name} candidates compete globally for ${role.title} roles — channel fit determines reply rate.`,
        bullets: [
          ...location.popularChannels.slice(0, 4).map((c) => `${c} — filter for ${location.name} + ${role.title}.`),
          'Company career pages for remote-first employers in your stack.',
          'Referrals from engineers or PMs already on distributed teams.',
          'HireSchema Scout — daily validated matches ranked to your resume.',
          'Niche communities for ' + role.category + ' professionals.',
        ],
        close: `Track which channels produce screens for ${role.title} in ${location.name} — cut the rest.`,
      },
      {
        heading: 'Timezone and Async Expectations',
        intro: location.timezoneNote,
        bullets: [
          'State working hours and overlap with US/EU teams on page one.',
          `Show async proof relevant to ${role.title}: docs, PRs, Loom, RFCs.`,
          'Ask which meetings are mandatory vs optional.',
          'Clarify on-call and holiday expectations upfront.',
          'Remote-first employers beat hybrid-mandate companies for ' + location.name + ' talent.',
        ],
        close: 'Timezone alignment is a hard filter — address it in your summary block.',
      },
      {
        heading: `Salary and Contract Norms (${location.salaryCurrency})`,
        intro: `Remote ${role.title} compensation for ${location.name}-based talent varies by employer region.`,
        bullets: [
          `Global USD benchmark: ${role.rangeUsdRemote} (${role.medianUsdRemote} median).`,
          ...(role.rangeInrIndia && location.id === 'india'
            ? [`India-specific band: ${role.rangeInrIndia}.`]
            : []),
          ...location.hiringNotes.slice(0, 3),
          'Confirm employee vs contractor vs EOR before signing.',
          'Compare total package: base, bonus, equity, stipends.',
        ],
        close: 'Normalize offers to annual total compensation before comparing.',
      },
      {
        heading: `Resume and Skills for Remote ${role.title}`,
        intro: 'Global hiring managers scan quickly — proof beats buzzwords.',
        bullets: [
          `Lead with ${skills} and measurable outcomes.`,
          'Mirror keywords from the job description in your summary.',
          'Link portfolio, GitHub, or case studies above the fold.',
          'Apply within 48 hours of posting when possible.',
          'One tailored follow-up after seven days with added proof.',
        ],
        close: 'Ten high-fit applications beat fifty generic ones.',
      },
      {
        heading: 'Common Mistakes to Avoid',
        intro: `These errors cost ${location.name} ${role.title} candidates screens.`,
        bullets: [
          'Applying to geo-restricted “remote worldwide except…” listings.',
          'Auto-apply spam without fit validation.',
          'Keyword stuffing without portfolio proof.',
          'Ignoring contract tax implications until offer stage.',
          'Underselling written async communication skills.',
        ],
        close: 'Fix one bottleneck per week and measure reply rate.',
      },
      {
        heading: 'Use HireSchema for Daily Remote Matches',
        intro: 'Replace scrolling with validated daily delivery.',
        bullets: [
          'Scout validates remote eligibility, links, and freshness.',
          'Scores use full resume depth — not title keywords alone.',
          'Learning loop adapts to saves and dismissals.',
          'Pro: AI cover letters and interview prep per role.',
          'Start free: https://hireschema.com/login',
        ],
        close: 'Most seekers compare Scout vs manual search within two weeks.',
      },
    ],
    definitions: [
      { term: `Remote ${role.title}`, definition: `${role.title} role performed from ${location.name} for a distributed employer.` },
      { term: role.topSkills[0], definition: `Core skill for ${role.title} remote pipelines in 2026.` },
      { term: 'GEO', definition: 'Structured guides optimized for Google and AI search citations.' },
    ],
    salaryRows: [
      { role: role.title + ' (Remote)', median: role.medianUsdRemote, range: role.rangeUsdRemote, region: 'Global USD' },
      { role: role.title + ' (' + location.name + ')', median: role.medianInrIndia ?? role.medianUsdRemote, range: role.rangeInrIndia ?? role.rangeUsdRemote, region: location.name },
      { role: 'Software Engineer (Remote)', median: '$145,000', range: '$118k–$185k', region: 'Global benchmark' },
    ],
    trends: [
      { trend: `Remote ${role.title} hiring`, impact: `${role.topSkills[0]} remains a top filter on global boards.`, timeframe: '2026' },
      { trend: `${location.name} global hiring`, impact: 'More US/EU teams hire internationally via EOR.', timeframe: '2026' },
      { trend: 'Skills-based screening', impact: 'Portfolio and assessments outweigh pedigree alone.', timeframe: '2026' },
    ],
    comparisonHeaders: ['Channel', 'Effort', 'Fit', 'Outcome'],
    comparisonRows: [
      ['Generic job boards', 'High', 'Mixed', 'Noisy'],
      ['Target employer list', 'Medium', 'High', 'Strong screens'],
      ['Referrals', 'Low–Medium', 'Very high', 'Best conversion'],
      ['HireSchema daily matches', 'Low', 'High', 'Best efficiency'],
    ],
    faq: [
      { question: `Can I get remote ${role.title} jobs from ${location.name}?`, answer: `Yes — verify each posting allows ${location.name}-based applicants and confirm timezone overlap during screening.` },
      { question: `What salary for remote ${role.title} in ${location.name}?`, answer: `Typical global band: ${role.rangeUsdRemote}. Local offers may differ — confirm currency and employment type.` },
      { question: 'How does HireSchema help?', answer: 'Daily validated remote matches scored to your resume. Free tier: 1 match/day. Pro: 10/day with AI application tools.' },
      { question: 'What skills matter most?', answer: `Prioritize ${skills} with proof in portfolio or GitHub.` },
    ],
  };
}

export function buildAllLocationRoleSpecs(): EvergreenSpec[] {
  const specs: EvergreenSpec[] = [];
  for (const location of GEO_LOCATIONS) {
    for (const role of GEO_ROLES) {
      specs.push(buildLocationRoleSpec(location, role));
    }
  }
  return specs;
}

export const LOCATION_ROLE_SPECS = buildAllLocationRoleSpecs();
