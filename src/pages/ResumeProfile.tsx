import React from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function initials(name?: string, email?: string) {
  const source = name || email || 'User';
  return source.split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
}

function topSkills(profile: ReturnType<typeof useAuth>['profile']) {
  const skills = [
    ...(profile?.structuredProfile?.skills || []),
    ...(profile?.structuredProfile?.techStack || []),
  ];
  return Array.from(new Set(skills.filter(Boolean))).slice(0, 18);
}

export function ResumeProfile() {
  const { profile } = useAuth();
  const skills = topSkills(profile);
  const careerPaths = profile?.careerPaths || [];
  const resumeText = profile?.resumeCleaned || profile?.resumeText || '';
  const summary = profile?.resumeSummary || resumeText.split(/\n+/).find((line) => line.trim().length > 80) || 'Upload or paste a resume in Settings to build a richer profile.';

  return (
    <div className="hs-view">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="hs-label mb-2">Parsed from your latest resume</div>
          <h1 className="hs-section-title">Your Resume Profile</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/settings" className="hs-btn">
            <Upload className="h-3.5 w-3.5" />
            Re-upload
          </Link>
          <button className="hs-btn" type="button">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24">
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] font-display text-3xl font-semibold">
            {initials(profile?.displayName, profile?.email)}
          </div>
          <h2 className="text-xl font-semibold">{profile?.displayName || 'Rupesh Kumar'}</h2>
          <p className="mb-5 text-sm text-[var(--hs-app-muted)]">{careerPaths[0] || profile?.structuredProfile?.seniority || 'Remote job seeker'}</p>
          <div className="space-y-2 text-xs text-[var(--hs-app-muted)]">
            <div>{profile?.email}</div>
            <div>{profile?.location || profile?.preferences?.locations?.[0] || 'Remote preferred'}</div>
            <div>{profile?.deliveryTimezone || 'Local timezone'}</div>
          </div>
          <div className="mt-6 rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
            <div className="text-3xl font-semibold text-[var(--hs-app-accent)]">{skills.length || '—'}</div>
            <div className="hs-label mt-1">Signals extracted</div>
            <p className="mt-2 text-xs leading-5 text-[var(--hs-app-muted)]">Scores update after you save new resume text.</p>
          </div>
        </aside>

        <main className="hs-page-card">
          <section className="mb-8">
            <div className="hs-label mb-4">Professional Summary</div>
            <p className="text-sm leading-7">{summary}</p>
          </section>

          <section className="mb-8">
            <div className="hs-label mb-4">Career Paths</div>
            <div className="hs-tags">
              {careerPaths.length > 0 ? careerPaths.map((path) => <span key={path} className="hs-pill">{path}</span>) : <span className="text-sm text-[var(--hs-app-muted)]">No career paths saved yet.</span>}
            </div>
          </section>

          <section className="mb-8">
            <div className="hs-label mb-4">Top Skills</div>
            <div className="hs-tags">
              {skills.length > 0 ? skills.map((skill, index) => <span key={`${skill}-${index}`} className={index < 4 ? 'hs-pill hs-pill-success' : 'hs-pill'}>{skill}</span>) : <span className="text-sm text-[var(--hs-app-muted)]">Upload a resume to extract skills.</span>}
            </div>
          </section>

          <section>
            <div className="hs-label mb-4">Resume Text</div>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4 font-mono text-xs leading-6 text-[var(--hs-app-muted)]">
              {resumeText || 'No resume text saved yet.'}
            </pre>
          </section>
        </main>
      </div>
    </div>
  );
}
