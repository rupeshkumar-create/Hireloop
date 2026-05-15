import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { exportResumeAsPdf, exportResumeAsDocx } from '../../lib/resumeExport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  resumeText: string;
  companyName: string;
  jobTitle?: string;
}

// ─── Inline styles (all inline so html2pdf captures them correctly) ───────────

const S = {
  page: {
    fontFamily: '"Garamond", "Georgia", "Times New Roman", serif',
    fontSize: '12.5px',
    lineHeight: '1.6',
    color: '#1a1a1a',
    background: '#fff',
    padding: '60px 70px',
    minHeight: '1056px', // A4 height at 96dpi
    maxWidth: '820px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  contentWrapper: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-start' as const,
  },
  name: {
    fontSize: '32px',
    fontWeight: '700',
    textAlign: 'center' as const,
    letterSpacing: '-0.02em',
    margin: '0 0 8px 0',
    color: '#111',
    fontFamily: '"Garamond", "Georgia", serif',
    textTransform: 'uppercase' as const,
  },
  contactLine: {
    textAlign: 'center' as const,
    fontSize: '11px',
    color: '#555',
    margin: '0 0 24px 0',
    letterSpacing: '0.03em',
  },
  sectionHeader: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#111',
    borderBottom: '1.5px solid #111',
    paddingBottom: '4px',
    marginTop: '28px',
    marginBottom: '12px',
    pageBreakAfter: 'avoid' as const,
    breakAfter: 'avoid' as const,
  },
  h3: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#111',
    margin: '12px 0 3px 0',
    display: 'flex',
    justifyContent: 'space-between',
    pageBreakAfter: 'avoid' as const,
    breakAfter: 'avoid' as const,
  },
  italicLine: {
    fontSize: '11.5px',
    color: '#444',
    fontStyle: 'italic' as const,
    margin: '0 0 6px 0',
    display: 'block' as const,
    pageBreakAfter: 'avoid' as const,
    breakAfter: 'avoid' as const,
  },
  para: {
    fontSize: '12.5px',
    color: '#333',
    lineHeight: '1.6',
    margin: '6px 0',
    pageBreakInside: 'avoid' as const,
    breakInside: 'avoid' as const,
  },
  ul: {
    margin: '6px 0 12px 0',
    paddingLeft: '20px',
    listStyleType: 'disc' as const,
    pageBreakInside: 'avoid' as const,
    breakInside: 'avoid' as const,
  },
  li: {
    fontSize: '12.5px',
    color: '#333',
    lineHeight: '1.6',
    marginBottom: '5px',
    pageBreakInside: 'avoid' as const,
    breakInside: 'avoid' as const,
  },
  strong: {
    fontWeight: '700',
    color: '#111',
  },
  hr: {
    border: 'none',
    borderTop: '1px solid #ddd',
    margin: '20px 0',
  },
};

// ─── Smart contact-line detection ────────────────────────────────────────────

function isContactLine(text: string): boolean {
  return (
    text.includes('|') ||
    text.includes('•') ||
    text.includes('@') ||
    text.includes('linkedin') ||
    text.includes('github') ||
    /^\+?[\d\s\-().]{7,}$/.test(text.trim())
  );
}

// ─── Custom markdown → resume renderer ───────────────────────────────────────

