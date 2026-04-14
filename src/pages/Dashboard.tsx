import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, List, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobs } from '../hooks/useDashboardJobs';
import { useDashboardAI } from '../hooks/useDashboardAI';
import { ResumeUploader } from '../components/dashboard/ResumeUploader';
import { OverviewTab } from '../components/dashboard/OverviewTab';
import { MatchesTab } from '../components/dashboard/MatchesTab';
import { JobDetailsPanel } from '../components/dashboard/JobDetailsPanel';
import { Button } from '../components/ui/button';
import { PageShell } from '../components/ui/page-shell';
import { Job } from '../types/dashboard';

export function Dashboard() {
  const { profile, user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const {
    filteredAndSortedJobs, loadingJobs,
    stats, statsLoading, fetchJobs, saveJob,
    filterCompany, setFilterCompany,
    filterLocation, setFilterLocation,
    filterSalary, setFilterSalary,
    sortBy, setSortBy,
    lastFetchTime
  } = useDashboardJobs(user, profile, updateProfile);

  const {
    aiAction, setAiAction,
    aiResult,
    actionLoading,
    handleAiAction,
    downloadResume
  } = useDashboardAI(profile);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Payment processing! Your account will be upgraded shortly.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Automatically fetch jobs if moving to matches and no jobs yet
  useEffect(() => {
    if (profile?.careerPaths && profile.careerPaths.length > 0 && filteredAndSortedJobs.length === 0 && activeTab === 'matches' && !loadingJobs) {
      fetchJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeTab, loadingJobs]);

  const isRefreshAvailable = () => {
    if (!lastFetchTime) return true;
    const hoursSinceLastFetch = (Date.now() - new Date(lastFetchTime).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastFetch >= 24;
  };

  if (!profile?.resumeText) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <PageShell
      title="Dashboard"
      description={`Welcome back, ${user?.displayName?.split(' ')[0] || 'Candidate'}. Here are your latest remote matches.`}
      actions={isRefreshAvailable() ? (
        <Button variant="secondary" onClick={() => fetchJobs(true)} disabled={loadingJobs}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
          {loadingJobs ? 'Scanning...' : 'Refresh Matches'}
        </Button>
      ) : undefined}
    >
      <div className="flex flex-col h-full">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex rounded-2xl border border-border bg-surface-hover p-1 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === 'overview' 
                  ? 'bg-surface text-foreground shadow-[0_0_0_1px_var(--color-ring)]' 
                  : 'text-foreground-muted hover:bg-border/50 hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === 'matches' 
                  ? 'bg-surface text-foreground shadow-[0_0_0_1px_var(--color-ring)]' 
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
                jobs={filteredAndSortedJobs}
                loadingJobs={loadingJobs}
                fetchJobs={fetchJobs}
                filterCompany={filterCompany} setFilterCompany={setFilterCompany}
                filterLocation={filterLocation} setFilterLocation={setFilterLocation}
                filterSalary={filterSalary} setFilterSalary={setFilterSalary}
                sortBy={sortBy} setSortBy={setSortBy}
                selectedJob={selectedJob} setSelectedJob={setSelectedJob}
                setAiAction={setAiAction}
              />
            </motion.div>
          )}

          <AnimatePresence>
            {selectedJob && (
              <JobDetailsPanel 
                selectedJob={selectedJob}
                saveJob={saveJob}
                handleAiAction={handleAiAction}
                aiAction={aiAction}
                aiResult={aiResult}
                actionLoading={actionLoading}
                downloadResume={downloadResume}
                onClose={() => setSelectedJob(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}
