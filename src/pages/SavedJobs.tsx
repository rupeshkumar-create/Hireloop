import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bookmark, Clock, CheckCircle2, MessageSquare, XCircle, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardAI } from '../hooks/useDashboardAI';
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import type { Job } from '../types/dashboard';

function initials(company: string) {
  return company.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'JB';
}

type TrackedJob = Job & { 
  status: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected';
  id: string;
  createdAt: string;
};

export function SavedJobs() {
  const { user, profile } = useAuth();
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<TrackedJob | null>(null);

  const {
    aiAction,
    aiResult,
    setAiResult,
    actionLoading,
    handleAiAction,
    downloadResume,
  } = useDashboardAI(profile);

  useEffect(() => {
    if (user) fetchTrackedJobs();
  }, [user]);

  useEffect(() => {
    if (jobId && trackedJobs.length > 0) {
      const found = trackedJobs.find(j => j.id === jobId);
      if (found) setSelectedJob(found);
    } else {
      setSelectedJob(null);
    }
  }, [jobId, trackedJobs]);

  const fetchTrackedJobs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'trackedJobs'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const jobs = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        description: d.data().notes || d.data().description || '',
        workType: d.data().workType || 'remote',
      })) as TrackedJob[];
      setTrackedJobs(jobs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      console.error('Error fetching tracked jobs:', err);
      toast.error('Failed to load your library');
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (id: string, status: TrackedJob['status']) => {
    try {
      await updateDoc(doc(db, 'trackedJobs', id), { status, updatedAt: new Date().toISOString() });
      setTrackedJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j));
      toast.success(`Moved to ${status}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const removeJob = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'trackedJobs', id));
      setTrackedJobs(prev => prev.filter(j => j.id !== id));
      if (selectedJob?.id === id) {
        setSelectedJob(null);
        navigate('/saved');
      }
      toast.success('Removed from library');
    } catch (err) {
      toast.error('Failed to remove job');
    }
  };

  const getStatusIcon = (status: TrackedJob['status']) => {
    switch (status) {
      case 'applied': return <CheckCircle2 className="h-3 w-3" />;
      case 'interviewing': return <MessageSquare className="h-3 w-3" />;
      case 'rejected': return <XCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--hs-app-muted)]" />
      </div>
    );
  }

  return (
    <div className="hs-view space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="hs-label mb-2">Workspace</div>
          <h1 className="hs-section-title">Your Saved Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--hs-app-muted)]">
            Manage your pipeline, track applications, and generate AI assets for your shortlisted roles.
          </p>
        </div>
      </div>

      {trackedJobs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trackedJobs.map((job) => {
            const score = job.matchScore || job.finalScore || 100;
            return (
              <article 
                key={job.id} 
                className="hs-page-card group cursor-pointer transition hover:-translate-y-0.5 hover:border-[var(--hs-app-border-strong)]"
                onClick={() => navigate(`/saved/${job.id}`)}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="hs-company-mark h-8 w-8">{initials(job.company)}</span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold">{job.title}</h2>
                      <p className="truncate text-xs text-[var(--hs-app-muted)]">{job.company} · {job.location}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="hs-score h-8 w-8 text-[9px]" style={{ '--score': `${score}%` } as React.CSSProperties}>{score}</span>
                    <Badge variant={job.status === 'saved' ? 'outline' : 'secondary'} className="gap-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                      {getStatusIcon(job.status)}
                      {job.status}
                    </Badge>
                  </div>
                </div>
                <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--hs-app-muted)] mb-4">{job.aiSummary || job.description}</p>
                
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--hs-app-border)] opacity-0 group-hover:opacity-100 transition-opacity">
                  <select 
                    className="text-[11px] bg-transparent border-0 font-medium text-[var(--hs-app-muted)] focus:ring-0 cursor-pointer"
                    value={job.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateJobStatus(job.id, e.target.value as any)}
                  >
                    <option value="saved">Saved</option>
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offered">Offered</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="hs-page-card py-16 text-center">
          <Bookmark className="mx-auto mb-4 h-9 w-9 text-[var(--hs-app-muted)]" />
          <h2 className="text-lg font-semibold">Library is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--hs-app-muted)]">
            Explore the dashboard and save interesting roles to start building your pipeline here.
          </p>
        </div>
      )}

      {selectedJob && (
        <JobDetailsPanel
          selectedJob={selectedJob}
          saveJob={async () => true}
          dismissJob={() => removeJob(selectedJob.id)}
          trackJobClick={() => {}}
          handleAiAction={handleAiAction}
          aiAction={aiAction}
          aiResult={aiResult}
          setAiResult={setAiResult}
          actionLoading={actionLoading}
          downloadResume={downloadResume}
          onClose={() => navigate('/saved')}
          isSaved={true}
          isSaving={false}
        />
      )}
    </div>
  );
}
