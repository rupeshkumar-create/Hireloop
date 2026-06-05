// html2canvas v1 (used by html2pdf.js) cannot parse modern CSS color
// functions — oklch(), oklab(), color(), color-mix(). Tailwind v4 plus our
// CSS variables emit these everywhere (direct color props, shadows, gradients,
// rings, pseudo-elements, scrollbar colors). Without sanitisation html2canvas
// throws "Attempting to parse an unsupported color function 'oklch'".
//
// Use as the html2canvas `onclone` hook. It works on three fronts:
//
//   1. Element walk — for every element inside the captured subtree, read
//      computed style and pin any color property that resolves to an
//      unsupported function to a safe hex fallback (or strip compound
//      properties like gradients and shadows to `none`).
//   2. Pseudo-element guard — inject a stylesheet that overrides ::before,
//      ::after, ::marker, ::placeholder, ::first-line, ::first-letter to
//      safe colors (TreeWalker can't visit pseudo-elements).
//   3. Stylesheet rewrite — walk every accessible stylesheet in the clone
//      and rewrite raw `oklch(...)`, `oklab(...)`, `color(...)`,
//      `color-mix(...)` tokens to `rgb(...)` equivalents. This catches rules
//      that html2canvas might parse directly even if no element applies them
//      (e.g. scrollbar pseudo-rules, never-matched media-query branches).

// Direct color properties — patched to a hex fallback per element.
const COLOR_PROPS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'text-emphasis-color',
  'fill',
  'stroke',
  'caret-color',
  'column-rule-color',
  'accent-color',
  'flood-color',
  'lighting-color',
  'stop-color',
] as const;

// Compound properties that can embed colors inside complex values (gradients,
// shadows, masks). Stripped to `none` rather than rewritten — keeping layout
// intact at the cost of losing the flourish in the PDF, which is fine.
const COMPOUND_PROPS = [
  'background-image',
  'box-shadow',
  'text-shadow',
  'border-image-source',
  'mask-image',
  '-webkit-mask-image',
  'filter',
] as const;

const UNSUPPORTED = /oklch|oklab|color\(|color-mix/i;
const UNSUPPORTED_GLOBAL = /\b(oklch|oklab|color-mix)\s*\([^)]*\)/gi;
// `color(display-p3 ...)` etc. — distinct from rgb() because the function
// name is `color` and the first arg is a color-space identifier.
const COLOR_FUNCTION_GLOBAL = /\bcolor\(\s*[a-z][a-z0-9-]*\s+[^)]*\)/gi;

function fallback(prop: string): string {
  if (prop === 'background-color' || prop === 'flood-color') return '#ffffff';
  if (prop === 'color' || prop === 'fill' || prop === 'stroke') return '#1a1a1a';
  return '#dddddd';
}

// ─── Stage 1 + 2: pseudo-element + scrollbar guard via injected stylesheet ───

function injectPseudoElementGuard(doc: Document, root: HTMLElement): void {
  const style = doc.createElement('style');
  style.setAttribute('data-pdf-sanitize', 'pseudo');
  style.textContent = `
    *::before, *::after, *::marker, *::placeholder,
    *::first-line, *::first-letter, *::selection {
      color: #1a1a1a !important;
      background-color: transparent !important;
      background-image: none !important;
      border-color: #dddddd !important;
      outline-color: #dddddd !important;
      box-shadow: none !important;
      text-shadow: none !important;
      text-decoration-color: #1a1a1a !important;
    }
    *::-webkit-scrollbar,
    *::-webkit-scrollbar-thumb,
    *::-webkit-scrollbar-track,
    *::-webkit-scrollbar-corner {
      background: transparent !important;
      color: transparent !important;
    }
    * {
      scrollbar-color: auto !important;
    }
  `;
  (doc.head || root).appendChild(style);
}

// ─── Stage 3: stylesheet token rewrite ───────────────────────────────────────

/** Replace every oklch / oklab / color() / color-mix() token in a CSS value
 *  with a flat fallback. Crude but completely safe — html2canvas only needs
 *  parseable values; the resulting visuals are best-effort. */
function rewriteCssTokens(input: string): string {
  if (!UNSUPPORTED.test(input)) return input;
  return input
    .replace(UNSUPPORTED_GLOBAL, 'rgb(136, 136, 136)')
    .replace(COLOR_FUNCTION_GLOBAL, 'rgb(136, 136, 136)');
}

function rewriteStyleSheets(doc: Document): void {
  const sheets = Array.from(doc.styleSheets);
  for (const sheet of sheets) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin stylesheets throw on cssRules access — skip them.
      continue;
    }
    if (!rules) continue;

    rewriteRuleList(sheet, rules);
  }
}

function rewriteRuleList(sheet: CSSStyleSheet | CSSGroupingRule, rules: CSSRuleList): void {
  // Walk in reverse so deleteRule index math stays stable when we replace.
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    // Style rule with a declaration block.
    if (rule instanceof CSSStyleRule) {
      const text = rule.cssText;
      if (UNSUPPORTED.test(text)) {
        const rewritten = rewriteCssTokens(text);
        try {
          // Delete + reinsert is the only portable way to swap a rule.
          if ('deleteRule' in sheet && typeof (sheet as any).deleteRule === 'function') {
            (sheet as any).deleteRule(i);
          }
          if ('insertRule' in sheet && typeof (sheet as any).insertRule === 'function') {
            (sheet as any).insertRule(rewritten, i);
          }
        } catch {
          // Some rules can't be re-inserted (e.g. malformed selectors after
          // rewrite, vendor-prefixed pseudo rules). Best-effort: leave the
          // original in place — the element-walk and pseudo-guard usually
          // make up the difference.
        }
      }
    } else if (
      // Recurse into @media, @supports, @container — their nested rules can
      // hold oklch too.
      typeof CSSGroupingRule !== 'undefined' &&
      rule instanceof CSSGroupingRule
    ) {
      rewriteRuleList(rule, rule.cssRules);
    }
  }
}

// ─── Element walk ────────────────────────────────────────────────────────────

function walkElements(root: HTMLElement, win: Window): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  // Process the root itself first, then traverse descendants.
  let node: Node | null = root;
  while (node) {
    const el = node as HTMLElement;
    const styles = win.getComputedStyle(el);

    for (const prop of COLOR_PROPS) {
      const value = styles.getPropertyValue(prop);
      if (value && UNSUPPORTED.test(value)) {
        el.style.setProperty(prop, fallback(prop), 'important');
      }
    }
    for (const prop of COMPOUND_PROPS) {
      const value = styles.getPropertyValue(prop);
      if (value && UNSUPPORTED.test(value)) {
        el.style.setProperty(prop, 'none', 'important');
      }
    }

    node = walker.nextNode();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function sanitizeUnsupportedColors(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const win = doc?.defaultView;
  if (!win) return;

  // Stage 3 first — stylesheet rewrite happens before getComputedStyle reads
  // so the walked computed values reflect the rewritten cascade.
  try {
    rewriteStyleSheets(doc);
  } catch {
    // Defensive — never block PDF generation on a stylesheet quirk.
  }

  // Stage 2 — pseudo-element + scrollbar guard.
  injectPseudoElementGuard(doc, root);

  // Stage 1 — element walk with safe per-element overrides.
  walkElements(root, win);
}
