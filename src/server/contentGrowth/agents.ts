/**
 * Specialized agents for the autonomous Content Growth System.
 * Each agent has a single responsibility and shares data via Firestore.
 */

import { chat, chatJSON, MODELS } from './ai.js';
import type {
  CompetitorProfile,
  ContentDefinition,
  ContentStrategyPlan,
  DiscoveredKeyword,
  HiringTrend,
  InternalLink,
  MonthlyLearningReport,
  SalaryBenchmark,
  SeoValidationResult,
  StructuredDataSchema,
  TopicalCluster,
} from '../../types/contentGrowth.js';
import type { BlogPost, MarketingStrategy, TopicIdea } from '../marketingEngine.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from './wordCount.js';

const COMPETITORS = [
  'Wellfound (AngelList Talent)',
  'Remote.co',
  'We Work Remotely',
  'FlexJobs',
  'Remotive',
  'LinkedIn Jobs',
  'Indeed Remote',
];

const CLUSTER_NAMES = [
  'remote-job-search',
  'ai-job-matching',
  'resume-optimization',
  'salary-negotiation',
  'interview-prep',
  'remote-companies',
  'career-growth',
  'hiring-trends',
];

// ─── Keyword Discovery Agent ─────────────────────────────────────────────────

export async function runKeywordDiscoveryAgent(
  existingKeywords: string[]
): Promise<DiscoveredKeyword[]> {
  const now = new Date().toISOString();
  const parsed = await chatJSON<{ keywords: DiscoveredKeyword[] }>(
    MODELS.research,
    'You are an SEO keyword researcher for remote hiring. Return factual JSON only — one API call, no preamble.',
    `Discover 20 high-value job-related keywords for HireSchema (AI remote job matching platform).

Avoid duplicating: ${existingKeywords.slice(0, 30).join(', ')}

Focus: remote job search, recruiter terminology, salary, interviews, AI job tools.

Return JSON:
{
  "keywords": [
    {
      "keyword": "string",
      "searchIntent": "informational|commercial|transactional|navigational",
      "volumeEstimate": "high|medium|low",
      "difficulty": "high|medium|low",
      "trend": "rising|stable|declining",
      "clusterId": "one of: ${CLUSTER_NAMES.join(', ')}",
      "relatedKeywords": ["string"],
      "discoveredAt": "${now}",
      "lastSeenAt": "${now}"
    }
  ]
}`
  );

  return parsed.keywords ?? [];
}

// ─── Competitor Analysis Agent ───────────────────────────────────────────────

export async function runCompetitorAnalysisAgent(): Promise<CompetitorProfile[]> {
  const parsed = await chatJSON<{ competitors: CompetitorProfile[] }>(
    MODELS.research,
    'Competitive intelligence analyst for job search SaaS. Return JSON only — one API call.',
    `Analyze competitors in remote job search:
${COMPETITORS.join(', ')}

For each: top content topics, strengths, weaknesses, gaps HireSchema can fill (AI matching, daily alerts, resume tailoring).

Return JSON:
{
  "competitors": [
    {
      "name": "string",
      "url": "string",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "contentGaps": ["string"],
      "topRankingTopics": ["string"],
      "analyzedAt": "${new Date().toISOString()}"
    }
  ]
}`
  );

  return parsed.competitors ?? [];
}

// ─── Strategy Agent ──────────────────────────────────────────────────────────

