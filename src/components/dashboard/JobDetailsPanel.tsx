import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkPlus, ExternalLink, MapPin, DollarSign, Mail, FileText, MessageSquare, TrendingUp, Sparkles, Download, Loader2, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import ReactMarkdown from 'react-markdown';
import { Job } from '../../types/dashboard';
import { AiActionType } from '../../hooks/useDashboardAI';
import { useAuth } from '../../contexts/AuthContext';
import { tailorResume } from '../../services/aiService';
import { toast } from 'sonner';

interface JobDetailsPanelProps {
  selectedJob: Job;
  saveJob: (j: Job) => void;
  handleAiAction: (a: AiActionType, j: Job) => void;
  aiAction: AiActionType;
  aiResult: string | string[];
  actionLoading: boolean;
  downloadResume: (j: Job | null) => void;
  onClose: () => void;
}

export function JobDetailsPanel({
  selectedJob, saveJob, handleAiAction, aiAction, aiResult, actionLoading, downloadResume, onClose
}: JobDetailsPanelProps) {
  const { user, profile } = useAuth();
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-2xl border border-border shadow-2xl"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-foreground/5 hover:bg-foreground/10 rounded-full backdrop-blur-md transition-colors"
          >
            <X className="h-5 w-5 text-foreground-muted" />
          </button>

          <div className="p-6 md:p-8 overflow-y-auto flex-1">
            <div className="flex justify-between items-start mb-1 pr-10">
              <h2 className="text-3xl font-bold tracking-tight text-foreground font-display">{selectedJob.title}</h2>
              {selectedJob.matchScore !== undefined && (
                <Badge variant={selectedJob.matchScore >= 80 ? 'success' : 'secondary'} className="font-semibold shadow-sm">
                  {selectedJob.matchScore}% Match
                </Badge>
              )}
            </div>
            <p className="text-xl font-medium text-foreground-muted mb-6">{selectedJob.company}</p>
            
            <div className="flex gap-3 mb-8">
              <Button className="flex-1 font-display font-semibold shadow-lg shadow-black/10" size="lg" onClick={() => window.open(selectedJob.url, '_blank')}>
                Apply Now <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="bg-surface/50 backdrop-blur-sm border-border" onClick={() => saveJob(selectedJob)} title="Save to Tracker">
                <BookmarkPlus className="h-5 w-5" /> Save Job
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              <Badge variant="outline" className="font-medium px-4 py-1.5 bg-surface/50 backdrop-blur-sm border-border"><MapPin className="mr-1.5 h-4 w-4" /> {selectedJob.location}</Badge>
              <Badge variant="outline" className="font-medium px-4 py-1.5 bg-surface/50 backdrop-blur-sm border-border"><DollarSign className="mr-1.5 h-4 w-4" /> {selectedJob.salary || 'Not specified'}</Badge>
            </div>

            <div className="space-y-8">
              <div className="bg-surface/50 backdrop-blur-sm p-6 rounded-2xl border border-border">
                <h4 className="font-bold text-foreground font-display text-lg mb-4">About the Role</h4>
                <p className="text-foreground-muted leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
              </div>
              
              {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                <div className="bg-surface/50 backdrop-blur-sm p-6 rounded-2xl border border-border">
                  <h4 className="font-bold text-foreground font-display text-lg mb-4">Requirements</h4>
                  <ul className="space-y-3">
                    {selectedJob.requirements.map((req, i) => (
                      <li key={i} className="text-foreground-muted flex items-start">
                        <span className="mr-3 mt-2 h-1.5 w-1.5 rounded-full bg-foreground-muted flex-shrink-0" />
                        <span className="leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 md:p-8 bg-background/80 backdrop-blur-xl border-t border-border">
            <h4 className="font-bold text-foreground font-display mb-4">AI Copilot</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" className="bg-surface/60 hover:bg-surface shadow-sm border-border" onClick={() => handleAiAction('email', selectedJob)}>
                <Mail className="mr-2 h-4 w-4 text-orange-500" /> Cold Email
              </Button>
              <Button variant="outline" className="bg-surface/60 hover:bg-surface shadow-sm border-border" onClick={() => handleAiAction('resume', selectedJob)}>
                <FileText className="mr-2 h-4 w-4 text-foreground-muted" /> Tailor Resume
              </Button>
              <Button variant="outline" className="bg-surface/60 hover:bg-surface shadow-sm border-border" onClick={() => handleAiAction('interview', selectedJob)}>
                <MessageSquare className="mr-2 h-4 w-4 text-foreground-muted" /> Interview Prep
              </Button>
              <Button variant="outline" className="bg-surface/60 hover:bg-surface shadow-sm border-border" onClick={() => handleAiAction('salary', selectedJob)}>
                <TrendingUp className="mr-2 h-4 w-4 text-foreground-muted" /> Salary Data
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {aiAction && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-6 md:p-8 border-t border-border bg-surface max-h-[50vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-foreground font-display flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-orange-500" />
                    {aiAction === 'email' && 'Cold Email Draft'}
                    {aiAction === 'resume' && 'Tailored Resume'}
                    {aiAction === 'interview' && 'Interview Questions'}
                    {aiAction === 'salary' && 'Salary Insights'}
                  </h4>
                  {aiAction === 'resume' && !actionLoading && (
                    <Button variant="outline" size="sm" className="shadow-sm" onClick={() => downloadResume(selectedJob)}>
                      <Download className="mr-2 h-4 w-4" /> Download .md
                    </Button>
                  )}
                </div>
                
                {actionLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-foreground" /></div>
                ) : (
                  <div className="text-foreground-muted bg-background p-6 rounded-xl border border-border shadow-inner">
                    {aiAction === 'interview' && Array.isArray(aiResult) ? (
                      <ul className="list-decimal pl-5 space-y-3">
                        {aiResult.map((q, i) => <li key={i} className="leading-relaxed">{q}</li>)}
                      </ul>
                    ) : (
                      <div className="markdown-body prose prose-sm max-w-none prose-zinc">
                        <ReactMarkdown>{aiResult as string}</ReactMarkdown>
                      </div>
                    )}
                    
                    {aiAction === 'email' && (
                      <div className="mt-8 border-t border-border pt-6 space-y-4">
                        <Button 
                          className="w-full shadow-lg" 
                          size="lg"
                          onClick={async () => {
                            let optimizedResume = profile?.resumeText || '';
                            if (profile?.resumeText) {
                              toast.info('Generating tailored resume...');
                              optimizedResume = await tailorResume(selectedJob.title, selectedJob.description, profile.resumeText, profile?.antiSlopEnabled !== false);
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

                            const mailBody = encodeURIComponent(`${aiResult}\n\nJob URL: ${selectedJob.url}`);
                            window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=Application for ${selectedJob.title}&body=${mailBody}`, '_blank');
                          }}
                        >
                          <Mail className="mr-2 h-5 w-5" /> Open in Gmail with Tailored Resume
                        </Button>
                        <p className="text-sm text-foreground-muted text-center">
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
    </AnimatePresence>
  );
}
