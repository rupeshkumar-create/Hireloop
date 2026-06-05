import { useEffect, useRef } from 'react';

export function usePageAnalytics(slug: string) {
  const startRef = useRef(Date.now());
  const sentRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    sentRef.current = false;

    const sendPageview = () => {
      if (sentRef.current) return;
      sentRef.current = true;
      const timeOnPage = Math.round((Date.now() - startRef.current) / 1000);
      fetch('/api/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, timeOnPage }),
        keepalive: true,
      }).catch(() => {});
    };

    const onUnload = () => sendPageview();
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('beforeunload', onUnload);
      sendPageview();
    };
  }, [slug]);
}

export function trackCtaClick(slug: string) {
  fetch('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, event: 'cta_click' }),
    keepalive: true,
  }).catch(() => {});
}
