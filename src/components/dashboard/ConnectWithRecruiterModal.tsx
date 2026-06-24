import React, { useEffect, useState } from 'react';
import { ExternalLink, Linkedin, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { RecruiterContact } from '../../types/recruiter';
import {
  linkedInConnectUrl,
  previewConnectionRequest,
  sendConnectionRequest,
} from '../../services/connectionService';

type ConnectJob = { title: string; company: string; url?: string; applyUrl?: string };

interface ConnectWithRecruiterModalProps {
  job: ConnectJob;
  profile: any;
  open: boolean;
  onClose: () => void;
  trackedJobId?: string;
  onIntroSent?: (recruiterName: string, narration?: string, warmIntro?: boolean) => void;
}

export function ConnectWithRecruiterModal({
  job,
  profile,
  open,
  onClose,
  trackedJobId,
  onIntroSent,
}: ConnectWithRecruiterModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recruiter, setRecruiter] = useState<RecruiterContact | null>(null);
  const [narration, setNarration] = useState('');
  const [warmIntro, setWarmIntro] = useState(false);
  const [introMessage, setIntroMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setRecruiter(null);
    setNarration('');
    setPreviewLoading(true);
    previewConnectionRequest({ company: job.company, jobTitle: job.title })
      .then((preview) => {
        setRecruiter(preview.recruiter);
        setNarration(preview.narration);
        setWarmIntro(preview.warmIntro);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Could not prepare introduction');
      })
      .finally(() => setPreviewLoading(false));
  }, [open, job.company, job.title]);

  if (!open) return null;

  const handleConnect = async () => {
    setLoading(true);
    try {
      const result = await sendConnectionRequest({
        company: job.company,
        jobTitle: job.title,
        jobUrl: job.url || job.applyUrl,
        trackedJobId,
        introMessage: introMessage.trim() || undefined,
        recruiter: recruiter || undefined,
        candidateAccepted: true,
      });

      setSent(true);
      setEmailSent(result.emailSent);
      onIntroSent?.(result.recruiter.name, result.narration || narration, result.warmIntro ?? warmIntro);
      if (result.emailSent) {
        toast.success(`Introduction sent to ${result.recruiter.name}`);
      } else if (result.recruiter.linkedinUrl) {
        toast.success('Intro saved — open LinkedIn to connect');
      } else {
        toast.success('Introduction saved');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send introduction');
    } finally {
      setLoading(false);
    }
  };

  const linkedinHref = linkedInConnectUrl(recruiter?.linkedinUrl);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
              Jack made an introduction
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              {job.title} · {job.company}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-foreground-muted hover:text-foreground">
            Close
          </button>
        </div>

        {!sent ? (
          <div className="mt-5 space-y-4">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-foreground-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Jack is finding the right contact…
              </div>
            ) : (
              <>
                {narration ? (
                  <div className="rounded-xl border border-[var(--hs-app-accent)]/30 bg-[var(--hs-app-accent-soft)] p-4 text-sm text-foreground">
                    {narration}
                    {warmIntro ? (
                      <p className="mt-2 text-xs font-medium text-[var(--hs-app-accent)]">
                        Warm intro via Jill network · Skipped application
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {recruiter ? (
                  <div className="rounded-xl border border-border bg-background p-4 text-sm">
                    <p className="font-medium text-foreground">{recruiter.name}</p>
                    <p className="text-foreground-muted">{recruiter.title}</p>
                    {recruiter.email ? <p className="mt-1 text-foreground-muted">{recruiter.email}</p> : null}
                    {recruiter.linkedinUrl ? (
                      <a
                        href={recruiter.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[var(--hs-app-accent)] hover:underline"
                      >
                        <Linkedin className="h-3.5 w-3.5" /> View LinkedIn
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-muted">
                Optional note for the hiring manager
              </label>
              <textarea
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                rows={3}
                placeholder="One line on why this role fits you…"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading || previewLoading || !recruiter}
                className="hs-btn hs-btn-primary flex-1 justify-center"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Accept introduction
              </button>
              {linkedinHref ? (
                <a href={linkedinHref} target="_blank" rel="noreferrer" className="hs-btn justify-center">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[var(--hs-app-accent)]/30 bg-[var(--hs-app-accent-soft)] p-4 text-sm">
              <p className="font-medium text-foreground">Introduction accepted</p>
              <p className="mt-1 text-foreground-muted">
                {emailSent
                  ? `${recruiter?.name || 'The hiring manager'} received Jack's intro with your background.`
                  : 'Your intro is saved. Open LinkedIn to connect directly if email was unavailable.'}
              </p>
            </div>
            {linkedinHref ? (
              <a href={linkedinHref} target="_blank" rel="noreferrer" className="hs-btn w-full justify-center">
                <ExternalLink className="h-4 w-4" /> Open recruiter on LinkedIn
              </a>
            ) : null}
            <button type="button" onClick={onClose} className="hs-btn w-full justify-center">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
