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
    sortBy, setSortBy
  } = useDashboardJobs(user, profile);

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

  if (!profile?.resumeText) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Navigation / Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-zinc-200 pb-4">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'overview' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          <LayoutDashboard className="h-4 w-4" /> Overview
        </button>
        <button 
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'matches' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          <List className="h-4 w-4" /> Daily Matches
        </button>
      </div>

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
          className="flex h-full gap-6 overflow-hidden"
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
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
