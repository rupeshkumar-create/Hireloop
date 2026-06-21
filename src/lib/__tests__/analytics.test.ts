import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('analytics', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('document', {
      title: 'Test Page',
      head: {
        appendChild: vi.fn((el: { onload?: (() => void) | null }) => {
          el.onload?.();
        }),
      },
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => ({ async: false, src: '', onload: null as (() => void) | null, onerror: null as (() => void) | null })),
    });
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '' },
      dataLayer: [] as unknown[],
      gtag: undefined as ((...args: unknown[]) => void) | undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gtagHeadSnippet includes measurement id for static pages', async () => {
    const { gtagHeadSnippet, GA_MEASUREMENT_ID } = await import('../analytics');
    expect(gtagHeadSnippet()).toContain(GA_MEASUREMENT_ID);
    expect(gtagHeadSnippet()).toContain('googletagmanager.com/gtag/js');
  });

  it('ensureGtagStub creates a queue function', async () => {
    const { ensureGtagStub, GA_MEASUREMENT_ID } = await import('../analytics');
    ensureGtagStub();
    expect(typeof window.gtag).toBe('function');
    window.gtag!('config', GA_MEASUREMENT_ID);
    expect(window.dataLayer!.length).toBeGreaterThan(0);
  });

  it('trackPageView queues page_path and page_title', async () => {
    const { trackPageView, GA_MEASUREMENT_ID } = await import('../analytics');
    const calls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => {
      calls.push(args);
    };
    await trackPageView('/dashboard', 'Dashboard — HireSchema');
    expect(calls.some((c) => c[0] === 'event' && c[1] === 'page_view')).toBe(true);
    expect(
      calls.some(
        (c) =>
          c[0] === 'config' &&
          c[1] === GA_MEASUREMENT_ID &&
          (c[2] as { page_path?: string })?.page_path === '/dashboard'
      )
    ).toBe(true);
  });

  it('loadGoogleAnalytics disables automatic first page_view', async () => {
    const { loadGoogleAnalytics, GA_MEASUREMENT_ID } = await import('../analytics');
    const calls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => {
      calls.push(args);
    };
    await loadGoogleAnalytics();
    expect(
      calls.some(
        (c) =>
          c[0] === 'config' &&
          c[1] === GA_MEASUREMENT_ID &&
          (c[2] as { send_page_view?: boolean })?.send_page_view === false
      )
    ).toBe(true);
  });
});
