import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

/** Sends GA4 page_view events on client-side route changes. */
export function GoogleAnalytics() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackPageView(path);
  }, [location.pathname, location.search]);

  return null;
}
