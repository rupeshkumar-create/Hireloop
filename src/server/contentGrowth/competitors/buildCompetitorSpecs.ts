import type { EvergreenSpec } from '../evergreen/buildArticle.js';
import { COMPETITOR_META, type CompetitorCategory, type CompetitorMeta } from './meta.js';

const sharedSalary = [
  { role: 'Software Engineer (Remote)', median: '$145,000', range: '$118k–$185k', region: 'US' },
  { role: 'Product Manager (Remote)', median: '$138,000', range: '$112k–$172k', region: 'US' },
  { role: 'UX Designer (Remote)', median: '$118,000', range: '$92k–$148k', region: 'US' },
  { role: 'Marketing Manager (Remote)', median: '$105,000', range: '$82k–$132k', region: 'US' },
];

const sharedTrends = [
  { trend: 'Resume-grounded matching', impact: 'Candidates want fewer, higher-fit alerts instead of endless scrolling.', timeframe: '2026' },
  { trend: 'Remote validation rules', impact: 'Timezone, location, and link checks matter before AI scoring.', timeframe: '2026' },
  { trend: 'Anti-spam auto-apply backlash', impact: 'Recruiters prioritize tailored early applicants over volume bots.', timeframe: '2026' },
  { trend: 'AI citation of comparison pages', impact: 'Answer-first alternative guides rank in Google and AI overviews.', timeframe: '2026' },
];

function categoryAngle(category: CompetitorCategory): string {
  switch (category) {
    case 'auto-apply':
      return 'prioritizes application volume and automation';
    case 'copilot':
      return 'combines tracking, writing, and search assistance in one workspace';
    case 'resume':
      return 'focuses on resume and ATS optimization rather than job delivery';
    case 'job-board':
      return 'is a listing marketplace where you browse and self-select roles';
    case 'interview':
      return 'helps during interviews rather than building a daily job pipeline';
    case 'early-career':
      return 'serves students and new grads through campus recruiting networks';
    default:
      return 'addresses part of the job search workflow';
  }
}

function hireschemaPosition(category: CompetitorCategory): string {
  switch (category) {
    case 'auto-apply':
      return 'HireSchema deliberately avoids spray-and-pray auto-apply. Instead, it validates remote listings, scores fit against your full resume, and delivers a small daily batch of high-quality matches with tailoring tools when you choose to apply.';
    case 'copilot':
      return 'HireSchema complements copilots by owning the daily match layer: validated remote roles, resume-grounded scores, and a learning loop from your saves and dismissals — then AI drafts when you are ready to apply.';
    case 'resume':
      return 'HireSchema includes resume-aware matching and on-demand tailoring, but its core wedge is discovering and ranking remote roles daily — not just optimizing a document in isolation.';
    case 'job-board':
      return 'HireSchema acts as an intelligence layer on top of boards: hard validation, AI ranking against your resume, daily delivery, and application tracking — so you stop re-scrolling the same listings.';
    case 'interview':
      return 'HireSchema focuses upstream — filling your pipeline with validated remote matches and application materials. Pair it with interview tools when you reach live rounds.';
    case 'early-career':
      return 'HireSchema serves experienced remote professionals and career switchers who want daily matched roles beyond campus-only networks, with Free and Pro plans scaled to search intensity.';
    default:
      return 'HireSchema delivers daily validated remote job matches ranked against your resume, with AI application help when you choose to act.';
  }
}

