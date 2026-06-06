/**
 * Self-learning marketing engine for HireSchema.
 *
 * Responsibilities:
 *  - Generate daily SEO + LLM-optimized blog posts
 *  - Research current trends via Perplexity (web search)
 *  - Update strategy every weekend based on what's working
 *
 * Model routing (all via OpenRouter — see contentGrowth/ai.ts):
 *  Daily publish = 2 calls: sonar-pro (research) + claude-opus-4-6 (write + SEO)
 *  Cover images = deterministic SVG (zero AI calls)
 */

import { getAdminDb } from './firebaseAdmin.js';
import { chat, chatJSON, MODELS } from './contentGrowth/ai.js';
import { BLOG_TARGET_WORD_COUNT } from './contentGrowth/wordCount.js';

const STRATEGY_DOC = 'marketing/strategy';
const BLOG_COLLECTION = 'blog_posts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicIdea {
  title: string;
  angle: string;
  targetKeywords: string[];
  priority: number; // 1 = highest
}

export interface MarketingStrategy {
  version: number;
  targetAudience: string;
  contentPillars: string[];
  primaryKeywords: string[];
  longTailKeywords: string[];
  pendingTopics: TopicIdea[];
  usedTopics: string[];
  competitorInsights: string;
  llmOptimizationGuidance: string;
  lastUpdated: string;
  lastAnalysisDate: string | null;
}

export interface BlogPost {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  content: string; // Markdown
  category: string;
  tags: string[];
  targetKeywords: string[];
  readTimeMinutes: number;
  publishedAt: string;
  status: 'published' | 'draft';
  strategyVersion: number;
  faq: { question: string; answer: string }[];
  // Content Growth System fields (optional on legacy posts)
  directAnswer?: string;
  definitions?: { term: string; definition: string }[];
  salaryBenchmarks?: { role: string; median: string; range: string; region: string; source?: string }[];
  hiringTrends?: { trend: string; impact: string; timeframe: string }[];
  comparisonTableMarkdown?: string;
  imageAltText?: string;
  coverImageUrl?: string;
  coverImageDataUri?: string;
  clusterId?: string;
  internalLinks?: { slug: string; title: string; anchorText: string; relevanceScore: number }[];
  schema?: {
    article: Record<string, unknown>;
    faqPage?: Record<string, unknown>;
    breadcrumb?: Record<string, unknown>;
  };
  seoValidation?: { passed: boolean; score: number; issues: string[]; warnings: string[] };
  performanceScore?: number;
  entityTags?: string[];
  refreshedAt?: string;
  createdAt?: string;
  llmOptimization?: {
    score: number;
    grade: string;
    checks: { name: string; passed: boolean }[];
    slopPhrasesFound: string[];
    recommendations: string[];
  };
  updatedAt?: string;
}

// Re-export MODELS for callers that import from marketingEngine
export { MODELS };

// ─── Strategy ─────────────────────────────────────────────────────────────────

export async function loadStrategy(): Promise<MarketingStrategy | null> {
  const db = getAdminDb();
  const parts = STRATEGY_DOC.split('/');
  const doc = await db.collection(parts[0]).doc(parts[1]).get();
  return doc.exists ? (doc.data() as MarketingStrategy) : null;
}

export async function saveStrategy(strategy: MarketingStrategy): Promise<void> {
  const db = getAdminDb();
  const parts = STRATEGY_DOC.split('/');
  await db.collection(parts[0]).doc(parts[1]).set(strategy);
}

