import React, { useState, useCallback } from 'react';
import { Copy, FileDown, RefreshCw, Loader2, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { generateCoverLetter } from '../services/aiService';
import { isProPlan } from '../lib/planLimits';
import { showProRequiredToast } from '../lib/proUpgrade';
import { ProFeatureOverlay } from '../components/ui/ProFeatureOverlay';

export function CoverLetters() {
  const { user, profile, updateProfile } = useAuth();
  const { filteredAndSortedJobs } = useDashboardJobs(user, profile, updateProfile);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedJob = filteredAndSortedJobs[selectedIndex];
  const name = profile?.displayName || 'Your Name';

  const generate = useCallback(async () => {
    if (!isProPlan(profile?.plan)) {
      showProRequiredToast('Upgrade to Pro to generate cover letters.');
      return;
    }
    if (!selectedJob && filteredAndSortedJobs.length === 0) {
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
    } catch (e: any) {
      if (e.message === 'AI_PRO_REQUIRED') {
        showProRequiredToast('Upgrade to Pro to generate cover letters.');
      } else if (e.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI quota exceeded. Please add credits to your OpenRouter account.', { duration: 6000 });
      } else {
        toast.error(e?.message || 'Failed to generate cover letter.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [selectedJob, filteredAndSortedJobs.length, profile]);

  const handleCopy = async () => {
    if (!generatedLetter) return;
    const full = `Dear ${selectedJob?.company || 'Hiring Team'} Hiring Team,\n\n${generatedLetter}\n\nBest regards,\n${name}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!generatedLetter) return;
    const full = `Dear ${selectedJob?.company || 'Hiring Team'} Hiring Team,\n\n${generatedLetter}\n\nBest regards,\n${name}`;
    const blob = new Blob([full], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cover_Letter_${selectedJob?.company?.replace(/\s+/g, '_') || 'Draft'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="hs-view">
      <div className="mb-6">
        <div className="hs-label mb-2">AI-generated · Grounded in your resume</div>
        <h1 className="hs-section-title">Cover Letters</h1>
      </div>

      <div className="grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
          <div className="hs-label mb-3">Select a role</div>
          <div className="space-y-2">
            {filteredAndSortedJobs.length > 0 ? (
              filteredAndSortedJobs.slice(0, 5).map((item, index) => (
                <button
                  key={item.id || item.fingerprint}
                  type="button"
                  onClick={() => { setSelectedIndex(index); setGeneratedLetter(''); }}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition ${
                    index === selectedIndex
                      ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent-subtle)]'
                      : 'border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] hover:bg-[var(--hs-app-bg)]'
                  }`}
                >
                  <span className="hs-company-mark h-6 w-6">{item.company.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{item.title}</div>
                    <div className="truncate text-[11px] text-[var(--hs-app-muted)]">{item.company} · {item.salary || 'salary not listed'}</div>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[var(--hs-app-accent)]">{item.matchScore || item.finalScore}</span>
                </button>
              ))
            ) : (
              <div className="hs-page-card text-sm text-[var(--hs-app-muted)]">
                Generate daily jobs first, then Hireschema can draft letters from real listings.
              </div>
            )}
          </div>

          {filteredAndSortedJobs.length > 0 && (
            <button
              type="button"
              className="hs-btn hs-btn-primary mt-5 w-full justify-center"
              onClick={generate}
              disabled={isGenerating || !isProPlan(profile?.plan)}
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {generatedLetter ? 'Regenerate' : 'Generate letter'}
            </button>
          )}
        </aside>

        <section className="relative hs-block">
          {!isProPlan(profile?.plan) ? (
            <ProFeatureOverlay message="Cover letters are a Pro feature" />
          ) : null}
          <div className="hs-block-header">
            <div className="font-display text-[16px] font-semibold">
              Cover Letter — {selectedJob?.company || 'Select a role'}
            </div>
            <div className="flex gap-2">
              <button type="button" className="hs-btn" onClick={handleCopy} disabled={!generatedLetter}>
                {copied ? <CheckCheck className="h-3.5 w-3.5 text-[var(--hs-app-success)]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" className="hs-btn hs-btn-primary" onClick={handleExport} disabled={!generatedLetter}>
                <FileDown className="h-3.5 w-3.5" />Export
              </button>
            </div>
          </div>

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-muted)]" />
              <p className="text-sm text-[var(--hs-app-muted)]">Writing your cover letter…</p>
            </div>
          ) : (
            <div className="space-y-5 px-10 py-9 text-sm leading-8">
              {generatedLetter ? (
                <>
                  <p>Dear {selectedJob?.company || 'Hiring Team'} Hiring Team,</p>
                  {generatedLetter.split(/\n\n+/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                  <p>Best regards,<br /><strong>{name}</strong></p>
                </>
              ) : (
                <div className="py-10 text-center text-sm text-[var(--hs-app-muted)]">
                  {filteredAndSortedJobs.length > 0
                    ? 'Click "Generate letter" to create a personalised cover letter for the selected role.'
                    : 'Run Scout to get job matches, then generate a tailored cover letter here.'}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