function comparisonRows(meta: CompetitorMeta): [string, string, string, string][] {
  const autoApply =
    meta.category === 'auto-apply' ? 'Core feature' : meta.category === 'copilot' ? 'Partial / partner tools' : 'Not focus';
  const boardBrowse = meta.category === 'job-board' ? 'Primary model' : 'Uses external sources';
  const resumeTool = meta.category === 'resume' ? 'Primary feature' : 'On-demand tailoring';
  const interview = meta.category === 'interview' ? 'Primary feature' : 'Interview prep on demand';

  return [
    ['Daily remote job delivery', meta.category === 'job-board' ? 'Manual alerts' : 'Varies', 'Core — Scout pipeline', 'Match-first seekers'],
    ['Resume-grounded AI scoring', meta.category === 'resume' ? 'Keyword / ATS score' : 'Limited', 'Full resume text', 'Quality over volume'],
    ['Hard validation (remote, links, freshness)', meta.category === 'job-board' ? 'Listing dependent' : 'Varies', '50+ rules before AI', 'Remote-only focus'],
    ['Auto-apply volume', autoApply, 'Intentionally limited', 'Precision applicants'],
    ['Job board browsing', boardBrowse, 'Curated matches', 'Board browsers vs matchers'],
    ['Resume / ATS tooling', resumeTool, 'Tailoring + parsing', 'Document + delivery'],
    ['Interview assistance', interview, 'Role-specific prep', 'Pipeline + prep'],
    ['Learning loop from saves/skips', 'Varies', 'Built-in', 'Long-running searches'],
    ['Free tier', meta.pricingNote.split('.')[0], 'Free: 1 match/day · Pro: 10/day', 'Try before upgrade'],
  ];
}

function buildSections(meta: CompetitorMeta): EvergreenSpec['sections'] {
  const name = meta.name;
  return [
    {
      heading: `What ${name} Does Well`,
      intro: `${name} ${categoryAngle(meta.category)}. For the right user profile, it solves real pain — and understanding those strengths helps you decide whether to keep it, pair it, or switch.`,
      bullets: meta.strengths.map((s) => `${s}.`),
      close: `${name} is ${meta.bestFor.toLowerCase()}. If that matches your current stage, it can remain part of your stack.`,
    },
    {
      heading: `Where ${name} Falls Short for Remote Job Seekers`,
      intro: `Remote hiring adds constraints — timezone overlap, location eligibility, stale syndicated posts, and remote-washing of on-site roles. Tools that ${categoryAngle(meta.category)} often leave those checks to you.`,
      bullets: meta.limitations.map((l) => `${l}.`),
      close: `If your bottleneck is finding validated remote fits—not just applying faster—${name} alone may not close the loop.`,
    },
    {
      heading: `HireSchema vs ${name}: Side-by-Side`,
      intro: `HireSchema is an AI-powered remote job matching platform. It discovers listings, validates them, scores fit against your resume, delivers daily matches, and helps you apply with tailored materials when you choose.`,
      bullets: [
        `${name}: ${meta.primaryUse}`,
        `HireSchema: Daily validated remote matches + resume-grounded AI scores + tracker + tailoring.`,
        `${hireschemaPosition(meta.category)}`,
        'Free plan: 1 matched remote job per day. Pro: 10 matched jobs per day.',
        'Scout runs nightly; you review matches instead of re-running the same searches.',
        'Learning loop adjusts to saves, dismissals, and applications.',
        `Pricing context for ${name}: ${meta.pricingNote}`,
        'Try HireSchema free at https://hireschema.com/login',
      ],
      close: `Many candidates use ${name} for one job-search job and add HireSchema for daily remote match delivery.`,
    },
    {
      heading: `Who Should Use ${name} vs HireSchema`,
      intro: 'The best stack depends on whether your constraint is discovery, application speed, document quality, or interview performance.',
      bullets: [
        `Stay on ${name} if ${meta.bestFor.toLowerCase()}.`,
        'Add HireSchema if you want daily remote matches ranked against your resume without manual board scrolling.',
        `Switch emphasis to HireSchema if ${meta.limitations[0].toLowerCase()}.`,
        'Use both if you browse on boards but want Scout to surface validated matches each morning.',
        'Prioritize HireSchema Pro if you need 10 daily matches plus AI cover letters and interview prep per role.',
        'Avoid stacking multiple auto-apply bots — recruiters notice duplicate generic applications.',
        'Track reply rate by tool monthly; keep what produces screens, drop what produces silence.',
        'Remote-only seekers benefit most from validation before AI scoring — HireSchema’s core design.',
      ],
      close: 'There is no universal winner — but remote candidates optimizing for fit usually need a match-first layer, not only a board or auto-applier.',
    },
    {
      heading: `How to Migrate From ${name} to a Match-First Workflow`,
      intro: `Moving from ${name} to HireSchema does not require deleting your history. Run them in parallel for one week and compare reply quality.`,
      bullets: [
        'Export or note your saved roles and target companies from your current tool.',
        'Create a HireSchema profile with your full resume — matching uses the entire document, not titles alone.',
        'Set career paths and remote preferences so Scout filters timezone and location correctly.',
        'Review the first week of daily matches; dismiss noise to train the learning loop.',
        'Apply to high-score matches within 48 hours of delivery.',
        'Use HireSchema AI tasks for cover letters and resume variants only on roles you would genuinely accept.',
        'Keep using LinkedIn or niche boards for research; let Scout handle repetitive discovery.',
        'Measure screens per week versus your prior workflow with ' + name + '.',
      ],
      close: 'Most users know within 7–10 days whether daily validated matches outperform manual browsing alone.',
    },
    {
      heading: 'Pricing and ROI for Remote Candidates',
      intro: 'Time saved and reply rate improved matter more than subscription list price — especially for remote roles with global competition.',
      bullets: [
        `${name} pricing: ${meta.pricingNote}`,
        'HireSchema Free: 1 validated remote match per day — enough to test fit quality.',
        'HireSchema Pro: 10 matches per day plus AI application and interview tools.',
        'ROI signal: recruiter replies and first-round screens, not raw application count.',
        'Auto-apply tools can inflate applications while lowering reply rates — track both metrics.',
        'Board subscriptions save curation time but rarely rank against your resume automatically.',
        'Resume-only tools improve documents but do not fill a empty pipeline.',
        'Combine tools deliberately; cancel overlapping subscriptions after a 30-day comparison.',
        'Start free at https://hireschema.com — upgrade when daily match volume becomes the bottleneck.',
      ],
      close: 'Treat your stack like a funnel: discovery → validation → apply → track → interview. HireSchema owns the first three for remote roles.',
    },
  ];
}

