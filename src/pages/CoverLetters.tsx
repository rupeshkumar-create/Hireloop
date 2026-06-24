import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Copy,
  FileDown,
  RefreshCw,
  Loader2,
  CheckCheck,
  MessageSquareText,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobsContext } from '../contexts/DashboardJobsContext';
import { useTrackedJobsList } from '../hooks/useTrackedJobsList';
import { generateCoverLetter } from '../services/aiService';
import { isProPlan } from '../lib/planLimits';
import { showProRequiredToast } from '../lib/proUpgrade';
import { ProFeatureOverlay } from '../components/ui/ProFeatureOverlay';
import { exportCoverLetterAsPdf } from '../lib/resumeExport';
import { updateTrackedJob } from '../services/trackedJobsService';

type RoleOption = {
  id: string;
  title: string;
  company: string;
  salary?: string;
  matchScore?: number;
  description?: string;
  source: 'pipeline' | 'match';
  coverLetter?: string;
};

function companyInitials(company: string): string {
  const parts = company.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return company.slice(0, 2).toUpperCase() || '??';
}

export function CoverLetters() {
  const { profile, user } = useAuth();
  const { filteredAndSortedJobs } = useDashboardJobsContext();
  const { trackedJobs, loadingTrackedJobs } = useTrackedJobsList(user?.uid);
  const [searchParams] = useSearchParams();

  const roleOptions = useMemo((): RoleOption[] => {
    const pipeline: RoleOption[] = trackedJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      salary: j.salary,
      matchScore: j.matchScore ?? j.finalScore,
      description: j.notes,
      source: 'pipeline',
      coverLetter: j.coverLetter,
    }));
    const matches: RoleOption[] = filteredAndSortedJobs.slice(0, 6).map((j) => ({
      id: j.id || j.fingerprint,
      title: j.title,
      company: j.company,
      salary: j.salary,
      matchScore: j.matchScore || j.finalScore,
      description: j.description,
      source: 'match',
    }));
    return [...pipeline, ...matches];
  }, [trackedJobs, filteredAndSortedJobs]);

  const [selectedId, setSelectedId] = useState<string>('');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get('jobId');
    if (fromUrl && roleOptions.some((r) => r.id === fromUrl)) {
      setSelectedId(fromUrl);
      const job = roleOptions.find((r) => r.id === fromUrl);
      if (job?.coverLetter) setGeneratedLetter(job.coverLetter);
      else setGeneratedLetter('');
      return;
    }
    if (!selectedId && roleOptions[0]) setSelectedId(roleOptions[0].id);
  }, [searchParams, roleOptions, selectedId]);

  const selectedJob = roleOptions.find((r) => r.id === selectedId) ?? roleOptions[0];
  const name = profile?.displayName || 'Your Name';

  const persistCoverLetter = async (job: RoleOption, letter: string) => {
    if (job.source !== 'pipeline' || !user?.uid) return;
    await updateTrackedJob(job.id, user.uid, {
      coverLetter: letter,
      updatedAt: new Date().toISOString(),
    });
  };

  const generate = useCallback(async () => {
    if (!isProPlan(profile?.plan)) {
      showProRequiredToast('Upgrade to Pro to generate cover letters.');
      return;
    }
    if (!selectedJob) {
      toast.error('Save a role to Pipeline or run Scout first.');
      return;
    }
    setIsGenerating(true);
    try {
      const letter = await generateCoverLetter(
        selectedJob.title,
        selectedJob.company,
        profile?.resumeText || '',
        profile?.antiSlopEnabled !== false,
        profile?.learningProfile?.writingStyle,
        selectedJob.description || ''
      );
      setGeneratedLetter(letter);
      if (selectedJob.source === 'pipeline') {
        await persistCoverLetter(selectedJob, letter);
        toast.success('Saved to Pipeline');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message === 'AI_PRO_REQUIRED') showProRequiredToast('Upgrade to Pro to generate cover letters.');
      else if (message === 'AI_QUOTA_EXCEEDED') toast.error('AI quota exceeded.', { duration: 6000 });
      else toast.error(message || 'Failed to generate cover letter.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedJob, profile]);

  const fullLetterText = generatedLetter
    ? `Dear ${selectedJob?.company || 'Hiring Team'} Hiring Team,\n\n${generatedLetter}\n\nBest regards,\n${name}`
    : '';

  const handleCopy = async () => {
    if (!fullLetterText) return;
    await navigator.clipboard.writeText(fullLetterText);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = async () => {
    if (!generatedLetter || !selectedJob) return;
    try {
      await exportCoverLetterAsPdf({
        jobTitle: selectedJob.title,
        company: selectedJob.company,
        candidateName: name,
        letterBody: generatedLetter,
        baseFilename: `Cover_Letter_${selectedJob.company.replace(/\s+/g, '_')}`,
      });
    } catch {
      toast.error('PDF export failed.');
    }
  };

  const pipelineCount = trackedJobs.length;

  return (
    <div className="hs-view">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <div className="hs-label mb-2">Advanced AI · Linked to saved jobs</div>
          <h1 className="hs-section-title">Cover Letters</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--hs-app-muted)]">
            Pipeline roles appear first. Generate a 4-paragraph letter grounded in your resume and job description — then download PDF.
          </p>
        </div>
        {roleOptions.length > 0 && (
          <div className="rounded-full border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] px-3 py-1.5 font-mono text-[11px] text-[var(--hs-app-muted)]">
            {pipelineCount} saved · {roleOptions.length} roles
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-start">
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <div>
            <div className="hs-label mb-3">Select a role</div>
            {loadingTrackedJobs && roleOptions.length === 0 ? (
              <div className="text-sm text-[var(--hs-app-muted)]">Loading saved jobs…</div>
            ) : roleOptions.length > 0 ? (
              <div className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1">
                {roleOptions.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <button
                      key={`${item.source}-${item.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setGeneratedLetter(item.coverLetter || '');
                      }}
                      className={`w-full rounded-lg border p-3.5 text-left transition-all duration-200 ${
                        active
                          ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent-subtle)] shadow-[0_0_0_1px_var(--hs-app-accent)]'
                          : 'border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] hover:border-[var(--hs-app-border-strong)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="hs-company-mark mt-0.5 h-9 w-9 shrink-0 text-[11px]">
                          {companyInitials(item.company)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[13px] font-semibold leading-snug">{item.title}</div>
                          <div className="mt-1 text-[12px] text-[var(--hs-app-muted)]">{item.company}</div>
                          <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-[var(--hs-app-muted)]">
                            {item.source === 'pipeline' ? 'Pipeline' : "Today's match"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-5 text-sm text-[var(--hs-app-muted)]">
                <p>Save roles from your dashboard to Pipeline, then generate letters here.</p>
                <Link to="/jobs" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--hs-app-accent)] hover:underline">
                  Open Pipeline <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {roleOptions.length > 0 && (
            <button
              type="button"
              className="hs-btn hs-btn-primary w-full justify-center py-2.5"
              onClick={generate}
              disabled={isGenerating || !isProPlan(profile?.plan)}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {generatedLetter ? 'Regenerate letter' : 'Generate letter'}
            </button>
          )}
        </aside>

        <section className="relative flex min-h-[560px] flex-col">
          {!isProPlan(profile?.plan) ? <ProFeatureOverlay message="Cover letters are a Pro feature" /> : null}
          <div className="hs-block flex min-h-[560px] flex-1 flex-col">
            <div className="hs-block-header flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-[16px] font-semibold">{selectedJob?.title || 'Cover letter preview'}</div>
                <p className="mt-0.5 truncate text-[12px] text-[var(--hs-app-muted)]">{selectedJob?.company || 'Select a role'}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="hs-btn" onClick={handleCopy} disabled={!generatedLetter}>
                  {copied ? <CheckCheck className="h-3.5 w-3.5 text-[var(--hs-app-success)]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" className="hs-btn hs-btn-primary" onClick={handleExportPdf} disabled={!generatedLetter}>
                  <FileDown className="h-3.5 w-3.5" />
                  Download PDF
                </button>
              </div>
            </div>
            <div className="relative flex flex-1 flex-col bg-[var(--hs-app-bg)]">
              {isGenerating ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-accent)]" />
                  <p className="text-sm text-[var(--hs-app-muted)]">Writing advanced cover letter…</p>
                </div>
              ) : generatedLetter ? (
                <div className="flex flex-1 justify-center overflow-y-auto p-6 md:p-8">
                  <article className="w-full max-w-[680px] rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] px-8 py-10 shadow-sm md:px-12 md:py-12">
                    <div className="space-y-5 text-[15px] leading-[1.75] text-[var(--hs-app-fg)]">
                      <p>Dear {selectedJob?.company || 'Hiring Team'} Hiring Team,</p>
                      {generatedLetter.split(/\n\n+/).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                      <p>
                        Best regards,
                        <br />
                        <strong>{name}</strong>
                      </p>
                    </div>
                  </article>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <MessageSquareText className="mb-4 h-10 w-10 text-[var(--hs-app-muted)]" />
                  <p className="text-sm text-[var(--hs-app-muted)]">Select a Pipeline role or today's match, then generate.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
