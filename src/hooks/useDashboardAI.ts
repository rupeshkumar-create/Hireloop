import { useState } from 'react';
import { toast } from 'sonner';
import { Job } from '../types/dashboard';

export type AiActionType = 'email' | 'resume' | 'interview' | 'salary' | null;

export function useDashboardAI(profile: any) {
  const [aiAction, setAiAction] = useState<AiActionType>(null);
  const [aiResult, setAiResult] = useState<string | string[]>('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleAiAction = async (action: AiActionType, job: Job) => {
    setAiAction(action);
    setActionLoading(true);
    setAiResult('');

    try {
      // Dynamically import only the necessary functions
      const aiService = await import('../services/aiService');

      if (action === 'email') {
        const email = await aiService.generateColdEmail(job.title, job.company, profile?.resumeText || '', profile?.antiSlopEnabled !== false);
        setAiResult(email);
      } else if (action === 'resume') {
        const resume = await aiService.tailorResume(job.title, job.description, profile?.resumeText || '', profile?.antiSlopEnabled !== false);
        setAiResult(resume);
      } else if (action === 'interview') {
        const questions = await aiService.generateInterviewQuestions(job.title, job.company, profile?.antiSlopEnabled !== false);
        setAiResult(questions);
      } else if (action === 'salary') {
        const insights = await aiService.generateSalaryInsights(job.title, job.location);
        setAiResult(insights);
      }
    } catch (error: any) {
      if (error.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue using AI features.', { duration: 6000 });
      } else {
        toast.error(error.message || "Failed to generate AI content.");
      }
    }
    
    setActionLoading(false);
  };

  const downloadResume = (job: Job | null) => {
    if (!aiResult || typeof aiResult !== 'string') return;
    const blob = new Blob([aiResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tailored_Resume_${job?.company?.replace(/\\s+/g, '_') || 'Job'}.md`;
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
