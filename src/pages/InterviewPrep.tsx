import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, FileDown, Copy, CheckCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobsContext } from '../contexts/DashboardJobsContext';
import { useTrackedJobsList } from '../hooks/useTrackedJobsList';
import { generateInterviewQuestions } from '../services/aiService';
import { isProPlan } from '../lib/planLimits';
import { showProRequiredToast } from '../lib/proUpgrade';
import { ProFeatureOverlay } from '../components/ui/ProFeatureOverlay';
import { exportInterviewPrepAsPdf } from '../lib/resumeExport';
import { db } from '../firebase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type RoleOption = {
  id: string;
  title: string;
  company: string;
  description?: string;
  source: 'pipeline' | 'match';
  interviewQuestions?: string | string[];
};

export function InterviewPrep() {
  const { profile, user } = useAuth();
  const { filteredAndSortedJobs } = useDashboardJobsContext();
  const { trackedJobs, loadingTrackedJobs } = useTrackedJobsList(user?.uid);
  const [searchParams] = useSearchParams();

  const roleOptions = useMemo((): RoleOption[] => {
    const pipeline: RoleOption[] = trackedJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      description: j.notes,
      source: 'pipeline',
      interviewQuestions: j.interviewQuestions,
    }));
    const matches: RoleOption[] = filteredAndSortedJobs.slice(0, 6).map((j) => ({
      id: j.id || j.fingerprint,
      title: j.title,
      company: j.company,
      description: j.description,
      source: 'match',
    }));
    return [...pipeline, ...matches];
  }, [trackedJobs, filteredAndSortedJobs]);

  const [selectedId, setSelectedId] = useState('');
  const [questions, setQuestions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get('jobId');
    if (fromUrl && roleOptions.some((r) => r.id === fromUrl)) {
      setSelectedId(fromUrl);
      const job = roleOptions.find((r) => r.id === fromUrl);
      const existing = job?.interviewQuestions;
      if (typeof existing === 'string') setQuestions(existing);
      else if (Array.isArray(existing)) setQuestions(existing.join('\n\n'));
      else setQuestions('');
      return;
    }
    if (!selectedId && roleOptions[0]) setSelectedId(roleOptions[0].id);
  }, [searchParams, roleOptions, selectedId]);

  const selectedJob = roleOptions.find((r) => r.id === selectedId) ?? roleOptions[0];

  const persistInterview = async (job: RoleOption, content: string) => {
    if (job.source !== 'pipeline') return;
    await updateDoc(doc(db, 'trackedJobs', job.id), {
      interviewQuestions: content,
      updatedAt: new Date().toISOString(),
    });
  };

  const generate = useCallback(async () => {
    if (!isProPlan(profile?.plan)) {
      showProRequiredToast('Upgrade to Pro to generate interview prep.');
      return;
    }
    if (!selectedJob) {
      toast.error('Save a role to Pipeline or run Scout first.');
      return;
    }
    setIsGenerating(true);
    setQuestions('');
    try {
      const result = await generateInterviewQuestions(
        selectedJob.title,
        selectedJob.company,
        profile?.antiSlopEnabled !== false,
        profile?.resumeText || '',
        selectedJob.description || ''
      );
      setQuestions(result);
      if (selectedJob.source === 'pipeline') {
        await persistInterview(selectedJob, result);
        toast.success('Saved to Pipeline');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message === 'AI_PRO_REQUIRED') showProRequiredToast('Upgrade to Pro.');
      else if (message === 'AI_QUOTA_EXCEEDED') toast.error('AI quota exceeded.', { duration: 6000 });
      else toast.error(message || 'Failed to generate interview prep.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedJob, profile]);

  const handleCopy = async () => {
    if (!questions) return;
    await navigator.clipboard.writeText(questions);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePdf = async () => {
    if (!questions || !selectedJob) return;
    try {
      await exportInterviewPrepAsPdf({
        jobTitle: selectedJob.title,
        company: selectedJob.company,
        questions,
        baseFilename: `Interview_Prep_${selectedJob.company.replace(/\s+/g, '_')}`,
      });
    } catch {
      toast.error('PDF export failed.');
    }
  };

  return (
    <div className="hs-view">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="hs-label mb-2">Advanced pack · Multi-round prep</div>
          <h1 className="hs-section-title">Interview Prep</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--hs-app-muted)]">
            8-section prep: recruiter, manager, technical, STAR stories, questions to ask, and a 48h checklist — linked to Pipeline jobs.
          </p>
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
          <div className="hs-label mb-3">Saved & matched roles</div>
          {loadingTrackedJobs && roleOptions.length === 0 ? (
            <p className="text-sm text-[var(--hs-app-muted)]">Loading…</p>
          ) : roleOptions.length > 0 ? (
            <div className="space-y-2">
              {roleOptions.map((job) => (
                <button
                  key={`${job.source}-${job.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedId(job.id);
                    const existing = job.interviewQuestions;
                    if (typeof existing === 'string') setQuestions(existing);
                    else if (Array.isArray(existing)) setQuestions(existing.join('\n\n'));
                    else setQuestions('');
                  }}
                  className={`w-full rounded-md border p-4 text-left transition ${
                    job.id === selectedId
                      ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent-subtle)]'
                      : 'border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] hover:bg-[var(--hs-app-bg)]'
                  }`}
                >
                  <div className="text-[13px] font-semibold">{job.title}</div>
                  <div className="mt-1 text-[11px] text-[var(--hs-app-muted)]">{job.company}</div>
                  <div className="mt-2 font-mono text-[10px] text-[var(--hs-app-muted)]">
                    {job.source === 'pipeline' ? 'Pipeline' : "Today's match"}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--hs-app-muted)]">
              <p>No roles yet.</p>
              <Link to="/jobs" className="mt-2 inline-flex items-center gap-1 text-[var(--hs-app-accent)] hover:underline">
                Pipeline <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {roleOptions.length > 0 && (
            <button
              type="button"
              className="hs-btn hs-btn-primary mt-5 w-full justify-center"
              onClick={generate}
              disabled={isGenerating || !isProPlan(profile?.plan)}
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {questions ? 'Regenerate pack' : 'Generate prep pack'}
            </button>
          )}
        </aside>

        <main className="relative">
          {!isProPlan(profile?.plan) ? <ProFeatureOverlay message="Interview prep is a Pro feature" /> : null}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selectedJob?.company || 'Role'} — Interview pack</h2>
              <p className="text-xs text-[var(--hs-app-muted)]">{selectedJob?.title}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="hs-btn" onClick={handleCopy} disabled={!questions}>
                {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </button>
              <button type="button" className="hs-btn hs-btn-primary" onClick={handlePdf} disabled={!questions}>
                <FileDown className="h-3.5 w-3.5" />
                Download PDF
              </button>
            </div>
          </div>

          {isGenerating ? (
            <div className="hs-block flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-muted)]" />
              <p className="text-sm text-[var(--hs-app-muted)]">Building multi-round prep…</p>
            </div>
          ) : questions ? (
            <div className="hs-block">
              <div className="markdown-body px-6 py-5 text-sm leading-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{questions}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="hs-block py-14 text-center text-sm text-[var(--hs-app-muted)]">
              Select a Pipeline job or generate from a saved role.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