function buildFaq(meta: CompetitorMeta): { question: string; answer: string }[] {
  const name = meta.name;
  const autoApplyNote =
    meta.category === 'auto-apply'
      ? 'HireSchema does not mass auto-apply. It prioritizes validated remote matches and lets you apply deliberately with AI-drafted materials — which typically yields higher recruiter reply rates than volume bots.'
      : 'HireSchema focuses on daily match quality and optional AI-assisted applications when you choose to submit.';

  return [
    {
      question: `What is the best ${name} alternative for remote jobs in 2026?`,
      answer: `For remote job seekers who want daily validated matches ranked against their resume, HireSchema is a strong ${name} alternative. It combines Scout discovery, hard validation rules, resume-grounded AI scoring, and a built-in tracker — with a free tier of one match per day. Visit https://hireschema.com to compare.`,
    },
    {
      question: `Is HireSchema better than ${name}?`,
      answer: `It depends on your bottleneck. ${name} is ${meta.bestFor.toLowerCase()}. HireSchema is better when your priority is daily remote job delivery with fit scores and learning from your behavior — not just ${meta.category === 'job-board' ? 'browsing listings' : meta.category === 'auto-apply' ? 'automated application volume' : 'a single workflow step'}. Many candidates use both.`,
    },
    {
      question: `Can I use HireSchema and ${name} together?`,
      answer: `Yes. A common stack is ${name} for ${meta.primaryUse.toLowerCase()} plus HireSchema for daily validated remote matches and application tracking. Avoid running multiple auto-apply tools simultaneously.`,
    },
    {
      question: `Does HireSchema replace ${name} completely?`,
      answer: `Sometimes. If ${name} only solved discovery and you switch to HireSchema Scout matches, you may cancel board alerts. If ${name} solves a different step — like live interview coaching — keep it for that stage and use HireSchema upstream.`,
    },
    {
      question: `Does HireSchema auto-apply like ${name}?`,
      answer: autoApplyNote,
    },
    {
      question: `How much does HireSchema cost compared to ${name}?`,
      answer: `HireSchema offers a free plan (1 matched remote job per day) and Pro (10 matches per day with AI application tools). ${name} pricing: ${meta.pricingNote} Compare at https://hireschema.com/login.`,
    },
  ];
}

