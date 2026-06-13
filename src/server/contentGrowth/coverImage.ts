/**
 * Deterministic cover images — no AI, no API cost.
 *
 * Generates branded SVG covers from title + cluster. Stored as data URIs
 * on each blog post. For OG/social, the same SVG is embedded inline.
 */

const CANVAS_W = 1200;
const CANVAS_H = 630;
const PAD_X = 52;
const CONTENT_TOP = 132;
const CONTENT_BOTTOM = 548;

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

function wrapTitle(title: string, maxCharsPerLine: number): string[] {
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
  return lines;
}

function layoutTitle(title: string): {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  startY: number;
} {
  // Prefer 2–3 wide lines so the headline fills the banner horizontally.
  const wrapWidths = [34, 30, 26] as const;
  const presets = [
    { maxLines: 1, fontSize: 96, lineHeight: 104 },
    { maxLines: 2, fontSize: 84, lineHeight: 94 },
    { maxLines: 3, fontSize: 72, lineHeight: 82 },
    { maxLines: 4, fontSize: 58, lineHeight: 68 },
  ] as const;

  let best = {
    lines: wrapTitle(title, wrapWidths[0]).slice(0, 1),
    fontSize: presets[0].fontSize,
    lineHeight: presets[0].lineHeight,
    startY: CONTENT_TOP,
  };

  for (const width of wrapWidths) {
    const wrapped = wrapTitle(title, width);
    for (const preset of presets) {
      if (wrapped.length > preset.maxLines) continue;
      const lines = wrapped.slice(0, preset.maxLines);
      const visualHeight = (lines.length - 1) * preset.lineHeight + preset.fontSize;
      const available = CONTENT_BOTTOM - CONTENT_TOP;
      if (visualHeight > available) continue;

      const startY = CONTENT_TOP + (available - visualHeight) / 2 + preset.fontSize * 0.78;
      best = { lines, fontSize: preset.fontSize, lineHeight: preset.lineHeight, startY };
      return best;
    }
  }

  const lines = wrapTitle(title, 24).slice(0, 4);
  const preset = presets[3];
  const visualHeight = (lines.length - 1) * preset.lineHeight + preset.fontSize;
  const available = CONTENT_BOTTOM - CONTENT_TOP;
  const startY = CONTENT_TOP + Math.max(0, (available - visualHeight) / 2) + preset.fontSize * 0.78;
  return { lines, fontSize: preset.fontSize, lineHeight: preset.lineHeight, startY };
}

export function generateCoverSvg(title: string, clusterId: string): string {
  const style = CLUSTER_STYLES[clusterId] ?? CLUSTER_STYLES['remote-job-search'];
  const { lines, fontSize, lineHeight, startY } = layoutTitle(title);
  const maxTextWidth = CANVAS_W - PAD_X * 2;

  const lineElements = lines
    .map(
      (line, i) =>
        `<text x="${PAD_X}" y="${Math.round(startY + i * lineHeight)}" font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${fontSize}" font-weight="700" fill="#f8fafc" letter-spacing="-0.03em">${escapeXml(line)}</text>`
    )
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" role="img" aria-label="${escapeXml(title)}">
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
    <radialGradient id="glow" cx="92%" cy="8%" r="55%">
      <stop offset="0%" stop-color="${style.accent}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${style.accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg)"/>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#glow)"/>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#grid)"/>
  <rect x="0" y="0" width="${CANVAS_W}" height="7" fill="${style.accent}"/>
  <text x="${PAD_X}" y="76" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" font-weight="700" fill="${style.accent}" letter-spacing="5">HIRESCHEMA</text>
  <text x="${PAD_X}" y="112" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="#e2e8f0" letter-spacing="3.5">${escapeXml(style.label.toUpperCase())} GUIDE</text>
  <rect x="${PAD_X}" y="${CONTENT_TOP - 18}" width="${maxTextWidth}" height="${CONTENT_BOTTOM - CONTENT_TOP + 36}" fill="${style.accent}" fill-opacity="0.06" rx="12"/>
    ${lineElements}
  <rect x="${PAD_X}" y="562" width="280" height="6" fill="url(#accent)" rx="3"/>
  <text x="${PAD_X}" y="606" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#94a3b8">hireschema.com/blog</text>
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
