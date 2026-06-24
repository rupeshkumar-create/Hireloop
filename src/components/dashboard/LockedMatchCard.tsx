import React from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Lock, MapPin, Wifi } from 'lucide-react';
import { Button } from '../ui/button';
import type { LockedMatchSlot } from './matchPaywall';

interface Props {
  slot: LockedMatchSlot;
}

export function LockedMatchCard({ slot }: Props) {
  return (
    <article className="hs-card-row relative overflow-hidden cursor-default">
      <div className="pointer-events-none select-none blur-[3px] opacity-80 min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--hs-app-muted)]">
            <Wifi className="h-3 w-3" /> Match
          </span>
        </div>
        <h2 className="mb-1 text-[14px] font-semibold text-[var(--hs-app-fg)]">{slot.title}</h2>
        <p className="text-[12px] font-medium text-[var(--hs-app-muted)]">{slot.company}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[var(--hs-app-muted)]">
          <span className="flex items-center">
            <MapPin className="mr-1 h-3.5 w-3.5" /> {slot.location}
          </span>
          <span className="flex items-center">
            <DollarSign className="mr-1 h-3.5 w-3.5" /> {slot.salary}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {typeof slot.matchScore === 'number' ? (
          <span className="hs-score opacity-70" style={{ '--score': `${slot.matchScore}%` } as React.CSSProperties}>
            {slot.matchScore}
          </span>
        ) : null}
        <span className="hs-pill text-[9px]">Locked</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
        <div className="mx-4 flex max-w-xs flex-col items-center rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)]/95 px-5 py-4 text-center shadow-lg">
          <Lock className="mb-2 h-5 w-5 text-[var(--hs-app-accent)]" />
          <p className="text-[13px] font-medium text-[var(--hs-app-fg)]">{slot.teaser}</p>
          <p className="mt-1 text-[11px] text-[var(--hs-app-muted)]">
            Go Pro to unlock 10 AI-picked matches daily.
          </p>
          <Link to="/settings#billing-plan" className="mt-3">
            <Button variant="action" size="sm">
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}
