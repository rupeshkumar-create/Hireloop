/**
 * Pre-publish quality gate — zero extra AI calls.
 * Scores SEO + LLM retrieval readiness and flags AI-slop phrases.
 */

import type { BlogPost } from '../marketingEngine.js';
import { BLOG_TARGET_WORD_COUNT, countWords } from './wordCount.js';

const SLOP_PHRASES = [
  'in today\'s fast-paced',
  'in today\'s world',
  'game-changer',
  'game changer',
  'leverage the power',
  'leverage ai',
  'dive deep',
  'dive into',
  'at the end of the day',
  'it\'s no secret',
  'look no further',
  'without further ado',
  'in conclusion',
  'revolutionize',
  'cutting-edge solution',
  'seamlessly',
  'robust solution',
  'holistic approach',
];

export interface LlmOptimizationScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  checks: { name: string; passed: boolean; weight: number; detail?: string }[];
  slopPhrasesFound: string[];
  recommendations: string[];
}

export interface QualityGateResult {
  passed: boolean;
  seoScore: number;
  llmScore: LlmOptimizationScore;
  blockers: string[];
}

function gradeFromScore(score: number): LlmOptimizationScore['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function detectSlopPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return SLOP_PHRASES.filter((p) => lower.includes(p));
}

export function scoreLlmOptimization(post: Partial<BlogPost>): LlmOptimizationScore {
  const content = post.content ?? '';
  const checks: LlmOptimizationScore['checks'] = [];
  let earned = 0;
  let total = 0;

  const add = (name: string, passed: boolean, weight: number, detail?: string) => {
    checks.push({ name, passed, weight, detail });
    total += weight;
    if (passed) earned += weight;
  };

  add('Direct answer present', Boolean(post.directAnswer && post.directAnswer.length > 40), 15);
  add('FAQ section (3+ items)', (post.faq?.length ?? 0) >= 3, 15, `${post.faq?.length ?? 0} FAQs`);
  add('Definitions block', (post.definitions?.length ?? 0) >= 2, 10, `${post.definitions?.length ?? 0} terms`);
  add('Salary benchmarks', (post.salaryBenchmarks?.length ?? 0) >= 2, 10);
  add('Hiring trends', (post.hiringTrends?.length ?? 0) >= 2, 8);
  add('Entity tags (5+)', (post.entityTags?.length ?? 0) >= 5, 10, `${post.entityTags?.length ?? 0} entities`);
  add('Target keywords set', (post.targetKeywords?.length ?? 0) >= 2, 8);
  add('H2 sections (3+)', (content.match(/^## /gm) ?? []).length >= 3, 10);
  add('Word count (2000+)', countWords(content) >= BLOG_TARGET_WORD_COUNT, 10, `${countWords(content)} words`);
  add('Internal links (2+)', (post.internalLinks?.length ?? 0) >= 2, 8);
  add('Schema markup', Boolean(post.schema?.article), 6);

  const slopPhrasesFound = detectSlopPhrases(content);
  add('No AI slop phrases', slopPhrasesFound.length === 0, 10, slopPhrasesFound.join(', ') || 'clean');

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  const recommendations: string[] = [];

  for (const c of checks.filter((x) => !x.passed)) {
    recommendations.push(`Fix: ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
  }
  if (slopPhrasesFound.length > 0) {
    recommendations.push(`Remove slop phrases: ${slopPhrasesFound.join(', ')}`);
  }

  return {
    score,
    grade: gradeFromScore(score),
    checks,
    slopPhrasesFound,
    recommendations,
  };
}

export function runQualityGate(post: Partial<BlogPost>, seoValidation: {
  passed: boolean;
  score: number;
  issues: string[];
}): QualityGateResult {
  const llmScore = scoreLlmOptimization(post);
  const blockers: string[] = [];

  if (!seoValidation.passed) blockers.push(...seoValidation.issues);
  if (llmScore.slopPhrasesFound.length > 2) {
    blockers.push(`Too many AI slop phrases (${llmScore.slopPhrasesFound.length})`);
  }
  if ((post.faq?.length ?? 0) < 3) blockers.push('FAQ section needs at least 3 items');
  if (!post.directAnswer) blockers.push('Missing direct answer block');
  const wordCount = countWords(post.content ?? '');
  if (wordCount < BLOG_TARGET_WORD_COUNT) {
    blockers.push(`Content too short (${wordCount} words, minimum ${BLOG_TARGET_WORD_COUNT})`);
  }

  return {
    passed: blockers.length === 0,
    seoScore: seoValidation.score,
    llmScore,
    blockers,
  };
}

/** Auto-fix SEO fields without an extra AI call */
export function autoFixSeoFields(post: Partial<BlogPost>): Partial<BlogPost> {
  const fixed = { ...post };
  const title = post.title ?? '';
  const directAnswer = post.directAnswer ?? post.excerpt ?? '';

  if (!fixed.seoTitle || fixed.seoTitle.length < 30) {
    const kw = post.targetKeywords?.[0] ?? 'remote jobs';
    fixed.seoTitle = `${title.slice(0, 45)} | ${kw}`.slice(0, 60);
  }
  if (!fixed.seoDescription || fixed.seoDescription.length < 100) {
    fixed.seoDescription = `${directAnswer.slice(0, 140)}… Start with HireSchema.`.slice(0, 160);
  }
  if (!fixed.excerpt) {
    fixed.excerpt = directAnswer.slice(0, 200) + '…';
  }
  return fixed;
}