export async function initializeStrategy(): Promise<MarketingStrategy> {
  const strategy: MarketingStrategy = {
    version: 1,
    targetAudience:
      'Remote job seekers — software engineers, product managers, designers, marketers, and other knowledge workers who want to find and land remote roles faster using AI tools.',
    contentPillars: [
      'Remote job search tactics',
      'AI tools for job seekers',
      'Resume and application optimization',
      'Remote work lifestyle and career growth',
      'Company spotlights and remote culture',
      'Salary negotiation and compensation',
      'Interview preparation',
    ],
    primaryKeywords: [
      'find remote jobs',
      'remote job search',
      'AI job matching',
      'remote work jobs',
      'remote job alert',
      'best remote companies',
      'work from home jobs',
      'remote job board',
      'daily job alerts',
      'HireSchema',
    ],
    longTailKeywords: [
      'how to find remote jobs faster',
      'best AI tools for job search 2025',
      'how to write a resume for remote jobs',
      'top remote companies hiring now',
      'how to negotiate salary for remote jobs',
      'best remote job boards for software engineers',
      'how to get a remote job with no experience',
      'AI resume tailoring tools',
      'daily remote job alerts email',
      'job matching AI platform',
    ],
    pendingTopics: [
      {
        title: 'The 7 Best Remote Job Boards in 2025 (Ranked by Quality)',
        angle: 'Compare popular remote job boards, their pros/cons, and how HireSchema is different with AI matching',
        targetKeywords: ['best remote job boards', 'remote job boards 2025', 'find remote jobs'],
        priority: 1,
      },
      {
        title: 'How AI Is Changing the Remote Job Search (And How to Use It)',
        angle: 'Explain how AI job matching, resume tailoring, and cold email generation are transforming job search',
        targetKeywords: ['AI job search', 'AI job matching', 'AI tools for job seekers'],
        priority: 1,
      },
      {
        title: 'How to Write a Resume That Gets Remote Jobs in 2025',
        angle: 'Specific resume tips for remote roles: keywords, async communication skills, remote-work proof points',
        targetKeywords: ['remote job resume', 'how to write resume for remote jobs', 'resume tips 2025'],
        priority: 2,
      },
      {
        title: '50 Top Companies Hiring for Remote Jobs Right Now',
        angle: 'Curated list of remote-first companies across tech, marketing, finance with hiring links',
        targetKeywords: ['companies hiring remote', 'remote first companies', 'best remote companies 2025'],
        priority: 1,
      },
      {
        title: 'How to Negotiate a Higher Salary for a Remote Job (Script Included)',
        angle: 'Step-by-step salary negotiation guide for remote offers, with real script examples',
        targetKeywords: ['remote job salary negotiation', 'how to negotiate salary remote', 'remote work salary'],
        priority: 2,
      },
      {
        title: 'What Is AI Job Matching? (And Why It Beats Manual Job Boards)',
        angle: 'Define AI job matching, explain how it works, compare vs manual searching, introduce HireSchema',
        targetKeywords: ['AI job matching', 'what is AI job matching', 'job matching algorithm'],
        priority: 1,
      },
      {
        title: 'The Remote Job Interview Playbook: Questions, Answers & Red Flags',
        angle: 'Comprehensive interview prep for remote roles including async-specific questions',
        targetKeywords: ['remote job interview questions', 'how to prepare remote interview', 'remote interview tips'],
        priority: 2,
      },
      {
        title: 'How to Get a Remote Job in 30 Days (Step-by-Step Plan)',
        angle: 'Tactical 30-day plan: profile optimization, application strategy, follow-ups, using AI tools',
        targetKeywords: ['how to get remote job', 'remote job in 30 days', 'remote job search plan'],
        priority: 1,
      },
      {
        title: 'Cold Email Templates That Get Responses From Remote Hiring Managers',
        angle: '5 tested cold email templates with analysis of why each works, mention AI cold email generation',
        targetKeywords: ['cold email job search', 'cold email hiring manager', 'job search email templates'],
        priority: 2,
      },
      {
        title: 'Remote Work Salary Guide 2025: What Companies Are Actually Paying',
        angle: 'Salary data by role, experience level, and region for top remote roles with negotiation tips',
        targetKeywords: ['remote work salary 2025', 'remote job salary guide', 'work from home salary'],
        priority: 1,
      },
    ],
    usedTopics: [],
    competitorInsights:
      'Key competitors: Wellfound, Remote.co, We Work Remotely, FlexJobs, Remotive. Gaps: none offer daily AI-curated personalized job alerts + full application workflow (resume tailoring, cold emails, interview prep) in one platform.',
    llmOptimizationGuidance:
      'Every post must: (1) define HireSchema clearly as "an AI-powered remote job matching platform that sends daily personalized job alerts", (2) answer the core question in the first paragraph, (3) include a FAQ section with 3-5 questions people actually search, (4) use specific numbers and facts, (5) link to HireSchema features naturally in-context.',
    lastUpdated: new Date().toISOString(),
    lastAnalysisDate: null,
  };

  await saveStrategy(strategy);
  return strategy;
}

