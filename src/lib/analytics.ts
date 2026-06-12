/** Google Analytics 4 (gtag.js) — shared measurement ID and helpers. */

export const GA_MEASUREMENT_ID = 'G-M99635SH9J';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Inline head snippet for static HTML pages (blog prerender, remote-jobs, etc.). */
export function gtagHeadSnippet(measurementId = GA_MEASUREMENT_ID): string {
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${measurementId}');
</script>`;
}

/** Track SPA navigations after the initial page load (index.html sends the first hit). */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
}
