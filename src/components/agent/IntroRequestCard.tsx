import { Check, X } from 'lucide-react';

type IntroStatus =
  | 'pending'
  | 'accepted'
  | 'skipped'
  | 'recruiter_accepted'
  | 'recruiter_declined'
  | 'scheduled';

type IntroRequestCardProps = {
  company: string;
  jobTitle: string;
  recruiterName: string;
  recruiterTitle?: string;
  status: IntroStatus;
  onAccept?: () => void;
  onSkip?: () => void;
  busy?: boolean;
};

export function IntroRequestCard({
  company,
  jobTitle,
  recruiterName,
  recruiterTitle,
  status,
  onAccept,
  onSkip,
  busy,
}: IntroRequestCardProps) {
  if (status === 'recruiter_accepted' || status === 'scheduled') {
    return (
      <div className="mt-2 max-w-md rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
        <p className="font-semibold text-[var(--hs-app-fg)]">
          {status === 'scheduled' ? 'Call scheduled' : 'Introduction accepted'}
        </p>
        <p className="mt-1 text-[var(--hs-app-muted)]">
          {recruiterName} at {company} wants to move forward on {jobTitle}.
          {status === 'scheduled' ? ' Check your email for calendar details.' : ' I can run a mock interview when you are ready.'}
        </p>
      </div>
    );
  }

  if (status === 'recruiter_declined') {
    return (
      <div className="mt-2 max-w-md rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4 text-sm text-[var(--hs-app-muted)]">
        {recruiterName} passed on {jobTitle} at {company} for now. I will keep searching.
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="mt-2 max-w-md rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
        <p className="font-semibold text-[var(--hs-app-fg)]">Introduction sent</p>
        <p className="mt-1 text-[var(--hs-app-muted)]">
          Waiting for {recruiterName} at {company} to respond on {jobTitle}.
        </p>
      </div>
    );
  }

  if (status === 'skipped') {
    return (
      <div className="mt-2 max-w-md rounded-2xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4 text-sm text-[var(--hs-app-muted)]">
        Introduction skipped for {jobTitle} at {company}.
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-md rounded-2xl border border-[var(--hs-app-accent)]/30 bg-[var(--hs-app-accent-soft)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-accent)]">
        Jack made an introduction
      </p>
      <p className="mt-2 text-sm text-[var(--hs-app-fg)]">
        <strong>{recruiterName}</strong>
        {recruiterTitle ? `, ${recruiterTitle}` : ''} at <strong>{company}</strong> is a fit for{' '}
        <strong>{jobTitle}</strong>.
      </p>
      <p className="mt-1 text-xs text-[var(--hs-app-muted)]">Skipped application · Direct intro · ~2 day process</p>
      {onAccept && onSkip ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="hs-btn hs-btn-primary flex-1 justify-center text-sm"
          >
            <Check className="h-3.5 w-3.5" /> Accept introduction
          </button>
          <button type="button" disabled={busy} onClick={onSkip} className="hs-btn flex-1 justify-center text-sm">
            <X className="h-3.5 w-3.5" /> Skip
          </button>
        </div>
      ) : null}
    </div>
  );
}