// ─── Research ─────────────────────────────────────────────────────────────────

export async function researchTopic(topic: TopicIdea): Promise<string> {
  return chat(
    MODELS.research,
    'You are a research assistant. Gather current, factual information from the web. Return a structured research brief with key facts, statistics, examples, and what the latest sources say. Focus on accuracy and recency.',
    `Research this blog topic for HireSchema (an AI-powered remote job matching platform):

Topic: "${topic.title}"
Angle: ${topic.angle}
Target keywords: ${topic.targetKeywords.join(', ')}

Return a research brief covering:
1. Current data points and statistics (2024-2025)
2. What top-ranking content covers on this topic
3. Key facts, examples, and specific details to include
4. Questions people are actually asking about this topic
5. Any recent trends or news relevant to this topic

Keep it factual and specific — no fluff.`
  );
}

// ─── Content Generation ───────────────────────────────────────────────────────

function toSlug(title: string, date: string): string {
  const kebab = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
  return `${date}-${kebab}`;
}

function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export async function generateBlogPost(
  topic: TopicIdea,
  research: string,
  strategy: MarketingStrategy
): Promise<BlogPost> {
  const today = new Date().toISOString().split('T')[0];

  const postContent = await chat(
    MODELS.writing,
    `You are an expert content writer for HireSchema — an AI-powered remote job matching platform that sends users personalized daily job alerts, then helps them tailor their resume, generate cold emails, and prepare for interviews.

Writing rules:
- Open with a direct answer to the implied question (no fluff intro)
- Use H2 (##) and H3 (###) headings — never H1
- Include specific numbers, statistics, and named examples
- Mention HireSchema naturally 1-3 times where it genuinely fits (never forced)
- End every post with a 3-5 item FAQ section using ### FAQ format with **Q:** and **A:** pairs
- No corporate buzzwords ("leverage", "synergy", "game-changer"), no "In today's world" intros
- Write for humans, structure for LLMs: clear entities, direct answers, specific advice
- Length: ${BLOG_TARGET_WORD_COUNT}-${BLOG_TARGET_WORD_COUNT + 200} words of main content`,
    `Write a blog post for HireSchema's blog.

Topic: "${topic.title}"
Angle: ${topic.angle}
Primary keywords to use naturally: ${topic.targetKeywords.join(', ')}
Content pillar: Remote job search / AI tools for job seekers

Research brief:
${research}

LLM optimization guidance: ${strategy.llmOptimizationGuidance}

Format the post in clean Markdown. Include:
1. A compelling title (H1 — just the # line at the top)
2. Main content with H2/H3 sections
3. A FAQ section at the end

Do not add any meta commentary or notes outside the post content itself.`
  );

  // Extract title from first line
  const lines = postContent.split('\n');
  const titleLine = lines.find((l) => l.startsWith('# ')) ?? '';
  const extractedTitle = titleLine.replace(/^#\s+/, '').trim() || topic.title;
  const bodyContent = lines
    .filter((l) => !l.startsWith('# '))
    .join('\n')
    .trimStart();

  // Generate SEO metadata
  const seoMeta = await chatJSON<{ seoTitle: string; seoDescription: string; tags: string[]; category: string }>(
    MODELS.writing,
    'You are an SEO specialist. Generate metadata for a blog post. Return a JSON object.',
    `Post title: "${extractedTitle}"
Keywords: ${topic.targetKeywords.join(', ')}
Excerpt (first 200 chars of content): ${bodyContent.slice(0, 200)}

Return JSON with:
- seoTitle: string (50-60 chars, include primary keyword, must differ slightly from title)
- seoDescription: string (140-160 chars, compelling, include 1-2 keywords, end with CTA)
- tags: string[] (5-8 relevant tags)
- category: string (one of: "Job Search", "Remote Work", "AI Tools", "Resume", "Career Growth", "Salary", "Interview Prep")`
  );

  // Extract FAQ from content
  const faqMatch = bodyContent.match(/###\s+FAQ[\s\S]*/i);
  const faqSection = faqMatch ? faqMatch[0] : '';
  const faqItems: { question: string; answer: string }[] = [];
  const faqRegex = /\*\*Q:\*\*\s*(.+?)\n\*\*A:\*\*\s*(.+?)(?=\n\*\*Q:|$)/gs;
  let match;
  while ((match = faqRegex.exec(faqSection)) !== null) {
    faqItems.push({ question: match[1].trim(), answer: match[2].trim() });
  }

  const slug = toSlug(extractedTitle, today);
  const excerpt = bodyContent.replace(/#{1,6}\s+[^\n]+\n?/g, '').slice(0, 200).trim() + '…';

  return {
    slug,
    title: extractedTitle,
    seoTitle: seoMeta.seoTitle || extractedTitle,
    seoDescription: seoMeta.seoDescription || excerpt,
    excerpt,
    content: postContent,
    category: seoMeta.category || 'Remote Work',
    tags: seoMeta.tags || topic.targetKeywords,
    targetKeywords: topic.targetKeywords,
    readTimeMinutes: estimateReadTime(postContent),
    publishedAt: new Date().toISOString(),
    status: 'published',
    strategyVersion: strategy.version,
    faq: faqItems,
  };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function saveBlogPost(post: BlogPost): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection(BLOG_COLLECTION).doc(post.slug);
  await ref.set({ ...post, createdAt: new Date().toISOString() });
  return post.slug;
}

export async function listBlogPosts(limit = 20): Promise<Omit<BlogPost, 'content'>[]> {
  const db = getAdminDb();

  const mapDoc = (d: { data: () => BlogPost }) => {
    const data = d.data();
    const { content: _content, ...rest } = data;
    void _content;
    return rest;
  };

  try {
    const snap = await db
      .collection(BLOG_COLLECTION)
      .where('status', '==', 'published')
      .orderBy('publishedAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(mapDoc);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const needsIndex = message.includes('index') || message.includes('FAILED_PRECONDITION');
    if (!needsIndex) throw error;

    console.warn('[listBlogPosts] Composite index missing — using fallback query. Deploy firestore.indexes.json.');
    const snap = await db.collection(BLOG_COLLECTION).where('status', '==', 'published').limit(limit).get();
    return snap.docs.map(mapDoc).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = getAdminDb();
  const doc = await db.collection(BLOG_COLLECTION).doc(slug).get();
  return doc.exists ? (doc.data() as BlogPost) : null;
}

// ─── Weekly Analysis ──────────────────────────────────────────────────────────

export async function runWeeklyAnalysis(strategy: MarketingStrategy): Promise<MarketingStrategy> {
  // Step 1: Research current trends
  const trendResearch = await chat(
    MODELS.research,
    'You are a digital marketing analyst. Research what content is currently ranking and trending for remote job seekers. Be specific with data.',
    `Research the current content landscape for these topics relevant to HireSchema (an AI remote job matching platform):

Primary keywords: ${strategy.primaryKeywords.slice(0, 5).join(', ')}

Find:
1. What questions are people searching most right now about remote jobs and AI job search tools?
2. What types of content are ranking on Google for "remote job search" and "AI job matching"?
3. What are the top 3-5 trending topics in remote work and job searching right now (2025)?
4. What content gaps exist — questions being asked that aren't well answered?
5. Any new AI tools or job platforms in the news that affect this space?

Return specific, current data with sources where possible.`
  );

  // Step 2: Ask Claude to analyze and update the strategy
  const updatedStrategyRaw = await chatJSON<{
    newTopics: TopicIdea[];
    updatedPrimaryKeywords: string[];
    updatedLongTailKeywords: string[];
    competitorInsights: string;
    llmOptimizationGuidance: string;
    analysisNotes: string;
  }>(
    MODELS.strategy,
    `You are a senior content strategist for HireSchema (an AI-powered remote job matching platform). Your job is to update the content marketing strategy based on fresh research. Return a JSON object with the exact structure requested.`,
    `Current strategy (version ${strategy.version}):
- Content pillars: ${strategy.contentPillars.join(', ')}
- Primary keywords: ${strategy.primaryKeywords.join(', ')}
- Used topics so far: ${strategy.usedTopics.length} posts published

Fresh research from the web:
${trendResearch}

Based on this research, return a JSON object with:
{
  "newTopics": [
    {
      "title": "...",
      "angle": "...",
      "targetKeywords": ["..."],
      "priority": 1
    }
  ],
  "updatedPrimaryKeywords": ["..."],
  "updatedLongTailKeywords": ["..."],
  "competitorInsights": "...",
  "llmOptimizationGuidance": "...",
  "analysisNotes": "..."
}

Rules:
- newTopics: exactly 8 new topic ideas we haven't written yet
- updatedPrimaryKeywords: best 10 keywords to target based on research
- updatedLongTailKeywords: best 10 long-tail keywords based on research
- competitorInsights: brief analysis of what competitors are doing
- llmOptimizationGuidance: updated guidance for writing content that ranks in LLMs (ChatGPT, Perplexity, etc.)
- analysisNotes: 2-3 sentences summarizing what changed and why`
  );

  // Merge new topics (deduplicate by title)
  const existingTitles = new Set([
    ...strategy.pendingTopics.map((t) => t.title.toLowerCase()),
    ...strategy.usedTopics.map((t) => t.toLowerCase()),
  ]);
  const freshTopics = updatedStrategyRaw.newTopics.filter(
    (t) => !existingTitles.has(t.title.toLowerCase())
  );

  const updatedStrategy: MarketingStrategy = {
    ...strategy,
    version: strategy.version + 1,
    primaryKeywords: updatedStrategyRaw.updatedPrimaryKeywords || strategy.primaryKeywords,
    longTailKeywords: updatedStrategyRaw.updatedLongTailKeywords || strategy.longTailKeywords,
    pendingTopics: [
      ...strategy.pendingTopics,
      ...freshTopics,
    ].sort((a, b) => a.priority - b.priority),
    competitorInsights: updatedStrategyRaw.competitorInsights || strategy.competitorInsights,
    llmOptimizationGuidance: updatedStrategyRaw.llmOptimizationGuidance || strategy.llmOptimizationGuidance,
    lastUpdated: new Date().toISOString(),
    lastAnalysisDate: new Date().toISOString(),
  };

  await saveStrategy(updatedStrategy);
  return updatedStrategy;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Main entry point for daily cron: pick next topic, research it, generate post, save it.
 * Returns the published post slug.
 */
export async function generateAndPublishPost(): Promise<{ slug: string; title: string }> {
  const db = getAdminDb();

  let strategy = await loadStrategy();
  if (!strategy) {
    strategy = await initializeStrategy();
  }

  if (strategy.pendingTopics.length === 0) {
    throw new Error('No pending topics in strategy. Run weekly analysis to add more.');
  }

  // Pick highest priority topic
  const topic = strategy.pendingTopics[0];

  // Research + generate
  const research = await researchTopic(topic);
  const post = await generateBlogPost(topic, research, strategy);

  // Save post
  await saveBlogPost(post);

  // Update strategy: move topic from pending to used
  const updatedStrategy: MarketingStrategy = {
    ...strategy,
    pendingTopics: strategy.pendingTopics.slice(1),
    usedTopics: [...strategy.usedTopics, topic.title],
    lastUpdated: new Date().toISOString(),
  };
  await saveStrategy(updatedStrategy);

  // Log run
  await db.collection('marketing_runs').add({
    type: 'daily_post',
    slug: post.slug,
    title: post.title,
    topic: topic.title,
    strategyVersion: strategy.version,
    createdAt: new Date().toISOString(),
  });

  return { slug: post.slug, title: post.title };
}
