// @vitest-environment happy-dom
//
// Focused test for the resume exporter. Verifies:
//   - PDF export resolves (doesn't throw) when the source DOM contains
//     oklch colors that previously crashed html2canvas v1.
//   - DOCX export resolves and produces a non-empty blob from markdown input.
//
// Both exports are mocked at the underlying library boundary so we exercise
// the lib's own logic (markdown parsing, page slicing) without a real canvas.

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock html2canvas-pro to return a fake canvas — happy-dom doesn't provide
// a working canvas rasterizer.
vi.mock('html2canvas-pro', () => ({
  default: vi.fn(async () => ({
    width: 800,
    height: 1200,
    toDataURL: () => 'data:image/jpeg;base64,FAKE',
  })),
}));

// Mock jsPDF to capture how the exporter drives it.
const addImageSpy = vi.fn();
const addPageSpy = vi.fn();
const saveSpy = vi.fn();
const setFillColorSpy = vi.fn();
const rectSpy = vi.fn();
vi.mock('jspdf', () => {
  return {
    default: vi.fn(() => ({
      addImage: addImageSpy,
      addPage: addPageSpy,
      save: saveSpy,
      // setFillColor + rect are used by the page-fill helper that paints the
      // entire page white so dark-mode PDF viewers don't render the margins
      // as black.
      setFillColor: setFillColorSpy,
      rect: rectSpy,
      internal: {
        pageSize: {
          getWidth: () => 612,
          getHeight: () => 792,
        },
      },
    })),
  };
});

// Mock file-saver so DOCX export doesn't try to hit a real Blob URL.
const saveAsSpy = vi.fn();
vi.mock('file-saver', () => ({
  saveAs: (...args: any[]) => saveAsSpy(...args),
}));

import { exportResumeAsPdf, exportResumeAsDocx } from '../resumeExport';

afterEach(() => {
  vi.clearAllMocks();
});

describe('exportResumeAsPdf', () => {
  it('does not throw on a DOM containing oklch colors', async () => {
    const el = document.createElement('div');
    el.setAttribute(
      'style',
      'color: oklch(58% 0.18 54); background: oklch(99% 0.005 54); border: 1px solid oklch(92% 0.008 54)'
    );
    el.textContent = 'Resume contents that previously crashed html2canvas';
    document.body.appendChild(el);

    await expect(
      exportResumeAsPdf({ source: el, baseFilename: 'Tailored_Resume_Acme' })
    ).resolves.toBeUndefined();

    expect(addImageSpy).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledWith('Tailored_Resume_Acme.pdf');
  });

  it('paints the page white before placing the image (dark-mode viewer fix)', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    await exportResumeAsPdf({ source: el, baseFilename: 'White_Bg' });

    expect(setFillColorSpy).toHaveBeenCalledWith(255, 255, 255);
    expect(rectSpy).toHaveBeenCalledWith(0, 0, 612, 792, 'F');
  });

  it('paginates when content exceeds one page', async () => {
    // Override the canvas mock to return very tall content.
    const html2canvas = (await import('html2canvas-pro')).default as unknown as ReturnType<typeof vi.fn>;
    html2canvas.mockResolvedValueOnce({
      width: 800,
      height: 5000, // taller than one US-Letter page can hold
      toDataURL: () => 'data:image/jpeg;base64,LONG',
    } as any);

    const el = document.createElement('div');
    document.body.appendChild(el);

    await exportResumeAsPdf({ source: el, baseFilename: 'Tall_Resume' });

    // Multi-page → addPage called at least once.
    expect(addPageSpy).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledWith('Tall_Resume.pdf');
  });
});

describe('exportResumeAsDocx', () => {
  it('saves a .docx file from a structured markdown resume', async () => {
    const markdown = `# Ranjit Kumar

ranjit@example.com | +91 9999999999 | Bangalore, India

## SUMMARY

Experienced engineer building remote tooling.

## EXPERIENCE

### Acme Inc — Senior Engineer
*Jan 2023 – Present*

- Led platform rebuild reducing latency by 40%
- Owned hiring loop for 3 engineering roles

## EDUCATION

### B.S. Computer Science
*MIT | 2019*
`;

    await exportResumeAsDocx({ markdown, baseFilename: 'Tailored_Resume_Acme' });

    expect(saveAsSpy).toHaveBeenCalledTimes(1);
    const [blob, filename] = saveAsSpy.mock.calls[0];
    expect(filename).toBe('Tailored_Resume_Acme.docx');
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).size).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    await expect(
      exportResumeAsDocx({ markdown: '', baseFilename: 'Empty' })
    ).resolves.toBeUndefined();
    expect(saveAsSpy).toHaveBeenCalledTimes(1);
  });
});
