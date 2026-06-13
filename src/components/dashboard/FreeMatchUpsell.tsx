import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { PRO_MONTHLY_USD } from '../../lib/pricing';
import { isProPlan } from '../../lib/planLimits';

interface Props {
  plan?: string;
}

/** Upsell Pro AI application tools — free users already receive full daily job matches. */
export function FreeMatchUpsell({ plan }: Props) {
  if (isProPlan(plan)) return null;

  return (
    <div className="rounded-xl border border-[var(--hs-app-accent)]/25 bg-[var(--hs-app-accent-soft)] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--hs-app-accent)]/15 text-[var(--hs-app-accent)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--hs-app-fg)]">
            Upgrade to Pro for AI application tools
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--hs-app-muted)]">
            Your free plan includes 10 AI-scored job matches every day. Pro unlocks tailored resumes,
            cold outreach emails, cover letters, and interview prep for each saved role — from ${PRO_MONTHLY_USD}/mo.
          </p>
          <Link to="/settings#billing-plan" className="mt-3 inline-block">
            <Button variant="action" size="sm">
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
