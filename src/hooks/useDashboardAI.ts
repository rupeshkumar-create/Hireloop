import { useState } from 'react';
import { toast } from 'sonner';
import { showProRequiredToast } from '../lib/proUpgrade';
import { Job } from '../types/dashboard';
import { useAuth } from '../contexts/AuthContext';

export type AiActionType = 'email' | 'resume' | 'interview' | 'salary' | null;

export function useDashboardAI(profile: any) {
  const [aiAction, setAiAction] = useState<AiActionType>(null);
  const [aiResult, setAiResult] = useState<string | string[]>('');
  const [actionLoading, setActionLoading] = useState(false);
  const { profile: ctxProfile, updateProfile } = useAuth();

  const markActivatedIfNeeded = async () => {
    if (ctxProfile?.activatedAt) return;
    try {
      await updateProfile({ activatedAt: new Date().toISOString() });
    } catch {
      // Non-blocking — activation is best-effort telemetry.
    }
  };

  const handleAiAction = async (action: AiActionType, job: Job) => {
    setAiAction(action);
    setActionLoading(true);
    setAiResult('');

    if (!profile?.resumeText?.trim() && (action === 'email' || action === 'resume')) {
      toast.error('Add your resume in Settings or Resume Profile before using AI Copilot.');
      setActionLoading(false);
      setAiAction(null);
      return;
    }

    try {
      // Dynamically import only the necessary functions
      const aiService = await import('../services/aiService');

      if (action === 'email') {
        const email = await aiService.generateColdEmail(job.title, job.company, profile?.resumeText || '', profile?.antiSlopEnabled !== false);
        setAiResult(email);
        void markActivatedIfNeeded();
      } else if (action === 'resume') {
        const resume = await aiService.tailorResume(job.title, job.description, profile?.resumeText || '', profile?.antiSlopEnabled !== false);
        setAiResult(resume);
        void markActivatedIfNeeded();
      } else if (action === 'interview') {
        const questions = await aiService.generateInterviewQuestions(job.title, job.company, profile?.antiSlopEnabled !== false);
        const hasQuestions =
          (Array.isArray(questions) && questions.length > 0) ||
          (typeof questions === 'string' && questions.trim().length > 0);

        if (!hasQuestions) {
          throw new Error('Interview Q/A could not be generated for this job.');
        }

        setAiResult(questions);
        void markActivatedIfNeeded();
      } else if (action === 'salary') {
        const insights = await aiService.generateSalaryInsights(job.title, job.location, profile?.antiSlopEnabled !== false);
        setAiResult(insights);
        void markActivatedIfNeeded();
      }
    } catch (error: any) {
      if (error.message === 'AI_PRO_REQUIRED') {
        showProRequiredToast('Upgrade to Pro to use AI Copilot features.');
      } else if (error.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue using AI features.', { duration: 6000 });
      } else if (action === 'interview') {
        toast.error(error.message || 'Failed to generate interview Q/A.');
      } else {
        toast.error(error.message || "Failed to generate AI content.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const downloadResume = (job: Job | null) => {
    if (!aiResult || typeof aiResult !== 'string') return;
    const blob = new Blob([aiResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tailored_Resume_${job?.company?.replace(/\s+/g, '_') || 'Job'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Resume downloaded successfully!");
  };

  return {
    aiAction, setAiAction,
    aiResult, setAiResult,
    actionLoading,
    handleAiAction,
    downloadResume
  };
}
