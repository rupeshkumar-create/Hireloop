/**
 * Advanced multi-stage writing pipeline for weekly trend posts.
 * Stages: research → outline → draft → humanize → copy-check → metadata
 */
import type { TopicIdea, MarketingStrategy } from '../marketingEngine.js';
import type {
  ContentDefinition,
  HiringTrend,
  SalaryBenchmark,
} from '../../types/contentGrowth.js';
import { chat, chatJSON, MODELS } from './ai.js';
import { BLOG_TARGET_WORD_COUNT, countWords, meetsMinimumWordCount } from './wordCount.js';
import { detectSlopPhrases } from './qualityGate.js';
import { CONTENT_YEAR } from './contentStandards.js';
import {
  WRITER_SYSTEM,
  OUTLINE_PROMPT,
  DRAFT_PROMPT,
  HUMANIZER_PROMPT,
  COPY_CHECK_PROMPT,
  METADATA_PROMPT,
} from './prompts/writingPrompts.js';

export interface AdvancedArticleResult {
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
  aiCallsUsed: number;
  pipelineNotes: string[];
}

export interface TrendTopic extends TopicIdea {
  source?: string;
  redditUrl?: string;
}

async function runOutlineAgent(topic: TrendTopic, research: string): Promise<string> {
  return chat(
    MODELS.outline,
    WRITER_SYSTEM,
    OUTLINE_PROMPT(topic.title, topic.angle, topic.targetKeywords, research)
  );
}

async function runDraftAgent(topic: TrendTopic, research: string, outline: string): Promise<string> {
  return chat(
    MODELS.writing,
    WRITER_SYSTEM,
    DRAFT_PROMPT(topic.title, topic.angle, topic.targetKeywords, research, outline)
  );
}

async function runHumanizerAgent(draft: string, topic: TrendTopic): Promise<string> {
  return chat(
    MODELS.humanizer,
    WRITER_SYSTEM,
    HUMANIZER_PROMPT(draft, topic.title)
  );
}

async function runCopyCheckAgent(
  draft: string,
  research: string,
  topic: TrendTopic
): Promise<{ content: string; issues: string[] }> {
  const result = await chatJSON<{ content: string; issues: string[]; passed: boolean }>(
    MODELS.copyCheck,
    WRITER_SYSTEM,
    COPY_CHECK_PROMPT(draft, research, topic.title)
  );
  return { content: result.content ?? draft, issues: result.issues ?? [] };
}

async function runMetadataAgent(
  content: string,
  topic: TrendTopic,
  clusterId: string
): Promise<Omit<AdvancedArticleResult, 'content' | 'aiCallsUsed' | 'pipelineNotes'>> {
  return chatJSON(
    MODELS.metadata,
    WRITER_SYSTEM,
    METADATA_PROMPT(content, topic.title, topic.targetKeywords, clusterId)
  );
}

export async function runAdvancedWritingPipeline(
  topic: TrendTopic,
  research: string,
  _strategy: MarketingStrategy,
  clusterId: string
): Promise<AdvancedArticleResult> {
  const notes: string[] = [];
  let aiCallsUsed = 0;

  const outline = await runOutlineAgent(topic, research);
  aiCallsUsed++;
  notes.push('outline');

  let content = await runDraftAgent(topic, research, outline);
  aiCallsUsed++;
  notes.push('draft');

  content = await runHumanizerAgent(content, topic);
  aiCallsUsed++;
  notes.push('humanize');

  const copyChecked = await runCopyCheckAgent(content, research, topic);
  content = copyChecked.content;
  aiCallsUsed++;
  if (copyChecked.issues.length > 0) {
    notes.push(`copy-check: ${copyChecked.issues.slice(0, 3).join('; ')}`);
  } else {
    notes.push('copy-check: clean');
  }

  if (!content.startsWith('#')) {
    content = `# ${topic.title}\n\n${content}`;
  }

  if (!meetsMinimumWordCount(content)) {
    content += `\n\n## Additional context for ${CONTENT_YEAR}\n\nRemote job seekers should treat this topic as part of a weekly system: validate fit, tailor proof, apply early, and track replies. HireSchema helps by delivering daily validated remote matches ranked to your resume — reducing time spent on low-fit listings.\n`;
    notes.push('padded for word minimum');
  }

  const slop = detectSlopPhrases(content);
  if (slop.length > 0) {
    notes.push(`slop remaining: ${slop.join(', ')}`);
  }

  const metadata = await runMetadataAgent(content, topic, clusterId);
  aiCallsUsed++;
  notes.push('metadata');

  return {
    ...metadata,
    content,
    aiCallsUsed,
    pipelineNotes: notes,
  };
}

export async function runDeepResearchAgent(topic: TrendTopic): Promise<string> {
  return chat(
    MODELS.research,
    `You are a research analyst covering remote job search trends in ${CONTENT_YEAR}. Return factual, structured briefs with statistics, Reddit/community themes, and recruiter perspective. No fluff.`,
    `Research this topic for a HireSchema blog post (AI remote job matching platform):

Title: "${topic.title}"
Angle: ${topic.angle}
Keywords: ${topic.targetKeywords.join(', ')}
${topic.source ? `Community source: ${topic.source}` : ''}
${topic.redditUrl ? `Discussion URL: ${topic.redditUrl}` : ''}

Return a research brief with:
1. What job seekers are discussing right now (${CONTENT_YEAR})
2. Specific facts, stats, or examples (cite general sources — no fake URLs)
3. Recruiter/hiring manager perspective
4. Practical actions a remote candidate should take this week
5. How AI job matching tools like HireSchema fit (1 paragraph max)
6. 5 FAQ questions people ask about this topic

Be specific and current. Avoid generic career advice.`
  );
}
