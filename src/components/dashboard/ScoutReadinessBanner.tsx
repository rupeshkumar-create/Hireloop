import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type { UserProfile } from '../../contexts/AuthContext';
import { computeMatchReadiness } from '../../services/jobDeliveryProfile';

type ScoutReadinessBannerProps = {
  profile: UserProfile | null;
  hasMatches: boolean;
  generatingJobs: boolean;
};

export function ScoutReadinessBanner({
  profile,
  hasMatches,
  generatingJobs,
}: ScoutReadinessBannerProps) {
  if (!profile) return null;

  const readiness = computeMatchReadiness({
    resumeText: profile.resumeText,
    careerPaths: profile.careerPaths,
  });

  if (readiness.status === 'ready' && readiness.qualityWarnings.length === 0) {
    return null;
  }

  if (readiness.status === 'blocked') {
    return (
      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--hs-app-fg)]">
              Scout can&apos;t find matches until your profile is ready
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-[var(--hs-app-muted)]">
              {!readiness.hasResume ? (
                <li>Upload a resume with at least a few lines of experience (50+ characters).</li>
              ) : null}
              {!readiness.hasCareerPaths ? (
                <li>Add at least one career path or target job title.</li>
              ) : null}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {!readiness.hasResume ? (
                <Link to="/settings" className="hs-btn text-xs py-1.5">
                  Update resume
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
              {!readiness.hasCareerPaths ? (
                <Link to="/settings#job-preferences" className="hs-btn text-xs py-1.5">
                  Add career paths
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (readiness.status === 'partial' && !hasMatches && !generatingJobs) {
    return (
      <div className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-4 py-3">
        <p className="text-[13px] font-semibold text-[var(--hs-app-fg)]">
          Scout can run, but match quality may be limited
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--hs-app-muted)]">
          {readiness.qualityWarnings[0] ||
            'Add a fuller resume in Settings for stronger daily matches.'}
        </p>
        <Link to="/settings" className="hs-btn mt-3 inline-flex text-xs py-1.5">
          Improve resume
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return null;
}
