import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ExternalLink, Trash2, MapPin, LayoutGrid, List, ChevronUp, ChevronDown, Mail, FileText, MessageSquare, Download, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { AssetEditorModal } from '../components/dashboard/AssetEditorModal';
import * as Tooltip from '@radix-ui/react-tooltip';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { generateColdEmail, tailorResume, generateInterviewQuestions, improveTextWithAI, updateLearningProfile } from '../services/aiService';
import { applyLearningEvent } from '../services/learningSignals';
import { ResumePreviewModal } from '../components/dashboard/ResumePreviewModal';
import { PageShell } from '../components/ui/page-shell';
import {
  assetCompleteness,
  followUpHint,
  pipelineMetrics,
  searchTrackedJobs,
  statusTransitionPatch,
  timeAwareLabel,
  trackedJobsToCsv,
  trackedJobsToIcs,
} from '../lib/trackedJob';
import { generateFollowUpEmail } from '../services/aiService';
import { Search as SearchIcon } from 'lucide-react';

interface TrackedJob {
  id: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  status: string;
  url: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
  coldEmail?: string;
  tailoredResume?: string;
  interviewQuestions?: string | string[];
  contactEmail?: string;
}

function toLearningEventJob(job: TrackedJob) {
  return {
    title: job.title,
    company: job.company,
    description: job.notes,
    requirements: [],
  };
}

const STATUSES = ['saved', 'applied', 'interviewing', 'offered', 'rejected'];