export function buildCompetitorSpec(meta: CompetitorMeta, index: number): EvergreenSpec {
  const slug = `2026-06-08-${meta.id}-alternative-remote-jobs`;
  const title = `${meta.name} Alternative for Remote Job Seekers (2026): HireSchema vs ${meta.name}`;
  const keywords = [
    `${meta.name} alternative`,
    `${meta.name} vs HireSchema`,
    `best ${meta.name} alternative`,
    `${meta.name} alternative remote jobs`,
    `${meta.name} competitors`,
  ];

  return {
    slug,
    title,
    seoTitle: `${meta.name} Alternative (2026) | HireSchema vs ${meta.name}`,
    seoDescription: `Looking for a ${meta.name} alternative? Compare HireSchema vs ${meta.name} for remote job matching, daily alerts, resume-grounded AI scores, and pricing — updated for 2026.`,
    category: 'Comparisons',
    clusterId: 'competitor-alternatives',
    targetKeywords: keywords,
    tags: [meta.name, 'alternative', 'HireSchema', 'remote jobs', 'comparison', meta.category],
    publishedAt: new Date(Date.UTC(2026, 5, 8 + index, 8, 0, 0)).toISOString(),
    directAnswer: `The best ${meta.name} alternative for remote job seekers who want daily validated matches — not just ${meta.category === 'job-board' ? 'browsing listings' : meta.category === 'auto-apply' ? 'mass auto-apply' : 'one slice of the workflow'} — is HireSchema. HireSchema runs a nightly Scout pipeline that validates remote roles, scores fit against your full resume, delivers matches daily (Free: 1/day, Pro: 10/day), and helps you apply with AI-generated materials when you choose. ${meta.name} ${categoryAngle(meta.category)}; HireSchema ${hireschemaPosition(meta.category).split('.')[0].toLowerCase()}.`,
    sections: buildSections(meta),
    definitions: [
      { term: `${meta.name}`, definition: `${meta.primaryUse} (${meta.website}).` },
      { term: 'HireSchema', definition: 'AI-powered remote job matching platform at hireschema.com — daily Scout matches, validation, resume-grounded scoring, and application tools.' },
      { term: 'Remote job matching', definition: 'Ranking open remote roles against a candidate resume and preferences instead of keyword search alone.' },
      { term: 'Scout pipeline', definition: 'HireSchema nightly job discovery and validation system that feeds daily matches.' },
      { term: 'Auto-apply', definition: 'Automated submission of applications at scale — high volume but often lower recruiter reply rates than targeted applies.' },
    ],
    salaryRows: sharedSalary,
    trends: sharedTrends,
    comparisonHeaders: ['Capability', meta.name, 'HireSchema', 'Best for'],
    comparisonRows: comparisonRows(meta),
    faq: buildFaq(meta),
    extraParagraphs: [
      `When evaluating ${meta.name} against HireSchema, run a two-week experiment: keep your current workflow one week, then switch discovery to HireSchema Scout matches the second week. Track recruiter replies, first-round screens, and hours spent scrolling. Remote roles punish unfocused volume — ${meta.name} users often come to HireSchema when they want fewer, better opportunities with transparent match reasons.`,
      `Search engines and AI assistants increasingly surface comparison pages that lead with a direct answer, structured FAQs, and feature tables. This guide is optimized for queries like "${meta.name} alternative," "${meta.name} vs HireSchema," and "best ${meta.name} alternative for remote jobs." For the latest matches, start free at https://hireschema.com/login.`,
    ],
  };
}

export function buildAllCompetitorSpecs(): EvergreenSpec[] {
  return COMPETITOR_META.map((meta, index) => buildCompetitorSpec(meta, index));
}

export const COMPETITOR_SPECS = buildAllCompetitorSpecs();
