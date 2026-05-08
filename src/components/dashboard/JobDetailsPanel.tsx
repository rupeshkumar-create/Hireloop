import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkPlus, ExternalLink, MapPin, DollarSign, Mail, FileText, MessageSquare, TrendingUp, Sparkles, Download, Loader2, X, Eye, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  actionLoading: boolean;
  downloadResume: (j: Job | null) => void;
  onClose: () => void;
  isSaved: boolean;
  isSaving: boolean;
}

export function JobDetailsPanel({
  selectedJob, saveJob, dismissJob, trackJobClick, handleAiAction, aiAction, aiResult, actionLoading, downloadResume, onClose, isSaved, isSaving
}: JobDetailsPanelProps) {
  const { user, profile } = useAuth();
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [aiModalDismissed, setAiModalDismissed] = useState(false);
  const applyUrl = resolveJobApplicationUrlWithFallback(selectedJob);

  // Reset dismissed state whenever a new interview/salary action starts
  useEffect(() => {
    if (aiAction === 'interview' || aiAction === 'salary') {
      setAiModalDismissed(false);
    }
  }, [aiAction]);

  const aiModalOpen =
    (aiAction === 'interview' || aiAction === 'salary') && !aiModalDismissed;
  const isFallbackUrl = isJobUrlFallback(selectedJob);
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] font-sans shadow-2xl"
        >
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-[var(--hs-app-bg)] p-2 transition-colors hover:bg-[var(--hs-app-bg)]"
          >
            <X className="h-5 w-5 text-[var(--hs-app-muted)]" />
          </button>

          <div className="p-6 md:p-8 overflow-y-auto flex-1">
            <div className="flex justify-between items-start mb-2 pr-10">
              <h2 className="hs-section-title text-[var(--hs-app-fg)]">{selectedJob.title}</h2>
              {selectedJob.matchScore !== undefined && (
                <span className="hs-score ml-3 mt-1 shrink-0" style={{ '--score': `${selectedJob.matchScore}%` } as React.CSSProperties}>
                  {selectedJob.matchScore}
                </span>
              )}
            </div>
            <p className="text-[14px] font-medium text-[var(--hs-app-muted)] mb-5">{selectedJob.company}</p>
            
            <div className="flex gap-3 mb-8">
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

            <div className="hs-tags mb-6">
              <span className="hs-tag flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedJob.location || 'Remote'}</span>
              <span className="hs-tag flex items-center gap-1"><DollarSign className="h-3 w-3" /> {selectedJob.salary || 'Salary not listed'}</span>
              {selectedJob.workType && <span className="hs-tag">{selectedJob.workType}</span>}
            </div>

            <div className="space-y-8">
              <div className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-6">
                <h4 className="mb-3 text-[14px] font-semibold text-[var(--hs-app-fg)]">About the Role</h4>
                <p className="text-[var(--hs-app-muted)] leading-7 whitespace-pre-wrap text-[13px]">{selectedJob.description}</p>
              </div>

              {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                <div className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-6">
                  <h4 className="mb-3 text-[14px] font-semibold text-[var(--hs-app-fg)]">Requirements</h4>
                  <ul className="space-y-3 font-sans text-[15px]">
                    {selectedJob.requirements.map((req, i) => (
                      <li key={i} className="text-[var(--hs-app-muted)] flex items-start text-[13px]">
                        <span className="mr-3 mt-2 h-1.5 w-1.5 rounded-full bg-[var(--hs-app-muted)] flex-shrink-0" />
                        <span className="leading-6">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-6 md:p-8">
            <h4 className="mb-4 text-[15px] font-semibold text-[var(--hs-app-fg)]">AI Copilot</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button type="button" className="hs-btn" onClick={() => handleAiAction('email', selectedJob)}>
                <Mail className="h-3.5 w-3.5 text-[var(--hs-app-accent)]" /> Cold Email
              </button>
              <button type="button" className="hs-btn" onClick={() => handleAiAction('resume', selectedJob)}>
                <FileText className="h-3.5 w-3.5" /> Tailor Resume
              </button>
              <button type="button" className="hs-btn" onClick={() => handleAiAction('interview', selectedJob)}>
                <MessageSquare className="h-3.5 w-3.5" /> Interview Prep
              </button>
              <button type="button" className="hs-btn" onClick={() => handleAiAction('salary', selectedJob)}>
                <TrendingUp className="h-3.5 w-3.5" /> Salary Data
              </button>
            </div>
          </div>

          {/* Inline panel — email & resume only (interview/salary open as modal) */}
          <AnimatePresence>
            {(aiAction === 'email' || aiAction === 'resume') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="max-h-[50vh] overflow-y-auto border-t border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-6 md:p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h4 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--hs-app-fg)]">
                    <Sparkles className="h-5 w-5 text-[var(--hs-app-accent)]" />
                    {aiAction === 'email' && 'Cold Email Draft'}
                    {aiAction === 'resume' && 'Tailored Resume'}
                  </h4>
                  {aiAction === 'resume' && !actionLoading && (
                    <button type="button" className="hs-btn" onClick={() => downloadResume(selectedJob)}>
                      <Download className="h-3.5 w-3.5" /> Download .md
                    </button>
                  )}
                </div>

                {actionLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-muted)]" />
                    <p className="text-sm text-[var(--hs-app-muted)]">
                      {aiAction === 'resume' ? 'Tailoring your resume to this role…' : 'Generating…'}
                    </p>
                  </div>
                ) : (
                  <div>
                    {aiAction === 'resume' && typeof aiResult === 'string' && aiResult ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <button type="button" className="hs-btn hs-btn-primary" onClick={() => setShowResumePreview(true)}>
                            <Eye className="h-3.5 w-3.5" /> Preview & Download
                          </button>
                          <button type="button" className="hs-btn" onClick={() => downloadResume(selectedJob)}>
                            <Download className="h-3.5 w-3.5" /> Download .md
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
                          <pre className="whitespace-pre-wrap text-xs text-[var(--hs-app-muted)] leading-relaxed font-mono">
                            {aiResult.slice(0, 1200)}{aiResult.length > 1200 ? '\n\n…[open full preview]' : ''}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[var(--hs-app-muted)] bg-[var(--hs-app-bg)] p-6 rounded-xl border border-[var(--hs-app-border)]">
                        <div className="prose prose-sm max-w-none prose-zinc">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResult as string}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {aiAction === 'email' && (
                      <div className="mt-8 border-t border-[var(--hs-app-border)] pt-6 space-y-4">
                        <button
                          type="button"
                          className="hs-btn hs-btn-primary w-full justify-center py-2.5"
                          onClick={async () => {
                            let optimizedResume = profile?.resumeText || '';
                            if (profile?.resumeText) {
                              toast.info('Generating tailored resume...');
                              try {
                                optimizedResume = await tailorResume(selectedJob.title, selectedJob.description, profile.resumeText, profile?.antiSlopEnabled !== false);
                              } catch (e: any) {
                                if (e.message === 'AI_QUOTA_EXCEEDED') {
                                  toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue using AI features.', { duration: 6000 });
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
                            const mailBody = encodeURIComponent(`${aiResult}\n\nJob URL: ${applyUrl || ''}`);
                            window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=Application for ${selectedJob.title}&body=${mailBody}`, '_blank');
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" /> Open in Gmail with Tailored Resume
                        </button>
                        <p className="text-sm text-[var(--hs-app-muted)] text-center">
                          This will download a tailored resume for you to attach, and then open Gmail with this draft.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Resume full-screen preview modal */}
      <ResumePreviewModal
        isOpen={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        resumeText={typeof aiResult === 'string' ? aiResult : ''}
        companyName={selectedJob.company}
        jobTitle={selectedJob.title}
      />

      {/* Interview Prep / Salary Insights popup */}
      <AiResultModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalDismissed(true)}
        type={aiAction === 'salary' ? 'salary' : 'interview'}
        jobTitle={selectedJob.title}
        company={selectedJob.company}
        location={selectedJob.location}
        content={aiResult}
        isLoading={actionLoading}
      />
    </AnimatePresence>
  );
}