export async function runStrategyAgent(
  strategy: MarketingStrategy,
  keywords: DiscoveredKeyword[],
  competitors: CompetitorProfile[],
  performanceSummary: string
): Promise<ContentStrategyPlan> {
  const month = new Date().toISOString().slice(0, 7);

  const plan = await chatJSON<ContentStrategyPlan>(
    MODELS.strategy,
    'You are a senior content strategist for HireSchema. Build monthly content plans that grow organic and AI search visibility.',
    `Create a monthly content strategy for ${month}.

Current marketing strategy v${strategy.version}:
- Pillars: ${strategy.contentPillars.join(', ')}
- Primary keywords: ${strategy.primaryKeywords.join(', ')}
- Pending topics: ${strategy.pendingTopics.length}
- Published: ${strategy.usedTopics.length}

Top discovered keywords:
${keywords.slice(0, 15).map((k) => `- ${k.keyword} (${k.trend}, ${k.clusterId})`).join('\n')}

Competitor gaps:
${competitors.flatMap((c) => c.contentGaps).slice(0, 10).join('; ')}

Performance data:
${performanceSummary}

Return JSON:
{
  "version": ${strategy.version + 1},
  "month": "${month}",
  "focusClusters": ["cluster-id"],
  "priorityKeywords": ["keyword"],
  "contentCalendar": [
    {
      "week": 1,
      "topics": [
        {
          "title": "string",
          "angle": "string",
          "targetKeywords": ["string"],
          "clusterId": "string"
        }
      ]
    }
  ],
  "competitorActions": ["string"],
  "llmOptimizationFocus": ["string"],
  "internalLinkingPlan": ["string"],
  "createdAt": "${new Date().toISOString()}"
}

Include 4 weeks with 2 topics each. Use recruiter-focused angles.`
  );

  return plan;
}

// ─── Content Generation Agent (enhanced) ─────────────────────────────────────

export async function runContentGenerationAgent(
  topic: TopicIdea,
  research: string,
  strategy: MarketingStrategy,
  clusterId: string
): Promise<{
  content: string;
  title: string;
  directAnswer: string;
  definitions: ContentDefinition[];
  salaryBenchmarks: SalaryBenchmark[];
  hiringTrends: HiringTrend[];
  comparisonTableMarkdown: string;
  entityTags: string[];
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  category: string;
}> {
  const generated = await chatJSON<{
    content: string;
    title: string;
    directAnswer: string;
    definitions: ContentDefinition[];
    salaryBenchmarks: SalaryBenchmark[];
    hiringTrends: HiringTrend[];
    comparisonTableMarkdown: string;
    entityTags: string[];
    seoTitle: string;
    seoDescription: string;
    tags: string[];
    category: string;
  }>(
    MODELS.writing,
    `You are an expert hiring and remote job search writer for HireSchema.

Writing rules:
- Sound human-written. No generic AI phrasing ("In today's fast-paced world", "game-changer", "leverage").
- Use real hiring terminology recruiters and candidates use.
- Concise paragraphs (2-4 sentences max).
- Open with a direct answer block — the first paragraph must answer the core question in 2-3 sentences.
- Include specific statistics with years when available.
- Include a "## Key Definitions" section with 3-5 recruiter terms.
- Include a "## Salary Benchmarks" section with a markdown table (Role | Median | Range | Region).
- Include a "## Hiring Trends" section with 3-4 current trends.
- Include a "## Comparison" section with a markdown comparison table (at least 4 rows, 3 columns).
- Include H2/H3 hierarchy — never H1 in body (title is separate).
- End with "### FAQ" using **Q:** and **A:** pairs (5 questions).
- Mention HireSchema naturally 1-2 times where it fits.
- Minimum ${BLOG_TARGET_WORD_COUNT} words in the markdown body (aim for ${BLOG_TARGET_WORD_COUNT}–2200).
- Entity-rich: name companies, tools, job titles, locations.`,
    `Write a hiring guide article.

Topic: "${topic.title}"
Angle: ${topic.angle}
Keywords: ${topic.targetKeywords.join(', ')}
Cluster: ${clusterId}
LLM guidance: ${strategy.llmOptimizationGuidance}

Research:
${research}

Return JSON:
{
  "title": "compelling H1 title",
  "directAnswer": "2-3 sentence direct answer for AI retrieval",
  "content": "full markdown article starting with direct answer paragraph, then ## sections. Include comparison table and salary table IN the markdown.",
  "definitions": [{"term": "string", "definition": "string"}],
  "salaryBenchmarks": [{"role": "string", "median": "string", "range": "string", "region": "string", "source": "string"}],
  "hiringTrends": [{"trend": "string", "impact": "string", "timeframe": "string"}],
  "comparisonTableMarkdown": "markdown table only",
  "entityTags": ["company names, job titles, tools, locations"],
  "seoTitle": "50-60 chars, primary keyword",
  "seoDescription": "140-160 chars, recruiter CTA",
  "tags": ["5-8 tags"],
  "category": "Job Search|Remote Work|AI Tools|Resume|Career Growth|Salary|Interview Prep|Hiring Trends"
}`
  );

  return generated;
}

