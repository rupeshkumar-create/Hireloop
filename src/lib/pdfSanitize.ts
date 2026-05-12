// html2canvas v1 (used by html2pdf.js) cannot parse modern CSS color
// functions like oklch(), oklab(), color(). Tailwind v4 and our CSS
// variables emit oklch, so any element inheriting a color from a CSS
// variable will crash the rasterizer with a parse error.
//
// Use as html2canvas onclone hook: it walks the clone, finds any
// computed color that resolves to an unsupported function, and pins
// it to a safe hex fallback via inline style. Elements with explicit
// hex/rgb inline styles are unaffected.

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

const UNSUPPORTED = /oklch|oklab|color\(/i;

function fallback(prop: string): string {
  if (prop === 'background-color') return '#ffffff';
  if (prop === 'color' || prop === 'fill' || prop === 'stroke') return '#1a1a1a';
  return '#dddddd';
}

export function sanitizeUnsupportedColors(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const win = doc?.defaultView;
  if (!win) return;

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
    node = walker.nextNode();
  }
}
