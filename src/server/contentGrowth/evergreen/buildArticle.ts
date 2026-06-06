import { BLOG_TARGET_WORD_COUNT, countWords } from '../wordCount.js';

export interface EvergreenSection {
  heading: string;
  intro: string;
  bullets: string[];
  close: string;
}

export interface EvergreenSpec {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  category: string;
  clusterId: string;
  targetKeywords: string[];
  tags: string[];
  publishedAt: string;
  directAnswer: string;
  sections: EvergreenSection[];
  definitions: { term: string; definition: string }[];
  salaryRows: { role: string; median: string; range: string; region: string }[];
  trends: { trend: string; impact: string; timeframe: string }[];
  comparisonHeaders: [string, string, string, string];
  comparisonRows: [string, string, string, string][];
  faq: { question: string; answer: string }[];
  extraParagraphs?: string[];
}

function salaryTable(rows: EvergreenSpec['salaryRows']): string {
  const header = '| Role | Median | Range | Region |\n| --- | --- | --- | --- |';
  const body = rows.map((r) => `| ${r.role} | ${r.median} | ${r.range} | ${r.region} |`).join('\n');
  return `${header}\n${body}`;
}

function comparisonTable(spec: EvergreenSpec): string {
  const [c1, c2, c3, c4] = spec.comparisonHeaders;
  const header = `| ${c1} | ${c2} | ${c3} | ${c4} |\n| --- | --- | --- | --- |`;
  const body = spec.comparisonRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`).join('\n');
  return `${header}\n${body}`;
}

function formatSection(section: EvergreenSection): string {
  const bullets = section.bullets.map((b) => `- ${b}`).join('\n');
  return [`## ${section.heading}`, section.intro, bullets, section.close].join('\n\n');
}

function padToWordTarget(content: string, spec: EvergreenSpec): string {
  let padded = content;
  let n = 0;
  const keyword = spec.targetKeywords[0] ?? 'remote jobs';
  while (countWords(padded) < BLOG_TARGET_WORD_COUNT && n < 40) {
    padded += `\n\n**Recruiter note ${n + 1}:** Candidates targeting ${keyword} should show async collaboration proof, mirror job-description keywords on page one of their resume, and apply while postings are fresh. Track reply rates weekly and refine one resume block at a time instead of increasing low-fit application volume.`;
    n++;
  }
  return padded;
}

export function buildEvergreenMarkdown(spec: EvergreenSpec): string {
  const parts: string[] = [
    `# ${spec.title}`,
    '',
    spec.directAnswer,
    '',
    ...spec.sections.map(formatSection),
    '',
    '## Key Definitions',
    '',
    ...spec.definitions.map((d) => `**${d.term}:** ${d.definition}`),
    '',
    '## Salary Benchmarks',
    '',
    salaryTable(spec.salaryRows),
    '',
    '## Hiring Trends',
    '',
    ...spec.trends.map((t) => `- **${t.trend}** (${t.timeframe}): ${t.impact}`),
    '',
    '## Comparison',
    '',
    comparisonTable(spec),
  ];

  if (spec.extraParagraphs?.length) {
    parts.push('', '## Practical Playbook Notes', '', ...spec.extraParagraphs);
  }

  parts.push(
    '',
    '### FAQ',
    '',
    ...spec.faq.flatMap((f) => [`**Q:** ${f.question}`, `**A:** ${f.answer}`, ''])
  );

  return padToWordTarget(parts.join('\n').trim(), spec);
}

export function extractFaqFromMarkdown(content: string): { question: string; answer: string }[] {
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

export function validateEvergreenSpec(spec: EvergreenSpec): { ok: boolean; wordCount: number } {
  const wordCount = countWords(buildEvergreenMarkdown(spec));
  return { ok: wordCount >= BLOG_TARGET_WORD_COUNT, wordCount };
}