export function ResumeMarkdown({ text }: { text: string }) {
  // Track first-paragraph position for contact-line detection
  let firstH1Seen = false;
  let firstParaAfterH1Seen = false;

  const components: React.ComponentProps<typeof ReactMarkdown>['components'] = {
    h1: ({ children }) => {
      firstH1Seen = true;
      return <h1 style={S.name}>{children}</h1>;
    },
    h2: ({ children }) => <div style={S.sectionHeader}>{children}</div>,
    h3: ({ children }) => <h3 style={S.h3}>{children}</h3>,
    p: ({ children }) => {
      const raw = typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.map(c => (typeof c === 'string' ? c : '')).join('')
          : '';

      // First paragraph after H1 OR explicit contact pattern → contact line
      if (firstH1Seen && !firstParaAfterH1Seen) {
        firstParaAfterH1Seen = true;
        if (isContactLine(raw)) {
          return <p style={S.contactLine}>{children}</p>;
        }
      }
      if (isContactLine(raw)) {
        return <p style={S.contactLine}>{children}</p>;
      }
      return <p style={S.para}>{children}</p>;
    },
    em: ({ children }) => <span style={S.italicLine}>{children}</span>,
    strong: ({ children }) => <strong style={S.strong}>{children}</strong>,
    ul: ({ children }) => <ul style={S.ul}>{children}</ul>,
    ol: ({ children }) => (
      <ol style={{ ...S.ul, listStyleType: 'decimal' }}>{children}</ol>
    ),
    li: ({ children }) => <li style={S.li}>{children}</li>,
    hr: () => <hr style={S.hr} />,
    // Suppress default blockquote wrapping
    blockquote: ({ children }) => (
      <div style={{ borderLeft: '3px solid #ddd', paddingLeft: '12px', color: '#555', margin: '8px 0' }}>
        {children}
      </div>
    ),
    // Code blocks sometimes appear in resume text — render as plain text
    code: ({ children }) => (
      <span style={{ fontFamily: 'inherit', background: 'none' }}>{children}</span>
    ),
    pre: ({ children }) => <div>{children}</div>,
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ResumePreviewModal({ isOpen, onClose, resumeText, companyName, jobTitle }: Props) {
  const resumeRef = useRef<HTMLDivElement>(null);

  // Esc closes — standard modal accessibility. Without this users hunt for
  // the X button. Also fixed an issue where the X icon was reported as
  // unresponsive: the handler was wired correctly, but with no backdrop
  // click + no Esc the modal felt "stuck" if anything ever swallowed the
  // X click.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Both downloaders now delegate to the shared exporter in lib/resumeExport.
  // That helper uses html2canvas-pro (native oklch support) + jsPDF directly
  // — bypassing html2pdf.js's bundled html2canvas v1 which crashed on the
  // modern colour functions Tailwind v4 emits everywhere.
  const baseFilename = `Resume_${companyName.replace(/\s+/g, '_')}`;

  const downloadPdf = async () => {
    if (!resumeRef.current) return;
    try {
      toast.loading('Generating PDF...', { id: 'pdf-gen' });
      await exportResumeAsPdf({ source: resumeRef.current, baseFilename });
      toast.success('Resume downloaded as PDF', { id: 'pdf-gen' });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error(`Failed to generate PDF: ${err.message || 'Unknown error'}`, { id: 'pdf-gen' });
    }
  };

  const downloadDocx = async () => {
    try {
      toast.loading('Generating DOCX...', { id: 'docx-gen' });
      await exportResumeAsDocx({ markdown: resumeText, baseFilename });
      toast.success('Resume downloaded as DOCX', { id: 'docx-gen' });
    } catch (err: any) {
      console.error('DOCX generation error:', err);
      toast.error(`Failed to generate DOCX: ${err.message || 'Unknown error'}`, { id: 'docx-gen' });
    }
  };


  if (!isOpen) return null;

  // Portal to document.body — escapes any transformed ancestor (e.g. the
  // sliding JobDetailsPanel) so fixed positioning centers in the viewport.
  const modalRoot = typeof document !== 'undefined' ? document.body : null;

  const modalNode = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(0,0,0,0.55)] backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-foreground-muted" />
            <span className="font-medium">
              Resume Preview
              {jobTitle && companyName && (
                <span className="ml-2 text-sm font-normal text-foreground-muted">
                  — tailored for {jobTitle} @ {companyName}
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <Download className="mr-1.5 h-4 w-4 text-red-500" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={downloadDocx}>
              <Download className="mr-1.5 h-4 w-4 text-blue-500" /> DOCX
            </Button>
            <button
              type="button"
              aria-label="Close preview"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-all hover:bg-foreground hover:text-surface hover:shadow-md focus:outline-none focus:ring-2 focus:ring-foreground/40"
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {/* A4 Preview */}
        <div className="flex-1 overflow-y-auto bg-[#f0ece4] p-8">
          <div
            ref={resumeRef}
            className="border border-border bg-white shadow-xl"
            style={S.page}
          >
            <div style={S.contentWrapper}>
              <ResumeMarkdown text={resumeText} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return modalRoot ? createPortal(modalNode, modalRoot) : modalNode;
}
