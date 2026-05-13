// @vitest-environment happy-dom
//
// Verifies the modal's close behaviour end-to-end:
//   - X button click invokes the onClose prop.
//   - Backdrop click invokes onClose.
//   - Clicking inside the dialog (motion.div content) does NOT invoke onClose.
//
// Heavy renderers are mocked at the boundary because happy-dom can't paint
// canvas / framer-motion exit animations the way a real browser does — we
// care about prop wiring, not visuals.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Stub ResumeMarkdown so the modal doesn't import the heavy preview module.
vi.mock('../ResumePreviewModal', () => ({
  ResumeMarkdown: ({ text }: { text: string }) => <div data-testid="resume-md">{text}</div>,
}));

// Stub the resume exporter so we don't pull in jsPDF/docx/html2canvas-pro.
vi.mock('../../../lib/resumeExport', () => ({
  exportResumeAsPdf: vi.fn(async () => {}),
  exportResumeAsDocx: vi.fn(async () => {}),
}));

import { AiResultModal } from '../AiResultModal';

afterEach(() => {
  cleanup();
});

describe('AiResultModal close behaviour', () => {
  const baseProps = {
    isOpen: true,
    jobTitle: 'Senior Engineer',
    company: 'Acme',
    location: 'Remote',
    content: '# Test Resume\n\nContact info',
    isLoading: false,
  } as const;

  it('clicking the X button invokes onClose', async () => {
    const onClose = vi.fn();
    render(<AiResultModal type="resume" onClose={onClose} {...baseProps} />);

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop invokes onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <AiResultModal type="resume" onClose={onClose} {...baseProps} />
    );

    // The portaled backdrop is rendered into document.body. Find by its
    // characteristic Tailwind classes (fixed inset-0 …).
    const backdrop = document.querySelector('.fixed.inset-0.z-\\[70\\]') as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
    container; // suppress unused-var
  });

  it('clicking inside the dialog body does NOT invoke onClose', () => {
    const onClose = vi.fn();
    render(<AiResultModal type="resume" onClose={onClose} {...baseProps} />);

    // The resume content area is rendered through the mocked ResumeMarkdown.
    const inner = screen.getByTestId('resume-md');
    fireEvent.click(inner);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when isOpen=false', () => {
    const onClose = vi.fn();
    render(<AiResultModal type="resume" {...baseProps} isOpen={false} onClose={onClose} />);

    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });
});