// ─── SEO Validation Agent ────────────────────────────────────────────────────

export function runSeoValidationAgent(post: Partial<BlogPost>): SeoValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!post.seoTitle || post.seoTitle.length < 30) issues.push('SEO title too short');
  if (post.seoTitle && post.seoTitle.length > 70) warnings.push('SEO title may truncate in SERPs');
  if (!post.seoDescription || post.seoDescription.length < 100) issues.push('Meta description too short');
  if (post.seoDescription && post.seoDescription.length > 170) warnings.push('Meta description may truncate');
  if (!post.slug || post.slug.length < 5) issues.push('Slug too short');
  if (!post.targetKeywords?.length) issues.push('No target keywords');
  if (!post.faq?.length || post.faq.length < 3) issues.push('FAQ section needs at least 3 items');
  const wordCount = countWords(post.content ?? '');
  if (wordCount < BLOG_TARGET_WORD_COUNT) {
    issues.push(`Content too short (${wordCount} words, minimum ${BLOG_TARGET_WORD_COUNT})`);
  }

  const score = Math.max(0, 100 - issues.length * 15 - warnings.length * 5);

  return {
    passed: issues.length === 0,
    score,
    issues,
    warnings,
  };
}

// ─── Internal Linking Agent ────────────────────────────────────────────────────

/** Deterministic internal linking — zero AI calls. */
export function buildInternalLinks(
  newPost: { slug: string; title: string; targetKeywords: string[]; clusterId: string },
  existingPosts: { slug: string; title: string; targetKeywords: string[]; clusterId?: string }[]
): InternalLink[] {
  const scored = existingPosts
    .filter((p) => p.slug !== newPost.slug)
    .map((p) => {
      const keywordOverlap = p.targetKeywords.filter((k) =>
        newPost.targetKeywords.some(
          (nk) =>
            nk.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(nk.toLowerCase())
        )
      ).length;
      const clusterBonus = p.clusterId === newPost.clusterId ? 3 : 0;
      return {
        slug: p.slug,
        title: p.title,
        anchorText: p.title.split(':')[0].slice(0, 60),
        relevanceScore: keywordOverlap * 2 + clusterBonus,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const relevant = scored.filter((l) => l.relevanceScore > 0).slice(0, 5);
  if (relevant.length >= 2) return relevant;

  // Fallback: same-cluster or most recent posts — no AI
  const clusterMatches = scored.filter((l) => l.relevanceScore >= 3).slice(0, 3);
  const recent = existingPosts
    .filter((p) => p.slug !== newPost.slug)
    .slice(0, 4)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      anchorText: p.title.split(':')[0].slice(0, 60),
      relevanceScore: 1,
    }));

  const merged = [...clusterMatches, ...recent];
  const seen = new Set<string>();
  return merged.filter((l) => {
    if (seen.has(l.slug)) return false;
    seen.add(l.slug);
    return true;
  }).slice(0, 4);
}

