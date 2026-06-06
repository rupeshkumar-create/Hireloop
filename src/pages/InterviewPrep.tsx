import React, { useState, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { generateInterviewQuestions } from '../services/aiService';
import { isProPlan } from '../lib/planLimits';
import { showProRequiredToast } from '../lib/proUpgrade';
import { ProFeatureOverlay } from '../components/ui/ProFeatureOverlay';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function InterviewPrep() {
  const { user, profile, updateProfile } = useAuth();
  const { filteredAndSortedJobs } = useDashboardJobs(user, profile, updateProfile);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [questions, setQuestions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const selectedJob = filteredAndSortedJobs[selectedIndex];

  const generate = useCallback(async () => {
    if (!isProPlan(profile?.plan)) {
      showProRequiredToast('Upgrade to Pro to generate interview prep.');
      return;
    }
    const job = selectedJob || { title: profile?.careerPaths?.[0] || 'the role', company: 'the company' };
    setIsGenerating(true);
    setQuestions('');
    try {
      const result = await generateInterviewQuestions(
        job.title,
        job.company,
        profile?.antiSlopEnabled !== false
      );
      setQuestions(result);
    } catch (e: any) {
      if (e.message === 'AI_PRO_REQUIRED') {
        showProRequiredToast('Upgrade to Pro to generate interview prep.');
      } else if (e.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI quota exceeded. Please add credits to your OpenRouter account.', { duration: 6000 });
      } else {
        toast.error(e?.message || 'Failed to generate interview questions.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [selectedJob, profile]);

  return (
    <div className="hs-view">
      <div className="mb-6">
        <div className="hs-label mb-2">AI-generated · Based on your resume + job description</div>
        <h1 className="hs-section-title">Interview Prep</h1>
      </div>

      <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside>
          <div className="hs-label mb-3">Roles to prep</div>
          <div className="space-y-2">
            {(filteredAndSortedJobs.length
              ? filteredAndSortedJobs.slice(0, 4)
              : [{ id: 'sample', title: profile?.careerPaths?.[0] || 'Your Target Role', company: 'Sample role', matchScore: 0 }]
            ).map((job, index) => (
              <button
                key={job.id}
                type="button"
                onClick={() => { setSelectedIndex(index); setQuestions(''); }}
                className={`w-full rounded-md border p-4 text-left transition ${
                  index === selectedIndex
                    ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent-subtle)]'
                    : 'border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] hover:bg-[var(--hs-app-bg)]'
                }`}
              >
                <div className="text-[13px] font-semibold">{job.title}</div>
                <div className="mt-1 text-[11px] text-[var(--hs-app-muted)]">{job.company}</div>
                <div className="mt-2 font-mono text-[10px] text-[var(--hs-app-muted)]">
                  {index === selectedIndex ? 'Active prep set' : 'Ready'}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="hs-btn hs-btn-primary mt-5 w-full justify-center"
            onClick={generate}
            disabled={isGenerating || !isProPlan(profile?.plan)}
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {questions ? 'Regenerate' : 'Generate questions'}
          </button>
        </aside>

        <main className="relative">
          {!isProPlan(profile?.plan) ? (
            <ProFeatureOverlay message="Interview prep is a Pro feature" />
          ) : null}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedJob?.company || 'Sample'} — Interview Q&A
              </h2>
              <p className="text-xs text-[var(--hs-app-muted)]">
                Questions tuned to your resume and this role.
              </p>
            </div>
            <span className="font-mono text-[10px] text-[var(--hs-app-muted)]">Round: Screen</span>
          </div>

          {isGenerating ? (
            <div className="hs-block flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-muted)]" />
              <p className="text-sm text-[var(--hs-app-muted)]">Generating questions for this role…</p>
            </div>
          ) : questions ? (
            <div className="hs-block">
              <div className="markdown-body px-6 py-5 text-sm leading-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{questions}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="hs-block py-14 text-center text-sm text-[var(--hs-app-muted)]">
              Click "Generate questions" to get 5 AI-tailored interview questions with suggested answers.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
