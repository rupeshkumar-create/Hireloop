/** Normalize blog markdown for display — fixes legacy AI output and strips duplicate sections. */

const STRUCTURED_SECTION_HEADINGS = [
  'Key Definitions',
  'Salary Benchmarks',
  'Hiring Trends',
  'Comparison',
  'Practical Playbook Notes',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove leading H1 or plain-text title duplicated from post.title */
export function stripDuplicateTitle(content: string, title: string): string {
  let body = content.trim();
  const titlePattern = escapeRegex(title.trim());

  body = body.replace(new RegExp(`^#\\s+${titlePattern}\\s*\\n+`, 'i'), '');
  body = body.replace(new RegExp(`^${titlePattern}\\s*\\n+`, 'i'), '');

  return body.trim();
}

/** Same-line label + value (Cost:, Best for:, Pros:, etc.) — not section headings. */
const LABEL_LINE =
  /^[A-Za-z][A-Za-z0-9\s/&'()-]{0,32}:\s+\S/;

/** Listicle entry titles like "6. Scale.jobs — Best Built-In Application Tools". */
function isListicleEntryLine(trimmed: string): boolean {
  if (!/^\d+\.\s+/.test(trimmed)) return false;
  return /[—–]/.test(trimmed) || trimmed.length >= 35;
}

/** Bold the label portion of "Label: value" when not already formatted. */
export function normalizeLabelLine(line: string): string {
  const trimmed = line.trim();
  if (!LABEL_LINE.test(trimmed) || /^\*\*[^*]+:\*\*/.test(trimmed)) return line;
  return trimmed.replace(/^([^:\n]+):/, '**$1:**');
}

/** Turn plain-text section lines into ## headings when they read like titles. */
export function inferMarkdownHeadings(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      out.push(line);
      continue;
    }

    if (/^[-*+]\s|^>|^\|/.test(trimmed)) {
      out.push(line);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      out.push(isListicleEntryLine(trimmed) ? `### ${trimmed}` : line);
      continue;
    }

    if (LABEL_LINE.test(trimmed)) {
      out.push(normalizeLabelLine(trimmed));
      continue;
    }

    if (/^\*\*Q:\*\*/i.test(trimmed)) {
      out.push(line);
      continue;
    }

    const nextContent = lines.slice(i + 1).find((l) => l.trim());
    const next = nextContent?.trim() ?? '';

    const looksLikeHeading =
      trimmed.length <= 100 &&
      !trimmed.includes(':') &&
      !trimmed.endsWith('.') &&
      !trimmed.endsWith('?') &&
      (next.length > 55 || /^[-*+]\s/.test(next));

    if (looksLikeHeading) {
      out.push(`## ${trimmed}`);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

function stripMarkdownSection(content: string, heading: string): string {
  const h = escapeRegex(heading);
  const pattern = new RegExp(
    `(^|\\n)#{1,3}\\s+${h}[^\\n]*\\n[\\s\\S]*?(?=\\n#{1,3}\\s+|\\n###\\s+FAQ|$)`,
    'gi'
  );
  return content.replace(pattern, '\n').trim();
}

/** Remove FAQ block from markdown when rendered as structured FAQ below the article. */
export function stripFaqSection(content: string): string {
  return content
    .replace(/\n#{1,3}\s+FAQ[^\n]*\n[\s\S]*$/i, '')
    .replace(/\n#{1,3}\s+Frequently Asked Questions[^\n]*\n[\s\S]*$/i, '')
    .trim();
}

export interface PrepareBlogBodyOptions {
  title: string;
  stripStructuredSections?: boolean;
  stripFaq?: boolean;
}

/** Demote legacy ## headings that are really label lines or listicle entries. */
export function repairMisclassifiedHeadings(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const h2 = trimmed.match(/^##\s+(.+)$/);
      if (!h2) return line;
      const inner = h2[1].trim();
      if (LABEL_LINE.test(inner)) return normalizeLabelLine(inner);
      if (/^\d+\.\s+/.test(inner) && isListicleEntryLine(inner)) return `### ${inner}`;
      return line;
    })
    .join('\n');
}

/** Full pipeline for article body markdown shown in the reader. */
export function prepareBlogBodyContent(content: string, options: PrepareBlogBodyOptions): string {
  let body = stripDuplicateTitle(content, options.title);
  body = repairMisclassifiedHeadings(body);
  body = inferMarkdownHeadings(body);

  if (options.stripStructuredSections) {
    for (const heading of STRUCTURED_SECTION_HEADINGS) {
      body = stripMarkdownSection(body, heading);
    }
  }

  if (options.stripFaq) {
    body = stripFaqSection(body);
  }

  return body.replace(/\n{3,}/g, '\n\n').trim();
}

export interface ReformatPostInput {
  slug: string;
  title: string;
  content: string;
  directAnswer?: string;
  excerpt?: string;
  faq?: { question: string; answer: string }[];
  definitions?: unknown[];
  salaryBenchmarks?: unknown[];
  hiringTrends?: unknown[];
}

export interface ReformatPostOutput {
  content: string;
  excerpt: string;
  faq: { question: string; answer: string }[];
  readTimeMinutes: number;
  refreshedAt: string;
  updatedAt: string;
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round(countWords(content) / 200));
}

function buildExcerpt(title: string, directAnswer: string | undefined, content: string, existing?: string): string {
  if (directAnswer?.trim()) {
    const t = directAnswer.trim();
    return t.length > 200 ? `${t.slice(0, 200)}…` : t;
  }
  if (existing?.trim()) return existing;
  const plain = content.replace(/#{1,6}\s+[^\n]+\n?/g, '').replace(/\*\*/g, '').trim();
  return plain.length > 200 ? `${plain.slice(0, 200)}…` : plain || title;
}

/** Normalize stored markdown for Firestore (headings, dedupe, FAQ). */
export function reformatBlogPostContent(post: ReformatPostInput): ReformatPostOutput {
  const hasStructured =
    Boolean(post.definitions?.length) ||
    Boolean(post.salaryBenchmarks?.length) ||
    Boolean(post.hiringTrends?.length);

  const faq =
    post.faq && post.faq.length >= 3
      ? post.faq
      : extractFaqFromPlainContent(post.content);

  const content = prepareBlogBodyContent(post.content, {
    title: post.title,
    stripStructuredSections: hasStructured,
    stripFaq: faq.length > 0,
  });

  const now = new Date().toISOString();

  return {
    content,
    faq,
    excerpt: buildExcerpt(post.title, post.directAnswer, content, post.excerpt),
    readTimeMinutes: estimateReadTime(content),
    refreshedAt: now,
    updatedAt: now,
  };
}

function extractFaqFromPlainContent(content: string): { question: string; answer: string }[] {
  const faqMatch = content.match(/###\s+FAQ[\s\S]*/i);
  const faqSection = faqMatch ? faqMatch[0] : '';
  const faqItems: { question: string; answer: string }[] = [];
  const faqRegex = /\*\*Q:\*\*\s*(.+?)\n\*\*A:\*\*\s*(.+?)(?=\n\*\*Q:|$)/gs;
  let match;
  while ((match = faqRegex.exec(faqSection)) !== null) {
    faqItems.push({ question: match[1].trim(), answer: match[2].trim() });
  }
  return faqItems;
}