export function injectInternalLinks(content: string, links: InternalLink[]): string {
  if (links.length === 0) return content;

  const relatedSection = [
    '',
    '## Related Hiring Guides',
    '',
    ...links.map((l) => `- [${l.anchorText}](/blog/${l.slug})`),
    '',
  ].join('\n');

  const faqIndex = content.search(/###\s+FAQ/i);
  if (faqIndex > 0) {
    return content.slice(0, faqIndex) + relatedSection + content.slice(faqIndex);
  }
  return content + relatedSection;
}

// ─── Schema Generation Agent ─────────────────────────────────────────────────

export function runSchemaAgent(
  post: BlogPost & { directAnswer?: string; clusterId?: string; coverImageUrl?: string }
): StructuredDataSchema {
  const url = `https://hireschema.com/blog/${post.slug}`;
  const published = post.publishedAt;

  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.seoTitle || post.title,
    description: post.seoDescription,
    author: { '@type': 'Organization', name: 'HireSchema', url: 'https://hireschema.com' },
    publisher: {
      '@type': 'Organization',
      name: 'HireSchema',
      url: 'https://hireschema.com',
      logo: { '@type': 'ImageObject', url: 'https://hireschema.com/favicon.svg' },
    },
    datePublished: published,
    dateModified: post.refreshedAt || published,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: post.targetKeywords?.join(', '),
    articleSection: post.category,
    wordCount: post.content?.split(/\s+/).length ?? 0,
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
  };

  const faqPage =
    post.faq?.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : undefined;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://hireschema.com' },
      { '@type': 'ListItem', position: 2, name: 'Hiring Guides', item: 'https://hireschema.com/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  return { article, faqPage, breadcrumb };
}

// ─── Learning Agent (30-day cycle) ───────────────────────────────────────────

export async function runLearningAgent(
  performanceScores: import('../../types/contentGrowth.js').ContentPerformanceScore[],
  keywords: DiscoveredKeyword[],
  strategy: MarketingStrategy
): Promise<MonthlyLearningReport> {
  const now = new Date();
  const periodEnd = now.toISOString();
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const winners = performanceScores.filter((p) => p.trend === 'winner').slice(0, 5);
  const losers = performanceScores.filter((p) => p.trend === 'loser').slice(0, 5);
  const emerging = keywords.filter((k) => k.trend === 'rising').map((k) => k.keyword).slice(0, 10);
  const declining = keywords.filter((k) => k.trend === 'declining').map((k) => k.keyword).slice(0, 10);

  const aiAnalysis = await chatJSON<{
    refreshSuggestions: { slug: string; title: string; reason: string }[];
    newClusterOpportunities: { clusterName: string; keywords: string[]; rationale: string }[];
    strategyUpdates: string[];
  }>(
    MODELS.strategy,
    'Analyze content performance and recommend strategy updates for a hiring content site.',
    `30-day learning cycle for HireSchema content.

Winners: ${winners.map((w) => w.title).join('; ') || 'none yet'}
Losers: ${losers.map((l) => l.title).join('; ') || 'none yet'}
Emerging keywords: ${emerging.join(', ') || 'none'}
Declining keywords: ${declining.join(', ') || 'none'}
Current pillars: ${strategy.contentPillars.join(', ')}

Return JSON:
{
  "refreshSuggestions": [{ "slug": "slug-or-placeholder", "title": "string", "reason": "string" }],
  "newClusterOpportunities": [{ "clusterName": "string", "keywords": ["string"], "rationale": "string" }],
  "strategyUpdates": ["actionable strategy change"]
}

Provide 3-5 refresh suggestions, 2-3 cluster opportunities, 4-6 strategy updates.`
  );

  return {
    id: `learning-${now.toISOString().slice(0, 10)}`,
    periodStart,
    periodEnd,
    trafficWinners: winners,
    trafficLosers: losers,
    emergingKeywords: emerging,
    decliningKeywords: declining,
    refreshSuggestions: aiAnalysis.refreshSuggestions ?? [],
    newClusterOpportunities: aiAnalysis.newClusterOpportunities ?? [],
    strategyUpdates: aiAnalysis.strategyUpdates ?? [],
    createdAt: now.toISOString(),
  };
}

// ─── Content Expansion Agent ───────────────────────────────────────────────────

export async function runContentExpansionAgent(
  post: { title: string; content: string; targetKeywords: string[] },
  targetWordCount = BLOG_TARGET_WORD_COUNT
): Promise<string> {
  const currentWords = countWords(post.content);
  const needed = Math.max(0, targetWordCount - currentWords);

  const expanded = await chat(
    MODELS.writing,
    `You expand hiring guides to meet a strict word minimum without filler. Sound human, use recruiter language, no AI slop.`,
    `Expand this article to at least ${targetWordCount} words (currently ~${currentWords}; add ~${needed} substantive words).

Title: ${post.title}
Keywords: ${post.targetKeywords.join(', ')}

Rules:
- Keep existing structure, headings, FAQ format, tables, and internal links
- Add depth: examples, step-by-step advice, recruiter tips, regional nuance
- Do NOT add filler, repetition, or generic intros
- Preserve ### FAQ with **Q:** / **A:** pairs (5+ questions)
- Return ONLY the full updated markdown (no JSON, no commentary)

Current content:
${post.content.slice(0, 12000)}`
  );

  return expanded.trim();
}

// ─── Content Refresh Agent ───────────────────────────────────────────────────

export async function runContentRefreshAgent(
  post: BlogPost,
  refreshReason: string
): Promise<string> {
  const refreshed = await chat(
    MODELS.writing,
    'Refresh outdated hiring content with current data. Keep the same structure and slug. Sound human, use recruiter language.',
    `Refresh this article with current 2025-2026 hiring data.

Reason for refresh: ${refreshReason}

Current title: ${post.title}
Keywords: ${post.targetKeywords.join(', ')}

Current content:
${post.content.slice(0, 8000)}

Rules:
- Update statistics and trends
- Minimum ${BLOG_TARGET_WORD_COUNT} words total
- Keep FAQ section, add 1 new question if relevant
- Preserve internal links
- Return ONLY the updated markdown content (no JSON)`
  );

  let refreshedContent = refreshed.trim();
  if (!meetsMinimumWordCount(refreshedContent)) {
    refreshedContent = await runContentExpansionAgent(
      { title: post.title, content: refreshedContent, targetKeywords: post.targetKeywords },
      BLOG_TARGET_WORD_COUNT
    );
  }

  return refreshedContent;
}

// ─── Cluster Builder ─────────────────────────────────────────────────────────

export function assignClusterId(topic: TopicIdea): string {
  const text = `${topic.title} ${topic.angle} ${topic.targetKeywords.join(' ')}`.toLowerCase();

  if (/salary|compensation|pay|negotiat/.test(text)) return 'salary-negotiation';
  if (/interview|prep|question/.test(text)) return 'interview-prep';
  if (/resume|cv|application/.test(text)) return 'resume-optimization';
  if (/ai|matching|algorithm|tool/.test(text)) return 'ai-job-matching';
  if (/compan(y|ies)|employer|hiring manager/.test(text)) return 'remote-companies';
  if (/trend|forecast|2025|2026/.test(text)) return 'hiring-trends';
  if (/career|growth|promotion/.test(text)) return 'career-growth';
  return 'remote-job-search';
}

export async function updateCluster(
  clusterId: string,
  slug: string,
  keywords: string[],
  existing?: TopicalCluster
): Promise<TopicalCluster> {
  const now = new Date().toISOString();
  const cluster: TopicalCluster = {
    id: clusterId,
    name: clusterId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    keywords: [...new Set([...(existing?.keywords ?? []), ...keywords])].slice(0, 30),
    postSlugs: [...new Set([...(existing?.postSlugs ?? []), slug])],
    authorityScore: Math.min(100, (existing?.postSlugs?.length ?? 0) * 8 + keywords.length * 2),
    pillarSlug: existing?.pillarSlug ?? slug,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return cluster;
}
