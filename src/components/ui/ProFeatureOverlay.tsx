import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './button';

interface Props {
  message?: string;
}

export function ProFeatureOverlay({ message = 'Pro Feature' }: Props) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)]/60 backdrop-blur-[2px]">
      <p className="mb-2 text-sm font-medium text-[var(--hs-app-fg)]">{message}</p>
      <Link to="/settings#billing-plan">
        <Button size="sm">Upgrade to Unlock</Button>
      </Link>
    </div>
  );
}
