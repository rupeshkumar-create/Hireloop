/**
 * Deterministic cover images — no AI, no API cost.
 *
 * Generates branded SVG covers from title + cluster. Stored as data URIs
 * on each blog post. For OG/social, the same SVG is embedded inline.
 */

const CLUSTER_STYLES: Record<string, { bg: string; accent: string; label: string }> = {
  'remote-job-search': { bg: '#141820', accent: '#f97316', label: 'Job Search' },
  'ai-job-matching': { bg: '#0f172a', accent: '#38bdf8', label: 'AI Matching' },
  'resume-optimization': { bg: '#1a1625', accent: '#a78bfa', label: 'Resume' },
  'salary-negotiation': { bg: '#14231a', accent: '#4ade80', label: 'Salary' },
  'interview-prep': { bg: '#1c1917', accent: '#fb923c', label: 'Interview' },
  'remote-companies': { bg: '#0c1222', accent: '#60a5fa', label: 'Companies' },
  'career-growth': { bg: '#18120f', accent: '#f472b6', label: 'Career' },
  'hiring-trends': { bg: '#111827', accent: '#34d399', label: 'Trends' },
  'remote-job-boards': { bg: '#111827', accent: '#34d399', label: 'Trends' },
  'location-role-guides': { bg: '#141820', accent: '#f97316', label: 'Job Search' },
  'skill-remote-jobs': { bg: '#1a1625', accent: '#a78bfa', label: 'Resume' },
  'competitor-alternatives': { bg: '#0f172a', accent: '#38bdf8', label: 'AI Matching' },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapTitle(title: string, maxCharsPerLine = 28): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function titleTypography(lineCount: number): { fontSize: number; lineHeight: number; startY: number } {
  if (lineCount <= 1) return { fontSize: 68, lineHeight: 78, startY: 210 };
  if (lineCount === 2) return { fontSize: 56, lineHeight: 68, startY: 188 };
  if (lineCount === 3) return { fontSize: 48, lineHeight: 58, startY: 172 };
  return { fontSize: 42, lineHeight: 52, startY: 158 };
}

export function generateCoverSvg(title: string, clusterId: string): string {
  const style = CLUSTER_STYLES[clusterId] ?? CLUSTER_STYLES['remote-job-search'];
  const lines = wrapTitle(title);
  const { fontSize, lineHeight, startY } = titleTypography(lines.length);
  const lineElements = lines
    .map(
      (line, i) =>
        `<text x="64" y="${startY + i * lineHeight}" font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${fontSize}" font-weight="650" fill="#f8fafc" letter-spacing="-0.025em">${escapeXml(line)}</text>`
    )
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${style.bg}"/>
      <stop offset="55%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#050505"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${style.accent}"/>
      <stop offset="100%" stop-color="${style.accent}" stop-opacity="0.15"/>
    </linearGradient>
    <radialGradient id="glow" cx="88%" cy="12%" r="50%">
      <stop offset="0%" stop-color="${style.accent}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${style.accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="0" y="0" width="1200" height="6" fill="${style.accent}"/>
  <text x="64" y="82" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" font-weight="700" fill="${style.accent}" letter-spacing="5">HIRESCHEMA</text>
  <text x="64" y="118" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="#cbd5e1" letter-spacing="3">${escapeXml(style.label.toUpperCase())} GUIDE</text>
    ${lineElements}
  <rect x="64" y="552" width="220" height="5" fill="url(#accent)" rx="2"/>
  <text x="64" y="596" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="500" fill="#94a3b8">hireschema.com/blog</text>
</svg>`;
}

export function generateCoverDataUri(title: string, clusterId: string): string {
  const svg = generateCoverSvg(title, clusterId);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildImageAltText(title: string, clusterId: string): string {
  const style = CLUSTER_STYLES[clusterId] ?? CLUSTER_STYLES['remote-job-search'];
  return `${title} — ${style.label} guide on HireSchema`;
}
