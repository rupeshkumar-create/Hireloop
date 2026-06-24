import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Building2, Check, Loader2, Plus, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  createJillJob,
  fetchJillIntros,
  fetchJillJobs,
  fetchJillProfile,
  respondToIntro,
  saveJillProfile,
} from '../services/jillService';
import type { IntroThread, RecruiterJob, RecruiterProfile } from '../types/jill';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

export function JillDashboard() {
  const { user, profile, loading } = useAuth();
  const [rp, setRp] = useState<RecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [intros, setIntros] = useState<IntroThread[]>([]);
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');

  const [jobTitle, setJobTitle] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [jobLocation, setJobLocation] = useState('Remote');
  const [jobSalary, setJobSalary] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const load = async () => {
    setBooting(true);
    try {
      const [{ profile: p }, { jobs: j }, introRes] = await Promise.all([
        fetchJillProfile(),
        fetchJillJobs().catch(() => ({ jobs: [] as RecruiterJob[] })),
        fetchJillIntros().catch(() => ({ intros: [] as IntroThread[] })),
      ]);
      setRp(p);
      setJobs(j);
      setIntros(introRes.intros || []);
      if (p) {
        setCompanyName(p.companyName);
        setTitle(p.title || '');
        setBio(p.bio || '');
        setJobCompany(p.companyName);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load Jill');
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  if (loading || booting) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hs-app-accent)]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const setupProfile = async () => {
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      const { profile: p } = await saveJillProfile({
        companyName: companyName.trim(),
        title: title.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setRp(p);
      toast.success('Jill profile saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const postJob = async () => {
    if (!jobTitle.trim() || !jobDescription.trim()) {
      toast.error('Title and description required');
      return;
    }
    setSaving(true);
    try {
      const { job } = await createJillJob({
        title: jobTitle.trim(),
        company: (jobCompany || companyName).trim(),
        location: jobLocation.trim(),
        salaryRange: jobSalary.trim() || undefined,
        description: jobDescription.trim(),
      });
      setJobs((prev) => [job, ...prev]);
      setShowPost(false);
      setJobTitle('');
      setJobDescription('');
      toast.success('Role posted — Jack can now route warm intros');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Post failed');
    } finally {
      setSaving(false);
    }
  };

  const handleIntro = async (introId: string, action: 'accept' | 'decline' | 'schedule') => {
    setResponding(introId);
    try {
      const { intro } = await respondToIntro(introId, action);
      setIntros((prev) => prev.map((i) => (i.id === introId ? intro : i)));
      toast.success(action === 'decline' ? 'Introduction declined' : 'Candidate notified via Jack');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
              J
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Jill</h1>
              <p className="text-xs text-foreground-muted">AI recruiting agent for hiring teams</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/chat" className="hs-btn text-sm no-underline">
              Jack (candidates)
            </Link>
            <Link to="/" className="hs-btn text-sm no-underline">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {!rp ? (
          <section className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4" /> Set up Jill for your company
            </div>
            <p className="mt-2 text-sm text-foreground-muted">
              Post roles, review Jack introductions, and accept candidates without flooded inboxes.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground-muted">Company name</label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground-muted">Your title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Head of Talent" className="mt-1" />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium text-foreground-muted">About your team</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1" />
            </div>
            <Button className="mt-6" onClick={() => void setupProfile()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Activate Jill
            </Button>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{rp.companyName}</p>
                  <p className="text-xs text-foreground-muted">{profile?.email}</p>
                </div>
                <Button size="sm" onClick={() => setShowPost((v) => !v)}>
                  <Plus className="mr-2 h-4 w-4" /> Post a role
                </Button>
              </div>

              {showPost ? (
                <div className="mt-6 space-y-4 border-t border-border pt-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" />
                    <Input value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} placeholder="Company" />
                    <Input value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} placeholder="Location" />
                    <Input value={jobSalary} onChange={(e) => setJobSalary(e.target.value)} placeholder="Salary range" />
                  </div>
                  <Textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={4}
                    placeholder="Role description, requirements, ideal candidate…"
                  />
                  <Button onClick={() => void postJob()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Publish role
                  </Button>
                </div>
              ) : null}
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">Open roles</h2>
              <div className="mt-3 space-y-3">
                {jobs.length === 0 ? (
                  <p className="text-sm text-foreground-muted">No roles posted yet.</p>
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{job.title}</p>
                          <p className="text-sm text-foreground-muted">
                            {job.company} · {job.location}
                            {job.salaryRange ? ` · ${job.salaryRange}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">
                Introductions from Jack
              </h2>
              <div className="mt-3 space-y-3">
                {intros.length === 0 ? (
                  <p className="text-sm text-foreground-muted">
                    When candidates accept intros to your roles, they appear here.
                  </p>
                ) : (
                  intros.map((intro) => (
                    <div key={intro.id} className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex items-start gap-3">
                        <UserPlus className="mt-0.5 h-4 w-4 text-violet-600" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{intro.candidateName}</p>
                          <p className="text-sm text-foreground-muted">
                            {intro.jobTitle} at {intro.company}
                          </p>
                          {intro.jackNarration ? (
                            <p className="mt-2 text-xs text-foreground-muted italic">{intro.jackNarration}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-foreground-muted">{intro.candidateEmail}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-wider text-foreground-muted">
                            {intro.threadStatus?.replace(/_/g, ' ') || intro.status}
                          </p>
                        </div>
                      </div>
                      {intro.threadStatus === 'sent_to_recruiter' ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleIntro(intro.id, 'accept')}
                            disabled={responding === intro.id}
                          >
                            {responding === intro.id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-3.5 w-3.5" />
                            )}
                            Accept intro
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleIntro(intro.id, 'schedule')}
                            disabled={responding === intro.id}
                          >
                            Schedule call
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleIntro(intro.id, 'decline')}
                            disabled={responding === intro.id}
                          >
                            <X className="mr-2 h-3.5 w-3.5" /> Decline
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
