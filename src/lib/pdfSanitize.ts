// html2canvas v1 (used by html2pdf.js) cannot parse modern CSS color
// functions like oklch(), oklab(), color(). Tailwind v4 and our CSS
// variables emit oklch everywhere — direct color props, shadows, gradients,
// rings — so any of those will crash the rasterizer with a parse error.
//
// Use as html2canvas onclone hook: it walks the clone, finds any computed
// value that resolves to an unsupported color function, and either pins it
// to a safe hex fallback (for direct color props) or disables it (for
// compound props like shadows/gradients where stripping is safer than
// trying to rewrite). It also injects a stylesheet that neutralises
// unsupported colors on pseudo-elements (::before/::after) which can't be
// patched via inline style.

// Direct color properties — patched to a hex fallback.
const COLOR_PROPS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
  'caret-color',
  'column-rule-color',
] as const;

// Compound properties that can embed colors inside complex values
// (gradients, shadows, masks). Stripped to 'none' when they contain an
// unsupported color — losing visual flourish in the PDF is acceptable;
// crashing the rasterizer is not.
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

function fallback(prop: string): string {
  if (prop === 'background-color') return '#ffffff';
  if (prop === 'color' || prop === 'fill' || prop === 'stroke') return '#1a1a1a';
  return '#dddddd';
}

function injectPseudoElementGuard(doc: Document, root: HTMLElement): void {
  // Pseudo-elements (::before, ::after) can't be patched via inline style.
  // A high-specificity stylesheet inside the clone overrides any oklch
  // pseudo-element colors emitted by Tailwind/CSS variables.
  const style = doc.createElement('style');
  style.setAttribute('data-pdf-sanitize', 'pseudo');
  style.textContent = `
    *::before, *::after {
      background-image: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
  `;
  // Insert into <head> if available, else prepend to the cloned root so the
  // rule still applies inside whatever container html2canvas mounts.
  (doc.head || root).appendChild(style);
}

export function sanitizeUnsupportedColors(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const win = doc?.defaultView;
  if (!win) return;

  injectPseudoElementGuard(doc, root);

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
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
