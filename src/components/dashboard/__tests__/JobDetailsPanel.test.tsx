// @vitest-environment happy-dom
//
// Locks in the two regressions reported by users:
//
//   1. The panel was being rendered inside the React tree (no portal), so
//      `position: fixed inset-0` could miss the viewport when the user had
//      scrolled the dashboard down before clicking a job — visible
//      symptom: the panel only covered the upper portion of the screen and
//      the dashboard's right-side aside leaked through underneath.
//
//   2. Plain `body { overflow: hidden }` scroll lock could cause the page
//      to jump on lock and lose the user's scroll position on unmount. The
//      hardened lock uses `position: fixed; top: -scrollY` and restores
//      the original scroll position when the panel closes.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// JobDetailsPanel pulls a lot of pieces (auth context, AI service, job
// links, lucide icons, framer-motion). Stub the heavy ones so the test
// stays focused on portal + scroll-lock behaviour.
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, profile: null }),
}));
vi.mock('../../../services/aiService', () => ({
  tailorResume: vi.fn(),
}));
vi.mock('../AiResultModal', () => ({
  AiResultModal: () => null,
}));
vi.mock('../../../lib/jobLinks', () => ({
  resolveJobApplicationUrlWithFallback: () => 'https://example.com/apply',
  isJobUrlFallback: () => false,
}));

import { JobDetailsPanel } from '../JobDetailsPanel';

const baseProps = {
  selectedJob: {
    title: 'Senior Engineer',
    company: 'Acme',
    location: 'Remote',
    description: 'Build cool things.',
    matchScore: 87,
  } as any,
  saveJob: vi.fn(async () => true),
  dismissJob: vi.fn(),
  trackJobClick: vi.fn(),
  handleAiAction: vi.fn(),
  aiAction: null,
  aiResult: '',
  actionLoading: false,
  downloadResume: vi.fn(),
  onClose: vi.fn(),
  isSaved: false,
  isSaving: false,
};

afterEach(() => {
  cleanup();
  // Reset body styles between tests in case the scroll-lock cleanup didn't
  // run for some reason — keeps assertions independent.
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.paddingRight = '';
});

describe('JobDetailsPanel — portal + scroll lock', () => {
  it('renders into document.body (portal), not inside the host container', () => {
    const { container } = render(<JobDetailsPanel {...baseProps} />);

    // The host container the test util creates must remain empty — the panel
    // lives in document.body via createPortal.
    expect(container.querySelector('.fixed.inset-0')).toBeNull();

    // The portaled backdrop is in document.body.
    const portaled = document.body.querySelector('.fixed.inset-0.z-50');
    expect(portaled).not.toBeNull();
  });

  it('locks body scroll while mounted', () => {
    render(<JobDetailsPanel {...baseProps} />);
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.width).toBe('100%');
  });

  it('preserves scrollY in the lock and restores it on unmount', () => {
    // Simulate the user having scrolled the dashboard before clicking a job.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 });
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const { unmount } = render(<JobDetailsPanel {...baseProps} />);
    expect(document.body.style.top).toBe('-420px');

    unmount();

    // On close, the body lock is released and the scroll position is restored.
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(scrollToSpy).toHaveBeenCalledWith(0, 420);

    scrollToSpy.mockRestore();
  });
});
