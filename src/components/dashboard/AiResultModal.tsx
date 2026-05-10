import React, { useRef } from 'react';
import { X, Download, Loader2, MessageSquare, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2pdf from 'html2pdf.js';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'interview' | 'salary';
  jobTitle: string;
  company: string;
  location?: string;
  content: string | string[];
  isLoading: boolean;
}

const LABELS = {
  interview: { title: 'Interview Prep', icon: MessageSquare, accent: 'text-violet-500' },
  salary:    { title: 'Salary Insights', icon: TrendingUp,   accent: 'text-emerald-500' },
};

export function AiResultModal({ isOpen, onClose, type, jobTitle, company, location, content, isLoading }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { title, icon: Icon, accent } = LABELS[type];

  const downloadPdf = async () => {
    if (!contentRef.current) return;
    const filename = `${title.replace(/\s/g, '_')}_${company.replace(/\s+/g, '_')}.pdf`;
    try {
      await html2pdf()
        .set({
          margin: [0.5, 0.6, 0.5, 0.6],
          filename,
          image: { type: 'jpeg', quality: 0.97 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .from(contentRef.current)
        .save();
      toast.success(`${title} downloaded as PDF`);
    } catch {
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] shadow-2xl"
            style={{ maxHeight: '88vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-6 py-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`h-4.5 w-4.5 shrink-0 ${accent}`} style={{ height: 18, width: 18 }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--hs-app-fg)] leading-tight">{title}</p>
                  <p className="text-[11px] text-[var(--hs-app-muted)] truncate">
                    {jobTitle} · {company}{location ? ` · ${location}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isLoading && content && (
                  <button
                    onClick={downloadPdf}
                    className="hs-btn hs-btn-primary gap-1.5 text-[12px] py-1.5 px-3"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] text-[var(--hs-app-fg)] transition-all hover:bg-[var(--hs-app-fg)] hover:text-[var(--hs-app-surface)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-fg)]/40"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-muted)]" />
                  <p className="text-sm text-[var(--hs-app-muted)]">Generating {title.toLowerCase()}…</p>
                </div>
              ) : (
                <div ref={contentRef} className="px-6 py-6 bg-white" style={{ fontFamily: 'Georgia, serif' }}>
                  {/* PDF header */}
                  <div style={{ borderBottom: '1.5px solid #e5e7eb', paddingBottom: 16, marginBottom: 24 }}>
                    <p style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
                      {title}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>{jobTitle}</p>
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                      {company}{location ? ` · ${location}` : ''}
                    </p>
                  </div>

                  {/* Content */}
                  {type === 'interview' && Array.isArray(content) ? (
                    <ol style={{ paddingLeft: 20, margin: 0 }}>
                      {content.map((q, i) => (
                        <li key={i} style={{ marginBottom: 16, lineHeight: 1.65, color: '#374151', fontSize: 14 }}>{q}</li>
                      ))}
                    </ol>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none"
                      style={{ fontSize: 14, lineHeight: 1.7, color: '#374151' }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {typeof content === 'string' ? content : content.join('\n\n')}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* PDF footer */}
                  <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 32, paddingTop: 12 }}>
                    <p style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', textAlign: 'right' }}>
                      Generated by Hireschema · hireschema.com
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
