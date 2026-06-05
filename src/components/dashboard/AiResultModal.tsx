import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Loader2,
  MessageSquare,
  TrendingUp,
  Mail,
  FileText,
  Pencil,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { exportResumeAsPdf, exportResumeAsDocx } from '../../lib/resumeExport';
import { ResumeMarkdown } from './ResumePreviewModal';

export type AiResultType = 'email' | 'resume' | 'interview' | 'salary';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: AiResultType;
  jobTitle: string;
  company: string;
  location?: string;
  content: string | string[];
  isLoading: boolean;
  // Persist edits back to the upstream state (e.g. useDashboardAI.setAiResult).
  // Optional — when omitted, edits stay local and reset on the next generation.
  onContentChange?: (next: string | string[]) => void;
  // Type-specific action: cold email composes a Gmail draft.
  onOpenGmail?: (content: string) => void;
}

const LABELS: Record<AiResultType, { title: string; icon: typeof Mail; accent: string }> = {
  email:     { title: 'Cold Email',      icon: Mail,          accent: 'text-blue-500' },
  resume:    { title: 'Tailored Resume', icon: FileText,      accent: 'text-rose-500' },
  interview: { title: 'Interview Prep',  icon: MessageSquare, accent: 'text-violet-500' },
  salary:    { title: 'Salary Insights', icon: TrendingUp,    accent: 'text-emerald-500' },
};

function toEditableString(content: string | string[]): string {
  if (Array.isArray(content)) return content.join('\n\n');
  return content || '';
}