export function JobTracker() {
  const { user, profile, updateProfile } = useAuth();
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'list'>(() => {
    return (localStorage.getItem('jobTrackerViewMode') as 'board' | 'list') || 'board';
  });
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  // Search query + follow-up generation state used by the new pipeline header.
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState<string | null>(null);
  // Native HTML5 drag-and-drop state for the kanban board. `draggingJobId`
  // tracks the card the user picked up; `dragOverStatus` is the column the
  // pointer is currently over, so we can give it a visual cue.
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  
  const [editorModal, setEditorModal] = useState<{
    isOpen: boolean;
    job: TrackedJob | null;
    type: 'email' | 'resume' | 'interview' | null;
    content: string;
  }>({ isOpen: false, job: null, type: null, content: '' });

  const [previewResumeData, setPreviewResumeData] = useState<{text: string, company: string} | null>(null);

  // When expanding a new job, reset edit states
  useEffect(() => {
    if (expandedJobId) {
      const job = jobs.find(j => j.id === expandedJobId);
    }
  }, [expandedJobId, jobs]);

  useEffect(() => {
    localStorage.setItem('jobTrackerViewMode', viewMode);
  }, [viewMode]);
  
  // AI Action States for List View
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [backfillLoading, setBackfillLoading] = useState(false);

  const hasValidText = (value?: string) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return !trimmed.toLowerCase().startsWith('error ');
  };

  const hasValidInterview = (value?: string | string[]) => {
    if (Array.isArray(value)) return value.length > 0;
    return hasValidText(value);
  };

  const ensureGeneratedContent = (
    type: 'email' | 'resume' | 'interview',
    value: string | string[]
  ) => {
    const isValid =
      type === 'interview'
        ? hasValidInterview(value)
        : hasValidText(typeof value === 'string' ? value : value.join('\n\n'));

    if (!isValid) {
      const label =
        type === 'email' ? 'cold email' : type === 'resume' ? 'tailored resume' : 'interview Q/A';
      throw new Error(`Failed to generate ${label}.`);
    }

    return value;
  };

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'trackedJobs'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData: TrackedJob[] = [];
      snapshot.forEach((doc) => {
        jobsData.push({ id: doc.id, ...doc.data() } as TrackedJob);
      });
      // Sort by created at descending
      jobsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJobs(jobsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trackedJobs');
    });

    return () => unsubscribe();
  }, [user]);

  // Apply the search query to the full jobs list. All downstream rendering
  // (board columns, list view) reads from this filtered set.
  const visibleJobs = React.useMemo(
    () => searchTrackedJobs(jobs as any, searchQuery),
    [jobs, searchQuery],
  ) as TrackedJob[];
  const metrics = React.useMemo(() => pipelineMetrics(jobs as any), [jobs]);

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (jobs.length === 0) {
      toast.info('No tracked jobs to export.');
      return;
    }
    downloadFile(
      `hireschema-pipeline-${new Date().toISOString().slice(0, 10)}.csv`,
      trackedJobsToCsv(jobs as any),
      'text/csv;charset=utf-8',
    );
    toast.success(`Exported ${jobs.length} job${jobs.length === 1 ? '' : 's'} to CSV.`);
  };

  const handleExportIcs = () => {
    const withInterview = jobs.filter((j: any) => j.interviewAt);
    if (withInterview.length === 0) {
      toast.info('No scheduled interviews to export. Set an interview date on a card first.');
      return;
    }
    downloadFile(
      `hireschema-interviews-${new Date().toISOString().slice(0, 10)}.ics`,
      trackedJobsToIcs(jobs as any),
      'text/calendar;charset=utf-8',
    );
    toast.success(`Exported ${withInterview.length} interview${withInterview.length === 1 ? '' : 's'} to calendar.`);
  };

  const generateFollowUp = async (job: TrackedJob) => {
    if (followUpLoading) return;
    const daysSince = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date((job as any).appliedAt || job.createdAt).getTime()) / 86_400_000,
      ),
    );
    setFollowUpLoading(job.id);
    try {
      toast.loading('Drafting follow-up email…', { id: 'follow-up' });
      const body = await generateFollowUpEmail(
        job.title,
        job.company,
        daysSince,
        profile?.resumeSummary || profile?.resumeText || '',
        job.coldEmail || '',
        profile?.antiSlopEnabled !== false,
        profile?.learningProfile?.writingStyle || '',
      );
      await updateDoc(doc(db, 'trackedJobs', job.id), {
        followUpEmail: body,
        updatedAt: new Date().toISOString(),
      } as any);
      toast.success('Follow-up email ready in this job\'s editor.', { id: 'follow-up' });
    } catch (e: any) {
      toast.error(`Couldn't draft follow-up: ${e?.message || 'Unknown error'}`, { id: 'follow-up' });
    } finally {
      setFollowUpLoading(null);
    }
  };

  const updateStatus = async (jobId: string, newStatus: string) => {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    // Use the shared transition helper so stage timestamps stamp consistently:
    // appliedAt fires only the first time the job hits "applied", statusChangedAt
    // fires on every transition. Idempotent — same status → empty patch (no write).
    const patch = statusTransitionPatch(job as any, newStatus as any);
    if (Object.keys(patch).length === 0) return;
    try {
      await updateDoc(doc(db, 'trackedJobs', jobId), patch as any);

      if (newStatus === 'applied' && job.status !== 'applied' && profile && updateProfile) {
        try {
          const nextSignals = applyLearningEvent(
            profile.learningSignals,
            'applied',
            toLearningEventJob(job)
          );
          await updateProfile({ learningSignals: nextSignals });
        } catch (learningError) {
          console.error('Failed to record applied-job learning event:', learningError);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trackedJobs/${jobId}`);
    }
  };

  const removeJob = async (jobId: string) => {
    if (window.confirm('Are you sure you want to remove this job?')) {
      try {
        await deleteDoc(doc(db, 'trackedJobs', jobId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `trackedJobs/${jobId}`);
      }
    }
  };

  const handleGenerateAsset = async (job: TrackedJob, type: 'email' | 'resume' | 'interview') => {
    const loadingKey = `${job.id}-${type}`;
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
    
    try {
      let updateData: Partial<TrackedJob> = {};
      
      if (type === 'email') {
        const email = ensureGeneratedContent(
          'email',
          await generateColdEmail(job.title, job.company, profile?.resumeText || '', true, profile?.learningProfile?.writingStyle)
        ) as string;
        updateData = { coldEmail: email };
      } else if (type === 'resume') {
        const resume = ensureGeneratedContent(
          'resume',
          await tailorResume(job.title, job.notes || '', profile?.resumeText || '', true, profile?.learningProfile?.writingStyle)
        ) as string;
        updateData = { tailoredResume: resume };
      } else if (type === 'interview') {
        const questions = ensureGeneratedContent(
          'interview',
          await generateInterviewQuestions(job.title, job.company, true)
        );
        updateData = { interviewQuestions: questions };
      }

      await updateDoc(doc(db, 'trackedJobs', job.id), {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      // Activation event — same definition as the Dashboard AI Copilot path:
      // first successful asset generation marks the user as activated.
      // Without this, generating from /jobs leaves the "first asset" step
      // of the Getting Started checklist unticked even though the work was
      // done. Idempotent on the profile side (only writes once).
      if (profile && !profile.activatedAt && updateProfile) {
        try {
          await updateProfile({ activatedAt: new Date().toISOString() });
        } catch {
          // Best-effort — activation is telemetry, not a blocker.
        }
      }
      toast.success(
        type === 'interview' ? 'Interview Q/A generated.' : type === 'resume' ? 'Tailored resume generated.' : 'Cold email generated.'
      );
    } catch (error: any) {
      console.error("Error generating asset:", error);
      if (error.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue using AI features.', { duration: 6000 });
      } else {
        toast.error(error.message || "Failed to generate content. Please try again.");
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleGenerateAllAssets = async (job: TrackedJob, options?: { silent?: boolean }) => {
    const loadingKey = `${job.id}-all`;
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
    
    try {
      if (!options?.silent) toast.info('Generating all AI assets...');
      const results = await Promise.allSettled([
        generateColdEmail(job.title, job.company, profile?.resumeText || '', true, profile?.learningProfile?.writingStyle),
        tailorResume(job.title, job.notes || '', profile?.resumeText || '', true, profile?.learningProfile?.writingStyle),
        generateInterviewQuestions(job.title, job.company, true)
      ]);

      const [emailRes, resumeRes, interviewRes] = results;
      const updateData: Partial<TrackedJob> = {};
      let failed = 0;
      if (emailRes.status === 'fulfilled') {
        try {
          updateData.coldEmail = ensureGeneratedContent('email', emailRes.value) as string;
        } catch {
          failed++;
        }
      } else failed++;
      if (resumeRes.status === 'fulfilled') {
        try {
          updateData.tailoredResume = ensureGeneratedContent('resume', resumeRes.value) as string;
        } catch {
          failed++;
        }
      } else failed++;
      if (interviewRes.status === 'fulfilled') {
        try {
          updateData.interviewQuestions = ensureGeneratedContent('interview', interviewRes.value);
        } catch {
          failed++;
        }
      } else failed++;

      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, 'trackedJobs', job.id), {
          ...updateData,
          updatedAt: new Date().toISOString()
        });
        // Activation event — first successful asset generation, same
        // semantics as the Dashboard AI Copilot path.
        if (profile && !profile.activatedAt && updateProfile) {
          try {
            await updateProfile({ activatedAt: new Date().toISOString() });
          } catch {
            /* best-effort */
          }
        }
      }

      if (!options?.silent) {
        if (failed === 0) toast.success('All AI assets generated successfully!');
        else if (Object.keys(updateData).length > 0) toast.success('Some AI assets generated. Click refresh to fill missing ones.');
        else toast.error('Failed to generate AI assets. Please try again.');
      }
    } catch (error: any) {
      console.error("Error generating all assets:", error);
      if (error.message === 'AI_QUOTA_EXCEEDED') {
        if (!options?.silent) toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to continue using AI features.', { duration: 6000 });
      } else {
        if (!options?.silent) toast.error("Failed to generate content. Please try again.");
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleBackfillMissingAssets = async () => {
    if (profile?.plan?.toLowerCase() !== 'pro') return;
    if (!profile?.resumeText) {
      toast.error('Upload your resume in Settings to generate AI assets.');
      return;
    }

    const jobsToFix = jobs.filter((j) => {
      const needsEmail = !hasValidText(j.coldEmail);
      const needsResume = !hasValidText(j.tailoredResume);
      const needsInterview = !hasValidInterview(j.interviewQuestions);
      return needsEmail || needsResume || needsInterview;
    });

    if (jobsToFix.length === 0) {
      toast.info('No missing AI assets found.');
      return;
    }

    setBackfillLoading(true);
    try {
      toast.info(`Backfilling AI assets for ${jobsToFix.length} saved jobs...`);
      for (const job of jobsToFix) {
        await handleGenerateAllAssets(job, { silent: true });
      }
      toast.success('Backfill complete.');
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleModalImproveText = async (instruction: string) => {
    if (!editorModal.job || !editorModal.type) return;
    const { job, type, content } = editorModal;
    const loadingKey = `${job.id}-${type}-improve`;
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const newText = await improveTextWithAI(content, instruction, profile?.learningProfile?.writingStyle);
      setEditorModal(prev => ({ ...prev, content: newText }));
      toast.success('Content improved!');
    } catch (e: any) {
      if (e.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits.', { duration: 6000 });
      } else {
        toast.error('Failed to improve text.');
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleModalSaveText = async (newContent: string) => {
    if (!editorModal.job || !editorModal.type) return;
    const { job, type } = editorModal;
    try {
      let updateData = {};
      if (type === 'email') updateData = { coldEmail: newContent };
      if (type === 'resume') updateData = { tailoredResume: newContent };
      if (type === 'interview') updateData = { interviewQuestions: newContent };

      await updateDoc(doc(db, 'trackedJobs', job.id), {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Changes saved!');
      
      if (profile && updateProfile && (type === 'email' || type === 'resume')) {
        const actionType = type === 'email' ? 'edit_email' : 'edit_resume';
        updateLearningProfile(actionType, newContent, profile.learningProfile?.writingStyle)
          .then(newStyle => {
            updateProfile({
              learningProfile: { ...profile.learningProfile, writingStyle: newStyle }
            });
          });
      }

      // Update local state in editor to match
      setEditorModal(prev => ({ ...prev, content: newContent, isOpen: false }));
    } catch (e) {
      toast.error('Failed to save changes.');
    }
  };

  const openEditor = (job: TrackedJob, type: 'email' | 'resume' | 'interview') => {
    let content = '';
    if (type === 'email') content = job.coldEmail || '';
    if (type === 'resume') content = job.tailoredResume || '';
    if (type === 'interview') {
      content = Array.isArray(job.interviewQuestions) 
        ? job.interviewQuestions.join('\n\n') 
        : (job.interviewQuestions || '');
    }
    setEditorModal({ isOpen: true, job, type, content });
  };

  const updateContactEmail = async (jobId: string, email: string) => {
    try {
      await updateDoc(doc(db, 'trackedJobs', jobId), { contactEmail: email, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trackedJobs/${jobId}`);
    }
  };

  const openTrackedJobLink = async (job: TrackedJob) => {
    if (profile && updateProfile) {
      try {
        const nextSignals = applyLearningEvent(
          profile.learningSignals,
          'clicked',
          toLearningEventJob(job)
        );
        await updateProfile({ learningSignals: nextSignals });
      } catch (learningError) {
        console.error('Failed to record clicked-job learning event:', learningError);
      }
    }

    window.open(job.url, '_blank');
  };

  const sendEmail = (job: TrackedJob) => {
    if (!hasValidText(job.coldEmail)) return;
    const mailBody = encodeURIComponent(`${job.coldEmail || ''}\n\nJob URL: ${job.url}\n\n[Please see my resume attached]`);
    const to = job.contactEmail ? `&to=${encodeURIComponent(job.contactEmail)}` : '';
    window.open(`https://mail.google.com/mail/?view=cm&fs=1${to}&su=Application for ${job.title}&body=${mailBody}`, '_blank');
  };

  return (
    <div className="hs-view">
    <PageShell
      title="Job Tracker"
      description="Manage and track your job applications."
      actions={
        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-border bg-surface-hover p-1">
            <Button 
              variant={viewMode === 'board' ? 'default' : 'ghost'} 
              size="sm" 
              className={cn('px-3 border border-transparent', viewMode === 'board' ? 'bg-[var(--ember-tint)] border-[var(--ember-400)]' : 'text-foreground-muted')}
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="h-4 w-4 mr-2" /> Board
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm" 
              className={cn('px-3 border border-transparent', viewMode === 'list' ? 'bg-[var(--ember-tint)] border-[var(--ember-400)]' : 'text-foreground-muted')}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" /> History List
            </Button>
          </div>
          {profile?.plan?.toLowerCase() === 'pro' && (
            <Button size="sm" variant="outline" disabled={backfillLoading} onClick={handleBackfillMissingAssets}>
              {backfillLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Backfill Missing AI Assets
            </Button>
          )}
        </div>
      }
    >
      <div className="flex h-full flex-col space-y-6">

      {/* Funnel metrics + search bar + exports — new pipeline header */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Save → Apply</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {(metrics.saveToApplyRate * 100).toFixed(0)}<span className="text-sm text-foreground-muted">%</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Apply → Interview</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {(metrics.applyToInterviewRate * 100).toFixed(0)}<span className="text-sm text-foreground-muted">%</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Interview → Offer</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {(metrics.interviewToOfferRate * 100).toFixed(0)}<span className="text-sm text-foreground-muted">%</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Median time to apply</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {metrics.medianTimeToApplyDays != null
                  ? <>{metrics.medianTimeToApplyDays}<span className="text-sm text-foreground-muted"> d</span></>
                  : <span className="text-sm text-foreground-muted">—</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, company, location, notes…"
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-accent)]/30"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportIcs}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> .ics
            </Button>
          </div>
        </div>
      )}

      {viewMode === 'board' ? (
        <Tooltip.Provider delayDuration={200}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
            {STATUSES.map(status => (
              <div
                key={status}
                className={[
                  'flex h-[calc(100vh-220px)] flex-col rounded-xl border bg-surface p-4 transition-colors',
                  dragOverStatus === status
                    ? 'border-[var(--hs-app-accent)] bg-[var(--hs-app-accent-soft)] ring-2 ring-[var(--hs-app-accent)]/30'
                    : 'border-border',
                ].join(' ')}
                onDragOver={(e) => {
                  if (!draggingJobId) return;
                  e.preventDefault();
                  // Required so the drop event fires; "move" cue updates the
                  // cursor and visually distinguishes column hover state.
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverStatus !== status) setDragOverStatus(status);
                }}
                onDragLeave={() => {
                  if (dragOverStatus === status) setDragOverStatus(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const jobId = e.dataTransfer.getData('text/plain') || draggingJobId;
                  setDragOverStatus(null);
                  setDraggingJobId(null);
                  if (jobId) void updateStatus(jobId, status);
                }}
              >
                <h3 className="font-medium text-foreground capitalize mb-4 flex items-center justify-between">
                  {status}
                  <Badge variant="secondary" className="font-normal normal-case tracking-normal">{visibleJobs.filter(j => j.status === status).length}</Badge>
                </h3>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  <AnimatePresence>
                    {visibleJobs.filter(j => j.status === status).map((job, idx) => (
                      // Native HTML5 drag wrapper. We keep this as a plain
                      // <div> rather than putting `draggable` directly on the
                      // motion.div because framer-motion types its own
                      // onDragStart (PointerEvent), which conflicts with the
                      // native DragEvent we need. Wrapping leaves motion.div's
                      // layout / mount-exit animations intact.
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', job.id);
                          setDraggingJobId(job.id);
                        }}
                        onDragEnd={() => {
                          setDraggingJobId(null);
                          setDragOverStatus(null);
                        }}
                        style={{ opacity: draggingJobId === job.id ? 0.4 : 1, cursor: draggingJobId === job.id ? 'grabbing' : 'grab' }}
                      >
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="cursor-grab transition-colors hover:border-border-strong">
                          <CardContent className="p-4">
                            <h4 className="font-medium text-sm text-foreground leading-tight mb-1">{job.title}</h4>
                            <p className="text-xs text-foreground-muted mb-3">{job.company}</p>
                            
                            <div className="flex flex-wrap gap-1 mb-3">
                              {job.location && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal"><MapPin className="mr-1 h-2 w-2" />{job.location}</Badge>}
                            </div>

                            {/* Time-aware label — Tier 1.2 */}
                            {(() => {
                              const lbl = timeAwareLabel(job as any);
                              const toneClass = lbl.tone === 'red'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : lbl.tone === 'amber'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : lbl.tone === 'green'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-background text-foreground-muted border-border';
                              return (
                                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClass} mb-2`}>
                                  {lbl.label}
                                </div>
                              );
                            })()}

                            {/* Asset completeness row — Tier 1.3 */}
                            {(() => {
                              const a = assetCompleteness(job as any);
                              const cell = (done: boolean, label: string) => (
                                <span
                                  key={label}
                                  className={`inline-flex items-center gap-1 text-[10px] ${done ? 'text-emerald-700' : 'text-foreground-muted'}`}
                                  title={`${label}: ${done ? 'generated' : 'not yet generated'}`}
                                >
                                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-border'}`} />
                                  {label}
                                </span>
                              );
                              return (
                                <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
                                  {cell(a.resume, 'Resume')}
                                  {cell(a.email, 'Email')}
                                  {cell(a.interview, 'Prep')}
                                  {cell(a.followUp, 'Follow-up')}
                                </div>
                              );
                            })()}

                            {/* Follow-up nudge — Tier 1.4 */}
                            {(() => {
                              const hint = followUpHint(job as any);
                              if (!hint.shouldPrompt) return null;
                              return (
                                <button
                                  type="button"
                                  className="mb-3 w-full rounded-md border border-[var(--hs-app-accent)]/30 bg-[var(--hs-app-accent-soft)] px-2 py-1.5 text-left text-[11px] text-[var(--hs-app-fg)] hover:bg-[var(--hs-app-accent)]/10 disabled:opacity-50"
                                  onClick={(e) => { e.stopPropagation(); generateFollowUp(job); }}
                                  disabled={followUpLoading === job.id}
                                >
                                  {followUpLoading === job.id
                                    ? <><Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> Drafting follow-up…</>
                                    : <><Mail className="inline h-3 w-3 mr-1 text-[var(--hs-app-accent)]" /> {hint.reason}</>}
                                </button>
                              );
                            })()}

                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <select 
                                    className="text-xs border-none bg-transparent text-foreground-muted cursor-pointer focus:ring-0 p-0 font-medium"
                                    value={job.status}
                                    onChange={(e) => updateStatus(job.id, e.target.value)}
                                  >
                                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                  </select>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content className="bg-surface text-foreground text-xs rounded-md border border-border py-1.5 px-2.5 z-50" sideOffset={5}>
                                    <div className="font-medium mb-1">Status: {job.status.charAt(0).toUpperCase() + job.status.slice(1)}</div>
                                    <div className="text-foreground-muted">Updated {formatDistanceToNow(new Date(job.updatedAt || job.createdAt), { addSuffix: true })}</div>
                                    <Tooltip.Arrow className="fill-surface" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                              
                              <div className="flex gap-1">
                                {job.url && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground-muted hover:text-foreground" onClick={() => openTrackedJobLink(job)}>
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground-muted hover:text-[var(--signal-error)] hover:bg-[rgba(217,110,110,0.12)]" onClick={() => removeJob(job.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </Tooltip.Provider>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto pb-8 pr-2">
          {visibleJobs.length === 0 ? (
            <div className="text-center py-12 text-foreground-muted">
              {jobs.length === 0 ? 'No jobs tracked yet.' : 'No matches for that search.'}
            </div>
          ) : (
            visibleJobs.map(job => (
              <Card key={job.id} className="overflow-hidden border-border">
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-background transition-colors"
                  onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                >
                  <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                    <div className="col-span-2">
                      <h3 className="font-medium text-foreground">{job.title}</h3>
                      <p className="text-sm text-foreground-muted">{job.company} {job.location && `• ${job.location}`}</p>
                    </div>
                    <div>
                      <select 
                        className="text-sm border border-border rounded-lg bg-surface text-foreground-muted px-2 py-1 outline-none transition-[border-color,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:border-[var(--ember-400)] focus-visible:shadow-[var(--ember-glow)]"
                        value={job.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); updateStatus(job.id, e.target.value); }}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>
                    <div className="text-right text-sm text-foreground-muted">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    {job.url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); openTrackedJobLink(job); }}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground-muted hover:text-foreground">
                      {expandedJobId === job.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedJobId === job.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border bg-background/50"
                    >
                      {profile?.plan?.toLowerCase() === 'pro' && (
                        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
                          <span className="text-sm font-medium text-foreground flex items-center">
                            <Sparkles className="mr-2 h-4 w-4 text-foreground-muted" /> AI Asset Hub
                          </span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 bg-surface text-xs transition-colors hover:bg-surface-hover"
                            disabled={actionLoading[`${job.id}-all`]}
                            onClick={() => handleGenerateAllAssets(job)}
                          >
                            {actionLoading[`${job.id}-all`] ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                            {actionLoading[`${job.id}-all`] ? 'Generating...' : 'Refresh All AI Assets'}
                          </Button>
                        </div>
                      )}
                      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                        {/* Cold Email Section */}
                        <div className="flex flex-col gap-3 relative h-full">
                          {profile?.plan?.toLowerCase() !== 'pro' && (
                            <div className="absolute inset-0 z-10 bg-surface/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-border">
                              <p className="text-sm font-medium text-foreground mb-2">Pro Feature</p>
                              <Button size="sm" onClick={() => window.location.href = '/settings'}>Upgrade to Unlock</Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-foreground flex items-center"><Mail className="mr-2 h-4 w-4 text-foreground-muted" /> Cold Email</h4>
                            <div className="flex gap-2">
                              {hasValidText(job.coldEmail) && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditor(job, 'email')}>Edit</Button>
                              )}
                              {!hasValidText(job.coldEmail) && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'email')} disabled={actionLoading[`${job.id}-email`]}>
                                  {actionLoading[`${job.id}-email`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {hasValidText(job.coldEmail) ? (
                            <div className="flex-1 bg-surface border border-border rounded-md p-3 text-xs text-foreground-muted max-h-56 min-h-[14rem] overflow-y-auto whitespace-pre-wrap">
                              {job.coldEmail}
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center min-h-[14rem] bg-surface border border-dashed border-border rounded-md text-xs text-foreground-muted italic">No cold email generated yet.</div>
                          )}
                          <div className="mt-auto flex gap-2 items-center">
                            <div className="flex-1 flex relative">
                              <input 
                                type="email" 
                                placeholder="Contact Email (Optional)" 
                                className="w-full text-xs border border-border rounded-md pl-2 pr-20 py-1.5 focus:ring-2 focus:ring-foreground focus:outline-none"
                                value={job.contactEmail || ''}
                                onChange={(e) => updateContactEmail(job.id, e.target.value)}
                              />
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 text-[10px] px-2"
                                disabled={actionLoading[`${job.id}-find-email`]}
                                onClick={async () => {
                                  const loadingKey = `${job.id}-find-email`;
                                  setActionLoading(prev => ({ ...prev, [loadingKey]: true }));
                                  try {
                                    const { extractRecruiterEmail } = await import('../services/aiService');
                                    const email = await extractRecruiterEmail(job.notes || '', job.company);
                                    if (email) {
                                      updateContactEmail(job.id, email);
                                      toast.success('Email found!');
                                    } else {
                                      toast.info('Could not automatically find an email.');
                                    }
                                  } catch (e) {
                                    toast.error('Failed to find email.');
                                  } finally {
                                    setActionLoading(prev => ({ ...prev, [loadingKey]: false }));
                                  }
                                }}
                              >
                                {actionLoading[`${job.id}-find-email`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Auto-find'}
                              </Button>
                            </div>
                            {hasValidText(job.coldEmail) && (
                              <Button size="sm" className="text-xs h-8 whitespace-nowrap" onClick={() => sendEmail(job)}>
                                Send via Gmail
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Tailored Resume Section */}
                        <div className="flex flex-col gap-3 relative h-full">
                          {profile?.plan?.toLowerCase() !== 'pro' && (
                            <div className="absolute inset-0 z-10 bg-surface/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-border">
                              <p className="text-sm font-medium text-foreground mb-2">Pro Feature</p>
                              <Button size="sm" onClick={() => window.location.href = '/settings'}>Upgrade to Unlock</Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-foreground flex items-center"><FileText className="mr-2 h-4 w-4 text-foreground-muted" /> Tailored Resume</h4>
                            <div className="flex gap-2">
                              {hasValidText(job.tailoredResume) && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditor(job, 'resume')}>Edit</Button>
                              )}
                              {!hasValidText(job.tailoredResume) && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'resume')} disabled={actionLoading[`${job.id}-resume`]}>
                                  {actionLoading[`${job.id}-resume`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {hasValidText(job.tailoredResume) ? (
                            <div id={`resume-${job.id}`} className="flex-1 bg-surface border border-border rounded-md p-3 text-xs text-foreground-muted max-h-56 min-h-[14rem] overflow-y-auto markdown-body prose prose-sm max-w-none">
                              <ReactMarkdown>{job.tailoredResume}</ReactMarkdown>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center min-h-[14rem] bg-surface border border-dashed border-border rounded-md text-xs text-foreground-muted italic">No tailored resume generated yet.</div>
                          )}
                          {hasValidText(job.tailoredResume) && (
                            <div className="mt-auto flex gap-2">
                              <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => setPreviewResumeData({text: job.tailoredResume!, company: job.company})}>
                                <FileText className="mr-2 h-3 w-3" /> Preview & Download
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Interview Prep Section */}
                        <div className="flex flex-col gap-3 relative h-full">
                          {profile?.plan?.toLowerCase() !== 'pro' && (
                            <div className="absolute inset-0 z-10 bg-surface/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-border">
                              <p className="text-sm font-medium text-foreground mb-2">Pro Feature</p>
                              <Button size="sm" onClick={() => window.location.href = '/settings'}>Upgrade to Unlock</Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-foreground flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-foreground-muted" /> Interview Q&A</h4>
                            <div className="flex gap-2">
                              {hasValidInterview(job.interviewQuestions) && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditor(job, 'interview')}>Edit</Button>
                              )}
                              {!hasValidInterview(job.interviewQuestions) && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateAsset(job, 'interview')} disabled={actionLoading[`${job.id}-interview`]}>
                                  {actionLoading[`${job.id}-interview`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                                </Button>
                              )}
                            </div>
                          </div>
                          {hasValidInterview(job.interviewQuestions) ? (
                            <div className="flex-1 bg-surface border border-border rounded-md p-4 text-xs text-foreground-muted max-h-56 min-h-[14rem] overflow-y-auto markdown-body prose prose-sm max-w-none">
                              {Array.isArray(job.interviewQuestions) ? (
                                <ul className="list-decimal pl-5 space-y-3">
                                  {job.interviewQuestions.map((q, i) => (
                                    <li key={i} className="leading-relaxed">{q}</li>
                                  ))}
                                </ul>
                              ) : (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.interviewQuestions as string}</ReactMarkdown>
                              )}
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center min-h-[14rem] bg-surface border border-dashed border-border rounded-md text-xs text-foreground-muted italic">No interview questions generated yet.</div>
                          )}
                          {hasValidInterview(job.interviewQuestions) && (
                            <div className="mt-auto flex gap-2">
                              <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => {
                                const text = Array.isArray(job.interviewQuestions) ? job.interviewQuestions.join('\n\n') : job.interviewQuestions;
                                const blob = new Blob([text!], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Interview_Prep_${job.company.replace(/\s+/g, '_')}.md`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                toast.success("Interview Prep downloaded!");
                              }}>
                                Download Q&A
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="px-5 pb-4 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8" onClick={() => removeJob(job.id)}>
                          <Trash2 className="mr-2 h-3 w-3" /> Delete Job
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            ))
          )}
        </div>
      )}
      <ResumePreviewModal 
        isOpen={!!previewResumeData}
        onClose={() => setPreviewResumeData(null)}
        resumeText={previewResumeData?.text || ''}
        companyName={previewResumeData?.company || ''}
      />

      {editorModal.isOpen && editorModal.job && editorModal.type && (
        <AssetEditorModal
          isOpen={editorModal.isOpen}
          onClose={() => setEditorModal({ isOpen: false, job: null, type: null, content: '' })}
          title={
            editorModal.type === 'email' ? `Cold Email for ${editorModal.job.company}` :
            editorModal.type === 'resume' ? `Tailored Resume for ${editorModal.job.company}` :
            `Interview Prep for ${editorModal.job.company}`
          }
          type={editorModal.type}
          initialContent={editorModal.content}
          onSave={handleModalSaveText}
          onAiImprove={handleModalImproveText}
          isAiLoading={!!actionLoading[`${editorModal.job.id}-${editorModal.type}-improve`]}
        />
      )}
      </div>
    </PageShell>
    </div>
  );
}
