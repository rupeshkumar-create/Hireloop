/**
 * Centralized writing prompts — tone, structure, anti-slop rules.
 */
import { BLOG_TARGET_WORD_COUNT } from '../wordCount.js';
import { CONTENT_YEAR } from '../contentStandards.js';

export const WRITER_SYSTEM = `You are a senior career journalist for HireSchema — an AI-powered remote job matching platform.

Voice and tone:
- Write like a sharp human editor, not an AI content farm.
- Use "you" — speak to job seekers directly.
- Short paragraphs (2–4 sentences). One idea each.
- Specific > vague. Name tools, roles, timeframes.
- Confident but not hypey. No exclamation spam.

Banned phrases (never use):
"In today's fast-paced world", "game-changer", "leverage", "delve", "robust", "seamless",
"holistic", "without further ado", "look no further", "revolutionize", "cutting-edge",
"it's no secret", "navigate the landscape", "at the end of the day".

Structure rules:
- Open with a direct answer (2–3 sentences) before any heading.
- Use ## and ### for all section headings.
- Include bullet lists for steps and checklists.
- End with ### FAQ using **Q:** and **A:** pairs (5 minimum).
- Mention HireSchema naturally 1–2 times where it helps the reader.
- All trend references must say ${CONTENT_YEAR}, not 2025.
- Minimum ${BLOG_TARGET_WORD_COUNT} words in full articles.`;

export function OUTLINE_PROMPT(
  title: string,
  angle: string,
  keywords: string[],
  research: string
): string {
  return `Create a detailed outline for this blog post.

Title: ${title}
Angle: ${angle}
Keywords: ${keywords.join(', ')}

Research:
${research.slice(0, 8000)}

Return markdown outline only:
- H2 sections (6–8)
- 3–5 bullet points under each H2
- FAQ question list (5)
- Note where salary table and comparison table fit
- Direct answer paragraph (draft text)`;
}

export function DRAFT_PROMPT(
  title: string,
  angle: string,
  keywords: string[],
  research: string,
  outline: string
): string {
  return `Write the full markdown article from this outline.

Title: ${title}
Angle: ${angle}
Keywords: ${keywords.join(', ')}

Research:
${research.slice(0, 8000)}

Outline:
${outline}

Include:
- # title
- Direct answer paragraph (no heading)
- ## sections from outline with bullets
- ## Key Definitions (3–5 terms)
- ## Salary Benchmarks (markdown table)
- ## Hiring Trends (${CONTENT_YEAR})
- ## Comparison (markdown table, 4+ rows)
- ### FAQ with **Q:** / **A:** pairs

Return markdown only — no JSON, no preamble.`;
}

export function HUMANIZER_PROMPT(draft: string, title: string): string {
  return `Edit this article to sound more human and less AI-generated.

Title: ${title}

Rules:
- Keep all facts, structure, tables, and FAQ.
- Vary sentence length. Remove repetitive transitions.
- Replace banned AI phrases with plain language.
- Add one concrete example or micro-story where natural.
- Keep ${CONTENT_YEAR} dates consistent.
- Do NOT shorten below ${BLOG_TARGET_WORD_COUNT} words.

Article:
${draft.slice(0, 14000)}

Return the full edited markdown only.`;
}

export function COPY_CHECK_PROMPT(draft: string, research: string, title: string): string {
  return `Fact-check and polish this article against the research brief.

Title: ${title}

Research brief:
${research.slice(0, 6000)}

Article:
${draft.slice(0, 12000)}

Tasks:
1. Remove or fix claims not supported by research.
2. Fix any 2025 references → ${CONTENT_YEAR}.
3. Remove remaining AI slop phrases.
4. Ensure FAQ answers are specific.

Return JSON:
{
  "content": "full corrected markdown",
  "issues": ["list of fixes made"],
  "passed": true
}`;
}

export function METADATA_PROMPT(
  content: string,
  title: string,
  keywords: string[],
  clusterId: string
): string {
  return `Extract SEO/GEO metadata from this article.

Title: ${title}
Keywords: ${keywords.join(', ')}
Cluster: ${clusterId}

Content:
${content.slice(0, 6000)}

Return JSON:
{
  "title": "string",
  "directAnswer": "2-3 sentences",
  "definitions": [{"term":"string","definition":"string"}],
  "salaryBenchmarks": [{"role":"string","median":"string","range":"string","region":"string","source":"Industry surveys ${CONTENT_YEAR}"}],
  "hiringTrends": [{"trend":"string","impact":"string","timeframe":"${CONTENT_YEAR}"}],
  "comparisonTableMarkdown": "markdown table only",
  "entityTags": ["string"],
  "seoTitle": "50-60 chars",
  "seoDescription": "140-160 chars",
  "tags": ["string"],
  "category": "Trend Watch|Job Search|Remote Work|AI Tools|Resume|Career Growth|Salary|Interview Prep|Hiring Trends"
}`;
}
