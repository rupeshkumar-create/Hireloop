import React, { useRef } from 'react';
import { X, Download, FileText, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2pdf from 'html2pdf.js';
import { Button } from '../ui/button';

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
    fontSize: '12px',
    lineHeight: '1.55',
    color: '#1a1a1a',
    background: '#fff',
    padding: '52px 56px',
    minHeight: '1056px',
    maxWidth: '800px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },
  name: {
    fontSize: '28px',
    fontWeight: '700',
    textAlign: 'center' as const,
    letterSpacing: '-0.015em',
    margin: '0 0 6px 0',
    color: '#111',
    fontFamily: '"Garamond", "Georgia", serif',
  },
  contactLine: {
    textAlign: 'center' as const,
    fontSize: '11.5px',
    color: '#555',
    margin: '0 0 20px 0',
    letterSpacing: '0.01em',
  },
  sectionHeader: {
    fontSize: '10.5px',
    fontWeight: '700',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: '#111',
    borderBottom: '1.5px solid #111',
    paddingBottom: '3px',
    marginTop: '20px',
    marginBottom: '10px',
  },
  h3: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#111',
    margin: '10px 0 2px 0',
  },
  italicLine: {
    fontSize: '11px',
    color: '#555',
    fontStyle: 'italic' as const,
    margin: '0 0 4px 0',
    display: 'block' as const,
  },
  para: {
    fontSize: '12px',
    color: '#333',
    lineHeight: '1.55',
    margin: '4px 0',
  },
  ul: {
    margin: '4px 0 8px 0',
    paddingLeft: '18px',
    listStyleType: 'disc' as const,
  },
  li: {
    fontSize: '12px',
    color: '#333',
    lineHeight: '1.55',
    marginBottom: '3px',
  },
  strong: {
    fontWeight: '700',
    color: '#111',
  },
  hr: {
    border: 'none',
    borderTop: '1px solid #ddd',
    margin: '16px 0',
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

function ResumeMarkdown({ text }: { text: string }) {
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

  const downloadPdf = async () => {
    if (!resumeRef.current) return;
    const opt = {
      margin:      [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
      filename:    `Resume_${companyName.replace(/\s+/g, '_')}.pdf`,
      image:       { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:       { unit: 'in', format: 'letter', orientation: 'portrait' as const },
    };
    await html2pdf().set(opt).from(resumeRef.current).save();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-foreground-muted" />
            <span className="font-semibold">
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
              <Download className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-foreground-muted transition-colors hover:bg-border hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* A4 Preview */}
        <div className="flex-1 overflow-y-auto bg-[#f0ece4] p-8">
          <div
            ref={resumeRef}
            className="shadow-[0_4px_40px_rgba(0,0,0,0.15)]"
            style={S.page}
          >
            <ResumeMarkdown text={resumeText} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
