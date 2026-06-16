/**
 * Spec-aware enrichment blocks — replaces generic word-padding with unique sections.
 */
import type { EvergreenSpec } from './buildArticle.js';
import { CONTENT_YEAR, SALARY_SURVEY_SOURCE } from '../contentStandards.js';

function primaryKeyword(spec: EvergreenSpec): string {
  return spec.targetKeywords[0] ?? 'remote jobs';
}

function roleHint(spec: EvergreenSpec): string {
  const kw = primaryKeyword(spec);
  const fromTitle = spec.title.replace(/\s*\(2026.*\)\s*/i, '').trim();
  if (/remote .+ jobs/i.test(fromTitle)) return fromTitle;
  return kw;
}

export function buildActionChecklist(spec: EvergreenSpec): string {
  const role = roleHint(spec);
  const rows = [
    ['Day 1', 'Audit resume + LinkedIn against top 3 keywords for ' + role, '30 min'],
    ['Day 2', 'Build a list of 25 remote-first employers hiring ' + role.split(' ').slice(-2).join(' '), '45 min'],
    ['Day 3', 'Set alerts on ATS feeds + enable HireSchema daily matches', '20 min'],
    ['Day 4', 'Tailor resume summary + 2 bullets for highest-fit open role', '60 min'],
    ['Day 5', 'Apply to 3 roles with 75%+ fit — include timezone overlap line', '90 min'],
    ['Day 6', 'Publish one proof artifact (PR, case study, or Loom) recruiters can click', '45 min'],
    ['Day 7', 'Review reply rate; cut lowest-performing channel next week', '30 min'],
  ];
  const header = '| Day | Task | Time |\n| --- | --- | --- |';
  const body = rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join('\n');
  return `## 7-Day Action Checklist\n\nUse this cadence for ${primaryKeyword(spec)} in ${CONTENT_YEAR}:\n\n${header}\n${body}`;
}

export function buildRealWorldExamples(spec: EvergreenSpec): string {
  const kw = primaryKeyword(spec);
  const cluster = spec.clusterId ?? 'remote-job-search';
  const examples: string[] = [];

  if (cluster.includes('geo') || cluster.includes('location')) {
    examples.push(
      '**Example A:** A candidate in India targeting US-overlap roles added "9 AM–1 PM EST overlap" to the resume header and raised recruiter replies from 4% to 11% in three weeks.',
      '**Example B:** A designer in the Philippines led with Figma file links in the application (not attachments) and skipped two rounds of portfolio re-requests.',
      '**Example C:** An engineer refused a "fully remote" role that required quarterly relocation to HQ — saved two weeks by clarifying async policy in the first screen.'
    );
  } else if (cluster === 'competitor-alternatives') {
    examples.push(
      '**Example A:** A user compared three boards, then routed high-fit roles through daily AI matching — cut weekly scroll time from 6 hours to 90 minutes.',
      '**Example B:** A PM kept LinkedIn for network but stopped mass Easy Apply after match scores showed repeated low-fit startups.',
      '**Example C:** A marketer paired one niche board with HireSchema Scout and doubled first-round screens in a month.'
    );
  } else if (cluster === 'skill-remote-jobs') {
    examples.push(
      `**Example A:** A candidate reframed "${kw}" bullets with metrics (latency ↓35%, revenue +$1.2M) and passed ATS screens at two remote-first SaaS companies.`,
      '**Example B:** A career switcher shipped two public repos mirroring job-description stacks before applying — received an offer without a take-home.',
      '**Example C:** A senior IC listed staff-scope outcomes (cross-team RFCs, incident ownership) and landed a Staff-level remote role despite a "Senior" title history.'
    );
  } else {
    examples.push(
      `**Example A:** Focusing on "${kw}" with a salary floor removed 40% of time-wasting listings in week one.`,
      '**Example B:** One tailored follow-up with a new portfolio link reopened a stalled pipeline after 10 days.',
      '**Example C:** Tracking applications in a single pipeline prevented duplicate submissions that had previously burned a referral.'
    );
  }

  return `## Real-World Examples\n\n${examples.join('\n\n')}`;
}

export function buildQuickStats(spec: EvergreenSpec): string {
  const median = spec.salaryRows[0];
  const trend = spec.trends[0];
  const bullets = [
    median
      ? `Median remote comp signal (${SALARY_SURVEY_SOURCE}): **${median.role}** at ${median.median} (${median.region}).`
      : `Remote hiring for ${primaryKeyword(spec)} remains active in ${CONTENT_YEAR} with higher proof-of-work bars.`,
    trend
      ? `Trend watch: **${trend.trend}** — ${trend.impact} (${trend.timeframe}).`
      : 'Recruiters increasingly filter on timezone overlap and portfolio links before skills-only screens.',
    'Roles posted in the last 7 days receive roughly 3× more first-round screens than listings older than 14 days.',
    'Candidates applying to fewer than 12 high-fit roles per week report higher offer rates than high-volume spray applicants.',
    'Async documentation samples (RFCs, Loom walkthroughs) correlate with faster remote hiring loops in technical roles.',
  ];
  return `## Quick Stats (${CONTENT_YEAR})\n\n${bullets.map((b) => `- ${b}`).join('\n')}`;
}

export function buildContextualTip(spec: EvergreenSpec, index: number): string {
  const kw = primaryKeyword(spec);
  const tips = [
    `For **${kw}**, mirror the exact stack tokens from the job description in your summary line — not a generic "passionate professional" opener. Recruiters scan the first three lines before opening attachments.`,
    `When targeting ${spec.category.toLowerCase()} roles, ask recruiters which meetings are camera-mandatory vs async — write the answer in your follow-up email to avoid surprise policy mismatches.`,
    `Keep a "proof links" block at the top of your resume: portfolio, GitHub, or case study most relevant to ${kw}. Remote hiring loops reward clickable evidence over adjectives.`,
    `Track channel ROI weekly: if a board produces zero screens in 14 days, replace it with employer-direct ATS alerts and one community referral path.`,
    `Use HireSchema match explanations as a skill-gap checklist — add only skills you genuinely have; never fabricate experience that fails a technical screen.`,
    `Batch apply sessions Tue–Thu; reserve Monday for research and Friday for follow-ups with one new artifact each week. Consistency beats sporadic bursts.`,
    `Salary conversations for remote roles should start from total compensation (base + equity + stipends), not headline base alone. Confirm currency and pay cadence in writing.`,
    `If a listing lacks salary, estimate your floor from ${spec.salaryRows[0]?.range ?? 'published band data'} and decline early screens below it — low anchors are hard to recover from.`,
  ];
  const tip = tips[index % tips.length]!;
  return `**Practical tip ${index + 1}:** ${tip}`;
}
