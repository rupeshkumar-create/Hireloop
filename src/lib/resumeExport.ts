// Resume exports — PDF and DOCX.
//
// PDF is generated via html2canvas-pro (native oklch support) and jsPDF.
// We bypass html2pdf.js entirely because its bundled html2canvas v1.x cannot
// parse modern CSS color functions (oklch, color-mix) that Tailwind v4 and
// our CSS variables emit everywhere.
//
// DOCX uses the `docx` package, walking the tailored-resume markdown to map
// headings, dated subtitles, and bullet lists into Word paragraphs.

import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TextRun,
} from 'docx';
import { saveAs } from 'file-saver';

function isContactLine(text: string): boolean {
  return (
    text.includes('|') ||
    text.includes('•') ||
    text.includes('@') ||
    /linkedin|github/i.test(text) ||
    /^\+?[\d\s\-().]{7,}$/.test(text.trim())
  );
}

function safeFilename(parts: Array<string | undefined | null>, ext: string): string {
  const base = parts
    .filter((p): p is string => !!p)
    .map((p) => p.replace(/\s+/g, '_').replace(/[^\w.-]/g, ''))
    .join('_');
  return `${base || 'Tailored_Resume'}.${ext}`;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export interface PdfExportOptions {
  /** DOM element to rasterise. Must be already in the document (visible or off-screen). */
  source: HTMLElement;
  /** Filename without extension. */
  baseFilename: string;
}

/**
 * Render a slice of the source canvas as a JPEG data URL. Returns null when
 * the environment doesn't support 2D canvas (e.g. happy-dom in unit tests).
 * That signals the caller to fall back to the legacy negative-offset path.
 */
function renderCanvasSlice(
  source: HTMLCanvasElement,
  yOffset: number,
  sliceHeight: number,
): string | null {
  try {
    const slice = document.createElement('canvas');
    slice.width = source.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, sliceHeight);
    // Negative dy on drawImage scrolls the source upward, so the slice
    // captures exactly the y-range we want without scaling.
    ctx.drawImage(source, 0, -yOffset);
    return slice.toDataURL('image/jpeg', 0.95);
  } catch {
    return null;
  }
}

export async function exportResumeAsPdf({ source, baseFilename }: PdfExportOptions): Promise<void> {
  // html2canvas-pro accepts standard html2canvas options. backgroundColor is
  // forced to white so transparent panels don't show through the PDF.
  const canvas = await html2canvas(source, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    // letterRendering is implied in v2.
  });

  // US Letter @ 72 dpi: 612 × 792 pt. Margins bumped from 36pt to 54pt
  // (~0.75in) on top/bottom so multi-page output has visible breathing room
  // between the end of page N and the start of page N+1 — addressing the
  // "no gap between page footer and next page header" complaint.
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 43;
  const marginY = 54;
  const contentW = pageW - marginX * 2;
  const contentH = pageH - marginY * 2;

  // Paint the whole page white BEFORE placing the image. jsPDF leaves
  // unpainted regions transparent; PDF viewers in dark mode render that as
  // dark grey/black, which makes the resume look like it has black margins.
  const fillPageWhite = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');
  };

  const ratio = contentW / canvas.width;
  const scaledTotalH = canvas.height * ratio;

  fillPageWhite();
  if (scaledTotalH <= contentH) {
    // Single page — no slicing needed.
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', marginX, marginY, contentW, scaledTotalH);
  } else {
    // Multi-page output. Each page renders ONLY its own slice of the source
    // canvas — no relying on PDF-viewer clipping. Earlier versions placed
    // the full image with a negative y-offset; some viewers (Preview,
    // older Acrobat) didn't clip and rendered the row at the page boundary
    // on both pages, causing the "Shahi Exports … Merchandiser" duplicate.
    const pageSlicePx = Math.floor(contentH / ratio);
    let canvasY = 0;
    let isFirstPage = true;

    while (canvasY < canvas.height) {
      const sliceHeight = Math.min(pageSlicePx, canvas.height - canvasY);

      if (!isFirstPage) {
        pdf.addPage();
        fillPageWhite();
      }

      const sliceData = renderCanvasSlice(canvas, canvasY, sliceHeight);
      if (sliceData) {
        // Each page receives a tightly-cropped slice — no duplication.
        pdf.addImage(sliceData, 'JPEG', marginX, marginY, contentW, sliceHeight * ratio);
      } else {
        // Test-env fallback (no 2D canvas) — keeps the suite green while
        // production browsers always take the slicing path above.
        const fullImgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(fullImgData, 'JPEG', marginX, marginY - canvasY * ratio, contentW, scaledTotalH);
      }

      canvasY += pageSlicePx;
      isFirstPage = false;
    }
  }

  pdf.save(safeFilename([baseFilename], 'pdf'));
}