export function AiResultModal({
  isOpen,
  onClose,
  type,
  jobTitle,
  company,
  location,
  content,
  isLoading,
  onContentChange,
  onOpenGmail,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { title, icon: Icon, accent } = LABELS[type];

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(() => toEditableString(content));

  // Reset draft + exit edit mode whenever the upstream content changes
  // (e.g. a new generation completes, or the user re-runs an action).
  useEffect(() => {
    setDraft(toEditableString(content));
    setIsEditing(false);
  }, [content]);

  // Exit edit mode when the modal closes — avoids stale draft on reopen.
  useEffect(() => {
    if (!isOpen) setIsEditing(false);
  }, [isOpen]);

  const handleSave = () => {
    if (type === 'interview' && Array.isArray(content)) {
      const parts = draft
        .split(/\n{2,}/)
        .map((line) => line.trim())
        .filter(Boolean);
      onContentChange?.(parts);
    } else {
      onContentChange?.(draft);
    }
    setIsEditing(false);
    toast.success(`${title} updated.`);
  };

  const handleCancel = () => {
    setDraft(toEditableString(content));
    setIsEditing(false);
  };

  const baseFilename = `${title.replace(/\s/g, '_')}_${company.replace(/\s+/g, '_')}`;

  const downloadPdf = async () => {
    if (!contentRef.current) {
      toast.error('Nothing to download yet — please wait for generation to finish.');
      return;
    }
    try {
      toast.loading('Generating PDF…', { id: 'pdf-gen' });
      await exportResumeAsPdf({ source: contentRef.current, baseFilename });
      toast.success(`${title} downloaded as PDF`, { id: 'pdf-gen' });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error(`Failed to generate PDF: ${err?.message || 'Unknown error'}`, { id: 'pdf-gen' });
    }
  };

  const downloadDocx = async () => {
    const md = typeof content === 'string' ? content : Array.isArray(content) ? content.join('\n\n') : '';
    if (!md.trim()) {
      toast.error('Nothing to download yet — please wait for generation to finish.');
      return;
    }
    try {
      toast.loading('Generating DOCX…', { id: 'docx-gen' });
      await exportResumeAsDocx({ markdown: md, baseFilename });
      toast.success(`${title} downloaded as DOCX`, { id: 'docx-gen' });
    } catch (err: any) {
      console.error('DOCX generation error:', err);
      toast.error(`Failed to generate DOCX: ${err?.message || 'Unknown error'}`, { id: 'docx-gen' });
    }
  };

  const flatContent = toEditableString(content);
  const showActions = !isLoading && !!flatContent;

  // Portal target: document.body. Required because the modal is rendered as
  // a descendant of JobDetailsPanel's framer-motion container, which has a
  // `transform` for its slide-in animation. Any transformed ancestor becomes
  // the containing block for fixed-position children, so without a portal the
  // modal would center inside the slid-over panel instead of the viewport.
  const modalRoot = typeof document !== 'undefined' ? document.body : null;

  const modalNode = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] shadow-2xl"
            style={{ maxHeight: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-6 py-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`shrink-0 ${accent}`} style={{ height: 18, width: 18 }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--hs-app-fg)] leading-tight">
                    {title}
                  </p>
                  <p className="text-[11px] text-[var(--hs-app-muted)] truncate">
                    {jobTitle} · {company}
                    {location ? ` · ${location}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showActions && (
                  <>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSave}
                          className="hs-btn hs-btn-primary gap-1.5 text-[12px] py-1.5 px-3"
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="hs-btn gap-1.5 text-[12px] py-1.5 px-3"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="hs-btn gap-1.5 text-[12px] py-1.5 px-3"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        {(type === 'interview' || type === 'salary') && (
                          <button
                            type="button"
                            onClick={downloadPdf}
                            className="hs-btn hs-btn-primary gap-1.5 text-[12px] py-1.5 px-3"
                          >
                            <Download className="h-3.5 w-3.5" /> Download PDF
                          </button>
                        )}
                        {type === 'resume' && (
                          <>
                            <button
                              type="button"
                              onClick={downloadPdf}
                              className="hs-btn hs-btn-primary gap-1.5 text-[12px] py-1.5 px-3"
                            >
                              <Download className="h-3.5 w-3.5" /> PDF
                            </button>
                            <button
                              type="button"
                              onClick={downloadDocx}
                              className="hs-btn gap-1.5 text-[12px] py-1.5 px-3"
                            >
                              <Download className="h-3.5 w-3.5" /> DOCX
                            </button>
                          </>
                        )}
                        {type === 'email' && onOpenGmail && (
                          <button
                            type="button"
                            onClick={() => onOpenGmail(flatContent)}
                            className="hs-btn hs-btn-primary gap-1.5 text-[12px] py-1.5 px-3"
                          >
                            <Mail className="h-3.5 w-3.5" /> Open in Gmail
                          </button>
                        )}
                      </>
                    )}
                  </>
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
                  <p className="text-sm text-[var(--hs-app-muted)]">
                    Generating {title.toLowerCase()}…
                  </p>
                </div>
              ) : isEditing ? (
                <div className="p-6">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full min-h-[400px] rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4 text-[13px] font-mono leading-relaxed text-[var(--hs-app-fg)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-accent)]/40"
                    placeholder="Edit your content here…"
                  />
                  {type === 'interview' && (
                    <p className="mt-2 text-[11px] text-[var(--hs-app-muted)]">
                      Tip: separate each question with a blank line.
                    </p>
                  )}
                </div>
              ) : (
                <div
                  ref={contentRef}
                  className="px-6 py-6 bg-white"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {/* Document header — omitted for resume so the downloaded
                      PDF is just the résumé, no duplicated job-meta line. */}
                  {type !== 'resume' && (
                    <div style={{ borderBottom: '1.5px solid #e5e7eb', paddingBottom: 16, marginBottom: 24 }}>
                      <p style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
                        {title}
                      </p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>{jobTitle}</p>
                      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                        {company}
                        {location ? ` · ${location}` : ''}
                      </p>
                    </div>
                  )}

                  {/* Content */}
                  {type === 'interview' && Array.isArray(content) ? (
                    <ol style={{ paddingLeft: 20, margin: 0 }}>
                      {content.map((q, i) => (
                        <li
                          key={i}
                          style={{ marginBottom: 16, lineHeight: 1.65, color: '#374151', fontSize: 14 }}
                        >
                          {q}
                        </li>
                      ))}
                    </ol>
                  ) : type === 'resume' ? (
                    /* Resume uses the dedicated resume markdown renderer so
                       sections (name, contact, EXPERIENCE headers, dated
                       roles, bullets) are styled like an actual résumé sheet
                       — not flat prose. */
                    <div style={{ fontFamily: '"Garamond", "Georgia", "Times New Roman", serif', color: '#1a1a1a' }}>
                      <ResumeMarkdown text={flatContent} />
                    </div>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none"
                      style={{ fontSize: 14, lineHeight: 1.7, color: '#374151' }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{flatContent}</ReactMarkdown>
                    </div>
                  )}

                  {/* Document footer — resume PDF stays clean. */}
                  {type !== 'resume' && (
                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 32, paddingTop: 12 }}>
                      <p style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', textAlign: 'right' }}>
                        Generated by Hireschema · hireschema.com
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return modalRoot ? createPortal(modalNode, modalRoot) : modalNode;
}
