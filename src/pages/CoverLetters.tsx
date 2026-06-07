import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import { generateCoverLetter } from '../services/aiService';
import { isProPlan } from '../lib/planLimits';
import { showProRequiredToast } from '../lib/proUpgrade';
import { ProFeatureOverlay } from '../components/ui/ProFeatureOverlay';

function companyInitials(company: string): string {
  const parts = company.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return company.slice(0, 2).toUpperCase() || '??';
}

export function CoverLetters() {
  const { profile } = useAuth();
  const { filteredAndSortedJobs } = useDashboardJobsContext();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const jobs = filteredAndSortedJobs.slice(0, 8);
  const selectedJob = jobs[selectedIndex];
  const name = profile?.displayName || 'Your Name';

  const generate = useCallback(async () => {
    if (!isProPlan(profile?.plan)) {
      showProRequiredToast('Upgrade to Pro to generate cover letters.');
      return;
    }
    if (!selectedJob && jobs.length === 0) {
      toast.error('Generate daily jobs first, then come back here.');
      return;
    }
    const job = selectedJob || { title: profile?.careerPaths?.[0] || 'the role', company: 'the company' };
    setIsGenerating(true);
    try {
      const letter = await generateCoverLetter(
        job.title,
        job.company,
        profile?.resumeText || '',
        profile?.antiSlopEnabled !== false,
      );
      setGeneratedLetter(letter);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message === 'AI_PRO_REQUIRED') {
        showProRequiredToast('Upgrade to Pro to generate cover letters.');
      } else if (message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI quota exceeded. Please add credits to your OpenRouter account.', { duration: 6000 });
      } else {
        toast.error(message || 'Failed to generate cover letter.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [selectedJob, jobs.length, profile]);

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

  const handleExport = () => {
    if (!fullLetterText) return;
    const blob = new Blob([fullLetterText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cover_Letter_${selectedJob?.company?.replace(/\s+/g, '_') || 'Draft'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateLabel = generatedLetter ? 'Regenerate letter' : 'Generate letter';

  return (
    <div className="hs-view">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <div className="hs-label mb-2">AI-generated · Grounded in your resume</div>
          <h1 className="hs-section-title">Cover Letters</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--hs-app-muted)]">
            Pick a matched role, generate a tailored letter, then copy or export — one click.
          </p>
        </div>
        {jobs.length > 0 && (
          <div className="rounded-full border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] px-3 py-1.5 font-mono text-[11px] text-[var(--hs-app-muted)]">
            {jobs.length} role{jobs.length === 1 ? '' : 's'} ready
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-start">
        {/* Role picker */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <div>
            <div className="hs-label mb-3">Select a role</div>
            {jobs.length > 0 ? (
              <div className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1">
                {jobs.map((item, index) => {
                  const active = index === selectedIndex;
                  const score = item.matchScore || item.finalScore;
                  return (
                    <button
                      key={item.id || item.fingerprint}
                      type="button"
                      onClick={() => {
                        setSelectedIndex(index);
                        setGeneratedLetter('');
                      }}
                      className={`w-full rounded-lg border p-3.5 text-left transition-all duration-200 ${
                        active
                          ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent-subtle)] shadow-[0_0_0_1px_var(--hs-app-accent)]'
                          : 'border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] hover:border-[var(--hs-app-border-strong)] hover:bg-[var(--hs-app-bg)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="hs-company-mark mt-0.5 h-9 w-9 shrink-0 text-[11px]">
                          {companyInitials(item.company)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--hs-app-fg)]">
                            {item.title}
                          </div>
                          <div className="mt-1 text-[12px] text-[var(--hs-app-muted)]">{item.company}</div>
                          {item.salary ? (
                            <div className="mt-1.5 inline-block rounded border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--hs-app-muted)]">
                              {item.salary}
                            </div>
                          ) : null}
                        </div>
                        {score != null && score > 0 ? (
                          <span className="shrink-0 rounded-md bg-[var(--hs-app-bg)] px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-[var(--hs-app-accent)]">
                            {score}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-5 text-sm leading-relaxed text-[var(--hs-app-muted)]">
                <p>No matched roles yet.</p>
                <Link
                  to="/dashboard"
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--hs-app-accent)] hover:underline"
                >
                  Run Scout on Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {jobs.length > 0 && (
            <button
              type="button"
              className="hs-btn hs-btn-primary w-full justify-center py-2.5"
              onClick={generate}
              disabled={isGenerating || !isProPlan(profile?.plan)}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {generateLabel}
            </button>
          )}
        </aside>

        {/* Letter workspace */}
        <section className="relative flex min-h-[560px] flex-col">
          {!isProPlan(profile?.plan) ? (
            <ProFeatureOverlay message="Cover letters are a Pro feature" />
          ) : null}

          <div className="hs-block flex min-h-[560px] flex-1 flex-col">
            <div className="hs-block-header flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-[16px] font-semibold leading-snug">
                  {selectedJob ? selectedJob.title : 'Cover letter preview'}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-[var(--hs-app-muted)]">
                  {selectedJob
                    ? `${selectedJob.company}${selectedJob.salary ? ` · ${selectedJob.salary}` : ''}`
                    : 'Select a role from the list'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="hs-btn"
                  onClick={handleCopy}
                  disabled={!generatedLetter}
                >
                  {copied ? (
                    <CheckCheck className="h-3.5 w-3.5 text-[var(--hs-app-success)]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="hs-btn hs-btn-primary"
                  onClick={handleExport}
                  disabled={!generatedLetter}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col bg-[var(--hs-app-bg)]">
              {isGenerating ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)]">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-accent)]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Writing your cover letter</p>
                    <p className="mt-1 text-xs text-[var(--hs-app-muted)]">
                      Grounding in your resume for {selectedJob?.company || 'this role'}…
                    </p>
                  </div>
                </div>
              ) : generatedLetter ? (
                <div className="flex flex-1 justify-center overflow-y-auto p-6 md:p-8">
                  <article className="w-full max-w-[680px] rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] px-8 py-10 shadow-sm md:px-12 md:py-12">
                    <header className="mb-8 border-b border-[var(--hs-app-border)] pb-6">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--hs-app-muted)]">
                        Cover letter draft
                      </p>
                      <p className="mt-2 text-sm text-[var(--hs-app-muted)]">{name}</p>
                    </header>
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
              ) : jobs.length > 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)]">
                    <MessageSquareText className="h-6 w-6 text-[var(--hs-app-muted)]" />
                  </div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">
                    Ready to draft for {selectedJob?.company || 'this role'}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--hs-app-muted)]">
                    HireSchema pulls highlights from your resume and matches them to the job description — no generic filler.
                  </p>
                  <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-[13px] text-[var(--hs-app-muted)]">
                    <li className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--hs-app-accent)]" />
                      Opens with a role-specific hook tied to {selectedJob?.company || 'the company'}
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--hs-app-accent)]" />
                      Maps your experience to their requirements
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-3.5 shrink-0 text-[var(--hs-app-accent)]" />
                      Closes with a clear, professional call to action
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="hs-btn hs-btn-primary mt-8 justify-center px-6"
                    onClick={generate}
                    disabled={!isProPlan(profile?.plan)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {generateLabel}
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                  <p className="text-sm text-[var(--hs-app-muted)]">
                    Run Scout on your dashboard to get matched roles, then return here to draft letters.
                  </p>
                  <Link to="/dashboard" className="hs-btn hs-btn-primary mt-6">
                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
