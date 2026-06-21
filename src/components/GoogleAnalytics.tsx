import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { loadGoogleAnalytics, trackPageView } from '../lib/analytics';

/** Sends GA4 page_view on every client-side route (including the first). */
export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    void loadGoogleAnalytics();
  }, []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    // Defer one frame so SeoHead can update document.title first.
    const frame = requestAnimationFrame(() => {
      void trackPageView(path, document.title);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  return null;
}
