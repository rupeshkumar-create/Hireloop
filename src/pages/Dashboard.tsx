import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, List } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { useDashboardAI } from '../hooks/useDashboardAI';
import { ResumeUploader } from '../components/dashboard/ResumeUploader';
import { OverviewTab } from '../components/dashboard/OverviewTab';
import { MatchesTab } from '../components/dashboard/MatchesTab';
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import { PageShell } from '../components/ui/page-shell';
import type { Job } from '../types/dashboard';
import { jobFingerprint } from '../services/jobResearcher';

export function Dashboard() {
  const { profile, user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobFingerprints, setSavedJobFingerprints] = useState<string[]>([]);
  const [savingJobFingerprints, setSavingJobFingerprints] = useState<string[]>([]);

  const {
    filteredAndSortedJobs, loadingJobs, generatingJobs, requestJobs,
    stats, statsLoading, fetchJobs, saveJob, dismissJob, trackJobClick,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    filterWorkType, setFilterWorkType,
    sortBy, setSortBy,
    lastFetchTime,
    dailyJobsMeta,
    nextJobDeliveryAt,
  } = useDashboardJobs(user, profile, updateProfile);

  const {
    aiAction, setAiAction,
    aiResult,
    actionLoading,
    handleAiAction,
    downloadResume,
  } = useDashboardAI(profile);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Payment processing! Your account will be upgraded shortly.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSaveJob = async (job: Job) => {
    const fp = jobFingerprint(job.title, job.company);
    if (savingJobFingerprints.includes(fp) || savedJobFingerprints.includes(fp)) {
      return false;
    }

    setSavingJobFingerprints((cur) => [...cur, fp]);
    try {
    const didSave = await saveJob(job);
    if (!didSave) return false;
    setSavedJobFingerprints((cur) => (cur.includes(fp) ? cur : [...cur, fp]));
    return true;
    } finally {
      setSavingJobFingerprints((cur) => cur.filter((value) => value !== fp));
    }
  };

  if (!profile?.resumeText) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <PageShell
      title="Dashboard"
      description={`Welcome back, ${user?.displayName?.split(' ')[0] || 'Candidate'}. Here are your latest AI-curated matches.`}
    >
      <div className="flex flex-col h-full">
        {/* Tab switcher */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex rounded-full border border-border bg-surface-hover p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] border border-transparent ${
                activeTab === 'overview'
                  ? 'bg-[var(--ember-tint)] text-foreground border-[var(--ember-400)]'
                  : 'text-foreground-muted hover:bg-border/50 hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] border border-transparent ${
                activeTab === 'matches'
                  ? 'bg-[var(--ember-tint)] text-foreground border-[var(--ember-400)]'
                  : 'text-foreground-muted hover:bg-border/50 hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
              Daily Matches
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {activeTab === 'overview' && (
            <OverviewTab
              stats={stats}
              statsLoading={statsLoading}
              profile={profile}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'matches' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <MatchesTab
                plan={profile?.plan}
                jobs={filteredAndSortedJobs}
                loadingJobs={loadingJobs}
                generatingJobs={generatingJobs}
                onRequestJobs={requestJobs}
                fetchJobs={fetchJobs}
                filterCompany={filterCompany} setFilterCompany={setFilterCompany}
                filterLocation={filterLocation} setFilterLocation={setFilterLocation}
                filterSalary={filterSalary} setFilterSalary={setFilterSalary}
                filterWorkType={filterWorkType} setFilterWorkType={setFilterWorkType}
                sortBy={sortBy} setSortBy={setSortBy}
                selectedJob={selectedJob} setSelectedJob={setSelectedJob}
                setAiAction={setAiAction}
                saveJob={handleSaveJob}
                savedJobFingerprints={savedJobFingerprints}
                dismissJob={dismissJob}
                lastFetchTime={lastFetchTime}
                dailyJobsMeta={dailyJobsMeta}
                nextJobDeliveryAt={nextJobDeliveryAt}
              />
            </motion.div>
          )}

          <AnimatePresence>
            {selectedJob && (
              <JobDetailsPanel
                selectedJob={selectedJob}
                saveJob={handleSaveJob}
                dismissJob={dismissJob}
                trackJobClick={trackJobClick}
                handleAiAction={handleAiAction}
                aiAction={aiAction}
                aiResult={aiResult}
                actionLoading={actionLoading}
                downloadResume={downloadResume}
                onClose={() => setSelectedJob(null)}
                isSaved={savedJobFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company))}
                isSaving={savingJobFingerprints.includes(jobFingerprint(selectedJob.title, selectedJob.company))}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}
