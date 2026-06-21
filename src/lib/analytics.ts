/** Google Analytics 4 (gtag.js) — shared measurement ID and helpers. */

export const GA_MEASUREMENT_ID = 'G-M99635SH9J';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

let loadPromise: Promise<void> | null = null;

/** Non-blocking gtag queue — safe before the external script loads. */
export function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === 'function') return;
  window.gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
}

/** Load gtag.js once; initial config disables auto page_view (SPA sends explicit hits). */
export function loadGoogleAnalytics(measurementId = GA_MEASUREMENT_ID): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  ensureGtagStub();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    window.gtag!('js', new Date());
    window.gtag!('config', measurementId, { send_page_view: false });

    const finish = () => resolve();
    const existing = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`);
    if (existing) {
      finish();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = finish;
    script.onerror = finish;
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Inline head snippet for static/prerender HTML (blog posts, remote-jobs). */
export function gtagHeadSnippet(measurementId = GA_MEASUREMENT_ID): string {
  return `<!-- Google tag (gtag.js) -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', '${measurementId}');
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>`;
}

/** Track SPA or static page views — updates GA4 page_path + page_title. */
export async function trackPageView(path: string, title?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  await loadGoogleAnalytics();

  const pagePath = path || `${window.location.pathname}${window.location.search}`;
  const pageTitle = title || document.title || pagePath;

  window.gtag!('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    send_to: GA_MEASUREMENT_ID,
  });
  window.gtag!('config', GA_MEASUREMENT_ID, {
    page_path: pagePath,
    page_title: pageTitle,
  });
}
