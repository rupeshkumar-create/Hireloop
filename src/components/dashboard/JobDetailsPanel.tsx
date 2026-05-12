import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookmarkPlus,
  ExternalLink,
  MapPin,
  DollarSign,
  Mail,
  FileText,
  MessageSquare,
  TrendingUp,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Job } from '../../types/dashboard';
import { AiActionType } from '../../hooks/useDashboardAI';
import { useAuth } from '../../contexts/AuthContext';
import { tailorResume } from '../../services/aiService';
import { toast } from 'sonner';
import { ResumePreviewModal } from './ResumePreviewModal';
import { AiResultModal } from './AiResultModal';
import { resolveJobApplicationUrlWithFallback, isJobUrlFallback } from '../../lib/jobLinks';

interface JobDetailsPanelProps {
  selectedJob: Job;
  saveJob: (j: Job) => Promise<boolean>;
  dismissJob: (j: Job) => void;
  trackJobClick: (j: Job) => void;
  handleAiAction: (a: AiActionType, j: Job) => void;
  aiAction: AiActionType;
  aiResult: string | string[];
  setAiResult?: (next: string | string[]) => void;
  actionLoading: boolean;
  downloadResume: (j: Job | null) => void;
  onClose: () => void;
  isSaved: boolean;
  isSaving: boolean;
}

