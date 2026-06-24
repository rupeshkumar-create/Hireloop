/** Curated product blog — the only posts served by /api/blog. */
export type CoreBlogPost = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  targetKeywords: string[];
  readTimeMinutes: number;
  publishedAt: string;
  status: 'published';
  clusterId: 'hireloop';
  directAnswer?: string;
  faq?: { question: string; answer: string }[];
};

const PUBLISHED = '2026-06-01T10:00:00.000Z';

export const CORE_BLOG_POSTS: CoreBlogPost[] = [
  {
    slug: 'meet-jack-your-ai-career-copilot',
    title: 'Meet Jack: Your AI Career Copilot',
    seoTitle: 'Meet Jack — AI Career Copilot | Hireloop',
    seoDescription:
      'Jack is Hireloop\'s chat-first AI agent that scouts roles, coaches interviews, and negotiates salary — built for candidates who want a copilot, not another job board.',
    excerpt:
      'Jack is a persistent career agent in chat: he learns your resume, runs nightly Scout matches, and helps you practice interviews and negotiate offers.',
    category: 'Product',
    tags: ['jack', 'career copilot', 'ai agent'],
    targetKeywords: ['ai career copilot', 'job search agent'],
    readTimeMinutes: 5,
    publishedAt: PUBLISHED,
    status: 'published',
    clusterId: 'hireschema',
    directAnswer:
      'Jack is Hireloop\'s candidate-facing AI agent — a chat copilot that scouts real jobs nightly, surfaces matches with reasons, and helps with mock interviews, salary coaching, and warm recruiter intros.',
    content: `## What Jack does

Jack is not a job board with a chat widget bolted on. He is the primary interface for Hireloop: you talk to him, he remembers your goals, and he acts on your behalf between sessions.

Every night, **Scout** runs in the background. It searches the live web for real listings, validates them against your preferences, scores fit against your resume, and stores the best matches. When you open chat, Jack walks you through them one by one — with match reasons, skill gaps, and a clear yes/no on whether to pursue each role.

## Chat-first, not form-first

Traditional job platforms ask you to fill filters and scroll infinite lists. Jack inverts that:

- You onboard in conversation — resume upload, career paths, salary floor, remote preferences.
- Matches appear as cards inside the thread, not a separate grid you have to hunt through.
- Modes like **mock interview**, **salary coaching**, and **negotiation prep** are one tap away.

Your conversation history lives in your profile so Jack picks up where you left off.

## What Jack will not do

Hireloop has hard rules: no fabricated jobs, no AI rescuing listings that fail validation, no hallucinated experience on tailored resumes. Jack works with real data or tells you what is missing.

## Get started

Sign in, complete onboarding, and open **Jack** at \`/chat\`. Your first Scout run uses the same pipeline as the nightly cron — real URLs, real companies, scored against your actual background.

---

*Related: [How Scout finds jobs](/blog/how-scout-finds-real-jobs-every-night) · [Jill for recruiters](/blog/jill-warm-intros-for-recruiters)*`,
  },
  {
    slug: 'jill-warm-intros-for-recruiters',
    title: 'Jill: Warm Intros for Recruiters',
    seoTitle: 'Jill — Recruiter AI & Warm Intros | Hireloop',
    seoDescription:
      'Jill is Hireloop\'s recruiter-side agent. Post roles, review candidate matches, and send warm introductions — candidates opt in through Jack before any outreach.',
    excerpt:
      'Jill helps recruiters post roles and send warm introductions. Candidates approve intros in Jack first — no cold spam.',
    category: 'Product',
    tags: ['jill', 'recruiters', 'warm intros'],
    targetKeywords: ['recruiter ai', 'warm introductions hiring'],
    readTimeMinutes: 5,
    publishedAt: '2026-06-02T10:00:00.000Z',
    status: 'published',
    clusterId: 'hireschema',
    directAnswer:
      'Jill is Hireloop\'s recruiter agent at /jill. Recruiters post jobs, review AI-matched candidates, and request warm intros that candidates must accept in Jack before contact details are shared.',
    content: `## Two agents, one loop

Hireloop mirrors the [Jack & Jill](https://www.jackandjill.ai/) model: **Jack** advocates for candidates; **Jill** advocates for hiring teams. They meet in the middle through **warm introductions** — never blind cold outreach.

## How Jill works

1. **Recruiter onboarding** — Sign in and open \`/jill\` (no candidate onboarding required).
2. **Post a role** — Title, company, requirements, and location/remote policy.
3. **Review matches** — Jill surfaces candidates whose Scout profiles align with the role.
4. **Request an intro** — Jill drafts context for the candidate; Jack shows a preview in chat.
5. **Candidate accepts** — Only after the candidate taps accept are contact details exchanged.

## Why warm intros matter

Candidates are tired of generic InMails. Recruiters are tired of spray-and-pray. A double-opt-in intro means both sides have context before the first message — role, fit summary, and what the candidate actually wants next.

## Privacy by design

Candidates control the gate. Jack notifies them of pending intros and polls for status updates. Declined intros never leak contact information.

---

*Related: [Meet Jack](/blog/meet-jack-your-ai-career-copilot) · [From match to offer](/blog/from-match-to-offer-the-hireschema-workflow)*`,
  },
  {
    slug: 'how-scout-finds-real-jobs-every-night',
    title: 'How Scout Finds Real Jobs Every Night',
    seoTitle: 'How Scout Job Discovery Works | Hireloop',
    seoDescription:
      'Scout is Hireloop\'s nightly pipeline: web search, deduplication, hard validation, AI scoring, and enrichment — no fake listings, no client-side generation.',
    excerpt:
      'Scout discovers listings via live web search, validates them with hard rules, scores fit with AI, and delivers your top matches by email and in Jack.',
    category: 'Product',
    tags: ['scout', 'job matching', 'pipeline'],
    targetKeywords: ['ai job matching pipeline', 'automated job search'],
    readTimeMinutes: 6,
    publishedAt: '2026-06-03T10:00:00.000Z',
    status: 'published',
    clusterId: 'hireschema',
    directAnswer:
      'Scout runs a nightly pipeline: generate search queries from your profile, harvest real listings from the web, deduplicate, apply deterministic validation, AI-score matches, enrich top results, then store and email them before Jack displays them in chat.',
    content: `## The canonical pipeline

Scout is the engine behind every match you see in Jack and on the dashboard:

\`\`\`
Profile → Query generation → Web harvest → Deduplicate
→ Validator (hard rules) → AI scoring → Top enrichment
→ Final score → Store → Email → Dashboard / Chat
\`\`\`

## Hard rules before AI

The **validator** runs first and cannot be overridden by AI:

- Real apply URLs (no placeholder links)
- Location and remote preferences
- Salary floor when specified
- Freshness windows
- Duplicate fingerprints (\`title::company\`)

If a listing fails, it is dropped — not "rescued" by a model.

## Scoring and selection

Surviving jobs are batch-scored against your resume. The top set gets enrichment: match reasons, skill gaps, summaries, and hot signals. A composite **final score** blends match quality, freshness, listing quality, and momentum.

## Learning without breaking rules

When you save, skip, or apply, **learning signals** improve the next cycle's search queries. They never bypass validation — they make Scout smarter about what to look for, not looser about what to accept.

## Run Scout manually

You can trigger Scout from the dashboard or ask Jack to run it. The same server pipeline executes — there is no separate "demo" job source.

---

*Related: [Meet Jack](/blog/meet-jack-your-ai-career-copilot) · [Why chat-first](/blog/why-we-built-a-chat-first-job-search-agent)*`,
  },
  {
    slug: 'from-match-to-offer-the-hireschema-workflow',
    title: 'From Match to Offer: The Hireloop Workflow',
    seoTitle: 'Job Search Workflow — Match to Offer | Hireloop',
    seoDescription:
      'A practical Hireloop workflow: review Scout matches in Jack, save to Pipeline, generate tailored assets, practice interviews, and track through to offer.',
    excerpt:
      'Review matches in Jack, save strong roles to Pipeline, generate emails and resumes, practice interviews, and track status through to offer.',
    category: 'Product',
    tags: ['workflow', 'pipeline', 'applications'],
    targetKeywords: ['job application workflow', 'ai job search workflow'],
    readTimeMinutes: 5,
    publishedAt: '2026-06-04T10:00:00.000Z',
    status: 'published',
    clusterId: 'hireschema',
    directAnswer:
      'The Hireloop workflow: Jack presents nightly Scout matches → you save fits to Pipeline → generate grounded application assets → practice in mock interview mode → track saved/applied/interviewing states → accept warm recruiter intros when relevant.',
    content: `## 1. Review today's matches

Open **Jack** (\`/chat\`) or the **dashboard**. Each match includes a score, company, role summary, and AI insight. Say yes to pursue, no to skip — Jack learns from both.

## 2. Save to Pipeline

Strong fits go to **Pipeline** (\`/jobs\`). Saved roles unlock the job detail panel: apply link, match breakdown, and AI actions.

## 3. Generate application assets

From a saved role you can generate:

- **Cold email** — grounded in your resume and the listing (no generic "I am excited" filler)
- **Tailored resume** — reframes real experience for the role without inventing employers
- **Interview questions** — role-specific prep

All generation runs server-side through the OpenRouter proxy — never from fabricated job data.

## 4. Practice and negotiate

Use Jack's mode chips for **mock interview** (including voice), **salary coaching**, and **negotiation** scripts based on your target comp and the role context.

## 5. Track and iterate

Pipeline statuses — saved, applied, interviewing, offered, rejected — feed back into learning signals for the next Scout cycle.

## 6. Recruiter intros

When Jill requests an intro, Jack shows a preview card. Accept only if you want the conversation; your email is not shared until you confirm.

---

*Related: [Meet Jack](/blog/meet-jack-your-ai-career-copilot) · [How Scout works](/blog/how-scout-finds-real-jobs-every-night)*`,
  },
  {
    slug: 'why-we-built-a-chat-first-job-search-agent',
    title: 'Why We Built a Chat-First Job Search Agent',
    seoTitle: 'Why Chat-First Job Search | Hireloop',
    seoDescription:
      'Job search is emotionally heavy and information-dense. Hireloop chose a conversational agent over another dashboard because guidance beats filters.',
    excerpt:
      'Job search is high-stakes and noisy. We built Hireloop as a chat-first agent so candidates get guidance, not another infinite scroll.',
    category: 'Product',
    tags: ['mission', 'product design', 'ai agent'],
    targetKeywords: ['chat first job search', 'ai job search agent'],
    readTimeMinutes: 4,
    publishedAt: '2026-06-05T10:00:00.000Z',
    status: 'published',
    clusterId: 'hireschema',
    directAnswer:
      'Hireloop is chat-first because job search is decision-heavy: candidates need an agent that explains matches, coaches next steps, and remembers context — not another passive list of links.',
    content: `## The problem with job boards

Most platforms optimize for **volume**: more listings, more clicks, more tabs. Candidates drown in noise. Recruiters drown in irrelevant applications. Everyone loses time.

AI made this worse before it made it better — generic cover letters, fake listings, and "matching" that is just keyword overlap.

## Our bet: agency, not alerts

Hireloop treats the candidate as someone hiring an **agent**, not browsing a catalog:

- **Jack** explains *why* a role fits and what to do next.
- **Scout** does the overnight legwork so mornings start with curated options, not a blank search bar.
- **Jill** gives recruiters a consent-based path to strong candidates.

## Free by design

Jack is free to use locally and in production — no paywall on matches or core AI coaching. We removed pricing upsells from the dashboard because the agent model only works if you actually use the agent daily.

## What we are optimizing for

1. **Signal over volume** — fewer, better matches
2. **Grounded AI** — every output tied to real resume and listing data
3. **Trust on both sides** — warm intros, validation gates, transparent scoring

If that resonates, [start with Jack](/login) and let Scout run tonight.

---

*Related: [Meet Jack](/blog/meet-jack-your-ai-career-copilot) · [Jill for recruiters](/blog/jill-warm-intros-for-recruiters)*`,
  },
];

export function listCoreBlogSummaries(limit = CORE_BLOG_POSTS.length) {
  return CORE_BLOG_POSTS.slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit)
    .map(({ content: _c, ...rest }) => {
      void _c;
      return rest;
    });
}

export function getCoreBlogPostBySlug(slug: string): CoreBlogPost | null {
  return CORE_BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