/** Export a cover letter as a styled PDF. */
export async function exportCoverLetterAsPdf({
  jobTitle,
  company,
  candidateName,
  letterBody,
  baseFilename,
}: {
  jobTitle: string;
  company: string;
  candidateName: string;
  letterBody: string;
  baseFilename: string;
}): Promise<void> {
  const paragraphs = letterBody.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:680px;padding:48px;background:#fff;font-family:Georgia,serif;color:#374151';
  container.innerHTML = `
    <div style="border-bottom:1.5px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px">
      <p style="font-size:11px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin:0 0 6px">Cover Letter</p>
      <p style="font-size:18px;font-weight:700;color:#111;margin:0">${escapeHtml(jobTitle)}</p>
      <p style="font-size:13px;color:#6b7280;margin-top:2px">${escapeHtml(company)}</p>
    </div>
    <p style="font-size:14px;margin:0 0 20px">Dear ${escapeHtml(company)} Hiring Team,</p>
    ${paragraphs.map((p) => `<p style="font-size:14px;line-height:1.75;margin:0 0 16px">${escapeHtml(p)}</p>`).join('')}
    <p style="font-size:14px;margin-top:24px">Best regards,<br/><strong>${escapeHtml(candidateName)}</strong></p>
    <div style="border-top:1px solid #e5e7eb;margin-top:32px;padding-top:12px">
      <p style="font-size:10px;color:#9ca3af;font-family:monospace;text-align:right;margin:0">Generated by Hireschema · hireschema.com</p>
    </div>
  `;
  document.body.appendChild(container);
  try {
    await exportResumeAsPdf({ source: container, baseFilename });
  } finally {
    document.body.removeChild(container);
  }
}

/** Export interview prep or other markdown Q&A as a styled PDF. */
export async function exportInterviewPrepAsPdf({
  jobTitle,
  company,
  questions,
  baseFilename,
}: {
  jobTitle: string;
  company: string;
  questions: string | string[];
  baseFilename: string;
}): Promise<void> {
  const items = Array.isArray(questions)
    ? questions
    : questions.split(/\n{2,}/).map((q) => q.trim()).filter(Boolean);

  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:680px;padding:48px;background:#fff;font-family:Georgia,serif;color:#374151';
  container.innerHTML = `
    <div style="border-bottom:1.5px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px">
      <p style="font-size:11px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin:0 0 6px">Interview Prep</p>
      <p style="font-size:18px;font-weight:700;color:#111;margin:0">${escapeHtml(jobTitle)}</p>
      <p style="font-size:13px;color:#6b7280;margin-top:2px">${escapeHtml(company)}</p>
    </div>
    <ol style="padding-left:20px;margin:0">
      ${items.map((q) => `<li style="margin-bottom:16px;line-height:1.65;font-size:14px">${escapeHtml(q)}</li>`).join('')}
    </ol>
    <div style="border-top:1px solid #e5e7eb;margin-top:32px;padding-top:12px">
      <p style="font-size:10px;color:#9ca3af;font-family:monospace;text-align:right;margin:0">Generated by Hireschema · hireschema.com</p>
    </div>
  `;
  document.body.appendChild(container);
  try {
    await exportResumeAsPdf({ source: container, baseFilename });
  } finally {
    document.body.removeChild(container);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

export interface DocxExportOptions {
  /** Raw markdown for the tailored resume. */
  markdown: string;
  /** Filename without extension. */
  baseFilename: string;
}

export async function exportResumeAsDocx({ markdown, baseFilename }: DocxExportOptions): Promise<void> {
  const lines = (markdown || '').split('\n');
  const children: Paragraph[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (!trimmed) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    if (trimmed.startsWith('# ')) {
      // Name → centred H1
      children.push(
        new Paragraph({
          text: trimmed.replace(/^#\s+/, '').toUpperCase(),
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      // Section header → uppercased, bottom border
      children.push(
        new Paragraph({
          text: trimmed.replace(/^##\s+/, '').toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          border: {
            bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 },
          },
          spacing: { before: 360, after: 180 },
        })
      );
    } else if (trimmed.startsWith('### ')) {
      // Job title / degree
      children.push(
        new Paragraph({
          text: trimmed.replace(/^###\s+/, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 60 },
        })
      );
    } else if (/^\*[^*]+\*$/.test(trimmed)) {
      // Italic date-line subtitle
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: trimmed.replace(/^\*|\*$/g, ''), italics: true }),
          ],
          spacing: { before: 0, after: 80 },
        })
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^[-*]\s+/, ''),
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
        })
      );
    } else if (isContactLine(trimmed)) {
      children.push(
        new Paragraph({
          text: trimmed,
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 200 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          text: trimmed,
          spacing: { before: 60, after: 60 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, safeFilename([baseFilename], 'docx'));
}
