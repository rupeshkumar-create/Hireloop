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

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // US Letter @ 72 dpi: 612 × 792 pt. Margins 36pt (~0.5in) on top/bottom,
  // 43pt (~0.6in) left/right. Same as the previous html2pdf settings.
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 43;
  const marginY = 36;
  const contentW = pageW - marginX * 2;
  const contentH = pageH - marginY * 2;

  // Paint the whole page white BEFORE placing the image. jsPDF leaves
  // unpainted regions transparent; PDF viewers in dark mode render that as
  // dark grey/black, which makes the resume look like it has black margins.
  // A solid white background guarantees the page looks like a printed
  // résumé in any viewer.
  const fillPageWhite = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');
  };

  // Scale the canvas so its width fits the content area, then slice into pages.
  const ratio = contentW / canvas.width;
  const scaledTotalH = canvas.height * ratio;

  fillPageWhite();
  if (scaledTotalH <= contentH) {
    pdf.addImage(imgData, 'JPEG', marginX, marginY, contentW, scaledTotalH);
  } else {
    // Multi-page slice. We re-draw the full image but shift the y origin
    // so each page shows the next chunk; off-page content is clipped by
    // jsPDF naturally.
    let consumed = 0;
    while (consumed < scaledTotalH) {
      const yOffset = marginY - consumed;
      pdf.addImage(imgData, 'JPEG', marginX, yOffset, contentW, scaledTotalH);
      consumed += contentH;
      if (consumed < scaledTotalH) {
        pdf.addPage();
        fillPageWhite();
      }
    }
  }

  pdf.save(safeFilename([baseFilename], 'pdf'));
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