export function JobDetailsPanel({
  selectedJob,
  saveJob,
  trackJobClick,
  handleAiAction,
  aiAction,
  aiResult,
  setAiResult,
  actionLoading,
  downloadResume,
  onClose,
  isSaved,
  isSaving,
}: JobDetailsPanelProps) {
  const { user, profile } = useAuth();
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [aiModalDismissed, setAiModalDismissed] = useState(false);
  const applyUrl = resolveJobApplicationUrlWithFallback(selectedJob);
  const isFallbackUrl = isJobUrlFallback(selectedJob);

  // Reset dismissed state whenever a new AI action starts.
  useEffect(() => {
    if (aiAction) setAiModalDismissed(false);
  }, [aiAction]);

  // ESC key closes the panel — standard modal accessibility.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const aiModalOpen = !!aiAction && !aiModalDismissed;

  // Email action: tailor a resume, download it, then open Gmail with the draft.
  const handleOpenGmail = async (emailContent: string) => {
    let optimizedResume = profile?.resumeText || '';
    if (profile?.resumeText) {
      toast.info('Generating tailored resume...');
      try {
        optimizedResume = await tailorResume(
          selectedJob.title,
          selectedJob.description,
          profile.resumeText,
          profile?.antiSlopEnabled !== false
        );
      } catch (e: any) {
        if (e.message === 'AI_QUOTA_EXCEEDED') {
          toast.error(
            'AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue using AI features.',
            { duration: 6000 }
          );
        } else {
          toast.error(e?.message || 'Failed to generate tailored resume.');
        }
        return;
      }
    }
    const blob = new Blob([optimizedResume], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user?.displayName?.replace(/\s+/g, '_') || 'Candidate'}_Tailored_Resume.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Tailored resume downloaded. Please attach it to your email.');
    const mailBody = encodeURIComponent(`${emailContent}\n\nJob URL: ${applyUrl || ''}`);
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=Application for ${selectedJob.title}&body=${mailBody}`,
      '_blank'
    );
  };

  const resolveModalType = (): 'email' | 'resume' | 'interview' | 'salary' => {
    if (aiAction === 'email' || aiAction === 'resume' || aiAction === 'interview' || aiAction === 'salary') {
      return aiAction;
    }
    return 'email';
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex h-screen min-h-0 w-full max-w-2xl flex-col overflow-hidden border-l border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] font-sans shadow-2xl"
        >
          {/* ── Sticky header ──────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] px-6 pt-6 pb-4 md:px-8 md:pt-8">
            <button
              type="button"
              aria-label="Close job details"
              onClick={onClose}
              className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] text-[var(--hs-app-fg)] shadow-sm transition-all hover:bg-[var(--hs-app-fg)] hover:text-[var(--hs-app-surface)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-fg)]/40"
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
            </button>

            <div className="flex justify-between items-start mb-2 pr-12">
              <h2 className="hs-section-title text-[var(--hs-app-fg)]">{selectedJob.title}</h2>
              {selectedJob.matchScore !== undefined && (
                <span
                  className="hs-score ml-3 mt-1 shrink-0"
                  style={{ '--score': `${selectedJob.matchScore}%` } as React.CSSProperties}
                >
                  {selectedJob.matchScore}
                </span>
              )}
            </div>
            <p className="text-[14px] font-medium text-[var(--hs-app-muted)] mb-4">
              {selectedJob.company}
            </p>

            <div className="flex gap-3 mb-4">
              {!isSaved ? (
                <button
                  type="button"
                  className="hs-btn hs-btn-primary flex-1 justify-center py-2.5"
                  disabled={isSaving}
                  onClick={() => saveJob(selectedJob)}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                  {isSaving ? 'Saving...' : 'Save Job'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="hs-btn hs-btn-primary flex-1 justify-center py-2.5"
                    title={isFallbackUrl ? 'Search for this job on Google' : 'Open application page'}
                    onClick={() => {
                      trackJobClick(selectedJob);
                      window.open(applyUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {isFallbackUrl ? 'Find & Apply' : 'Apply Now'} <ExternalLink className="h-4 w-4" />
                  </button>
                  <button type="button" className="hs-btn opacity-50 cursor-default" disabled>
                    <CheckCircle2 className="h-4 w-4" /> Saved
                  </button>
                </>
              )}
            </div>

            {/* AI Copilot — top toolbar */}
            <div className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
              <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)]">
                AI Copilot
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  className="hs-btn justify-center"
                  onClick={() => handleAiAction('email', selectedJob)}
                >
                  <Mail className="h-3.5 w-3.5 text-[var(--hs-app-accent)]" /> Cold Email
                </button>
                <button
                  type="button"
                  className="hs-btn justify-center"
                  onClick={() => handleAiAction('resume', selectedJob)}
                >
                  <FileText className="h-3.5 w-3.5" /> Tailor Resume
                </button>
                <button
                  type="button"
                  className="hs-btn justify-center"
                  onClick={() => handleAiAction('interview', selectedJob)}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Interview Prep
                </button>
                <button
                  type="button"
                  className="hs-btn justify-center"
                  onClick={() => handleAiAction('salary', selectedJob)}
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Salary Data
                </button>
              </div>
            </div>
          </div>

          {/* ── Scrollable body (only this region scrolls) ─────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 md:px-8">
            <div className="hs-tags mb-6">
              <span className="hs-tag flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {selectedJob.location || 'Remote'}
              </span>
              <span className="hs-tag flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> {selectedJob.salary || 'Salary not listed'}
              </span>
            </div>

            <div className="space-y-8">
              <div className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-6">
                <h4 className="mb-3 text-[14px] font-semibold text-[var(--hs-app-fg)]">
                  About the Role
                </h4>
                <p className="text-[var(--hs-app-muted)] leading-7 whitespace-pre-wrap text-[13px]">
                  {selectedJob.description}
                </p>
              </div>

              {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                <div className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-6">
                  <h4 className="mb-3 text-[14px] font-semibold text-[var(--hs-app-fg)]">
                    Requirements
                  </h4>
                  <ul className="space-y-3 font-sans text-[15px]">
                    {selectedJob.requirements.map((req, i) => (
                      <li
                        key={i}
                        className="text-[var(--hs-app-muted)] flex items-start text-[13px]"
                      >
                        <span className="mr-3 mt-2 h-1.5 w-1.5 rounded-full bg-[var(--hs-app-muted)] flex-shrink-0" />
                        <span className="leading-6">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Unified AI result popup (close + edit + type-specific actions) */}
      <AiResultModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalDismissed(true)}
        type={resolveModalType()}
        jobTitle={selectedJob.title}
        company={selectedJob.company}
        location={selectedJob.location}
        content={aiResult}
        isLoading={actionLoading}
        onContentChange={setAiResult}
        onOpenGmail={handleOpenGmail}
        onPreviewResume={() => setShowResumePreview(true)}
        onDownloadMarkdown={() => downloadResume(selectedJob)}
      />

      {/* Resume full-screen preview (opened from the AI result modal) */}
      <ResumePreviewModal
        isOpen={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        resumeText={typeof aiResult === 'string' ? aiResult : ''}
        companyName={selectedJob.company}
        jobTitle={selectedJob.title}
      />
    </AnimatePresence>
  );
}
